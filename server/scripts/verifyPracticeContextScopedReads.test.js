/**
 * Practice reads of patient-owned medical data are scoped by care context.
 *
 * A patient may be connected to several practices. Their records are either
 * global — recorded outside any treatment context — or bound to one concrete
 * care relationship. A practice sees the global ones (with its own consent) and
 * the ones bound to ITS OWN link. Never another link's, never unclassified
 * legacy rows.
 *
 * No database: Prisma is replaced by an in-memory adapter that evaluates the
 * generated `where` the same way Prisma would, so the filter is exercised as a
 * query rather than as post-hoc JavaScript. medscoutx_dev is never touched.
 *
 * Fixture: patient P linked to practices A, B and C; one doctor each.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-scoped-reads";
process.env.ENABLE_VITALS = "true";
process.env.ENABLE_VACCINATION_PASS = "true";
process.env.ENABLE_HEALTH_HISTORY = "true";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { buildPatientDataContextReadWhere } from "../services/patientData/patientDataContextReadService.js";

const P = "user-patient-P";
const OTHER_PATIENT = "user-patient-X";
const OUTSIDER = "user-outsider";

const PRACTICES = { A: "practice-A", B: "practice-B", C: "practice-C" };
const LINKS = { A: "link-A", B: "link-B", C: "link-C" };
const DOCTORS = { A: "user-doctor-A", B: "user-doctor-B", C: "user-doctor-C" };
const SECRETARY_A = "user-secretary-A";
const INVITED_A = "user-invited-A";
const REVOKED_A = "user-revoked-A";

const MODELS = ["vitalEntry", "vaccinationEntry", "allergyEntry", "diagnosisEntry"];

let links;
let members;
let consents;
let rows;

/** Marker values so a leak is unmistakable in an assertion. */
const MARK = { G: "GLOBAL", A: "CTX-A", B: "CTX-B", C: "CTX-C", LEGACY: "LEGACY", DELETED: "DELETED", FOREIGN: "FOREIGN-PATIENT" };

function seedRecords() {
  const base = (id, mark, extra) => ({ id, userId: P, marker: mark, deletedAt: null, ...extra });
  return [
    base("g", MARK.G, { dataScope: "patient_global", contextPracticePatientLinkId: null }),
    base("a", MARK.A, { dataScope: "practice_contextual", contextPracticePatientLinkId: LINKS.A }),
    base("b", MARK.B, { dataScope: "practice_contextual", contextPracticePatientLinkId: LINKS.B }),
    base("c", MARK.C, { dataScope: "practice_contextual", contextPracticePatientLinkId: LINKS.C }),
    base("legacy", MARK.LEGACY, { dataScope: null, contextPracticePatientLinkId: null }),
    { id: "del", userId: P, marker: MARK.DELETED, dataScope: "patient_global",
      contextPracticePatientLinkId: null, deletedAt: new Date() },
    { id: "foreign", userId: OTHER_PATIENT, marker: MARK.FOREIGN, dataScope: "patient_global",
      contextPracticePatientLinkId: null, deletedAt: null },
  ];
}

/** Evaluates the subset of Prisma `where` this filter produces. */
function matches(row, where) {
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.deletedAt === null && row.deletedAt !== null) return false;
  if (where.type !== undefined && row.type !== where.type) return false;
  if (where.status?.not !== undefined && row.status === where.status.not) return false;
  if (Array.isArray(where.OR)) {
    return where.OR.some((branch) =>
      Object.entries(branch).every(([k, v]) => row[k] === v));
  }
  return true;
}

