/**
 * Hard-delete guard for contextual patient data.
 *
 * A medical record classified as practice_contextual carries an ON DELETE
 * RESTRICT foreign key to the care relationship it was created in. Deleting the
 * practice or the account would cascade into that link and fail deep inside the
 * database. These tests pin the preflight that turns it into a clean 409 and
 * proves nothing is partially deleted.
 *
 * No database: Prisma is replaced by an in-memory adapter, so this never
 * touches medscoutx_dev. Routes, middleware and error mapping run for real.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-lifecycle";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  CONTEXTUAL_DATA_BLOCKED,
  blockerAuditMetadata,
  checkPracticeDeletionBlockers,
  checkUserDeletionBlockers,
  checkPracticePatientLinkDeletionBlockers,
} from "../services/dataLifecycle/contextualPatientDataDeletionGuard.js";

const OWNER = "user-owner-A";
const PATIENT = "user-patient-P";
const OUTSIDER = "user-outsider";
const PRACTICE_A = "practice-A";
const PRACTICE_B = "practice-B";
const OWNER_B = "user-owner-B";
const LINK_A = "link-A";
const LINK_B = "link-B";

const MODELS = ["vitalEntry", "vaccinationEntry", "allergyEntry", "diagnosisEntry"];
/** Must match DELETE_CONFIRM in routes/account.js. */
const DELETE_CONFIRM = "DELETE_MY_MEDSCOUTX_DATA";

let practices;
let links;
let records;   // { model -> [{ id, dataScope, contextPracticePatientLinkId }] }
let deleted;   // what the routes actually removed
let auditRows;

function resetData() {
  practices = [
    { id: PRACTICE_A, userId: OWNER },
    { id: PRACTICE_B, userId: OWNER_B },
  ];
  links = [
    { id: LINK_A, practiceProfileId: PRACTICE_A, patientUserId: PATIENT, status: "active" },
    { id: LINK_B, practiceProfileId: PRACTICE_B, patientUserId: PATIENT, status: "active" },
  ];
  records = Object.fromEntries(MODELS.map((m) => [m, []]));
  deleted = { practiceProfile: [], user: [], practicePatientLink: [] };
  auditRows = [];
}

/** Adds a contextual medical record of the given kind to a link. */
function addContextual(model, linkId, id = `${model}-1`) {
  records[model].push({
    id, dataScope: "practice_contextual", contextPracticePatientLinkId: linkId,
    // A value that must never appear in any response.
    secretValue: "CONFIDENTIAL-MEDICAL-VALUE",
  });
}

/** Adds a patient-global record — must never block anything. */
function addGlobal(model, id = `${model}-g`) {
  records[model].push({ id, dataScope: "patient_global", contextPracticePatientLinkId: null });
}

function matchesCount(rows, where) {
  const ids = where?.contextPracticePatientLinkId?.in ?? [];
  return rows.filter(
    (r) => r.dataScope === where.dataScope && ids.includes(r.contextPracticePatientLinkId),
  ).length;
}

