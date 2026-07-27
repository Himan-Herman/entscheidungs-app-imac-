/**
 * Tenant isolation for patient-scoped practice routes.
 *
 * Runs WITHOUT a database: the shared Prisma singleton is replaced by an
 * in-memory fake, so the real authorization chain executes end to end
 * (authorizePracticePatientLink -> getPracticeAccess -> linkHasConsentType).
 *
 * Fixture:
 *   Practice A (owner ownerA)   -- staff: doctorA, secretaryA, invitedA, revokedA
 *   Practice B (owner ownerB)   -- staff: doctorB
 *   Patient P                   -- linked to BOTH practices (linkA, linkB)
 *   Outsider                    -- authenticated user with no practice at all
 */
import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../lib/prisma.js";
import {
  authorizePracticePatientLink,
  evaluatePracticePatientLinkAccess,
} from "../services/authorization/practicePatientLinkAuthorization.js";
import { getPracticeAccess, accessHasPermission } from "../utils/practiceAccess.js";
import {
  PERMISSIONS,
  PRACTICE_ROLES,
  REQUIRES_VERIFIED_QUALIFICATION,
  hasPracticePermission,
} from "../utils/practicePermissions.js";

/* ------------------------------------------------------------------ fixture */

const PRACTICE_A = "practice-A";
const PRACTICE_B = "practice-B";

const USERS = {
  ownerA: "user-owner-A",
  doctorA: "user-doctor-A",
  secretaryA: "user-secretary-A",
  invitedA: "user-invited-A",
  revokedA: "user-revoked-A",
  ownerB: "user-owner-B",
  doctorB: "user-doctor-B",
  patientP: "user-patient-P",
  outsider: "user-outsider",
};

const LINK_A = {
  id: "link-A",
  practiceProfileId: PRACTICE_A,
  patientUserId: USERS.patientP,
  status: "active",
  consentAcceptedAt: new Date("2026-01-01"),
  consentScopes: [],
};

const LINK_B = {
  id: "link-B",
  practiceProfileId: PRACTICE_B,
  patientUserId: USERS.patientP,
  status: "active",
  consentAcceptedAt: new Date("2026-01-01"),
  consentScopes: [],
};

const PRACTICES = [
  { id: PRACTICE_A, userId: USERS.ownerA },
  { id: PRACTICE_B, userId: USERS.ownerB },
];

const MEMBERS = [
  { practiceProfileId: PRACTICE_A, userId: USERS.doctorA, role: "doctor", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: USERS.secretaryA, role: "secretary", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: USERS.invitedA, role: "doctor", status: "invited" },
  { practiceProfileId: PRACTICE_A, userId: USERS.revokedA, role: "doctor", status: "revoked" },
  { practiceProfileId: PRACTICE_B, userId: USERS.doctorB, role: "doctor", status: "active" },
];

/** Granted consent records, keyed per link. Both links consent to everything. */
const CONSENTS = [
  { practicePatientLinkId: "link-A", consentType: "vitals_access", status: "granted" },
  { practicePatientLinkId: "link-A", consentType: "prescriptions_access", status: "granted" },
  { practicePatientLinkId: "link-A", consentType: "health_history_access", status: "granted" },
  { practicePatientLinkId: "link-A", consentType: "vaccinations_access", status: "granted" },
  { practicePatientLinkId: "link-B", consentType: "vitals_access", status: "granted" },
  { practicePatientLinkId: "link-B", consentType: "prescriptions_access", status: "granted" },
];

/** Mutable per-test overrides. */
let links = [];
let consents = [];

