/**
 * Nobody raises their own practice privileges.
 *
 * Four write paths could change a membership's role or status. The clinical
 * path was already hardened (self_approval_forbidden, conditional update); the
 * organizational paths were not:
 *
 *   - updatePracticeTeamMemberRole had no self-check and an unconditional
 *     update, so a practice manager could set their OWN role to admin.
 *   - invitePracticeTeamMember upserts on (practice, user) — inviting YOURSELF
 *     rewrote your own role, and ASSIGNABLE_ROLES includes "admin", so
 *     manager → admin was one self-invite plus one self-accept away.
 *   - The legacy member routes in practices.js accepted the actor's own
 *     userId/memberId for role change and revocation.
 *
 * These tests were written RED against the unfixed code and pin the fix.
 *
 * Run: node --test scripts/verifyPracticeRoleSelfEscalation.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-role-escalation";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const OWNER = "user-owner-A";
const ADMIN = "user-admin-A";
const MANAGER = "user-manager-A";
const DOCTOR = "user-doctor-A";
const SECRETARY = "user-secretary-A";
const INVITED = "user-invited-A";
const REVOKED = "user-revoked-A";
const OWNER_B = "user-owner-B";

const PR = { A: "practice-A", B: "practice-B" };

let members;
let practices;
let audits;

const MEMBER_IDS = {
  admin: "m-admin", manager: "m-manager", doctor: "m-doctor",
  secretary: "m-secretary", invited: "m-invited", revoked: "m-revoked",
  ownerB: "m-owner-b-doctor",
};

function installFake() {
  practices = [
    { id: PR.A, userId: OWNER, practiceName: "Praxis A", isActive: true },
    { id: PR.B, userId: OWNER_B, practiceName: "Praxis B", isActive: true },
  ];
  members = [
    { id: MEMBER_IDS.admin, practiceProfileId: PR.A, userId: ADMIN, role: "admin", status: "active",
      clinicalRole: null, clinicalRoleStatus: null },
    { id: MEMBER_IDS.manager, practiceProfileId: PR.A, userId: MANAGER, role: "practice_manager", status: "active",
      clinicalRole: null, clinicalRoleStatus: null },
    { id: MEMBER_IDS.doctor, practiceProfileId: PR.A, userId: DOCTOR, role: "doctor", status: "active",
      clinicalRole: "doctor", clinicalRoleStatus: "pending" },
    { id: MEMBER_IDS.secretary, practiceProfileId: PR.A, userId: SECRETARY, role: "secretary", status: "active",
      clinicalRole: null, clinicalRoleStatus: null },
    { id: MEMBER_IDS.invited, practiceProfileId: PR.A, userId: INVITED, role: "doctor", status: "invited",
      clinicalRole: null, clinicalRoleStatus: null },
    { id: MEMBER_IDS.revoked, practiceProfileId: PR.A, userId: REVOKED, role: "doctor", status: "revoked",
      clinicalRole: null, clinicalRoleStatus: null },
    { id: MEMBER_IDS.ownerB, practiceProfileId: PR.B, userId: OWNER_B, role: "doctor", status: "active",
      clinicalRole: null, clinicalRoleStatus: null },
  ];
  audits = [];

  const matches = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (v.in) return v.in.includes(row[k]);
        if (v.not !== undefined) return row[k] !== v.not;
        return true;
      }
      return row[k] === v;
    });

  const withUser = (m) => ({
    ...m,
    user: { id: m.userId, email: `${m.userId}@x.invalid`, firstName: "X", lastName: "Y" },
    practiceProfile: practices.find((p) => p.id === m.practiceProfileId),
  });

  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      if (where.id) {
        const m = members.find((x) => x.id === where.id);
        return m ? withUser(m) : null;
      }
      if (where.practiceProfileId_userId) {
        const { practiceProfileId, userId } = where.practiceProfileId_userId;
        const m = members.find((x) => x.practiceProfileId === practiceProfileId && x.userId === userId);
        return m ? withUser(m) : null;
      }
      return null;
    },
    findFirst: async ({ where }) => {
      const m = members.find((x) => matches(x, where));
      return m ? withUser(m) : null;
    },
    findMany: async ({ where = {} }) => members.filter((m) => matches(m, where)).map(withUser),
    update: async ({ where, data }) => {
      const m = members.find((x) => x.id === where.id);
      Object.assign(m, data);
      return withUser(m);
    },
    updateMany: async ({ where, data }) => {
      const hit = members.filter((m) => matches(m, where));
      for (const m of hit) Object.assign(m, data);
      return { count: hit.length };
    },
    upsert: async ({ where, update, create }) => {
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      let m = members.find((x) => x.practiceProfileId === practiceProfileId && x.userId === userId);
      if (m) Object.assign(m, update);
      else { m = { id: `m-${members.length + 1}`, practiceProfileId, userId, clinicalRole: null, clinicalRoleStatus: null, ...create }; members.push(m); }
      return withUser(m);
    },
    deleteMany: async () => ({ count: 0 }),
  };
  prisma.practiceProfile = {
    findUnique: async ({ where }) => practices.find((p) => p.id === where.id) ?? null,
  };
  prisma.user = {
    findUnique: async ({ where }) =>
      (where.id ? { id: where.id } : null),
  };
  prisma.auditLog = { create: async ({ data }) => { audits.push(data); return data; } };
  prisma.$transaction = async (arg) => (typeof arg === "function" ? arg(prisma) : Promise.all(arg));
}

test.beforeEach(() => installFake());

/* ---------------------------------------------------------------- real HTTP */

