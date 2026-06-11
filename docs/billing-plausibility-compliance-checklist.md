# GOÄ/PKV Billing Plausibility — Legal & Compliance Checklist

> **Scope**: This document is a pilot-readiness checklist for the MedScoutX
> GOÄ/PKV billing plausibility module. It is an internal engineering reference only.
>
> **Not legal advice.** This document does not constitute legal counsel, a legal
> opinion, or a compliance certificate. All items require independent review by
> qualified legal, data-protection, and billing compliance professionals before
> any real external practice use.

---

## 1. What the module is — and what it is not

| Claim | Status |
|-------|--------|
| Provides automated plausibility *hints* for GOÄ billing codes | ✅ Correct scope |
| Identifies potential documentation gaps (e.g. §5 GOÄ factor threshold) | ✅ Correct scope |
| Issues legally binding billing opinions | ❌ Explicitly out of scope |
| Produces reimbursement decisions or predictions | ❌ Explicitly out of scope |
| Replaces review by qualified billing staff (Abrechnungsfachkraft) | ❌ Explicitly out of scope |
| Provides medical diagnosis, triage, or therapy recommendations | ❌ Explicitly out of scope |
| Constitutes a certified GOÄ service | ❌ Not a certified service |
| Uses a complete, officially-validated GOÄ catalogue | ❌ Local test subset only (35 entries at time of writing) |

---

## 2. Disclaimer audit — current state

### 2.1 Web UI — billing overview page

- [x] Disclaimer div appears **before** the input form and before any user action
- [x] Disclaimer uses `role="note"` and a ⚠ icon
- [x] Text states: not legally binding, not medical advice, not a reimbursement decision, does not replace qualified staff
- [x] `intro` paragraph states: automated plausibility check, does not produce a binding billing decision
- [x] `dataProcessingNote` rendered below disclaimer: GOÄ codes + factors stored; no patient identifiers
- [x] `catalogueSubsetNote` rendered above submit: local test subset; codes not found require verification against official GOÄ text
- [x] `manualReviewRecommended` rendered after every result section
- [x] `contextPlaceholder` instructs: no patient data, no diagnosis, no clinical information

### 2.2 Web UI — billing detail page

- [x] Disclaimer rendered after heading, before any action buttons
- [x] `bp-detail-status` shows session status label (not a legal status)
- [x] Dismiss/archive action is non-destructive (status update, not deletion)
- [x] AI review section (if present) headed with non-binding label

### 2.3 PDF plausibility report

- [x] All 5 locales (de/en/fr/it/es) include a full disclaimer text in the report
- [x] Disclaimer states: not legally binding, not a reimbursement decision, not medical advice, not a diagnosis, not a therapy recommendation
- [x] Catalogue metadata section: explicitly states "Test subset only — not a complete catalogue" (all 5 locales)
- [x] AI section (if present): headed "[!] AI-ASSISTED NOTE — NON-BINDING"
- [x] Manual review recommendation included in all PDF reports
- [x] No patient identifiers included in PDF (verified by `verifyBillingReportPdf.js`)
- [x] `[!]` prefix on legal notice heading draws attention in rendered PDF

### 2.4 AI review labels

- [x] `aiReviewLabel` uses "KI-gestützter Plausibilitätshinweis / nicht rechtsverbindlich" (DE)
- [x] `aiReviewNonBinding` explicitly states: not legally binding, not a diagnosis, not a reimbursement decision (all 5 locales)
- [x] `aiReviewFallback` states: deterministic results remain valid even if AI is unavailable
- [x] AI review is opt-in only — never triggered automatically on page load
- [x] `used_fallback` field returned to client for transparency

---

## 3. Patient data protection

| Item | Status |
|------|--------|
| Patient name field accepted by API | ❌ Rejected with 400 `patient_data_not_accepted` |
| Date of birth accepted | ❌ Rejected |
| Diagnosis text / ICD-10 accepted | ❌ Rejected |
| Clinical notes accepted | ❌ Rejected |
| Insurance number accepted | ❌ Rejected |
| Patient fields forwarded to OpenAI | ❌ Never — verified by `verifyBillingPlausibility.js §6` |
| `contextText` field forwarded to OpenAI | ⚠ Yes — max 500 chars; practice staff notes only |
| Patient identifiers appear in PDF report | ❌ Never — verified by `verifyBillingReportPdf.js §1` |
| Patient identifiers logged server-side | ❌ None accepted |

