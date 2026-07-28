/**
 * HTTP behaviour of DELETE /api/practices/:id after archiving was introduced.
 *
 * The real Express app and middleware order are used; Prisma is replaced by an
 * in-memory adapter. The database-level guarantees (FOR UPDATE, RESTRICT,
 * rollback) are covered separately by
 * verifyPracticeDeletionArchiveSandbox.mjs against real PostgreSQL — this file
 * pins the route contract: who may delete, what the client is told, and what
 * never leaves the server.
 *
 * Run: node --test scripts/verifyPracticeDeletionHttp.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-practice-deletion";
process.env.CARE_RELATIONSHIP_ENABLED = "true";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const OWNER_A = "user-owner-A";
const MEMBER_A = "user-member-A";
const OWNER_B = "user-owner-B";
const OUTSIDER = "user-outsider";
const P1 = "user-patient-P1";

const PR = { A: "practice-A", B: "practice-B" };
const LINK = { A1: "link-A1", B1: "link-B1" };
const CONFIRM = "DELETE_THIS_PRACTICE";

let practices;
let links;
let members;
let records;
let grants;
let tokens;
let archives;
let audits;
let failAfterArchive;

function installFake() {
  failAfterArchive = false;
  practices = [
    { id: PR.A, userId: OWNER_A, practiceName: "Praxis A", displayNameForPatients: "Praxis A", specialty: "Kardiologie" },
    { id: PR.B, userId: OWNER_B, practiceName: "Praxis B", displayNameForPatients: null, specialty: null },
  ];
  links = [
    { id: LINK.A1, practiceProfileId: PR.A, patientUserId: P1, status: "active" },
    { id: LINK.B1, practiceProfileId: PR.B, patientUserId: P1, status: "active" },
  ];
  members = [{ practiceProfileId: PR.A, userId: MEMBER_A, role: "admin", status: "active" }];
  records = {
    vitalEntry: [
      { id: "v1", userId: P1, dataScope: "practice_contextual", contextPracticePatientLinkId: LINK.A1, archivedPracticeContextId: null },
      { id: "v-global", userId: P1, dataScope: "patient_global", contextPracticePatientLinkId: null, archivedPracticeContextId: null },
      { id: "v-b", userId: P1, dataScope: "practice_contextual", contextPracticePatientLinkId: LINK.B1, archivedPracticeContextId: null },
    ],
    vaccinationEntry: [],
    allergyEntry: [],
    diagnosisEntry: [
      { id: "d1", userId: P1, dataScope: "practice_contextual", contextPracticePatientLinkId: LINK.A1, archivedPracticeContextId: null },
    ],
  };
  grants = [];
  tokens = [];
  archives = [];
  audits = [];

  const matches = (row, where) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "OR") return v.some((b) => matches(row, b));
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        if (v.in) return v.in.includes(row[k]);
        if (v.not !== undefined) return row[k] !== v.not;
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
    create: async ({ data }) => {
      const row = { id: `row-${arr.length + 1}`, ...data };
      arr.push(row);
      return { ...row };
    },
  });

  prisma.practiceProfile = {
    ...modelApi(practices),
    deleteMany: async ({ where }) => {
      const hit = practices.filter((p) => p.id === where.id);
      for (const p of hit) {
        practices.splice(practices.indexOf(p), 1);
        // Cascade, as the database would.
        for (const l of links.filter((x) => x.practiceProfileId === p.id)) links.splice(links.indexOf(l), 1);
      }
      return { count: hit.length };
    },
  };
  prisma.practicePatientLink = modelApi(links);
  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      return members.find((m) => m.practiceProfileId === practiceProfileId && m.userId === userId) ?? null;
    },
    findFirst: async ({ where = {} }) => members.find((m) => matches(m, where)) ?? null,
  };
  for (const [model, arr] of Object.entries(records)) prisma[model] = modelApi(arr);
  prisma.archivedPracticePatientContext = modelApi(archives);
  prisma.practiceDocumentShareGrant = modelApi(grants);
  prisma.secureDocumentAccessToken = modelApi(tokens);
  prisma.auditLog = { create: async ({ data }) => { audits.push(data); return data; } };

  prisma.$queryRaw = async (strings, ...values) => {
    const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
    if (/FROM "PracticeProfile"/.test(sql)) {
      return practices.filter((p) => p.id === values[0]).map((p) => ({ id: p.id }));
    }
    if (/FROM "PracticePatientLink"/.test(sql)) {
      const ids = values[0] ?? [];
      return links.filter((l) => ids.includes(l.id))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((l) => ({ ...l }));
    }
    return [];
  };
  prisma.$transaction = async (arg) => {
    if (typeof arg !== "function") return Promise.all(arg);
    // A crude but honest rollback: snapshot, run, restore on throw.
    const snapshot = JSON.stringify({ practices, links, records, grants, tokens, archives });
    try {
      const out = await arg(prisma);
      if (failAfterArchive) throw new Error("deliberate failure after archiving");
      return out;
    } catch (e) {
      const s = JSON.parse(snapshot);
      practices.length = 0; practices.push(...s.practices);
      links.length = 0; links.push(...s.links);
      archives.length = 0; archives.push(...s.archives);
      grants.length = 0; grants.push(...s.grants);
      tokens.length = 0; tokens.push(...s.tokens);
      for (const [m, arr] of Object.entries(records)) { arr.length = 0; arr.push(...s.records[m]); }
      throw e;
    }
  };
}

test.beforeEach(() => installFake());

/* ---------------------------------------------------------------- real HTTP */

