# Medical Interpreter — Phase 6.4 Usage Quota, Billing Readiness & Cost Control (Planning Only)

**Status:** Planning document. No implementation in Phase 6.4.  
**Builds on:** [PHASE_6_1_ECOSYSTEM_PLAN.md](./PHASE_6_1_ECOSYSTEM_PLAN.md), [PHASE_6_2_ORG_ARCHITECTURE_PLAN.md](./PHASE_6_2_ORG_ARCHITECTURE_PLAN.md), [PHASE_6_3_ENTERPRISE_COMPLIANCE_PLAN.md](./PHASE_6_3_ENTERPRISE_COMPLIANCE_PLAN.md)  
**Related:** [PHASE_6_5_OBSERVABILITY_OPS_PLAN.md](./PHASE_6_5_OBSERVABILITY_OPS_PLAN.md) (operational monitoring for quotas and AI cost)  
**Scope:** Economic and operational sustainability layer — usage metering, quota enforcement design, billing-readiness, and financial governance without payment providers, without Stripe logic, and without changing existing B2C/B2B behaviour.

---

## Core principle (non-negotiable)

The Medical Interpreter must remain:

- **privacy-first** — metering never stores transcript or medical text  
- **medically safe** — no diagnosis/triage/treatment monetization paths  
- **communication-only** — bill operational AI units, not clinical inference  
- **scalable** — org/practice aggregation without cross-tenant leakage  
- **financially sustainable** — predictable unit economics  
- **operationally predictable** — soft warnings before hard blocks  

The quota/billing architecture must:

- prevent abuse and cost explosion  
- control AI spend (especially realtime)  
- support enterprise scaling (seats + pooled usage)  
- preserve accessibility (local-only path stays viable when quotas hit)  
- avoid hidden monetization dark patterns  

---

## Executive summary

Today, interpreter cost control is **IP rate limiting** (in-memory per process) plus **hard caps** on cloud session count (100/user), turn size (1200 chars), audio size (5 MB PTT), and streaming env limits (2 min stream, 5 partial Whisper runs). There is **no usage ledger**, **no org/practice quota**, and **no Stripe/billing tables** in `schema.prisma`. Legal copy references App Store subscriptions for the wider app — *needs repo verification* for interpreter-specific SKUs.

Phase 6.4 designs **UsageEvent → UsageQuota → BillingAccount** linkage, enforcement semantics, realtime cost shields, future Stripe-ready models, cost optimization, financial observability, enterprise UX, and subphases **6.4.1–6.4.7** — with **6.4.5 Stripe explicitly deferred** until business approval.

---

## Section 1 — Current cost & usage review

### 1.1 Current AI usage architecture

| Capability | Route / surface | Persistence | Cost driver |
|------------|-----------------|-------------|-------------|
| **PTT transcription** | `POST /api/interpreter/transcribe` | Memory-only audio; discarded after response | OpenAI `whisper-1` per clip |
| **Translation** | `POST /api/interpreter/translate` | None server-side | `gpt-4o-mini` (default), `max_tokens: 450`, single turn |
| **Simplification** | `POST /api/interpreter/simplify` | None | Same chat model, `max_tokens: 450` |
| **TTS** | `POST /api/interpreter/speak` | Response audio bytes only | TTS model env (`INTERPRETER_TTS_MODEL` / `OPENAI_TTS_MODEL`) |
| **Streaming STT** | `/api/interpreter/stream/transcribe/*` | In-memory chunks; no DB audio | Up to **5** partial Whisper + 1 final per stream |
| **Near-realtime translate** | `POST /api/interpreter/near-realtime/translate` | None | Chat model; max **600** chars/chunk |
| **Streaming TTS** | `POST /api/interpreter/stream/speak` | None server-side | TTS; max **600** chars; client LRU cache (8 entries, 4s repeat throttle) |
| **Cloud storage** | `/api/interpreter/sessions`, preference | Encrypted text in PostgreSQL | Storage + crypto ops; not per-token AI |
| **PDF export** | Client-side session review | Device-generated | **No server AI** today for interpreter PDF |
| **Local sessions** | `localStorage` | Device only | **Zero** server AI cost until user calls APIs |

All interpreter AI routes sit under `app.use('/api/interpreter', requireAuth, …)` — **no anonymous server AI** for interpreter (*guest invite landing does not call transcribe*).

### 1.2 Current model usage patterns

