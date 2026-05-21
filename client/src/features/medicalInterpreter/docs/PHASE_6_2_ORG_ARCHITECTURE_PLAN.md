# Medical Interpreter — Phase 6.2 Organization & Multi-Practice Architecture (Planning Only)

**Status:** Planning document. No implementation in Phase 6.2.  
**Builds on:** [PHASE_6_1_ECOSYSTEM_PLAN.md](./PHASE_6_1_ECOSYSTEM_PLAN.md)  
**Scope:** Foundation for scalable healthcare **organizations** (MVZ, clinic groups, chains) without changing B2C behaviour, without cross-organization patient access, and without clinical decision support.

---

## Executive summary

Today, “practice” in MedScoutX is modeled as **`PracticeProfile`** — a single site owned by one `User` with **`PracticeMember`** staff roles. Interpreter B2B attaches only to `practiceProfileId` (invites, RBAC). There is **no `Organization` table**; `organizationType` on `PracticeProfile` is descriptive metadata only.

Phase 6.2 plans a **strict hierarchy** (Organization → Practice site → optional Department/Team labels → memberships) with **deny-by-default** patient data isolation, **split consent types**, and **metadata-only audit** suitable for enterprise pilots and billing readiness—without payment implementation.

---

## 1. Current architecture findings (repo-verified)

### 1.1 Auth model

| Aspect | Current state |
|--------|----------------|
| Mechanism | JWT Bearer via `requireAuth` on `/api/interpreter/*` and practice APIs |
| Request identity | `req.user` from `jwt.verify(JWT_SECRET)` — *needs repo verification* that payload always includes `userId` (routes use `req.user?.userId`) |
| Patient vs staff | Same `User` model; role distinguished by **context** (patient portal vs `PracticeMember`), not separate auth realm |
| Public interpreter invite | `GET /api/interpreter/invite/:token/status` — **no auth**; rate-limited |
| Session | Token in `localStorage` (`medscout_token`) on client — *needs repo verification* for HttpOnly migration |

**Implication for org layer:** Organization APIs must still resolve **staff** `userId` → membership → `organizationId` / `practiceProfileId` on every request. Never trust client-supplied org IDs without membership check.

### 1.2 Practice model (actual entity: `PracticeProfile`)

| Field / relation | Purpose |
|------------------|---------|
| `id` | Primary key used as `practiceId` in interpreter B2B query params |
| `userId` | **Owning user** — treated as `role: "owner"` in `getPracticeAccess()` |
| `practiceName`, `displayNameForPatients`, branding | Patient-facing identity |
| `organizationType` | String enum hint only: `single_practice`, `group_practice`, `mvz`, `clinic`, etc. — **not a foreign key** |
| `members` | `PracticeMember[]` — staff with `role`, `status` (`invited` \| `active` \| `revoked`) |
| `interpreterInvites` | `PracticeInterpreterInvite[]` |
| Care relationships | `PracticePatientLink`, appointments, documents, etc. |

**There is no multi-practice parent entity today.** A user who owns two sites would need two `PracticeProfile` rows (two owners) or staff memberships — *needs repo verification* whether one human can own multiple profiles.

### 1.3 Interpreter B2B structure (Phase 4.2–4.7)

| Component | Detail |
|-----------|--------|
| Flag | `MEDICAL_INTERPRETER_B2B_ENABLED` |
| Routes | `/api/interpreter/practice/*` — status, profile, sessions placeholders |
| Invites | `/api/interpreter/practice/invites` — create/list/revoke; `tokenHash` only at rest |
| Middleware | `requirePracticeInterpreterAccess` — requires `practiceId` query + `interpreter.view` |
| Permissions today | `interpreter.view`, `interpreter.manage`, `interpreter.admin` in `practicePermissions.js` |
| Patient join | Public invite status + client landing `/i/interpreter/:token` |
| Practice access to transcripts | **Explicitly not implemented** (comments in `interpreterPractice.js`) |

B2B is **orthogonal** to B2C `/api/interpreter/transcribe|translate|cloud` — no shared route handlers.

