/**
 * GET /api/practice/team response shape.
 *
 * REGRESSION: buildTeamList() used to assemble the owner row by hand and
 * silently dropped the clinical role fields, so the practice owner — the one
 * person the clinical role exists for — could never see their own request or
 * approval, and an approver never saw a pending owner request in the list.
 * The permissions were always evaluated correctly server-side; only the API
 * output was wrong.
 *
 * These tests pin the response shape for owner AND regular members and assert
 * that the list never grants anything by itself.
 *
 * Prisma is replaced by an in-memory adapter; routes, middleware and error
 * handling run for real. No database required.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-team-list";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { listPracticeTeam } from "../services/practiceTeam/practiceTeamService.js";
import { getPracticeAccess, accessHasPermission } from "../utils/practiceAccess.js";
import { PERMISSIONS } from "../utils/practicePermissions.js";

const PRACTICE_A = "practice-A";
const PRACTICE_B = "practice-B";
const OWNER = "user-owner-A";
const ADMIN = "user-admin-A";
const DOCTOR = "user-doctor-A";
const OWNER_B = "user-owner-B";
const OUTSIDER = "user-outsider";

const CLINICAL_PERMS = [
  PERMISSIONS.CLINICAL_VITALS_READ,
  PERMISSIONS.CLINICAL_VACCINATIONS_READ,
  PERMISSIONS.CLINICAL_HEALTH_HISTORY_READ,
  PERMISSIONS.CLINICAL_SOS_READ,
];

const PRACTICES = [
  {
    id: PRACTICE_A, userId: OWNER, practiceName: "Praxis A",
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"),
    user: { id: OWNER, email: "owner@example.org", firstName: "Ola", lastName: "Owner" },
  },
  {
    id: PRACTICE_B, userId: OWNER_B, practiceName: "Praxis B",
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"),
    user: { id: OWNER_B, email: "ownerb@example.org", firstName: "Bea", lastName: "Bee" },
  },
];

let members;

/** Base fixture: the owner membership carries NO clinical role yet. */
function resetMembers() {
  members = [
    {
      id: "m-owner", practiceProfileId: PRACTICE_A, userId: OWNER,
      role: "owner", status: "active",
      invitedByUserId: null, invitedAt: null, acceptedAt: new Date("2026-01-01"),
      revokedAt: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"),
      clinicalRole: null, clinicalRoleStatus: null,
      clinicalRoleRequestedAt: null, clinicalRoleApprovedAt: null,
      clinicalRoleApprovedByUserId: null,
      user: { id: OWNER, email: "owner@example.org", firstName: "Ola", lastName: "Owner" },
    },
    {
      id: "m-admin", practiceProfileId: PRACTICE_A, userId: ADMIN,
      role: "admin", status: "active",
      invitedByUserId: OWNER, invitedAt: new Date("2026-01-03"),
      acceptedAt: new Date("2026-01-04"), revokedAt: null,
      createdAt: new Date("2026-01-03"), updatedAt: new Date("2026-01-04"),
      clinicalRole: null, clinicalRoleStatus: null,
      clinicalRoleRequestedAt: null, clinicalRoleApprovedAt: null,
      clinicalRoleApprovedByUserId: null,
      user: { id: ADMIN, email: "admin@example.org", firstName: "Ada", lastName: "Admin" },
    },
    {
      id: "m-doctor", practiceProfileId: PRACTICE_A, userId: DOCTOR,
      role: "doctor", status: "active",
      invitedByUserId: OWNER, invitedAt: new Date("2026-01-05"),
      acceptedAt: new Date("2026-01-06"), revokedAt: null,
      createdAt: new Date("2026-01-05"), updatedAt: new Date("2026-01-06"),
      clinicalRole: null, clinicalRoleStatus: null,
      clinicalRoleRequestedAt: null, clinicalRoleApprovedAt: null,
      clinicalRoleApprovedByUserId: null,
      user: { id: DOCTOR, email: "doctor@example.org", firstName: "Dana", lastName: "Doc" },
    },
    {
      id: "m-ownerB", practiceProfileId: PRACTICE_B, userId: OWNER_B,
      role: "owner", status: "active",
      invitedByUserId: null, invitedAt: null, acceptedAt: new Date("2026-01-01"),
      revokedAt: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"),
      clinicalRole: null, clinicalRoleStatus: null,
      clinicalRoleRequestedAt: null, clinicalRoleApprovedAt: null,
      clinicalRoleApprovedByUserId: null,
      user: { id: OWNER_B, email: "ownerb@example.org", firstName: "Bea", lastName: "Bee" },
    },
  ];
}

