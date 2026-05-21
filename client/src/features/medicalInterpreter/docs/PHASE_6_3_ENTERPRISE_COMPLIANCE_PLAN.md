# Medical Interpreter — Phase 6.3 Enterprise Consent, Audit, Retention & Compliance (Planning Only)

**Status:** Planning document. No implementation in Phase 6.3.  
**Builds on:** [PHASE_6_1_ECOSYSTEM_PLAN.md](./PHASE_6_1_ECOSYSTEM_PLAN.md), [PHASE_6_2_ORG_ARCHITECTURE_PLAN.md](./PHASE_6_2_ORG_ARCHITECTURE_PLAN.md)  
**Scope:** Trust, governance, and compliance backbone for communication-only interpreter infrastructure — without changing existing B2C/B2B behaviour, without hidden patient access, and without clinical decision support.

---

## Core principle (non-negotiable)

The Medical Interpreter system is:

- communication infrastructure  
- multilingual support infrastructure  
- documentation assistance infrastructure  

It is **not** a diagnostic, triage, treatment, or clinical decision system.

All consent, audit, retention, and compliance design in this document preserves that boundary. Enterprise features exist to **prove** what was accessed and **what the patient allowed** — not to widen clinical inference or silent data pooling.

---

## Executive summary

Today the platform has **strong B2C cloud consent** (`InterpreterCloudPreference` + per-write `cloudStorageConsent` + `ConsentRecord` type `interpreter_cloud_storage`), **metadata-only interpreter cloud audit**, **practice invites without patient linkage**, and a **general `AuditLog`** with sanitization. There is **no practice/org session sharing consent**, **no unified consent event stream**, **no automated retention jobs** for interpreter data, and **no enterprise consent dashboard**.

Phase 6.3 designs the **layered consent model**, **lifecycle**, **schema**, **audit**, **retention**, **patient/org rights**, **export governance**, **security**, and **6.3.1–6.3.7** implementation order — ready for coding in later subphases only.

---

## Section 1 — Current architecture review

### 1.1 Current B2C interpreter consent model

| Layer | Mechanism | Verified |
|-------|-----------|----------|
| **Default mode** | Local-only sessions in `localStorage` (`medscoutx_interpreter_sessions_v1_{userId}`) | `interpreterStoragePolicy.js` |
| **Setup profile consent** | Optional checkbox: use account profile fields (name, etc.) on session metadata — **not** cloud, **not** practice share | `InterpreterSetupProfileConsent.jsx` → `profileConsentUsed` on cloud row when synced |
| **Privacy copy** | Live room / setup explain communication-only, no diagnosis | UI i18n |
| **Server AI calls** | Transcribe/translate/simplify require auth; no consent row for ephemeral API use | *needs repo verification* whether explicit “AI processing” consent exists beyond login |

**Gap:** No explicit `interpreter_local_only_ack` consent record — local mode is implicit by not enabling cloud.

### 1.2 Current cloud-storage consent model

| Component | Behaviour |
|-----------|-----------|
| Account toggle | `InterpreterCloudPreference.cloudEnabled` |
| Version | `INTERPRETER_CLOUD_CONSENT_VERSION` (`interpreter-cloud-v1`) |
| Per-save gate | Request body must include `cloudStorageConsent: true` |
| History | `ConsentRecord` rows with `consentType: interpreter_cloud_storage`, `practiceProfileId` null |
| Revoke | `revokeCloudConsent()` — optional `deleteCloudData: true` hard-deletes all cloud sessions |
| Audit | `auditInterpreterCloud()` + `writeAuditLog` on grant/revoke record |

Encryption: AES-256-GCM via `INTERPRETER_CLOUD_MASTER_KEY`; payloads in `InterpreterCloudSessionPayload.payloadEnc` only.

### 1.3 Current invite / practice consent boundaries

| Rule | State |
|------|-------|
| Invite validates practice entry | Public `GET /api/interpreter/invite/:token/status` |
| Client context | `sessionStorage` `medscout_interpreter_invite_context_v1` — display name only, **no token** |
| Session metadata | `inviteContext` on local session (practice display name) |
| Practice access to content | **Denied** — B2B routes explicitly no transcript access |
| Usage log | `PracticeInterpreterInviteUsage` — `ipHash` only, **no patientUserId** |
| Care consent | Separate `ConsentRecord` types on `PracticePatientLink` — not interpreter share |

**Gap:** No `interpreter_invite_ack` or `interpreter_practice_share` consent types in `consentTypes.js` yet.

### 1.4 Current cloud session ownership model