### 1.4 Consent structure (multiple parallel systems)

| System | Model | Scope |
|--------|-------|-------|
| **Interpreter cloud** | `InterpreterCloudPreference` + per-session `cloudStorageConsent` | Patient account; backup to MedScoutX cloud |
| **Care relationship** | `PracticePatientLink.consentScopes` (JSON) + `ConsentRecord` | Per practice link; types like medication, messages |
| **Telemedicine** | `TelemedicineConsent` | Separate product surface |
| **Legacy** | `Consent` on `User` | Doctor alert etc. — not interpreter-specific |

**Gap:** No `interpreter_practice_share` or `interpreter_organization_share` consent type yet. Invite usage does **not** imply content sharing.

### 1.5 Cloud session ownership

| Rule | Enforcement |
|------|-------------|
| Owner | `InterpreterCloudSession.userId` = patient `User.id` |
| Client session id | `@@unique([userId, clientSessionId])` |
| Payload | `InterpreterCloudSessionPayload` encrypted; `userId` on payload row |
| Practice fields | Optional metadata: `practiceName`, `doctorName`, `specialty` — **labels only**, not access grants |
| Practice API | Cannot read cloud sessions (documented B2B boundary) |

Patient local sessions (`interpreterSessionStore`) remain device-local unless user opts into cloud sync.

---

## 2. Organization architecture proposal

### 2.1 Entity hierarchy (target)

```
Organization                    ← NEW (legal/billing tenant)
 ├── OrganizationMembership     ← NEW (user ↔ org, org-level role)
 ├── OrganizationPolicy         ← NEW (retention, quotas, language allowlist) — optional 6.3
 └── PracticeProfile (site)     ← EXISTING; add organizationId FK
      ├── PracticeMember        ← EXISTING (site staff role)
      ├── Department (optional) ← NEW lightweight; or tag on invite only in 6.2 MVP
      ├── PracticeInterpreterInvite
      └── PracticePatientLink   ← EXISTING (patient ↔ site); org-scoped via practice
```

**Naming in APIs:** Expose as `organization` and `practice` (maps to `PracticeProfile`) to avoid leaking internal table names.

### 2.2 Role hierarchy (proposed)

Two layers: **organization roles** and **practice roles**. A user may hold one org role and different practice roles per site.

#### Organization-level roles

| Role | Intent |
|------|--------|
| `org_owner` | Legal/billing controller; create/delete org; assign org admins |
| `org_admin` | Manage all practices in org; policies; billing views; audit export |
| `org_billing` | Read usage/quota/invoices only — no patient-facing config |
| `org_auditor` | Read-only audit/usage — no invite manage |

#### Practice-level roles (extend existing `PracticeMember.role`)

| Role | Intent | Maps from today |
|------|--------|-----------------|
| `owner` | Site owner (legacy single-practice) | `PracticeProfile.userId` owner |
| `practice_admin` | Full site interpreter + team | ≈ `admin` |
| `interpreter_coordinator` | Invites, exports, usage view | **new** blend of manage + export |
| `clinician` | View interpreter dashboard; no invite revoke | ≈ `doctor` + interpreter.view |
| `assistant` | Invite create optional; view only | ≈ `secretary` + interpreter.view |
| `viewer` | Read-only metadata | ≈ `viewer` |

*Migration note:* Keep existing `PracticeMember.role` strings working; add mapping layer rather than breaking `practicePermissions.js` in one step (*needs repo verification* of all role consumers).

#### Department & Team (Phase 6.2 planning only)

| Concept | Recommendation |
|---------|----------------|
| **Department** | Optional `Department` table: `id`, `practiceProfileId`, `name`, `isActive` — for UI grouping and invite defaults (e.g. “Radiology”, “Reception”) |
| **Team** | Do **not** duplicate HR system; use `PracticeMember` as team membership |
| **Interpreter coordinator** | Practice-level role, not separate table |

Departments **must not** become an access-control boundary in 6.2—only practice + org boundaries matter for isolation.

---

## 3. Multi-practice model

### 3.1 Goals

