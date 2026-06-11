# GOÄ/PKV Billing Plausibility — AI Review Staging Checklist

> **Scope**: This checklist governs activating `ENABLE_BILLING_AI_REVIEW=true` for the
> first time in any non-local (staging or production) environment.
> It covers environment prerequisites, safety verification, functional smoke tests,
> observability requirements, and rollback criteria.
>
> **Not a billing opinion.** This module provides automated plausibility *hints* only.
> It is not a legal billing decision, not a diagnosis, and not a reimbursement
> determination. All AI output carries `nonBinding: true` and is supplementary to
> manual review.

---

## 1. Prerequisites — must all be true before enabling the flag

- [ ] `ENABLE_BILLING_PLAUSIBILITY=true` is already live and stable in the target environment
- [ ] The deterministic billing plausibility flow (no AI) has been smoke-tested end-to-end
- [ ] `OPENAI_API_KEY` is set to a **staging-isolated** key with a hard spend cap
- [ ] The OpenAI key has **no access** to any patient-data-adjacent project or fine-tune
- [ ] CORS, rate-limiting, and auth middleware are unchanged from the last verified deploy
- [ ] Database is the **staging** database — never production during first pilot

---

## 2. Safety verification — run before every staging deploy

Run offline, requires no live services:

```bash
cd server
node scripts/verifyBillingPlausibility.js
```

All 18 sections must pass (exit 0). Pay specific attention to:

| Section | Key assertion |
|---------|--------------|
| 3 — AI safety patterns | Unsafe texts blocked; neutral texts pass |
| 5 — AI service structure | `nonBinding`, `hasUnsafeContent`, `used_fallback`, no patient fields in context builder |
| 6 — Route patient-data rejection | `patientName`, `dateOfBirth`, `diagnosisText`, `clinicalNotes` rejected with 400 |
| 15 — AI staging pilot readiness | Max-tokens=400, temperature=0.15, no `rawPrompt`/`rawResponse` in response, no `console.log` of AI output |

Also run:

```bash
node scripts/verifyGoaeCatalogue.js
node scripts/verifyBillingReportPdf.js
```

All three must pass before proceeding.

---

## 3. Environment configuration

Set the following in the staging `server/.env` (never commit real secrets):

```env
ENABLE_BILLING_PLAUSIBILITY=true
ENABLE_BILLING_AI_REVIEW=true
OPENAI_API_KEY=<staging-key-with-spend-cap>
```

Confirm these are **not set** in the same environment (ensure clean flag state):

```env
# Must remain absent or false:
# ENABLE_LAB_INTERPRETATION=     ← never true
# ENABLE_AI_DOCUMENT_STRUCTURING= ← unrelated; confirm not accidentally set
```

---

## 4. Functional smoke tests

Perform these manually against the staging environment after deploy.

### 4a. AI flag disabled path (regression baseline)

1. Temporarily set `ENABLE_BILLING_AI_REVIEW=false` (restart server)
2. `POST /api/billing-plausibility/{sessionId}/review` → expect `404 feature_disabled`
3. Re-enable `ENABLE_BILLING_AI_REVIEW=true` (restart server)

### 4b. Patient-data rejection

```bash
curl -X POST https://<staging>/api/billing-plausibility/<sessionId>/review \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"practiceId":"<id>","patientName":"Max Mustermann"}'
```
Expected: `400 patient_data_not_accepted`

### 4c. Normal AI review (happy path)

1. Create a billing session with ziffer=1, factor=2.5, count=1 (no contextText)
2. Click "AI review" in the UI (or `POST /api/billing-plausibility/<sessionId>/review`)
3. Verify response shape:
   - `ok: true`
   - `session.resultSummaryJson.aiReview` present
   - `aiReview.nonBinding === true`
   - `used_fallback` is `false` (AI call succeeded) **or** `true` (graceful fallback)
   - `rowResults` from deterministic phase are **unchanged** in the session
4. Confirm the UI shows the "non-binding hint" disclaimer before any AI text

### 4d. Fallback on no/invalid API key