| Rule | Enforcement |
|------|-------------|
| Owner | `InterpreterCloudSession.userId` = patient JWT user |
| Uniqueness | `@@unique([userId, clientSessionId])` |
| Soft delete | `deletedAt` on session row; queries filter `deletedAt: null` |
| Practice labels | `practiceName`, `doctorName` — organizational metadata, **not** access grants |
| B2B | Practice APIs cannot read payloads |

### 1.5 Current auth / session architecture

| Aspect | Detail |
|--------|--------|
| API auth | JWT Bearer `requireAuth` on `/api/interpreter/*` |
| Identity | `req.user?.userId` from decoded JWT |
| Public invite | Unauthenticated status endpoint, rate-limited |
| Client auth storage | `medscout_token`, `medscout_user_id` in localStorage |
| Logout | Clears auth tokens; **does not** clear interpreter local sessions (documented) |

*Needs repo verification:* JWT payload field names at sign-in; HttpOnly cookie migration status.

### 1.6 Current delete / export functionality

| Surface | Capability |
|---------|------------|
| Cloud single session | DELETE by `clientSessionId` (soft or hard — *needs repo verification* per route) |
| Cloud revoke all | `deleteAllCloudSessionRows` on revoke with flag |
| Local sessions | User deletes in UI / clears site data — no server copy |
| Account delete | `DELETE /api/account/delete` — includes `interpreterCloudSession`, `interpreterCloudPreference`; lists consent events in pre-delete summary |
| Patient exports | `/api/patient/exports` — `exportJobService`; *needs repo verification* if interpreter cloud included in job types |
| Practice export | `/api/practice/patients/:linkId/export` — care data; not interpreter transcripts today |
| Client PDF | Session review PDF — device-generated, not server audit logged per file *needs repo verification* |

### 1.7 Current audit / logging behaviour

| System | Purpose | Content rules |
|--------|---------|-----------------|
| `AuditLog` | Platform-wide operational log | `sanitizeAuditMetadata()` strips sensitive keys; 200-char string cap |
| `auditInterpreterCloud()` | Cloud-specific actions | Whitelist metadata keys only |
| `PracticeApiAuditEvent` | Developer API webhooks | Separate table; practice-scoped |
| `PracticeInterpreterInviteUsage` | Invite open events | ipHash only |
| `AnalyticsEvent` | Product analytics | Salted hashes; TODO retention in schema comment |
| Practice audit UI | `GET /api/practice/audit` | Requires `audit.view`; uses `listPracticeAuditLog` |

**Gap:** No dedicated `interpreter.consent.*` or `interpreter.export.*` action namespace standard yet; interpreter invite create/revoke may be partial *needs repo verification*.

### 1.8 Existing GDPR / privacy utilities

| Utility | Location / role |
|---------|-----------------|
| `ConsentRecord` service | `consentRecordService.js` — grant/revoke/expire |
| Patient data control | `GET /api/patient/data-control` |
| Data requests | `/api/patient/data-requests`, practice counterpart |
| Account deletion | GDPR wipe path with rate limit |
| IP hashing | `hashClientIp` in audit |
| AI safety | `interpreterInputSafety.js` — blocks clinical routing fields |
| Cloud docs | `INTERPRETER_CLOUD_BACKEND.md` |

*Needs repo verification:* DPA templates, RoPA documentation, subprocessors list in repo.

### 1.9 Existing account deletion / export flows

- **Deletion:** Cascade cloud sessions + preference; consent records may remain per `onDelete` on `ConsentRecord` → patient User cascade *needs repo verification* for audit log retention on delete.  
- **Export:** Generic export jobs; interpreter-specific structured export API planned here, not present as first-class type today.

### 1.10 Existing retention behaviour

| Data class | Retention today |
|------------|-----------------|
| Local interpreter sessions | Until user/device clears; no server TTL |
| Cloud sessions | Until user deletes or revoke-all; max 100 sessions/user cap |
| Cloud soft-deleted | `deletedAt` set — *needs repo verification* if hard purge job exists |
| Stream STT buffers | In-memory only; session TTL via `STREAM_MAX_DURATION_MS` |
| Audit logs | No interpreter-specific TTL job documented |
| Invite metadata | Until revoked/expired; practice cascade delete |
| Analytics | Schema TODO for prune |

**Gap:** No configurable org/practice retention policy engine.

---

## Section 2 — Enterprise consent architecture

Nine consent layers — **orthogonal**; granting one never implies another.

### 2.1 Local-only consent (implicit + optional explicit)

| Attribute | Definition |
|-----------|------------|
| **Purpose** | User runs interpreter on device without server persistence of conversation text |
| **Scope** | Device `localStorage` for authenticated user |
| **Storage** | No server consent row required; optional `interpreter_local_ack` for audit trail only |
| **Expiry** | Until browser data cleared or user deletes sessions |
| **Revocation** | Delete sessions locally; logout does not auto-delete (current behaviour preserved until explicit product change) |
| **Audit** | Optional `interpreter.local.session_started` with `storageMode: local` |
| **UX** | Default path; calm copy that cloud is optional |

