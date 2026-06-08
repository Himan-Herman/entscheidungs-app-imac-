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

The account delete endpoint (`server/routes/account.js`) performs the following deletions in a transaction:

```
preVisitSession.deleteMany     ✅ included
preVisitCase.deleteMany        ✅ included
doctorContact.deleteMany       ✅ included
doctor.deleteMany              ✅ included
auditLog.deleteMany            ✅ included
practiceProfile.deleteMany     ✅ included
practiceMember.deleteMany      ✅ included
interpreterCloudSession.deleteMany   ✅ included
interpreterCloudPreference.deleteMany ✅ included

billingPlausibilitySession.deleteMany  ❌ MISSING
```

**Gap**: `BillingPlausibilitySession` rows are **not deleted** when a user invokes the account delete endpoint. This is because:
1. `BillingPlausibilitySession.practiceProfileId` is a scalar FK with **no Prisma `@relation`** to `PracticeProfile`, so deleting the practice profile does not cascade.
2. `BillingPlausibilitySession.createdByUserId` is a scalar FK with **no Prisma `@relation`** to `User`, so deleting the user does not cascade.
3. The transaction does not include an explicit `billingPlausibilitySession.deleteMany`.

**Impact**: After a user deletes their account, their billing sessions remain in the database, linked to a userId that no longer exists in the `User` table.

---

### 2.2 Session-level operations (current API)

| Operation | Endpoint | Effect |
|-----------|----------|--------|
| Dismiss | `POST /:sessionId/dismiss` | Sets `status = dismissed`, `dismissedAt = now()` — non-destructive, data retained |
| Hard delete | No endpoint exists | Not implemented |

Sessions are intentionally not deleted by practice staff. Dismissed sessions remain accessible to practice admins. No automated deletion or purge job exists.

---

### 2.3 Account data export (`GET /api/account/export`)

The account export endpoint does **not** include billing plausibility sessions. A staff user invoking their data export will receive practiceProfiles, preVisitSessions, auditLogs etc., but **no billing session data**.

**Gap**: Billing session data is not included in the account export (DSGVO Art. 15 / GDPR Art. 20 data portability gap).

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

### Phase D2 — Account deletion cascade (Engineering: ~1–2 days)

**Add billing session deletion to `DELETE /api/account/delete`**:

```javascript
// In the existing transaction in server/routes/account.js:

// Step 1: delete sessions where the user created them (as practice owner/admin)
await tx.billingPlausibilitySession.deleteMany({ where: { createdByUserId: userId } });

// Step 2: delete sessions belonging to practices owned by this user
// (practiceProfile.deleteMany already runs — but sessions must be deleted FIRST
//  because there is no DB-level cascade from PracticeProfile to BillingPlausibilitySession)
// Order matters: billing sessions must be deleted before practiceProfiles.
```

**Order of operations**: `billingPlausibilitySession.deleteMany` must run **before** `practiceProfile.deleteMany` to avoid orphan records.

**Schema change not required**: no new migration needed; uses existing scalar FK columns.

**Verification**: add a test assertion that after account delete, `billingPlausibilitySession.count({ where: { createdByUserId: deletedUserId } })` returns 0.

### Phase D3 — Account data export (Engineering: ~0.5 days)

Add billing session summary to `GET /api/account/export`:

```javascript
const billingSessions = await prisma.billingPlausibilitySession.findMany({
  where: { createdByUserId: userId },
  select: {
    id: true,
    practiceProfileId: true,
    status: true,
    sourceType: true,
    inputSummaryJson: true,
    disclaimerVersion: true,
    createdAt: true,
    dismissedAt: true,
    // NOTE: items (including contextText) may be included for full Art. 15 portability
  },
  orderBy: { createdAt: 'desc' },
  take: 500,
});
```

**contextText in export**: because `contextText` may contain practice-internal billing notes (and potentially, despite the UI warning, patient data), including it in export should be reviewed by legal before shipping.

### Phase D4 — Operator erasure script (Engineering: ~1 day)

An internal operator script (not a user-facing endpoint) for DSGVO Art. 17 erasure requests:

```bash
# Proposed: server/scripts/eraseBillingDataForPractice.js
# Usage: node scripts/eraseBillingDataForPractice.js --practiceId=<id> [--dryRun]
# Effect: deletes all BillingPlausibilitySession (+ cascaded Items + AuditLogs) for a practice
# Requires: operator-level auth (env var or interactive confirmation)
# Audit: writes an erasure record before deletion
# Dry-run mode: reports what would be deleted, no mutations
```

**No user-facing DELETE endpoint** in this phase. Erasure is operator-initiated only, matching the pattern for other sensitive data in the system.

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
| `contextText` deletion on account/practice deletion | ❌ Not implemented (Phase D2 / D4) |

---

## 8. Summary of confirmed gaps (for engineering tracking)

| # | Gap | Risk | Phase |
|---|-----|------|-------|
| D2-1 | `billingPlausibilitySession.deleteMany` missing from account delete transaction | High — DSGVO Art. 17 | D2 |
| D2-2 | No DB-level cascade from `PracticeProfile` or `User` to `BillingPlausibilitySession` | High | D2 (app-level fix) |
| D3-1 | Billing sessions not included in account data export | Medium — DSGVO Art. 15/20 | D3 |
| D4-1 | No operator erasure script for practice-level deletion | High — DSGVO Art. 17 | D4 |
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