| Operation | Model (verified / default) | Input pattern |
|-----------|--------------------------|---------------|
| Transcribe | `whisper-1` | Short PTT clips; `verbose_json` |
| Translate / simplify | `gpt-4o-mini` via `getInterpreterOpenAiModel()` | System + user message; **no session history** |
| TTS | Configurable OpenAI speech model | Verbatim text; no LLM rewrite |
| Stream partials | Same `transcribeInterpreterAudio` → Whisper | Throttled ≥ 2.5s between partials |

*Needs repo verification:* whether usage tokens from OpenAI responses are logged anywhere today (likely not).

### 1.3 Current token usage behaviour

| Path | Token behaviour |
|------|-----------------|
| Full translate/simplify | Capped at 450 output tokens; input bounded by `INTERPRETER_MAX_TURN_CHARS` (1200) |
| Near-realtime | `NEAR_REALTIME_MAX_CHUNK_CHARS` = 600 |
| Stream TTS | `STREAM_TTS_MAX_CHARS` = 600 |
| Transcribe | Whisper billed by **audio duration**, not chat tokens |

**Gap:** No server-side `promptTokens` / `completionTokens` persistence for interpreter routes.

### 1.4 Current rate limiting

Implementation: `server/middleware/interpreterRateLimit.js` — **in-memory Map per server process**, keyed by IP + prefix.

| Limiter | Max / window (approx.) |
|---------|------------------------|
| Shared interpreter POST | 85 |
| Transcribe | 8 |
| Translate | 24 |
| Simplify | 16 |
| Speak | 12 |
| Cloud shared | 40 |
| Stream shared | 40 |
| Stream chunk | 90 |
| Near-realtime translate | 18 |
| Stream speak | 14 |
| Invite validate (public) | 40 |

**Limits:** Not user-scoped; not durable across restarts; not org-aware. Adequate for abuse ceiling, insufficient for enterprise billing.

### 1.5 Current feature flags

| Flag | Default | Effect |
|------|---------|--------|
| `MEDICAL_INTERPRETER_ENABLED` | off | Master gate |
| `INTERPRETER_TTS_ENABLED` | on when module on | TTS routes |
| `INTERPRETER_CLOUD_ENABLED` | off | Cloud CRUD |
| `MEDICAL_INTERPRETER_B2B_ENABLED` | off | Practice routes |
| `MEDICAL_INTERPRETER_STREAMING_STT_ENABLED` | off | Stream STT |
| `MEDICAL_INTERPRETER_NEAR_REALTIME_TRANSLATION_ENABLED` | off | Preview translate |
| `MEDICAL_INTERPRETER_STREAMING_TTS_ENABLED` | off | Stream speak |

Client mirrors via `VITE_*` flags.

### 1.6 Cloud storage growth risks

| Control | Value |
|---------|-------|
| Max sessions per user | 100 (`INTERPRETER_CLOUD_MAX_SESSIONS_PER_USER`) |
| Max turns per session | 200 |
| Max chars per session | 250,000 |
| Max request body | ~600 KB |
| Quota error | `interpreter_cloud_quota_exceeded` |

**Risk:** 100 sessions × 250k chars = large DB storage per power user; encryption CPU on read/write. **No** per-org storage pool yet.

### 1.7 Realtime cost risks

| Risk | Mitigation today | Residual risk |
|------|------------------|---------------|
| Partial Whisper spam | Max 5 partials/stream; 2.5s min interval | User could open many streams sequentially |
| Long stream | 120s max duration; 4 MB audio cap | 5× Whisper per stream still costly |
| Near-realtime translate loop | 18 req/window IP limit; 600 char cap | Authenticated user could rotate IPs *needs repo verification* |
| Stream TTS repeat | Client 4s throttle + 8-entry cache | Server still hit on cache miss |
| Multi-instance | In-memory limits not shared | Horizontal scale weakens per-IP limits |

### 1.8 Existing billing / subscription infrastructure

| Finding | Detail |
|---------|--------|
| Prisma `schema.prisma` | **No** Stripe customer, subscription, or invoice models found |
| `package.json` | **No** stripe dependency in repo grep |
| Legal (EN AGB) | References App Store / Play Store subscriptions for wider app |
| Verlag rules | No payment logic unless explicitly requested |
| Analytics | `AnalyticsEvent` table — privacy-preserving; **interpreter events not in allowlist** today |

**Conclusion:** Billing-readiness for interpreter is **greenfield** at data layer; reuse App Store narrative for B2C only after product decision (*needs repo verification*).

---

## Section 2 — Usage entity architecture

### 2.1 Entity overview