**Context field note**: The `contextText` (max 500 chars) is forwarded to OpenAI when AI review is enabled. This field is intended for practice-internal billing context notes (e.g. "complex follow-up"). The UI placeholder and all i18n locales explicitly instruct that no patient data, diagnosis, or clinical information should be entered. The API enforces rejection of named patient-identifier fields but cannot prevent a user from typing free-form patient details into `contextText`. **This is a data-hygiene dependency on practice staff training** — it must be addressed in the pilot usage policy.

---

## 4. Data retention and deletion

> ⚠ The following reflects the current implementation state. A formal data retention policy and documented deletion procedure are required before use with external practices.
>
> Full technical detail: see **[`docs/billing-plausibility-data-protection.md`](billing-plausibility-data-protection.md)**.

### 4.1 Data stored

| Table | Key fields | Patient data? | Notes |
|-------|-----------|--------------|-------|
| `BillingPlausibilitySession` | practiceProfileId, createdByUserId, inputSummaryJson (GOÄ codes), resultSummaryJson | No patient identifiers | identifies practice + staff user |
| `BillingPlausibilityItem` | ziffer, factor, count, **contextText** (max 600 chars free-text), catalogueMatchJson | ⚠ contextText may contain patient data if staff enters it | contextText excluded from GET API responses; appears in PDF export |
| `BillingPlausibilityAuditLog` | sessionId, actorUserId, action, metadataJson | No patient identifiers | identifies staff user |

### 4.2 Deletion gaps

| Gap | Severity | Engineering phase | Status |
|-----|---------|-----------------|--------|
| `billingPlausibilitySession.deleteMany` missing from `DELETE /api/account/delete` transaction | High | D2 | ✅ **Implemented** — billing sessions, items and audit logs are now deleted in dependency order inside the existing transaction, before `practiceProfile.deleteMany` |
| No DB-level cascade from `PracticeProfile` → `BillingPlausibilitySession` (scalar FK, no `@relation`) | High | D2 (app-level fix; no migration needed) | ✅ **Mitigated** — explicit app-level deletion in account-delete transaction (no schema change) |
| No DB-level cascade from `User` → `BillingPlausibilitySession` (scalar FK, no `@relation`) | High | D2 | ✅ **Mitigated** — sessions scoped by `createdByUserId` and owned `practiceProfileId` are deleted explicitly |
| Billing sessions absent from `GET /api/account/export` (DSGVO Art. 15/20 gap) | Medium | D3 | ✅ **Implemented** — `billingPlausibilitySessions` added to account export via privacy-safe helper; raw `contextText` and raw AI prompts/responses excluded |
| No operator erasure script for practice-level deletion requests (DSGVO Art. 17) | High | D4 | ✅ **Implemented** — `server/scripts/eraseBillingPlausibilityData.js` (dry-run default, production guard, scopes by session/practice/user) |

> **D2 note (account deletion only).** The cascade fix above covers full-account
> erasure (`DELETE /api/account/delete`). It does **not** cover practice-level
> erasure of a single practice while the owning account survives — that remains
> **D4** (operator erasure script). The scalar-FK design is unchanged; deletion is
> enforced at the application layer, not the database layer.

### 4.3 Retention gaps — confirmed

| Item | Current State | Required Action |
|------|--------------|-----------------|
| `BillingPlausibilitySession` rows | No auto-expiry; **manual purge available (D5)** | Legal/DPO sets retention period; optional future automation |
| `BillingPlausibilityItem` rows | Cascade-delete with session | Included in session retention policy |
| `BillingPlausibilityAuditLog` rows | Cascade-delete with session | May require longer audit-log retention — legal to confirm |
| `contextText` in items | Retained as long as item/session | Included in session retention + Phase D4 erasure + D5 purge scope |
| OpenAI-processed contextText | Governed by OpenAI API data retention policy | Confirm with OpenAI; required before AI pilot with external practices |
| Automated purge schedule | None (manual `npm run billing:purge` only) | ✅ Manual purge done (D5); cron pending legal-approved retention period |

---

## 5. AVV / DPA requirements

> ⚠ Not legal advice. An independent assessment by a data protection officer or legal counsel is required.
>
> Full technical detail: see **[`docs/billing-plausibility-data-protection.md §4–6`](billing-plausibility-data-protection.md)**.

> **D6 status (2026-06-11): DRAFT PREPARED — NOT legally complete.** An AVV/DPA draft
> package now exists under [`docs/legal/`](legal/README.md): AVV/DPA main draft, TOM
> appendix, subprocessor list, and a pilot-practice data sheet (German-first, all marked
> "legal review required before signature"). **A *template* now exists; a *signed* AVV
> with any practice does NOT.** Legal/DPO review and signature remain mandatory before
> any external pilot.

