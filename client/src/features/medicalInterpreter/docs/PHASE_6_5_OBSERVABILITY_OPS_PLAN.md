# Medical Interpreter — Phase 6.5 Observability, Operations & Incident Response (Planning Only)

**Status:** Planning document. No implementation in Phase 6.5.  
**Builds on:** [PHASE_6_1_ECOSYSTEM_PLAN.md](./PHASE_6_1_ECOSYSTEM_PLAN.md), [PHASE_6_2_ORG_ARCHITECTURE_PLAN.md](./PHASE_6_2_ORG_ARCHITECTURE_PLAN.md), [PHASE_6_3_ENTERPRISE_COMPLIANCE_PLAN.md](./PHASE_6_3_ENTERPRISE_COMPLIANCE_PLAN.md), [PHASE_6_4_BILLING_QUOTA_PLAN.md](./PHASE_6_4_BILLING_QUOTA_PLAN.md)  
**Scope:** How the interpreter ecosystem is **safely monitored, operated, scaled, and supported** without inspecting patient conversations — no hidden telemetry, no code changes, no behaviour changes.

---

## Core principle (non-negotiable)

Observability must:

- **protect privacy** — operable without transcript/medical content  
- **support reliability** — detect outages and degradation early  
- **support enterprise readiness** — org/practice operational views (metadata only)  
- **support incident response** — clear fallbacks and kill switches  
- **support abuse detection** — rate/quota/security signals without content inspection  
- **remain GDPR-conscious** — retention, minimization, purpose limitation  

The platform must be **operable WITHOUT reading patient conversations**.

---

## Executive summary

Today MedScoutX has **solid privacy-aware foundations**: `requestContextMiddleware` (JSON access logs: `requestId`, path, status, `durationMs`), `safeApiError` / `logServerError` (no client stack or medical text), interpreter-specific `logInterpreterError`, whitelisted `auditInterpreterCloud` and invite audit metadata, in-memory IP rate limits, `GET /api/interpreter/status` for feature flags, and Postgres-backed workers for exports/OCR (not interpreter AI).

**Gaps for interpreter ops:** no Prometheus/OTel/Sentry integration verified in repo; no cross-instance stream session metrics; rate-limit counters not exported; no interpreter-dedicated dashboards; no public health sub-status for AI providers; frontend error boundary logs locally only.

Phase 6.5 designs a **layered observability stack**, safe logging schema, error/realtime monitoring, incident playbooks, flag operations, capacity metrics, privacy-first analytics, security monitoring, enterprise support boundaries, multi-region ops, incident UX, risks, and subphases **6.5.1–6.5.7**.

---

## Section 1 — Current observability review

### 1.1 Current logging behaviour

| Layer | Implementation | Content |
|-------|----------------|---------|
| **HTTP access** | `server/middleware/requestContext.js` | JSON: `requestId`, `method`, `path`, `route`, `status`, `durationMs` — **no query/body** |
| **Unhandled errors** | `httpErrorHandler` → `logServerError` | Prod: `context`, `requestId`, `name` only; dev: may log full `err` |
| **Interpreter routes** | `logInterpreterError(event, err, req)` | `event`, `requestId`, `name`, `code` — no transcript |
| **Audit** | `writeAuditLog` + `sanitizeAuditMetadata` | Strips keys matching sensitive regex; 200-char string cap |
| **Cloud audit** | `auditInterpreterCloud` | Strict key allowlist |
| **Invite audit** | `interpreterPracticeInviteAudit` | Allowlist incl. `requestId`, invite ids |
| **Security** | `logSecurityEvent` | Metadata-only via audit pipeline |

**Gap:** Access logs go to **stdout** (`console.log`) — aggregation depends on host (Render *needs repo verification* log drain).

### 1.2 Current request tracing

| Capability | State |
|------------|-------|
| Correlation ID | `req.requestId` — from `X-Request-Id` or `randomUUID()` |
| Response header | `X-Request-Id` echoed |
| Downstream AI calls | *needs repo verification* whether OpenAI requests tag `requestId` |
| Distributed tracing | **Not implemented** (no OTel spans in repo grep) |

### 1.3 Current error handling

