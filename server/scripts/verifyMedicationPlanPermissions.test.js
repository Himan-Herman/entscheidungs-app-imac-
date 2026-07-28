/**
 * Authorization for practice medication plans.
 *
 * The module was unreachable: seven permission checks handed the resolved
 * ACCESS OBJECT to helpers that take a role STRING. The object stringifies to
 * "[object Object]", which matches no role, so every check denied every user —
 * owner included. These tests pin both the fix and the matrix it must honour.
 *
 * The matrix is differentiated, so the routes use the medication permissions
 * rather than the generic patient-link ones: a secretary holds
 * patient_links.write but NOT medication.write, and a practice manager holds
 * medication.write but NOT medication.publish.
 *
 * No database: Prisma is replaced by an in-memory adapter. The real Express
 * app and middleware order are used, so the whole chain runs.
 *
 * Run: node --test scripts/verifyMedicationPlanPermissions.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-medication-permissions";
process.env.CARE_RELATIONSHIP_ENABLED = "true";
process.env.MEDICATION_PLAN_V2 = "true";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  permissionsForRole,
  PERMISSIONS,
  hasPracticePermission,
  canReadPracticePatientLinks,
} from "../utils/practicePermissions.js";
import { accessHasPermission } from "../utils/practiceAccess.js";

const P = "user-patient-P";
const P2 = "user-patient-P2";
const OUTSIDER = "user-outsider";

const PR = { A: "practice-A", B: "practice-B" };
const LINK = { A: "link-A", B: "link-B", A2: "link-A2" };

/** One member per role, all in practice A. */
const STAFF = {
  owner: "user-owner-A",
  admin: "user-admin-A",
  practice_manager: "user-manager-A",
  doctor: "user-doctor-A",
  assistant: "user-assistant-A",
  secretary: "user-secretary-A",
  viewer: "user-viewer-A",
};
const INVITED = "user-invited-A";
const REVOKED = "user-revoked-A";
const DOCTOR_B = "user-doctor-B";

const PLAN_A = "plan-of-A";
const PLAN_B = "plan-of-B";

let links;
let members;
let plans;
let consentGranted;

/* --------------------------------------------------- the defect, in isolation */

test("0. the defect: an access object stringifies to a value no role matches", () => {
  const access = { role: "owner", effectivePermissions: new Set([PERMISSIONS.MEDICATION_READ]) };

  assert.equal(String(access), "[object Object]");
  assert.equal(hasPracticePermission(access, PERMISSIONS.MEDICATION_READ), false,
    "the role-string helper cannot see the object's role");
  assert.equal(canReadPracticePatientLinks(access), false,
    "which is why every medication route denied every user");

  // The access-aware helper is the one that works.
  assert.equal(accessHasPermission(access, PERMISSIONS.MEDICATION_READ), true);
  assert.equal(hasPracticePermission(access.role, PERMISSIONS.PATIENT_LINKS_READ), true);
});

/* -------------------------------------------------- in-memory Prisma adapter */

