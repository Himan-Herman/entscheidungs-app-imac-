# Practice integration architecture (roadmap)

This document prepares MedScoutX for later **practice workflow** connections without implementing vendor integrations in MVP.

## Principles

- **PDF export first** — patient-controlled document remains the primary artifact.
- **No direct medical record write** in MVP — no HL7/FHIR write-back to PVS until explicitly scoped.
- **Integration is future-ready** — no third-party receives clinical payloads until **explicitly enabled** and **lawfully consented**.

## PVS / practice software (Germany context)

- **PVS** (Praxisverwaltungssystem): future connector may consume **structured operational metadata** only (appointment refs, document-ready signals), not narrative diagnosis content.
- **HL7 / FHIR**: reserved for a later phase (read interfaces, validated mapping); out of scope for current codebase behavior.

## Calendar

- **PracticeIntegrationSettings.calendarProvider** holds intended provider: `manual`, future values such as `google_calendar`, `microsoft_outlook`, `doctolib_export`.
- **PreVisitSession.appointmentReference** holds an opaque patient/practice-entered or synced reference string — not a clinical identifier by design.
- No Google/Microsoft OAuth or API calls in the current implementation.

## Document delivery modes

| Mode (`documentDeliveryMode`) | Intent |
|----------------------------|--------|
| `download_only` | Default — patient/browser PDF as today |
| `email` | Existing transactional email paths (already consent-gated elsewhere) |
| `secure_portal` | Future expiring links / authenticated portal fetch — **no long-lived public PDF URLs** |
| `webhook_later` | Signal-only or metadata webhook when queue + contracts exist |

## Secure document delivery (concept)

- **Portal**: short-lived tokens, optional IP/device binding, rate limits.
- **Links**: single-use or time-boxed; never embed PHI in URL query strings.
- **Email body**: operational text only — **no sensitive clinical narrative** in email content.
- **Audit**: operational `AuditLog`-style entries for access/delivery events (no transcript/PDF payload).

## Webhooks

Event types (see `server/constants/practiceIntegrationWebhookEvents.js`):

- `previsit.created`
- `previsit.pdf_created`
- `previsit.sent`
- `followup.created`
- `followup.answered`

Delivery is **off by default** (`PRACTICE_WEBHOOKS_ENABLED` must be `true` for future HTTP dispatch). `practiceIntegrationService.notifyPracticeIntegration` is a **safe no-op** until implemented.

## Storage security

- **webhookUrl** / **webhookSecret** on `PracticeIntegrationSettings`: treat as secrets — **encrypt at rest** before production use of webhooks; placeholders acceptable until an app-level encryption/KMS strategy exists.
