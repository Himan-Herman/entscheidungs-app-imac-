# Medical Interpreter — Phase 6.1 Ecosystem & Scale Architecture (Planning Only)

**Status:** Planning document. No implementation in Phase 6.1.  
**Audience:** Product, engineering, compliance, and pilot stakeholders.  
**Scope:** Long-term growth from a strong B2C/B2B module (Phases 1–5) toward scalable healthcare **communication** infrastructure — not clinical decision support.

---

## Executive summary

After Phases 1–5, Medical Interpreter is a **flag-gated**, **consent-aware**, **communication-only** module: local-first B2C sessions, optional encrypted cloud backup, a B2B practice foundation (invites, RBAC placeholders, no transcript access to practices yet), and an experimental realtime layer (PTT default; streaming STT / near-realtime translate / streaming TTS off by default).

Phase 6.1 defines how to scale **organizations, compliance, operations, and international rollout** without crossing into diagnosis, triage, treatment, or medical-device territory. Implementation is deferred to Phase 6.2+ subphases.

---

## 1. Current system status after Phase 1–5

### 1.1 B2C interpreter (patient)

| Capability | Implementation (verified in repo) | Default |
|------------|-----------------------------------|---------|
| Session setup | Languages, speaker roles, privacy gate | Flag: `MEDICAL_INTERPRETER_ENABLED` |
| Local sessions | `interpreterSessionStore` → localStorage per user; no audio persisted | On when module on |
| Push-to-talk | `useInterpreterRecorder` → `POST /api/interpreter/transcribe` (Whisper, memory-only audio) | **Primary safe path** |
| Translate | `POST /api/interpreter/translate` — single utterance, confirm-before-save | On |
| Simplify | `POST /api/interpreter/simplify` — language simplification only | On |
| TTS | `POST /api/interpreter/speak` — verbatim TTS, no LLM rewrite | On if `INTERPRETER_TTS_ENABLED` |
| Review / PDF | Client-side session review and PDF export | On |
| Draft guard | Block navigation with pending draft; flush on leave | On |

**Safety:** Prompts and validators in `interpreterPrompt.js`, `interpreterInputSafety.js`, `aiSafetySanitizer` — no session history sent to translate/simplify; no clinical routing fields.

### 1.2 Cloud sessions (optional B2C)

| Item | Detail |
|------|--------|
| Flags | `INTERPRETER_CLOUD_ENABLED`, `INTERPRETER_CLOUD_MASTER_KEY` |
| Storage | Encrypted payloads (AES-256-GCM); text turns only — **no audio** |
| Consent | Account preference + per-write `cloudStorageConsent` |
| API | `/api/interpreter/cloud/*` — separate routes, audit whitelist (no transcript in logs) |
| B2B isolation | Practice routes do **not** read `InterpreterCloudSession` (documented) |

*Needs repo verification:* production key rotation, backup/DR for cloud DB, and data residency region pinning.

### 1.3 B2B foundation

| Item | Detail |
|------|--------|
| Flag | `MEDICAL_INTERPRETER_B2B_ENABLED` (default off) |
| Routes | `/api/interpreter/practice/*` — status, profile, sessions placeholders |
| RBAC | `interpreter.view`, `interpreter.manage`, `interpreter.admin` in `practicePermissions.js` |
| Invites | `PracticeInterpreterInvite` + hashed tokens; create/list/revoke (practice-authenticated) |
| Patient join | Public `GET /api/interpreter/invite/:token/status`; landing `/i/interpreter/:token` |
| Invite context | sessionStorage metadata only — **no raw token** stored client-side |
| Practice access to content | **Not implemented** — explicit consent required in later phases (stated in route comments) |

### 1.4 Invite / QR flow

- Practice creates invite → one-time plain token shown → token stored as hash server-side.
- Patient scans QR / opens link → validates invite → optional login redirect → `inviteContext` on session metadata (practice display name, not clinical data).
- **No automatic transcript sharing with practice** in current code.

### 1.5 Realtime layer (Phase 5.2–5.5, all experimental)

