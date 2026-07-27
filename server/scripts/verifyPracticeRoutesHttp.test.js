/**
 * REAL HTTP integration tests for the patient-scoped practice routes.
 *
 * Unlike the in-memory tests, these boot an actual Express app, mount the real
 * routers with the real requireAuth middleware and the real error handling, and
 * issue real HTTP requests with real JWTs over a real socket. Only the Prisma
 * client is replaced by an in-memory adapter, so no database is required.
 *
 * Fixture (identical to verifyPracticeTenantIsolation.test.js):
 *   Practice A -- ownerA, doctorA, secretaryA, invitedA(status=invited),
 *                 revokedA(status=revoked)
 *   Practice B -- ownerB, doctorB
 *   Patient P  -- linked to BOTH practices (linkA, linkB)
 *   Outsider   -- authenticated, no practice
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-http-tests";
// The routers are feature-flag gated; enable them for the test run.
process.env.ENABLE_VITALS = "true";
process.env.ENABLE_VACCINATION_PASS = "true";
process.env.ENABLE_SOS_CARD = "true";
process.env.ENABLE_HEALTH_HISTORY = "true";
process.env.ENABLE_E_REZEPT = "true";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const PRACTICE_A = "practice-A";
const PRACTICE_B = "practice-B";
const LINK_A = "link-A";
const LINK_B = "link-B";
const RX_A = "rx-A";

const U = {
  ownerA: "user-owner-A",
  doctorA: "user-doctor-A",
  secretaryA: "user-secretary-A",
  adminA: "user-admin-A",
  managerA: "user-manager-A",
  assistantA: "user-assistant-A",
  viewerA: "user-viewer-A",
  invitedA: "user-invited-A",
  revokedA: "user-revoked-A",
  doctorB: "user-doctor-B",
  patientP: "user-patient-P",
  outsider: "user-outsider",
};

const PRACTICES = [
  { id: PRACTICE_A, userId: U.ownerA },
  { id: PRACTICE_B, userId: U.ownerB ?? "user-owner-B" },
];
const BASE_MEMBERS = [
  { practiceProfileId: PRACTICE_A, userId: U.doctorA, role: "doctor", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: U.secretaryA, role: "secretary", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: U.adminA, role: "admin", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: U.managerA, role: "practice_manager", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: U.assistantA, role: "assistant", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: U.viewerA, role: "viewer", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: U.invitedA, role: "doctor", status: "invited" },
  { practiceProfileId: PRACTICE_A, userId: U.revokedA, role: "doctor", status: "revoked" },
  { practiceProfileId: PRACTICE_B, userId: U.doctorB, role: "doctor", status: "active" },
];

let links;
let consents;
let prescriptions;
/** Mutable so a test can give the owner an additional membership row. */
let members;

function resetData() {
  members = BASE_MEMBERS.map((m) => ({ ...m }));
  links = [
    {
      id: LINK_A, practiceProfileId: PRACTICE_A, patientUserId: U.patientP,
      status: "active", consentAcceptedAt: new Date("2026-01-01"), consentScopes: [],
    },
    {
      id: LINK_B, practiceProfileId: PRACTICE_B, patientUserId: U.patientP,
      status: "active", consentAcceptedAt: new Date("2026-01-01"), consentScopes: [],
    },
  ];
  consents = [
    "vitals_access", "vaccinations_access", "health_history_access", "prescriptions_access",
  ].map((consentType) => ({ practicePatientLinkId: LINK_A, consentType, status: "granted" }));
  prescriptions = [
    {
      id: RX_A, linkId: LINK_A, patientUserId: U.patientP, issuedByUserId: U.doctorA,
      medicationName: "Testpräparat", status: "issued", notes: null, deletedAt: null,
      tokenCode: "ERZ-TEST", issuedAt: new Date(), validUntil: new Date(Date.now() + 8.64e7),
      redeemedAt: null, icdCode: null, dosage: null, instructions: null, createdAt: new Date(),
    },
  ];
}

