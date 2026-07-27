/**
 * Clinical role assignment: a practice owner may additionally hold an approved
 * doctor role, without ever being able to escalate themselves.
 *
 * Unit level (getPracticeAccess + changeClinicalRole) plus real HTTP against
 * the team router. Prisma is replaced by an in-memory adapter, so no database
 * is required; routes, middleware and error mapping run for real.
 *
 * Fixture — practice A (owner ownerA):
 *   ownerA      membership role=owner,  active
 *   adminA      membership role=admin,  active   (may approve)
 *   admin2A     membership role=admin,  active   (second approver)
 *   assistantA  membership role=assistant, active (may NOT approve)
 *   doctorA     membership role=doctor, active   (legacy clinical via role)
 *   invitedAdminA / revokedAdminA                (may NOT approve)
 * Practice B is a separate tenant used for the 404 probes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-clinical-role";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getPracticeAccess, accessHasPermission } from "../utils/practiceAccess.js";
import { PERMISSIONS, PRACTICE_ROLES, hasPracticePermission } from "../utils/practicePermissions.js";
import { changeClinicalRole } from "../services/practiceTeam/practiceClinicalRoleService.js";

const PRACTICE_A = "practice-A";
const PRACTICE_B = "practice-B";

const U = {
  ownerA: "user-owner-A",
  adminA: "user-admin-A",
  admin2A: "user-admin2-A",
  assistantA: "user-assistant-A",
  doctorA: "user-doctor-A",
  invitedAdminA: "user-invited-admin-A",
  revokedAdminA: "user-revoked-admin-A",
  ownerB: "user-owner-B",
  outsider: "user-outsider",
};

const CLINICAL_PERMS = [
  PERMISSIONS.CLINICAL_VITALS_READ,
  PERMISSIONS.CLINICAL_VACCINATIONS_READ,
  PERMISSIONS.CLINICAL_HEALTH_HISTORY_READ,
  PERMISSIONS.CLINICAL_SOS_READ,
];

const PRACTICES = [
  { id: PRACTICE_A, userId: U.ownerA, practiceName: "Praxis A" },
  { id: PRACTICE_B, userId: U.ownerB, practiceName: "Praxis B" },
];

let members;
let auditRows;

function baseMembers() {
  return [
    { id: "m-owner", practiceProfileId: PRACTICE_A, userId: U.ownerA, role: "owner", status: "active" },
    { id: "m-admin", practiceProfileId: PRACTICE_A, userId: U.adminA, role: "admin", status: "active" },
    { id: "m-admin2", practiceProfileId: PRACTICE_A, userId: U.admin2A, role: "admin", status: "active" },
    { id: "m-assistant", practiceProfileId: PRACTICE_A, userId: U.assistantA, role: "assistant", status: "active" },
    { id: "m-doctor", practiceProfileId: PRACTICE_A, userId: U.doctorA, role: "doctor", status: "active" },
    { id: "m-invited", practiceProfileId: PRACTICE_A, userId: U.invitedAdminA, role: "admin", status: "invited" },
    { id: "m-revoked", practiceProfileId: PRACTICE_A, userId: U.revokedAdminA, role: "admin", status: "revoked" },
    { id: "m-ownerB", practiceProfileId: PRACTICE_B, userId: U.ownerB, role: "owner", status: "active" },
  ].map((m) => ({
    clinicalRole: null,
    clinicalRoleStatus: null,
    clinicalRoleRequestedAt: null,
    clinicalRoleApprovedAt: null,
    clinicalRoleApprovedByUserId: null,
    ...m,
  }));
}

function installPrismaFake() {
  members = baseMembers();
  auditRows = [];
  prisma.practiceProfile = {
    findUnique: async ({ where }) => PRACTICES.find((p) => p.id === where.id) ?? null,
  };
  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      if (where.id) {
        const row = members.find((m) => m.id === where.id);
        if (!row) return null;
        const practice = PRACTICES.find((p) => p.id === row.practiceProfileId);
        return { ...row, practiceProfile: { id: practice.id, userId: practice.userId } };
      }
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      return (
        members.find((m) => m.practiceProfileId === practiceProfileId && m.userId === userId) ?? null
      );
    },
    updateMany: async ({ where, data }) => {
      const row = members.find(
        (m) => m.id === where.id && (m.clinicalRoleStatus ?? null) === (where.clinicalRoleStatus ?? null),
      );
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  };
  prisma.auditLog = {
    create: async ({ data }) => {
      auditRows.push(data);
      return data;
    },
  };
}

test.beforeEach(() => installPrismaFake());

const membershipOf = (userId) => members.find((m) => m.userId === userId);

/* ------------------------------------------------------------- unit level */