| Layer | Endpoint / behaviour | Flags (all default **off**) |
|-------|------------------------|----------------------------|
| 5.2 Enhanced PTT | Phase model, silence heuristic, mutex with translate/TTS | (core, not separate flag) |
| 5.3 Streaming STT | Chunked upload → in-memory assembly → Whisper; no audio persistence | `MEDICAL_INTERPRETER_STREAMING_STT_ENABLED` |
| 5.4 Near-realtime translate | Stateless preview translate; debounced; not saved until user confirms draft | `MEDICAL_INTERPRETER_NEAR_REALTIME_TRANSLATION_ENABLED` |
| 5.5 Streaming TTS | `/api/interpreter/stream/speak`; opt-in preview playback; in-memory cache | `MEDICAL_INTERPRETER_STREAMING_TTS_ENABLED` |

**Default safe mode:** PTT + manual confirm + standard translate remains the production recommendation (`PHASE_5_6_REALTIME_QA.md`).

### 1.6 Safety boundaries (enforced today)

- Module scope comments on all major route files.
- AI: communication-style system prompts; forbidden clinical inference in translate/simplify prompts.
- Input: prompt-injection patterns, max lengths, speaker/language validation.
- Output: `sanitizeAiOutput`, terminology/uncertainty handling, blocked unsafe medical content.
- Logging: structured events without transcript/audio (stream/near-realtime/cloud audit patterns).

### 1.7 Technical baseline

- **Auth:** `/api/interpreter/*` behind `requireAuth` (except public invite status). *Needs repo verification:* exact middleware chain in `app.js` for all mounts.
- **Rate limits:** IP-based limiters per route family (`interpreterRateLimit.js`).
- **No WebSocket** for interpreter realtime — chunked HTTP only (Phase 5.3 decision).
- **Feature flags:** Server + client Vite mirrors for experimental paths.

---

## 2. Long-term ecosystem targets

Medical Interpreter should remain **communication infrastructure** for settings where language barriers block understanding — not a clinical copilot.

| Segment | Role of interpreter | Relationship to product |
|---------|---------------------|-------------------------|
| **Single practices** | Front desk, nurse, GP conversation support | B2B pilot entry; invite + org account |
| **Clinics / MVZ** | Multi-room, multi-language patient mix | Multi-practice org, central admin, usage quotas |
| **Pharmacies** | Medication **name** clarification, appointment logistics — not dosing advice | Strict copy boundaries; possibly simplified UI mode |
| **Rehab / care facilities** | Care team ↔ patient ↔ family communication | Longer sessions; export to care documentation systems |
| **International patients** | Tourist, expat, asylum-health orientation | Language packs, RTL, offline-first option |
| **Insurance-adjacent** | Appointment, form, general benefit **communication** — not coverage decisions | API/handoff only; no claims/triage logic |

**Positioning:** “Helps people understand each other in healthcare conversations” — never “helps decide what care you need.”

---

## 3. Product boundaries

### 3.1 What Medical Interpreter does

| Function | User value |
|----------|------------|
| **Transcribe** | Speech → text for review (patient/clinician utterances) |
| **Translate** | Neutral utterance-level translation with uncertainty preserved |
| **Simplify language** | Plain-language rewrite without adding medical facts |
| **Document communication** | Local and optional cloud conversation log for the **user’s** reference |
| **Multilingual understanding** | Direction labels, mixed RTL/LTR caution, terminology warnings |

### 3.2 What it must still never do

| Forbidden | Why |
|-----------|-----|
| Diagnose | MDR / SaMD risk; outside communication scope |
| Triage / urgency classification | Could drive emergency behaviour incorrectly |
| Treatment recommendation | Clinical decision support |
| Medication advice (dose, start/stop, alternatives) | Pharmacy/clinical boundary |
| Specialist recommendation | Care routing = clinical pathway |
| Symptom interpretation (“you might have X”) | Diagnostic inference |
| Hidden sharing with practices | GDPR + trust; requires explicit consent architecture |
| Autonomous always-listening agent | Privacy + safety; user must control mic and saves |

These boundaries must appear in **prompts, validators, UI copy, B2B contracts, and audit policies** — not only in planning docs.

---

## 4. Enterprise architecture proposal

### 4.1 Organization model (target)

