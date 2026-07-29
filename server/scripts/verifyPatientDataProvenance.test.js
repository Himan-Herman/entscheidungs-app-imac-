/**
 * Provenance stamping on patient-owned medical writes.
 *
 * The four patient-owned models are classified at creation time as either
 * patient_global or practice_contextual. That decision is the server's: the
 * only thing a client may say is "this belongs to link X", and only after the
 * link has been proven to belong to the authenticated patient and to be active.
 *
 * No database: Prisma is replaced by an in-memory adapter, so medscoutx_dev is
 * never touched. Routes, middleware and error mapping run for real.
 *
 * Fixture:
 *   Patient P — active links to practice A and B, revoked link to D,
 *               invited (not yet active) link to E
 *   Patient Q — active link to practice C
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-provenance";
process.env.ENABLE_VITALS = "true";
process.env.ENABLE_VACCINATION_PASS = "true";
process.env.ENABLE_HEALTH_HISTORY = "true";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  resolvePatientDataContextForWrite,
  personalImportContext,
  assertNoProvenanceOverride,
  UnsupportedFieldError,
} from "../services/patientData/patientDataContextService.js";

const P = "user-patient-P";
const Q = "user-patient-Q";
const PRACTICE_USER = "user-practice-staff";

const LINK_PA = "link-P-A";
const LINK_PB = "link-P-B";
const LINK_QC = "link-Q-C";
const LINK_PD_REVOKED = "link-P-D";
const LINK_PE_INVITED = "link-P-E";

let links;
let rows;

function installPrismaFake() {
  links = [
    { id: LINK_PA, patientUserId: P, practiceProfileId: "practice-A", status: "active" },
    { id: LINK_PB, patientUserId: P, practiceProfileId: "practice-B", status: "active" },
    { id: LINK_QC, patientUserId: Q, practiceProfileId: "practice-C", status: "active" },
    { id: LINK_PD_REVOKED, patientUserId: P, practiceProfileId: "practice-D", status: "revoked" },
    { id: LINK_PE_INVITED, patientUserId: P, practiceProfileId: "practice-E", status: "invited" },
  ];
  rows = { vitalEntry: [], vaccinationEntry: [], allergyEntry: [], diagnosisEntry: [] };

  prisma.practicePatientLink = {
    findFirst: async ({ where }) =>
      links.find((l) => l.id === where.id && l.patientUserId === where.patientUserId) ?? null,
  };
  for (const model of Object.keys(rows)) {
    prisma[model] = {
      create: async ({ data }) => {
        const row = { ...data, id: `${model}-${rows[model].length + 1}`, createdAt: new Date() };
        rows[model].push(row);
        return row;
      },
      findFirst: async ({ where }) =>
        rows[model].find((r) => r.id === where.id && r.userId === where.userId) ?? null,
      update: async ({ where, data }) => {
        const row = rows[model].find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
      findMany: async () => [],
    };
  }
  prisma.auditLog = { create: async () => ({}) };

  // The write wrapper runs an interactive transaction with an isolation level
  // and takes a FOR SHARE row lock. The adapter runs the callback against the
  // same in-memory state and answers the raw lock query from `links`.
  prisma.$transaction = async (fn) => fn(prisma);
  prisma.$queryRaw = async (strings, ...values) => {
    const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
    // The write wrapper now locks the user row first; every fixture user exists.
    if (/FROM "User"/.test(sql)) return [{ id: values[0] }];
    if (!/FROM "PracticePatientLink"/.test(sql)) return [];
    const [id, patientUserId] = values;
    const row = links.find((l) => l.id === id && l.patientUserId === patientUserId);
    return row ? [{ id: row.id, status: row.status }] : [];
  };
}

test.beforeEach(() => installPrismaFake());

/* --------------------------------------------------------- service level */

test("without a link the context is patient_global", async () => {
  const ctx = await resolvePatientDataContextForWrite({ patientUserId: P });
  assert.deepEqual(ctx, { dataScope: "patient_global", contextPracticePatientLinkId: null });
});

test("with an active own link the context is practice_contextual", async () => {
  const ctx = await resolvePatientDataContextForWrite({
    patientUserId: P, requestedPracticePatientLinkId: LINK_PA,
  });
  assert.deepEqual(ctx, {
    dataScope: "practice_contextual", contextPracticePatientLinkId: LINK_PA,
  });
});