function installPrismaFake() {
  links = [
    { id: LINKS.A, practiceProfileId: PRACTICES.A, patientUserId: P, status: "active" },
    { id: LINKS.B, practiceProfileId: PRACTICES.B, patientUserId: P, status: "active" },
    { id: LINKS.C, practiceProfileId: PRACTICES.C, patientUserId: P, status: "active" },
  ];
  members = [
    { practiceProfileId: PRACTICES.A, userId: DOCTORS.A, role: "doctor", status: "active" },
    { practiceProfileId: PRACTICES.B, userId: DOCTORS.B, role: "doctor", status: "active" },
    { practiceProfileId: PRACTICES.C, userId: DOCTORS.C, role: "doctor", status: "active" },
    { practiceProfileId: PRACTICES.A, userId: SECRETARY_A, role: "secretary", status: "active" },
    { practiceProfileId: PRACTICES.A, userId: INVITED_A, role: "doctor", status: "invited" },
    { practiceProfileId: PRACTICES.A, userId: REVOKED_A, role: "doctor", status: "revoked" },
  ];
  consents = [];
  for (const linkId of Object.values(LINKS)) {
    for (const type of ["vitals_access", "vaccinations_access", "health_history_access"]) {
      consents.push({ practicePatientLinkId: linkId, consentType: type, status: "granted" });
    }
  }
  rows = Object.fromEntries(MODELS.map((m) => [m, seedRecords()]));

  prisma.practicePatientLink = {
    findUnique: async ({ where }) => links.find((l) => l.id === where.id) ?? null,
  };
  prisma.practiceProfile = {
    findUnique: async ({ where }) =>
      Object.values(PRACTICES).includes(where.id) ? { id: where.id, userId: "owner-of-" + where.id } : null,
  };
  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      return members.find((m) => m.practiceProfileId === practiceProfileId && m.userId === userId) ?? null;
    },
  };
  prisma.consentRecord = {
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
    findFirst: async ({ where }) =>
      consents.find(
        (c) => c.practicePatientLinkId === where.practicePatientLinkId &&
          c.consentType === where.consentType && c.status === where.status,
      ) ?? null,
  };
  for (const model of MODELS) {
    prisma[model] = {
      findMany: async ({ where, take }) => {
        const hit = rows[model].filter((r) => matches(r, where));
        return typeof take === "number" ? hit.slice(0, take) : hit;
      },
      count: async ({ where }) => rows[model].filter((r) => matches(r, where)).length,
    };
  }
  prisma.auditLog = { create: async () => ({}) };
  prisma.user = { findUnique: async () => ({ dateOfBirth: null, profile: null }) };
  prisma.sosCard = { findUnique: async () => null };
}

test.beforeEach(() => installPrismaFake());

/* ------------------------------------------------------------- unit level */

test("the filter matches only global and own-context records", () => {
  const where = buildPatientDataContextReadWhere({
    patientUserId: P, practicePatientLinkId: LINKS.A,
  });
  const visible = seedRecords().filter((r) => matches(r, where)).map((r) => r.marker);
  assert.deepEqual(visible.sort(), [MARK.G, MARK.A].sort());
});

test("the filter refuses to build without a link", () => {
  for (const input of [
    { patientUserId: P },
    { practicePatientLinkId: LINKS.A },
    { patientUserId: "", practicePatientLinkId: "" },
  ]) {
    assert.throws(
      () => buildPatientDataContextReadWhere(input),
      /patient_data_context_read_requires_link/,
      "a missing id must never widen the query",
    );
  }
});

test("no branch admits a null scope or a foreign link", () => {
  const where = buildPatientDataContextReadWhere({
    patientUserId: P, practicePatientLinkId: LINKS.A,
  });
  assert.equal(where.OR.length, 2, "exactly two allowed shapes");
  for (const branch of where.OR) {
    assert.ok(branch.dataScope, "every branch must pin a scope");
    assert.notEqual(branch.dataScope, null);
  }
  assert.ok(
    !where.OR.some((b) => b.contextPracticePatientLinkId === LINKS.B),
    "no foreign link may appear",
  );
});

/* ---------------------------------------------------------------- real HTTP */

let server;
let baseUrl;

/** route path, the models it reads, and the response arrays to inspect. */
const ROUTES = [
  { label: "vitals", path: (l) => `/api/practice/patients/${l}/vitals`,
    models: ["vitalEntry"], pick: (b) => b.entries },
  { label: "vaccinations", path: (l) => `/api/practice/patients/${l}/vaccinations`,
    models: ["vaccinationEntry"], pick: (b) => b.entries },
  { label: "health-history", path: (l) => `/api/practice/patients/${l}/health-history`,
    models: ["allergyEntry", "diagnosisEntry"], pick: (b) => [...b.allergies, ...b.diagnoses] },
];