function installPrismaFake() {
  links = [{ ...LINK_A }, { ...LINK_B }];
  consents = CONSENTS.map((c) => ({ ...c }));

  prisma.practicePatientLink = {
    findUnique: async ({ where }) => links.find((l) => l.id === where.id) ?? null,
  };
  prisma.practiceProfile = {
    findUnique: async ({ where }) => PRACTICES.find((p) => p.id === where.id) ?? null,
  };
  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      return (
        MEMBERS.find(
          (m) => m.practiceProfileId === practiceProfileId && m.userId === userId,
        ) ?? null
      );
    },
  };
  prisma.consentRecord = {
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
    findFirst: async ({ where }) =>
      consents.find(
        (c) =>
          c.practicePatientLinkId === where.practicePatientLinkId &&
          c.consentType === where.consentType &&
          c.status === where.status,
      ) ?? null,
  };
  // Security events are written through writeAuditLog -> auditLog.create.
  prisma.auditLog = { create: async () => ({}) };
}

test.beforeEach(() => installPrismaFake());

/** Convenience wrapper mirroring what the route middleware passes in. */
function authorize(actorUserId, linkId, opts = {}) {
  return authorizePracticePatientLink({
    actorUserId,
    linkId,
    requiredPermission: opts.permission ?? PERMISSIONS.PATIENT_LINKS_READ,
    requiredConsentType: opts.consentType ?? null,
    clientPracticeId: opts.clientPracticeId ?? null,
  });
}

/* ------------------------------------------------- 1 + 2: cross-tenant read */

test("practice B cannot READ a link belonging to practice A", async () => {
  for (const actor of [USERS.ownerB, USERS.doctorB]) {
    const res = await authorize(actor, LINK_A.id, { consentType: "vitals_access" });
    assert.equal(res.ok, false, `${actor} must not read link-A`);
    assert.equal(res.reason, "link_not_found");
    assert.equal(res.status, 404, "must not reveal that a foreign link exists");
  }
});

