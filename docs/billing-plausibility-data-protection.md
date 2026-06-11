# GOÄ/PKV Billing Plausibility — Data Protection, Deletion & Retention

> **Scope**: Internal engineering reference for the MedScoutX GOÄ/PKV billing plausibility module.
>
> **Not legal advice.** This document does not constitute legal counsel, a data-protection opinion,
> or a DSGVO/GDPR compliance certificate. All items require independent review by qualified legal,
> data-protection, and billing compliance professionals before any external practice use.
>
> **Not a DPA/AVV.** This document describes the technical state. A formal Auftragsverarbeitungsvertrag
> (AVV / DPA) signed by a qualified representative is required before processing any practice data
> under the DSGVO.

---

## 1. Data inventory

### 1.1 `BillingPlausibilitySession`

| Field | Type | Content | Personal/Sensitive? |
|-------|------|---------|---------------------|
| `id` | cuid | Internal record ID | No |
| `practiceProfileId` | String (scalar FK) | Practice identifier | Indirectly — links to a practice entity |
| `createdByUserId` | String (scalar FK) | Staff user who created the session | Yes — links to an identified user |
| `status` | String | `pending` / `reviewed` / `dismissed` | No |
| `sourceType` | String | `manual` / `upload` / `api` | No |
| `inputSummaryJson` | JSON | `{ rowCount: number, ziffern: string[] }` — GOÄ codes only | No patient identifiers; commercially sensitive billing pattern |
| `resultSummaryJson` | JSON | Deterministic warnings + catalogue metadata; may include AI review block if `ENABLE_BILLING_AI_REVIEW=true` | No patient identifiers; contains billing analysis |
| `disclaimerVersion` | String | Semver of disclaimer text accepted at submission | No |
| `createdAt` | Timestamp | Creation timestamp | Timestamp of billing activity |
| `updatedAt` | Timestamp | Last update | Timestamp |
| `dismissedAt` | Timestamp? | When session was dismissed | Timestamp |

**Summary**: Each session record identifies a practice and a staff user. GOÄ code patterns submitted by a practice could be commercially sensitive. No patient identifiers are accepted by the route or stored in this model.

---

### 1.2 `BillingPlausibilityItem`

| Field | Type | Content | Personal/Sensitive? |
|-------|------|---------|---------------------|
| `id` | cuid | Internal ID | No |
| `sessionId` | String | FK to session | Links to practice + staff user (via session) |
| `ziffer` | String | GOÄ code (e.g. "1", "34") | No patient identifier; billing code |
| `factor` | String | Billing factor (e.g. "2.3") | No patient identifier |
| `count` | Int | Number of services | No patient identifier |
| `contextText` | String? (max 600 chars) | **Free-text practice note** — intended for billing context only | ⚠ **HIGH RISK** — technically can contain patient data if staff enters it |
| `catalogueMatchJson` | JSON? | Static catalogue lookup result | No patient data |
| `warningsJson` | JSON? | Array of deterministic warning codes | No patient data |
| `createdAt` | Timestamp | | |

**`contextText` risk profile**:
- Intended use: short billing context note ("complex follow-up", "emergency service") entered by practice staff
- API route enforces: no named patient-identifier fields (`patientName`, `dateOfBirth`, `diagnosisText`, etc.) rejected with 400 `patient_data_not_accepted`
- **Not enforced**: the API cannot prevent a staff member from typing patient data in the `contextText` free-text field
- **Where it appears**:
  1. PostgreSQL `BillingPlausibilityItem` row (persisted at rest)
  2. PDF export report (first 120 chars displayed in brackets under each row)
  3. OpenAI prompt when `ENABLE_BILLING_AI_REVIEW=true` (first 500 chars forwarded)
- **Where it does NOT appear**: standard GET API responses (`serializeSession` explicitly excludes `contextText` from all JSON responses)
- **Mitigation in place**: UI placeholder + all i18n locales explicitly instruct no patient data, no diagnosis, no clinical information. Addressed in pilot usage policy.