| Surface | Behaviour |
|---------|-----------|
| API JSON | `sendSafeJsonError` — generic message in prod |
| Interpreter codes | `interpreter_unavailable`, `rate_limited`, `quota_exceeded` (cloud), validation codes |
| Client | `InterpreterErrorBoundary` — `componentDidCatch` logs **error name only** to console; calm UI |
| Stream routes | Same `logInterpreterError` pattern on catch |

No verified third-party error reporting (Sentry) for interpreter.

### 1.4 Current API monitoring

| Endpoint | Purpose |
|----------|---------|
| `GET /api/interpreter/status` | Module + TTS + cloud + encryption + **streaming flags** (no auth required on router — mounted under `requireAuth` at app level *needs repo verification* if public health needed) |
| `authRouter.get("/health")` | Generic auth health |
| Worker | `getWorkerStatus()` — export/OCR/webhook queue depths — **not interpreter** |

*Needs repo verification:* external uptime checks (Pingdom, Render health path).

### 1.5 Current rate-limit telemetry

| Aspect | State |
|--------|-------|
| Implementation | In-memory `Map` per process (`interpreterRateLimit.js`) |
| On exceed | HTTP 429 `rate_limited` |
| Metrics | **None** exported (no counter for 429s by route) |
| Multi-instance | Counters **not shared** — abuse detection per-node only |

### 1.6 Current realtime monitoring

| Aspect | State |
|--------|-------|
| Transport | **HTTP chunked** upload — not WebSocket |
| Session store | In-memory `Map` in `interpreterStreamTranscribeService.js` |
| Limits | `STREAM_MAX_DURATION_MS`, partial count, bytes — env constants |
| Observability | **No** active stream gauge; **no** chunk latency histogram |

**Implication:** Horizontal scaling requires sticky sessions or external stream registry (Phase 6.5.3 planning only).

### 1.7 Current feature-flag observability

| Source | Exposure |
|--------|----------|
| Server env | `featureFlags.js` |
| Client | `GET /api/interpreter/status` returns boolean flags |
| Runtime change | Requires deploy/restart — **no** dynamic flag service |

### 1.8 Existing analytics / telemetry infrastructure

| System | Role | Interpreter today |
|--------|------|-------------------|
| `AnalyticsEvent` | HMAC-hashed privacy-preserving events | **No** interpreter event types in `ANALYTICS_EVENT_TYPES` |
| `trackAnalyticsEvent` | Used in previsit, practices, transcribe (generic) | **Not** wired in interpreter routes |
| `AuditLog` | Compliance/ops | Partial interpreter cloud/invite actions |
| Product analytics POST | Client allowlist subset | Interpreter not listed |

### 1.9 Existing deployment / runtime architecture

| Component | Evidence |
|-----------|----------|
| API | Express `server/app.js`, `trust proxy: 1` (Render/proxy) |
| DB | PostgreSQL + Prisma |
| Hosting | Render referenced in docs (`RENDER_CRON_WORKERS.md`, `DEDUPE_BEFORE_UNIQUE_DEPLOY.md`) |
| Background work | Render Cron → `POST /api/internal/worker/run` + Postgres outbox |
| Redis/BullMQ | **Planned only** (`FUTURE_BULLMQ_QUEUE_PLAN.md`) — not implemented |

*Needs repo verification:* number of API instances, regions, CDN for client.

### 1.10 Existing queue / worker architecture

| Queue | Table / mechanism | Interpreter relevance |
|-------|-------------------|------------------------|
| Export jobs | `ExportJob` + worker processor | Future interpreter export (6.3) — monitor `exports` queue depth |
| OCR, webhooks, reminders | Postgres outbox | None for live AI |
| Email | Often synchronous Resend | N/A |

Interpreter AI is **synchronous HTTP** — no job queue for transcribe/translate today.

---

## Section 2 — Observability architecture

### 2.1 Layered model

```text
┌─────────────────────────────────────────────────────────────┐
│ L7: Enterprise ops dashboard (org/practice metadata only)   │
├─────────────────────────────────────────────────────────────┤
│ L6: Privacy-first product analytics (aggregates, no text)   │
├─────────────────────────────────────────────────────────────┤
│ L5: Security & abuse monitoring (rates, quotas, auth)       │
├─────────────────────────────────────────────────────────────┤
│ L4: Quota & billing meters (Phase 6.4 UsageEvent)           │
├─────────────────────────────────────────────────────────────┤
│ L3: Realtime/stream ops (sessions, chunks, partials)        │
├─────────────────────────────────────────────────────────────┤
│ L2: API monitoring (latency, errors, status codes)          │
├─────────────────────────────────────────────────────────────┤
│ L1: Infrastructure (CPU, memory, DB, cron worker health)    │
└─────────────────────────────────────────────────────────────┘
         ▲                    ▲
    Safe logs          Traces (requestId)
    NO content         NO body attributes
```