```
Organization (clinic group, MVZ, chain)
 └── Legal entity / billing account
      └── Practice site(s)  [existing Practice model — needs repo verification of multi-tenant joins]
           └── Staff users (roles)
           └── Interpreter policy (retention, quotas, allowed languages)
           └── Invite campaigns (QR, link, expiry)
           └── Audit stream (metadata only)
```

**Principles:**

- B2C patient accounts remain **separate** from practice staff accounts.
- Practice never inherits patient sessions by default.
- Organization admin manages practices and policies; practice admin manages invites and staff.

### 4.2 Multi-practice support

- Map existing `Practice` records under `OrganizationId` (new table — Phase 6.2).
- Practice-scoped queries already use `practiceId` in B2B routes — extend consistently.
- Cross-practice reporting at org level: **aggregated usage counts only**, not transcript content.

### 4.3 Role-based access (extend current RBAC)

| Role | Capabilities (communication ops only) |
|------|----------------------------------------|
| `interpreter.view` | Dashboard, invite status aggregates, policy read |
| `interpreter.manage` | Create/revoke invites, export comms reports (metadata) |
| `interpreter.admin` | Retention policy, language allowlist, quota overrides |
| Org super-admin | *New* — billing, DPA status, sub-practice provisioning |

*Needs repo verification:* alignment with existing `practicePermissions.js` and staff invitation flows.

### 4.4 Audit logs

- Extend `interpreterCloudAudit` pattern to B2B: event type, actorId, practiceId, inviteId, outcome — **no transcript**.
- Immutable append-only store (table or external SIEM).
- Retention: configurable per org (e.g. 90d metadata, 0d content).

### 4.5 Consent records

| Consent type | Subject | Purpose |
|--------------|---------|---------|
| Cloud storage | Patient | Optional encrypted backup |
| Practice access to session | Patient | Explicit share of **specific** session or export |
| B2B staff terms | Staff | Role and acceptable use |
| Recording in facility | Patient | *Operational* — facility responsibility; product provides controls only |

Consent artifacts: versioned text id, timestamp, channel, revocable — stored server-side with userId / sessionId reference.

### 4.6 Data retention policies

| Data class | B2C default | Enterprise option |
|------------|-------------|-------------------|
| Local device sessions | User-controlled delete | N/A |
| Cloud encrypted sessions | User delete + revoke | Org max TTL (e.g. 30/90/365d) |
| Invite metadata | Practice retention policy | Auto-expire + audit |
| AI processing | Ephemeral (current) | No change — no training store |
| Audit metadata | 90d | 1–7y per contract |

### 4.7 Secure exports

- Patient-initiated PDF (exists) → extend to encrypted ZIP for practice handoff **after consent**.
- Practice export: **metadata only** until consent path exists (invite counts, language pairs, session counts).
- Watermarked “Communication log — not a medical record” on all exports.

### 4.8 Usage quotas

| Quota dimension | B2C | B2B |
|-----------------|-----|-----|
| Translate requests / day | Soft per user | Per practice + burst |
| Transcribe minutes / month | Soft per user | Pooled org |
| TTS characters | Low default | Optional add-on |
| Invites active | N/A | Per practice cap |
| Cloud storage MB | Per user | Per org |

Enforcement: middleware + Redis counters (Phase 6.4) — not in repo today (*needs repo verification* for existing quota infra elsewhere in MedScoutX).

### 4.9 Billing readiness

- **Metering events:** `interpreter.translate.completed`, `interpreter.transcribe.second`, `interpreter.tts.char`, `interpreter.invite.created` — metadata only.
- **Billing account** linked to Organization; Stripe or invoice (*needs repo verification* of existing Stripe integration scope — Verlag rules say no payment unless requested).
- Idempotent usage records for reconciliation.

---

## 5. Integration possibilities (no clinical decision integration)

| Pattern | Use case | Safety |
|---------|----------|--------|
| **PDF handoff** | Patient exports conversation log for appointment | User-initiated; watermark |
| **Secure link handoff** | Time-limited read-only link to one session | Consent + expiry + no index |
| **API handoff (outbound)** | Practice PMS receives structured comms log | Schema without ICD/SNOMED inference |
| **API handoff (inbound)** | Appointment context: language pair, room — **no clinical summary** | Validate forbidden fields |
| **Practice software export** | CSV/JSON bundle for archival | Metadata or consented content only |
| **Webhook** | `session.exported` event | Signed; no transcript in webhook by default |