test("another patient's link is indistinguishable from a missing one", async () => {
  await assert.rejects(
    () => resolvePatientDataContextForWrite({
      patientUserId: P, requestedPracticePatientLinkId: LINK_QC,
    }),
    /link_not_found/,
  );
  await assert.rejects(
    () => resolvePatientDataContextForWrite({
      patientUserId: P, requestedPracticePatientLinkId: "does-not-exist",
    }),
    /link_not_found/,
  );
});

test("a revoked or not-yet-active link is refused", async () => {
  for (const linkId of [LINK_PD_REVOKED, LINK_PE_INVITED]) {
    await assert.rejects(
      () => resolvePatientDataContextForWrite({
        patientUserId: P, requestedPracticePatientLinkId: linkId,
      }),
      /link_not_active/,
      linkId,
    );
  }
});

test("a personal import is always patient-owned", () => {
  assert.deepEqual(personalImportContext(), {
    dataScope: "patient_global", contextPracticePatientLinkId: null,
  });
});

test("every provenance field is refused, whatever its value", () => {
  for (const field of [
    "dataScope", "contextPracticePatientLinkId", "practiceProfileId",
    "practiceId", "originType", "userId", "patientUserId",
  ]) {
    assert.throws(
      () => assertNoProvenanceOverride({ [field]: "anything" }),
      UnsupportedFieldError, field,
    );
  }
  // The one legitimate input is not a provenance field.
  assert.doesNotThrow(() => assertNoProvenanceOverride({ practicePatientLinkId: LINK_PA }));
});

/* ---------------------------------------------------------------- real HTTP */

let server;
let baseUrl;

/** One create endpoint per model, with a minimal valid body. */
const ENDPOINTS = [
  ["vitalEntry", "/api/patient/vitals",
   { type: "heart_rate", valuePrimary: 70, unit: "bpm", measuredAt: new Date(Date.now() - 3600e3).toISOString() }],
  ["vaccinationEntry", "/api/patient/vaccinations",
   { vaccineName: "Impfstoff", disease: "Krankheit", vaccinationDate: new Date(Date.now() - 86400e3).toISOString() }],
  ["allergyEntry", "/api/patient/allergies",
   { allergen: "Pollen", allergyType: "environmental", severity: "mild" }],
  ["diagnosisEntry", "/api/patient/diagnoses",
   { conditionName: "Testbefund" }],
];