---

### 1.3 `BillingPlausibilityAuditLog`

| Field | Type | Content | Personal/Sensitive? |
|-------|------|---------|---------------------|
| `id` | cuid | Internal ID | No |
| `sessionId` | String | FK to session (cascade delete) | Links to practice + staff user |
| `actorUserId` | String? | Staff user who performed the action | Yes — identifies a staff member |
| `action` | String | `created` / `dismissed` / `reviewed` | No |
| `metadataJson` | JSON? | `{ rowCount, ziffern, hasWarnings }` or `{ previousStatus }` | No patient data |
| `createdAt` | Timestamp | | |

**Summary**: Audit log rows identify staff members by userId. They are append-only by design and cascade-delete when the parent session is deleted. They must be retained for a defined period to support audit and accountability, but must also be deleted as part of any practice/user erasure request.

---

### 1.4 Data NOT stored

The following fields are explicitly rejected with HTTP 400 at the route layer and are **never stored**:

- `patientName`
- `patientId`
- `dateOfBirth`
- `diagnosisText`
- `clinicalNotes`
- `icd10`
- `diagnosis`

This is verified by `verifyBillingPlausibility.js §6 (route-patient-rejection)`.

---

## 2. Deletion behaviour — current state

### 2.1 Account delete (`DELETE /api/account/delete`)

The account delete endpoint (`server/routes/account.js`) performs the following deletions in a single transaction:

```
preVisitSession.deleteMany     ✅ included
preVisitCase.deleteMany        ✅ included
doctorContact.deleteMany       ✅ included
doctor.deleteMany              ✅ included
auditLog.deleteMany            ✅ included

# Billing plausibility cleanup (Phase D2) — runs BEFORE practiceProfile.deleteMany:
billingPlausibilityAuditLog.deleteMany  ✅ included (by session id)
billingPlausibilityItem.deleteMany      ✅ included (by session id)
billingPlausibilitySession.deleteMany   ✅ included (by id; scope below)

practiceProfile.deleteMany     ✅ included
practiceMember.deleteMany      ✅ included
interpreterCloudSession.deleteMany   ✅ included
interpreterCloudPreference.deleteMany ✅ included
```

**Status (D2 — implemented 2026-06-11)**: `BillingPlausibilitySession` rows are now
deleted as part of account deletion. Because the FKs are scalar (no DB cascade), the
transaction resolves the sessions explicitly and removes them in dependency order.

**Session scope** — a billing session is deleted if **either**:
- `createdByUserId === userId` (the deleted user created it), **or**
- `practiceProfileId` is one of the practice profiles owned by the deleted user
  (resolved via `practiceProfile.findMany({ where: { userId } })` before the
  practice profiles themselves are deleted).

This avoids deleting sessions belonging to practices the account does not own.

**Why explicit deletion is required**:
1. `BillingPlausibilitySession.practiceProfileId` is a scalar FK with **no Prisma `@relation`** to `PracticeProfile` — deleting the practice profile does not cascade.
2. `BillingPlausibilitySession.createdByUserId` is a scalar FK with **no Prisma `@relation`** to `User` — deleting the user does not cascade.
3. `BillingPlausibilityItem` and `BillingPlausibilityAuditLog` **do** cascade from their parent session (`onDelete: Cascade`), but are deleted explicitly first for defense-in-depth and clarity of erasure intent.

**Remaining (D4)**: This fix covers full-account erasure only. Erasing a **single
practice** while the owning account survives still requires the operator erasure
script (Phase D4).

---

### 2.2 Session-level operations (current API)

| Operation | Endpoint | Effect |
|-----------|----------|--------|
| Dismiss | `POST /:sessionId/dismiss` | Sets `status = dismissed`, `dismissedAt = now()` — non-destructive, data retained |
| Hard delete | No endpoint exists | Not implemented |

Sessions are intentionally not deleted by practice staff. Dismissed sessions remain accessible to practice admins. No automated deletion or purge job exists.

---