function installPrismaFake() {
  resetData();
  prisma.practiceProfile = {
    // getPracticeAccess resolves ownership through findUnique.
    findUnique: async ({ where }) => practices.find((p) => p.id === where.id) ?? null,
    findMany: async ({ where }) =>
      practices.filter((p) => (where?.userId ? p.userId === where.userId : true)),
    deleteMany: async ({ where }) => {
      const hit = practices.filter((p) => (where.id ? p.id === where.id : p.userId === where.userId));
      deleted.practiceProfile.push(...hit.map((p) => p.id));
      practices = practices.filter((p) => !hit.includes(p));
      // The database would cascade into the links.
      for (const p of hit) {
        const gone = links.filter((l) => l.practiceProfileId === p.id);
        deleted.practicePatientLink.push(...gone.map((l) => l.id));
        links = links.filter((l) => l.practiceProfileId !== p.id);
      }
      return { count: hit.length };
    },
  };
  prisma.practicePatientLink = {
    findMany: async ({ where }) => {
      if (where?.OR) {
        return links.filter((l) =>
          where.OR.some((c) =>
            c.patientUserId ? l.patientUserId === c.patientUserId
              : c.practiceProfileId?.in?.includes(l.practiceProfileId)),
        );
      }
      return links.filter((l) => l.practiceProfileId === where.practiceProfileId);
    },
    update: async ({ where, data }) => {
      const row = links.find((l) => l.id === where.id);
      Object.assign(row, data);
      return row;
    },
  };
  for (const model of MODELS) {
    prisma[model] = { count: async ({ where }) => matchesCount(records[model], where) };
  }
  // No memberships in this fixture: access is decided purely by ownership.
  prisma.practiceMember = {
    findUnique: async () => null,
    deleteMany: async () => ({ count: 0 }),
  };
  prisma.user = {
    delete: async ({ where }) => {
      deleted.user.push(where.id);
      return { id: where.id };
    },
  };
  prisma.auditLog = {
    create: async ({ data }) => {
      auditRows.push(data);
      return data;
    },
  };
  // The account route deletes from many tables; everything else is a no-op.
  const noop = { deleteMany: async () => ({ count: 0 }), updateMany: async () => ({ count: 0 }), findMany: async () => [] };
  for (const d of [
    "preVisitSession", "preVisitCase", "doctorContact", "doctor",
    "interpreterCloudSession", "interpreterCloudPreference", "practiceInterpreterInvite",
    "externalResourceReference", "practiceMedaSession", "practiceDocumentAuditEntry",
    "billingPlausibilitySession", "billingPlausibilityItem", "billingPlausibilityAuditLog",
  ]) {
    prisma[d] = { ...noop };
  }
  prisma.auditLog.deleteMany = async () => ({ count: 0 });
  prisma.auditLog.updateMany = async () => ({ count: 0 });
  prisma.$transaction = async (fn) => fn(prisma);
}

test.beforeEach(() => installPrismaFake());

/* ------------------------------------------------------------ unit level */

test("a practice without contextual data reports no blockers", async () => {
  addGlobal("vitalEntry");
  const r = await checkPracticeDeletionBlockers(PRACTICE_A, prisma);
  assert.equal(r.blocked, false);
  assert.equal(r.total, 0);
  assert.deepEqual(r.categories, []);
});

for (const [model, category] of Object.entries({
  vitalEntry: "vitals", vaccinationEntry: "vaccinations",
  allergyEntry: "allergies", diagnosisEntry: "diagnoses",
})) {
  test(`a contextual ${category} record blocks the practice deletion`, async () => {
    addContextual(model, LINK_A);
    const r = await checkPracticeDeletionBlockers(PRACTICE_A, prisma);
    assert.equal(r.blocked, true);
    assert.equal(r.total, 1);
    assert.deepEqual(r.categories, [category]);
  });
}

test("only the affected practice is blocked, not its neighbour", async () => {
  addContextual("vitalEntry", LINK_A);
  assert.equal((await checkPracticeDeletionBlockers(PRACTICE_A, prisma)).blocked, true);
  assert.equal((await checkPracticeDeletionBlockers(PRACTICE_B, prisma)).blocked, false);
});

test("the account guard covers both the patient side and owned practices", async () => {
  // Patient side: the user is the patient of link B.
  addContextual("allergyEntry", LINK_B);
  assert.equal((await checkUserDeletionBlockers(PATIENT, prisma)).blocked, true);
  assert.equal((await checkUserDeletionBlockers(OWNER, prisma)).blocked, false);

  // Owner side: a record on the practice this user owns.
  installPrismaFake();
  addContextual("diagnosisEntry", LINK_A);
  assert.equal((await checkUserDeletionBlockers(OWNER, prisma)).blocked, true);
});