| Goal | Design approach |
|------|-----------------|
| Multiple clinics under one org | `PracticeProfile.organizationId` required for enterprise tenants |
| Shared billing | `BillingAccount.organizationId` (*new*, 6.4) — meters summed per org |
| Isolated patient access | Patient data keyed by `practiceProfileId`; org sees **aggregates** only unless consented |
| Isolated consent scope | Consent records include `practiceProfileId` and optionally `organizationId` with strict rules (§6) |
| Org-wide policy | `OrganizationPolicy` JSON: max invite TTL, allowed languages, retention caps |

### 3.2 Single-practice vs enterprise

| Mode | Behavior |
|------|----------|
| **Legacy single** | `organizationId` null OR synthetic single-site org auto-created on upgrade |
| **Enterprise** | Explicit org creation; practices cannot move between orgs without admin + audit (*no silent transfer*) |

### 3.3 Cross-practice staff

- `OrganizationMembership` grants access to **all** practices in org **or** subset via `PracticeMember` only on assigned sites.
- **Recommended:** Org admin sees all sites; clinicians only see sites where they have `PracticeMember`.

---

## 4. Data isolation rules (non-negotiable)

### 4.1 Principles

1. **Patient B2C data belongs to `patientUserId`** — not to a practice by default.  
2. **Practice sees patient only via `PracticePatientLink` + explicit consent** — unchanged care-relationship rule.  
3. **Organization never inherits patient rows** from child practices automatically.  
4. **No cross-organization queries** — every SQL query includes `organizationId` predicate from membership resolution.  
5. **Interpreter transcripts** (local, cloud, or shared exports) require **separate** `interpreter_session_share` consent before practice/org staff can read content.

### 4.2 Access matrix (simplified)

| Actor | Local patient session | Cloud encrypted session | Invite metadata | Transcript content |
|-------|----------------------|-------------------------|-----------------|-------------------|
| Patient | Full (device) | Full (own account) | N/A | Full |
| Practice staff | None | None | List/revoke invites | **Deny** until consent |
| Org admin | None | None | Aggregated counts | **Deny** until consent |
| Other org/practice | **Deny** | **Deny** | **Deny** | **Deny** |

### 4.3 Invite context vs sharing

- Invite landing may store `inviteContext` in **sessionStorage** (practice display name, invite type).  
- That metadata tags the **patient’s next local session** — still not visible to practice until share consent.  
- `PracticeInterpreterInviteUsage` stores `ipHash` only — no `patientUserId` (*verified Phase 4.6*).

### 4.4 Query guard pattern (implementation pattern for 6.3+)

```text
resolveMembership(userId, practiceId) → { organizationId, practiceProfileId, roles }
assert practiceProfile.organizationId === organizationId
execute query WITH practiceProfileId / organizationId from resolution only
```

Never accept `organizationId` from body without membership check.

---

## 5. Role-based access proposal

### 5.1 Interpreter permissions (extend `practicePermissions.js`)

| Permission | Purpose | Typical roles |
|------------|---------|---------------|
| `interpreter.view` | Dashboard, usage summaries (metadata) | clinician, assistant, coordinator, admin |
| `interpreter.manage` | Create/revoke invites, edit invite metadata | coordinator, practice_admin, org_admin |
| `interpreter.invite` | **Split from manage** — create invites only | assistant, coordinator |
| `interpreter.export` | Export communication logs (consent-gated content) | coordinator, practice_admin |
| `interpreter.admin` | Policy overrides, quota view, retention config at practice level | practice_admin, org_admin |

### 5.2 Consent & audit permissions (new)

| Permission | Purpose |
|------------|---------|
| `consent.view` | See that consent exists (type, status, dates) — **not** transcript |
| `consent.manage` | Revoke org-level staff-initiated requests (*not* grant on behalf of patient) |
| `audit.view` | Org/practice audit events (metadata) |
| `audit.export` | Download audit CSV for compliance officers |

**Rule:** Staff cannot `consent.manage` to grant patient rights—patient UI/API only for grant.

### 5.3 Organization-level permissions (new)

