# Phase 1 — Care relationship (PracticePatientLink)

Additive foundation for practice ↔ patient modules (medication v2, messaging, inbox) without binding them to a single `PreVisitSession`.

## Model

`PracticePatientLink` connects `PracticeProfile` + `User` (patient account) + optional `PatientProfile` (dependent).

| Field | Purpose |
|-------|---------|
| `status` | `invited` \| `active` \| `revoked` \| `archived` |
| `consentVersion` | Accepted legal document id (e.g. `phase1-care-v1`) |
| `consentAcceptedAt` | Patient acceptance timestamp |
| `consentScopes` | JSON array: `medication`, `messages` |

Unique active link per practice + patient (+ optional profile). See partial index in migration for `patientProfileId IS NULL`.

## Feature flag

`CARE_RELATIONSHIP_ENABLED=true` — required for:

- `/api/practice/patients/*`
- `/api/patient/links/*`

Default: **off** (legacy behaviour unchanged).

## APIs (PR-1 / PR-2)

| Audience | Route | Notes |
|----------|-------|-------|
| Practice | `GET /api/practice/patients` | List links (RBAC) |
| Practice | `POST /api/practice/patients/link` | Create link |
| Practice | `GET /api/practice/patients/:linkId` | Detail |
| Practice | `PATCH /api/practice/patients/:linkId/status` | Revoke / archive |
| Patient | `GET /api/patient/links` | Own links |
| Patient | `GET /api/patient/links/:linkId` | Detail |
| Patient | `POST /api/patient/links/:linkId/consent` | Accept consent |

## Backfill

Manual script only — **not** run on deploy:

```bash
cd server
CARE_RELATIONSHIP_ENABLED=true node scripts/backfillPracticePatientLinks.js --dry-run
node scripts/backfillPracticePatientLinks.js
```

Creates `active` links from historical `PreVisitSession` rows with `practiceProfileId`. Does **not** set `consentAcceptedAt` (patient must consent on first module use).

## Out of scope (later PRs)

- MedicationPlan v2, CommunicationThread v2, PatientInbox
- Changes to `/api/previsit/*`, follow-ups, `visitMedications` write paths
- Automatic link creation inside Pre-Visit request handlers (use flag + explicit hook later)

## Security

- Practice routes: `getPracticeAccess` + role helpers in `server/utils/practiceAccess.js`
- Patient routes: `req.user.userId` must match `link.patientUserId`
- Audit: `practice_patient_link_*` actions without PHI in metadata