test("the single-link check works and patient_global never blocks", async () => {
  addGlobal("vitalEntry");
  addGlobal("diagnosisEntry");
  assert.equal((await checkPracticePatientLinkDeletionBlockers(LINK_A, prisma)).blocked, false);

  addContextual("vitalEntry", LINK_A);
  assert.equal((await checkPracticePatientLinkDeletionBlockers(LINK_A, prisma)).blocked, true);
  assert.equal((await checkPracticePatientLinkDeletionBlockers(LINK_B, prisma)).blocked, false);
});

test("audit metadata is aggregate only — no ids, no medical values", () => {
  addContextual("vitalEntry", LINK_A);
  addContextual("diagnosisEntry", LINK_A);
  const meta = blockerAuditMetadata({
    total: 2, categories: ["vitals", "diagnoses"], linkIds: [LINK_A],
  });
  const serialized = JSON.stringify(meta);
  assert.equal(meta.blockerCount, 2);
  assert.deepEqual(meta.blockerCategories, ["vitals", "diagnoses"]);
  assert.ok(!serialized.includes(LINK_A), "no link id");
  assert.ok(!serialized.includes("CONFIDENTIAL"), "no medical value");
  assert.ok(!("linkIds" in meta), "link ids must not reach the audit trail");
});

/* ---------------------------------------------------------------- real HTTP */

let server;
let baseUrl;