function installFake() {
  consentGranted = true;
  links = [
    { id: LINK.A, practiceProfileId: PR.A, patientUserId: P, status: "active" },
    { id: LINK.B, practiceProfileId: PR.B, patientUserId: P, status: "active" },
    { id: LINK.A2, practiceProfileId: PR.A, patientUserId: P2, status: "active" },
  ];
  members = [
    ...Object.entries(STAFF).map(([role, userId]) => ({
      practiceProfileId: PR.A, userId, role, status: "active",
    })),
    { practiceProfileId: PR.A, userId: INVITED, role: "doctor", status: "invited" },
    { practiceProfileId: PR.A, userId: REVOKED, role: "doctor", status: "revoked" },
    { practiceProfileId: PR.B, userId: DOCTOR_B, role: "doctor", status: "active" },
  ];
  plans = [
    { id: PLAN_A, practicePatientLinkId: LINK.A, practiceProfileId: PR.A, patientUserId: P,
      status: "draft", version: 1, title: "Placeholder", note: null, createdByUserId: STAFF.doctor,
      publishedAt: null, archivedAt: null, deletedAt: null,
      createdAt: new Date(), updatedAt: new Date(), items: [] },
    { id: PLAN_B, practicePatientLinkId: LINK.B, practiceProfileId: PR.B, patientUserId: P,
      status: "draft", version: 1, title: "Placeholder", note: null, createdByUserId: DOCTOR_B,
      publishedAt: null, archivedAt: null, deletedAt: null,
      createdAt: new Date(), updatedAt: new Date(), items: [] },
  ];

  const matches = (row, where) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        if (v.notIn) return !v.notIn.includes(row[k]);
        if (v.not !== undefined) return row[k] !== v.not;
        if (v.in) return v.in.includes(row[k]);
        return true;
      }
      return row[k] === v;
    });

  prisma.practicePatientLink = {
    findFirst: async ({ where }) => links.find((l) => matches(l, where)) ?? null,
    findUnique: async ({ where }) => links.find((l) => l.id === where.id) ?? null,
  };
  prisma.practiceProfile = {
    findUnique: async ({ where }) =>
      [PR.A, PR.B].includes(where.id)
        ? { id: where.id, userId: where.id === PR.A ? STAFF.owner : "owner-of-B", practiceName: "X" }
        : null,
  };
  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      return members.find((m) => m.practiceProfileId === practiceProfileId && m.userId === userId) ?? null;
    },
  };
  prisma.consentRecord = {
    findFirst: async () => (consentGranted ? { status: "granted" } : null),
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
  };
  prisma.medicationPlan = {
    findUnique: async ({ where }) => plans.find((p) => p.id === where.id) ?? null,
    findFirst: async ({ where }) => plans.find((p) => matches(p, where)) ?? null,
    findMany: async ({ where }) => plans.filter((p) => matches(p, where)),
    create: async ({ data }) => {
      const row = { id: `plan-${plans.length + 1}`, items: [], ...data };
      plans.push(row);
      return row;
    },
    update: async ({ where, data }) => {
      const row = plans.find((p) => p.id === where.id);
      Object.assign(row, data);
      return row;
    },
    aggregate: async () => ({ _max: { version: 1 } }),
  };
  prisma.medicationPlanItem = {
    deleteMany: async () => ({ count: 0 }),
    createMany: async () => ({ count: 0 }),
    findMany: async () => [],
  };
  prisma.auditLog = { create: async () => ({}) };
  prisma.$transaction = async (arg) =>
    (typeof arg === "function" ? arg(prisma) : Promise.all(arg));
}

test.beforeEach(() => installFake());

/* ---------------------------------------------------------------- real HTTP */

let server;
let baseUrl;

