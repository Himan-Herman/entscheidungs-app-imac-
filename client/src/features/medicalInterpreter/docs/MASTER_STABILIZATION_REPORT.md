# Medical Interpreter — Master Stabilization & Production Hardening Report

**Phase:** Stabilization (not feature expansion)  
**Date:** 2026-05-20  
**Scope:** Phases 1–5 implemented stack + Phase 6 planning foundations

---

## Executive summary

The Medical Interpreter ecosystem is **functionally complete** for B2C patient communication, optional cloud backup, B2B practice invites with consent-based sharing, and flag-gated realtime prototypes. This pass **audited** the full stack, applied **targeted security and reliability fixes**, and validated builds.

**Verdict:** Suitable for **controlled pilot** with flags configured per environment. Enterprise-wide rollout should follow real-world browser QA and operational monitoring (Phase 6.5 planning).

---

## Systems reviewed

| System | Status | Notes |
|--------|--------|-------|
| B2C setup / privacy / live / review | Reviewed | Account-scoped localStorage; draft guard |
| PTT + phase machine | Reviewed + hardened (Phase 5 pass) | `uploading` phase; busy guards |
| Streaming STT / near-realtime / TTS | Reviewed | Chunked prototype; flags default off |
| Cloud sync + export | Reviewed | Encrypted payloads; `req.user.userId` auth path |
| B2B invites + QR | Reviewed | Token hash; public minimal API |
| Practice sharing + session view | Reviewed + **security fix** | Invite context required for `/sharing/consent` |
| RBAC (interpreter.*) | Reviewed | Server-side `practicePermissions.js` |
| Audit logging | Reviewed | Whitelist metadata; global `sanitizeAuditMetadata` |
| Feature flags | Reviewed | All sub-features default **off** |
| i18n DE/EN | Reviewed | Practice + patient + realtime keys present |
| Accessibility patterns | Reviewed | live regions, aria-busy, reduced-motion (streaming) |

Phase 6 items (org billing, retention jobs, full RTL) remain **planning-only** — not blockers for interpreter pilot.

---

## Architecture audit (Section 1)

### Strengths
- Clear **B2C / B2B separation**: different routes, flags, and data paths.
- **Service layer** on server (transcribe, translate, cloud, invites, share).
- **Client feature folder** `medicalInterpreter/` with hooks, API modules, pages.
- **Consent** via `ConsentRecord` types + explicit body flags (`cloudStorageConsent`, `practiceShareConsent`).
- **No `dangerouslySetInnerHTML`** in interpreter UI.

### Observations (not changed — low risk)
- Some **dynamic PrismaClient** instances per service file (acceptable for pilot; consolidate later if scaling).
- Phase 6 planning docs describe future systems not in code — keep docs separate from runbooks.
- `grantPracticeShareConsent` client API exists but UI uses **invite token path only** — server `/sharing/consent` now requires invite context.

### No dead-code removal performed
Avoided broad deletes in stabilization pass; no confirmed unused exports removed.

---

## Security fixes (Section 6)

| Issue | Fix |
|-------|-----|
| **Open practice share by arbitrary `practiceProfileId`** | `resolvePracticeShareContext()` — requires valid **invite token** or **inviteId + practiceId** pair |
| Inactive practice share | `isActivePracticeProfile()` check before grant |
| Cloud audit without user on early middleware | `auditUserId(req)` uses JWT `req.user.userId` |
| Share body validation noise | Strip `inviteToken` / `inviteId` / `practiceProfileId` before session validation |

### Verified existing controls
- Auth on all interpreter routes except public invite status/start.
- Practice routes: `practiceId` query + `requirePracticeInterpreterAccess`.
- Session links: practice can read only `consentStatus=granted` + own `practiceProfileId`.
- Patient revoke: `linkId` scoped to `patientUserId`.
- Invite tokens: SHA-256 at rest; public API no internal IDs.
- Stream/near-realtime/TTS: rate limits, max sizes, no WebSocket (no WS abuse surface).
- Error handlers: JSON only; no `err.stack` in interpreter routes.
- Output safety: `validateTranscriptOutput`, `sanitizeInterpreterOutputText`, prompt-injection checks.