### 2.3 Account data export (`GET /api/account/export`)

**Status (D3 — implemented 2026-06-11)**: The account export now includes a
`billingPlausibilitySessions` array via the `getBillingPlausibilityExportForUser`
helper (`server/services/billingPlausibility/billingPlausibilityService.js`).

**Scope** (mirrors the D2 deletion scope): sessions the user created OR sessions
owned by any practice profile the user owns (max 500, newest first).

**Exported per session**: `id`, `practiceProfileId`, `createdByUserId`, `status`,
`sourceType`, `disclaimerVersion`, `createdAt`, `updatedAt`, `dismissedAt`,
`inputSummaryJson`, `resultSummaryJson` (deterministic warnings + the validated,
non-binding AI review if present), `items[]` and `auditLog[]`.

**Exported per item**: `ziffer`, `factor`, `count`, `contextTextPresent` (boolean),
`catalogueMatchJson`, `warningsJson`, `createdAt`.

**Exported per audit-log row**: `action`, `actorUserId`, `metadataJson`, `createdAt`.

**Excluded / redacted**:
- **Raw `contextText` value** — only the `contextTextPresent` boolean is exported.
  See the contextText policy decision below.
- **Raw OpenAI prompts and raw AI responses** — these are never persisted by the
  module, so they cannot appear in the export. Only the validated, truncated,
  non-binding `aiReview` (rowHints, generalNote, uncertaintyNote, nonBinding) is
  present inside `resultSummaryJson`.
- No patient-identifier fields (`patientName`, `dateOfBirth`, `diagnosisText`,
  `clinicalNotes`, insurance number, ICD-10) — the module never stores them.

**contextText policy decision (D3)**: **conservative redaction — raw value excluded.**
The data classifies `contextText` as HIGH RISK (§1.2) and already excludes it from
all standard GET API responses. Emitting the raw value into a portable, downloadable
JSON file would risk propagating accidental personal data before legal sign-off.
The export therefore emits a `contextTextPresent` boolean only — enough for Art. 15
transparency (the data subject is told context data exists) without exposing
potentially-accidental personal data. Switching to full inclusion for stronger
Art. 20 portability is a one-line change in `serializeSessionForExport` once legal
approves (see Phase D3 roadmap note).

---

## 3. Retention behaviour — current state

| Item | Current retention | Required |
|------|------------------|---------|
| `BillingPlausibilitySession` | Indefinite — no purge | Define retention period; implement automated delete |
| `BillingPlausibilityItem` | Same as session (cascade delete on session delete) | Included in session retention |
| `BillingPlausibilityAuditLog` | Same as session (cascade delete) | May require separate (longer) retention for audit purposes |
| `contextText` within items | Same as item | Included |
| OpenAI-forwarded contextText | Governed by OpenAI data retention policy | Confirm with OpenAI API data processing terms |

**No retention/purge job exists.** There is no cron, scheduled task, or database-level TTL for any billing table.

---

## 4. AVV / DPA status

| Requirement | Current State |
|-------------|--------------|
| AVV template exists in codebase | ❌ No document |
| AVV signed with any practice | ❌ None (module not in external use) |
| DSGVO legal basis documented | ❌ Not documented |
| Privacy notice updated for billing module | ❌ Not updated |
| OpenAI listed as subprocessor | ❌ Not documented (AI disabled by default) |
| Data transfer assessment (OpenAI EU/non-EU) | ❌ Not completed |

**These items are pre-conditions for any external practice use of this module.**

---

## 5. Pilot policy — AI review must remain disabled externally until DPA conditions are met

**MANDATORY PILOT POLICY**: `ENABLE_BILLING_AI_REVIEW` must remain `false` in any environment
accessible to external practices until ALL of the following are confirmed:

1. An AVV covering OpenAI as a subprocessor is signed with the practice
2. The practice has been informed that `contextText` may be forwarded to OpenAI
3. A DSGVO legal basis for the AI processing has been documented
4. A data transfer assessment for OpenAI (US data processing) has been completed
5. The OpenAI API data retention/deletion policy for prompts has been confirmed

