# GOÄ/PKV Billing Plausibility — Operations Runbook (O1)

> **Scope**: Day-to-day operations of the GOÄ/PKV billing plausibility module across
> all environments: local dev, closed internal pilot, and production.
> Covers feature-flag lifecycle, safe rollout sequence, monitoring, incident
> response, rollback, and escalation.
>
> **Companion docs**
> - Staging activation checklist: `docs/billing-ai-staging-checklist.md`
> - Data protection & deletion gaps: `docs/billing-plausibility-data-protection.md`
> - Compliance checklist: `docs/billing-plausibility-compliance-checklist.md`
> - General deploy runbook: `docs/production/DEPLOY_RUNBOOK.md`

---

## 1. Feature flags

Two independent flags in `server/.env` (Render → Environment Variables):

| Flag | Default | Effect when `true` |
|------|---------|--------------------|
| `ENABLE_BILLING_PLAUSIBILITY` | `false` | Activates the billing plausibility route (`/api/practice/billing-plausibility`), the UI page, and all deterministic GOÄ/PKV hint logic. |
| `ENABLE_BILLING_AI_REVIEW` | `false` | Activates the AI-assisted review endpoint (`POST …/review`). Requires `ENABLE_BILLING_PLAUSIBILITY=true` to have any effect (double-gated). |

**Rule**: Never enable `ENABLE_BILLING_AI_REVIEW` in any external-practice environment
until the blocking items in `docs/billing-plausibility-data-protection.md` §7 (Phases D1–D5)
are resolved and signed off in `docs/billing-ai-staging-checklist.md` §7.

Flag changes take effect only after a server restart (Render: redeploy or manual restart
of the web service).

---

## 2. Safe rollout sequence

Follow this order exactly. Never skip steps.

### Step 1 — Run offline verification (every deploy)

```bash
cd server
npm run verify:billing-plausibility   # 18 sections — all must pass, exit 0
npm run verify:goae-catalogue         # 35 entries — all must pass, exit 0
npm run verify:billing-report-pdf     # 66 assertions — all must pass, exit 0
```

These are 100% offline (no DB, no network, no AI calls). Run before any flag change.

### Step 2 — Enable billing plausibility (deterministic only)

Set in staging/production `server/.env`:

```env
ENABLE_BILLING_PLAUSIBILITY=true
ENABLE_BILLING_AI_REVIEW=false        # must remain false at this stage
```

Redeploy / restart server. Verify:

```bash
curl https://<env>/api/health/config
# Confirm: features.databaseUrl=true, features.jwt=true

curl -X GET "https://<env>/api/practice/billing-plausibility?practiceId=<id>" \
  -H "Authorization: Bearer <token>"
# Expected: 200 { ok: true, sessions: [...], capabilities: { aiReview: false } }
```

The `capabilities.aiReview: false` confirms the AI button is hidden from all users.

### Step 3 — Test deterministic flow end-to-end

Before enabling AI, confirm the deterministic path works:

1. Create a billing session (POST `/api/practice/billing-plausibility?practiceId=<id>`)
   with at least one `{ ziffer, factor, count }` row
2. GET the session — verify `rowResults` are present and `resultSummaryJson.aiReview` is absent
3. Download PDF — verify `GET …/<sessionId>/export?format=pdf&locale=de` returns a valid PDF
4. Dismiss the session — verify `POST …/<sessionId>/dismiss` returns 409 on repeat

### Step 4 — Enable AI review (internal pilot only)

Only after Step 3 passes and the staging checklist §7 is signed off:

```env
ENABLE_BILLING_PLAUSIBILITY=true
ENABLE_BILLING_AI_REVIEW=true
OPENAI_API_KEY=<staging-key-with-spend-cap>
```

Confirm spend cap is ≤ €10/month on staging key, ≤ €50/month on initial production key.

After restart, verify the AI flag is live:

```bash
curl -X GET "https://<env>/api/practice/billing-plausibility?practiceId=<id>" \
  -H "Authorization: Bearer <token>"
# Expected: capabilities: { aiReview: true }

curl https://<env>/api/health/openai
# Expected: { ok: true, openai: { configured: true } }
```

Then run the manual smoke tests in `docs/billing-ai-staging-checklist.md` §4
(4a–4h: flag-disabled baseline, patient-data rejection, happy path, no-API-key
fallback, unsafe-content fallback, no-AI-on-page-load, safety edge cases, and
PDF-AI-note-only-after-save) before any internal demo.

---

## 3. Monitoring

### 3.1 Health endpoints