### 2.2 Layer responsibilities

| Layer | Monitors | Consumers |
|-------|----------|-----------|
| **Application** | Error rates, flag state, AI provider availability | Engineering |
| **API** | Per-route latency p50/p95, 4xx/5xx | Engineering, SRE |
| **Realtime/stream** | Active streams, chunk latency, partial failures | Engineering, cost ops |
| **Feature flags** | Enabled % per env/org | Release manager |
| **Quota** | Soft/hard exceeded (6.4) | Finance, support |
| **Organization** | Per-org error budget, usage burn | Enterprise CS |
| **Infrastructure** | DB connections, memory, cron last run | SRE |

### 2.3 Explicit non-goals

- Conversation content analytics  
- Medical entity extraction for ops  
- Audio recording for debugging  
- Prompt logging in production  

---

## Section 3 — Safe logging model

### 3.1 Structured log schema (canonical)

```json
{
  "level": "info|warn|error",
  "timestamp": "ISO-8601",
  "requestId": "uuid",
  "service": "medscout-api",
  "component": "interpreter",
  "event": "interpreter.translate.completed",
  "route": "/api/interpreter/translate",
  "method": "POST",
  "status": 200,
  "durationMs": 842,
  "ownerType": "user",
  "ownerIdHash": "hmac:…",
  "metadata": {
    "usageType": "translate_chars",
    "quantity": 120,
    "languagePair": "de-en",
    "featureFlags": { "streamingStt": false },
    "result": "ok",
    "errorCategory": null
  }
}
```

### 3.2 Allowed fields (MAY log)

| Category | Fields |
|----------|--------|
| Correlation | `requestId`, `streamId`, `exportJobId`, `inviteId` (not raw token) |
| Routing | `method`, `path`, `route`, `status`, `durationMs` |
| Identity (hashed) | `ownerIdHash`, `actorUserIdHash` — HMAC with server pepper *align with analyticsService* |
| Tenancy | `organizationId`, `practiceProfileId` (staff contexts only) |
| Feature state | Flag booleans from `/status` |
| Usage | `usageType`, `quantity`, `unit` (6.4) |
| Errors | `errorCategory`, `code`, `name` (exception class), `retryCount` |
| Realtime | `streamStatus`, `bytesReceived`, `partialRunCount`, `chunkIndex` |
| Quota | `quotaState`, `limit`, `used` (numbers only) |

### 3.3 Forbidden fields (MUST NOT log)

| Forbidden | Includes |
|-----------|----------|
| Transcript / translation / simplified text | Any user or model output string |
| Prompts | System/user messages to OpenAI |
| Medical entities | Symptoms, diagnoses, medications in any field |
| Patient messages | Thread bodies |
| Audio | Blobs, base64, file paths to recordings |
| Raw JWT / tokens | Bearer, invite plaintext |
| Cloud payload | `payloadEnc` decrypted content |
| PDF content | Export file bytes |

### 3.4 Redaction rules

1. Extend `sanitizeAuditMetadata` regex for interpreter routes.  
2. Production `logServerError` — never log `err.message` if it might echo user input (*needs repo verification* validation error paths).  
3. CI test: fail build if interpreter `console.log` includes keys: `text`, `transcript`, `translation`, `prompt`, `audio`.  
4. Log pipeline scrubber at ingest (Datadog/Sentry *when adopted*) — defense in depth.

### 3.5 Retention & rotation

| Log type | Retention | Rotation |
|----------|-----------|----------|
| Access logs | 30 days hot | Host default |
| Error logs | 90 days | Indexed by `requestId` |
| Security audit | 1–2 years | `AuditLog` table |
| Debug verbose | **Off** in prod | — |

### 3.6 Log visibility permissions

| Role | Access |
|------|--------|
| Engineering | Full safe logs in prod via SSO |
| Support tier 1 | **No** raw log UI — ticket + `requestId` lookup tool with redacted view |
| Practice/org admin | **No** application logs — only compliance audit UI (6.3) |
| Patient | **No** |