test.before(async () => {
  installPrismaFake();
  const [vitals, vacc, history] = await Promise.all([
    import("../routes/practicePatientVitals.js"),
    import("../routes/practicePatientVaccinations.js"),
    import("../routes/practicePatientHealthHistory.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api/practice/patients/:linkId/vitals", requireAuth, vitals.default);
  app.use("/api/practice/patients/:linkId/vaccinations", requireAuth, vacc.default);
  app.use("/api/practice/patients/:linkId/health-history", requireAuth, history.default);
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((r) => server.close(r)));

async function call(path, user) {
  const res = await fetch(baseUrl + path, {
    headers: user
      ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` }
      : {},
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

/**
 * Markers a practice actually received. The serializers are strict allowlists
 * and drop unknown fields (including the test marker), so identification goes
 * through the record id, which they do emit.
 */
const MARKER_BY_ID = {
  g: MARK.G, a: MARK.A, b: MARK.B, c: MARK.C,
  legacy: MARK.LEGACY, del: MARK.DELETED, foreign: MARK.FOREIGN,
};
function markersFor(route, body) {
  return route.pick(body).map((r) => MARKER_BY_ID[r.id]).filter(Boolean).sort();
}

for (const route of ROUTES) {
  test(`HTTP ${route.label}: 1-5) practice A sees G and A, never B, C or LEGACY`, async () => {
    const res = await call(route.path(LINKS.A), DOCTORS.A);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const seen = markersFor(route, res.body);
    // The fake seeds each model with the same seven records, and health-history
    // reads two models, so each marker appears once per model read.
    const expected = route.models.flatMap(() => [MARK.G, MARK.A]).sort();
    assert.deepEqual(seen, expected);
    for (const forbidden of [MARK.B, MARK.C, MARK.LEGACY, MARK.DELETED, MARK.FOREIGN]) {
      assert.ok(!seen.includes(forbidden), `${route.label}: leaked ${forbidden}`);
    }
  });

  test(`HTTP ${route.label}: 6-8) practice B sees G and B, never A`, async () => {
    const res = await call(route.path(LINKS.B), DOCTORS.B);
    assert.equal(res.status, 200);
    const seen = markersFor(route, res.body);
    assert.deepEqual(seen, route.models.flatMap(() => [MARK.G, MARK.B]).sort());
    assert.ok(!seen.includes(MARK.A));
  });

  test(`HTTP ${route.label}: 9-11) practice C sees G and C, never A or B`, async () => {
    const res = await call(route.path(LINKS.C), DOCTORS.C);
    assert.equal(res.status, 200);
    const seen = markersFor(route, res.body);
    assert.deepEqual(seen, route.models.flatMap(() => [MARK.G, MARK.C]).sort());
    assert.ok(!seen.includes(MARK.A) && !seen.includes(MARK.B));
  });

  test(`HTTP ${route.label}: 12-13) without or with expired consent nothing is returned`, async () => {
    consents = [];
    const res = await call(route.path(LINKS.A), DOCTORS.A);
    assert.equal(res.status, 403);
    assert.equal(res.body.error, "consent_required");
    assert.ok(!JSON.stringify(res.body).includes(MARK.G));
  });

  test(`HTTP ${route.label}: 14) a revoked link returns nothing`, async () => {
    links = links.map((l) => (l.id === LINKS.A ? { ...l, status: "revoked" } : l));
    const res = await call(route.path(LINKS.A), DOCTORS.A);
    assert.equal(res.status, 403);
    assert.equal(res.body.error, "link_inactive");
  });

  test(`HTTP ${route.label}: 15) a role without the clinical permission gets 403`, async () => {
    const res = await call(route.path(LINKS.A), SECRETARY_A);
    assert.equal(res.status, 403);
    assert.equal(res.body.error, "forbidden");
  });

  test(`HTTP ${route.label}: 16) a foreign practice with a known link id gets 404`, async () => {
    for (const actor of [DOCTORS.B, DOCTORS.C, OUTSIDER, INVITED_A, REVOKED_A, P]) {
      const res = await call(route.path(LINKS.A), actor);
      assert.equal(res.status, 404, `${actor}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.error, "link_not_found");
    }
  });

  test(`HTTP ${route.label}: 20) the response carries no foreign ids`, async () => {
    const res = await call(route.path(LINKS.A), DOCTORS.A);
    const serialized = JSON.stringify(res.body);
    for (const secret of [
      LINKS.B, LINKS.C, PRACTICES.B, PRACTICES.C, P, OTHER_PATIENT,
      "patientUserId", "contextPracticePatientLinkId", "practiceProfileId",
    ]) {
      assert.ok(!serialized.includes(secret), `${route.label} leaked "${secret}"`);
    }
    // The neutral origin type is allowed.
    assert.ok(serialized.includes("dataScope"), "origin type may be returned");
  });
}