Poll these from your uptime monitor (no auth required):

| Endpoint | Normal response | Action on failure |
|----------|----------------|-------------------|
| `GET /api/health` | `200 { ok: true }` | Server process down — Render restart or alert |
| `GET /api/health/db` | `200 { ok: true, db: true }` | `503` → DB unreachable — check Render Postgres dashboard |
| `GET /api/health/openai` | `200 { openai: { configured: true } }` | `configured: false` → `OPENAI_API_KEY` unset or blank — AI reviews will fall back silently |
| `GET /api/health/config` | `200` with feature booleans | Confirm `databaseUrl`, `jwt`, `openai` are `true` in production |

> **Known gap**: `/api/health/config` does not expose `ENABLE_BILLING_PLAUSIBILITY` or
> `ENABLE_BILLING_AI_REVIEW`. To confirm flag state without a code change, check Render
> environment variables directly in the dashboard or grep server logs for
> `[billing-plausibility]` lines after startup.

### 3.2 Log signals — Render log stream

All billing plausibility errors are logged with a structured JSON payload.
Filter the Render log stream with these prefixes and event names:

**Route-level errors** (unhandled exceptions fall through to `catch (err)`):

| Log prefix | Meaning |
|------------|---------|
| `[billing-plausibility] GET /` | List-sessions handler threw |
| `[billing-plausibility] GET /:sessionId` | Get-session handler threw |
| `[billing-plausibility] POST /` | Create-session handler threw |
| `[billing-plausibility] GET /:sessionId/export` | PDF export handler threw (`export_failed`) |
| `[billing-plausibility] POST /:sessionId/review` | AI review handler threw |
| `[billing-plausibility] POST /:sessionId/dismiss` | Dismiss handler threw |

Any of these appearing with a stack trace in Render logs indicates an unhandled exception
that returned a `500 request_failed` or `500 export_failed` to the client.

**AI service structured events** (JSON objects in log stream):

| `event` field | Meaning | Action |
|---------------|---------|--------|
| `billing_ai_review_openai_error` | OpenAI API call failed (network, 429, 5xx) | Check `OPENAI_API_KEY` quota; review OpenAI status page |
| `billing_ai_review_json_parse_failed` | AI returned non-JSON | Transient model issue; monitor frequency; escalate if sustained |
| `billing_ai_review_invalid_shape` | AI response missing `nonBinding` or required fields | Safety validator fired; fallback used; investigate if frequent |
| `billing_ai_safety_event` (via `logAiSafetyEvent`) | Forbidden content detected in AI output | **Immediate**: disable `ENABLE_BILLING_AI_REVIEW`, investigate full log context |

All four AI service error paths return `{ ok: true, used_fallback: true }` to the client —
the user is never blocked. However, a sustained fallback rate (>20%) indicates a systemic
AI issue and should trigger investigation.

**Grep commands for Render log download / local dev logs:**

```bash
# All billing plausibility errors
grep '\[billing-plausibility\]' <logfile>

# AI-specific structured events
grep '"event":"billing_ai_review' <logfile>

# Safety scanner events
grep 'billing_ai_safety_event\|unsafe_output_detected' <logfile>

# All used_fallback responses
grep 'used_fallback.*true' <logfile>

# Prisma / DB errors in billing context
grep -E '(PrismaClient|prisma).*error|billing.*prisma' <logfile>

# PDF export failures
grep 'export_failed\|billing-plausibility.*export' <logfile>

# Patient field names must never appear in logs
grep -E '(patientName|dateOfBirth|diagnosisText|clinicalNotes)' <logfile>
# ↑ Must return ZERO matches. Any match is a privacy incident — see §5.4.
```

### 3.3 Audit log silently swallowed

`writeAiAuditLog` (in `billingPlausibilityAiReviewService.js`) catches all errors silently:
audit log write failures do **not** surface in the response and do **not** appear in the
Render log stream. If the `BillingPlausibilityAuditLog` table is missing or the DB
connection drops mid-request, audit entries are lost without any error.

**Operational implication**: After a migration or schema change, manually verify that
`BillingPlausibilityAuditLog` rows are being written:

```sql
SELECT action, "createdAt" FROM "BillingPlausibilityAuditLog"
ORDER BY "createdAt" DESC
LIMIT 10;
```

This is a known gap; a future improvement (Phase D6) would surface audit write failures
to the log stream.

### 3.4 Spend monitoring