---

## Privacy & consent fixes (Section 5)

| Check | Result |
|-------|--------|
| No prechecked cloud/share consent | Verified — checkboxes default unchecked |
| No silent cloud sync | Cloud writes require `cloudStorageConsent: true` + account preference |
| No practice access without consent | Enforced server-side on `GET practice/sessions/:id` |
| Logout clears cloud sync flags | `runInterpreterLogoutCleanup()` |
| Logout clears invite context | **Added** `clearInterpreterInviteContext` + ephemeral token |
| No transcript in audit | Whitelist + global sensitive key filter |

---

## Realtime fixes (Section 4)

From Phase 5 hardening (included in this stabilization scope):

- PTT `uploading` phase; double-start guards (`recorderBusy`, `startingRef` on stream).
- TTS stops when recording starts.
- Speaker change blocked during transcribe/translate pipeline.
- Stream 120s auto-stop; backpressure at 12 chunks.
- Route leave / tab hide / offline: cancel mic, stream, abort requests, revoke audio URLs.

---

## B2B fixes (Section 3)

- **Consent path:** invite token → `POST /invite/:token/consent` (unchanged, secure).
- **Alternate path:** `POST /sharing/consent` now **requires invite context** (fix).
- Practice session list: metadata only until detail with consent.
- Revoke: patient + practice admin paths audited.

---

## Audit & logging (Section 7)

| Layer | Behaviour |
|-------|-----------|
| `auditLogService` | Strips keys matching transcript, message, symptom, etc. |
| `interpreterCloudAudit` | Whitelist metadata only |
| `interpreterPracticeInviteAudit` | Whitelist metadata only |
| `interpreterPracticeShareAudit` | Whitelist metadata only |
| Route `console.error` | JSON: `event`, `requestId` only |
| Client error boundary | Logs `error.name` only |

**No unsafe transcript logging found** in interpreter server paths.

---

## Accessibility (Section 8)

- PTT: `aria-label`, `aria-describedby`, disabled reason for screen readers.
- Streaming: `aria-live` captions, provisional label, `aria-busy`.
- Near-realtime: unconfirmed preview label, stale state.
- Practice revoke: `role="alertdialog"`.
- `prefers-reduced-motion` on streaming connection indicator.

**Gaps for later:** Full RTL layout pass (Phase 6.6 plan); formal contrast audit not automated.

---

## i18n & RTL (Section 9)

- **DE/EN:** `medicalInterpreter.js`, `medicalInterpreterPractice.js` — primary UI strings.
- **Overrides:** FR/PL/etc. may lag — interpreter hub uses core DE/EN; acceptable for pilot if product language is DE/EN.
- **RTL:** `dir="auto"` on transcript preview lines; full mirror layout not implemented (planned).

---

## Mobile & browser (Section 10)

| Platform | Known behaviour |
|----------|-----------------|
| iOS Safari | Tab background cancels recording/stream (intentional) |
| Android Chrome | Supported for PTT/streaming where MediaRecorder exists |
| Desktop | Primary development target |

---

## Performance & cost (Section 12)

- Near-realtime: 1400ms debounce, 600 char cap, duplicate chunk skip.
- TTS: 8-entry blob cache, 4s repeat throttle.
- Streaming: partial preview capped (5/server session).
- Cloud list: metadata without decrypting all payloads in list endpoint.

---

## Files changed (this stabilization pass)

| File | Change |
|------|--------|
| `server/services/interpreter/interpreterPracticeShareService.js` | `resolvePracticeShareContext`, active practice check, strip meta fields |
| `server/services/interpreter/interpreterPracticeShareRepository.js` | `isActivePracticeProfile` |
| `server/routes/interpreterPatientSharing.js` | Enforce invite context on `/sharing/consent` |
| `server/middleware/interpreterCloudMiddleware.js` | Safer audit userId |
| `client/.../interpreterAccountScope.js` | Logout clears invite context + ephemeral token |
| `client/.../useInterpreterStreamCapture.js` | Double-start guard (`startingRef`) |