Before this module is used with real external practices (not just internal/sandbox testing), the following must be addressed:

- [x] **AVV draft prepared** — Phase D6: AVV/DPA draft package created in [`docs/legal/`](legal/README.md) (template only). ⬜ Legal review + signature with each practice still pending.
- [ ] **AVV signed** — Phase D6: A *signed* data processing agreement must be in place between MedScoutX and any practice that submits billing data. This applies even when `contextText` contains no patient data — the practice's billing code patterns may be commercially sensitive.
- [x] **Subprocessor list drafted** — Phase D6: [`docs/legal/subprocessors-medscoutx-pilot.de.md`](legal/subprocessors-medscoutx-pilot.de.md) lists possible subprocessors with OpenAI **disabled by default**. ⬜ Concrete providers/regions still "to be confirmed"; OpenAI disclosure + acknowledgement required **before** any AI activation.
- [x] **Privacy notice draft** — Phase D7: A pilot privacy notice draft package now exists in [`docs/legal/`](legal/README.md) — German master + en/fr/it/es translation drafts (`privacy-notice-billing-pilot.*.md`), all marked "legal review required before publication". ⬜ Legal review + transfer into the live `Datenschutzerklärung` still pending.
- [ ] **Privacy notice published** — Phase D7: After legal review, the application's Datenschutzerklärung must be updated to describe billing plausibility session storage and any AI subprocessor relationship. (The live page was intentionally NOT modified with un-reviewed text.)
- [ ] **Data location / transfer**: OpenAI API data processing location must be confirmed and disclosed if outside the EU/EEA. A Transfer Impact Assessment (TIA) may be required.
- [ ] **Legitimate processing basis**: Identify the DSGVO/GDPR legal basis for processing billing code data (likely Art. 6(1)(b) — contract performance, or Art. 6(1)(f) — legitimate interest). Document it.
- [ ] **OpenAI data retention policy**: Confirm OpenAI's API data retention and deletion policy for prompt content (contextText). Required before AI pilot with any external practice.

### 5.1 Pilot policy — AI review blocked externally until DPA conditions are met

> **MANDATORY**: `ENABLE_BILLING_AI_REVIEW` must remain `false` in any environment accessible to
> external practices until the following are ALL confirmed:
> 1. AVV covering OpenAI as subprocessor is signed with the practice
> 2. Practice informed that contextText may be forwarded to OpenAI
> 3. DSGVO legal basis for AI processing documented
> 4. Data transfer assessment for OpenAI (non-EU processing) completed
> 5. OpenAI API data retention/deletion policy confirmed
>
> The deterministic-only path (`ENABLE_BILLING_AI_REVIEW=false`) has a lower AVV threshold but
> still requires an AVV for MedScoutX's own storage of practice billing patterns.
>
> See `docs/billing-ai-staging-checklist.md` for the full AI activation checklist.

---

## 6. GOÄ catalogue scope and accuracy

> ⚠ The module uses a local test subset of 35 GOÄ entries. This is not the complete official GOÄ.

| Item | Status |
|------|--------|
| Catalogue is the complete official GOÄ | ❌ Local test subset only |
| Catalogue source documented | ✅ `GOAE_CATALOGUE_META.sourceUrl` → gesetze-im-internet.de |
| Catalogue access date documented | ✅ `GOAE_CATALOGUE_META.catalogueAccessDate` |
| Entries have `completenessStatus` ("verified" / "points-uncertain" / "needs-review") | ✅ All 35 entries |
| "Verified" entries have confirmed point values | ✅ Only 2 entries (§1 and §5 Anlage A) are "verified" at this time |
| UI communicates subset limitation | ✅ `catalogueSubsetNote`, `catalogueFound`/`catalogueNotFound` badges, `unknown_goae_ziffer` warning |
| PDF report communicates subset limitation | ✅ `catalogueCompletenessValue`: "Test subset only — not a complete catalogue" |

**Implication**: Any code not found in the 35-entry catalogue generates an `unknown_goae_ziffer` warning and a "not in local catalogue subset — manual verification required" badge. This is the intended behaviour. Staff must not interpret a "found" result as confirmation that the code is valid in the current official GOÄ.

---

## 7. AI review compliance requirements