- Staging OpenAI key: hard spend cap ≤ €10/month (set in OpenAI dashboard)
- Initial production key: hard spend cap ≤ €50/month
- Model in use: `gpt-5.4` (override via `OPENAI_CHAT_MODEL` env var)
- Max tokens per request: 400 (`BILLING_AI_MAX_TOKENS`)
- Temperature: 0.15 (`BILLING_AI_TEMPERATURE`)

Check OpenAI usage dashboard weekly during pilot. Alert if spend rate extrapolates to
exceed cap within the month.

---

## 4. Rollback procedures

### 4.1 Rollback AI review only (keep billing plausibility active)

Use this when AI output is problematic but the deterministic billing flow is healthy.

**On Render:**

1. Dashboard → Web Service → Environment → set `ENABLE_BILLING_AI_REVIEW=false`
2. Trigger manual deploy (or Save — Render redeploys on env var change)
3. Verify:

```bash
curl -X POST "https://<env>/api/practice/billing-plausibility/<sessionId>/review" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"practiceId":"<id>"}'
# Expected: 404 { ok: false, error: "feature_disabled" }
```

4. Verify deterministic billing is unaffected:

```bash
curl "https://<env>/api/practice/billing-plausibility?practiceId=<id>" \
  -H "Authorization: Bearer <token>"
# Expected: 200 { ok: true, sessions: [...], capabilities: { aiReview: false } }
```

**Locally:**

```bash
# In server/.env:
ENABLE_BILLING_AI_REVIEW=false
# Restart: Ctrl+C then node app.js
```

### 4.2 Rollback full billing plausibility module

Use this when there is a data integrity issue, migration failure, or critical bug in
the deterministic logic.

1. Dashboard → set both:
   - `ENABLE_BILLING_PLAUSIBILITY=false`
   - `ENABLE_BILLING_AI_REVIEW=false`
2. Trigger redeploy
3. Verify all billing routes return 404:

```bash
curl "https://<env>/api/practice/billing-plausibility?practiceId=<id>" \
  -H "Authorization: Bearer <token>"
# Expected: 404 { ok: false, error: "feature_disabled" }
```

4. The frontend UI billing page will show a feature-unavailable state automatically
   (the `capabilities` check controls button visibility; the page route itself is
   guarded by the same API flag).

5. Existing `BillingPlausibilitySession` records are **not deleted** by rollback —
   data is preserved for recovery. Sessions remain queryable by DB admin if needed.

### 4.3 Rollback timing

Render redeployment typically takes 60–120 seconds. During that window, in-flight
requests complete against the old process. There is no zero-downtime toggle —
the flag change takes effect with the new process.

For an emergency requiring instant effect without redeploy, there is currently no
runtime flag reload mechanism. The only option is to immediately trigger a Render
manual restart after the env var change.

---

## 5. Incident checklists

### 5.1 Missing table / migration failure

**Symptoms**: `500 request_failed` on any billing endpoint; Prisma error in logs
containing `relation "BillingPlausibilitySession" does not exist` or similar.

**Steps**:

1. Confirm DB connectivity:
   ```bash
   curl https://<env>/api/health/db
   # Expected: { ok: true, db: true }
   # If 503: DB is unreachable — check Render Postgres dashboard before proceeding
   ```

2. Check migration status (run from local with production `DATABASE_URL` — read-only check):
   ```bash
   cd server
   DATABASE_URL=<production-url> npx prisma migrate status
   # Lists applied migrations and any unapplied ones
   ```

3. If unapplied migrations are listed:
   - **Do not run `prisma migrate deploy` against production directly without a maintenance window.**
   - Escalate to engineering (see §6).
   - If safe to proceed: `DATABASE_URL=<production-url> npx prisma migrate deploy`

4. After migration: restart server, re-run offline verify scripts, confirm health/db.

5. Immediately set `ENABLE_BILLING_PLAUSIBILITY=false` if you cannot resolve within
   15 minutes — prevents further 500s while investigating.

### 5.2 PDF download failure

**Symptoms**: `500 { ok: false, error: "export_failed" }` on `GET …/export`; or client
reports blank/corrupt PDF; Render logs show `[billing-plausibility] GET /:sessionId/export`.

**Steps**:

1. Confirm the session exists and is not dismissed:
   ```bash
   curl "https://<env>/api/practice/billing-plausibility/<sessionId>?practiceId=<id>" \
     -H "Authorization: Bearer <token>"
   # 404 = session not found or dismissed
   # 200 = session exists — issue is in PDF generation
   ```

2. Run PDF verify script offline (does not require DB):
   ```bash
   cd server && npm run verify:billing-report-pdf
   # 66 assertions — all must pass
   ```