---

## Section 4 — Error monitoring

### 4.1 Monitoring surfaces

| Surface | Signals | Tooling (planned) |
|---------|---------|-------------------|
| **Frontend** | Error boundary trips, failed fetch codes, stream cancel reasons | Privacy-safe client reporter (category + route only) |
| **Backend exceptions** | Unhandled 500, OpenAI SDK errors | Sentry with scrubbing *6.5.4* |
| **STT** | `transcription_failed`, Whisper 5xx, empty audio | Metric + alert |
| **Translation** | `interpreter_unavailable`, timeout | Metric + alert |
| **Simplify** | Same as translate | Metric |
| **TTS** | `interpreter_tts_disabled`, synthesis failures | Metric |
| **Streaming STT** | `stream.error`, partial cap hit, idle close | Dedicated dashboard |
| **WebSocket** | N/A — use **HTTP stream** failure metrics instead |
| **Export/PDF** | Client PDF errors (local) — log `export.failed` category only; server export jobs via worker queue failed count |

### 4.2 Severity levels

| Level | Definition | Example |
|-------|------------|---------|
| **SEV1** | Core PTT path down for all users | OpenAI key invalid globally |
| **SEV2** | Cloud or B2B invite broken | Encryption key missing |
| **SEV3** | Realtime-only degraded | Streaming flag on but high failure rate |
| **SEV4** | Elevated 429/abuse | Rate limit spike |
| **SEV5** | Cosmetic / single-region | i18n missing string |

### 4.3 Alert thresholds (starting points)

| Metric | Warning | Critical |
|--------|---------|----------|
| `interpreter_translate_error_rate` | > 5% / 5 min | > 15% / 5 min |
| `interpreter_transcribe_p95_ms` | > 8s | > 15s |
| `interpreter_openai_5xx` | > 10 / min | > 50 / min |
| `interpreter_stream_active` | > 500 *per cluster* | > 1000 |
| `worker_exports_failed` | > 20 pending failed | backlog > 100 |

### 4.4 Incident categories

`provider_outage`, `capacity`, `config`, `security_abuse`, `deployment_regression`, `data_integrity` (encryption), `quota_system` (6.4)

### 4.5 Escalation paths

```text
Alert → On-call engineer (15 min)
      → Lead + comms if SEV1/2 > 30 min
      → Legal/DPO if suspected PHI in logs (immediate kill + purge)
```

*Needs repo verification:* on-call roster and paging tool.

---

## Section 5 — Realtime operations monitoring

### 5.1 Metrics (no content)

| Metric | Type | Labels |
|--------|------|--------|
| `interpreter_stream_active_sessions` | Gauge | `instance_id` |
| `interpreter_stream_duration_seconds` | Histogram | |
| `interpreter_stream_chunks_total` | Counter | `result` |
| `interpreter_stream_chunk_latency_ms` | Histogram | |
| `interpreter_stream_partial_runs_total` | Counter | |
| `interpreter_stream_disconnect_reason` | Counter | `idle`, `max_duration`, `client_cancel`, `error` |
| `interpreter_near_realtime_requests_total` | Counter | `result` |
| `interpreter_stream_tts_requests_total` | Counter | `result` |
| `interpreter_provider_errors_total` | Counter | `provider`, `operation` |

### 5.2 Derived indicators

| Indicator | Formula / meaning |
|-----------|-------------------|
| Reconnect rate | Client `stream.start` / unique users — high → network or server instability |
| Disconnect rate | `disconnect_reason` / starts |
| Queue backlog | N/A for sync HTTP — watch **in-memory session count** vs CPU |
| Provider failure rate | `provider_errors` / total AI calls |

### 5.3 Cross-instance gap (planning)

Until Redis stream registry (optional 6.5.7):

- Expose `GET /api/internal/interpreter/ops/streams` (secret-gated) returning **counts only** per instance.  
- Aggregate in monitoring plane — **no** stream content.

### 5.4 WebSocket note

Repo uses **chunked HTTP**, not WebSockets. Incident playbooks should say **“streaming HTTP”** to avoid wrong runbooks. If WebSockets are added later, duplicate metric names with `transport` label.

---

## Section 6 — Incident response architecture

