# PR-0 — Care relationship preflight (security & compatibility)

**Date:** 2026-05-18  
**Scope:** PracticePatientLink foundation only — no Med v2, inbox, documents, lab.

## 1. Existing models reviewed

| Model | Relation to new link | Change in PR-0..2 |
|-------|----------------------|-------------------|
| `PracticeProfile` | Parent practice | **Additive** `practicePatientLinks[]` only |
| `User` | Patient account | **Additive** `practicePatientLinks[]` only |
| `PatientProfile` | Optional dependent | **Additive** `practicePatientLinks[]` only |
| `PreVisitSession` | Historical `practiceProfileId` + `patientProfileId` | **Unchanged** — no FK to link; backfill is manual script |
| `VisitMedicationEntry` | Still tied to `preVisitSessionId` | **Unchanged** |
| `PreVisitFollowUpThread` | Session/practice scoped | **Unchanged** |

No columns removed. No existing table altered except new `PracticePatientLink` table (+ optional `consentScopes` JSONB).

## 2. Protected flows (must remain stable)

| Area | Routes / modules | PR impact |
|------|------------------|-----------|
| Pre-Visit | `/api/previsit/*`, sessions, cases | None |
| Follow-ups | `/api/practice/follow-ups`, `/api/previsit/follow-ups` | None |
| Visit medication | `VisitMedicationEntry`, visitMedications router | None (separate feature) |
| Practice dashboard | `/api/practice-dashboard/*` | None |
| Patient hub | Client only | None |
| Places / finder | `/api/places/*` | None |
| Auth | `/api/auth/*` | None |
| i18n | Client bundles | None |

New routes are **flag-gated** (`CARE_RELATIONSHIP_ENABLED`). Default **off** → `404 feature_disabled`.

## 3. Security controls

- **Practice APIs:** `getPracticeAccess` + `canReadPracticePatientLinks` / `canWritePracticePatientLinks`
- **Patient APIs (PR-2 extension):** `req.user.userId` must match `link.patientUserId`
- **Audit:** metadata only (status, scope count) — no PHI, no API keys
- **Logs:** route handlers log `err.message` only, not request bodies with patient data
- **Unique constraint:** `@@unique([practiceProfileId, patientUserId, patientProfileId])` + partial index for NULL profile + active/invited

## 4. Deployment checklist

- [ ] `npx prisma validate`
- [ ] `npx prisma migrate deploy`
- [ ] Set `CARE_RELATIONSHIP_ENABLED=true` on staging when testing
- [ ] Run `node scripts/backfillPracticePatientLinks.js --dry-run` before production backfill
- [ ] Legal sign-off on `phase1-care-v1` before enabling patient consent in UI

## 5. Out of scope (later PRs)

MedicationPlan v2, CommunicationThread v2, PatientInbox, documents, lab results, Pre-Visit auto-link hooks.