test("practice B cannot WRITE against a link belonging to practice A", async () => {
  const res = await authorize(USERS.doctorB, LINK_A.id, {
    permission: PERMISSIONS.PRESCRIPTION_ISSUE,
    consentType: "prescriptions_access",
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
});

test("practice A keeps access to its own link (positive control)", async () => {
  const res = await authorize(USERS.doctorA, LINK_A.id, { consentType: "vitals_access" });
  assert.equal(res.ok, true);
  assert.equal(res.practiceProfileId, PRACTICE_A);
  assert.equal(res.patientUserId, USERS.patientP);
  assert.equal(res.role, "doctor");
});

test("the same patient at two practices stays separated in both directions", async () => {
  assert.equal((await authorize(USERS.doctorA, LINK_B.id)).ok, false);
  assert.equal((await authorize(USERS.doctorB, LINK_A.id)).ok, false);
  assert.equal((await authorize(USERS.doctorA, LINK_A.id)).ok, true);
  assert.equal((await authorize(USERS.doctorB, LINK_B.id)).ok, true);
});

/* --------------------------------------------------------- 3: patient itself */

test("the patient cannot call a practice route, not even with their OWN linkId", async () => {
  for (const linkId of [LINK_A.id, LINK_B.id]) {
    const res = await authorize(USERS.patientP, linkId, { consentType: "vitals_access" });
    assert.equal(res.ok, false, `patient must not act as practice on ${linkId}`);
    assert.equal(res.status, 404);
  }
});

test("an unrelated authenticated user gets nothing", async () => {
  const res = await authorize(USERS.outsider, LINK_A.id);
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
});

/* ------------------------------------------------ 4 + 5: invited and revoked */

test("an INVITED (not yet active) member gets no access", async () => {
  const res = await authorize(USERS.invitedA, LINK_A.id, { consentType: "vitals_access" });
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
});

test("a REVOKED member gets no access", async () => {
  const res = await authorize(USERS.revokedA, LINK_A.id, { consentType: "vitals_access" });
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
});

/* ------------------------------------------------------ 6: practiceId spoof */

test("a forged practiceId does not grant access and does not override the link", async () => {
  // Practice B's doctor claims to be acting for practice B on practice A's link.
  const spoof = await authorize(USERS.doctorB, LINK_A.id, {
    clientPracticeId: PRACTICE_B,
    consentType: "vitals_access",
  });
  assert.equal(spoof.ok, false);
  assert.equal(spoof.status, 404);

  // Practice A's own doctor sending a mismatched practiceId is rejected too.
  const mismatch = await authorize(USERS.doctorA, LINK_A.id, {
    clientPracticeId: PRACTICE_B,
    consentType: "vitals_access",
  });
  assert.equal(mismatch.ok, false, "mismatched client practiceId must be rejected");
  assert.equal(mismatch.status, 404);

  // A matching practiceId is accepted, and the tenant still comes from the link.
  const match = await authorize(USERS.doctorA, LINK_A.id, {
    clientPracticeId: PRACTICE_A,
    consentType: "vitals_access",
  });
  assert.equal(match.ok, true);
  assert.equal(match.practiceProfileId, PRACTICE_A);
});

/* ------------------------------------------- 7: e-Rezept verbs and role gates */

test("e-Rezept writes are denied to EVERY role, including owner and doctor", async () => {
  const writeOps = [PERMISSIONS.PRESCRIPTION_ISSUE, PERMISSIONS.PRESCRIPTION_CANCEL];

  for (const permission of writeOps) {
    // Patient: not practice staff at all -> indistinguishable 404.
    const patient = await authorize(USERS.patientP, LINK_A.id, {
      permission,
      consentType: "prescriptions_access",
    });
    assert.equal(patient.ok, false, `patient must not hold ${permission}`);
    assert.equal(patient.status, 404);

    // Active staff, including the owner and a doctor: 403, because no role
    // carries a verified medical qualification in this data model.
    for (const actor of [USERS.ownerA, USERS.doctorA, USERS.secretaryA]) {
      const res = await authorize(actor, LINK_A.id, {
        permission,
        consentType: "prescriptions_access",
      });
      assert.equal(res.ok, false, `${actor} must not hold ${permission}`);
      assert.equal(res.reason, "forbidden");
      assert.equal(res.status, 403);
    }
  }
});

test("e-Rezept is not even readable by any role (deny by default)", async () => {
  // Reading a prescription is withheld too: neither "owner" nor "doctor" can be
  // verified as professionally authorized, so nothing justifies the access.
  for (const actor of [USERS.ownerA, USERS.doctorA, USERS.secretaryA]) {
    const res = await authorize(actor, LINK_A.id, {
      permission: PERMISSIONS.PRESCRIPTION_READ,
      consentType: "prescriptions_access",
    });
    assert.equal(res.ok, false, `${actor} must not read prescriptions`);
    assert.equal(res.reason, "forbidden");
    assert.equal(res.status, 403);
  }

  // The patient is not practice staff -> indistinguishable 404, not 403.
  const patient = await authorize(USERS.patientP, LINK_A.id, {
    permission: PERMISSIONS.PRESCRIPTION_READ,
    consentType: "prescriptions_access",
  });
  assert.equal(patient.ok, false);
  assert.equal(patient.status, 404);
});

/* ------------------- full role x clinical permission matrix (deny by default) */

/**
 * The single source of truth for this test: which role may hold which clinical
 * permission. Everything not listed here must be denied.
 */
const EXPECTED_CLINICAL_MATRIX = {
  owner:            { vitals: false, vaccinations: false, history: false, sos: false, ai: false },
  admin:            { vitals: false, vaccinations: false, history: false, sos: false, ai: false },
  practice_manager: { vitals: false, vaccinations: false, history: false, sos: false, ai: false },
  doctor:           { vitals: true,  vaccinations: true,  history: true,  sos: true,  ai: false },
  assistant:        { vitals: false, vaccinations: false, history: false, sos: false, ai: false },
  secretary:        { vitals: false, vaccinations: false, history: false, sos: false, ai: false },
  viewer:           { vitals: false, vaccinations: false, history: false, sos: false, ai: false },
};

const CLINICAL_PERMISSION_BY_KEY = {
  vitals: PERMISSIONS.CLINICAL_VITALS_READ,
  vaccinations: PERMISSIONS.CLINICAL_VACCINATIONS_READ,
  history: PERMISSIONS.CLINICAL_HEALTH_HISTORY_READ,
  sos: PERMISSIONS.CLINICAL_SOS_READ,
  ai: PERMISSIONS.CLINICAL_AI_SUMMARY_GENERATE,
};

test("every role x every clinical permission matches the expected matrix", () => {
  // Guard against a role being added without a decision being recorded here.
  assert.deepEqual(
    Object.keys(EXPECTED_CLINICAL_MATRIX).sort(),
    [...PRACTICE_ROLES].sort(),
    "every practice role needs an explicit clinical decision",
  );

  for (const [role, expectations] of Object.entries(EXPECTED_CLINICAL_MATRIX)) {
    for (const [key, expected] of Object.entries(expectations)) {
      assert.equal(
        hasPracticePermission(role, CLINICAL_PERMISSION_BY_KEY[key]),
        expected,
        `${role} x ${key}: expected ${expected}`,
      );
    }
  }
});

test("PATIENT_LINKS_READ never implies any clinical permission", () => {
  const linkReaders = PRACTICE_ROLES.filter((r) =>
    hasPracticePermission(r, PERMISSIONS.PATIENT_LINKS_READ),
  );
  assert.ok(linkReaders.length >= 5, "control: the administrative right is broadly held");

  for (const role of linkReaders) {
    if (role === "doctor") continue; // holds clinical rights on its own merit
    for (const permission of Object.values(CLINICAL_PERMISSION_BY_KEY)) {
      assert.equal(
        hasPracticePermission(role, permission), false,
        `${role} holds PATIENT_LINKS_READ but must not hold ${permission}`,
      );
    }
  }
});

test("secretary and viewer hold no clinical data permission at all", () => {
  for (const role of ["secretary", "viewer"]) {
    for (const permission of Object.values(CLINICAL_PERMISSION_BY_KEY)) {
      assert.equal(hasPracticePermission(role, permission), false, `${role}/${permission}`);
    }
    assert.equal(hasPracticePermission(role, PERMISSIONS.PRESCRIPTION_READ), false, role);
  }
});

test("administrative and ownership roles gain no clinical access from their role", () => {
  for (const role of ["admin", "practice_manager", "owner"]) {
    // Control: they really do hold strong administrative rights.
    assert.equal(hasPracticePermission(role, PERMISSIONS.SETTINGS_MANAGE), true, role);
    // But none of that reaches health data.
    for (const permission of Object.values(CLINICAL_PERMISSION_BY_KEY)) {
      assert.equal(hasPracticePermission(role, permission), false, `${role}/${permission}`);
    }
  }
});

test("reading the health history never implies AI processing of it", () => {
  const historyReaders = PRACTICE_ROLES.filter((r) =>
    hasPracticePermission(r, PERMISSIONS.CLINICAL_HEALTH_HISTORY_READ),
  );
  assert.ok(historyReaders.length > 0, "control: someone can read the history");
  for (const role of historyReaders) {
    assert.equal(
      hasPracticePermission(role, PERMISSIONS.CLINICAL_AI_SUMMARY_GENERATE), false,
      `${role} may read the history but must not hold the AI processing right`,
    );
  }
});

test("an unknown or future role receives no permission whatsoever", () => {
  // Note: hasPracticePermission trims surrounding whitespace, so "doctor " is
  // normalized to "doctor". That is pre-existing normalization and not an
  // escalation path — the role comes from PracticeMember, not from request
  // input — so it is deliberately not listed as an unknown role here.
  for (const role of ["superuser", "clinician", "physician", "", null, undefined, "OWNER", "Doctor"]) {
    for (const permission of Object.values(PERMISSIONS)) {
      assert.equal(
        hasPracticePermission(role, permission), false,
        `unknown role ${String(role)} must not hold ${permission}`,
      );
    }
  }
});

test("no role holds a permission that requires a verified qualification", () => {
  for (const role of PRACTICE_ROLES) {
    for (const permission of REQUIRES_VERIFIED_QUALIFICATION) {
      assert.equal(
        hasPracticePermission(role, permission), false,
        `${role} must not hold ${permission}`,
      );
    }
  }
});

test("a general medication write right does not imply the right to prescribe", () => {
  // practice_manager holds MEDICATION_WRITE but must not issue prescriptions.
  assert.equal(hasPracticePermission("practice_manager", PERMISSIONS.MEDICATION_WRITE), true);
  assert.equal(hasPracticePermission("practice_manager", PERMISSIONS.PRESCRIPTION_ISSUE), false);
  assert.equal(hasPracticePermission("admin", PERMISSIONS.MEDICATION_PUBLISH), true);
  assert.equal(hasPracticePermission("admin", PERMISSIONS.PRESCRIPTION_ISSUE), false);
  // The owner has every other permission but is an organizational role.
  assert.equal(hasPracticePermission("owner", PERMISSIONS.MEDICATION_PUBLISH), true);
  assert.equal(hasPracticePermission("owner", PERMISSIONS.PRESCRIPTION_ISSUE), false);

  // Deny by default: no role at all may issue or cancel.
  for (const role of PRACTICE_ROLES) {
    assert.equal(
      hasPracticePermission(role, PERMISSIONS.PRESCRIPTION_ISSUE), false,
      `${role} must not hold PRESCRIPTION_ISSUE without a verified qualification`,
    );
    assert.equal(hasPracticePermission(role, PERMISSIONS.PRESCRIPTION_CANCEL), false, role);
  }

  // Reading is denied for every role too, for the same reason.
  for (const role of PRACTICE_ROLES) {
    assert.equal(hasPracticePermission(role, PERMISSIONS.PRESCRIPTION_READ), false, role);
  }
});

/* -------------------------------------------------------------- 8: consent */

test("missing or revoked consent blocks access even for the correct practice", async () => {
  // No granted record for this type at all.
  const missing = await authorize(USERS.doctorA, LINK_A.id, {
    consentType: "health_history_access",
  });
  assert.equal(missing.ok, true, "control: consent exists in fixture");

  consents = consents.filter((c) => c.consentType !== "health_history_access");
  const revoked = await authorize(USERS.doctorA, LINK_A.id, {
    consentType: "health_history_access",
  });
  assert.equal(revoked.ok, false);
  assert.equal(revoked.reason, "consent_required");
  assert.equal(revoked.status, 403);
});

test("an empty consentScopes array never grants access by default", async () => {
  // link-B has no vaccinations consent record and an empty legacy scope array.
  const res = await authorize(USERS.doctorB, LINK_B.id, {
    consentType: "vaccinations_access",
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "consent_required");
});

test("an inactive link is rejected before any data access", async () => {
  links = links.map((l) => (l.id === LINK_A.id ? { ...l, status: "revoked" } : l));
  const res = await authorize(USERS.doctorA, LINK_A.id, { consentType: "vitals_access" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "link_inactive");
  assert.equal(res.status, 403);
});

/* ------------------------------------------ 9: no foreign data in the result */

test("an authorized result exposes only the caller's own tenant", async () => {
  const res = await authorize(USERS.doctorA, LINK_A.id, { consentType: "vitals_access" });
  assert.equal(res.ok, true);

  const serialized = JSON.stringify(res);
  assert.ok(!serialized.includes(PRACTICE_B), "must not leak practice B's id");
  assert.ok(!serialized.includes(LINK_B.id), "must not leak practice B's link id");
  assert.equal(res.practiceProfileId, PRACTICE_A);
});

test("a denial reveals nothing about the foreign link", async () => {
  const res = await authorize(USERS.doctorB, LINK_A.id, { consentType: "vitals_access" });
  assert.deepEqual(Object.keys(res).sort(), ["ok", "reason", "status"]);
  assert.ok(!JSON.stringify(res).includes(PRACTICE_A));
  assert.ok(!JSON.stringify(res).includes(USERS.patientP));
});

/* ------------- owner (organizational) vs membership (occupational) role ---- */

/**
 * Exercises the real getPracticeAccess against a controllable fixture:
 * one practice whose owner may additionally hold a membership row.
 */
async function accessForOwnerWithMembership(member) {
  prisma.practiceProfile = {
    findUnique: async ({ where }) =>
      where.id === PRACTICE_A ? { id: PRACTICE_A, userId: USERS.ownerA } : null,
  };
  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      const { userId } = where.practiceProfileId_userId;
      if (userId === USERS.ownerA) return member;
      return MEMBERS.find((m) => m.userId === userId) ?? null;
    },
  };
  return getPracticeAccess(USERS.ownerA, PRACTICE_A);
}

const CLINICAL_PERMS = [
  PERMISSIONS.CLINICAL_VITALS_READ,
  PERMISSIONS.CLINICAL_VACCINATIONS_READ,
  PERMISSIONS.CLINICAL_HEALTH_HISTORY_READ,
  PERMISSIONS.CLINICAL_SOS_READ,
];

test("owner WITHOUT any membership gets admin rights but no clinical rights", async () => {
  const access = await accessForOwnerWithMembership(null);
  assert.equal(access.isOwner, true);
  assert.equal(access.membershipRole, null);
  assert.equal(access.membershipStatus, null);
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), true, "keeps admin power");
  assert.equal(accessHasPermission(access, PERMISSIONS.TEAM_MANAGE), true);
  for (const p of CLINICAL_PERMS) {
    assert.equal(accessHasPermission(access, p), false, `owner alone must not hold ${p}`);
  }
});