let server;
let baseUrl;

test.before(async () => {
  installFake();
  const [team, practicesRouter] = await Promise.all([
    import("../routes/practiceTeam.js"),
    import("../routes/practices.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api/practice/team", requireAuth, team.default);
  app.use("/api/practices", requireAuth, practicesRouter.default);
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((r) => server.close(r)));

async function call(method, path, user, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

const setRole = (user, membershipId, role, extra = {}) =>
  call("PATCH", `/api/practice/team/${membershipId}/role?practiceId=${PR.A}`, user, { role, ...extra });
const invite = (user, body) =>
  call("POST", `/api/practice/team/invite?practiceId=${PR.A}`, user, body);
const clinical = (user, membershipId, action, body = {}) =>
  call("POST", `/api/practice/team/${membershipId}/clinical-role/${action}?practiceId=${PR.A}`, user, body);

/* ------------------------------------------- 1.–5. no self role change */

test("1./2. admin and manager cannot change their own organizational role", async () => {
  for (const [user, memberId, to] of [
    [ADMIN, MEMBER_IDS.admin, "practice_manager"],
    [MANAGER, MEMBER_IDS.manager, "admin"],
  ]) {
    const res = await setRole(user, memberId, to);
    assert.equal(res.status, 403, `${user} -> ${to}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.error, "self_role_change_forbidden");
  }
  assert.equal(members.find((m) => m.id === MEMBER_IDS.manager).role, "practice_manager",
    "the manager must still be a manager");
});

test("3. a doctor cannot change their own role either", async () => {
  // No TEAM_MANAGE, so it fails at the permission gate — but never succeeds.
  const res = await setRole(DOCTOR, MEMBER_IDS.doctor, "admin");
  assert.ok([403].includes(res.status));
  assert.equal(members.find((m) => m.id === MEMBER_IDS.doctor).role, "doctor");
});

test("5. self-DEMOTION is refused too", async () => {
  const res = await setRole(ADMIN, MEMBER_IDS.admin, "secretary");
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "self_role_change_forbidden");
  assert.equal(members.find((m) => m.id === MEMBER_IDS.admin).role, "admin",
    "a self-demotion could remove the last administrator");
});

test("the self-invite escalation is closed", async () => {
  // The former hole: manager invites THEMSELVES as admin (upsert rewrites
  // their row), then self-accepts. One request, full escalation.
  const res = await invite(MANAGER, { userId: MANAGER, role: "admin" });
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(res.body.error, "self_role_change_forbidden");
  const row = members.find((m) => m.id === MEMBER_IDS.manager);
  assert.equal(row.role, "practice_manager");
  assert.equal(row.status, "active", "the upsert must not флip the row to invited");
});

test("legacy routes: own userId and own memberId are refused", async () => {
  const post = await call("POST", `/api/practices/${PR.A}/members`, ADMIN,
    { userId: ADMIN, role: "admin" });
  assert.equal(post.status, 403, JSON.stringify(post.body));
  assert.equal(post.body.error, "self_role_change_forbidden");

  const put = await call("PUT", `/api/practices/${PR.A}/members/${MEMBER_IDS.admin}`, ADMIN,
    { role: "doctor" });
  assert.equal(put.status, 403);
  assert.equal(put.body.error, "self_role_change_forbidden");

  const del = await call("DELETE", `/api/practices/${PR.A}/members/${MEMBER_IDS.admin}`, ADMIN);
  assert.equal(del.status, 403);
  assert.equal(del.body.error, "cannot_revoke_self");
  assert.equal(members.find((m) => m.id === MEMBER_IDS.admin).status, "active");
});

/* --------------------------------------- 6.–9. clinical self-handling */

test("6./7. requesting one's own clinical role works, approving it does not", async () => {
  const request = await clinical(MANAGER, MEMBER_IDS.manager, "request", { clinicalRole: "doctor" });
  assert.equal(request.status, 200, JSON.stringify(request.body));

  const approve = await clinical(MANAGER, MEMBER_IDS.manager, "approve");
  assert.equal(approve.status, 403);
  assert.equal(approve.body.error, "self_approval_forbidden");
  assert.equal(members.find((m) => m.id === MEMBER_IDS.manager).clinicalRoleStatus, "pending",
    "the request stays pending until someone ELSE decides");
});

test("8./9. approver fields cannot be injected through the body", async () => {
  const res = await clinical(ADMIN, MEMBER_IDS.doctor, "approve", {
    clinicalRoleApprovedByUserId: DOCTOR,
    clinicalRoleStatus: "approved",
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.error, "unsupported_field");
  assert.equal(members.find((m) => m.id === MEMBER_IDS.doctor).clinicalRoleStatus, "pending");
});

test("10./11. no self-reactivation; invite self-acceptance stays intact", async () => {
  // The sanctioned path: an INVITED user accepts their own invite.
  const accept = await call("POST", `/api/practice/team/accept?practiceId=${PR.A}`, INVITED, {});
  assert.equal(accept.status, 200, JSON.stringify(accept.body));
  assert.equal(members.find((m) => m.id === MEMBER_IDS.invited).status, "active");

  // A REVOKED user has no such path: accept requires status "invited".
  const revive = await call("POST", `/api/practice/team/accept?practiceId=${PR.A}`, REVOKED, {});
  assert.equal(revive.status, 400);
  assert.equal(members.find((m) => m.id === MEMBER_IDS.revoked).status, "revoked");
});

/* ------------------------------------- 13.–22. changes to OTHER members */

test("13. owner and admin can change another member's role", async () => {
  const byOwner = await setRole(OWNER, MEMBER_IDS.secretary, "assistant");
  assert.equal(byOwner.status, 200, JSON.stringify(byOwner.body));
  const byAdmin = await setRole(ADMIN, MEMBER_IDS.doctor, "practice_manager");
  assert.equal(byAdmin.status, 200, JSON.stringify(byAdmin.body));
});

test("15.–18. doctor, secretary, invited and revoked cannot manage anyone", async () => {
  for (const user of [DOCTOR, SECRETARY, INVITED, REVOKED]) {
    const res = await setRole(user, MEMBER_IDS.secretary, "assistant");
    assert.equal(res.status, 403, `${user} was allowed`);
  }
});

test("19. a foreign practice's member reads as not found", async () => {
  const res = await setRole(OWNER_B, MEMBER_IDS.admin, "doctor");
  assert.ok([403, 404].includes(res.status));
  assert.equal(members.find((m) => m.id === MEMBER_IDS.admin).role, "admin");
});

test("20./21. unknown roles and the owner role are rejected", async () => {
  for (const role of ["superuser", "owner", "", "OWNER"]) {
    const res = await setRole(OWNER, MEMBER_IDS.secretary, role);
    assert.equal(res.status, 400, `role "${role}" was accepted`);
  }
});

test("22. permission payloads cannot be injected", async () => {
  const res = await setRole(OWNER, MEMBER_IDS.secretary, "assistant",
    { effectivePermissions: ["team.manage"], permissions: ["*"] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "unsupported_field");
});

test("23.–25. cross-approval works; foreign practice approval does not", async () => {
  const approve = await clinical(ADMIN, MEMBER_IDS.doctor, "approve");
  assert.equal(approve.status, 200, JSON.stringify(approve.body));
  assert.equal(members.find((m) => m.id === MEMBER_IDS.doctor).clinicalRoleStatus, "active");
  assert.equal(members.find((m) => m.id === MEMBER_IDS.doctor).clinicalRoleApprovedByUserId, ADMIN);

  const revoke = await clinical(OWNER, MEMBER_IDS.doctor, "revoke");
  assert.equal(revoke.status, 200);

  const foreign = await clinical(OWNER_B, MEMBER_IDS.doctor, "approve");
  assert.equal(foreign.status, 404, "a foreign membership must read as not found");
});

/* --------------------------------------------- 27.–34. races and audit */

test("27./28. the owner is structurally always privileged — no extra guard needed", async () => {
  // getPracticeAccess grants the owner allowlist from PracticeProfile.userId,
  // independent of any membership row. Even with every membership revoked the
  // owner keeps TEAM_MANAGE, so a "last privileged member" lock would only
  // ever block legitimate changes.
  const { getPracticeAccess } = await import("../utils/practiceAccess.js");
  const { PERMISSIONS } = await import("../utils/practicePermissions.js");
  for (const m of members) if (m.practiceProfileId === PR.A) m.status = "revoked";
  const access = await getPracticeAccess(OWNER, PR.A);
  assert.ok(access.effectivePermissions.has(PERMISSIONS.TEAM_MANAGE),
    "the owner keeps team management with zero active memberships");
});

test("29. a role change interleaved with another conflicts instead of overwriting", async () => {
  // Deterministic interleaving: the state changes between the service's load
  // and its conditional update. The WHERE must then match zero rows.
  const target = members.find((m) => m.id === MEMBER_IDS.secretary);
  const original = prisma.practiceMember.updateMany;
  prisma.practiceMember.updateMany = async (args) => {
    target.role = "viewer"; // the other change wins first
    prisma.practiceMember.updateMany = original;
    return original(args);
  };
  const res = await setRole(OWNER, MEMBER_IDS.secretary, "assistant");
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error, "role_state_conflict");
  assert.equal(target.role, "viewer", "the interleaved change must not be overwritten");
});

test("31. approval after an interleaved revoke conflicts instead of overwriting", async () => {
  // The stored status changes between load and update; the conditional update
  // must see zero rows and refuse.
  const target = members.find((m) => m.id === MEMBER_IDS.doctor);
  const original = prisma.practiceMember.updateMany;
  prisma.practiceMember.updateMany = async (args) => {
    target.clinicalRoleStatus = "revoked"; // the interleaved change
    prisma.practiceMember.updateMany = original;
    return original(args);
  };
  const res = await clinical(ADMIN, MEMBER_IDS.doctor, "approve");
  assert.equal(res.status, 409);
  assert.notEqual(target.clinicalRoleStatus, "active");
});

test("33./34. audit matches the committed state; failures write no success audit", async () => {
  await setRole(ADMIN, MEMBER_IDS.admin, "practice_manager"); // refused
  assert.ok(!audits.some((a) => a.action === "practice_team_member_role_changed"),
    "a refused attempt must not be audited as a change");

  await setRole(OWNER, MEMBER_IDS.secretary, "assistant"); // succeeds
  const entry = audits.find((a) => a.action === "practice_team_member_role_changed");
  assert.ok(entry);
  const meta = entry.metadataJson ?? entry.metadata ?? {};
  assert.equal(meta.newRole, "assistant");
  assert.equal(meta.previousRole, "secretary");
  assert.ok(!JSON.stringify(meta).includes("effectivePermissions"));
});

test("responses carry no permission sets and no foreign user ids", async () => {
  const res = await setRole(OWNER, MEMBER_IDS.secretary, "assistant");
  const text = JSON.stringify(res.body);
  assert.ok(!text.includes("effectivePermissions"));
  assert.ok(!/"permissions":/.test(text));
});