### 2.2 Cloud-storage consent

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Encrypted backup/sync of **confirmed** turn text to MedScoutX |
| **Scope** | Patient account globally; per-write reaffirmation |
| **Storage** | `InterpreterCloudPreference` + `ConsentRecord(interpreter_cloud_storage)` |
| **Expiry** | Account-level until revoked; per-session writes require `cloudStorageConsent: true` |
| **Revocation** | Revoke preference; optional delete all cloud rows |
| **Audit** | Existing `interpreter_cloud_consent_*` actions |
| **UX** | Dedicated panel (`InterpreterCloudConsentPanel`); no pre-checked default |

**Phase 6.3:** Align version bumps with `ConsentVersion` registry (§4).

### 2.3 Practice-sharing consent

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Allow **specific practice staff** to read **specific shared** interpreter session content for appointment handoff |
| **Scope** | One `practiceProfileId`; prefer **single `clientSessionId`** per grant |
| **Storage** | `ConsentRecord` type `interpreter_practice_share` + `SessionConsentLink` |
| **Expiry** | Required `expiresAt` (e.g. 24h–7d); default short |
| **Revocation** | Patient revokes per session or all for practice; immediate access cut-off |
| **Audit** | `consent.granted`, `consent.revoked`, `interpreter.share.accessed` (metadata only) |
| **UX** | Separate step from invite; name practice; show expiry; no “share all history” default |

### 2.4 Invite-scoped consent

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Acknowledge entry via practice link/QR — **navigation only** |
| **Scope** | One `inviteId` / validation event |
| **Storage** | Optional `interpreter_invite_ack` with `metadataJson: { inviteId, practiceProfileId }` — no transcript |
| **Expiry** | SessionStorage TTL (browser session) + optional 24h server ack record |
| **Revocation** | Clear sessionStorage; does not affect cloud or share |
| **Audit** | Maps to existing invite usage + new `interpreter.invite.acknowledged` |
| **UX** | “This does not share your conversation with the practice.” |

### 2.5 Realtime-session consent

| Attribute | Definition |
|-----------|------------|
| **Purpose** | User opts into streaming STT / near-realtime translate / streaming TTS for **current session** |
| **Scope** | Ephemeral server buffers; in-memory stream sessions |
| **Storage** | Client flag + optional per-session `interpreter_realtime_processing` ack (no content) |
| **Expiry** | End of stream session / tab close / cancel |
| **Revocation** | Stop streaming; server `cancel` clears buffers |
| **Audit** | `interpreter.stream.started`, `.finished`, `.cancelled` — streamId, byte counts only |
| **UX** | Separate toggle from cloud; off by default (flags default false) |

### 2.6 Organization-level sharing consent

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Rare: patient explicitly shares to **named organization** (MVZ portal) |
| **Scope** | `organizationId` + enumerated practice list in consent UI |
| **Storage** | `interpreter_org_share` — **discouraged**; requires stronger copy than practice share |
| **Expiry** | Short TTL mandatory |
| **Revocation** | Org-level revoke cascades staff access tokens |
| **Audit** | High-severity visibility; org admin cannot grant on behalf of patient |
| **UX** | Phase 6.3.5+ only; never default from invite |

### 2.7 Export consent

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Permit generation of downloadable artifact (PDF/JSON) |
| **Scope** | `export_scope: self` \| `practice_shared_session` \| `org_audit` |
| **Storage** | `interpreter_export` consent or reuse `data_export` with interpreter subtype in metadata |
| **Expiry** | Per export job; download link TTL (e.g. 15 min) |
| **Revocation** | Invalidate download token; delete artifact blob |
| **Audit** | `interpreter.export.requested`, `.completed`, `.downloaded`, `.expired` |
| **UX** | Patient initiates self-export; staff export only on already-shared sessions |

### 2.8 Future human-review consent (deferred product)

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Optional linguist/human review of export queue — **separate product** |
| **Scope** | Explicit per job |
| **Storage** | `interpreter_human_review` — not in 6.3 implementation |
| **Audit** | Would require enhanced workforce BAA |

### 2.9 Future analytics / telemetry consent (deferred)

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Opt-in non-medical product analytics beyond operational logs |
| **Scope** | Aggregated feature usage |
| **Storage** | Separate from `AuditLog`; align with `AnalyticsEvent` retention TODO |
| **Rule** | **No** transcript-derived analytics ever |

---

## Section 3 — Consent lifecycle

### 3.1 State machine