| Permission | Purpose |
|------------|---------|
| `org.view` | List practices, aggregate usage |
| `org.manage` | Add/remove practices, invite org members |
| `org.policy` | Edit retention/language/quota policy |
| `org.billing` | View billing account + usage meters |

### 5.4 Role escalation prevention

- Permission checks always from **server** `practicePermissions` + new `organizationPermissions.js`.  
- `owner` on `PracticeProfile.userId` cannot self-assign `org_owner` without existing `org_owner` approval.  
- JWT never contains permissions—only `userId`.  
- Sensitive actions (export content, policy change) require `interpreter.export` / `org.policy` + audit log.

---

## 6. Consent scope model

### 6.1 Consent types (proposed `ConsentScope` / `ConsentRecord.consentType`)

| Type | Grantor | Subject | Effect |
|------|---------|---------|--------|
| `interpreter_cloud_storage` | Patient | Self | Existing cloud preference + per-write flag |
| `interpreter_practice_share` | Patient | One `practiceProfileId` | Staff at **that site** may read specific shared session(s) |
| `interpreter_org_share` | Patient | One `organizationId` | **Discouraged default** — only for MVZ portals where patient picks org explicitly |
| `interpreter_invite_ack` | Patient | One invite id | Acknowledged entry via link — **not** content share |
| `care_relationship_*` | Patient | Practice link | Existing `ConsentRecord` family — keep separate |

### 6.2 Granularity

| Dimension | Options |
|-----------|---------|
| Scope target | `practice` (recommended default) vs `organization` (opt-in) |
| Session scope | `single_session` (clientSessionId) vs `future_sessions` (dangerous—avoid in 6.3) |
| Revocation | Per-session revoke; per-practice revoke all interpreter shares; global cloud revoke separate |
| Expiry | `expiresAt` required for practice/org share (e.g. 24h, 7d, until appointment) |

### 6.3 Invite-scoped consent

- Opening invite link → optional `interpreter_invite_ack` stored (metadata: inviteId, practiceId).  
- Does **not** auto-create `interpreter_practice_share`.  
- UI copy: “This link helps you start the interpreter; it does not share your conversation with the practice.”

### 6.4 Cloud vs organization sharing

| | Cloud storage | Practice share |
|---|---------------|----------------|
| Data processor | MedScoutX | Practice staff portal (future) |
| Purpose | Backup/sync for patient | Read-only handoff for appointment |
| Revocation | Patient cloud settings | Patient data control per practice |

**Organization share** should require **additional** confirmation naming the org and listing practices included—Phase 6.3, not 6.2 schema-only.

---

## 7. Audit architecture

### 7.1 Unified event model (proposed `AuditEvent`)

| Field | Notes |
|-------|-------|
| `id` | cuid |
| `occurredAt` | timestamp |
| `actorUserId` | staff or patient |
| `actorType` | `patient` \| `staff` \| `system` |
| `organizationId` | nullable |
| `practiceProfileId` | nullable |
| `action` | namespaced string |
| `entityType` | e.g. `interpreter_invite`, `consent`, `export` |
| `entityId` | opaque id |
| `result` | `ok` \| `denied` \| `failed` |
| `metadataJson` | whitelist only |

### 7.2 Action namespaces (metadata-only)

| Category | Example actions | Allowed metadata |
|----------|-----------------|------------------|
| Invite | `interpreter.invite.created`, `.revoked`, `.used` | inviteId, inviteType, tokenPrefix, ipHash |
| Export | `interpreter.export.requested`, `.completed` | exportId, format, sessionCount, byteSize |
| Access | `interpreter.session.share.viewed` | clientSessionId, turnCount — **no text** |
| Consent | `consent.granted`, `.revoked` | consentType, version, scope |
| Org admin | `org.member.added`, `org.policy.updated` | targetUserId hash, policy keys |
| Quota | `interpreter.quota.exceeded` | dimension, limit, current |

### 7.3 Explicit prohibitions