The deterministic billing plausibility path (`ENABLE_BILLING_PLAUSIBILITY=true`, `ENABLE_BILLING_AI_REVIEW=false`) does not involve any subprocessor and has a lower AVV threshold — but an AVV for MedScoutX's own storage of practice billing patterns is still required.

---

## 6. Recommended engineering phases

The following phases are listed in priority order. This section is an engineering proposal only — it does not substitute for legal review.

### Phase D1 (this document — documentation only, no code changes)
- [x] Data inventory documented
- [x] Deletion gaps identified
- [x] Retention gaps identified
- [x] AVV/DPA status captured
- [x] Pilot AI policy stated
- [x] Compliance checklist updated

### Phase D2 — Account deletion cascade ✅ IMPLEMENTED (2026-06-11)

Billing session deletion is now part of the `DELETE /api/account/delete` transaction
in `server/routes/account.js`. The implemented logic:

```javascript
// Inside the existing prisma.$transaction, BEFORE practiceProfile.deleteMany:

// Resolve the practice profiles this user owns (still present at this point).
const ownedPractices = await tx.practiceProfile.findMany({
  where: { userId },
  select: { id: true },
});
const ownedPracticeIds = ownedPractices.map((p) => p.id);

// Sessions in scope: created by this user OR owned by one of their practices.
const billingSessions = await tx.billingPlausibilitySession.findMany({
  where: {
    OR: [
      { createdByUserId: userId },
      ...(ownedPracticeIds.length ? [{ practiceProfileId: { in: ownedPracticeIds } }] : []),
    ],
  },
  select: { id: true },
});
const billingSessionIds = billingSessions.map((s) => s.id);

if (billingSessionIds.length > 0) {
  await tx.billingPlausibilityAuditLog.deleteMany({ where: { sessionId: { in: billingSessionIds } } });
  await tx.billingPlausibilityItem.deleteMany({ where: { sessionId: { in: billingSessionIds } } });
  await tx.billingPlausibilitySession.deleteMany({ where: { id: { in: billingSessionIds } } });
}
```

**Order of operations**: audit logs → items → sessions, all **before**
`practiceProfile.deleteMany` (so practice IDs remain resolvable and no orphan remains).

**Deletion strategy**: hard delete — consistent with the rest of the account-delete
transaction (which hard-deletes pre-visit data, practice profiles and audit logs).
Anonymisation was not chosen because the surrounding flow is a full erasure and the
data is no longer needed once the account is gone (GDPR Art. 17).

**Schema change**: none. No new migration. Uses existing scalar FK columns.

**Verification**: static assertions in `verifyBillingPlausibility.js §16`
(`account-deletion-billing-cleanup`) confirm the route references the billing
deletions, scopes by `createdByUserId` and owned `practiceProfileId`, runs inside
the transaction, and orders audit-log → item → session → practiceProfile correctly.

**Remaining (D4)**: practice-level erasure (deleting one practice while the owning
account survives) is still pending — see Phase D4.

### Phase D3 — Account data export ✅ IMPLEMENTED (2026-06-11)

Billing data is now included in `GET /api/account/export` via the exported helper
`getBillingPlausibilityExportForUser(userId)`
(`server/services/billingPlausibility/billingPlausibilityService.js`), surfaced under
the `billingPlausibilitySessions` key of the export payload.

The helper resolves the user's owned practice IDs and selects sessions where
`createdByUserId === userId` OR `practiceProfileId ∈ owned IDs` (max 500), including
`items` and `auditLog`, then maps each through a privacy-safe whitelist serializer
(`serializeSessionForExport`).

**Field set, exclusions, and the contextText decision** are documented in §2.3 above.

**contextText decision — conservative redaction (raw value excluded).** Rather than
ship the raw free-text (which may contain accidental patient data) into a portable
JSON file, the export emits a `contextTextPresent` boolean. This is consistent with
the existing GET-API exclusion policy. To switch to full inclusion once legal
approves, change the single `contextTextPresent` line in `serializeSessionForExport`
to emit the raw `item.contextText` value.