function installPrismaFake() {
  resetData();
  prisma.practicePatientLink = {
    findUnique: async ({ where }) => links.find((l) => l.id === where.id) ?? null,
    findFirst: async ({ where }) =>
      links.find(
        (l) =>
          l.id === where.id &&
          (!where.practiceProfileId || l.practiceProfileId === where.practiceProfileId),
      ) ?? null,
  };
  prisma.practiceProfile = {
    findUnique: async ({ where }) => PRACTICES.find((p) => p.id === where.id) ?? null,
  };
  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      return members.find(
        (m) => m.practiceProfileId === practiceProfileId && m.userId === userId,
      ) ?? null;
    },
  };
  prisma.consentRecord = {
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
    findFirst: async ({ where }) =>
      consents.find(
        (c) =>
          c.practicePatientLinkId === where.practicePatientLinkId &&
          c.consentType === where.consentType &&
          c.status === where.status,
      ) ?? null,
  };
  prisma.auditLog = { create: async () => ({}) };
  prisma.vitalEntry = { findMany: async () => [] };
  prisma.vaccinationEntry = { findMany: async () => [] };
  prisma.allergyEntry = { findMany: async () => [] };
  prisma.diagnosisEntry = { findMany: async () => [] };
  prisma.sosCard = { findUnique: async () => null };
  prisma.user = { findUnique: async () => ({ dateOfBirth: null, profile: null }) };
  prisma.erezeptEntry = {
    findMany: async ({ where }) =>
      prescriptions.filter((p) => p.linkId === where.linkId && p.deletedAt === null),
    findFirst: async ({ where }) =>
      prescriptions.find(
        (p) => p.id === where.id && p.linkId === where.linkId && p.deletedAt === null,
      ) ?? null,
    create: async ({ data }) => {
      const row = { ...data, id: "rx-new", createdAt: new Date() };
      prescriptions.push(row);
      return row;
    },
    update: async ({ where, data }) => {
      const row = prescriptions.find((p) => p.id === where.id);
      Object.assign(row, data);
      return row;
    },
  };
}

/* ------------------------------------------------------------- real server */

let server;
let baseUrl;