- No `originalText`, `translatedText`, `transcript`, `audio`, `prompt`, `payload` keys.  
- Reuse sanitization pattern from `interpreterCloudAudit.js` / `PracticeApiAuditEvent` patterns.  
- CI test: audit writer rejects forbidden keys.

### 7.4 Retention

| Stream | Suggested retention |
|--------|---------------------|
| Invite usage | 90 days |
| Access/share views | 1 year |
| Consent events | 7 years (legal) — metadata only |
| Export job logs | 90 days |

Org-level export of audit for DPA — `audit.export` permission.

---

## 8. Organization dashboard concept (future UI)

Metadata-only sections—no transcript widgets.

| Section | Content |
|---------|---------|
| **Overview** | Active practices, sessions started (count), invites used, languages histogram |
| **Invite management** | Cross-practice table: status, expiry, usage count — drill-down to site |
| **Language coverage** | Configured vs used language pairs (no message content) |
| **Usage & quotas** | Translate minutes, transcribe minutes, TTS chars vs plan |
| **Consent overview** | Count granted/revoked by type — no patient names in aggregate card (*optional: per-site breakdown*) |
| **Export activity** | Recent export jobs, status, who requested |
| **Audit overview** | Filterable audit tail, alert on denied access spikes |

**B2C patient app unchanged** — separate shell under `/practice/.../interpreter`.

---

## 9. Security architecture

| Control | Measure |
|---------|---------|
| Organization isolation | Middleware `requireOrganizationAccess(orgId)` + FK checks |
| Permission boundaries | Server-side matrix; deny by default |
| Membership validation | Every mutating route resolves membership before work |
| Role escalation prevention | No permission bits in JWT; dual-control for org_owner transfer (*policy*) |
| Session access protection | Share consent + short-lived read tokens for export handoff |
| Invite abuse protection | Existing rate limits + `maxUses`, TTL, token hash, prefix-only display |

### 9.1 Threat scenarios

| Threat | Mitigation |
|--------|------------|
| Staff guesses `practiceId` | 403 without `PracticeMember` |
| Staff guesses `organizationId` | 403 without `OrganizationMembership` |
| Cross-org patient enumeration | No API listing patients by org |
| Invite token brute force | Rate limit + long token + hash at rest |
| Audit log PII leak | Whitelist metadata |

---

## 10. Billing readiness (no payment processing)

### 10.1 Entities (planning)

| Entity | Purpose |
|--------|---------|
| `BillingAccount` | `organizationId` (primary) or legacy single `practiceProfileId` |
| `BillingPlan` | SKU: seats, included minutes, realtime flag |
| `UsageMeter` | Daily rollup per org/practice: `translate_chars`, `transcribe_seconds`, `tts_chars`, `invites_active` |
| `QuotaPolicy` | Soft/hard limits on `OrganizationPolicy` |

### 10.2 Billing dimensions

| Model | Meter |
|-------|-------|
| Organization contract | Sum meters across practices |
| Practice sub-account | Meters tagged `practiceProfileId` |
| Seat-based | Active `PracticeMember` + org admins count |
| Usage-based | AI operations (metadata counters only) |
| Realtime add-on | Separate flag; off in default SKU |

### 10.3 Enforcement point

- Quota middleware after membership resolution, before AI routes (6.4).  
- **Do not** block patient local-only mode when quota exceeded—block **server** AI calls only.

*Needs repo verification:* existing Stripe/subscription tables elsewhere in monorepo.

---

## 11. API architecture proposal

### 11.1 Route groups (future)

| Prefix | Audience | Notes |
|--------|----------|-------|
| `/api/organizations` | Staff | CRUD org, members, policies — *needs repo verification* vs existing `/api/practices` |
| `/api/practices` | Staff | Existing practice profile routes; add `organizationId` filter |
| `/api/interpreter/org` | Org admin | Aggregates, policy, cross-practice invites summary |
| `/api/interpreter/practice` | Site staff | **Existing** — keep paths stable |
| `/api/interpreter/audit` | Staff | Query audit with org/practice scope |
| `/api/interpreter/consent` | Patient | Grant/revoke share scopes (patient auth) |
| `/api/interpreter/invite` | Public | Existing public invite status |

