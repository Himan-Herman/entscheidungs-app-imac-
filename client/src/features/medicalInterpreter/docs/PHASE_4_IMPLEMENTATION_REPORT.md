# Medical Interpreter — Phase 4 Implementation Report

**Status:** Implemented (B2B practice/clinic foundation)  
**Date:** 2026-05-20

## Summary

Phase 4 delivers consent-based B2B practice access to interpreter **conversation documentation** only. No diagnosis, triage, treatment, medication, urgency, specialist routing, or audio storage. B2C interpreter flows remain separate and unchanged by default.

---

## Feature flags

| Flag | Default | Behaviour when off |
|------|---------|-------------------|
| `MEDICAL_INTERPRETER_B2B_ENABLED` | off | Practice APIs return **503**; public invite validation returns safe unavailable state |
| `VITE_MEDICAL_INTERPRETER_B2B_ENABLED` | off | Practice UI gated via `InterpreterPracticeFeatureGate` |

B2C requires `MEDICAL_INTERPRETER_ENABLED` (unchanged).

---

## Schema & migration

**Migration:** `server/prisma/migrations/20260520180000_interpreter_practice_sharing/migration.sql`

| Model | Purpose |
|-------|---------|
| `PracticeInterpreterSessionLink` | Links patient + practice + `clientSessionId`; `consentStatus` pending/granted/revoked |
| `PracticeInterpreterSharePayload` | Encrypted conversation documentation (AES-256-GCM, same key namespace as cloud) |

**Consent records:** `ConsentRecord.consentType = interpreter_practice_share` (added to `consentTypes.js`).

Existing models unchanged: `PracticeInterpreterInvite`, `PracticeInterpreterInviteUsage`.

---

## Backend routes

### Practice (auth + `practiceId` query + RBAC)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/interpreter/practice/status` | Includes `canInvite`, `canExport` |
| GET | `/api/interpreter/practice/profile` | Safe practice display + boundaries |
| GET | `/api/interpreter/practice/sessions` | **Granted links only** — metadata, no transcript in list |
| GET | `/api/interpreter/practice/sessions/:id` | Full documentation only if `consentStatus=granted` |
| POST | `/api/interpreter/practice/session-links/:id/revoke` | Practice admin removes shared copy |
| POST/GET/DELETE | `/api/interpreter/practice/invites/*` | Existing invite CRUD (Phase 4.6) |

### Public invite (no auth)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/interpreter/invite/:token/status` | Minimal fields only |
| POST | `/api/interpreter/invite/:token/start` | Records usage; **no session sharing** |

### Patient (auth)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/interpreter/invite/:token/consent` | Requires `practiceShareConsent: true` + session body |
| GET | `/api/interpreter/sharing` | Patient’s active/revoked share links |
| POST | `/api/interpreter/sharing/consent` | Share by `practiceProfileId` |
| POST | `/api/interpreter/sharing/:linkId/revoke` | Patient revoke; optional `deleteSharedCopy` |

---

## Invite system

- Cryptographic token; **SHA-256 hash** at rest; plaintext shown once on create.
- Public status: valid/expired/revoked + practice display name + communication notice only.
- Rate limits: `interpreter:invite:validate`, `interpreter:practice:share`.
- `POST …/start` increments usage; does **not** expose transcripts.

---

## QR / link UX

- Practice invites page: copy link (with screen-reader status), QR via `qrcode` + **text link fallback**.
- Patient landing: `/i/interpreter/:token` — validates, calls start, explains no auto-share.

---

## Patient join & consent flow

1. Scan/open link → validate token.  
2. Continue → interpreter setup (invite context in sessionStorage **without token**).  
3. Token held **in memory only** (`setEphemeralInviteToken`) for consent POST.  
4. After session ends → review page → **optional** share panel with **unchecked** checkbox.  
5. `practiceShareConsent: true` required server-side; encrypted payload stored per link.

