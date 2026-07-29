/**
 * The release gate on destructive practice deletion.
 *
 * The lifecycle work made these paths technically safe; what is open is
 * retention LAW — deleting a practice still deletes its documents. Until that
 * is decided, production must not be able to run them: closed by default,
 * opened only by the exact string "true", never implicitly.
 *
 * A plain patient's account erasure is deliberately NOT gated: it deletes no
 * practice and no practice documents.
 *
 * Run: node --test scripts/verifyDestructiveDeletionGate.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-deletion-gate";
// The suite toggles the gate per test; start closed.
delete process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION;

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  isDestructivePracticeDeletionEnabled,
  assertDestructivePracticeDeletionEnabled,
  PRACTICE_DELETION_UNAVAILABLE,
  OWNER_ACCOUNT_DELETION_UNAVAILABLE,
} from "../services/startup/destructiveDeletionGate.js";

const OWNER = "user-owner-A";
const PATIENT = "user-patient-P";
const OUTSIDER = "user-outsider";
const PR_A = "practice-A";
const LINK_A = "link-A";
const PRACTICE_CONFIRM = "DELETE_THIS_PRACTICE";
const ACCOUNT_CONFIRM = "DELETE_MY_MEDSCOUTX_DATA";

let practices;
let links;
let records;
let archives;
let audits;
let deletedUsers;

function installFake() {
  practices = [{ id: PR_A, userId: OWNER, practiceName: "Praxis A", displayNameForPatients: null, specialty: null }];
  links = [{ id: LINK_A, practiceProfileId: PR_A, patientUserId: PATIENT, status: "active" }];
  records = {
    vitalEntry: [{ id: "v1", userId: PATIENT, dataScope: "practice_contextual", contextPracticePatientLinkId: LINK_A, archivedPracticeContextId: null }],
    vaccinationEntry: [], allergyEntry: [], diagnosisEntry: [],
  };
  archives = [];
  audits = [];
  deletedUsers = [];

  const matches = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "OR") return v.some((b) => matches(row, b));
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (v.in) return v.in.includes(row[k]);
        return true;
      }
      return row[k] === v;
    });
  const modelApi = (arr) => ({
    findMany: async ({ where = {}, orderBy } = {}) => {
      const hit = arr.filter((r) => matches(r, where));
      if (orderBy?.id === "asc") hit.sort((a, b) => a.id.localeCompare(b.id));
      return hit.map((r) => ({ ...r }));
    },
    findFirst: async ({ where = {} }) => arr.find((r) => matches(r, where)) ?? null,
    findUnique: async ({ where }) => arr.find((r) =>
      (where.id !== undefined && r.id === where.id)
      || (where.originalPracticePatientLinkId !== undefined
        && r.originalPracticePatientLinkId === where.originalPracticePatientLinkId)) ?? null,
    count: async ({ where = {} }) => arr.filter((r) => matches(r, where)).length,
    updateMany: async ({ where = {}, data }) => {
      const hit = arr.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data);
      return { count: hit.length };
    },
    deleteMany: async ({ where = {} }) => {
      const hit = arr.filter((r) => matches(r, where));
      for (const r of hit) arr.splice(arr.indexOf(r), 1);
      return { count: hit.length };
    },
    create: async ({ data }) => { const row = { id: `row-${arr.length + 1}`, ...data }; arr.push(row); return { ...row }; },
    update: async ({ where, data }) => { const r = arr.find((x) => x.id === where.id); Object.assign(r, data); return r; },
  });

  prisma.practiceProfile = {
    ...modelApi(practices),
    deleteMany: async ({ where }) => {
      const hit = practices.filter((p) => matches(p, where));
      for (const p of hit) {
        practices.splice(practices.indexOf(p), 1);
        for (const l of links.filter((x) => x.practiceProfileId === p.id)) links.splice(links.indexOf(l), 1);
      }
      return { count: hit.length };
    },
  };
  prisma.practicePatientLink = modelApi(links);
  prisma.practiceMember = { findUnique: async () => null, findFirst: async () => null, deleteMany: async () => ({ count: 0 }) };
  for (const [model, arr] of Object.entries(records)) prisma[model] = modelApi(arr);
  prisma.archivedPracticePatientContext = modelApi(archives);
  prisma.practiceDocumentShareGrant = modelApi([]);
  prisma.secureDocumentAccessToken = modelApi([]);
  prisma.user = {
    findUnique: async ({ where }) => ({ id: where.id, email: "x@x.invalid" }),
    delete: async ({ where }) => { deletedUsers.push(where.id); return { id: where.id }; },
  };
  prisma.auditLog = {
    create: async ({ data }) => { audits.push(data); return data; },
    deleteMany: async () => ({ count: 0 }),
    updateMany: async () => ({ count: 0 }),
  };
  const noop = { deleteMany: async () => ({ count: 0 }), updateMany: async () => ({ count: 0 }), findMany: async () => [] };
  for (const d of [
    "preVisitSession", "preVisitCase", "doctorContact", "doctor",
    "interpreterCloudSession", "interpreterCloudPreference", "practiceInterpreterInvite",
    "externalResourceReference", "practiceMedaSession", "practiceDocumentAuditEntry",
    "billingPlausibilitySession", "billingPlausibilityItem", "billingPlausibilityAuditLog",
    "preVisitFollowUpThread", "consentRecord",
  ]) prisma[d] = { ...noop, findUnique: async () => null, count: async () => 0 };
  prisma.$queryRaw = async (strings, ...values) => {
    const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
    if (/FROM "User"/.test(sql)) return [OWNER, PATIENT].includes(values[0]) ? [{ id: values[0] }] : [];
    if (/FROM "PracticeProfile"/.test(sql)) return practices.filter((p) => p.id === values[0]).map((p) => ({ id: p.id }));
    if (/FROM "PracticePatientLink"/.test(sql)) {
      const ids = values[0] ?? [];
      return links.filter((l) => ids.includes(l.id)).sort((a, b) => a.id.localeCompare(b.id)).map((l) => ({ ...l }));
    }
    return [];
  };
  prisma.$transaction = async (arg) => {
    if (typeof arg !== "function") return Promise.all(arg);
    const snap = JSON.stringify({ practices, links, records, archives });
    try { return await arg(prisma); } catch (e) {
      const s = JSON.parse(snap);
      practices.length = 0; practices.push(...s.practices);
      links.length = 0; links.push(...s.links);
      archives.length = 0; archives.push(...s.archives);
      for (const [m, arr] of Object.entries(records)) { arr.length = 0; arr.push(...s.records[m]); }
      throw e;
    }
  };
}

test.beforeEach(() => {
  delete process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION;
  installFake();
});
test.after(() => { delete process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION; });

let server;
let baseUrl;

test.before(async () => {
  installFake();
  const [practicesRouter, accountRouter] = await Promise.all([
    import("../routes/practices.js"),
    import("../routes/account.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api/practices", requireAuth, practicesRouter.default);
  app.use("/api/account", requireAuth, accountRouter.default);
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
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const delPractice = (user, body = { confirmation: PRACTICE_CONFIRM }) =>
  call("DELETE", `/api/practices/${PR_A}`, user, body);
const delAccount = (user) =>
  call("DELETE", "/api/account/delete", user, { confirmation: ACCOUNT_CONFIRM });

/** Nothing destructive happened. */
function assertUntouched() {
  assert.ok(practices.some((p) => p.id === PR_A), "the practice survives");
  assert.equal(links.length, 1, "the link survives");
  assert.equal(records.vitalEntry[0].contextPracticePatientLinkId, LINK_A, "the record keeps its live link");
  assert.equal(archives.length, 0, "nothing was archived");
  assert.deepEqual(deletedUsers, [], "no user was deleted");
}