function installPrismaFake() {
  resetMembers();
  prisma.practiceProfile = {
    findUnique: async ({ where }) => PRACTICES.find((p) => p.id === where.id) ?? null,
  };
  prisma.practiceMember = {
    findMany: async ({ where }) =>
      members.filter((m) => m.practiceProfileId === where.practiceProfileId),
    findUnique: async ({ where }) => {
      if (where.id) return members.find((m) => m.id === where.id) ?? null;
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      return (
        members.find((m) => m.practiceProfileId === practiceProfileId && m.userId === userId) ?? null
      );
    },
    updateMany: async ({ where, data }) => {
      const row = members.find(
        (m) => m.id === where.id &&
          (m.clinicalRoleStatus ?? null) === (where.clinicalRoleStatus ?? null),
      );
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  };
  prisma.auditLog = { create: async () => ({}) };
}

test.beforeEach(() => installPrismaFake());

const ownerRow = () => members.find((m) => m.id === "m-owner");

/** Puts the owner membership into a given clinical state. */
function setOwnerClinical(status, extra = {}) {
  Object.assign(ownerRow(), {
    clinicalRole: status === null ? null : "doctor",
    clinicalRoleStatus: status,
    clinicalRoleRequestedAt: status ? new Date("2026-02-01") : null,
    clinicalRoleApprovedAt: status === "active" ? new Date("2026-02-02") : null,
    clinicalRoleApprovedByUserId: status === "active" ? ADMIN : null,
    ...extra,
  });
}

async function teamAsOwner() {
  const list = await listPracticeTeam(OWNER, PRACTICE_A, {});
  return list.members.find((m) => m.userId === OWNER);
}

/* ------------------------------------------------- 1) owner without a role */

test("owner without a clinical role reports null, not undefined", async () => {
  const row = await teamAsOwner();
  assert.equal(row.organizationalRole, "owner");
  assert.equal(row.clinicalRole, null);
  assert.equal(row.clinicalRoleStatus, null);
  assert.equal(row.isPracticeOwner, true);
  // Explicitly present as keys, so the client can distinguish "none" from "unknown".
  assert.ok("clinicalRole" in row);
  assert.ok("clinicalRoleStatus" in row);
});

/* --------------------------------- 2)-5) every clinical state is surfaced */

for (const status of ["pending", "active", "rejected", "revoked"]) {
  test(`owner with a ${status.toUpperCase()} doctor role is fully reported`, async () => {
    setOwnerClinical(status);
    const row = await teamAsOwner();

    assert.equal(row.organizationalRole, "owner", "organizational role unchanged");
    assert.equal(row.clinicalRole, "doctor", `${status}: role must be visible`);
    assert.equal(row.clinicalRoleStatus, status, `${status}: status must be visible`);
    assert.ok(row.clinicalRoleRequestedAt, "request timestamp must be visible");
    assert.equal(
      row.clinicalRoleApprovedAt !== null, status === "active",
      "approval timestamp only for an approved role",
    );
    assert.equal(
      row.clinicalRoleApprovedByUserId, status === "active" ? ADMIN : null,
      "approver only for an approved role",
    );

    // The list never grants anything — permissions come from getPracticeAccess.
    const access = await getPracticeAccess(OWNER, PRACTICE_A);
    const expected = status === "active";
    for (const p of CLINICAL_PERMS) {
      assert.equal(
        accessHasPermission(access, p), expected,
        `${status}: clinical permission ${p} should be ${expected}`,
      );
    }
  });
}

test("an approved owner's capabilities match the server-side state", async () => {
  setOwnerClinical("active");
  const list = await listPracticeTeam(OWNER, PRACTICE_A, {});
  const row = list.members.find((m) => m.userId === OWNER);

  // Own row: may request/revoke, never approve (no self-approval).
  assert.equal(row.capabilities.canApprove, false);
  assert.equal(row.capabilities.canReject, false);
  assert.equal(row.capabilities.canRevoke, true);

  // The list header mirrors the access object, it does not compute rights.
  assert.equal(list.isOwner, true);
  assert.equal(list.organizationalRole, "owner");
  assert.equal(list.clinicalRoleStatus, "active");
});

/* ------------------------------------------------- 6) regular members */

test("a regular member row is unchanged and carries the same keys", async () => {
  setOwnerClinical("active");
  const list = await listPracticeTeam(OWNER, PRACTICE_A, {});
  const owner = list.members.find((m) => m.userId === OWNER);
  const admin = list.members.find((m) => m.userId === ADMIN);
  const doctor = list.members.find((m) => m.userId === DOCTOR);

  // One serializer for everyone: identical key sets.
  assert.deepEqual(
    Object.keys(owner).sort(), Object.keys(admin).sort(),
    "owner and member rows must have the same shape",
  );

  assert.equal(admin.organizationalRole, "admin");
  assert.equal(admin.clinicalRole, null);
  assert.equal(admin.clinicalRoleStatus, null);
  assert.equal(admin.isPracticeOwner, false);
  assert.equal(admin.user.displayName, "Ada Admin");

  // The legacy `role` field keeps its meaning.
  assert.equal(doctor.role, "doctor");
  assert.equal(doctor.organizationalRole, "doctor");
});

test("the owner row survives without a membership record", async () => {
  members = members.filter((m) => m.id !== "m-owner");
  const row = await teamAsOwner();
  assert.equal(row.organizationalRole, "owner");
  assert.equal(row.clinicalRole, null);
  assert.equal(row.clinicalRoleStatus, null);
  assert.ok(String(row.id).startsWith("owner-"), "synthetic id when no membership exists");
});

/* ------------------------------------------------------- 7) foreign practice */

test("a foreign practice yields no team list", async () => {
  await assert.rejects(() => listPracticeTeam(ADMIN, PRACTICE_B, {}), /forbidden/);
  await assert.rejects(() => listPracticeTeam(OUTSIDER, PRACTICE_A, {}), /forbidden/);
});

test("the team list never contains another practice's members", async () => {
  const list = await listPracticeTeam(OWNER, PRACTICE_A, {});
  const serialized = JSON.stringify(list);
  assert.ok(!serialized.includes(PRACTICE_B), "no foreign practice id");
  assert.ok(!serialized.includes(OWNER_B), "no foreign user id");
  assert.ok(!serialized.includes("ownerb@example.org"), "no foreign e-mail");
});

/* ------------------------------------------------------- 8) no patient data */

test("the team response carries no patient identifiers", async () => {
  setOwnerClinical("active");
  const list = await listPracticeTeam(OWNER, PRACTICE_A, {});
  const serialized = JSON.stringify(list);
  for (const forbidden of ["patientUserId", "practicePatientLinkId", "patientProfileId"]) {
    assert.ok(!serialized.includes(forbidden), `team response must not contain ${forbidden}`);
  }
});

/* ------------------------------------------------------------- real HTTP */

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
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

test("HTTP: GET /api/practice/team reports the owner's clinical role", async () => {
  setOwnerClinical("pending");
  const res = await call("GET", `/api/practice/team?practiceId=${PRACTICE_A}`, { user: OWNER });
  assert.equal(res.status, 200);

  const row = res.body.members.find((m) => m.userId === OWNER);
  assert.equal(row.organizationalRole, "owner");
  assert.equal(row.clinicalRole, "doctor");
  assert.equal(row.clinicalRoleStatus, "pending");
});

test("HTTP: an approver sees the owner's pending request in the list", async () => {
  setOwnerClinical("pending");
  const res = await call("GET", `/api/practice/team?practiceId=${PRACTICE_A}`, { user: ADMIN });
  assert.equal(res.status, 200);

  const row = res.body.members.find((m) => m.userId === OWNER);
  assert.equal(row.clinicalRoleStatus, "pending", "the request must be discoverable");
  assert.equal(row.capabilities.canApprove, true, "a different eligible person may approve");
  assert.equal(row.capabilities.canReject, true);
});

/* ------------------------------- 5) request body manipulation is inert ---- */

test("HTTP: manipulated body fields cannot forge a status, approver or permission", async () => {
  const hostile = {
    clinicalRole: "doctor",
    clinicalRoleStatus: "active",
    clinicalRoleApprovedByUserId: "attacker",
    clinicalRoleApprovedAt: "2020-01-01T00:00:00.000Z",
    effectivePermissions: ["clinical.ai_summary.generate"],
    role: "doctor",
    status: "active",
    isPracticeOwner: true,
  };

  // The owner requests with a hostile body: only the role is read, and only
  // because "request" allows it. The status comes from the state machine.
  const requested = await call("POST", "/api/practice/team/m-owner/clinical-role/request", {
    user: OWNER, body: hostile,
  });
  assert.equal(requested.status, 200);
  assert.equal(requested.body.clinicalRole.clinicalRoleStatus, "pending", "never 'active'");

  const stored = ownerRow();
  assert.equal(stored.clinicalRoleStatus, "pending");
  assert.equal(stored.clinicalRoleApprovedByUserId, null, "approver not forgeable");
  assert.equal(stored.clinicalRoleApprovedAt, null, "approval timestamp not forgeable");
  assert.equal(stored.role, "owner", "organizational role untouched");

  // Self-approval stays forbidden even with a hostile body.
  const selfApprove = await call("POST", "/api/practice/team/m-owner/clinical-role/approve", {
    user: OWNER, body: hostile,
  });
  assert.equal(selfApprove.status, 403);
  assert.equal(selfApprove.body.error, "self_approval_forbidden");

  // And no clinical, prescription or AI permission was created.
  const access = await getPracticeAccess(OWNER, PRACTICE_A);
  for (const p of [
    ...CLINICAL_PERMS,
    PERMISSIONS.PRESCRIPTION_READ,
    PERMISSIONS.PRESCRIPTION_ISSUE,
    PERMISSIONS.PRESCRIPTION_CANCEL,
    PERMISSIONS.CLINICAL_AI_SUMMARY_GENERATE,
  ]) {
    assert.equal(accessHasPermission(access, p), false, `${p} must not be granted`);
  }
});

test("HTTP: an unsupported clinical role in the body is rejected", async () => {
  const res = await call("POST", "/api/practice/team/m-owner/clinical-role/request", {
    user: OWNER, body: { clinicalRole: "surgeon-general" },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "invalid_clinical_role");
  assert.equal(ownerRow().clinicalRoleStatus, null, "nothing was written");
});

test("HTTP: after a legitimate approval the owner holds exactly the four reads", async () => {
  await call("POST", "/api/practice/team/m-owner/clinical-role/request", { user: OWNER });
  const approved = await call("POST", "/api/practice/team/m-owner/clinical-role/approve", {
    user: ADMIN,
  });
  assert.equal(approved.status, 200);

  const access = await getPracticeAccess(OWNER, PRACTICE_A);
  for (const p of CLINICAL_PERMS) {
    assert.equal(accessHasPermission(access, p), true, `${p} expected`);
  }
  for (const p of [
    PERMISSIONS.PRESCRIPTION_READ,
    PERMISSIONS.PRESCRIPTION_ISSUE,
    PERMISSIONS.PRESCRIPTION_CANCEL,
    PERMISSIONS.CLINICAL_AI_SUMMARY_GENERATE,
  ]) {
    assert.equal(accessHasPermission(access, p), false, `${p} must stay denied`);
  }
  // The organizational role is still owner, and admin rights are intact.
  assert.equal(access.organizationalRole, "owner");
  assert.equal(accessHasPermission(access, PERMISSIONS.SETTINGS_MANAGE), true);
});