### 11.2 Versioning & compatibility

- Keep `?practiceId=` on practice routes for backward compatibility.  
- Org routes use `/api/interpreter/org/:organizationId/...` with membership middleware.  
- Never expose cross-org bulk patient endpoints.

### 11.3 Response shape rules

- List endpoints return counts and ids — not transcript snippets.  
- Export endpoints return async job id + download link after consent verification.

---

## 12. Database / schema proposal

### 12.1 New entities

```prisma
// Illustrative — not migration code

model Organization {
  id            String   @id @default(cuid())
  legalName     String
  displayName   String
  country       String?
  status        String   @default("active")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  memberships   OrganizationMembership[]
  practices     PracticeProfile[]  // via organizationId FK
  policies      OrganizationPolicy?
  billingAccount BillingAccount?
  auditEvents   AuditEvent[]       // optional central table
}

model OrganizationMembership {
  id              String   @id @default(cuid())
  organizationId  String
  userId          String
  role            String   // org_owner | org_admin | org_billing | org_auditor
  status          String   @default("active")
  invitedAt       DateTime?
  acceptedAt      DateTime?
  revokedAt       DateTime?
  @@unique([organizationId, userId])
}

model OrganizationPolicy {
  organizationId       String @id
  interpreterLanguages Json?   // allowlist
  maxInviteTtlHours    Int?
  cloudShareAllowed    Boolean @default(false)
  retentionDays        Int?
  quotaJson            Json?
}

model Department {
  id                String @id @default(cuid())
  practiceProfileId String
  name              String
  isActive          Boolean @default(true)
  @@index([practiceProfileId])
}
```

### 12.2 Existing entity changes (minimal)

| Entity | Change |
|--------|--------|
| `PracticeProfile` | Add optional/required `organizationId` FK (phased migration) |
| `ConsentRecord` | Add `consentType` values for interpreter share; link `clientSessionId` in `metadataJson` |
| `PracticeInterpreterInvite` | Optional `departmentId`, `organizationId` denormalized for audit |

### 12.3 New supporting tables

| Entity | Purpose |
|--------|---------|
| `InterpreterUsageQuota` | Per org/practice period counters |
| `AuditEvent` | Unified metadata audit (or extend `PracticeApiAuditEvent` pattern) |
| `ConsentScope` | Optional normalized view; may alias `ConsentRecord` instead of duplicate |
| `InterpreterSessionShare` | `patientUserId`, `practiceProfileId`, `clientSessionId`, `consentRecordId`, `expiresAt` |

### 12.4 Migration strategy (6.3+ implementation)

1. Add nullable `organizationId` to `PracticeProfile`.  
2. Script: create single-site `Organization` per existing profile (display name = practice name).  
3. Backfill `organizationId`.  
4. Enforce NOT NULL for new enterprise signups only.  
5. No patient data migration required.

---

## 13. Privacy and compliance

### 13.1 GDPR

| Topic | Implication |
|-------|-------------|
| Data controller | Practice/org may be controller for staff actions; MedScoutX processor for cloud AI |
| DPA | Organization-level DPA required for MVZ pilots |
| Data minimization | Org dashboards aggregate only |
| Purpose limitation | Communication support only |
| DPIA | Update when share consent goes live |

### 13.2 Retention & deletion

| Event | Propagation |
|-------|-------------|
| Org deleted (cooling) | Revoke memberships; disable invites; retain audit per legal hold |
| Practice removed from org | Unlink `organizationId`; invites revoked |
| Patient deletes account | Cascade cloud; shares revoked |
| Patient revokes practice share | Delete `InterpreterSessionShare` row; audit `consent.revoked` |

### 13.3 Export rights

- Patient export: existing data control paths + interpreter sessions.  
- Org export: audit metadata only without patient consent.

### 13.4 Regional deployment

- Org `country` drives data residency flag (*needs repo verification* infra).  
- EU orgs: EU DB + EU AI endpoints.

---