```text
[none] → granted → (active)
         ↓ update (version bump / scope narrow)
         ↓ partially_revoked (e.g. one session unshared)
         ↓ revoked | expired | deleted
```

| Transition | System behaviour |
|------------|------------------|
| **Granted** | Create `ConsentRecord` + `ConsentEvent` + optional `SessionConsentLink` |
| **Updated** | New version row; prior row → `superseded` (status) *or* in-place metadata update for non-scope fields only |
| **Partially revoked** | Remove one `SessionConsentLink`; other shares remain |
| **Fully revoked** | All links for scope target → `revoked`; invalidate staff read tokens |
| **Expired** | Cron/job sets `expired`; same access cut-off as revoke |
| **Deleted** | Hard delete link rows; retain `ConsentEvent` audit trail (metadata) |
| **Account deletion** | Cascade patient-owned data; cloud + shares gone; audit may anonymize `userId` |
| **Practice/org removal** | Revoke all shares targeting that practice/org; invites revoked |

### 3.2 Impact on existing sessions

| Consent revoked | Local session | Cloud session | Practice view |
|-----------------|---------------|---------------|---------------|
| Cloud storage | Unchanged on device | No new writes; existing until deleted | N/A |
| Practice share | Unchanged | Share link void | Access denied immediately |
| Invite ack | Unchanged | Unchanged | N/A |
| Realtime | Stream cancelled | N/A | N/A |

### 3.3 Legal / audit retention after delete

| Artifact | After patient delete |
|----------|----------------------|
| Transcript content | **Removed** (cloud cascade) |
| ConsentEvent metadata | May retain anonymized actor + action + timestamp |
| Invite usage ipHash | Retain per practice retention policy |
| Billing meters | Aggregated counts without patient id |

---

## Section 4 — Consent data model

### 4.1 Entity relationship (proposed)

```text
ConsentRecord (existing, extended types)
    ├── ConsentEvent (append-only log)
    ├── SessionConsentLink (optional, many per record for multi-session — prefer 1:1)
    └── ConsentVersion (registry table, not per-user rows)

ConsentScope (optional normalized view — can be JSON on ConsentRecord.metadataJson initially)
```

### 4.2 ConsentRecord (extend existing model)

| Field | Notes |
|-------|-------|
| `id` | cuid |
| `patientUserId` | Required |
| `organizationId` | Optional — org-level types only |
| `practiceProfileId` | Optional — practice-level types |
| `practicePatientLinkId` | Optional — tie to care link when exists |
| `consentType` | See §2 enum list |
| `status` | `granted` \| `revoked` \| `expired` \| `superseded` |
| `grantedAt`, `revokedAt`, `expiresAt` | |
| `grantedByUserId`, `revokedByUserId` | Patient for grants; system for expiry |
| `version` | Points to `ConsentVersion.version` |
| `source` | `ui` \| `api` \| `invite_landing` \| `account_delete` \| `admin_revoke` |
| `metadataJson` | **Allowlist only:** `clientSessionId`, `inviteId`, `exportJobId`, `locale` — **never text** |

### 4.3 ConsentEvent (new, append-only)

| Field | Notes |
|-------|-------|
| `id` | cuid |
| `consentRecordId` | FK |
| `eventType` | `granted` \| `revoked` \| `expired` \| `updated` \| `accessed` |
| `actorUserId` | Nullable for system |
| `actorType` | `patient` \| `staff` \| `system` |
| `occurredAt` | |
| `metadataJson` | Whitelist |

### 4.4 SessionConsentLink (new)

| Field | Notes |
|-------|-------|
| `id` | cuid |
| `consentRecordId` | FK |
| `patientUserId` | Denormalized for query guard |
| `practiceProfileId` | |
| `clientSessionId` | Client UUID |
| `cloudSessionId` | Optional server id |
| `accessTokenHash` | Optional short-lived staff read token |
| `expiresAt` | |
| `revokedAt` | |

### 4.5 ConsentVersion (registry)

| Field | Example |
|-------|---------|
| `consentType` | `interpreter_cloud_storage` |
| `version` | `interpreter-cloud-v2` |
| `effectiveAt` | |
| `legalTextKey` | i18n key, not full legal wall in DB |
| `requiresReconsent` | boolean |

### 4.6 ConsentRevocation (optional)

Can be represented as `ConsentEvent` only in 6.3.1 to avoid duplicate tables; add dedicated table if legal requires immutable revocation certificates.

**Rule:** No transcript columns on any consent table.

---

## Section 5 — Audit architecture

### 5.1 Design goals

