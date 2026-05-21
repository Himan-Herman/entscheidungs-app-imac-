# Medical Interpreter — Cloud Backend (internal)

## Scope

- **Communication only:** transcription/translation conversation text stored optionally in encrypted cloud.
- **No audio:** no `audio`, `microphone`, or blob fields in schema or API payloads.
- **No clinical routing:** no diagnosis, triage, treatment, medication, urgency, or specialist fields in storage or validation.
- **Consent-based writes:** account consent (`InterpreterCloudPreference.cloudEnabled`) plus per-request `cloudStorageConsent: true` on POST/PUT.
- **Deletes after revoke:** DELETE routes do not require active consent.

## Layering

| Layer | Location |
|-------|----------|
| Routes | `server/routes/interpreterCloudSessions.js`, `interpreterCloudPreference.js` |
| Middleware | `server/middleware/interpreterCloudMiddleware.js`, `interpreterRateLimit.js` |
| Validation | `server/services/interpreter/interpreterCloudSessionValidation.js` |
| Session business logic | `server/services/interpreter/interpreterCloudSessionService.js` |
| Consent business logic | `server/services/interpreter/interpreterCloudConsentService.js` |
| Persistence | `server/services/interpreter/interpreterCloudSessionRepository.js` |
| Audit | `server/services/interpreter/interpreterCloudAudit.js` |
| Encryption | `server/utils/interpreterCloudCrypto.js` |

## Audit rules

`auditInterpreterCloud()` only allows whitelisted metadata keys. Never log:

- `originalText`, `translatedText`, `simplifiedText`, or `turns`
- Audio or prompt content
- Stack traces in API responses

## Ownership

All queries include `userId` from JWT (`req.user.userId` via `requireCloudAuthenticatedUser`). Session URLs use client UUID validated by `validateClientSessionIdParam`.

## Routes (summary)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/interpreter/cloud/preference` | Account consent state |
| POST | `/api/interpreter/cloud/consent/grant` | Opt-in (no precheck server-side) |
| POST | `/api/interpreter/cloud/consent/revoke` | Optional `deleteCloudData` |
| GET | `/api/interpreter/cloud/consent/history` | Metadata only |
| GET | `/api/interpreter/cloud/export` | JSON download (patient export) |
| GET/POST/PUT/DELETE | `/api/interpreter/sessions` | Encrypted session CRUD |

Turn text is stored in `InterpreterCloudSessionPayload` (AES-256-GCM), not a separate turns table.

## Environment

- `MEDICAL_INTERPRETER_ENABLED=true`
- `INTERPRETER_CLOUD_ENABLED=true`
- `INTERPRETER_CLOUD_MASTER_KEY` — 64 hex chars (AES-256-GCM)

## B2B practice layer (Phase 4.2+)

Separate routes under `/api/interpreter/practice/*`, gated by `MEDICAL_INTERPRETER_B2B_ENABLED` (default off).

- No patient B2C session data exposed to practice routes in Phase 4.2.
- Patient consent required before practice content access (later phases).
- Routes: `server/routes/interpreterPractice.js`
- Permissions: `interpreter.view`, `interpreter.manage`, `interpreter.admin` in `practicePermissions.js`
- Practice routes require `practiceId` query + `interpreter.view` for `/profile` and `/sessions` (Phase 4.3)
