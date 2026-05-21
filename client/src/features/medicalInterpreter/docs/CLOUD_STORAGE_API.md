# Medical Interpreter — Cloud Session API (Phase 3.2)

Backend-only foundation. Default: **local-only** (no automatic sync).

## Enable (server)

```bash
MEDICAL_INTERPRETER_ENABLED=true
INTERPRETER_CLOUD_ENABLED=true
INTERPRETER_CLOUD_MASTER_KEY=<64-char-hex>  # 32 bytes, required for writes
```

Generate key: `openssl rand -hex 32`

## Routes (JWT required)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/interpreter/sessions` | Metadata list only |
| POST | `/api/interpreter/sessions` | Requires `cloudStorageConsent: true` |
| GET | `/api/interpreter/sessions/:id` | Full session (`:id` = client UUID) |
| PUT | `/api/interpreter/sessions/:id` | Requires `cloudStorageConsent: true` |
| DELETE | `/api/interpreter/sessions/:id` | One session |
| DELETE | `/api/interpreter/sessions` | All cloud sessions for user |

## Manual test checklist

- [ ] Without flags → `503 interpreter_cloud_disabled`
- [ ] Without master key → `503 interpreter_cloud_encryption_not_configured` on POST
- [ ] POST without `cloudStorageConsent: true` → `403 interpreter_cloud_consent_required`
- [ ] POST valid session → `201`, GET returns same turns
- [ ] PUT updates turns; wrong user → `404`
- [ ] DELETE one / DELETE all
- [ ] Audit log has no transcript fields

Client stubs: `api/interpreterCloudApi.js` (not used in UI).