- Single writer API: `writeInterpreterAudit()` wrapping `writeAuditLog` + stricter whitelist than global sanitizer for interpreter namespace.  
- Dual visibility: `internal` \| `practice_visible` \| `patient_visible` (existing `AuditLog.visibility`).  
- Correlation: `requestId`, `clientSessionId`, `streamId`, `inviteId` — never raw token.

### 5.2 Event schema (canonical)

| Field | Type | Notes |
|-------|------|-------|
| `action` | string | Namespaced: `interpreter.*`, `consent.*` |
| `actorUserId` | string? | |
| `actorType` | enum | |
| `organizationId` | string? | Phase 6.2 org layer |
| `practiceProfileId` | string? | |
| `patientUserId` | string? | For staff actions on patient data |
| `entityType` | string | |
| `entityId` | string | |
| `result` | `ok` \| `denied` \| `failed` | |
| `severity` | `info` \| `warning` \| `security` | |
| `visibility` | enum | |
| `metadata` | JSON | Whitelist |
| `ipHash` | string? | |
| `createdAt` | datetime | |

### 5.3 Action catalog (planned)

| Category | Actions |
|----------|---------|
| Auth | `interpreter.session.authenticated` (*optional*) |
| Cloud | `interpreter.cloud.save`, `.delete`, `.delete_all`, `.consent_granted`, `.consent_revoked` |
| Share | `interpreter.share.granted`, `.revoked`, `.accessed`, `.denied` |
| Export | `interpreter.export.requested`, `.completed`, `.download`, `.failed` |
| Invite | `interpreter.invite.created`, `.revoked`, `.used`, `.acknowledged` |
| Consent | `consent.record.granted`, `.revoked`, `.expired` |
| Org/Practice | `interpreter.org.policy.updated`, `interpreter.practice.access` |
| Admin | `interpreter.quota.updated`, `.admin.config_changed` |
| Realtime | `interpreter.stream.started`, `.chunk`, `.finished`, `.cancelled` |

### 5.4 Forbidden log content

- `originalText`, `translatedText`, `simplifiedText`, `transcript`, `turns`, `payload`, `audio`, `prompt`, `message`, `symptom`, `diagnosis`, `medication`, `pdf` body  

Enforce in CI: static test scans `writeAuditLog` calls under `server/services/interpreter/**`.

### 5.5 Retention model (audit)

| Tier | TTL | Storage |
|------|-----|---------|
| Security / denied access | 2 years | `AuditLog` |
| Consent events | 7 years (metadata) | `ConsentEvent` + `AuditLog` |
| Invite usage | 90 days | `PracticeInterpreterInviteUsage` |
| Realtime operational | 30 days | Aggregates only after rollup |

### 5.6 Query model

| Consumer | API (future) | Filter |
|----------|--------------|--------|
| Patient | `/api/interpreter/audit/me` | `patientUserId = self`, `patient_visible` |
| Practice | `/api/interpreter/audit/practice` | `practiceProfileId`, `audit.view` |
| Org | `/api/interpreter/audit/org` | `organizationId`, `org_auditor` |

Pagination cursor-based; max 90-day window per query default.

### 5.7 Export behaviour

- Audit export = CSV/JSON of metadata rows only.  
- Signed download URL; `audit.export` permission.  
- Log the export with `interpreter.audit.exported` (recursive meta-audit).

---

## Section 6 — Data retention architecture

### 6.1 Retention matrix

| Data class | Default TTL | Configurable | Deletion mechanism |
|------------|-------------|--------------|------------------|
| Local sessions | User-controlled | No | Client UI / site data clear |
| Cloud sessions | Until revoke/delete | Org policy max age (future) | Soft `deletedAt` → hard purge job |
| Shared session links | Min(consent expiry, 7d default) | Per consent | Revoke link + token invalidate |
| Invite metadata | 1 year inactive | Practice policy | Revoke + cascade |
| Audit logs | Tiered §5.5 | Org contract | Partition drop |
| Export artifacts | 24h download + 30d storage | Per job type | Blob delete job |
| Stream audio buffers | Session max duration | Fixed env | Memory clear on finish/cancel |
| Stream partial text | Not persisted server-side | N/A | — |
| Near-realtime translate | Request-scoped | N/A | No store |

### 6.2 Deletion jobs (planned)

| Job | Schedule | Action |
|-----|----------|--------|
| `purgeSoftDeletedCloudSessions` | Daily | Hard delete where `deletedAt < now - 30d` |
| `expireConsentRecords` | Hourly | Status → `expired`; revoke links |
| `purgeExportArtifacts` | Daily | Delete expired blobs |
| `rollupAuditMetrics` | Weekly | Aggregate then prune raw > TTL |
| `warnRetentionExpiry` | Daily email/push | Patient notification 7d before cloud auto-expire *if policy enabled* |