let server;
let baseUrl;

test.before(async () => {
  installFake();
  const mod = await import("../routes/practices.js");
  const app = express();
  app.use(express.json());
  app.use("/api/practices", requireAuth, mod.default);
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((r) => server.close(r)));

async function del(user, practiceId, body = { confirmation: CONFIRM }) {
  const res = await fetch(`${baseUrl}/api/practices/${practiceId}`, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

/* --------------------------------------------------------------- the route */

test("1. the owner can delete a practice that holds contextual patient data", async () => {
  const res = await del(OWNER_A, PR.A);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.deleted, true);
  assert.equal(practices.find((p) => p.id === PR.A), undefined);
});

test("2. the medical records survive, archived rather than deleted", async () => {
  await del(OWNER_A, PR.A);
  const v = records.vitalEntry.find((r) => r.id === "v1");
  const d = records.diagnosisEntry.find((r) => r.id === "d1");
  for (const r of [v, d]) {
    assert.ok(r, "the record must still exist");
    assert.equal(r.dataScope, "practice_contextual", "the scope is never re-labelled");
    assert.equal(r.contextPracticePatientLinkId, null, "the live link is gone");
    assert.ok(r.archivedPracticeContextId, "an archive context took its place");
  }
  assert.equal(archives.length, 1, "one archive per former link");
  assert.equal(v.archivedPracticeContextId, d.archivedPracticeContextId,
    "all types of one link share a context");
});

test("3. global records and other practices are untouched", async () => {
  await del(OWNER_A, PR.A);
  const g = records.vitalEntry.find((r) => r.id === "v-global");
  assert.equal(g.dataScope, "patient_global");
  assert.equal(g.archivedPracticeContextId, null);
  const b = records.vitalEntry.find((r) => r.id === "v-b");
  assert.equal(b.contextPracticePatientLinkId, LINK.B1, "practice B keeps its live link");
  assert.ok(practices.some((p) => p.id === PR.B));
});

test("4. a practice with no links deletes cleanly", async () => {
  links.length = 0;
  for (const arr of Object.values(records)) arr.length = 0;
  const res = await del(OWNER_A, PR.A);
  assert.equal(res.status, 200);
  assert.equal(archives.length, 0, "nothing to archive, nothing archived");
});

/* ------------------------------------------------------------ authorization */

test("5. a non-owner member gets 403", async () => {
  const res = await del(MEMBER_A, PR.A);
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "forbidden");
  assert.ok(practices.some((p) => p.id === PR.A), "nothing was deleted");
});

test("6. a foreign user gets practice_not_found", async () => {
  const res = await del(OUTSIDER, PR.A);
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "practice_not_found");
  assert.ok(practices.some((p) => p.id === PR.A));
});