| Item | Status |
|------|--------|
| AI review disabled by default | ✅ `ENABLE_BILLING_AI_REVIEW=false` default |
| AI review requires base billing flag | ✅ `isBillingAiReviewEnabled()` depends on `isBillingPlausibilityEnabled()` |
| AI output always carries `nonBinding: true` | ✅ Enforced in `validateAiResponse()` |
| AI output safety scan before persistence | ✅ `hasUnsafeContent()` + `detectForbiddenMedicalClaims()` |
| AI fallback on any failure | ✅ 5 distinct fallback paths |
| Max tokens capped | ✅ `BILLING_AI_MAX_TOKENS = 400` |
| Temperature conservative | ✅ `BILLING_AI_TEMPERATURE = 0.15` |
| Context forwarded to OpenAI is bounded | ✅ `MAX_CONTEXT_CHARS = 500` |
| Raw prompt / AI response never returned to client | ✅ Verified by `verifyBillingPlausibility.js §15` |
| AI output logged to console | ❌ No `console.log` of AI output — verified by `§15` |
| Staging checklist reviewed before enabling AI in production | ⬜ See `docs/billing-ai-staging-checklist.md` |

---

## 8. Pilot-readiness sign-off checklist

Items to complete before deploying this module to any external practice (even a closed pilot).

For full data-protection engineering phases, see **[`docs/billing-plausibility-data-protection.md §6`](billing-plausibility-data-protection.md)**.

### Engineering
- [ ] All three verify scripts pass on the deployment-target database schema:
  - `node scripts/verifyBillingPlausibility.js` — 19 sections
  - `node scripts/verifyGoaeCatalogue.js`
  - `node scripts/verifyBillingReportPdf.js`
- [ ] Feature flags confirmed: `ENABLE_BILLING_PLAUSIBILITY=true`, `ENABLE_BILLING_AI_REVIEW=false` for initial pilot
- [x] **Phase D2**: `billingPlausibilitySession.deleteMany` added to `DELETE /api/account/delete` (ordered before `practiceProfile.deleteMany`) — sessions, items and audit logs deleted in dependency order inside the existing transaction; covered by `verifyBillingPlausibility.js §16`
- [x] **Phase D3**: Billing sessions included in `GET /api/account/export` via `getBillingPlausibilityExportForUser` (items, deterministic warnings, safe AI review, audit metadata; raw `contextText` excluded — `contextTextPresent` flag only); covered by `verifyBillingPlausibility.js §17`
- [x] **Phase D4**: Operator erasure script `server/scripts/eraseBillingPlausibilityData.js` implemented (`npm run billing:erase`), dry-run default, production guard, scopes by session/practice/user; verified end-to-end against throwaway local test data
- [x] **Phase D5**: Manual retention purge script `server/scripts/purgeBillingPlausibilitySessions.js` (`npm run billing:purge`) implemented — dry-run default, production guard, `--days`/`--onlyDismissed`/`--practiceProfileId`; covered by `verifyBillingPlausibility.js §19`. ⬜ Legal still to confirm the retention period; ⬜ automatic cron not yet scheduled
- [ ] Rate-limiting configuration reviewed for pilot load
- [ ] Error monitoring configured (Render logs or equivalent); see **[`docs/billing-plausibility-runbook.md §3`](billing-plausibility-runbook.md)** for log signal reference and grep commands
- [ ] Operations runbook reviewed by on-call engineer: **[`docs/billing-plausibility-runbook.md`](billing-plausibility-runbook.md)** (rollback procedures §4, incident checklists §5, escalation paths §6)
- [ ] CI migration replay (`prisma migrate deploy` on fresh DB) passes with zero errors

### Legal / Data Protection
- [x] **Phase D6 (draft)**: AVV/DPA draft package prepared in [`docs/legal/`](legal/README.md) — AVV main draft, TOM appendix, subprocessor list, pilot data sheet (all marked "legal review required")
- [ ] **Phase D6 (signature)**: AVV reviewed by legal/DPO and **signed** with each pilot practice
- [x] **Phase D7 (draft)**: Privacy notice draft prepared in [`docs/legal/`](legal/README.md) — de master + en/fr/it/es translation drafts (all marked "legal review required before publication")
- [ ] **Phase D7 (publication)**: Privacy notice reviewed by legal and published in the live Datenschutzerklärung (all locales)
- [ ] Data retention period defined and documented (required for Phase D5 configuration)
- [ ] DSGVO legal basis for processing billing code data documented
- [ ] If AI review will be enabled: OpenAI added as AVV subprocessor, practice notified, data transfer assessment completed, OpenAI data retention policy confirmed
- [ ] Legitimate processing basis documented under DSGVO/GDPR Art. 6

### Product / Compliance
- [ ] Pilot usage policy prepared and provided to each practice, explicitly stating:
  - **No patient identifiers to be entered in the context field** (UI also warns, but staff training required)
  - Results are plausibility hints only — not billing decisions
  - Manual review by a qualified Abrechnungsfachkraft required before use
  - GOÄ catalogue is a local subset — all results require verification against the current official GOÄ
  - AI review (if enabled) is non-binding — see `docs/billing-ai-staging-checklist.md` for full conditions