test.before(async () => {
  installPrismaFake();

  // Import routers AFTER the flags are set so feature gates read them.
  const [vitals, vaccinations, sosCard, healthHistory, erezept] = await Promise.all([
    import("../routes/practicePatientVitals.js"),
    import("../routes/practicePatientVaccinations.js"),
    import("../routes/practiceSosCard.js"),
    import("../routes/practicePatientHealthHistory.js"),
    import("../routes/practiceErezept.js"),
  ]);

  const app = express();
  app.use(express.json());
  // Mounted exactly as in app.js.
  app.use("/api/practice/patients/:linkId/vitals", requireAuth, vitals.default);
  app.use("/api/practice/patients/:linkId/vaccinations", requireAuth, vaccinations.default);
  app.use("/api/practice/patients/:linkId/sos-card", requireAuth, sosCard.default);
  app.use("/api/practice/patients/:linkId/health-history", requireAuth, healthHistory.default);
  app.use("/api/practice/patients/:linkId/erezept", requireAuth, erezept.default);

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test.beforeEach(() => installPrismaFake());

function tokenFor(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET);
}

/**
 * Issues a real HTTP request and returns { status, body }.
 */
async function call(method, path, { user, body, practiceId } = {}) {
  const url = new URL(baseUrl + path);
  if (practiceId !== undefined) url.searchParams.set("practiceId", practiceId);
  const res = await fetch(url, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

/** Every read endpoint, addressed against practice A's link. */
const READ_ENDPOINTS = [
  ["GET", `/api/practice/patients/${LINK_A}/vitals`],
  ["GET", `/api/practice/patients/${LINK_A}/vaccinations`],
  ["GET", `/api/practice/patients/${LINK_A}/health-history`],
  ["GET", `/api/practice/patients/${LINK_A}/erezept`],
];

/**
 * The subset a doctor is actually permitted to read. Prescriptions are excluded
 * because PRESCRIPTION_READ is granted to no role, and the SOS card is excluded
 * because its consent type cannot be granted in this data model.
 */
const DOCTOR_READABLE_ENDPOINTS = READ_ENDPOINTS.filter(([, p]) => !p.endsWith("/erezept"));

/** Every write endpoint on the e-Rezept resource. */
const WRITE_ENDPOINTS = [
  ["POST", `/api/practice/patients/${LINK_A}/erezept`, { medicationName: "Ibuprofen" }],
  ["PATCH", `/api/practice/patients/${LINK_A}/erezept/${RX_A}`, { status: "cancelled" }],
  ["DELETE", `/api/practice/patients/${LINK_A}/erezept/${RX_A}`, undefined],
];

const ALL_ENDPOINTS = [
  ...READ_ENDPOINTS.map(([m, p]) => [m, p, undefined]),
  ["POST", `/api/practice/patients/${LINK_A}/health-history/ai-summary`, { locale: "de" }],
  ...WRITE_ENDPOINTS,
];

/* ------------------------------------------------------ unauthorized actors */

const FORBIDDEN_ACTORS = [
  ["patient with their own linkId", U.patientP],
  ["doctor of a foreign practice", U.doctorB],
  ["unrelated authenticated user", U.outsider],
  ["invited (not yet active) member", U.invitedA],
  ["revoked member", U.revokedA],
];

for (const [label, user] of FORBIDDEN_ACTORS) {
  test(`HTTP: ${label} is rejected on every endpoint`, async () => {
    for (const [method, path, body] of ALL_ENDPOINTS) {
      const res = await call(method, path, { user, body, practiceId: PRACTICE_A });
      assert.equal(res.status, 404, `${method} ${path} for ${label} -> ${res.status}`);
      assert.equal(res.body.ok, false);
      assert.equal(res.body.error, "link_not_found");
    }
  });
}

test("HTTP: unauthenticated requests are rejected with 401", async () => {
  for (const [method, path, body] of ALL_ENDPOINTS) {
    const res = await call(method, path, { body, practiceId: PRACTICE_A });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

/* ------------------------------------------------------- authorized actors */

test("HTTP: an active authorized doctor can read", async () => {
  for (const [method, path] of DOCTOR_READABLE_ENDPOINTS) {
    const res = await call(method, path, { user: U.doctorA, practiceId: PRACTICE_A });
    assert.equal(res.status, 200, `${method} ${path} -> ${res.status}`);
    assert.equal(res.body.ok, true);
  }
});

test("HTTP: SOS card denies for a missing consent type, even for the right doctor", async () => {
  // "sos_card_access" is not grantable in this data model -> must fail closed.
  const res = await call("GET", `/api/practice/patients/${LINK_A}/sos-card`, {
    user: U.doctorA,
    practiceId: PRACTICE_A,
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "consent_required");
});

/* ------------------------------- active role WITHOUT the required permission */

/* ------ active members WITHOUT the clinical permission must get 403, not 404 */

/** Clinical read endpoints and the role expected to be allowed on each. */
const CLINICAL_ENDPOINTS = [
  ["GET", `/api/practice/patients/${LINK_A}/vitals`, undefined, "vitals"],
  ["GET", `/api/practice/patients/${LINK_A}/vaccinations`, undefined, "vaccinations"],
  ["GET", `/api/practice/patients/${LINK_A}/health-history`, undefined, "health history"],
  [
    "POST", `/api/practice/patients/${LINK_A}/health-history/ai-summary`,
    { locale: "de" }, "AI summary",
  ],
];

/** Active members of practice A that must NOT reach any clinical data. */
const NON_CLINICAL_MEMBERS = [
  ["secretary", U.secretaryA],
  ["viewer", U.viewerA],
  ["admin", U.adminA],
  ["practice_manager", U.managerA],
  ["assistant", U.assistantA],
  ["owner", U.ownerA],
];

for (const [roleLabel, user] of NON_CLINICAL_MEMBERS) {
  test(`HTTP: active ${roleLabel} gets 403 on every clinical endpoint`, async () => {
    for (const [method, path, body, label] of CLINICAL_ENDPOINTS) {
      const res = await call(method, path, { user, body, practiceId: PRACTICE_A });
      assert.equal(res.status, 403, `${roleLabel} on ${label} -> ${res.status}`);
      assert.equal(res.body.error, "forbidden");
    }
    // ...and not to prescriptions either.
    const rx = await call("GET", `/api/practice/patients/${LINK_A}/erezept`, {
      user, practiceId: PRACTICE_A,
    });
    assert.equal(rx.status, 403, `${roleLabel} on prescriptions`);
  });
}

/* ------------- owner (organizational) vs membership (occupational) over HTTP */

/** Gives the practice owner an additional membership row for one test. */
function giveOwnerMembership(role, status) {
  members.push({
    practiceProfileId: PRACTICE_A, userId: U.ownerA, role, status,
  });
}

/** The clinical GET routes a doctor is permitted to use. */
const DOCTOR_CLINICAL_GETS = [
  `/api/practice/patients/${LINK_A}/vitals`,
  `/api/practice/patients/${LINK_A}/vaccinations`,
  `/api/practice/patients/${LINK_A}/health-history`,
];

test("HTTP: owner WITHOUT a membership is denied on every clinical GET", async () => {
  for (const path of DOCTOR_CLINICAL_GETS) {
    const res = await call("GET", path, { user: U.ownerA, practiceId: PRACTICE_A });
    assert.equal(res.status, 403, `${path} -> ${res.status}`);
    assert.equal(res.body.error, "forbidden");
  }
});

test("HTTP: owner WITH an active doctor membership may use the clinical GETs", async () => {
  giveOwnerMembership("doctor", "active");
  for (const path of DOCTOR_CLINICAL_GETS) {
    const res = await call("GET", path, { user: U.ownerA, practiceId: PRACTICE_A });
    assert.equal(res.status, 200, `${path} -> ${res.status}`);
    assert.equal(res.body.ok, true);
  }
});

test("HTTP: owner with an INVITED doctor membership stays denied", async () => {
  giveOwnerMembership("doctor", "invited");
  for (const path of DOCTOR_CLINICAL_GETS) {
    const res = await call("GET", path, { user: U.ownerA, practiceId: PRACTICE_A });
    assert.equal(res.status, 403, `${path} -> ${res.status}`);
  }
});

test("HTTP: owner with a REVOKED doctor membership stays denied", async () => {
  giveOwnerMembership("doctor", "revoked");
  for (const path of DOCTOR_CLINICAL_GETS) {
    const res = await call("GET", path, { user: U.ownerA, practiceId: PRACTICE_A });
    assert.equal(res.status, 403, `${path} -> ${res.status}`);
  }
});

test("HTTP: owner with an active ASSISTANT membership stays denied", async () => {
  giveOwnerMembership("assistant", "active");
  for (const path of DOCTOR_CLINICAL_GETS) {
    const res = await call("GET", path, { user: U.ownerA, practiceId: PRACTICE_A });
    assert.equal(res.status, 403, `${path} -> ${res.status}`);
  }
});

test("HTTP: owner+doctor still gets nothing extra for prescriptions or AI", async () => {
  giveOwnerMembership("doctor", "active");
  const rx = await call("GET", `/api/practice/patients/${LINK_A}/erezept`, {
    user: U.ownerA, practiceId: PRACTICE_A,
  });
  assert.equal(rx.status, 403, "prescriptions stay denied");

  const ai = await call("POST", `/api/practice/patients/${LINK_A}/health-history/ai-summary`, {
    user: U.ownerA, body: { locale: "de" }, practiceId: PRACTICE_A,
  });
  assert.equal(ai.status, 403, "AI processing stays denied");
});

test("HTTP: owner+doctor gains nothing across tenant boundaries", async () => {
  giveOwnerMembership("doctor", "active");
  for (const path of [
    `/api/practice/patients/${LINK_B}/vitals`,
    `/api/practice/patients/${LINK_B}/health-history`,
  ]) {
    const res = await call("GET", path, { user: U.ownerA, practiceId: PRACTICE_A });
    assert.equal(res.status, 404, "a foreign link stays invisible");
    assert.equal(res.body.error, "link_not_found");
  }
});

test("HTTP: a plain doctor without ownership is unaffected", async () => {
  for (const path of DOCTOR_CLINICAL_GETS) {
    const res = await call("GET", path, { user: U.doctorA, practiceId: PRACTICE_A });
    assert.equal(res.status, 200, `${path} -> ${res.status}`);
  }
});

test("HTTP: the AI summary is denied even for the role that may read the history", async () => {
  // The doctor holds CLINICAL_HEALTH_HISTORY_READ...
  const read = await call("GET", `/api/practice/patients/${LINK_A}/health-history`, {
    user: U.doctorA,
    practiceId: PRACTICE_A,
  });
  assert.equal(read.status, 200, "control: doctor may read the health history");

  // ...but not CLINICAL_AI_SUMMARY_GENERATE, so external AI processing is denied.
  const ai = await call("POST", `/api/practice/patients/${LINK_A}/health-history/ai-summary`, {
    user: U.doctorA,
    body: { locale: "de" },
    practiceId: PRACTICE_A,
  });
  assert.equal(ai.status, 403, "reading must not imply AI processing");
  assert.equal(ai.body.error, "forbidden");
});

test("HTTP: prescriptions are denied to every active role", async () => {
  for (const [, user] of [...NON_CLINICAL_MEMBERS, ["doctor", U.doctorA]]) {
    const res = await call("GET", `/api/practice/patients/${LINK_A}/erezept`, {
      user, practiceId: PRACTICE_A,
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, "forbidden");
  }
});

test("HTTP: nobody can issue, cancel or delete a prescription", async () => {
  for (const user of [U.ownerA, U.doctorA, U.secretaryA]) {
    for (const [method, path, body] of WRITE_ENDPOINTS) {
      const res = await call(method, path, { user, body, practiceId: PRACTICE_A });
      assert.equal(res.status, 403, `${method} ${path} as ${user} -> ${res.status}`);
      assert.equal(res.body.error, "forbidden");
    }
  }
  // And nothing was written.
  assert.equal(prescriptions.length, 1);
  assert.equal(prescriptions[0].status, "issued");
});

/* ----------------------------------------------------- manipulated practiceId */

test("HTTP: a mismatched practiceId is rejected for the legitimate doctor", async () => {
  const res = await call("GET", `/api/practice/patients/${LINK_A}/vitals`, {
    user: U.doctorA,
    practiceId: PRACTICE_B,
  });
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "link_not_found");
});

test("HTTP: a foreign doctor claiming their own practiceId gains nothing", async () => {
  const res = await call("GET", `/api/practice/patients/${LINK_A}/vitals`, {
    user: U.doctorB,
    practiceId: PRACTICE_B,
  });
  assert.equal(res.status, 404);
});

test("HTTP: omitting practiceId entirely still works (link is the anchor)", async () => {
  const res = await call("GET", `/api/practice/patients/${LINK_A}/vitals`, { user: U.doctorA });
  assert.equal(res.status, 200);
});

/* ------------------------------------------------------------- missing consent */

test("HTTP: a missing consent yields 403 consent_required", async () => {
  consents = consents.filter((c) => c.consentType !== "vitals_access");
  const res = await call("GET", `/api/practice/patients/${LINK_A}/vitals`, {
    user: U.doctorA,
    practiceId: PRACTICE_A,
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "consent_required");
});

test("HTTP: practice B has no consent on its own link either (empty scopes)", async () => {
  const res = await call("GET", `/api/practice/patients/${LINK_B}/vitals`, {
    user: U.doctorB,
    practiceId: PRACTICE_B,
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "consent_required");
});

/* ------------------------------------------------- error bodies leak nothing */

test("HTTP: error bodies contain no foreign ids or metadata", async () => {
  const probes = [
    [U.doctorB, PRACTICE_B],
    [U.patientP, PRACTICE_A],
    [U.outsider, PRACTICE_A],
    [U.revokedA, PRACTICE_A],
  ];
  for (const [user, practiceId] of probes) {
    for (const [method, path, body] of ALL_ENDPOINTS) {
      const res = await call(method, path, { user, body, practiceId });
      const serialized = JSON.stringify(res.body);
      assert.deepEqual(
        Object.keys(res.body).sort(),
        ["error", "ok"],
        `${method} ${path}: body must only be { ok, error }`,
      );
      for (const secret of [U.patientP, PRACTICE_A, LINK_A, RX_A, "Testpräparat"]) {
        assert.ok(
          !serialized.includes(secret),
          `${method} ${path} leaked "${secret}" to ${user}`,
        );
      }
    }
  }
});

test("HTTP: successful responses expose no global patientUserId", async () => {
  for (const [method, path] of DOCTOR_READABLE_ENDPOINTS) {
    const res = await call(method, path, { user: U.doctorA, practiceId: PRACTICE_A });
    assert.equal(res.status, 200);
    const serialized = JSON.stringify(res.body);
    assert.ok(
      !serialized.includes("patientUserId"),
      `${method} ${path} must not expose patientUserId`,
    );
    assert.ok(
      !serialized.includes(U.patientP),
      `${method} ${path} must not expose the global user id`,
    );
  }
});
