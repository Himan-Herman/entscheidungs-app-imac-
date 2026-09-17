# Audit logging — which helper, and why it matters

Engineering reference for `server/services/auditLogService.js`.
Enforced by `scripts/verifyAuditLogCallSites.test.js` (static) and
`scripts/verifyRequiredAuditAtomicity.test.js` (real database).

---

## Two helpers, two guarantees

| | `writeAuditLog` | `writeRequiredAuditLog` |
|---|---|---|
| Returns | `undefined` — **not a promise** | a promise |
| On write failure | swallowed silently | **rejects** |
| Purpose | observational events | security-relevant mutations |
| May be awaited | **no** | yes |
| May be chained | **no** | yes |

`writeAuditLog` is fire-and-forget by design: losing one row must never fail a
request. Chaining `.catch()` onto it throws a `TypeError` on `undefined` — and it
throws *after* the domain mutation has committed, so the row exists, the request
answers 500, and the user is told the opposite of what happened. That shipped
across the appointment, booking, telemedicine, integration, export, inbox and
document paths at once, which is why a static guard now blocks the pattern
rather than relying on review.

---

## Best effort — use `writeAuditLog`

Something was viewed, opened, listed, drafted, queued, or denied. The event is
useful for transparency; losing one is acceptable.

```js
writeAuditLog({ userId, actorRole: "patient", action: "practice_document_opened", ... });
// no await, no .catch — the helper handles its own failures
```

## Mandatory — use `writeRequiredAuditLog`

Per the contract in `auditLogService.js`: creating/activating/revoking a care
link, granting/revoking consent, exporting or sharing patient data, and issuing
or cancelling a prescription.

The rule these carry is stronger than "please log it":

> **An operation whose audit is mandatory must not be able to persist while its
> audit row does not.**

---

## Atomicity

Awaiting the audit *after* the mutation is not enough — the mutation is already
committed, so a failing audit produces exactly the split state the rule forbids.
The audit row therefore joins the mutation's transaction:

```js
const row = await prisma.$transaction(async (tx) => {
  const updated = await tx.consentRecord.update({ ... });

  await writeRequiredAuditLog({ action: "consent_record_revoked", ... }, tx);

  return updated;
});
```

`writeRequiredAuditLog(opts, client)` takes an optional Prisma **or transaction**
client, defaulting to the shared singleton, so callers outside a transaction are
unaffected. `withRequiredAudit(mutate, auditFor)` wraps the same shape when a
service has no transaction of its own yet.

Postgres decides the outcome: if the audit insert fails, the mutation rolls back
with it and the caller sees an error for something that genuinely did not happen.

**Side effects that cannot be rolled back — e-mail, webhooks, external calls —
stay outside the transaction**, after it resolves. So do derived, idempotent
follow-ups such as `syncLinkScopesFromRecords()`: if the transaction rolled back,
there is nothing for them to derive.

---

## Failure policy

| Situation | Outcome |
|---|---|
| Best-effort audit fails | request succeeds; the row is lost silently |
| Mandatory audit fails | **mutation rolls back**; request reports the error |
| Mandatory audit succeeds, mutation fails | both roll back — one transaction |
| Retry after a rolled-back mandatory audit | clean retry; no partial state to reconcile |

---

## What goes into an audit row

Identifiers, actor, action, timestamp, and the scope needed to interpret it.

**Never**: document titles or file names, message bodies, diagnoses, consent
purposes, or any free-text medical content. A title like "MRT Kopf" is medical
information, and an audit log is a different retention class from the record it
describes. `sanitizeAuditMetadata()` is the last line of defence, not a licence
to pass content into it.

---

## Adding a new mandatory action

1. Perform the mutation and `writeRequiredAuditLog(opts, tx)` in one transaction.
2. Add the action name to `REQUIRED_AUDIT_ACTIONS` in
   `scripts/verifyAuditLogCallSites.test.js`, which then fails if anyone routes
   that action through the best-effort helper.
3. Add a failure-injection case to `verifyRequiredAuditAtomicity.test.js` — the
   static guard proves which helper is called, only the database proves the
   rollback.