/* -------------------------------------------------------- 1.–4. the switch */

test("1.–3. only the exact string 'true' opens the gate", () => {
  for (const value of [undefined, "false", "1", "TRUE", "True", "yes", " true", "true ", ""]) {
    const env = value === undefined ? {} : { ENABLE_DESTRUCTIVE_PRACTICE_DELETION: value };
    assert.equal(isDestructivePracticeDeletionEnabled(env), false, JSON.stringify(value));
    assert.throws(() => assertDestructivePracticeDeletionEnabled(env),
      new RegExp(PRACTICE_DELETION_UNAVAILABLE));
  }
  assert.equal(isDestructivePracticeDeletionEnabled({ ENABLE_DESTRUCTIVE_PRACTICE_DELETION: "true" }), true);
  // NODE_ENV alone never opens it.
  assert.equal(isDestructivePracticeDeletionEnabled({ NODE_ENV: "development" }), false);
  assert.equal(isDestructivePracticeDeletionEnabled({ NODE_ENV: "test" }), false);
});

test("1./2. HTTP: practice deletion is refused while the gate is closed", async () => {
  for (const value of [undefined, "false"]) {
    delete process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION;
    if (value !== undefined) process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION = value;
    const res = await delPractice(OWNER);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.error, PRACTICE_DELETION_UNAVAILABLE);
  }
  assertUntouched();
});