### 6.3 Configurable retention (enterprise)

`OrganizationPolicy.retentionDays` overrides **maximum** cloud age for patients who opted into cloud — never deletes local-only data on device.

### 6.4 Regional compliance

- EU org: data residency flag on `Organization.country` → route DB + AI subprocessors EU-only.  
- Retention minimums must respect **max** deletion schedules (cannot retain longer than patient consent without legal basis).

---

## Section 7 — Patient rights model

### 7.1 Rights catalogue

| Right | Mechanism |
|-------|-----------|
| View cloud sessions | Existing cloud list API |
| Export cloud sessions | New `interpreter_export` self-scope + JSON/PDF |
| Delete single session | Cloud DELETE + local delete |
| Delete all sessions | Revoke-all + local bulk delete UI |
| Revoke practice sharing | Revoke `interpreter_practice_share` + links |
| Revoke org sharing | Revoke `interpreter_org_share` |
| Revoke cloud storage | Existing revoke + optional delete |
| Continue local-only | Default; no penalty |

### 7.2 Effect on organizations

| Patient action | Org/practice loses |
|----------------|-------------------|
| Revoke share | Read access to that session immediately |
| Delete cloud | Server copy gone; staff never had local |
| Account delete | All shares and cloud; audit anonymized |
| Expire consent | Same as revoke |

### 7.3 What remains

| Item | After delete |
|------|--------------|
| Anonymized audit | Yes, if legally required |
| Invite usage counts | Aggregated, no patient id |
| Billing usage meters | Aggregated |

---

## Section 8 — Organization & practice rights

### 8.1 Hard rules

1. **Never** hidden access to patient interpreter content.  
2. **Only** explicitly consented sessions readable by staff.  
3. **Cannot** override or auto-grant patient consent.  
4. **Cannot** see unrelated sessions (even same patient at another site without new consent).  
5. **Cannot** access deleted/revoked/expired sessions — API returns 404 uniform (no leak via timing).

### 8.2 Scoped access patterns

| Pattern | Mechanism |
|---------|-----------|
| Temporary read | `SessionConsentLink.accessTokenHash` + expiry |
| Invite-based entry | Invite ack only — not content |
| Scoped export | Export job tied to `SessionConsentLink` id |
| Clinician | `interpreter.view` + active share link |
| Assistant | `interpreter.invite` only; no share content read unless explicit role grant *policy decision* |

### 8.3 Audit visibility

| Role | Sees |
|------|------|
| `audit.view` (practice) | Practice-scoped metadata audit |
| `org_auditor` | Org-wide metadata audit |
| Patient | Own `patient_visible` events |

---

## Section 9 — Export & data portability

### 9.1 Export types

| Type | Actor | Content | Consent required |
|------|-------|---------|------------------|
| Patient JSON | Patient | Own cloud + local export bundle | Self |
| Patient PDF | Patient | Review PDF (client or server render) | Self |
| Practice JSON | Staff | Single shared session | `interpreter_practice_share` |
| Org audit CSV | Auditor | Metadata audit | `audit.export` |
| API export (future) | Integration | Webhook job completion | Contract + patient consent per session |

### 9.2 Technical controls

| Control | Spec |
|---------|------|
| Permissions | `interpreter.export` (staff), implicit (patient self) |
| Logging | Every job → §5.3 export actions |
| Download link | Signed URL, single-use optional, 15 min TTL |
| Revocation | Invalidate token; delete blob on share revoke |
| Formats | JSON schema versioned `interpreter-export-v1`; PDF via existing client renderer first |

*Needs repo verification:* integrate with `exportJobService` vs separate `InterpreterExportJob` table.

### 9.3 Portability (GDPR Art. 20)

- Machine-readable JSON including session metadata + turns (patient-initiated only).  
- No practice-initiated portability without consent.

---

## Section 10 — Security & compliance

### 10.1 Security controls

| Control | Implementation note |
|---------|---------------------|
| Least privilege | RBAC from Phase 6.2 + share token scope |
| Org isolation | `organizationId` on all staff queries |
| Cross-org prevention | Middleware deny if practice.org ≠ membership.org |
| Invite abuse | Rate limits + `maxUses` + TTL (existing) |
| Replay protection | One-time download tokens; stream session id single-user |
| Retention enforcement | Jobs §6.2 |
| Audit integrity | Append-only `ConsentEvent`; no UPDATE on audit rows |
| Consent integrity | Grant only via patient-authenticated routes |

### 10.2 GDPR mapping

| Topic | Approach |
|-------|----------|
| Lawful basis | Consent for cloud/share; legitimate interest for security audit metadata |
| Data minimization | Metadata audit; short share TTL |
| Purpose limitation | Communication assistance only |
| Storage limitation | Retention jobs |
| Integrity | Encryption at rest for cloud |
| DSR | Access/export/delete via patient data control |
| Processor | MedScoutX DPA; AI subprocessor list in privacy policy |

