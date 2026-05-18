# Render Cron — Postgres Outbox Workers (MedScoutX MVP)

MedScoutX uses **PostgreSQL as the job queue** (pending / processing / retry / dead-letter). **Render Cron** triggers the API worker over HTTPS. No Redis, BullMQ, or Kafka.

## Prerequisites

| Variable | Required | Description |
|----------|----------|-------------|
| `WORKER_CRON_SECRET` | Yes (production) | Long random secret; never commit real values |
| `WORKER_ENABLED` | Yes (production) | Master switch — must be `true` for cron to process jobs |
| `DATABASE_URL` | Yes | Postgres connection |

Optional per-processor flags (when `WORKER_ENABLED=true` and unset → processor **runs**):

| Variable | Purpose |
|----------|---------|
| `WORKER_WEBHOOKS_ENABLED` | Legacy + developer webhook outbox |
| `WORKER_REMINDERS_ENABLED` | Appointment / follow-up reminders |
| `WORKER_EXPORTS_ENABLED` | Export jobs + expired export cleanup |
| `WORKER_OCR_ENABLED` | Document OCR jobs |
| `WORKER_TELEMEDICINE_CLEANUP_ENABLED` | Stale telemedicine sessions |

Existing product flags still apply inside processors (e.g. `ENABLE_PRACTICE_WEBHOOKS`, `ENABLE_TELEMEDICINE`, `ENABLE_DOCUMENT_OCR`).

Batch sizes: `WEBHOOK_WORKER_BATCH_SIZE`, `REMINDER_WORKER_BATCH_SIZE`, `TELEMEDICINE_CLEANUP_BATCH_SIZE` (see `server/.env.example`).

## Recommended Cron Jobs

### Production / Staging (primary)

| Schedule | Method | URL |
|----------|--------|-----|
| **Every 5 minutes** | `POST` | `https://api.medscoutx.app/api/internal/worker/run` |

**Headers:**

```http
Authorization: Bearer <WORKER_CRON_SECRET>
Content-Type: application/json
```

Optional body: `{ "limit": 50 }` — caps items per processor per run.

### Optional split crons (higher volume)

| Schedule | Endpoint | Use when |
|----------|----------|----------|
| Every 1–5 min | `POST /api/internal/worker/webhooks/run` | Webhook backlog only |
| Every 1–5 min | `POST /api/internal/reminders/run` | Reminders only |
| Every 5 min | `POST /api/internal/worker/jobs/run` | Export + OCR only |
| Every 1 h | `POST /api/internal/worker/telemedicine/cleanup/run` | Telemedicine stale sessions |

## Test with curl

Replace host and secret for your environment. **Do not paste production secrets into tickets or chat.**

```bash
# Staging example
export API_BASE=https://staging-api.example.com
export WORKER_CRON_SECRET='your-staging-secret'

# Combined worker (recommended)
curl -sS -X POST "$API_BASE/api/internal/worker/run" \
  -H "Authorization: Bearer $WORKER_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# Queue depth (aggregated counts only)
curl -sS "$API_BASE/api/internal/worker/status" \
  -H "Authorization: Bearer $WORKER_CRON_SECRET"
```

**Expected success shape (no payloads, no PHI):**

```json
{
  "ok": true,
  "flags": { "workerEnabled": true, "webhooks": true, "reminders": true },
  "processors": {
    "webhooks": { "processed": 3, "failed": 0, "ok": true, "durationMs": 120 },
    "reminders": { "processed": 5, "failed": 0, "ok": true, "durationMs": 80 }
  },
  "durationMs": 450,
  "lastRunAt": "2026-05-15T12:00:00.000Z"
}
```

**Auth failures:**

| Condition | HTTP | Body |
|-----------|------|------|
| `WORKER_CRON_SECRET` not set on server | 503 | `{ "error": "worker_not_configured" }` |
| Missing or wrong secret | 403 | `{ "error": "forbidden" }` |

## Render setup

1. API service: set `WORKER_CRON_SECRET`, `WORKER_ENABLED=true`, and processor flags as needed.
2. Create a **Cron Job** service (or Render Cron on the web service):
   - Command: `curl` as above, or Render’s HTTP cron if available.
   - Schedule: `*/5 * * * *` (every 5 minutes).
3. Point cron at the **same region** as the API to reduce latency.

## Staging vs production

| | Staging | Production |
|---|---------|------------|
| `WORKER_ENABLED` | `true` when testing workers | `true` |
| Cron frequency | Same or less often | Every 5 min |
| Secrets | Separate `WORKER_CRON_SECRET` | Unique production secret |
| Webhooks HTTP | Keep `PRACTICE_WEBHOOK_HTTP_ENABLED=false` until ready | Enable only with signed endpoints |

## Security warnings

- **Never** expose `/api/internal/worker/*` without `WORKER_CRON_SECRET`.
- Do **not** log the `Authorization` header or cron secret.
- Worker responses contain **counts only** — no message bodies, documents, or patient data.
- Do not add a public unauthenticated worker trigger.
- Rotate `WORKER_CRON_SECRET` if leaked; update Render cron and API env together.

## Local development

```bash
# server/.env
WORKER_CRON_SECRET=local-dev-secret
WORKER_ENABLED=true

npm run verify:worker
```

## Related

- `docs/production/DEPLOY_RUNBOOK.md` — full deploy checklist
- `server/worker/workerRunner.js` — processor orchestration
- `npm run verify:webhooks` / `verify:reminders` / `verify:background-jobs` — per-domain smoke tests