---

## Practice session view

- Labels: conversation documentation / communication support — **not** medical record or diagnosis report.
- Verification notice on detail view.
- IDOR protection: `practiceProfileId` + link id + `consentStatus=granted`.

---

## RBAC

| Permission | Roles (summary) |
|------------|-----------------|
| `interpreter.view` | owner, admin, practice_manager, secretary, doctor, assistant, viewer |
| `interpreter.invite` | owner, admin, practice_manager, secretary (+ manage/admin) |
| `interpreter.manage` | owner, admin, practice_manager |
| `interpreter.export` | owner, admin, practice_manager, doctor |
| `interpreter.admin` | owner, admin, practice_manager |

---

## Audit logging

`auditInterpreterPracticeShare` / `auditInterpreterPracticeInvite` → `AuditLog` with whitelist metadata only.

Logged: invite created/revoked/validated/used, consent granted/revoked, practice session viewed, link revoked.  
**Never logged:** transcript text, translations, audio, prompts.

---

## Privacy & security safeguards

- No hidden practice access; no pre-consent transcript API for practices.
- No audio or microphone blobs on server.
- Token hash storage; no internal IDs on public routes.
- Safe 503/403/404 JSON (no stack traces).
- Encryption requires `INTERPRETER_CLOUD_MASTER_KEY` (64 hex) — same as B2C cloud.

---

## B2C isolation

- B2C routes (`/transcribe`, `/translate`, `/sessions` cloud, local store) unchanged.
- Practice layer cannot read `InterpreterCloudSession` without patient grant + dedicated share payload.
- Local-only sessions stay local until patient explicitly shares snapshot.

---

## Frontend routes

| Path | Page |
|------|------|
| `/practice/interpreter` | Hub |
| `/practice/interpreter/dashboard` | Dashboard |
| `/practice/interpreter/invites` | Invites (+ `/invites/new` alias) |
| `/practice/interpreter/sessions` | Shared sessions list |
| `/practice/interpreter/sessions/:id` | Session documentation detail |
| `/i/interpreter/:token` | Patient invite landing |

---

## i18n

DE/EN updates in:

- `medicalInterpreterPractice.js` (sessions, invites QR/copy)
- `medicalInterpreter.js` (`practiceShare`, `invite.consentExplicitStep`)

---

## Checks run

| Check | Result |
|-------|--------|
| `npx prisma validate` | Pass |
| `npx prisma generate` | Pass |
| `npm run build` (client) | Pass |

---

## Manual QA checklist

- [ ] B2B flags off → practice UI hidden; APIs 503
- [ ] Create invite → copy link + QR; revoke invite
- [ ] Patient opens `/i/interpreter/:token` → setup → live → end → share with checkbox
- [ ] Practice sessions list shows entry only after consent
- [ ] Practice detail shows turns; revoked link returns 403/404
- [ ] Patient revoke sharing → practice loses access
- [ ] B2C interpreter without invite unchanged
- [ ] Audit log entries contain no transcript text

---

## Remaining risks / notes

1. **Encryption key:** Sharing uses the same master key as cloud; production must set `INTERPRETER_CLOUD_MASTER_KEY`.
2. **Guest patients:** Invite landing still requires login (documented in UI).
3. **`practiceProfileId` in patient body:** Direct share without invite token uses `/sharing/consent` — invite flow preferred for QR.
4. **Export permission:** `interpreter.export` defined; dedicated practice export endpoint not added (reuse patient export / future phase).
5. **Retention:** No automated TTL job for share payloads yet (Phase 6.3 planning).

---

## Production readiness

**Ready for staged rollout** with flags off by default. Enable `MEDICAL_INTERPRETER_B2B_ENABLED` + `VITE_MEDICAL_INTERPRETER_B2B_ENABLED` after migration deploy and key configuration. Recommended pilot with one practice and explicit staff training on consent-only access.