**Explicitly not in scope for 6.x:** HL7 FHIR diagnostic resources, triage scores, medication orders, referral prioritization.

---

## 6. Compliance architecture

### 6.1 GDPR

| Requirement | Architecture response |
|-------------|----------------------|
| Lawful basis | Consent for cloud + practice sharing; contract for B2B staff |
| Data minimization | Utterance-level only; no audio retention server-side |
| Purpose limitation | Communication documentation only |
| Storage limitation | Retention policies + auto-delete jobs |
| Rights (access/delete) | Patient data control UI + server erase |
| DPIA | Required before enterprise pilot — document AI subprocessors |
| DPA | Org-level with OpenAI/Azure if used — subprocessor list |

### 6.2 Consent architecture

- Versioned consent strings (DE/EN minimum).
- Separate toggles: cloud, practice share, optional analytics.
- Withdrawal propagates: revoke cloud, invalidate handoff links, audit `consent.revoked`.

### 6.3 Retention & deletion

- Hard delete encrypted payloads + keys invalidated.
- Local storage: user “clear all on device” (exists).
- Org offboarding: cascade delete practice invites + audit after cooling period.

### 6.4 Export

- Machine-readable export for user (JSON) — *needs repo verification* if already partial in data control.
- No silent export to practice.

### 6.5 Audit-safe logs

- Whitelist keys only (existing cloud audit pattern).
- No PII in info logs; requestId correlation.
- Separate security audit (login, RBAC deny) from product audit.

### 6.6 Medical device (MDR) risk boundary

| Risk | Mitigation |
|------|------------|
| SaMD classification | Stay communication-only; legal review before urgency/diagnosis features |
| Clinical decision support | Block in prompts, UI, API schemas, B2B marketing |
| CE marking | Not targeted for Phase 6 — wellness/communication positioning with counsel |

**Rule:** Any feature that could influence **which care** the user seeks requires explicit regulatory review and is **out of 6.x** unless counsel approves.

---

## 7. Technical scale needs

### 7.1 Queueing

| Workload | Today | Target |
|----------|-------|--------|
| Transcribe (PTT) | Sync HTTP | Optional queue for >30s audio (BullMQ/SQS) |
| Translate | Sync | Queue under load; priority tiers |
| Streaming chunks | In-memory per instance | Sticky sessions or Redis stream state |
| TTS | Sync binary response | Queue + object storage temp URL (short TTL) |

*Needs repo verification:* existing job queue in monorepo.

### 7.2 Rate limits & quotas

- Keep IP limits for abuse; add **userId + practiceId** limits for fairness.
- Enterprise burst allowances via org policy.

### 7.3 Observability (no medical text)

| Signal | Allowed |
|--------|---------|
| Latency p50/p95 per endpoint | Yes |
| Error rate by code | Yes |
| Flag state, quota exceeded | Yes |
| Token usage $ estimate | Yes |
| Transcript snippets | **No** |

Tools: OpenTelemetry traces, metrics (Prometheus), Sentry for errors — scrub bodies.

### 7.4 Cost controls

- Model routing: Whisper small vs large by policy; translate model pinned; TTS caching at CDN edge forbidden for medical text — server in-memory only (current).
- Per-org budget caps with graceful degrade (“translation temporarily limited”).
- Realtime features remain **off** in default SKU.

### 7.5 Model fallback strategy

1. Primary: configured OpenAI models (current).
2. Degrade: shorter max input, disable simplify, TTS off.
3. Fail safe: return typed error; preserve draft locally.

*Needs repo verification:* Azure Speech path in repo (unused by interpreter today per Phase 5.1 notes).

### 7.6 Regional deployment

- EU data residency for DB + AI calls (EU endpoints).
- Config per region: `INTERPRETER_AI_REGION=eu`.
- Future: CH/UK tenants — separate keys and DPA.

---

## 8. International expansion

### 8.1 Language rollout strategy

| Tier | Languages | Approach |
|------|-----------|----------|
| Tier 1 | DE, EN, TR, AR, RU, UK, PL | Already in setup lists — verify completeness |
| Tier 2 | FR, ES, IT, RO, FA, SR | Glossary + QA pass |
| Tier 3 | Low-resource | Pilot with human review flag |