test("owner WITH an active doctor membership gains the doctor clinical rights", async () => {
  const access = await accessForOwnerWithMembership({
    id: "m1", userId: USERS.ownerA, role: "doctor", status: "active",
  });
  assert.equal(access.isOwner, true);
  assert.equal(access.membershipRole, "doctor");
  assert.equal(access.membershipStatus, "active");
  // Union: owner administration ...
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), true);
  assert.equal(accessHasPermission(access, PERMISSIONS.TEAM_MANAGE), true);
  // ... plus doctor clinical rights.
  for (const p of CLINICAL_PERMS) {
    assert.equal(accessHasPermission(access, p), true, `owner+doctor should hold ${p}`);
  }
});

test("owner with an INVITED doctor membership gains no clinical rights", async () => {
  const access = await accessForOwnerWithMembership({
    id: "m1", userId: USERS.ownerA, role: "doctor", status: "invited",
  });
  assert.equal(access.isOwner, true);
  assert.equal(access.membershipStatus, "invited");
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), true, "owner rights stay");
  for (const p of CLINICAL_PERMS) {
    assert.equal(accessHasPermission(access, p), false, `invited must not grant ${p}`);
  }
});

test("owner with a REVOKED doctor membership gains no clinical rights", async () => {
  const access = await accessForOwnerWithMembership({
    id: "m1", userId: USERS.ownerA, role: "doctor", status: "revoked",
  });
  assert.equal(access.membershipStatus, "revoked");
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), true);
  for (const p of CLINICAL_PERMS) {
    assert.equal(accessHasPermission(access, p), false, `revoked must not grant ${p}`);
  }
});