### 6.1 Playbook matrix

| Incident | Detection | Fallback mode | Emergency disable |
|----------|-----------|---------------|-------------------|
| **AI provider outage** | Error rate + OpenAI status | PTT local record only; queue messages “translation temporarily unavailable” | `MEDICAL_INTERPRETER_ENABLED=false` |
| **STT outage** | Transcribe failures | Manual text entry if UI supports *needs repo verification* |
| **TTS outage** | Speak failures | Text-only display |
| **Translation degradation** | High latency / uncertain flag spike | Continue PTT + local storage; skip auto-translate |
| **Streaming outage** | Stream 5xx / active session leak | **Fallback-to-PTT** banner; flags off |
| **HTTP stream overload** | CPU + active streams | Lower `STREAM_MAX_ACTIVE`; 503 new streams |
| **Abuse attack** | 429 spike, security events | IP block; tighten rate limits |
| **Quota exhaustion** | 6.4 metrics | Local-only messaging (not outage) |
| **Billing service outage** | Stripe webhook failures (6.4.5+) | **Do not** block interpreter AI — grace mode |
| **Regional failure** | Region health check fail | DNS failover to EU-secondary *future* |

### 6.2 Degraded operation levels

| Level | User experience |
|-------|-----------------|
| **L0 Normal** | All enabled features per flags |
| **L1 Degraded** | Realtime off; PTT + translate on |
| **L2 Minimal** | Local-only; no server AI |
| **L3 Maintenance** | Module disabled via master flag |

### 6.3 Rollback strategy

1. Toggle env flags (no redeploy) *needs repo verification* if runtime config service exists — else redeploy previous release.  
2. Disable realtime flags first (fastest cost/latency win).  
3. Full module off only if PTT path compromised.  
4. Database migrations **not** rolled back in hot path — forward fixes only.

### 6.4 Communication strategy

| Audience | Channel | Content |
|----------|---------|---------|
| Patients | In-app banner (i18n) | Calm, non-alarmist; PTT still works |
| Practices | Email/status page | B2B invite/status only |
| Enterprise | Account manager | Org-level incident id |
| Internal | Slack/incident doc | Technical; no patient stories |

**Status page** (6.5.6): components `Interpreter AI`, `Cloud backup`, `Practice invites`, `Realtime preview`.

---

## Section 7 — Feature flag operations

### 7.1 Flag inventory (interpreter)

| Flag | Emergency action |
|------|------------------|
| `MEDICAL_INTERPRETER_ENABLED` | Master kill |
| `INTERPRETER_TTS_ENABLED` | Disable voice |
| `INTERPRETER_CLOUD_ENABLED` | Stop cloud writes |
| `MEDICAL_INTERPRETER_B2B_ENABLED` | Disable practice tools |
| `MEDICAL_INTERPRETER_STREAMING_STT_ENABLED` | Stop stream STT |
| `MEDICAL_INTERPRETER_NEAR_REALTIME_TRANSLATION_ENABLED` | Stop preview translate |
| `MEDICAL_INTERPRETER_STREAMING_TTS_ENABLED` | Stop stream TTS |

### 7.2 Rollout strategy (future)

| Stage | Scope |
|-------|-------|
| Dev | All on for QA |
| Staging | Mirror prod flags |
| Prod canary | 5% orgs or internal staff practices |
| Prod GA | Global env true |

*Needs repo verification:* LaunchDarkly or similar — today env-only.

### 7.3 Organization-level rollout (6.2 + 6.5)

`OrganizationPolicy.featureFlagsJson` overrides:

- Enable realtime for pilot org only  
- Disable cloud for specific org  

Monitor: compare error rates **canary vs baseline** — metadata only.

### 7.4 Safety defaults

| Flag | Production default |
|------|-------------------|
| Master interpreter | Off until deliberate launch |
| Realtime family | **Off** |
| Cloud | Off until encryption configured |
| B2B | Off until pilot |

### 7.5 Monitoring hooks

On flag change (deploy):

- Log `interpreter.flags.changed` with diff  
- Alert if master disabled in prod unexpectedly  
- Dashboard panel: current flag snapshot from `/status` poller

---

## Section 8 — Performance & capacity monitoring

### 8.1 Metrics catalogue