Rollout per **org allowlist**, not global enable.

### 8.2 RTL strategy

- UI: `dir="auto"` on transcript/translation (partially done).
- Mixed-direction session warning (exists in B2C).
- PDF export RTL layout — *needs repo verification*.

### 8.3 Terminology QA

- Protected anchors for numbers, meds, negation (server `interpreterTerminology.js`).
- Per-language glossary tables (non-diagnostic: appointment, referral letter, consent).
- Low-confidence UI always visible before confirm.

### 8.4 Human review (later)

- Optional “request human review” for enterprise — exports queue to staffed linguist portal — **not Phase 6.2**; separate product surface.

### 8.5 Culturally safe UX

- No idiomatic medical metaphors in simplify.
- Neutral illustrations; no urgency colour language (red = emergency).
- Invite copy localized; practice name only, no clinical claims.

---

## 9. Monetization models

| Model | Segment | Fits architecture |
|-------|---------|-------------------|
| **B2C subscription** | Patients | Freemium local + cloud premium |
| **Pay-per-session** | Occasional users | Meter translate/transcribe packs |
| **Practice subscription** | Single practice | Invites + admin + quota tier |
| **Clinic license** | Org / MVZ | Multi-practice + pooled usage |
| **Usage-based B2B** | High volume | Overage on translate minutes |
| **Pilot package** | 3-month capped | Fixed fee + telemetry dashboard |

**Billing readiness (6.4)** without implementing payment UI in MedScoutX core unless explicitly approved (Verlag rule).

---

## 10. Implementation roadmap — Phase 6.2+

### Phase 6.2 — Organization / practice account model (**planning complete**)

See [PHASE_6_2_ORG_ARCHITECTURE_PLAN.md](./PHASE_6_2_ORG_ARCHITECTURE_PLAN.md).

Implementation deferred to Phase 6.3a–6.3g sub-steps (schema, middleware, consent, audit, permissions).

### Phase 6.3 — Enterprise consent, audit, retention & compliance (**planning complete**)

See [PHASE_6_3_ENTERPRISE_COMPLIANCE_PLAN.md](./PHASE_6_3_ENTERPRISE_COMPLIANCE_PLAN.md).

Implementation subphases: 6.3.1 (consent foundation) through 6.3.7 (operational hardening). Deferred items in §15 of that document.

**Exit criteria (summary):** DPIA-ready consent trail; deny-by-default tests; metadata-only audit; retention jobs defined.

### Phase 6.4 — Usage quotas and billing readiness (**planning complete**)

See [PHASE_6_4_BILLING_QUOTA_PLAN.md](./PHASE_6_4_BILLING_QUOTA_PLAN.md).

Implementation subphases: 6.4.1 (tracking) through 6.4.7 (hardening); Stripe in **6.4.5 only** with explicit business approval.

**Exit criteria (summary):** Shadow then enforced quotas; realtime metered; org billing linkage; no payment SDK until 6.4.5.

### Phase 6.5 — Observability and operational monitoring (**planning complete**)

See [PHASE_6_5_OBSERVABILITY_OPS_PLAN.md](./PHASE_6_5_OBSERVABILITY_OPS_PLAN.md).

Implementation subphases: 6.5.1 (structured logging) through 6.5.7 (multi-region hardening).

**Exit criteria (summary):** Safe logs/traces, realtime ops metrics, incident runbooks, privacy-first analytics, enterprise ops dashboard.
### Phase 6.6 — International rollout architecture (**planning complete**)

See [PHASE_6_6_INTERNATIONAL_ROLLOUT_PLAN.md](./PHASE_6_6_INTERNATIONAL_ROLLOUT_PLAN.md).

Implementation subphases: 6.6.1 (RTL hardening) through 6.6.7 (international ops).

**Exit criteria (summary):** Tier-1 UI bundles, RTL/a11y QA, glossary governance, org language allowlist, capability registry.

### Phase 6.7 — Enterprise pilot package

- 3–5 pilot MVZ/practices; signed DPA; feature bundle flags.
- Secure export + invite analytics dashboard (metadata).
- Human support playbook — communication boundaries.
- **Exit criteria:** Pilot exit report; no MDR incidents; NPS on clarity not diagnosis.