### 10.3 Healthcare communication risk

- Copy and audits repeat: **not for diagnosis or emergency decisions**.  
- No urgency classification in logs or exports.

### 10.4 MDR boundary

- No clinical decision outputs; consent/audit subsystem is **administrative**, not SaMD.  
- Re-assess if human-review or clinical integrations added later.

### 10.5 Regional storage

- `Organization.dataRegion` enum: `eu` \| `ch` \| *needs repo verification* for supported regions.

---

## Section 11 — Observability without medical content

### 11.1 Allowed signals

| Signal | Example |
|--------|---------|
| Request ID | `x-request-id` |
| Route | `/api/interpreter/translate` |
| Latency | histogram ms |
| Quota | `quota.exceeded` event |
| Status | HTTP 4xx/5xx class |
| Feature flags | `streamingSttEnabled: false` |
| Failure category | `validation_failed`, `consent_required` |
| Counts | `turnCount`, `charCount`, `byteCount` |

### 11.2 Forbidden in logs/traces/metrics

- Transcript, translation, simplified text, prompts, audio buffers, patient message bodies  

### 11.3 Implementation

- OpenTelemetry attributes allowlist mirroring `auditInterpreterCloud` keys.  
- Error responses never echo user medical text back in `message` field.  
- Sentry: scrubbing rules for interpreter routes *needs repo verification* if Sentry present.

---

## Section 12 — UX & accessibility requirements

### 12.1 Principles

| Requirement | Detail |
|-------------|--------|
| Calm tone | No alarmist medical language |
| Understandable | Grade-8 reading level; short sentences |
| Non-coercive | Cloud/share off by default |
| Multilingual | DE/EN minimum; consent version per locale |
| Accessible | WCAG 2.1 AA: focus order, `aria-describedby`, checkbox labels |
| Mobile | Touch targets ≥ 44px; sticky revoke actions |
| Screen reader | Announce consent state changes via `role="status"` |

### 12.2 Anti-patterns (forbidden)

- Legal walls blocking care without lawyer-only text  
- Dark patterns (pre-checked share, “accept all”)  
- Hidden sharing via invite alone  
- Urgency colours implying emergency triage  

### 12.3 Consent UI surfaces (planned)

| Surface | Consent types |
|---------|---------------|
| Cloud panel | Cloud storage |
| Share dialog | Practice share (per session) |
| Invite landing | Invite ack banner |
| Live room | Realtime toggle + privacy note |
| Data control hub | Revoke all / export / delete |
| Account delete | Cascade warning includes interpreter |

---

## Section 13 — Risks & mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Enterprise overreach | High | Deny-by-default; org share discouraged |
| Hidden-access risk | Critical | No practice API without share link; security tests |
| Consent confusion | High | Orthogonal types; separate UI; invite ≠ share |
| Deletion inconsistency | Medium | Single deletion orchestrator service |
| Audit growth | Medium | TTL + rollup jobs |
| Legal ambiguity | Medium | ConsentVersion registry + legal review per locale |
| Cross-org leakage | Critical | Org middleware on every staff route |
| Quota abuse | Medium | Rate limits + billing meters (6.4) |
| Realtime consent complexity | Medium | Session-scoped ack; flags off by default |
| Staff impersonation grant | High | Patient-only grant endpoints; audit denied attempts |

---

## Section 14 — Implementation roadmap (6.3.1–6.3.7)

**Do not start until explicit implementation request.** Order respects Phase 6.2 org FK when org-scoped consent ships in 6.3.5.

### 6.3.1 — Consent entity foundation

- Add consent types to `consentTypes.js`: `interpreter_practice_share`, `interpreter_invite_ack`, `interpreter_realtime_processing`, `interpreter_export`.  
- `ConsentEvent` table + writer service.  
- `SessionConsentLink` table.  
- `ConsentVersion` registry seed rows.  
- **No** staff read API yet.  
- **Exit:** Grant/revoke patient APIs + tests; no transcript in DB consent tables.

### 6.3.2 — Audit event infrastructure

- `writeInterpreterAudit()` with namespace whitelist.  
- Standardize cloud + invite actions.  
- Patient-visible subset for consent changes.  
- **Exit:** CI forbidden-key test; practice can query interpreter audit slice.

### 6.3.3 — Retention engine

- Soft-delete purge job for cloud.  
- Consent expiry job.  
- Export artifact TTL job.  
- Optional patient warning notifications.  
- **Exit:** Documented TTLs in ops runbook; metrics on rows purged.