test("1) owner without a clinical role has no clinical rights", async () => {
  const access = await getPracticeAccess(U.ownerA, PRACTICE_A);
  assert.equal(access.isOwner, true);
  assert.equal(access.organizationalRole, "owner");
  assert.equal(access.clinicalRole, null);
  assert.equal(access.clinicalRoleStatus, null);
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), true);
  for (const p of CLINICAL_PERMS) assert.equal(accessHasPermission(access, p), false, p);
});

test("2) owner with a PENDING doctor role has no clinical rights", async () => {
  await changeClinicalRole({
    actorUserId: U.ownerA, membershipId: "m-owner", action: "request",
  });
  const access = await getPracticeAccess(U.ownerA, PRACTICE_A);
  assert.equal(access.clinicalRoleStatus, "pending");
  for (const p of CLINICAL_PERMS) assert.equal(accessHasPermission(access, p), false, p);
});

test("3) owner with an ACTIVE doctor role holds owner AND doctor rights", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  await changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-owner", action: "approve" });

  const access = await getPracticeAccess(U.ownerA, PRACTICE_A);
  assert.equal(access.isOwner, true, "still the owner");
  assert.equal(access.organizationalRole, "owner", "organizational role unchanged");
  assert.equal(access.clinicalRole, "doctor");
  assert.equal(access.clinicalRoleStatus, "active");
  // Owner administration ...
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), true);
  assert.equal(accessHasPermission(access, PERMISSIONS.TEAM_MANAGE), true);
  // ... plus clinical rights.
  for (const p of CLINICAL_PERMS) assert.equal(accessHasPermission(access, p), true, p);
});

test("4) owner with a REVOKED doctor role loses the clinical rights again", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  await changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-owner", action: "approve" });
  await changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-owner", action: "revoke" });

  const access = await getPracticeAccess(U.ownerA, PRACTICE_A);
  assert.equal(access.clinicalRoleStatus, "revoked");
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), true, "owner rights stay");
  for (const p of CLINICAL_PERMS) assert.equal(accessHasPermission(access, p), false, p);
});

test("5) the owner cannot approve their own clinical role", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  await assert.rejects(
    () => changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "approve" }),
    /self_approval_forbidden/,
  );
  assert.equal(membershipOf(U.ownerA).clinicalRoleStatus, "pending", "still pending");
});

test("6) an admin cannot make themselves a doctor", async () => {
  await changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-admin", action: "request" });
  await assert.rejects(
    () => changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-admin", action: "approve" }),
    /self_approval_forbidden/,
  );
  const access = await getPracticeAccess(U.adminA, PRACTICE_A);
  for (const p of CLINICAL_PERMS) assert.equal(accessHasPermission(access, p), false, p);
});

test("7) a second eligible admin can approve the owner's request", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  const result = await changeClinicalRole({
    actorUserId: U.admin2A, membershipId: "m-owner", action: "approve",
  });
  assert.equal(result.clinicalRoleStatus, "active");
  assert.equal(membershipOf(U.ownerA).clinicalRoleApprovedByUserId, U.admin2A);
});

test("8) an assistant cannot assign clinical roles", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  for (const action of ["approve", "reject"]) {
    await assert.rejects(
      () => changeClinicalRole({ actorUserId: U.assistantA, membershipId: "m-owner", action }),
      /forbidden/,
      `assistant must not ${action}`,
    );
  }
  assert.equal(hasPracticePermission("assistant", PERMISSIONS.CLINICAL_ROLE_MANAGE), false);
});

test("9) invited and revoked admins cannot approve", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  for (const actor of [U.invitedAdminA, U.revokedAdminA]) {
    await assert.rejects(
      () => changeClinicalRole({ actorUserId: actor, membershipId: "m-owner", action: "approve" }),
      // No access object at all -> indistinguishable from a missing membership.
      /membership_not_found/,
      `${actor} must not approve`,
    );
  }
  assert.equal(membershipOf(U.ownerA).clinicalRoleStatus, "pending");
});

test("10) a plain doctor keeps working through the organizational role", async () => {
  const access = await getPracticeAccess(U.doctorA, PRACTICE_A);
  assert.equal(access.isOwner, false);
  assert.equal(access.organizationalRole, "doctor");
  assert.equal(access.clinicalRole, null, "no separate clinical role needed");
  for (const p of CLINICAL_PERMS) assert.equal(accessHasPermission(access, p), true, p);
});