```text
BillingAccount (future)
 ├── SubscriptionContract (future, 6.4.5+)
 ├── UsageQuota (limits per period)
 └── UsagePeriod (rollup bucket)

UsageEvent (append-only facts)
 └── feeds UsageSnapshot / UsagePeriod counters

OrganizationQuota / PracticeQuota / UserQuota (views or materialized limits)
RealtimeQuota (sub-limit with stricter reset)
```

### 2.2 UsageEvent (append-only fact)

| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | |
| `occurredAt` | datetime | |
| `usageType` | enum string | See §3 |
| `quantity` | decimal | Normalized units (e.g. seconds, chars, count) |
| `unit` | enum | `seconds`, `chars`, `requests`, `bytes`, `seats` |
| `ownerType` | enum | `user`, `practice`, `organization` |
| `ownerId` | string | |
| `actorUserId` | string? | Who triggered (patient/staff) |
| `route` | string? | e.g. `interpreter.transcribe` |
| `requestId` | string? | Correlation |
| `metadataJson` | JSON | **Allowlist:** `languagePair`, `featureFlag`, `streamId`, `result`, `durationMs` — **no text** |
| `estimatedCostMicros` | int? | Optional internal; USD micro-cents |
| `idempotencyKey` | string? | Prevent double-count on retry |

**Partitioning:** Monthly by `occurredAt` for retention/pruning.

### 2.3 UsageQuota (limit definition)

| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | |
| `quotaId` | string | External stable id for support |
| `ownerType` | enum | |
| `ownerId` | string | |
| `usageType` | string | Or `*` for aggregate AI pool |
| `periodType` | enum | `daily`, `monthly`, `billing_cycle` |
| `periodStart` | datetime | |
| `periodEnd` | datetime | |
| `usageLimit` | decimal | Hard cap |
| `softLimit` | decimal? | Warning threshold (e.g. 80%) |
| `resetPolicy` | enum | `calendar_month`, `rolling_30d`, `contract_anchor` |
| `overagePolicy` | enum | `block`, `allow_grace`, `bill_overage` (future) |
| `source` | enum | `plan_default`, `admin_override`, `pilot_contract` |
| `createdAt`, `updatedAt` | | |

### 2.4 UsagePeriod (rollup)

| Field | Notes |
|-------|-------|
| `ownerType`, `ownerId` | |
| `usageType` | |
| `periodStart`, `periodEnd` | |
| `usageAmount` | Sum of events |
| `usageLimit` | Copy from quota at period open |
| `status` | `ok`, `soft_exceeded`, `hard_exceeded` |
| `lastEventAt` | | |

Updated synchronously on event insert (transaction) or async rollup job (*implementation choice in 6.4.1*).

### 2.5 UsageSnapshot (optional)

Point-in-time read model for dashboards — refreshed from `UsagePeriod` every N minutes to avoid hot-row contention.

### 2.6 Scoped quota entities

| Entity | Purpose |
|--------|---------|
| `OrganizationQuota` | Pooled AI units across practices |
| `PracticeQuota` | Site-level cap (sub-pool of org) |
| `UserQuota` | B2C patient cap (optional premium tier) |
| `RealtimeQuota` | Strict sub-cap: stream minutes + preview translate count |

### 2.7 RealtimeQuota (recommended separate row or usageType prefix)

| Field | Example default (pilot) |
|-------|-------------------------|
| `streamMinutesPerDay` | 30 |
| `partialTranscribePerStream` | 5 (align env) |
| `nearRealtimeTranslatePerHour` | 60 |
| `streamTtsPerHour` | 40 |

---

## Section 3 — Usage types

### 3.1 Measurable dimensions

| `usageType` | Unit | Billable? | MVP/pilot |
|-------------|------|-----------|-----------|
| `transcribe_seconds` | seconds | Yes (enterprise) | Rate-limited free B2C |
| `transcribe_requests` | count | Optional | Yes — abuse metric |
| `translate_chars` | chars | Yes | Yes |
| `translate_requests` | count | Optional | Yes |
| `simplify_chars` | chars | Yes | Yes |
| `simplify_requests` | count | Optional | Yes |
| `tts_chars` | chars | Yes | Yes |
| `tts_requests` | count | Optional | Yes |
| `stream_transcribe_seconds` | seconds | **Yes — premium** | Off by default |
| `stream_partial_runs` | count | Internal cost | Cap only |
| `near_realtime_translate_chars` | chars | **Yes — premium** | Off by default |
| `near_realtime_translate_requests` | count | Yes | Cap only |
| `stream_tts_chars` | chars | **Yes — premium** | Off by default |
| `cloud_storage_bytes` | bytes | Optional tier | Free tier cap |
| `cloud_session_count` | count | Existing cap | Keep 100 |
| `export_jobs` | count | Yes (enterprise) | Patient free low cap |
| `practice_seats` | seats | Yes (B2B) | Manual pilot |
| `active_invites` | count | No — operational | Cap 50/site |
| `api_requests` | count | Developer API | Separate product |
| `language_pairs` | n/a | **Not billable** | Analytics only |

