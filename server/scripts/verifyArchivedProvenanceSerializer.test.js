/**
 * The provenance a patient receives for their own medical records.
 *
 * One shape for all four models: global, a live care relationship, a practice
 * that was deleted, and — defensively — a record that fits none of those. An
 * archived record is never presented as the patient's own data, and the
 * archive's internal ids never leave the server.
 *
 * Run: node --test scripts/verifyArchivedProvenanceSerializer.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-archived-provenance";
process.env.ENABLE_VITALS = "true";
process.env.ENABLE_VACCINATION_PASS = "true";
process.env.ENABLE_HEALTH_HISTORY = "true";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  provenanceJson,
  ARCHIVED_CONTEXT_SELECT,
  PRACTICE_CONTEXT_STATE,
} from "../services/patientData/patientDataContextService.js";

const P = "user-patient-P";
const OTHER = "user-patient-Q";
const LINK_A = "link-A";

const ARCHIVE = {
  practiceDisplayNameSnapshot: "Kardiologiepraxis Beispiel",
  practiceSpecialtySnapshot: "Kardiologie",
  archivedAt: new Date("2026-07-29T10:00:00.000Z"),
};

/* ------------------------------------------------------------- unit level */

test("1. a global record reports no practice context", () => {
  const p = provenanceJson({ dataScope: "patient_global", contextPracticePatientLinkId: null });
  assert.equal(p.practiceContextState, PRACTICE_CONTEXT_STATE.NONE);
  assert.equal(p.contextPracticePatientLinkId, null);
  assert.equal(p.archivedPractice, null);
});

test("2. a live care relationship reports the patient's own link", () => {
  const p = provenanceJson({
    dataScope: "practice_contextual", contextPracticePatientLinkId: LINK_A,
  });
  assert.equal(p.practiceContextState, PRACTICE_CONTEXT_STATE.ACTIVE);
  assert.equal(p.contextPracticePatientLinkId, LINK_A);
  assert.equal(p.archivedPractice, null);
});

test("3.–6. an archived context reports the snapshot, not a link", () => {
  const p = provenanceJson({
    dataScope: "practice_contextual",
    contextPracticePatientLinkId: null,
    archivedPracticeContextId: "arc-1",
    archivedPracticeContext: ARCHIVE,
  });
  assert.equal(p.practiceContextState, PRACTICE_CONTEXT_STATE.ARCHIVED);
  assert.equal(p.contextPracticePatientLinkId, null, "an archived record has no live link");
  assert.equal(p.archivedPractice.displayName, "Kardiologiepraxis Beispiel");
  assert.equal(p.archivedPractice.specialty, "Kardiologie");
  assert.equal(p.archivedPractice.archivedAt, ARCHIVE.archivedAt);
});

test("7.–10. no internal identifier is ever serialised", () => {
  const p = provenanceJson({
    dataScope: "practice_contextual",
    contextPracticePatientLinkId: null,
    archivedPracticeContextId: "arc-1",
    userId: P,
    archivedPracticeContext: {
      ...ARCHIVE,
      id: "arc-1",
      originalPracticePatientLinkId: "former-link",
      originalPracticeProfileId: "former-practice",
      patientUserId: P,
      archiveReason: "practice_deleted",
    },
  });
  const text = JSON.stringify(p);
  for (const secret of [
    "arc-1", "former-link", "former-practice", P,
    "practice_deleted", "archivedPracticeContextId",
    "originalPracticePatientLinkId", "originalPracticeProfileId", "patientUserId",
  ]) {
    assert.ok(!text.includes(secret), `${secret} leaked: ${text}`);
  }
  assert.deepEqual(Object.keys(p).sort(),
    ["archivedPractice", "contextPracticePatientLinkId", "dataScope", "practiceContextState"]);
  assert.deepEqual(Object.keys(p.archivedPractice).sort(),
    ["archivedAt", "displayName", "specialty"]);
});

test("11. an impossible combination is never presented as the patient's own data", () => {
  const impossible = [
    { dataScope: "practice_contextual", contextPracticePatientLinkId: null },
    { dataScope: "practice_contextual", contextPracticePatientLinkId: LINK_A, archivedPracticeContextId: "arc-1" },
    { dataScope: "patient_global", contextPracticePatientLinkId: LINK_A },
    { dataScope: "patient_global", archivedPracticeContextId: "arc-1" },
    { dataScope: null, contextPracticePatientLinkId: null },
    {},
  ];
  for (const row of impossible) {
    const p = provenanceJson(row);
    assert.equal(p.practiceContextState, PRACTICE_CONTEXT_STATE.UNAVAILABLE, JSON.stringify(row));
    assert.notEqual(p.practiceContextState, PRACTICE_CONTEXT_STATE.NONE);
    assert.equal(p.archivedPractice, null);
    assert.equal(p.contextPracticePatientLinkId, null);
  }
});

test("an archived record without the relation loaded still reads as archived", () => {
  const p = provenanceJson({
    dataScope: "practice_contextual",
    contextPracticePatientLinkId: null,
    archivedPracticeContextId: "arc-1",
  });
  assert.equal(p.practiceContextState, PRACTICE_CONTEXT_STATE.ARCHIVED);
  assert.equal(p.archivedPractice, null, "no name, but the state is still known");
});