| Metric | Use |
|--------|-----|
| `http_request_duration_ms` | Per interpreter route |
| `db_query_duration_ms` | Cloud session read/write |
| `interpreter_active_local_sessions` | **Not server-knowable** — optional client heartbeat *privacy review* |
| `interpreter_stream_concurrency` | Server gauge |
| `process_memory_bytes` | Node heap — stream buffers |
| `process_cpu_percent` | Transcribe spikes |
| `export_job_queue_depth` | From `getWorkerStatus().exports` |
| `openai_request_in_flight` | Semaphore *planned* |

### 8.2 Scaling thresholds

| Signal | Scale up trigger |
|--------|------------------|
| p95 transcribe > 10s sustained | Add API instances |
| CPU > 75% 10 min | Add instances |
| Stream concurrency > 200/instance | Add instances + consider stream registry |
| DB connections > 80% pool | Scale DB or pool size |

### 8.3 Autoscaling considerations

- Stateless API scales horizontally **except** in-memory rate limits and stream maps — require Redis for correctness (6.5.7).  
- Whisper is CPU/API-bound — prefer **queue** for batch *future*; not MVP.  
- Cron worker separate dyno — do not run heavy export on API dyno.

### 8.4 Capacity alerts

- Disk: N/A for interpreter audio (not persisted)  
- DB size: cloud payload growth — alert per org storage meter (6.4)  
- Memory: stream Map leak — alert if active sessions not decreasing over 30 min  

---

## Section 9 — Privacy-first analytics

### 9.1 Allowed analytics events (proposed additions)

| Event | Metadata |
|-------|----------|
| `interpreter_session_started` | `storageMode: local|cloud`, `languagePair` |
| `interpreter_turn_confirmed` | count increment only — **no text** |
| `interpreter_feature_used` | `feature: ptt|translate|simplify|tts|stream` |
| `interpreter_cloud_sync` | `sessionCount`, `result` |
| `interpreter_invite_opened` | `inviteType` |
| `interpreter_export_pdf` | client-local — optional |
| `interpreter_quota_warning` | `usageType`, `percent` |

Register in `ANALYTICS_EVENT_TYPES` with strict metadata allowlist (mirror `analyticsService`).

### 9.2 Forbidden analytics

- Transcript analysis, topic modeling, symptom classification  
- Hidden organization monitoring of patient content  
- AI review of conversations for ops  
- Audio retention for quality analytics  

### 9.3 Aggregation for product

- Language pair histogram (global)  
- Feature adoption funnel (flags on → first PTT → first translate)  
- Session duration buckets (time only, from client ping)  

### 9.4 Separation from billing

| System | Data |
|--------|------|
| `UsageEvent` (6.4) | Billing/quota |
| `AnalyticsEvent` | Product improvement |
| `AuditLog` | Compliance |

No shared table with content fields.

---

## Section 10 — Operational security monitoring

### 10.1 Signals (no content inspection)

| Signal | Detection |
|--------|-----------|
| Abuse spike | 429 rate by `keyPrefix` |
| Streaming abuse | `partial_runs` maxed repeatedly per userHash |
| Quota exhaustion loop | `quota_hard` > N per user/day |
| Invite abuse | Invite validate rate + `PracticeInterpreterInviteUsage` velocity |
| Auth abuse | `invalid_token` security events throttled |
| Org anomaly | New practice creation + AI usage 10× baseline |
| Export abuse | Export job create rate per practice |
| Realtime spam | Near-realtime requests > 3× translate without stream |

### 10.2 Automated responses

| Severity | Action |
|----------|--------|
| Low | Log security event |
| Medium | Tighten rate limit for IP |
| High | Temporary user/practice lockout + alert |

### 10.3 Dashboards

- Security ops: 429 heatmap, lockouts, invite scans  
- **No** “top transcripts” or “sample messages” widgets  

---

## Section 11 — Enterprise support model

### 11.1 Support tooling (planned)

| Tool | Function |
|------|----------|
| **Request lookup** | Enter `requestId` → safe log lines + audit metadata |
| **Tenant overview** | Org id → quota, flags, error rate (no patient list by default) |
| **Invite debugger** | Token prefix + status — **never** show full token in ticket |
| **Impersonation** | **Forbidden** for interpreter content — or view-metadata-only role |

### 11.2 Workflows