3. Check Render logs for the `export` prefix:
   ```bash
   grep 'GET.*export\|export_failed' <logfile>
   ```

4. Common causes:
   - `resultSummaryJson` is malformed (corrupted session data)
   - PDF library (`pdfkit`) crash on unusual Unicode in free-text fields

5. If verify script fails: this is a code-level regression — escalate to engineering.
   If verify script passes but prod fails: likely a data issue with the specific session —
   check `resultSummaryJson` in DB directly.

### 5.3 AI unsafe output detected

**Symptoms**: Render logs contain `unsafe_output_detected: true` or
`billing_ai_safety_event` with `unsafe_output_detected: true`.

Note: The safety scanner fires **before** persistence — the forbidden content is
never stored and never returned to the client. The client receives `used_fallback: true`.
This incident is about investigation and prevention, not recovery.

**Steps**:

1. **Immediately disable AI review**:
   ```bash
   # Render: set ENABLE_BILLING_AI_REVIEW=false → redeploy
   ```

2. Retrieve the audit log entry for the affected session:
   ```sql
   SELECT * FROM "BillingPlausibilityAuditLog"
   WHERE action = 'ai_reviewed'
     AND "metadataJson"->>'error' = 'unsafe_output_detected'
   ORDER BY "createdAt" DESC
   LIMIT 5;
   ```

3. Check `BillingPlausibilitySession.resultSummaryJson` for the affected session —
   confirm no forbidden text was persisted (the safety scanner prevents this, but verify).

4. Review which OpenAI model responded (`gpt-5.4` or override) in the Render log context.

5. Escalate to:
   - **Engineering**: investigate prompt context and safety pattern coverage
   - **Legal/DPO**: if any unsafe output was displayed to a user before fallback (unlikely
     given the scan runs pre-persistence, but confirm)

6. Do not re-enable `ENABLE_BILLING_AI_REVIEW` until the root cause is understood
   and the safety patterns updated if necessary.

### 5.4 Patient data found in contextText or logs

**Symptoms**: Manual review or grep reveals patient-identifying information
(name, DOB, diagnosis, ICD-10) in `contextText` of a session, in server logs,
or in a PDF export.

**Steps**:

1. **Privacy incident — escalate immediately to Legal/DPO** (see §6).

2. Disable both flags while investigating:
   ```bash
   ENABLE_BILLING_AI_REVIEW=false
   ENABLE_BILLING_PLAUSIBILITY=false
   # Redeploy
   ```

3. Identify the affected session(s):
   ```sql
   SELECT id, "practiceProfileId", "createdByUserId", "contextText", "createdAt"
   FROM "BillingPlausibilitySession"
   WHERE "contextText" IS NOT NULL
   ORDER BY "createdAt" DESC;
   ```

4. Check whether `contextText` was forwarded to OpenAI (only if `ENABLE_BILLING_AI_REVIEW`
   was `true` at the time). If yes: this may be a data processing incident under DSGVO
   Art. 33 — DPO must assess notification obligation (72-hour window).

5. Check whether the patient data appears in server logs:
   ```bash
   grep -E '(patientName|dateOfBirth|diagnosisText|clinicalNotes)' <logfile>
   ```
   The route guard rejects these fields with 400 at the API layer, but `contextText`
   is a free-text field with no PII scanning — users can enter patient data there.

6. Document all affected sessions, timestamps, and whether AI was enabled.

7. Do not re-enable either flag until DPO sign-off.

### 5.5 OpenAI quota exhausted / sustained fallback

**Symptoms**: All AI review requests return `used_fallback: true`;
Render logs show `billing_ai_review_openai_error` with 429 or quota messages.

**Steps**:

1. Deterministic billing continues unaffected — no user-visible blocking.
2. Check OpenAI dashboard for quota/spend status.
3. If spend cap hit: increase cap or wait for monthly reset.
4. If key is invalid/revoked: rotate key in Render env vars, redeploy.
5. If outage on OpenAI side: wait — fallback is working. Monitor OpenAI status page.
6. Do not disable `ENABLE_BILLING_PLAUSIBILITY` — deterministic flow is healthy.

---

## 6. Manual verification commands

Run from `server/` directory. All offline scripts require no live services.