### 3.2 What should remain free (accessibility)

| Capability | Rationale |
|------------|-----------|
| **Local-only sessions** | No server cost; must work when AI quota exhausted |
| **Reading/editing local history** | Device-only |
| **Invite landing / validation** | Low cost; rate-limited |
| **First N PTT turns/month (B2C pilot)** | Accessibility & adoption — *product decision* |
| **Simplify for patient** | Communication equity — may be generous free tier |

### 3.3 What should be billable (enterprise)

- Pooled **AI units** (transcribe seconds + translate chars + TTS chars) per organization/month  
- **Realtime add-on** SKU (separate meter)  
- **Seats** (active `PracticeMember` + org admins)  
- **Cloud storage** above included GB (optional)  
- **Exports** above included count (staff, consent-gated)  

### 3.4 Unified “AI unit” (optional simplification)

For invoices, normalize:

```text
1 AI unit =
  1 transcribe_second × Wt
  + translate_char × Wtr
  + tts_char × Wtts
  + stream_transcribe_second × Ws
```

Weights configured in `BillingPlan.aiUnitWeightsJson` — not exposed to patients as opaque currency.

---

## Section 4 — Quota architecture

### 4.1 Owner tiers

| Tier | Owner key | Default policy (pilot) |
|------|-----------|------------------------|
| **Anonymous/guest** | N/A for interpreter AI | No server AI |
| **B2C logged-in** | `user:{userId}` | Generous monthly AI pool; hard block server AI only |
| **B2C premium** | `user:{userId}` + plan | Higher pool + optional realtime |
| **Practice** | `practice:{practiceProfileId}` | Pooled for staff-mediated patient sessions *when B2B metering applies* |
| **Organization** | `org:{organizationId}` | Master pool; sub-allocations to practices |
| **Enterprise pilot** | Contract overrides | Manual `UsageQuota.source=pilot_contract` |

**Critical:** Quota exhaustion blocks **server** AI routes only — never deletes local data or blocks UI navigation.

### 4.2 Soft vs hard behaviour

| State | HTTP | UX |
|-------|------|-----|
| **OK** | 200 | Normal |
| **Soft exceeded** (≥ softLimit) | 200 + header `X-Interpreter-Quota-Warning: soft` | Calm banner: “Approaching monthly limit” |
| **Hard exceeded** | 429 `quota_exceeded` | Explain local-only still works; link to usage/billing |
| **Abuse lockout** | 403 `quota_abuse` | Security review; distinct from plan limit |

### 4.3 Warning thresholds

- 50% — optional dashboard only  
- 80% — soft warning (email/in-app *needs repo verification* notification infra)  
- 100% — hard block server AI  
- 110% — **no** auto-overage billing without contract (`overagePolicy=block` default)

### 4.4 Emergency grace

| Rule | Value |
|------|-------|
| Grace units | 5% of monthly pool or fixed 10 AI units — once per period |
| Eligibility | B2C + enterprise; not for abuse-flagged accounts |
| Audit | `quota.grace_applied` metadata event |

### 4.5 Abuse lockouts

Triggered by:

- Rate limit sustained violations  
- Stream partial run exhaustion loops  
- Identical translate spam (>N identical hashes per hour — hash of normalized text length + language pair, **not** text)  
- Export job flood  

Lockout scope: `userId` or `practiceId`; duration: 1h–24h; appeal via support.

### 4.6 Realtime-specific quotas

Enforced **before** starting stream session:

1. Check `RealtimeQuota` daily stream minutes.  
2. Check org/practice realtime SKU flag.  
3. Deny with `realtime_quota_exceeded` + message: use PTT (fallback copy).

Partial Whisper counts toward `stream_partial_runs` meter even when env allows 5 — billable internally.

---

## Section 5 — Realtime cost control

### 5.1 Cost drivers (review)

| Feature | Cost multiplier vs PTT |
|---------|------------------------|
| Streaming STT partials | Up to **6×** Whisper per stream (5 partial + finish) |
| Near-realtime translate | Extra chat calls before confirm |
| Streaming TTS | TTS per preview chunk |
| Long session | 2 min × partial interval |
| WebSocket | **Not used** — HTTP chunked; connection cost = normal HTTP |