test.before(async () => {
  installPrismaFake();
  const [vitals, vacc, allergies, diagnoses] = await Promise.all([
    import("../routes/patientVitals.js"),
    import("../routes/patientVaccinations.js"),
    import("../routes/patientAllergies.js"),
    import("../routes/patientDiagnoses.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api/patient/vitals", requireAuth, vitals.default);
  app.use("/api/patient/vaccinations", requireAuth, vacc.default);
  app.use("/api/patient/allergies", requireAuth, allergies.default);
  app.use("/api/patient/diagnoses", requireAuth, diagnoses.default);
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

for (const [model, path, valid] of ENDPOINTS) {
  test(`HTTP ${model}: 1) no link -> patient_global / null`, async () => {
    const res = await call("POST", path, { user: P, body: valid });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const stored = rows[model].at(-1);
    assert.equal(stored.dataScope, "patient_global");
    assert.equal(stored.contextPracticePatientLinkId, null);
    // 16) every successful create carries a non-null scope
    assert.ok(stored.dataScope, "scope must never be left to a database default");
  });

  test(`HTTP ${model}: 2) own active link -> practice_contextual`, async () => {
    const res = await call("POST", path, {
      user: P, body: { ...valid, practicePatientLinkId: LINK_PA },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const stored = rows[model].at(-1);
    assert.equal(stored.dataScope, "practice_contextual");
    assert.equal(stored.contextPracticePatientLinkId, LINK_PA);
  });

  test(`HTTP ${model}: 3-6) foreign, revoked, inactive and unknown links are refused`, async () => {
    const cases = [
      [LINK_QC, 404, "link_not_found"],
      ["nope", 404, "link_not_found"],
      [LINK_PD_REVOKED, 409, "link_not_active"],
      [LINK_PE_INVITED, 409, "link_not_active"],
    ];
    for (const [linkId, status, error] of cases) {
      const res = await call("POST", path, {
        user: P, body: { ...valid, practicePatientLinkId: linkId },
      });
      assert.equal(res.status, status, `${linkId}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.error, error);
    }
    // 14) nothing was written on any failure
    assert.equal(rows[model].length, 0, "a failed context check must not write");
  });

  test(`HTTP ${model}: 7-9) client-supplied provenance is rejected`, async () => {
    const hostile = [
      { dataScope: "patient_global" },
      { contextPracticePatientLinkId: LINK_PA },
      { practiceProfileId: "practice-A" },
      { practiceId: "practice-A" },
      { originType: "practice" },
      { userId: Q },
      { patientUserId: Q },
      { somethingElse: 1 },
    ];
    for (const extra of hostile) {
      const res = await call("POST", path, { user: P, body: { ...valid, ...extra } });
      assert.equal(res.status, 400, `${Object.keys(extra)[0]}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.error, "unsupported_field");
    }
    assert.equal(rows[model].length, 0, "no hostile body may write");
  });

  test(`HTTP ${model}: 10-11) an update can change neither scope nor context`, async () => {
    const created = await call("POST", path, {
      user: P, body: { ...valid, practicePatientLinkId: LINK_PA },
    });
    assert.equal(created.status, 201);
    const id = rows[model].at(-1).id;

    for (const extra of [
      { dataScope: "patient_global" },
      { contextPracticePatientLinkId: LINK_PB },
      { practicePatientLinkId: LINK_PB, dataScope: "patient_global" },
    ]) {
      const res = await call("PATCH", `${path}/${id}`, { user: P, body: { ...valid, ...extra } });
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assert.equal(res.body.error, "unsupported_field");
    }

    const stored = rows[model].find((r) => r.id === id);
    assert.equal(stored.dataScope, "practice_contextual", "scope unchanged");
    assert.equal(stored.contextPracticePatientLinkId, LINK_PA, "context unchanged");
  });

  test(`HTTP ${model}: 12) a practice user cannot create a record for a patient`, async () => {
    // There is no practice-facing write endpoint for these models at all, and a
    // practice user hitting the patient route only ever writes their OWN row.
    const res = await call("POST", path, {
      user: PRACTICE_USER, body: { ...valid, practicePatientLinkId: LINK_PA },
    });
    assert.equal(res.status, 404, "the patient's link is not theirs to use");
    assert.equal(res.body.error, "link_not_found");
    assert.equal(rows[model].length, 0);
  });

  test(`HTTP ${model}: 13) the response exposes scope but no global user id`, async () => {
    const res = await call("POST", path, {
      user: P, body: { ...valid, practicePatientLinkId: LINK_PA },
    });
    assert.equal(res.status, 201);
    const serialized = JSON.stringify(res.body);
    assert.equal(res.body.entry.dataScope, "practice_contextual");
    assert.equal(res.body.entry.contextPracticePatientLinkId, LINK_PA, "own link may be shown");
    assert.ok(!serialized.includes(P), "no global patientUserId");
    assert.ok(!/"userId"/.test(serialized), "no userId field");
    assert.ok(!/practiceProfileId/.test(serialized), "no internal practice id");
  });
}

/* ------------------------------------------------------------ cross-cutting */

test("17) no write path relies on a database default", () => {
  // Every create must pass the resolved context explicitly.
  const files = [
    "../routes/patientVitals.js", "../routes/patientVaccinations.js",
    "../routes/patientAllergies.js", "../routes/patientDiagnoses.js",
  ];
  return Promise.all(files.map(async (f) => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL(f, import.meta.url), "utf8"));
    assert.ok(src.includes("...context,"), `${f}: create must spread the resolved context`);
    assert.ok(
      src.includes("createPatientDataWithValidatedContext"),
      `${f}: must resolve the context inside the write transaction`,
    );
    assert.ok(
      !src.includes("resolvePatientDataContextForWrite"),
      `${f}: must not resolve the context outside the transaction any more`,
    );
  }));
});

test("18) an unclassified import source does not become global by accident", async () => {
  // personalImportContext is the ONLY implicit classification, and it is
  // explicit at the call site rather than a fallback inside the write.
  const src = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("../services/wearables/importService.js", import.meta.url), "utf8"));
  assert.ok(src.includes("personalImportContext()"), "import must state its context");
  assert.ok(
    !/dataScope:\s*["']patient_global["']/.test(src),
    "no hand-written scope literal — go through the service",
  );
});

test("a record created without a link is never silently upgraded later", async () => {
  const [model, path, valid] = ENDPOINTS[0];
  await call("POST", path, { user: P, body: valid });
  const id = rows[model].at(-1).id;

  const res = await call("PATCH", `${path}/${id}`, {
    user: P, body: { ...valid, practicePatientLinkId: LINK_PA },
  });
  assert.equal(res.status, 400);
  assert.equal(rows[model].find((r) => r.id === id).dataScope, "patient_global");
});