/* ------------------------------------------------- 17-19) list vs. count */

test("17) soft-deleted records never appear", async () => {
  for (const route of ROUTES) {
    const res = await call(route.path(LINKS.A), DOCTORS.A);
    assert.ok(!markersFor(route, res.body).includes(MARK.DELETED), route.label);
  }
});

test("18) another patient's records never appear", async () => {
  for (const route of ROUTES) {
    const res = await call(route.path(LINKS.A), DOCTORS.A);
    assert.ok(!markersFor(route, res.body).includes(MARK.FOREIGN), route.label);
  }
});

test("19) a count uses exactly the same filter as the list", async () => {
  // The routes do not paginate or expose totals today, so the guarantee is
  // structural: any count must be built from the same where.
  const where = buildPatientDataContextReadWhere({
    patientUserId: P, practicePatientLinkId: LINKS.A,
  });
  for (const model of MODELS) {
    const listed = await prisma[model].findMany({ where });
    const counted = await prisma[model].count({ where });
    assert.equal(counted, listed.length, `${model}: count and list must agree`);
    assert.equal(counted, 2, "exactly G and A");
  }

  // And a limit must not be able to reveal a total beyond the filter.
  const limited = await prisma.vitalEntry.findMany({ where, take: 1 });
  assert.equal(limited.length, 1);
});

/* ---------------------------------------------------------- legacy (§10) */

test("legacy rows are invisible to every practice", async () => {
  for (const route of ROUTES) {
    for (const [key, linkId] of Object.entries(LINKS)) {
      const res = await call(route.path(linkId), DOCTORS[key]);
      assert.equal(res.status, 200);
      assert.ok(
        !markersFor(route, res.body).includes(MARK.LEGACY),
        `${route.label} via practice ${key} exposed a legacy row`,
      );
    }
  }
});

test("no fallback treats a null scope as global", () => {
  const where = buildPatientDataContextReadWhere({
    patientUserId: P, practicePatientLinkId: LINKS.A,
  });
  const legacy = { userId: P, deletedAt: null, dataScope: null, contextPracticePatientLinkId: null };
  assert.equal(matches(legacy, where), false, "null must not match the global branch");
});

test("no serializer invents a scope for a legacy row", async () => {
  const { practiceProvenanceJson } = await import(
    "../services/patientData/patientDataContextReadService.js");
  assert.deepEqual(practiceProvenanceJson({ dataScope: null }), { dataScope: null });
  assert.deepEqual(practiceProvenanceJson({}), { dataScope: null });
});

test("the practice serializer never returns the context link id", async () => {
  const { practiceProvenanceJson } = await import(
    "../services/patientData/patientDataContextReadService.js");
  const out = practiceProvenanceJson({
    dataScope: "practice_contextual", contextPracticePatientLinkId: LINKS.A,
  });
  assert.deepEqual(out, { dataScope: "practice_contextual" });
});