### 5.2 Protection strategy (layered)

| Layer | Control |
|-------|---------|
| **Product** | Flags default **off**; realtime = paid SKU |
| **Env** | Keep `STREAM_MAX_PARTIAL_RUNS`, `STREAM_MAX_DURATION_MS` |
| **Server session** | 1 active stream/user; idle timeout 45s no chunks → auto-close |
| **Chunk** | Max 256 KB/chunk; max 90 chunks/window IP (existing) |
| **Debounce** | Client: near-realtime min 12 chars + debounce 800ms *planned* |
| **Partial throttle** | Server: 2.5s min between partials (existing) |
| **Quota** | Daily stream minutes cap per user/org |
| **Fallback** | UI copy + disable stream buttons when quota low; PTT always available |

### 5.3 Idle disconnect & inactivity

| Signal | Action |
|--------|--------|
| No chunk for 45s | `stream.idle_closed` + cleanup buffers |
| Tab hidden (client) | Cancel stream (existing Phase 5.6 pattern) |
| Max duration 120s | Force finish or cancel |

### 5.4 Low-cost model routing (future)

| Scenario | Model |
|----------|-------|
| PTT transcribe | `whisper-1` (required quality) |
| Stream partial preview | Same — consider **no partial** on free tier (0 partials) |
| Full translate confirm | `gpt-4o-mini` |
| Near-realtime preview | Cheaper model *if* quality gate passes — *needs repo verification* alternate model |
| TTS preview | Smaller voice model / shorter max chars |

**Rule:** Never downgrade confirm-step translation used for documentation without user-visible “preview quality” label.

### 5.5 Fallback-to-PTT strategy

```text
if (realtimeQuota.exceeded || streamDenied) {
  showBanner("Use push-to-talk for unlimited local recording on this device.");
  enable PTT only;
}
```

Server realtime endpoints return 429 with `fallback: "ptt"`.

---

## Section 6 — Billing readiness architecture (no payment yet)

### 6.1 Design goals

- Schema and IDs ready for Stripe **without** importing Stripe SDK in 6.4.1–6.4.4.  
- Dual channel: **B2C App Store** (out of scope for server metering sync) vs **B2B invoice/Stripe** (org billing).  
- Meters drive quotas — payment only reconciles in 6.4.5.

### 6.2 Customer entity model (proposed)