test("11) the owner stays the owner after clinical activation", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  await changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-owner", action: "approve" });

  const row = membershipOf(U.ownerA);
  assert.equal(row.role, "owner", "organizational membership role untouched");
  const access = await getPracticeAccess(U.ownerA, PRACTICE_A);
  assert.equal(access.isOwner, true);
  assert.equal(access.role, "owner");
});

test("13) a foreign membership is 404-shaped, never forbidden", async () => {
  // Practice A's admin acting on practice B's owner membership.
  await assert.rejects(
    () => changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-ownerB", action: "approve" }),
    /membership_not_found/,
  );
  // A user with no practice at all.
  await assert.rejects(
    () => changeClinicalRole({ actorUserId: U.outsider, membershipId: "m-owner", action: "request" }),
    /membership_not_found/,
  );
});

test("14) two concurrent approvals produce exactly one valid state change", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });

  const results = await Promise.allSettled([
    changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-owner", action: "approve" }),
    changeClinicalRole({ actorUserId: U.admin2A, membershipId: "m-owner", action: "approve" }),
  ]);
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 1, "exactly one approval may win");
  assert.equal(rejected.length, 1);
  assert.match(String(rejected[0].reason?.message), /concurrent_modification|invalid_status_transition/);
  assert.equal(membershipOf(U.ownerA).clinicalRoleStatus, "active");
});

test("15) an unknown clinical role never widens permissions", async () => {
  await assert.rejects(
    () =>
      changeClinicalRole({
        actorUserId: U.ownerA, membershipId: "m-owner", action: "request",
        clinicalRole: "chief-wizard",
      }),
    /invalid_clinical_role/,
  );

  // Even a value written directly into the column grants nothing.
  Object.assign(membershipOf(U.ownerA), {
    clinicalRole: "chief-wizard", clinicalRoleStatus: "active",
  });
  const access = await getPracticeAccess(U.ownerA, PRACTICE_A);
  for (const p of CLINICAL_PERMS) assert.equal(accessHasPermission(access, p), false, p);
});

test("16) every status change writes an audit entry without medical content", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  await changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-owner", action: "approve" });
  await changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-owner", action: "revoke" });

  const actions = auditRows.map((r) => r.action);
  assert.deepEqual(actions, [
    "practice_clinical_role_request",
    "practice_clinical_role_approve",
    "practice_clinical_role_revoke",
  ]);

  const approve = auditRows[1];
  assert.equal(approve.userId, U.adminA, "actorUserId recorded");
  assert.equal(approve.practiceProfileId, PRACTICE_A, "practiceId recorded");
  assert.equal(approve.metadata.targetUserId, U.ownerA, "targetUserId recorded");
  assert.equal(approve.metadata.previousStatus, "pending");
  assert.equal(approve.metadata.newStatus, "active");

  // No medical content anywhere in the trail.
  const serialized = JSON.stringify(auditRows);
  for (const term of ["diagnos", "allerg", "medication", "vital"]) {
    assert.ok(!serialized.toLowerCase().includes(term), `audit must not contain "${term}"`);
  }
});

test("a rejected request can be raised again but grants nothing meanwhile", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  await changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-owner", action: "reject" });
  let access = await getPracticeAccess(U.ownerA, PRACTICE_A);
  assert.equal(access.clinicalRoleStatus, "rejected");
  for (const p of CLINICAL_PERMS) assert.equal(accessHasPermission(access, p), false, p);

  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  assert.equal(membershipOf(U.ownerA).clinicalRoleStatus, "pending");
});

test("approving something that is not pending is refused", async () => {
  await assert.rejects(
    () => changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-owner", action: "approve" }),
    /invalid_status_transition/,
  );
});

test("a revoked membership cannot hold a clinical role", async () => {
  const revoked = membershipOf(U.revokedAdminA);
  Object.assign(revoked, { clinicalRole: "doctor", clinicalRoleStatus: "active" });
  // No access at all for a revoked member, so nothing can be derived from it.
  assert.equal(await getPracticeAccess(U.revokedAdminA, PRACTICE_A), null);
});

test("the clinical role only ever adds CLINICAL_* permissions", async () => {
  await changeClinicalRole({ actorUserId: U.ownerA, membershipId: "m-owner", action: "request" });
  await changeClinicalRole({ actorUserId: U.adminA, membershipId: "m-owner", action: "approve" });
  const withClinical = await getPracticeAccess(U.ownerA, PRACTICE_A);

  installPrismaFake();
  const ownerOnly = await getPracticeAccess(U.ownerA, PRACTICE_A);

  const added = [...withClinical.effectivePermissions].filter(
    (p) => !ownerOnly.effectivePermissions.has(p),
  );
  assert.deepEqual(added.sort(), [...CLINICAL_PERMS].sort(), "only clinical rights are added");
});