1. Temporarily unset `OPENAI_API_KEY` (restart server)
2. Trigger a review — expect `ok: true`, `used_fallback: true`, `aiReview.fallback: true`
3. Confirm session is not marked as error; deterministic warnings are preserved
4. Restore `OPENAI_API_KEY`

### 4e. Unsafe-content fallback

> This is a dev/staging-only test. Do not attempt in production.

In `billingPlausibilityAiReviewService.js` temporarily inject a mocked OpenAI response
containing forbidden text (e.g. `"The diagnosis is bronchitis"`) and confirm:
- `used_fallback: true` is returned
- The AI safety event is logged
- The forbidden text is NOT persisted in `resultSummaryJson`

Revert after confirming.

---

## 5. Observability requirements

Before enabling in production, these monitoring items must be in place:

- [ ] Server logs capture `[billing-plausibility/ai]` prefix lines (confirm log aggregator sees them)
- [ ] `used_fallback: true` responses are tracked (alert if fallback rate exceeds 20% sustained)
- [ ] OpenAI API error rate alerted (5xx from OpenAI should trigger a Slack/PagerDuty notice)
- [ ] Spend monitoring: OpenAI key spend cap set ≤ €10/month for staging, ≤ €50/month initial production
- [ ] OpenAI model in use is **`gpt-5.4`** by default (overridable via `OPENAI_CHAT_MODEL` env var) — confirm spend projections and token-limit assumptions are based on this model's pricing tier
- [ ] `contextText` (max 120 chars) is rendered in downloaded PDF reports — ensure staff training policy covers that any free-text context entered by the user appears in exports before enabling AI review with external practices (see `docs/billing-plausibility-data-protection.md` §3 for the full `contextText` exposure map)
- [ ] No patient field names appear in any log line (grep staging logs after smoke test):
  ```bash
  grep -E "(patientName|dateOfBirth|diagnosisText|clinicalNotes)" <log-file>
  # Must return zero matches
  ```

---

## 6. Rollback criteria

Immediately set `ENABLE_BILLING_AI_REVIEW=false` and restart the server if any of the following occur:

| Trigger | Action |
|---------|--------|
| Forbidden medical claim detected in AI output (safety scanner fires) | Disable + investigate logs |
| `nonBinding: true` missing from AI response | Disable + patch `validateAiResponse` |
| OpenAI error rate > 50% sustained for 5 minutes | Disable + investigate key/quota |
| Patient field name appears in any server log | Disable + security review |
| Any user-visible AI text includes diagnosis, urgency, or reimbursement language | Disable + safety review |

Rollback procedure:

```bash
# 1. Set flag
ENABLE_BILLING_AI_REVIEW=false

# 2. Restart server
# (Render: re-deploy with updated env var; local: restart node app.js)

# 3. Verify
curl https://<env>/api/billing-plausibility/<any-session>/review -X POST \
  -H "Authorization: Bearer <token>"
# Expected: 404 feature_disabled

# 4. Deterministic billing plausibility continues to work unaffected
# GET /api/billing-plausibility/ and POST / should return 200 as before
```

---

## 7. Production activation sign-off

Do not activate in production until all of the following are signed off:

| Item | Owner | Sign-off |
|------|-------|---------|
| All verify scripts pass on production-equivalent DB schema | Engineering | ☐ |
| Staging smoke tests (sections 4a–4d) completed | Engineering | ☐ |
| Observability requirements confirmed (section 5) | Engineering | ☐ |
| Privacy/DPA review: no patient data path to OpenAI; AVV/DPA with OpenAI in place before external use | Legal/DPO | ☐ |
| Data protection doc reviewed (`docs/billing-plausibility-data-protection.md`); account-deletion cascade gap (Phase D2) scheduled; subprocessor disclosure confirmed | Legal/DPO | ☐ |
| Non-binding disclaimer visible in UI before any AI text | Product | ☐ |
| OpenAI spend cap set and confirmed | Engineering | ☐ |
| Rollback runbook reviewed by on-call engineer | Engineering | ☐ |

---

*Last updated: 2026-06-07 — MedScoutX GOÄ/PKV Billing Plausibility Phase E (AI Staging Pilot)*