```prisma
model BillingAccount {
  id                String   @id @default(cuid())
  organizationId    String?  @unique  // B2B primary
  practiceProfileId String?  @unique  // legacy single-practice
  legalName         String
  billingEmail      String
  currency          String   @default("EUR")
  country           String?
  taxId             String?  // VAT ID
  stripeCustomerId  String?  // 6.4.5 only
  status            String   // active | suspended | closed
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### 6.3 Subscription state model (proposed)

```prisma
model SubscriptionContract {
  id                 String   @id @default(cuid())
  billingAccountId   String
  planCode           String   // interpreter_practice_std | org_enterprise | realtime_addon
  status             String   // trialing | active | past_due | canceled
  seatCount          Int?
  includedAiUnits    Decimal?
  realtimeEnabled    Boolean  @default(false)
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  stripeSubscriptionId String?
  metadataJson       Json?
}
```

### 6.4 Invoice linkage (future)

```prisma
model BillingInvoiceRef {
  id               String @id
  billingAccountId String
  stripeInvoiceId  String?
  periodStart      DateTime
  periodEnd        DateTime
  status           String
  amountCents      Int
  currency         String
}
```

### 6.5 Organization billing ownership

| Model | Owner |
|-------|-------|
| MVZ / chain | `BillingAccount.organizationId` |
| Single practice (legacy) | `BillingAccount.practiceProfileId` OR auto-org wrapper (Phase 6.2) |
| B2C patient | Separate `BillingAccount` optional — *or* App Store only |

**Seat management:** `seatCount` ≥ active non-revoked `PracticeMember` + org admins; over-seat = soft warning, not hidden access.

### 6.6 Quota linkage

On `SubscriptionContract` activate:

1. Materialize `UsageQuota` rows for period.  
2. Copy limits from `BillingPlan` catalog.  
3. On cancel at period end — downgrade to free tier quotas (block realtime, reduce pool).

**Webhook placeholder (6.4.5):** `invoice.paid` → extend period; `subscription.deleted` → revoke realtime SKU.

---

## Section 7 — Cost optimization strategy

### 7.1 Model routing matrix

| Call type | Quality needed | Model strategy |
|-----------|----------------|----------------|
| Confirm translate | High — patient/doctor read | `gpt-4o-mini` or configured quality model |
| Near-realtime preview | Medium | Smaller model / lower max_tokens (300) |
| Simplify | Medium | Same as translate |
| Whisper PTT | High | `whisper-1` |
| Whisper partial | Low | Skip partials on free tier; or 2 partials max |
| TTS full turn | High | Default voice |
| TTS preview | Medium | Shorter max chars (600) + cache |

### 7.2 Repeated work prevention

| Pattern | Mitigation |
|---------|------------|
| Re-translate same text | Server: hash `(userId, normalizedLen, langPair, contentHash)` — store hash only, not text |
| Re-TTS | Client cache (existing) + server idempotency on identical hash within 60s |
| Re-partial same audio window | Stream service: skip if byte delta < threshold |
| Duplicate cloud sync | Client sync debounce (existing `interpreterCloudSync`) |

### 7.3 Batching opportunities

- **Not** batching translate across users (privacy).  
- Optional nightly **rollup** of `UsageEvent` → `UsagePeriod` (batch job).  
- Export generation async (already pattern in `exportJobService`).

### 7.4 When no AI call should occur

- Empty audio / below `INTERPRETER_MIN_AUDIO_BYTES`  
- Translate below `NEAR_REALTIME_MIN_CHUNK_CHARS`  
- Validation failure in `interpreterInputSafety`  
- Module disabled / quota hard exceeded  
- User in local-only mode (client should not call — server still enforces)

### 7.5 Regional provider fallback

*Needs repo verification:* EU data residency requirements for OpenAI routing. Plan abstraction:

```text
AiProviderRouter.select({ region, usageType }) → provider + model
```

Log provider id in `UsageEvent.metadata` — not content.

---

## Section 8 — Observability & financial monitoring

### 8.1 Metrics (no medical content)

| Metric | Labels | Storage |
|--------|--------|---------|
| `interpreter_ai_requests_total` | route, result, owner_type | Prometheus |
| `interpreter_ai_units_consumed` | usage_type, owner_type | Prometheus + UsagePeriod |
| `interpreter_estimated_cost_micros` | usage_type | Internal only |
| `interpreter_quota_soft_exceeded_total` | owner_type | Counter |
| `interpreter_quota_hard_exceeded_total` | owner_type | Counter |
| `interpreter_stream_duration_seconds` | — | Histogram |
| `interpreter_stream_partial_runs` | — | Histogram |
| `interpreter_realtime_denied_total` | reason | Counter |
| `interpreter_cloud_storage_bytes` | — | Gauge per user/org |
| `interpreter_export_jobs_total` | actor_type | Counter |
| `interpreter_language_pair_usage` | source_lang, target_lang | Counter — **no text** |

### 8.2 Dashboards

| Audience | Panels |
|----------|--------|
| Ops | Cost per hour, 429 rate, stream abuse, OpenAI 5xx |
| Finance | AI units by org, margin estimate, pilot vs prod |
| Practice admin | Usage vs quota (metadata); no patient names in cost views |
| Org admin | Pooled burn-down; practice breakdown |

### 8.3 Forbidden in financial telemetry

Transcript, translation, simplified text, audio, prompts, patient message bodies, export file contents.

### 8.4 Interpreter analytics integration

Add allowlisted events to `ANALYTICS_EVENT_TYPES` (Phase 6.4.2):

- `interpreter_quota_warning`  
- `interpreter_quota_exceeded`  
- `interpreter_stream_started`  

Metadata: counts and ids only — mirror `analyticsService` sanitizer.

---

## Section 9 — Enterprise billing UX (future)

### 9.1 Surfaces

| Surface | Content |
|---------|---------|
| **Quota indicator** | Progress bar: “Monthly communication assistance usage” — not “AI credits” gamification |
| **Usage dashboard** | Breakdown by transcribe/translate/TTS/realtime — numbers only |
| **Billing overview** | Plan name, period end, seats, invoice download (6.4.5+) |
| **Seat management** | Active members vs purchased seats |
| **Warnings** | 80% banner; email opt-in |
| **Realtime visibility** | Stream minutes used / limit; link to PTT fallback help |

### 9.2 UX principles

- Calm, professional, non-manipulative  
- No countdown pressure during clinical conversation  
- Accessible: progress `role="progressbar"`, `aria-valuenow`  
- DE/EN; no urgency colours implying medical emergency  
- Clear: **local-only still works** when quota exceeded  

### 9.3 Role visibility

| Role | Sees |
|------|------|
| `org.billing` | Org usage + invoices |
| `interpreter.admin` | Practice usage + quota config read |
| `org_admin` | Org + per-practice breakdown |
| Clinician | Optional personal usage — *policy: off by default* |
| Patient | Own usage only (B2C) |

---

## Section 10 — Security & abuse risks

| Threat | Mitigation |
|--------|------------|
| **Token drain** | Per-user + per-org quotas; per-route rate limits; idempotency keys |
| **Streaming abuse** | Stream caps + realtime SKU + idle close + IP limits |
| **Invite abuse** | Existing `maxUses`, TTL, ipHash — not billable |
| **Quota bypass** | Enforce in service layer, not only UI; JWT userId only |
| **Org misuse** | Org pool requires `organizationId` on events; practice cannot bill to sibling site |
| **Export abuse** | Export job quota + consent gate (6.3) |
| **TTS spam** | Char caps + repeat hash throttle + speak rate limit |
| **Realtime spam** | Near-realtime rate limit + debounce + smaller chunks |
| **Horizontal scale bypass** | Move counters to Redis in 6.4.3 *needs repo verification* Redis availability |

---

## Section 11 — Privacy & compliance

| Rule | Implementation |
|------|----------------|
| No transcript in metering | `UsageEvent` allowlist metadata only |
| Billing ≠ clinical record | Finance tables have no `payloadEnc` |
| Separate telemetry | `UsageEvent` distinct from `AuditLog`; both sanitized |
| GDPR | Usage data = personal data (userId) — include in export/delete; aggregate for org without patient names in finance views |
| Patient delete | Cascade or anonymize `UsageEvent` where `actorUserId` / `ownerId` = user |
| MDR boundary | Quota system is administrative — not SaMD |

---

## Section 12 — International billing considerations

| Topic | Plan |
|-------|------|
| **Regional pricing** | `BillingPlan.region` + list prices EUR/CHF/GBP |
| **VAT** | `taxId` on `BillingAccount`; Stripe Tax *6.4.5* |
| **Enterprise contracts** | Manual `SubscriptionContract` with custom `includedAiUnits` |
| **Nonprofit/clinic discounts** | `planCode=pilot_nonprofit` override — not public self-serve |
| **Pilot pricing** | Flat fee + capped AI units; no auto-overage |
| **Currency** | Bill in org country currency; single Stripe account *needs repo verification* |
| **B2C App Store** | Regional store pricing — server quotas may not mirror store without sync |

---

## Section 13 — Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Cost explosion** | High | Realtime SKU; hard caps; ops alerts |
| **Underpricing** | Medium | AI unit weights review quarterly; pilot telemetry |
| **Enterprise complexity** | Medium | Pooled org meter + practice sub-allocations |
| **Quota confusion** | High | Plain language; local-only fallback messaging |
| **Realtime unpredictability** | High | Separate meter; conservative defaults |
| **Billing/privacy conflict** | Critical | No content in UsageEvent; DPIA cross-ref 6.3 |
| **Support burden** | Medium | Grace once/period; admin override audit |
| **Multi-instance rate limits** | Medium | Redis in 6.4.3 |
| **App Store vs server mismatch** | Medium | Document dual source of truth until sync |

---

## Section 14 — Implementation roadmap (6.4.1–6.4.7)

**Do not implement until explicit request.** Depends on Phase 6.3.2 audit writer for quota events.

### 6.4.1 — Quota tracking foundation

- `UsageEvent` + `UsagePeriod` tables  
- `recordUsage()` service called from interpreter services (post-success only)  
- Normalize units (seconds, chars)  
- No enforcement yet — shadow mode metrics  
- **Exit:** Dashboards show shadow usage vs rate limits

### 6.4.2 — Realtime usage metering

- Meters: `stream_transcribe_seconds`, `near_realtime_translate_chars`, `stream_tts_chars`, `stream_partial_runs`  
- Wire stream/near-realtime/TTS routes  
- Analytics allowlist events  
- **Exit:** Realtime cost visible per user in internal dashboard

### 6.4.3 — Quota enforcement layer

- `UsageQuota` materialization from plan defaults  
- Middleware `requireInterpreterQuota(usageType)` after auth  
- Soft/hard responses + headers  
- Redis counters for rate limit + quota (*if infra available*)  
- **Exit:** Hard block server AI at limit; PTT local path documented in UX

### 6.4.4 — Organization billing linkage

- Requires Phase 6.2 `Organization` + `BillingAccount`  
- Org pool + practice sub-quotas  
- `org.billing` permission read APIs  
- Pilot contract overrides  
- **Exit:** MVZ pilot has one billable pool, two practice caps

### 6.4.5 — Stripe / payment integration (**explicitly gated**)

- **Only when business + Verlag rules approve**  
- `stripeCustomerId`, Checkout/Invoice, webhooks → `SubscriptionContract`  
- No hidden charges; invoice line items = AI units + seats + realtime addon  
- **Exit:** Paid org activates quotas automatically

### 6.4.6 — Enterprise billing dashboard

- Practice + org usage UI (§9)  
- Invoice list (Stripe portal link)  
- Seat vs usage views  
- **Exit:** Admin self-serve visibility; no patient transcript

### 6.4.7 — Operational hardening

- Cost anomaly alerts (spike > 3× baseline)  
- Quota reconciliation job (events vs period)  
- Runbook: abuse lockout, grace, pilot override  
- Load test stream at quota boundary  
- **Exit:** Finance sign-off for GA billing

### Dependency diagram

```text
6.3.2 audit ──► 6.4.1 ──► 6.4.2 ──► 6.4.3
                    │