Prior Phase 4/5 reports document larger feature implementations.

---

## Checks run (Section 16)

| Check | Result |
|-------|--------|
| `npx prisma validate` | Pass |
| `npm run build` (client) | Pass |
| ESLint `medicalInterpreter/**` | Pass (pre-existing warnings only if any) |

---

## Manual QA checklist (recommended before pilot)

### B2C
- [ ] Full session: setup → PTT → edit draft → translate → review → export PDF
- [ ] Cloud opt-in → sync → revoke → optional delete cloud
- [ ] Logout → cloud flags cleared; local sessions remain

### B2B
- [ ] Create/revoke invite; QR + copy link
- [ ] Patient invite → setup → live → end → **explicit share** checkbox
- [ ] Practice sees session only after share; revoke blocks access

### Realtime (flags on)
- [ ] Rapid PTT; stream start/stop; offline mid-transcribe
- [ ] Tab background releases mic

### Security
- [ ] `POST /sharing/consent` without invite → 403 `invite_context_required`
- [ ] Practice user A cannot open practice B session link

---

## Remaining technical debt

1. **Chunked STT** is not true streaming WebSocket — latency/cost profile differs from native streaming.
2. **No automated E2E** test suite for interpreter flows.
3. **PrismaClient** per service file — connection pool sharing via singleton would be cleaner.
4. **Phase 6** enterprise items: retention jobs, org billing, unified consent dashboard, ops metrics.
5. **Multilingual UI overrides** incomplete outside DE/EN.
6. **Guest patient** on invite still requires login.

---

## Known risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| iOS background mic cancel | Low | Documented; PTT retry |
| OPENAI/provider outage | Medium | Calm errors; PTT draft preserved |
| Mis-shared invite link | Medium | Revoke invite; patient revoke share |
| Encryption key misconfig | High | Fail closed on cloud/share writes |
| Pilot without DE/EN UI | Low | Restrict product language |

---

## Production readiness assessment

| Dimension | Rating | Comment |
|-----------|--------|---------|
| B2C PTT core | **Pilot-ready** | Flags + provider keys required |
| Cloud backup | **Pilot-ready** | `INTERPRETER_CLOUD_MASTER_KEY` required |
| B2B sharing | **Pilot-ready** | B2B flags + migration deployed |
| Realtime flags | **Experimental** | Keep off in production initially |
| Enterprise multi-org | **Not ready** | Phase 6.2+ planning |
| Compliance program | **Partial** | Consent architecture good; retention/legal ops pending |

---

## Pilot readiness

**Ready** for a single-practice or small-clinic pilot when:

1. `MEDICAL_INTERPRETER_ENABLED=true`
2. Optional: `INTERPRETER_CLOUD_*`, `MEDICAL_INTERPRETER_B2B_ENABLED`
3. Encryption key configured
4. Staff trained: communication-only, consent required, verify translations
5. Manual QA checklist completed on target devices

---

## Recommended next real-world testing steps

1. Run **PHASE_5_6_REALTIME_QA.md** on iOS + Android with flags on in staging.
2. Run **RELIABILITY_QA.md** on slow 3G.
3. Legal/privacy review of consent copy (DE/EN).
4. One real practice dry-run: invite → patient visit → share → staff views documentation.
5. Enable production monitoring on 503/rate-limit rates (no content in logs).

---

## Safety boundary confirmation (Section 15)

The ecosystem remains **communication-only**. Realtime and cloud paths use the same translation/STT stacks with explicit safety prompts. No diagnosis, triage, treatment, medication, urgency, specialist, or symptom-interpretation endpoints were introduced in stabilization.

---

*End of master stabilization report. No further automatic implementation beyond this phase.*