**Dependency graph:**

```
6.2 org model → 6.3 consent/audit → 6.4 quotas/billing
                    ↓
              6.5 observability (parallel after 6.2)
                    ↓
              6.6 i18n (parallel)
                    ↓
              6.7 pilot (last)
```

**Realtime (Phase 5):** Remains experimental until pilot demands; production SKU keeps PTT default. WebSocket/bidirectional voice = **post–6.7** research spike, not 6.2–6.7.

---

## 11. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **MDR boundary drift** | Critical | Product council + prompt/schema CI checks; legal review gate |
| **Privacy leak to practice** | Critical | Deny-by-default data layer; integration tests |
| **Enterprise security** | High | SSO (*needs repo verification*), pen test, RBAC audits |
| **Translation quality** | High | Uncertainty UX; human review option; glossary |
| **Cost explosion** | High | Quotas, realtime off by default, model caps |
| **Workflow complexity** | Medium | Phased UX; pilot before GA enterprise |
| **AI subprocessor outage** | Medium | Fallback messages; local draft preserved |
| **Invite token enumeration** | Medium | Rate limits (exists); short TTL |
| **Insurer overreach** | Medium | Contractual use-case limits |

---

## 12. What should NOT be implemented yet (Phase 6.2–6.7)

| Item | Reason to defer |
|------|----------------|
| Diagnosis / triage / treatment / urgency / specialist features | Regulatory and trust |
| Practice access to live transcripts without consent | GDPR |
| Always-listening / full duplex voice | Phase 5 explicitly deferred |
| WebSocket realtime production path | Ops complexity; HTTP chunk path sufficient for pilots |
| Clinical PMS deep integration (FHIR diagnostic) | Scope creep |
| Insurer automated eligibility or claims | Not communication |
| Global public launch of streaming realtime | Cost + safety; flags stay off |
| Training custom medical LLM on user data | Privacy + MDR |
| Replacing human interpreters in regulated settings | Liability positioning |
| Auto-sharing invite context to practice dashboards beyond metadata | Needs 6.3 consent |
| Multi-region active-active | Until EU pilot stable |

---

## Appendix A — Feature flag inventory (reference)

| Flag | Phase | Default |
|------|-------|---------|
| `MEDICAL_INTERPRETER_ENABLED` | 1+ | off |
| `INTERPRETER_TTS_ENABLED` | 2 | on when module on |
| `INTERPRETER_CLOUD_ENABLED` | 3 | off |
| `MEDICAL_INTERPRETER_B2B_ENABLED` | 4 | off |
| `MEDICAL_INTERPRETER_STREAMING_STT_ENABLED` | 5.3 | off |
| `MEDICAL_INTERPRETER_NEAR_REALTIME_TRANSLATION_ENABLED` | 5.4 | off |
| `MEDICAL_INTERPRETER_STREAMING_TTS_ENABLED` | 5.5 | off |

Client Vite mirrors exist for B2C/B2B and experimental paths (*needs repo verification* for full env template in deployment docs).

---

## Appendix B — Suggested success metrics (pilot / scale)

| Metric | Type |
|--------|------|
| Sessions completed without error | Reliability |
| % turns with user confirm before translate | Safety UX |
| Low-confidence rate | Quality |
| Translate cost per session | Cost |
| Invite → patient activation rate | B2B funnel |
| Consent grant/revoke counts | Privacy |
| Support tickets alleging wrong medical advice | **Must → 0** |
| Practice staff accessing patient content without consent | **Must → 0** |

---

## Appendix C — Open questions (*needs repo verification*)

1. Existing `Practice` ↔ user staff model and whether multi-org staff is already supported elsewhere.
2. Central job queue / Redis availability in production infra.
3. Stripe or billing module reuse for B2B metering.
4. SSO (SAML/OIDC) for enterprise practices.
5. Legal entity / Impressum requirements per country for B2B marketing.
6. Whether PreVisit / Symptom modules share AI policy infrastructure for unified compliance CI.
7. Data residency of current production DB and OpenAI tenant region.

---

*Document version: Phase 6.1 planning — no code changes. Do not implement Phase 6.2 from this chat without a separate implementation request.*