| Tier | Scope |
|------|-------|
| **Pilot** | Dedicated Slack; weekly usage review with customer |
| **Enterprise** | SLA clock; incident bridge for SEV1 |
| **Patient** | Help center articles; no access to logs |

### 11.3 Health status page

Public components:

- Interpreter availability (synthetic `GET /status` + synthetic transcribe smoke *no real PHI*)  
- Cloud backup  
- Practice invites  

### 11.4 Maintenance windows

- Announce 48h ahead  
- Disable realtime first during window  
- Prefer read-only cloud maintenance vs hard down  

### 11.5 Support visibility matrix

| May see | Must never see |
|---------|----------------|
| `requestId`, timestamps, error codes | Transcripts, translations |
| Quota numbers, plan tier | Cloud decrypted payloads |
| Invite prefix, practice name | Audio recordings |
| Flag states, version | Prompts, OpenAI raw responses |
| Audit metadata (6.3) | Patient session content via “support view” |

---

## Section 12 — Multi-region & deployment strategy

### 12.1 EU-first strategy

| Layer | EU-default |
|-------|------------|
| PostgreSQL | EU region primary |
| API | EU Render region |
| OpenAI | EU data residency when available *needs repo verification* |
| Logs | EU log sink |

### 12.2 Regional deployments (future)

- `eu-central` active  
- `ch` or `eu-west` secondary for latency  
- Org `dataRegion` routes traffic (6.2)  

### 12.3 Failover

| Failure | Action |
|---------|--------|
| Primary API region | DNS to secondary; flags global off realtime during failover test |
| OpenAI region | Provider router to backup model/vendor *contract dependent* |
| DB | Postgres replica promote — RPO/RTO in runbook *needs repo verification* |

### 12.4 Low-latency routing

- CDN for static client only  
- API geo-routing for stream chunks — patient → nearest EU POP  

### 12.5 International scaling

- Status page + i18n incident banners (DE/EN minimum)  
- Per-region synthetic monitoring  

---

## Section 13 — Accessibility & UX during incidents

### 13.1 Messaging principles

- Calm, plain language — no “critical medical failure” framing  
- Explain **what still works** (local recording, reading past turns on device)  
- Multilingual: `medicalInterpreter.reliability.*` keys — extend for outages  

### 13.2 UI patterns

| State | UI |
|-------|-----|
| Translate down | Banner + retry button; PTT transcript still shown if STT up |
| STT down | Suggest typing *if available* or retry |
| Realtime down | “Use push-to-talk instead” — link to help |
| Cloud down | “Only on this device until backup returns” |
| Quota exceeded | Separate from outage — link to usage (6.4) |

### 13.3 Accessibility

- `role="alert"` for banners; `aria-live="polite"`  
- Do not rely on colour alone (avoid red emergency aesthetic)  
- Screen reader text for degraded mode  

### 13.4 Copy examples (planning)

- “Translation is temporarily unavailable. Your conversation on this device is not lost.”  
- “Live preview is off. Push-to-talk still works.”  

---

## Section 14 — Risks & mitigations

| Risk | Mitigation |
|------|------------|
| **Privacy leakage through logs** | Allowlist schema + CI + ingest scrubbers |
| **Over-monitoring** | Tiered retention; no debug in prod |
| **Hidden analytics drift** | Event type registry review quarterly |
| **Enterprise observability complexity** | Single ops dashboard; role-gated |
| **Realtime instability** | Off by default; strong caps; PTT fallback |
| **Provider dependency** | Status page + multi-provider roadmap |
| **Scaling cost** | Quota (6.4) + stream metrics |
| **Operational overload** | Runbooks + synthetic checks; automate paging thresholds |
| **Multi-instance stream bugs** | 6.5.7 registry or sticky sessions |
| **Support curiosity** | Technical controls — no content APIs for support |

---

## Section 15 — Implementation roadmap (6.5.1–6.5.7)

**Do not implement until explicit request.** Depends on 6.4.1 usage events for quota metrics overlap.

### 6.5.1 — Structured logging foundation

- Standardize `interpreter.*` event names in `logInterpreterError` → unified logger  
- Hash user ids in logs  
- Document retention in ops runbook  
- **Exit:** All interpreter routes emit schema-compliant JSON

### 6.5.2 — Safe request tracing

- Propagate `requestId` to OpenAI metadata *if SDK supports*  
- Optional OTel spans: route → service → provider (no attributes with text)  
- **Exit:** Trace lookup by `requestId` in staging