6.2 org schema ─────┴──► 6.4.4 ──► 6.4.6
                              │
                         6.4.5 (Stripe — business approval)
                              │
                         6.4.7
```

---

## Section 15 — What must NOT be implemented yet

| Forbidden | Reason |
|-----------|--------|
| **Stripe SDK / webhooks / Checkout** | Phase 6.4.5 + explicit business approval |
| **Hidden billing** | Trust / regulatory |
| **Surprise usage charging** | Dark pattern; requires informed quota UX |
| **Transcript-based monetization** | Privacy + ethics |
| **Medical-content monetization** | MDR / trust boundary |
| **Diagnosis / urgency upsells** | Clinical boundary |
| **Aggressive realtime monetization** | Accessibility; flags stay off |
| **Blocking local-only when quota hit** | Accessibility guarantee |
| **Storing content in UsageEvent** | GDPR / design |
| **Auto-overage charge without contract** | Enterprise trust |
| **Payment in interpreter invite flow** | Conversion ethics |

---

## Appendix A — Proposed API routes (planning only)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/interpreter/usage/me` | Patient usage summary |
| GET | `/api/interpreter/usage/practice` | Practice burn-down |
| GET | `/api/interpreter/usage/org` | Org pool |
| GET | `/api/billing/account` | Billing account metadata (6.4.4+) |
| GET | `/api/billing/invoices` | Invoice list (6.4.5+) |
| POST | `/api/internal/quota/override` | Admin pilot override — audited |