**Verification**: `verifyBillingPlausibility.js §17` (`account-export-billing-portability`)
asserts the helper is exported and wired into the route, scopes by user + owned
practice, emits `contextTextPresent` (not raw contextText), and contains no
`rawPrompt`/`rawResponse` or patient-identifier fields.

### Phase D4 — Operator erasure script ✅ IMPLEMENTED (2026-06-11)

Implemented as `server/scripts/eraseBillingPlausibilityData.js`
(npm script: `npm run billing:erase`). Operator/admin command-line tool only —
**no user-facing DELETE endpoint**.

**Supported scopes** (at least one required; combined with AND semantics, which only
narrows the match):
- `--sessionId=<id>` — a single session
- `--practiceProfileId=<id>` — all sessions owned by a practice
- `--createdByUserId=<id>` — all sessions created by a user

**Default mode is dry-run.** Erasure happens only when `--confirmErase` is present
and `--dryRun` is absent.

**Production guard**: refuses to run if `DATABASE_URL` is missing or contains
production/Render indicators (`render.com`, `dpg-`, `prod`, `production`,
`postgres.render`, known Render region hosts). Prints the DB host before any action.
Mirrors the guard in `verifyBillingPlausibilityService.js`.

**Safety limits**: refuses with no scope; refuses to erase > 100 sessions unless
`--allowLargeBatch`; in erase mode, refuses when zero sessions match.

**Deletion strategy**: hard delete of the session tree in dependency order
(AuditLog → Item → Session) inside a single transaction. `contextText` is never
printed. Anonymisation mode is documented as a future option but not implemented.

**Command examples**:

```bash
# Dry-run (default — reports counts/IDs/date range, changes nothing):
npm run billing:erase -- --practiceProfileId=<id>
node scripts/eraseBillingPlausibilityData.js --sessionId=<id> --dryRun

# Confirmed erase (PERMANENT — only after reviewing the dry-run output):
node scripts/eraseBillingPlausibilityData.js --practiceProfileId=<id> --confirmErase

# Large batch (> 100 sessions):
node scripts/eraseBillingPlausibilityData.js --createdByUserId=<id> --confirmErase --allowLargeBatch
```

**Verified** end-to-end against throwaway local test data: dry-run reported 1/1/1,
confirmed erase deleted 1/1/1, post-check confirmed zero orphans.

**Future option (not implemented)**: an anonymisation mode (null out `contextText`,
replace `createdByUserId`/`actorUserId` with a tombstone) could retain statistical
rows while removing identifiers — only needed if legal requires retention of
de-identified billing analytics. Hard delete is the current closed-pilot default.

### Phase D5 — Retention purge job (Engineering: ~1–2 days)

Automated deletion of dismissed sessions older than a defined retention period:

```javascript
// Proposed: server/scripts/purgeBillingSessionsOlderThan.js
// Config: BILLING_SESSION_RETENTION_DAYS (env var, default e.g. 365)
// Target: BillingPlausibilitySession WHERE status = 'dismissed' AND dismissedAt < now() - retention
// Cascade: BillingPlausibilityItem and BillingPlausibilityAuditLog cascade-delete via DB FK
// Schedule: run via Render cron or equivalent, e.g. weekly
// Audit: log count of deleted sessions before each purge run
```

**Retention period decision**: must be set by legal/DPO, not engineering. Suggested starting point: 12 months from creation (or 6 months from dismissal), but this requires legal input.

### Phase D6 — AVV template (Legal / Product)

An AVV template for practices using the billing plausibility module, covering:
- Controller: the practice (Verantwortlicher)
- Processor: MedScoutX (Auftragsverarbeiter)
- Subject matter: GOÄ billing code plausibility analysis
- Data categories: billing codes, factors, context notes (no patient identifiers)
- Subprocessors: OpenAI (only if `ENABLE_BILLING_AI_REVIEW=true` is agreed)
- Retention period: as defined in Phase D5
- Deletion/erasure procedure: operator erasure as per Phase D4
- Technical/organisational measures: encryption at rest, access control, audit logging