## 14. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Organization complexity** | Medium | Phased MVP: org + FK only in 6.3; department later |
| **Consent confusion** | High | Separate toggles; clear DE/EN copy; invite ≠ share |
| **Enterprise over-engineering** | Medium | Legacy single-practice path unchanged |
| **Hidden access risk** | Critical | Deny-by-default + integration tests + security review |
| **Scaling cost** | Medium | Quotas at org level (6.4) |
| **Audit growth** | Low | TTL + partitioned table by month |
| **MDR boundary drift** | Critical | No clinical features in org dashboard |
| **Owner vs org_owner conflict** | Medium | Document precedence rules |

---

## 15. What should NOT be implemented yet

| Item | Defer to |
|------|----------|
| Patient transcript visibility for practices | Phase 6.3 consent + share UI |
| Organization-wide patient search | Never without explicit product/legal approval |
| `interpreter_org_share` default on invite | Phase 6.3+ with explicit UX |
| Department-based ACL | Post-6.3 |
| Payment / Stripe | Phase 6.4 |
| SSO / SAML | *needs repo verification* of priority |
| Cross-practice shared patient chart | Out of scope |
| Realtime production defaults | Stays off |
| Automatic org creation on patient registration | Staff-driven only |
| Diagnosis / triage / treatment features | Forbidden |
| Moving practices between orgs silently | Admin process + audit |

---

## 16. Recommended implementation order (Phase 6.3+)

Aligned with Phase 6.1 roadmap; **6.2 is planning only**.

| Phase | Deliverable | Depends on |
|-------|-------------|------------|
| **6.3a** | Schema: `Organization`, `OrganizationMembership`, `PracticeProfile.organizationId` + migration backfill | 6.2 plan approved |
| **6.3b** | Middleware: `requireOrganizationAccess`, org permission matrix | 6.3a |
| **6.3c** | APIs: `/api/organizations`, `/api/interpreter/org/overview` (metadata) | 6.3b |
| **6.3d** | Consent: `interpreter_practice_share`, `SessionConsentLink`, patient grant/revoke API — see [PHASE_6_3_ENTERPRISE_COMPLIANCE_PLAN.md](./PHASE_6_3_ENTERPRISE_COMPLIANCE_PLAN.md) | 6.3a |
| **6.3e** | Staff read-only shared session view (consent-gated) + access audit | 6.3d |
| **6.3f** | Unified `AuditEvent` writer + interpreter audit routes | 6.3b |
| **6.3g** | Split permissions: `interpreter.invite`, `interpreter.export` + UI | 6.3c |
| **6.4** | Usage/quota/billing — see [PHASE_6_4_BILLING_QUOTA_PLAN.md](./PHASE_6_4_BILLING_QUOTA_PLAN.md) | 6.3a, 6.2 org |
| **6.5** | Observability without text (org dashboards operational) | 6.3c |
| **6.6** | International org language allowlist | 6.4 |
| **6.7** | Enterprise pilot package | 6.3e–6.5 |

**Parallel track:** Department table + invite `departmentId` optional after 6.3c.

**Explicitly not in 6.3:** Payment capture, SSO, org-level patient lists, clinical integrations.

---

## Appendix A — Mapping today’s interpreter permissions

| Today | Proposed split |
|-------|----------------|
| `interpreter.view` | unchanged |
| `interpreter.manage` | invite revoke + policy (or split) |
| `interpreter.admin` | practice-level policy + quota read |
| (missing) | `interpreter.invite`, `interpreter.export` |

---

## Appendix B — Open questions (*needs repo verification*)

1. Can one `User` own multiple `PracticeProfile` rows today?  
2. Is `/api/practices` router the canonical CRUD for `PracticeProfile`?  
3. Existing `PracticeApiAuditEvent` — extend vs new `AuditEvent` table?  
4. JWT payload shape (`userId` vs `id`).  
5. Existing billing/subscription models in monorepo for reuse.  
6. Legal relationship: org as controller vs processor for interpreter share.  
7. Whether `patientPracticeOrganization.js` naming implies future org entity or only doctor listing.

---

*Document version: Phase 6.2 planning — no code changes. Do not implement without a separate implementation request.*