test("no role holds CLINICAL_ROLE_MANAGE by accident", () => {
  const holders = PRACTICE_ROLES.filter((r) =>
    hasPracticePermission(r, PERMISSIONS.CLINICAL_ROLE_MANAGE),
  );
  assert.deepEqual(holders.sort(), ["admin", "owner", "practice_manager"]);
});

/* ---------------------------------------------------------------- real HTTP */

let server;
let baseUrl;

test.before(async () => {
  installPrismaFake();
  const teamRouter = (await import("../routes/practiceTeam.js")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/practice/team", requireAuth, teamRouter);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

async function call(method, path, { user, body } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` } : {}),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : { body: "{}" }),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

const RC = (id, action) => `/api/practice/team/${id}/clinical-role/${action}`;

test("HTTP: owner requests, second admin approves, owner then holds both roles", async () => {
  const requested = await call("POST", RC("m-owner", "request"), { user: U.ownerA });
  assert.equal(requested.status, 200);
  assert.equal(requested.body.clinicalRole.clinicalRoleStatus, "pending");

  const approved = await call("POST", RC("m-owner", "approve"), { user: U.admin2A });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.clinicalRole.clinicalRoleStatus, "active");

  const access = await getPracticeAccess(U.ownerA, PRACTICE_A);
  assert.equal(accessHasPermission(access, PERMISSIONS.CLINICAL_VITALS_READ), true);
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), true);
});

test("HTTP: self-approval is 403 for both the owner and an admin", async () => {
  await call("POST", RC("m-owner", "request"), { user: U.ownerA });
  const owner = await call("POST", RC("m-owner", "approve"), { user: U.ownerA });
  assert.equal(owner.status, 403);
  assert.equal(owner.body.error, "self_approval_forbidden");

  await call("POST", RC("m-admin", "request"), { user: U.adminA });
  const admin = await call("POST", RC("m-admin", "approve"), { user: U.adminA });
  assert.equal(admin.status, 403);
  assert.equal(admin.body.error, "self_approval_forbidden");
});

test("HTTP: assistant, invited and revoked members cannot approve", async () => {
  await call("POST", RC("m-owner", "request"), { user: U.ownerA });

  const assistant = await call("POST", RC("m-owner", "approve"), { user: U.assistantA });
  assert.equal(assistant.status, 403);
  assert.equal(assistant.body.error, "forbidden");

  for (const actor of [U.invitedAdminA, U.revokedAdminA]) {
    const res = await call("POST", RC("m-owner", "approve"), { user: actor });
    assert.equal(res.status, 404, `${actor} must not learn the membership exists`);
    assert.equal(res.body.error, "membership_not_found");
  }
});

test("HTTP: a foreign membership returns 404, not 403", async () => {
  const res = await call("POST", RC("m-ownerB", "approve"), { user: U.adminA });
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "membership_not_found");
  const serialized = JSON.stringify(res.body);
  assert.ok(!serialized.includes(PRACTICE_B), "must not leak the foreign practice id");
  assert.ok(!serialized.includes(U.ownerB), "must not leak the foreign user id");
});

test("HTTP: unauthenticated and unknown actions are rejected", async () => {
  assert.equal((await call("POST", RC("m-owner", "request"))).status, 401);
  const bad = await call("POST", RC("m-owner", "promote"), { user: U.ownerA });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, "invalid_action");
});

test("HTTP: 12) the owner cannot be revoked or demoted through the team routes", async () => {
  const revoke = await call("PATCH", "/api/practice/team/m-owner/revoke", { user: U.adminA });
  assert.notEqual(revoke.status, 200, "the owner membership must not be revocable");

  const demote = await call("PATCH", "/api/practice/team/m-owner/role?practiceId=" + PRACTICE_A, {
    user: U.adminA,
    body: { role: "doctor" },
  });
  assert.notEqual(demote.status, 200, "the owner membership must not be changed to doctor");

  // The owner is still the owner and still has no clinical rights from it.
  const access = await getPracticeAccess(U.ownerA, PRACTICE_A);
  assert.equal(access.isOwner, true);
  assert.equal(access.organizationalRole, "owner");
  assert.equal(accessHasPermission(access, PERMISSIONS.CLINICAL_VITALS_READ), false);
});