### Phase D7 — Privacy notice update (Legal / Product)

Add a "Billing plausibility module" section to the Datenschutzerklärung (all languages), covering:
- What data is stored (billing codes, factors, context notes, staff userId)
- Why (contract performance / legitimate interest — legal to confirm)
- Retention period
- Subprocessors (OpenAI if AI enabled)
- User's right of access (Art. 15), deletion (Art. 17), portability (Art. 20)

---

## 7. `contextText` — specific risk mitigations (current and proposed)

| Mitigation | Status |
|------------|--------|
| UI placeholder warns "no patient data, no diagnosis" | ✅ Implemented (all i18n locales) |
| Named patient-identifier fields rejected at route | ✅ Enforced |
| contextText excluded from GET API JSON responses | ✅ `serializeSession` excludes it |
| contextText forwarded to OpenAI capped at 500 chars | ✅ `MAX_CONTEXT_CHARS = 500` |
| contextText stored in DB capped at 600 chars | ✅ `VarChar(600)` in schema |
| contextText appears in downloaded PDF (first 120 chars) | ⚠ Present — documented |
| Pilot usage policy requires staff training re: no patient data | ⬜ Policy document required |
| Server-side content scan for patient-like patterns in contextText | ❌ Not implemented — proposed future enhancement |
| `contextText` deletion on account deletion | ✅ Implemented (Phase D2 — full-account erasure) |
| `contextText` deletion via operator erasure (per practice/user/session) | ✅ Implemented (Phase D4 — `eraseBillingPlausibilityData.js`) |

---

## 8. Summary of confirmed gaps (for engineering tracking)

| # | Gap | Risk | Phase |
|---|-----|------|-------|
| D2-1 | `billingPlausibilitySession.deleteMany` missing from account delete transaction | High — DSGVO Art. 17 | D2 ✅ Done |
| D2-2 | No DB-level cascade from `PracticeProfile` or `User` to `BillingPlausibilitySession` | High | D2 ✅ Mitigated (app-level fix) |
| D3-1 | Billing sessions not included in account data export | Medium — DSGVO Art. 15/20 | D3 ✅ Done |
| D4-1 | No operator erasure script for practice/user/session-level deletion | High — DSGVO Art. 17 | D4 ✅ Done (`eraseBillingPlausibilityData.js`) |
| D5-1 | No automated retention purge job | Medium — policy gap | D5 |
| D6-1 | No AVV template exists | High — required before external use | D6 (Legal) |
| D7-1 | Privacy notice not updated for billing module | High — required before external use | D7 (Legal) |
| C-1  | `contextText` can technically contain patient data if staff enters it | High — data hygiene | Usage policy + future D5 content scan |
| C-2  | OpenAI subprocessor not disclosed if AI enabled | High — required before AI pilot with external practices | D6 + AI staging checklist |
| C-3  | DSGVO legal basis for processing billing code data not documented | High | D6 (Legal) |
| C-4  | OpenAI data retention/deletion policy for API prompts not confirmed | High | D6 (Legal) |

---

## 9. What is safe to use now (internal / sandbox only)

With `ENABLE_BILLING_PLAUSIBILITY=true` and `ENABLE_BILLING_AI_REVIEW=false`:

- ✅ Internal demo with no real practice data
- ✅ Engineering test and verification
- ✅ Closed internal sandbox where the same team controls both the controller and processor roles
- ❌ Any external practice (requires AVV — Phase D6)
- ❌ Any AI review with external practices (requires AVV + subprocessor disclosure — D6 + staging checklist)

---

*Last updated: 2026-06-07 — MedScoutX GOÄ/PKV Billing Plausibility Phase D1 (Data Protection, Deletion & Retention)*
*This document is an internal engineering reference. It does not constitute legal advice or a DSGVO/GDPR compliance certificate.*