test.before(async () => {
  installFake();
  const mod = await import("../routes/practiceMedicationPlans.js");
  const app = express();
  app.use(express.json());
  app.use("/api/practice/patients/:linkId/medication-plans", requireAuth, mod.default);
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

const base = (link, practice) =>
  `/api/practice/patients/${link}/medication-plans?practiceId=${practice}`;
const withPlan = (link, practice, plan, suffix = "") =>
  `/api/practice/patients/${link}/medication-plans/${plan}${suffix}?practiceId=${practice}`;

const list = (user, link = LINK.A, practice = PR.A) => call("GET", base(link, practice), user);
const detail = (user, plan = PLAN_A, link = LINK.A, practice = PR.A) =>
  call("GET", withPlan(link, practice, plan), user);
const create = (user, link = LINK.A, practice = PR.A) =>
  call("POST", base(link, practice), user, { title: "Placeholder" });
const publish = (user, plan = PLAN_A) =>
  call("POST", withPlan(LINK.A, PR.A, plan, "/publish"), user);

/* ------------------------------------------- 1./2./3. authorized roles work */

test("1. the owner may read the list and a single plan", async () => {
  assert.equal((await list(STAFF.owner)).status, 200);
  assert.equal((await detail(STAFF.owner)).status, 200);
});

test("2. a doctor may read", async () => {
  assert.equal((await list(STAFF.doctor)).status, 200);
  assert.equal((await detail(STAFF.doctor)).status, 200);
});

test("3. every role holding medication.read may read — the module is reachable again", async () => {
  for (const [role, userId] of Object.entries(STAFF)) {
    const allowed = permissionsForRole(role).includes(PERMISSIONS.MEDICATION_READ);
    const res = await list(userId);
    assert.equal(res.status, allowed ? 200 : 403,
      `${role}: expected ${allowed ? 200 : 403}, got ${res.status}`);
  }
});

test("4. a write is allowed exactly for the roles holding medication.write", async () => {
  for (const [role, userId] of Object.entries(STAFF)) {
    const allowed = permissionsForRole(role).includes(PERMISSIONS.MEDICATION_WRITE);
    const res = await create(userId);
    assert.equal(res.status, allowed ? 201 : 403,
      `${role}: create returned ${res.status}`);
  }
});

test("5. read without write cannot write", async () => {
  // assistant and viewer hold medication.read but not medication.write.
  for (const role of ["assistant", "viewer"]) {
    assert.equal((await list(STAFF[role])).status, 200, `${role} should read`);
    assert.equal((await create(STAFF[role])).status, 403, `${role} must not write`);
  }
});

test("6. a secretary may not write medication data, despite holding patient_links.write", async () => {
  const perms = permissionsForRole("secretary");
  assert.ok(perms.includes(PERMISSIONS.PATIENT_LINKS_WRITE), "fixture assumption");
  assert.ok(!perms.includes(PERMISSIONS.MEDICATION_WRITE), "fixture assumption");
  assert.equal((await list(STAFF.secretary)).status, 200);
  assert.equal((await create(STAFF.secretary)).status, 403,
    "the generic link permission must not stand in for the medication one");
});

test("6b. publishing is separate from writing", async () => {
  // practice_manager holds medication.write but not medication.publish.
  const perms = permissionsForRole("practice_manager");
  assert.ok(perms.includes(PERMISSIONS.MEDICATION_WRITE));
  assert.ok(!perms.includes(PERMISSIONS.MEDICATION_PUBLISH));
  assert.equal((await create(STAFF.practice_manager)).status, 201);
  assert.equal((await publish(STAFF.practice_manager)).status, 403);
  assert.notEqual((await publish(STAFF.doctor)).status, 403, "a doctor may publish");
});

/* ------------------------------------------------ 7.–12. the chain stays put */

test("7. an invited member has no access", async () => {
  assert.equal((await list(INVITED)).status, 403);
  assert.equal((await create(INVITED)).status, 403);
});

test("8. a revoked member has no access", async () => {
  assert.equal((await list(REVOKED)).status, 403);
  assert.equal((await create(REVOKED)).status, 403);
});

test("9. a foreign practice user cannot use practice A's context", async () => {
  assert.equal((await list(DOCTOR_B, LINK.A, PR.A)).status, 403, "not a member of A");
  // Using their own practice with A's link finds no link at all.
  assert.equal((await list(DOCTOR_B, LINK.A, PR.B)).status, 404);
});

test("10. a patient cannot use a practice route", async () => {
  for (const user of [P, P2, OUTSIDER]) {
    const res = await list(user);
    assert.equal(res.status, 403, `${user} reached the practice route`);
  }
});

test("11. a known plan id of another practice grants nothing", async () => {
  const res = await detail(STAFF.doctor, PLAN_B, LINK.A, PR.A);
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "plan_not_found");
});

test("12. a known link id of another practice grants nothing", async () => {
  const res = await list(STAFF.doctor, LINK.B, PR.A);
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "link_not_found");
});

test("13. the same patient in A and B does not mix", async () => {
  const inA = await list(STAFF.doctor, LINK.A, PR.A);
  assert.deepEqual(inA.body.plans.map((p) => p.id), [PLAN_A]);
  const inB = await list(DOCTOR_B, LINK.B, PR.B);
  assert.deepEqual(inB.body.plans.map((p) => p.id), [PLAN_B]);
});

test("14. a role without the clinical permission gains nothing from the union", async () => {
  // viewer has medication.read only; no union path may add write.
  const res = await call("PUT", withPlan(LINK.A, PR.A, PLAN_A), STAFF.viewer, { title: "x" });
  assert.equal(res.status, 403);
});

test("15. no access is granted by an owner-like string", async () => {
  // A user whose id merely looks like a role must not pass.
  for (const fake of ["owner", "[object Object]", "admin"]) {
    const res = await list(fake);
    assert.equal(res.status, 403, `"${fake}" was granted access`);
  }
});

/* ------------------------------------------------------- consent and errors */

test("16. a missing consent is reported as a consent error, not a server error", async () => {
  consentGranted = false;
  const res = await list(STAFF.doctor);
  assert.equal(res.status, 403, `expected a consent denial, got ${res.status}`);
  assert.equal(res.body.error, "consent_required");
});

test("17. an unauthenticated request is 401", async () => {
  assert.equal((await list(null)).status, 401);
});