Existing interpreter routes unchanged until 6.4.3 enforcement flag enabled.

---

## Appendix B — Enforcement response contract (planning)

```json
{
  "ok": false,
  "error": "quota_exceeded",
  "code": "interpreter_quota_hard",
  "usageType": "translate_chars",
  "limit": 500000,
  "used": 501204,
  "resetsAt": "2026-06-01T00:00:00.000Z",
  "fallback": "local_only",
  "message": "Monthly communication assistance limit reached. You can still use local recording on this device."
}
```

No transcript echoed. Soft warning via response header:

`X-Interpreter-Quota-State: soft`

---

## Appendix C — BillingPlan catalog (example SKUs)

| planCode | Audience | Included AI units/mo | Seats | Realtime |
|----------|----------|----------------------|-------|----------|
| `interpreter_b2c_free` | Patient | Low (e.g. 60 min transcribe equiv) | — | No |
| `interpreter_b2c_plus` | Patient | Higher | — | Optional add-on |
| `interpreter_practice_starter` | Practice | Medium pool | 5 | No |
| `interpreter_practice_pro` | Practice | Large pool | 15 | Optional |
| `interpreter_org_enterprise` | Organization | Pooled XL | 50+ | Contract |
| `interpreter_realtime_addon` | Add-on | +stream minutes | — | Yes |

*Numbers are placeholders for pilot negotiation — not product commitment.*

---

## Appendix D — Open questions (*needs repo verification*)

1. Redis or other shared store already deployed for rate limiting at scale?  
2. App Store subscription entitlements synced to server for B2C quota?  
3. OpenAI usage/cost API polled for reconciliation vs estimated weights?  
4. Whether practice-initiated sessions bill to practice pool or patient pool when patient is logged in on invite.  
5. Tax entity / Stripe account jurisdiction (DE GmbH vs CH).  
6. Existing `exportJobService` pricing for interpreter export jobs.  
7. Finance team definition of “AI unit” weights for margin targets.

---

*Document version: Phase 6.4 planning — no code changes, no migrations, no Stripe, no implementation. Do not proceed to Phase 6.5 without a separate implementation request.*