### 6.3.4 — Export governance

- Patient JSON export (cloud sessions).  
- Signed download links + audit.  
- Staff export gated on `SessionConsentLink`.  
- **Exit:** End-to-end export without practice seeing non-shared sessions.

### 6.3.5 — Organization-scoped consent

- Requires Phase 6.2 `organizationId` FK.  
- `interpreter_org_share` + org revoke cascade.  
- Org policy retention caps.  
- **Exit:** MVZ pilot can set org policy without patient share default.

### 6.3.6 — Enterprise compliance dashboard

- Practice: consent counts, export activity, audit tail.  
- Org: aggregate only.  
- **Exit:** No transcript widgets; role-gated.

### 6.3.7 — Operational hardening

- Pen-test checklist for share tokens.  
- Load test audit pagination.  
- Runbook: account delete + interpreter.  
- Re-consent flow on `ConsentVersion` bump.  
- **Exit:** Phase 6.4 billing can attach to usage meters safely — see [PHASE_6_4_BILLING_QUOTA_PLAN.md](./PHASE_6_4_BILLING_QUOTA_PLAN.md).

### Dependency diagram

```text
6.3.1 ──► 6.3.2 ──► 6.3.3
   │          │
   └────┬─────┴──► 6.3.4
        │
        └──► 6.3.5 (needs 6.2 org schema)
                 └──► 6.3.6 ──► 6.3.7
```

---

## Section 15 — What must NOT be implemented yet

| Item | Reason |
|------|--------|
| Diagnosis / triage / treatment / medication / urgency / specialist routing | Regulatory + product boundary |
| Hidden analytics on transcript content | GDPR + trust |
| Hidden sharing or auto org access | Enterprise risk |
| Permanent audio retention | Privacy |
| Practice transcript access without `interpreter_practice_share` | Current B2B contract |
| Human-review queue | Separate product / BAA |
| Payment processing | Phase 6.4 |
| SSO / SAML | *needs repo verification* priority |
| Weakening existing cloud dual-consent | Regression |
| Storing invite tokens in audit/metadata | Security |
| Clinical PMS diagnostic FHIR | Scope creep |
| Org-wide patient search | Phase 6.2 forbidden |

---

## Appendix A — Consent type registry (proposed)

| `consentType` | Layer | Phase |
|---------------|-------|-------|
| `interpreter_cloud_storage` | Cloud | **Exists** |
| `interpreter_local_ack` | Local | 6.3.1 optional |
| `interpreter_practice_share` | Practice share | 6.3.1 + 6.3.4 |
| `interpreter_invite_ack` | Invite | 6.3.1 |
| `interpreter_realtime_processing` | Realtime | 6.3.1 |
| `interpreter_export` | Export | 6.3.4 |
| `interpreter_org_share` | Org | 6.3.5 |
| `interpreter_human_review` | Deferred | — |
| `interpreter_analytics_opt_in` | Deferred | — |

---

## Appendix B — API routes (future, planning only)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/interpreter/consent/grant` | Patient grant by type |
| POST | `/api/interpreter/consent/revoke` | Patient revoke |
| GET | `/api/interpreter/consent` | Patient list active consents |
| GET | `/api/interpreter/consent/history` | Patient history |
| POST | `/api/interpreter/share` | Create practice share link |
| DELETE | `/api/interpreter/share/:linkId` | Revoke share |
| GET | `/api/interpreter/practice/shared-sessions` | Staff list (metadata only) |
| GET | `/api/interpreter/practice/shared-sessions/:id/content` | Staff read (consent-gated) |
| POST | `/api/interpreter/export` | Request export job |
| GET | `/api/interpreter/audit/me` | Patient audit |
| GET | `/api/interpreter/audit/practice` | Practice audit |
| GET | `/api/interpreter/audit/org` | Org audit |

Existing routes **unchanged** until each subphase explicitly migrates behaviour behind new flags.

---

## Appendix C — Open questions (*needs repo verification*)

1. Does `exportJobService` already support a patient self-export type for interpreter cloud payloads?  
2. Cloud session DELETE: soft-only or hard-delete path per route?  
3. On `User` delete, are `AuditLog` rows cascade-deleted or retained anonymized?  
4. Are interpreter invite create/revoke actions already written to `AuditLog`?  
5. Is explicit “AI processing” consent required beyond account login for GDPR?  
6. Sentry / Datadog scrubbing configuration for interpreter paths.  
7. Legal-approved consent copy versions per locale.  
8. Switzerland (nDSG) vs EU GDPR dual track for retention defaults.

---

*Document version: Phase 6.3 planning — no code changes, no migrations, no implementation. Do not proceed to Phase 6.4 from this document without a separate implementation request.*