test("18. a foreign and a missing plan are indistinguishable", async () => {
  const foreign = await detail(STAFF.doctor, PLAN_B);
  const missing = await detail(STAFF.doctor, "does-not-exist");
  assert.deepEqual(foreign.body, missing.body);
  assert.equal(foreign.status, missing.status);
});

/* ------------------------------------------------------- data minimisation */

test("19. practice responses carry no global patient id or staff id", async () => {
  const listed = await list(STAFF.doctor);
  const one = await detail(STAFF.doctor);
  for (const payload of [listed.body, one.body]) {
    const text = JSON.stringify(payload);
    assert.ok(!text.includes(P), "the global patient id must not be echoed");
    assert.ok(!text.includes(STAFF.doctor), "staff ids must not be echoed");
    assert.doesNotMatch(text, /permission|effectivePermissions|role"/i,
      "no permission object may reach a response");
  }
  assert.equal(one.body.plan.patientUserId, undefined);
  assert.equal(one.body.plan.createdByUserId, undefined);
});

/* ------------------------------------- 21. every route, once, as an owner */

test("21. no route hides a crash behind the former blanket 403", async () => {
  // The module was unreachable for every user, so nothing downstream of the
  // permission check had ever run. Each route is exercised once by a fully
  // authorized actor; a 500 here means a defect the fix has exposed.
  const owner = STAFF.owner;
  const calls = [
    ["GET    list",     () => call("GET", base(LINK.A, PR.A), owner)],
    ["POST   create",   () => call("POST", base(LINK.A, PR.A), owner, { title: "Placeholder", note: "n" })],
    ["GET    detail",   () => call("GET", withPlan(LINK.A, PR.A, PLAN_A), owner)],
    ["PUT    update",   () => call("PUT", withPlan(LINK.A, PR.A, PLAN_A), owner, { title: "Placeholder", note: "n", items: [] })],
    ["PATCH  archive",  () => call("PATCH", withPlan(LINK.A, PR.A, PLAN_A, "/archive"), owner)],
    ["PATCH  restore",  () => call("PATCH", withPlan(LINK.A, PR.A, PLAN_A, "/restore"), owner)],
    ["POST   publish",  () => call("POST", withPlan(LINK.A, PR.A, PLAN_A, "/publish"), owner)],
    ["PATCH  delete",   () => call("PATCH", withPlan(LINK.A, PR.A, PLAN_A, "/delete"), owner, { confirm: true })],
  ];
  const crashes = [];
  for (const [label, run] of calls) {
    const res = await run();
    if (res.status >= 500) crashes.push(`${label} -> ${res.status} ${JSON.stringify(res.body)}`);
    // A 4xx is a legitimate business answer (wrong state, validation); a 5xx is not.
    assert.notEqual(res.status, 403, `${label}: the owner must not be denied`);
  }
  assert.deepEqual(crashes, []);
});

test("22. the plan lookup is called with (linkId, practiceProfileId, planId) everywhere", async () => {
  // Two call sites had the first and third arguments swapped, so they resolved
  // the plan id as a link and always failed with link_not_found.
  const { readFileSync } = await import("node:fs");
  const files = [
    "../routes/practiceMedicationPlans.js",
    "../services/medicationPlan/medicationPlanAiService.js",
  ];
  const wrong = [];
  for (const rel of files) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8");
    for (const m of src.matchAll(/getMedicationPlanByLink\(\s*([^,]+),\s*([^,]+),\s*([^,)]+),?\s*\)/g)) {
      const [, first, , third] = m.map((x) => x.trim());
      if (/planId/.test(first) || /linkId/.test(third)) wrong.push(`${rel}: (${first}, …, ${third})`);
    }
  }
  assert.deepEqual(wrong, []);
});

/* ------------------------------------------------------------ static guards */

test("20. no permission helper in this router receives an access object", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../routes/practiceMedicationPlans.js", import.meta.url), "utf8");
  const offenders = [...src.matchAll(/(can[A-Za-z]+|hasPracticePermission)\(ctx\.access\)/g)].map((m) => m[1]);
  assert.deepEqual(offenders, [],
    "use accessHasPermission(ctx.access, PERMISSIONS.X)");
  assert.doesNotMatch(src, /String\(\s*ctx\.access\s*\)/, "no stringified access object");
  assert.doesNotMatch(src, /accessHasPermission\(\s*ctx\.access\.role/, "pass the object, not the role");
});