test("7. practice A's owner cannot delete practice B", async () => {
  const res = await del(OWNER_A, PR.B);
  assert.ok([403, 404].includes(res.status), `got ${res.status}`);
  assert.ok(practices.some((p) => p.id === PR.B));
});

test("8. an unauthenticated request is 401", async () => {
  const res = await del(null, PR.A);
  assert.equal(res.status, 401);
});

test("9. a wrong or missing confirmation phrase deletes nothing", async () => {
  for (const body of [{}, { confirmation: "" }, { confirmation: "delete" }, { confirmation: "DELETE_MY_MEDSCOUTX_DATA" }]) {
    const res = await del(OWNER_A, PR.A, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.error, "confirmation_required");
  }
  assert.ok(practices.some((p) => p.id === PR.A));
  assert.equal(archives.length, 0, "no archive may be created either");
});

/* ------------------------------------------------------- failure and output */

test("10. a failure after archiving leaves the practice fully intact", async () => {
  failAfterArchive = true;
  const res = await del(OWNER_A, PR.A);
  assert.equal(res.status, 500);
  assert.equal(res.body.error, "server_error");
  assert.ok(practices.some((p) => p.id === PR.A), "the practice survives");
  assert.equal(links.length, 2, "the links survive");
  assert.equal(records.vitalEntry.find((r) => r.id === "v1").contextPracticePatientLinkId, LINK.A1,
    "the record is back on its live link");
  assert.equal(archives.length, 0, "no archive is left behind");
});

test("11. the response carries no patient, link or archive identifier", async () => {
  const res = await del(OWNER_A, PR.A);
  const text = JSON.stringify(res.body);
  for (const secret of [P1, LINK.A1, "archivedPracticeContextId", "movedTotal", "archivedLinks"]) {
    assert.ok(!text.includes(secret), `${secret} leaked into the response`);
  }
  assert.deepEqual(res.body, { ok: true, deleted: true });
});

test("12. a known foreign practice id reveals no archive counts", async () => {
  const res = await del(OUTSIDER, PR.A);
  assert.deepEqual(res.body, { ok: false, error: "practice_not_found" });
});

/* -------------------------------------------------------------------- audit */

test("13. the audit records aggregates only, never medical content", async () => {
  await del(OWNER_A, PR.A);
  const actions = audits.map((a) => a.action);
  for (const required of [
    "practice_patient_context_archived",
    "document_share_grants_revoked_for_deletion",
    "practice_deletion_completed",
  ]) {
    assert.ok(actions.includes(required), `${required} missing`);
  }
  for (const entry of audits) {
    const metadata = entry.metadataJson ?? entry.metadata ?? {};
    const meta = JSON.stringify(metadata);
    assert.ok(!meta.includes(P1), "no patient id in the audit");
    assert.ok(!meta.includes(LINK.A1), "no link id in the audit");
    // Per-model counts are permitted — "how many diagnoses moved" is an
    // aggregate. What must never appear is a VALUE: a diagnosis, an allergen,
    // a document title, a file name, a storage key or a token.
    const values = JSON.stringify(flattenValues(metadata));
    assert.doesNotMatch(values, /placeholder|title|fileName|storageKey|token|hash/i,
      `audit ${entry.action} carries content: ${values}`);
    for (const [k, v] of Object.entries(metadata.movedByModel ?? {})) {
      assert.equal(typeof v, "number", `${k} must be a count`);
    }
  }
});

/* ----------------------------------------------- account deletion untouched */

test("14. this change does not touch the account deletion path", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../routes/account.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /archiveContextualPatientDataForLinks|releaseDocumentShareGrantsForPractice/,
    "account deletion is deliberately unchanged in this step and follows separately");
  // The existing guard must still be the thing that protects it.
  assert.match(src, /checkUserDeletionBlockers/);
  assert.match(src, /CONTEXTUAL_DATA_BLOCKED/);
});

/** Every leaf value of an object, ignoring the keys. */
function flattenValues(obj) {
  const out = [];
  const walk = (v) => {
    if (v && typeof v === "object") Object.values(v).forEach(walk);
    else out.push(v);
  };
  walk(obj);
  return out;
}