- [ ] Pilot participants confirmed: all users are qualified billing staff, not end patients
- [ ] Feedback/incident reporting path established for the pilot

---

## 9. Open items (blockers for production use)

> **Resolved:** D2 (account-deletion cascade for billing sessions) was implemented
> 2026-06-11 — billing sessions, items and audit logs are deleted in dependency
> order inside the `DELETE /api/account/delete` transaction, before
> `practiceProfile.deleteMany`. Verified statically by `verifyBillingPlausibility.js §16`.
> Practice-level erasure (single practice, account survives) remains open as **D4**.
>
> **Resolved:** D3 (billing data portability) was implemented 2026-06-11 — billing
> sessions are included in `GET /api/account/export` via a privacy-safe helper
> (`getBillingPlausibilityExportForUser`). Raw `contextText` and raw AI
> prompts/responses are excluded; a `contextTextPresent` flag is emitted instead.
> Verified statically by `verifyBillingPlausibility.js §17`.
>
> **Resolved:** D4 (operator erasure) was implemented 2026-06-11 —
> `server/scripts/eraseBillingPlausibilityData.js` (`npm run billing:erase`) hard-deletes
> the billing session tree (auditlog → item → session) for a `--sessionId` /
> `--practiceProfileId` / `--createdByUserId` scope. Dry-run by default; refuses
> production/Render databases and missing/zero scopes; large-batch guard at 100
> sessions. Verified end-to-end against throwaway local test data (no orphans).
>
> **Partially resolved:** D5 (retention purge) shipped 2026-06-11 as a **manual**
> script `server/scripts/purgeBillingPlausibilitySessions.js` (`npm run billing:purge`) —
> dry-run default, production guard, `createdAt`-based cutoff via required `--days`,
> `--onlyDismissed` / `--practiceProfileId` filters, large-batch guard at 500.
> Recommended retention 180 days (policy guidance only). **Still pending**: legal/DPO
> retention-period decision and (optional) automatic Render-cron scheduling.

| # | Phase | Item | Severity | Owner |
|---|-------|------|----------|-------|
| 1 | C-1 | `contextText` data-hygiene: free-form field forwarded to OpenAI when AI enabled; cannot technically prevent patient data entry; also appears in PDF export (first 120 chars) | High | Product + Legal + Staff training |
| 2 | D2 | ✅ **Done** — `billingPlausibilitySession.deleteMany` (with items + audit logs) added to `DELETE /api/account/delete` transaction | High | Engineering |
| 3 | D2 | ✅ **Mitigated** — no DB-level cascade from `PracticeProfile`/`User` (scalar FKs unchanged), but account deletion now removes billing rows at the app layer; practice-level erasure still pending (D4) | High | Engineering (app-level fix, no migration) |
| 4 | D3 | ✅ **Done** — billing sessions included in `GET /api/account/export` (raw contextText excluded; conservative portability) | Medium | Engineering |
| 5 | D4 | ✅ **Done** — operator erasure script `eraseBillingPlausibilityData.js` (dry-run default, production guard) | High | Engineering |
| 6 | D5 | ⚠ **Partial** — manual purge script done (`billing:purge`); automatic schedule + legal-approved retention period still pending | Medium | Engineering + Legal |
| 7 | D6 | ⚠ **Partial** — AVV/DPA **draft** package prepared (`docs/legal/`); no AVV reviewed or **signed** with any practice yet | High | Legal |
| 8 | D7 | ⚠ **Partial** — privacy notice **draft** prepared (`docs/legal/`, de+en/fr/it/es); legal review + publication in live Datenschutzerklärung pending | High | Legal |
| 9 | C-2 | OpenAI subprocessor disclosure required if AI review enabled with external practices | High | Legal (required before any AI pilot with external practices) |
| 10 | C-3 | DSGVO legal basis for processing billing code data not documented | High | Legal |
| 11 | C-4 | OpenAI API data retention/deletion policy for API prompts not confirmed | High | Legal (required before AI pilot) |
| 12 | — | GOÄ catalogue is 35-entry test subset — not suitable as authoritative source | Medium | Product (catalogue expansion plan needed) |

---

*Last updated: 2026-06-11 — MedScoutX GOÄ/PKV Billing Plausibility Phase P6 (Release Hardening)*
*(Previously updated 2026-06-07 — Phase D1 Data Protection, Deletion & Retention)*
*This document is an internal engineering reference. It does not constitute legal advice or a compliance certificate.*
