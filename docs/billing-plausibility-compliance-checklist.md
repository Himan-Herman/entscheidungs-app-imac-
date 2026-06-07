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

| Item | Current State | Required Action |
|------|--------------|-----------------|
| `BillingPlausibilitySession` rows | Stored in PostgreSQL; status can be set to `dismissed` | Establish retention period and automated deletion schedule |
| `BillingPlausibilityItem` rows | Stored with session; contain GOÄ codes + factors only | Include in session deletion scope |
| `BillingPlausibilityAuditLog` rows | Stored for access/change audit trail | Define separate retention period for audit logs |
| Session deletion via API | No DELETE endpoint (by design — audit integrity) | Requires admin/operator procedure for data erasure requests |
| User account deletion cascade | `User.delete` cascades to `PracticeProfile` but **not** to `BillingPlausibilitySession` | Add cascaded deletion or documented operator procedure |
| GDPR/DSGVO Article 17 (right to erasure) | Not implemented as user-facing feature | Required before real external practice use |

---

## 5. AVV / DPA requirements

> ⚠ Not legal advice. An independent assessment by a data protection officer or legal counsel is required.

Before this module is used with real external practices (not just internal/sandbox testing), the following must be addressed:

- [ ] **AVV (Auftragsverarbeitungsvertrag)**: A data processing agreement must be in place between MedScoutX and any practice that submits billing data. This applies even when `contextText` contains no patient data — the practice's billing code patterns may be commercially sensitive.
- [ ] **Subprocessor disclosure**: If `ENABLE_BILLING_AI_REVIEW=true`, OpenAI acts as a subprocessor. OpenAI must be listed in the AVV's subprocessor annex. The practice must acknowledge this.
- [ ] **Privacy notice update**: The application's privacy notice (Datenschutzerklärung) must be updated to describe billing plausibility session storage and any AI subprocessor relationship.
- [ ] **Data location / transfer**: OpenAI API data processing location must be confirmed and disclosed if outside the EU/EEA.
- [ ] **Legitimate processing basis**: Identify the DSGVO/GDPR legal basis for processing billing code data (likely Art. 6(1)(b) — contract performance, or Art. 6(1)(f) — legitimate interest). Document it.

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

Items to complete before deploying this module to any external practice (even a closed pilot):

### Engineering
- [ ] All three verify scripts pass on the deployment-target database schema:
  - `node scripts/verifyBillingPlausibility.js` — 16 sections
  - `node scripts/verifyGoaeCatalogue.js`
  - `node scripts/verifyBillingReportPdf.js`
- [ ] Feature flags confirmed: `ENABLE_BILLING_PLAUSIBILITY=true`, `ENABLE_BILLING_AI_REVIEW=false` for initial pilot
- [ ] Session cascade-deletion procedure documented and tested
- [ ] Rate-limiting configuration reviewed for pilot load
- [ ] Error monitoring configured (Render logs or equivalent)

### Legal / Data Protection
- [ ] AVV signed with each pilot practice
- [ ] Privacy notice updated to include billing session storage
- [ ] Data retention period defined and documented
- [ ] If AI review will be enabled: OpenAI added as AVV subprocessor, data transfer assessment completed
- [ ] Legitimate processing basis documented under DSGVO/GDPR

### Product / Compliance
- [ ] Pilot usage policy prepared and provided to each practice, explicitly stating:
  - No patient identifiers to be entered in the context field
  - Results are plausibility hints only — not billing decisions
  - Manual review by a qualified Abrechnungsfachkraft required before use
  - GOÄ catalogue is a local subset — all results require verification against the current official GOÄ
- [ ] Pilot participants confirmed: all users are qualified billing staff, not end patients
- [ ] Feedback/incident reporting path established for the pilot

---

## 9. Open items (blockers for production use)

| # | Item | Severity | Owner |
|---|------|----------|-------|
| 1 | `contextText` data-hygiene: free-form field forwarded to OpenAI when AI enabled; cannot technically prevent patient data entry | High | Product + Legal + Staff training |
| 2 | No user-facing data deletion (GDPR Art. 17) for billing sessions | High | Engineering |
| 3 | Session cascade deletion not implemented (User delete does not cascade to BillingPlausibilitySession) | High | Engineering |
| 4 | AVV template not created | High | Legal |
| 5 | Privacy notice not updated for billing module | High | Legal |
| 6 | GOÄ catalogue is 35-entry test subset — not suitable as authoritative source | Medium | Product (catalogue expansion plan needed) |
| 7 | OpenAI subprocessor disclosure if AI review enabled in production | High | Legal (required before AI pilot) |
| 8 | No automated data retention / purge schedule | Medium | Engineering |

---

*Last updated: 2026-06-07 — MedScoutX GOÄ/PKV Billing Plausibility Phase P5 (Legal/Compliance/Disclaimer Readiness)*
*This document is an internal engineering reference. It does not constitute legal advice or a compliance certificate.*