test("the archive selection loads only what the patient is shown", () => {
  assert.deepEqual(Object.keys(ARCHIVED_CONTEXT_SELECT.select).sort(),
    ["archivedAt", "practiceDisplayNameSnapshot", "practiceSpecialtySnapshot"]);
});

/* ---------------------------------------------------------------- real HTTP */

const MODELS = ["vitalEntry", "vaccinationEntry", "allergyEntry", "diagnosisEntry"];
let rows;
let server;
let baseUrl;

function seed() {
  const base = (id, userId, extra) => ({
    id, userId, deletedAt: null,
    type: "heart_rate", valuePrimary: 1, valueSecondary: null, unit: "bpm",
    measuredAt: new Date(), source: "manual",
    vaccineName: "placeholder", disease: "placeholder", vaccinationDate: new Date(),
    allergen: "placeholder", allergyType: "placeholder", severity: "placeholder",
    conditionName: "placeholder", status: "active",
    createdAt: new Date(), updatedAt: new Date(),
    ...extra,
  });
  return [
    base("global", P, { dataScope: "patient_global", contextPracticePatientLinkId: null, archivedPracticeContextId: null, archivedPracticeContext: null }),
    base("active", P, { dataScope: "practice_contextual", contextPracticePatientLinkId: LINK_A, archivedPracticeContextId: null, archivedPracticeContext: null }),
    base("archived", P, { dataScope: "practice_contextual", contextPracticePatientLinkId: null, archivedPracticeContextId: "arc-1", archivedPracticeContext: ARCHIVE }),
    base("foreign", OTHER, { dataScope: "patient_global", contextPracticePatientLinkId: null, archivedPracticeContextId: null, archivedPracticeContext: null }),
  ];
}

test.before(async () => {
  rows = Object.fromEntries(MODELS.map((m) => [m, seed()]));
  for (const model of MODELS) {
    prisma[model] = {
      findMany: async ({ where }) =>
        rows[model].filter((r) => r.userId === where.userId && r.deletedAt === null),
    };
  }
  prisma.auditLog = { create: async () => ({}) };

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
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((r) => server.close(r)));

async function call(path, user) {
  const res = await fetch(baseUrl + path, {
    headers: { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const ROUTES = [
  ["/api/patient/vitals", "vitalEntry"],
  ["/api/patient/vaccinations", "vaccinationEntry"],
  ["/api/patient/allergies", "allergyEntry"],
  ["/api/patient/diagnoses", "diagnosisEntry"],
];

test("13. every patient route reports the same three states", async () => {
  for (const [path] of ROUTES) {
    const res = await call(path, P);
    assert.equal(res.status, 200, path);
    const byId = Object.fromEntries(res.body.entries.map((e) => [e.id, e]));
    assert.equal(byId.global.practiceContextState, "none", path);
    assert.equal(byId.active.practiceContextState, "active", path);
    assert.equal(byId.archived.practiceContextState, "archived", path);
    assert.equal(byId.archived.archivedPractice.displayName, "Kardiologiepraxis Beispiel", path);
    assert.equal(byId.archived.archivedPractice.specialty, "Kardiologie", path);
    assert.ok(byId.archived.archivedPractice.archivedAt, path);
  }
});

test("14. no route returns another patient's record", async () => {
  for (const [path] of ROUTES) {
    const res = await call(path, P);
    assert.ok(!res.body.entries.some((e) => e.id === "foreign"), path);
  }
});

test("7.–10. (HTTP) no internal identifier reaches the patient", async () => {
  for (const [path] of ROUTES) {
    const text = JSON.stringify((await call(path, P)).body);
    for (const secret of [
      "arc-1", P, OTHER, "archivedPracticeContextId",
      "originalPracticePatientLinkId", "originalPracticeProfileId",
      "patientUserId", "archiveReason", "practiceDisplayNameSnapshot",
    ]) {
      assert.ok(!text.includes(secret), `${secret} leaked from ${path}`);
    }
  }
});

test("the active link id is returned only for an active context", async () => {
  for (const [path] of ROUTES) {
    const byId = Object.fromEntries((await call(path, P)).body.entries.map((e) => [e.id, e]));
    assert.equal(byId.active.contextPracticePatientLinkId, LINK_A, path);
    assert.equal(byId.archived.contextPracticePatientLinkId, null, path);
    assert.equal(byId.global.contextPracticePatientLinkId, null, path);
  }
});

/* --------------------------------------------- 12. practices stay excluded */

test("12. the practice read filter still admits only global and its own live link", async () => {
  const { buildPatientDataContextReadWhere } =
    await import("../services/patientData/patientDataContextReadService.js");
  const where = buildPatientDataContextReadWhere({
    patientUserId: P, practicePatientLinkId: LINK_A,
  });
  assert.equal(where.OR.length, 2, "no branch may be added for archived data");
  for (const branch of where.OR) {
    assert.ok(!("archivedPracticeContextId" in branch),
      "a practice must never reach an archived record");
  }
  // And the archived fixture row matches neither branch.
  const archived = seed().find((r) => r.id === "archived");
  const matches = where.OR.some((b) =>
    Object.entries(b).every(([k, v]) => archived[k] === v));
  assert.equal(matches, false, "an archived record is invisible to every practice");
});