test.before(async () => {
  installPrismaFake();
  const [practicesRouter, accountRouter] = await Promise.all([
    import("../routes/practices.js"),
    import("../routes/account.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api/practices", requireAuth, practicesRouter.default);
  app.use("/api/account", requireAuth, accountRouter.default);
  await new Promise((r) => {
    server = app.listen(0, "127.0.0.1", r);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((r) => server.close(r)));

async function call(method, path, { user, body } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

test("HTTP 1) a practice without contextual data can still be deleted", async () => {
  addGlobal("vitalEntry");
  const res = await call("DELETE", `/api/practices/${PRACTICE_A}`, { user: OWNER });
  assert.equal(res.status, 200);
  assert.equal(res.body.deleted, true);
  assert.deepEqual(deleted.practiceProfile, [PRACTICE_A]);
});

for (const [model, label] of Object.entries({
  vitalEntry: "vital", vaccinationEntry: "vaccination",
  allergyEntry: "allergy", diagnosisEntry: "diagnosis",
})) {
  test(`HTTP 2-5) a contextual ${label} record yields 409`, async () => {
    addContextual(model, LINK_A);
    const res = await call("DELETE", `/api/practices/${PRACTICE_A}`, { user: OWNER });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, CONTEXTUAL_DATA_BLOCKED);
  });
}

test("HTTP 6+14) the error body carries no counts, ids or medical content", async () => {
  addContextual("vitalEntry", LINK_A);
  addContextual("diagnosisEntry", LINK_A, "diagnosisEntry-2");
  const res = await call("DELETE", `/api/practices/${PRACTICE_A}`, { user: OWNER });
  assert.equal(res.status, 409);
  assert.deepEqual(Object.keys(res.body).sort(), ["error", "ok"]);
  const serialized = JSON.stringify(res.body);
  for (const secret of [LINK_A, PRACTICE_A, "vitalEntry-1", "CONFIDENTIAL", "vitals", "2"]) {
    assert.ok(!serialized.includes(secret), `leaked "${secret}"`);
  }
});

test("HTTP 7) account deletion is blocked by an owned practice's link", async () => {
  addContextual("vaccinationEntry", LINK_A);
  const res = await call("DELETE", "/api/account/delete", {
    user: OWNER, body: { confirmation: DELETE_CONFIRM },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, CONTEXTUAL_DATA_BLOCKED);
});

test("HTTP 8) account deletion is blocked when the user is the patient", async () => {
  addContextual("allergyEntry", LINK_B);
  const res = await call("DELETE", "/api/account/delete", {
    user: PATIENT, body: { confirmation: DELETE_CONFIRM },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, CONTEXTUAL_DATA_BLOCKED);
});

test("HTTP 9) after a 409 nothing was deleted", async () => {
  addContextual("diagnosisEntry", LINK_A);

  const practice = await call("DELETE", `/api/practices/${PRACTICE_A}`, { user: OWNER });
  assert.equal(practice.status, 409);
  const account = await call("DELETE", "/api/account/delete", {
    user: OWNER, body: { confirmation: DELETE_CONFIRM },
  });
  assert.equal(account.status, 409);

  assert.deepEqual(deleted.practiceProfile, [], "no practice removed");
  assert.deepEqual(deleted.user, [], "no user removed");
  assert.deepEqual(deleted.practicePatientLink, [], "no link removed");
  assert.equal(practices.length, 2, "both practices still present");
  assert.equal(links.length, 2, "both links still present");
  assert.equal(records.diagnosisEntry.length, 1, "the medical record survives");
});

test("HTTP 10) revoking a link stays possible while a delete is blocked", async () => {
  addContextual("vitalEntry", LINK_A);
  assert.equal((await call("DELETE", `/api/practices/${PRACTICE_A}`, { user: OWNER })).status, 409);

  // The soft path is untouched by the guard.
  await prisma.practicePatientLink.update({
    where: { id: LINK_A }, data: { status: "revoked", revokedAt: new Date() },
  });
  assert.equal(links.find((l) => l.id === LINK_A).status, "revoked");

  // ...and a revoked link still blocks the hard delete: revoking is not archiving.
  assert.equal((await checkPracticePatientLinkDeletionBlockers(LINK_A, prisma)).blocked, true);
});

test("HTTP 11) a link without contextual references does not block", async () => {
  addContextual("vitalEntry", LINK_B);
  const res = await call("DELETE", `/api/practices/${PRACTICE_A}`, { user: OWNER });
  assert.equal(res.status, 200, "practice A is unaffected by a record on link B");
});

test("HTTP 12) a database-level failure rolls the whole thing back", async () => {
  // Simulates the race: the preflight sees nothing, a contextual record appears,
  // and the foreign key rejects the cascade. The transaction must roll back and
  // the route must not report success.
  addGlobal("vitalEntry");
  prisma.practiceProfile.deleteMany = async () => {
    const err = new Error("Foreign key constraint failed on the field: `contextPracticePatientLinkId`");
    err.code = "P2003";
    throw err;
  };
  const res = await call("DELETE", `/api/practices/${PRACTICE_A}`, { user: OWNER });
  assert.notEqual(res.status, 200, "must not report success");
  assert.deepEqual(deleted.practiceProfile, [], "nothing deleted");
  assert.equal(practices.length, 2, "practices intact");
});

test("HTTP 13) a foreign user learns nothing about another practice's blockers", async () => {
  addContextual("vitalEntry", LINK_A);
  const res = await call("DELETE", `/api/practices/${PRACTICE_A}`, { user: OUTSIDER });
  // Not the owner -> 404, the same answer as for a practice that does not exist.
  assert.equal(res.status, 404);
  assert.notEqual(res.body.error, CONTEXTUAL_DATA_BLOCKED, "must not reveal that blockers exist");
  assert.deepEqual(deleted.practiceProfile, []);
});

test("a blocked attempt is audited with aggregate data only", async () => {
  addContextual("vitalEntry", LINK_A);
  await call("DELETE", `/api/practices/${PRACTICE_A}`, { user: OWNER });

  const blocked = auditRows.find((r) => r.action === "practice_delete_blocked");
  assert.ok(blocked, "blocked attempt must be audited");
  const serialized = JSON.stringify(blocked.metadata ?? {});
  assert.ok(serialized.includes("blockerCount"), "aggregate count recorded");
  assert.ok(!serialized.includes(LINK_A), "no link id in the audit trail");
  assert.ok(!serialized.includes("CONFIDENTIAL"), "no medical value in the audit trail");
});