```bash
# ── Offline checks (no DB, no AI, no network) ──────────────────────────────

# 1. Billing plausibility static checks (18 sections)
npm run verify:billing-plausibility

# 2. GOÄ catalogue structural validation (35 entries)
npm run verify:goae-catalogue

# 3. PDF report buffer verification (66 assertions, all 5 locales)
npm run verify:billing-report-pdf

# ── DB-touching checks (requires DATABASE_URL) ─────────────────────────────

# 4. Migration status (read-only, no changes)
npx prisma migrate status

# 5. Service smoke test — creates/cleans up CI fixture, runs §1–§12
#    (requires CI=true and a non-production DATABASE_URL)
DATABASE_URL=<local-or-staging-url> CI=true npm run verify:billing-plausibility-service

# ── Health checks (requires running server) ────────────────────────────────

# 6. Process health
curl https://<env>/api/health

# 7. Database reachability
curl https://<env>/api/health/db

# 8. OpenAI key configured (does not make a live call)
curl https://<env>/api/health/openai

# 9. Config/feature booleans
curl https://<env>/api/health/config

# ── Flag state confirmation ────────────────────────────────────────────────

# 10. Confirm capabilities returned by billing list endpoint
curl "https://<env>/api/practice/billing-plausibility?practiceId=<id>" \
  -H "Authorization: Bearer <token>" | grep capabilities
# { aiReview: false }  → AI flag off (or no OPENAI_API_KEY)
# { aiReview: true }   → AI flag on and key configured

# ── Audit log spot-check (psql or Render query console) ───────────────────

# 11. Recent audit log entries
SELECT action, "metadataJson", "createdAt"
FROM "BillingPlausibilityAuditLog"
ORDER BY "createdAt" DESC
LIMIT 20;

# 12. Check for any unsafe-output audit entries
SELECT * FROM "BillingPlausibilityAuditLog"
WHERE "metadataJson"->>'error' = 'unsafe_output_detected';
```

---

## 7. Escalation paths

| Incident type | Escalate to | Notes |
|---------------|-------------|-------|
| Patient data in logs or `contextText` forwarded to OpenAI | **Legal/DPO** (immediate) | Potential DSGVO Art. 33 notification obligation — 72-hour window applies |
| AI unsafe output detected | **Engineering** + **Legal/DPO** | Disable AI flag first; DPO assesses if output was user-visible |
| Enabling `ENABLE_BILLING_AI_REVIEW` in any external-practice environment | **Product Owner** + **Legal/DPO** | Requires AVV/DPA, subprocessor disclosure, and staging checklist sign-off |
| Missing DB table / migration failure | **Engineering** | Do not run `migrate deploy` against production without maintenance window |
| Audit log silently failing (no entries written) | **Engineering** | Check `BillingPlausibilityAuditLog` table exists and DB write permissions |
| GOÄ catalogue correctness concern | **Engineering** + **Medical/Billing expert** | Do not modify `goaeCatalogue.js` without running all three verify scripts |
| DSGVO Art. 17 erasure request for billing sessions | **Legal/DPO** + **Engineering** | Use the operator erasure script `server/scripts/eraseBillingPlausibilityData.js` (`npm run billing:erase`) — dry-run first, then `--confirmErase`. Scope by `--sessionId` / `--practiceProfileId` / `--createdByUserId`. Document the run in the DPO log. |

---

## 8. Known operational gaps

These gaps are documented here for awareness. They do not block the closed internal pilot
but must be resolved before external-practice activation.

| Gap | Phase | Impact |
|-----|-------|--------|
| `writeAiAuditLog` silently swallows DB errors — audit trail can fail invisibly | D6 | Forensic gaps if DB is degraded during AI review |
| `/api/health/config` does not expose `ENABLE_BILLING_PLAUSIBILITY` or `ENABLE_BILLING_AI_REVIEW` | O1-improvement | Cannot confirm flag state via health endpoint |
| No `used_fallback` rate metric or alert | O1-improvement | Sustained AI failures are not alertable without log parsing |
| ~~Account deletion does not cascade to `BillingPlausibilitySession`~~ | D2 ✅ Done | Resolved — billing rows deleted in the account-delete transaction |
| ~~No DSGVO Art. 17 erasure mechanism for billing sessions~~ | D4 ✅ Done | Resolved — operator script `eraseBillingPlausibilityData.js` (`npm run billing:erase`) |
| No AVV/DPA with OpenAI | D1 → Legal | Blocks any external-practice AI enablement |
| `contextText` free-text field has no PII scanning | D3 | Users can enter patient data; enforcement is training-only until D3 |

---

*Last updated: 2026-06-08 — MedScoutX GOÄ/PKV Billing Plausibility Phase O1 (Operations Runbook)*