test("owner with an active ASSISTANT membership still gains no clinical rights", async () => {
  const access = await accessForOwnerWithMembership({
    id: "m1", userId: USERS.ownerA, role: "assistant", status: "active",
  });
  assert.equal(access.membershipRole, "assistant");
  for (const p of CLINICAL_PERMS) {
    assert.equal(accessHasPermission(access, p), false, `assistant must not grant ${p}`);
  }
});

test("owner with the default owner membership behaves like a plain owner", async () => {
  // This is what practice creation actually writes today.
  const access = await accessForOwnerWithMembership({
    id: "m1", userId: USERS.ownerA, role: "owner", status: "active",
  });
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), true);
  for (const p of CLINICAL_PERMS) {
    assert.equal(accessHasPermission(access, p), false);
  }
});

test("an unknown membership role adds nothing to the owner's permissions", async () => {
  const access = await accessForOwnerWithMembership({
    id: "m1", userId: USERS.ownerA, role: "chief-wizard", status: "active",
  });
  const ownerOnly = await accessForOwnerWithMembership(null);
  assert.deepEqual(
    [...access.effectivePermissions].sort(),
    [...ownerOnly.effectivePermissions].sort(),
    "an unrecognised role must contribute an empty allowlist",
  );
});

test("the permission union never yields prescription or AI processing rights", async () => {
  for (const member of [
    null,
    { id: "m1", userId: USERS.ownerA, role: "doctor", status: "active" },
    { id: "m1", userId: USERS.ownerA, role: "admin", status: "active" },
    { id: "m1", userId: USERS.ownerA, role: "owner", status: "active" },
  ]) {
    const access = await accessForOwnerWithMembership(member);
    for (const permission of REQUIRES_VERIFIED_QUALIFICATION) {
      assert.equal(
        accessHasPermission(access, permission), false,
        `union must not produce ${permission}`,
      );
    }
  }
});

