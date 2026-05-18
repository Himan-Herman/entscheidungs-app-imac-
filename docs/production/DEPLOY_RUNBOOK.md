# MedScoutX production deploy runbook

Lean stack: **Render** (Node API + Postgres), **Vercel** (static SPA). Adjust names if you host elsewhere.

## 1. Required environment variables (backend)

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `production` |
| `PORT` | Usually set by platform (Render injects it). |
| `DATABASE_URL` | Postgres connection string (Prisma). Prefer **pooled** URL if your provider offers it for serverless-ish workloads. |
| `JWT_SECRET` | Strong random secret for signing JWTs. |
| `OPENAI_API_KEY` | OpenAI API access. |
| `RESEND_API_KEY` | Transactional email (Resend). |
| `EMAIL_FROM` | RFC-like sender, e.g. `MedScoutX <noreply@yourdomain.com>` (must match domain verified in Resend). |
| `CORS_ORIGIN` | **Comma-separated** exact frontend origins, e.g. `https://app.example.com,https://www.example.com`. No wildcards in production. |
| `API_BASE_URL` | Public base URL of **this** API (used in verification links), e.g. `https://api.example.com`. |
| `FRONTEND_URL` or `APP_BASE_URL` | Public SPA URL for redirects (password reset, verify email). |

Optional:

| Variable | Purpose |
|----------|---------|
| `EMAIL_QUEUE_MODE` | `direct` (default). Future: queue backend when implemented. |
| `SKIP_EMAIL_VERIFICATION` | Only non-production testing; omit in prod. |

### Frontend (Vite build)

Set in Vercel project → Environment Variables:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Full URL to deployed API, e.g. `https://api.example.com` (**no** trailing slash). Used by `apiFetch` / auth. |
| `VITE_SITE_URL` | Optional public marketing/site URL embedded in Pre-Visit **QR share** (fallback: current origin). |

Never commit `.env` files with secrets.

## 2. Render — backend

1. Create **PostgreSQL** instance (or use external Neon/Supabase Postgres).
2. Create **Web Service**: root `server/`, build command e.g. `npm ci && npx prisma generate`, start command `npx prisma migrate deploy && node app.js` (or split migrate into a **release command** if available).
3. Attach `DATABASE_URL` from the database add-on.
4. Set all backend env vars above.
5. Enable **health check** path: `/api/health` (or `/api/health/db` if you require DB in routing decisions).

**Trust proxy:** App uses `trust proxy` so `X-Forwarded-For` works for IP rate limits behind Render.

## 3. Vercel — frontend

1. Connect repo; set root directory to `client/` if deploying only the SPA.
2. Build command: `npm ci && npm run build`; output directory `dist`.
3. Set `VITE_API_BASE_URL` and optionally `VITE_SITE_URL` for production.

## 4. Database & Prisma

**Deploy migrations** (never rely only on `db push` in production):

```bash
cd server && npx prisma migrate deploy
```

Startup may run migrate + `node app.js` as a single start script on Render; alternatively use a release phase.

**Pooling:** For high concurrency, use a pooled `DATABASE_URL` from your provider’s docs; Prisma schema uses standard Postgres URLs.

## 5. Health checks (monitoring)

Safe endpoints (no secrets):

- `GET /api/health` — process up.
- `GET /api/health/db` — database reachable (`503` if not).
- `GET /api/health/config` — booleans only (feature flags, CORS configured count).
- `GET /api/health/openai` — `{ configured: true/false }` only.

Use `/api/health` or `/api/health/db` for uptime monitors.

### Background workers (Render Cron)

See **`docs/production/RENDER_CRON_WORKERS.md`** for full setup, curl examples, and security notes.

Set `WORKER_CRON_SECRET` and `WORKER_ENABLED=true` on the API service. Primary cron:

`POST /api/internal/worker/run` with `Authorization: Bearer <WORKER_CRON_SECRET>` every **5 minutes**.

Queue status (aggregated counts only): `GET /api/internal/worker/status` (same auth).

Without `WORKER_CRON_SECRET`, routes return `503` (`worker_not_configured`). Wrong secret → `403`.

Related env (see `server/.env.example`): `PRACTICE_WEBHOOK_HTTP_ENABLED`, `ENABLE_PRACTICE_WEBHOOKS`, `WEBHOOK_WORKER_BATCH_SIZE`.

## 6. CORS

`CORS_ORIGIN` must list **every** exact browser origin that calls the API (scheme + host + port). Example:

`https://medscoutx.vercel.app,https://www.medscoutx.de`

Local dev fallback remains `http://localhost:5173` only when `CORS_ORIGIN` is empty.

## 7. OpenAI / Resend / email

- **OpenAI:** Key in `OPENAI_API_KEY`; if unavailable, clients should show a generic failure (no medical payloads in logs).
- **Resend:** Domain verification required for `EMAIL_FROM`.
- **Logs:** Email flows log **Resend message id** only — not bodies, PDFs, or recipient addresses in structured logs.

## 8. Domain / DNS

- Point API subdomain A/CNAME to Render (or your reverse proxy).
- Point SPA hostname to Vercel.
- Configure TLS at the edge (Render/Vercel).

## 9. Failover behaviour (product-level)

| Failure | Expected behaviour |
|---------|-------------------|
| OpenAI unavailable | User sees safe generic message; Pre-Visit **local PDF** still works (client-side). |
| Email / Resend unavailable | User can still **download PDF locally**; QR share option remains informational only. |
| Database unavailable | Authenticated features fail health/db; **local** Pre-Visit PDF generation still works in browser; QR unaffected. |
| Public QR resolver unavailable | Practice QR landing shows safe error from `/api/public/previsit/qr/:token`. |

## 10. Rate limits (production defaults)

In-memory per IP (see `server/middleware/ipRateLimit.js`):

| Area | Approximate limit |
|------|-------------------|
| Auth login | 40 / 15 min |
| Auth register | 15 / 15 min |
| Password reset | 10–15 / 15 min |
| `/api/ki` | 45 / 15 min |
| Pre-Visit doctor-version / audio / diff / continuity | 10–12 / 15 min |
| Doctor PDF email | 5 / 15 min |
| `/api/transcribe` | 30 / 15 min |
| `/api/mail/send` | 25 / 15 min |
| Account export | 8 / hour |
| Account delete | 4 / hour |
| Public QR GET | 150 / 15 min |

Tune per observability; swap to Redis-backed limits later if multi-instance.

## 11. Security headers / uploads

- **Helmet** enabled with CSP disabled for API flexibility (tighten if serving HTML from API).
- **JSON/body limit:** `10mb` (adjust if abuse patterns emerge).
- **PDF upload:** Multer limits on doctor-contact PDF route (see route).
- **Trust proxy:** `1` hop — align with your CDN/proxy count.

## 12. Monitoring checklist

- **Render logs:** JSON request lines (`requestId`, `path`, `status`, `durationMs`) — no medical content.
- **Uptime:** Ping `/api/health` or `/api/health/db` every 1–5 minutes from an external monitor.
- **Resend:** Dashboard for bounces/suppressions; alert on spike in failures.
- **OpenAI:** Provider dashboard for 429/5xx; adjust rate limits / backoff.
- **Database:** Provider metrics + `/api/health/db` failures.

## 13. Queue roadmap

`server/services/emailQueueService.js` keeps **direct** delivery; swap to Redis/BullMQ (or managed queue) when outbound volume requires workers — see TODO in file.