test("4./5. with 'true' the path works — and still demands the phrase", async () => {
  process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION = "true";
  const noPhrase = await delPractice(OWNER, {});
  assert.equal(noPhrase.status, 400);
  assert.equal(noPhrase.body.error, "confirmation_required");
  assertUntouched();

  const res = await delPractice(OWNER);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(practices.length, 0);
  assert.equal(archives.length, 1, "the record was archived on the way");
});

/* -------------------------------------------- 6.–9. account differentiation */

test("6. a plain patient can still erase their account", async () => {
  const res = await delAccount(PATIENT);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(deletedUsers, [PATIENT]);
  assert.ok(practices.some((p) => p.id === PR_A), "the foreign practice is untouched");
});

test("7.–9. an owner's erasure is refused while the gate is closed", async () => {
  const res = await delAccount(OWNER);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error, OWNER_ACCOUNT_DELETION_UNAVAILABLE);
  assertUntouched();

  // With a second practice it stays refused all the same.
  practices.push({ id: "practice-A2", userId: OWNER, practiceName: "Praxis A2" });
  const two = await delAccount(OWNER);
  assert.equal(two.status, 409);
  assert.equal(two.body.error, OWNER_ACCOUNT_DELETION_UNAVAILABLE);
});

test("9b. ownership gained between check and transaction is still caught", async () => {
  // The early count sees no practice; ownership appears before the in-tx list.
  const originalCount = prisma.practiceProfile.count;
  prisma.practiceProfile.count = async () => {
    practices.push({ id: "practice-raced", userId: PATIENT, practiceName: "Neu" });
    prisma.practiceProfile.count = originalCount;
    return 0; // the stale early answer
  };
  const res = await delAccount(PATIENT);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error, OWNER_ACCOUNT_DELETION_UNAVAILABLE);
  assert.deepEqual(deletedUsers, [], "the in-transaction re-check must win");
  assert.ok(practices.some((p) => p.id === "practice-raced"));
});

/* -------------------------------------------- 10.–14. nothing changes */

test("10.–13. a blocked request changes no data and writes no success audit", async () => {
  await delPractice(OWNER);
  await delAccount(OWNER);
  assertUntouched();
  const success = audits.filter((a) =>
    ["practice_deletion_completed", "account_deletion_completed",
      "practice_patient_context_archived"].includes(a.action));
  assert.deepEqual(success, [], "no success audit for a refused attempt");
});

test("14. the gate discloses nothing about foreign practices", async () => {
  // A non-owner and an outsider get the SAME answers as before the gate:
  // membership semantics first, the gate only after a legitimate owner check.
  const outsider = await delPractice(OUTSIDER);
  assert.equal(outsider.status, 404);
  assert.equal(outsider.body.error, "practice_not_found");
  const patient = await delPractice(PATIENT);
  assert.equal(patient.status, 404, "a linked patient is not a member either");
});

/* ------------------------------------------------- 15.–17. wiring */

test("15./16. the gate also guards the internal service call", async () => {
  const { deletePracticeWithArchivedContext, ARCHIVE_REASONS } =
    await import("../services/dataLifecycle/archivePracticePatientContext.js");
  await assert.rejects(
    () => prisma.$transaction(async (tx) => deletePracticeWithArchivedContext({
      transaction: tx, practiceProfileId: PR_A,
      deletionReason: ARCHIVE_REASONS.PRACTICE_DELETED, deletingUserId: OWNER,
    })),
    new RegExp(PRACTICE_DELETION_UNAVAILABLE),
    "a future internal caller cannot bypass the gate",
  );
  assertUntouched();

  process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION = "true";
  const summary = await prisma.$transaction(async (tx) => deletePracticeWithArchivedContext({
    transaction: tx, practiceProfileId: PR_A,
    deletionReason: ARCHIVE_REASONS.PRACTICE_DELETED, deletingUserId: OWNER,
  }));
  assert.equal(summary.archived.archivedLinks, 1, "explicitly enabled, the service works");
});

test("17. the startup line logs the boolean and nothing else", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(src, /destructivePracticeDeletionEnabled: \$\{deletionEnabled\}/);
  assert.doesNotMatch(src, /ENABLE_DESTRUCTIVE_PRACTICE_DELETION\s*[^\n]*console/,
    "the raw variable value is never logged");
  assert.match(src, /disabled pending retention-policy approval/);
});