test("a plain doctor without ownership is unaffected by the union logic", async () => {
  installPrismaFake();
  const access = await getPracticeAccess(USERS.doctorA, PRACTICE_A);
  assert.equal(access.isOwner, false);
  assert.equal(access.membershipRole, "doctor");
  assert.equal(access.role, "doctor", "legacy role field unchanged");
  for (const p of CLINICAL_PERMS) {
    assert.equal(accessHasPermission(access, p), true);
  }
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), false, "no owner rights");
});

test("a user with neither ownership nor an active membership gets no access object", async () => {
  installPrismaFake();
  assert.equal(await getPracticeAccess(USERS.outsider, PRACTICE_A), null);
  assert.equal(await getPracticeAccess(USERS.invitedA, PRACTICE_A), null, "invited");
  assert.equal(await getPracticeAccess(USERS.revokedA, PRACTICE_A), null, "revoked");
});

/* --------------------------------------------------- decision core (no I/O) */

test("the pure decision core denies whenever any single condition fails", () => {
  const base = {
    actorUserId: USERS.doctorA,
    link: { ...LINK_A },
    access: { role: "doctor" },
    requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
    requiredConsentType: "vitals_access",
    hasConsent: true,
  };
  assert.equal(evaluatePracticePatientLinkAccess(base).ok, true);

  assert.equal(evaluatePracticePatientLinkAccess({ ...base, actorUserId: "" }).ok, false);
  assert.equal(evaluatePracticePatientLinkAccess({ ...base, link: null }).ok, false);
  assert.equal(evaluatePracticePatientLinkAccess({ ...base, access: null }).ok, false);
  assert.equal(evaluatePracticePatientLinkAccess({ ...base, hasConsent: false }).ok, false);
  assert.equal(
    evaluatePracticePatientLinkAccess({ ...base, access: { role: "viewer" },
      requiredPermission: PERMISSIONS.PRESCRIPTION_ISSUE }).ok,
    false,
  );
  assert.equal(
    evaluatePracticePatientLinkAccess({ ...base, link: { ...LINK_A, status: "archived" } }).ok,
    false,
  );
  assert.equal(
    evaluatePracticePatientLinkAccess({ ...base, clientPracticeId: PRACTICE_B }).ok,
    false,
  );
});

test("an unknown role is denied (deny by default)", () => {
  const res = evaluatePracticePatientLinkAccess({
    actorUserId: USERS.doctorA,
    link: { ...LINK_A },
    access: { role: "totally-made-up" },
    requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "forbidden");
});