### 6.5.3 — Realtime operational metrics

- Export stream gauges; internal ops endpoint  
- Dashboard: active streams, partial rate, chunk p95  
- **Exit:** SEV3 stream incident detectable < 5 min

### 6.5.4 — Incident-response tooling

- Runbooks in `docs/operations/INTERPRETER_INCIDENTS.md`  
- Sentry project with scrubbing rules *if adopted*  
- Synthetic checks + paging  
- **Exit:** Tabletop exercise completed

### 6.5.5 — Privacy-first analytics

- Add interpreter events to `ANALYTICS_EVENT_TYPES`  
- Wire coarse client events (no text)  
- **Exit:** Product dashboard language pairs only

### 6.5.6 — Enterprise operations dashboard

- Org/practice: error rate, quota, flags, invite health  
- Support request lookup tool  
- Public status page component  
- **Exit:** Pilot customer can self-serve ops view

### 6.5.7 — Multi-region operational hardening

- Redis rate limits + optional stream registry  
- Regional health checks; failover drill  
- BullMQ evaluation per `FUTURE_BULLMQ_QUEUE_PLAN.md` if export volume warrants  
- **Exit:** Two-region failover documented and tested

### Dependency diagram

```text
6.4.1 usage ──► 6.5.1 ──► 6.5.2
                  │
                  ├──► 6.5.3 ──► 6.5.4
                  │
                  ├──► 6.5.5
                  │
6.2 org ──────────┴──► 6.5.6 ──► 6.5.7
```

---

## Section 16 — What must NOT be implemented yet

| Forbidden | Reason |
|-----------|--------|
| Transcript analytics | Privacy / trust |
| Medical-topic analytics | Clinical boundary + GDPR |
| Hidden surveillance telemetry | User trust |
| Hidden org monitoring of content | Enterprise risk |
| AI review of patient conversations | PHI + purpose limitation |
| Diagnosis / symptom analytics | SaMD / ethics |
| Audio retention for analytics | GDPR |
| Logging prompts/responses in prod | Leak risk |
| Support “view as patient” for sessions | Consent model (6.3) |
| WebSocket debug capture | Not in architecture today |
| Full-story session replay (LogRocket-style) | Incompatible with privacy principle |

---

## Appendix A — Synthetic monitoring (planning)

| Check | Frequency | Auth |
|-------|-----------|------|
| `GET /api/interpreter/status` | 1 min | Service token or public *verify* |
| Smoke translate | 5 min | Dedicated test account; fixed non-medical phrase |
| Smoke transcribe | 15 min | Short synthetic tone file |
| Cloud encryption configured | 1 h | Internal |
| Worker export queue | 5 min | Internal |

Smoke tests use **non-medical** fixed strings only.

---

## Appendix B — Error category taxonomy

| `errorCategory` | Maps from |
|-----------------|-----------|
| `provider_unavailable` | 503 interpreter_unavailable |
| `provider_timeout` | SDK timeout |
| `validation` | input safety reject |
| `rate_limit` | 429 |
| `quota` | quota_exceeded |
| `consent` | cloud consent required |
| `stream_limit` | partial/max duration |
| `internal` | 500 |

Use in logs, metrics, and client analytics — never include user text.

---

## Appendix C — Integration with Phase 6.3 / 6.4

| Phase | Ops integration |
|-------|-----------------|
| 6.3 Audit | Ops searches `AuditLog` — same `requestId` |
| 6.4 Quota | Metrics `quota.exceeded`; dashboards on `UsagePeriod` |
| 6.4 Billing outage | Grace mode — **not** L3 maintenance |

---

## Appendix D — Open questions (*needs repo verification*)

1. Render log aggregation and retention defaults?  
2. Is `GET /api/interpreter/status` reachable without auth (public probe)?  
3. Sentry or other APM already configured for main app?  
4. OpenAI organization monitoring / status webhooks?  
5. On-call and incident comms channel?  
6. Number of production API instances?  
7. Client-side optional heartbeat for session duration — privacy review needed?  
8. Typed text fallback when STT down — does UI exist?  

---

*Document version: Phase 6.5 planning — no code changes, no migrations, no hidden telemetry, no implementation. Do not proceed to Phase 6.6 without a separate implementation request.*
