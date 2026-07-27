/**
 * Patient-practice link lifecycle + route wiring guards.
 *
 * Part 1 — a practice must never activate a link on its own, and a link the
 *          patient never accepted must not disclose identity.
 * Part 2 — static regression guard: the patient-scoped practice routes must go
 *          through the central authorization service. This is what stops a
 *          future edit from silently reintroducing the client-supplied
 *          `practiceId` pattern that caused the original cross-tenant hole.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { prisma } from "../lib/prisma.js";
import {
  createPracticePatientLink,
  linkToJson,
} from "../services/careRelationship/practicePatientLinkService.js";

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = join(here, "..", "routes");

/* ------------------------------------------------ part 1: link activation */

function installPrismaFake() {
  prisma.user = { findUnique: async () => ({ id: "patient-1" }) };
  prisma.practiceProfile = { findUnique: async () => ({ id: "practice-1" }) };
  prisma.patientProfile = { findFirst: async () => null };
  prisma.practicePatientLink = {
    findFirst: async () => null, // no duplicate
    create: async ({ data }) => ({
      ...data,
      id: "new-link",
      patientUser: {
        id: "patient-1",
        firstName: "Erika",
        lastName: "Mustermann",
        email: "erika@example.org",
      },
    }),
  };
  prisma.auditLog = { create: async () => ({}) };
}

test.beforeEach(() => installPrismaFake());

test("a practice cannot create an ACTIVE link directly", async () => {
  await assert.rejects(
    () =>
      createPracticePatientLink({
        practiceProfileId: "practice-1",
        patientUserId: "patient-1",
        status: "active",
      }),
    /validation_link_activation_requires_patient_consent/,
    "unilateral activation must be refused",
  );
});

test("a practice-created link defaults to the pending state", async () => {
  const link = await createPracticePatientLink({
    practiceProfileId: "practice-1",
    patientUserId: "patient-1",
  });
  assert.equal(link.status, "invited");

  const explicit = await createPracticePatientLink({
    practiceProfileId: "practice-1",
    patientUserId: "patient-1",
    status: "invited",
  });
  assert.equal(explicit.status, "invited");
});

test("an unaccepted link discloses no patient identity", async () => {
  const link = await createPracticePatientLink({
    practiceProfileId: "practice-1",
    patientUserId: "patient-1",
  });

  assert.equal(link.patient, null, "no name/e-mail before the patient accepts");
  const serialized = JSON.stringify(link);
  assert.ok(!serialized.includes("erika@example.org"), "e-mail must not leak");
  assert.ok(!serialized.includes("Mustermann"), "surname must not leak");
});

test("an accepted link discloses identity again", () => {
  const accepted = linkToJson({
    id: "l1",
    practiceProfileId: "practice-1",
    patientUserId: "patient-1",
    status: "active",
    consentAcceptedAt: new Date("2026-01-01"),
    patientUser: {
      id: "patient-1",
      firstName: "Erika",
      lastName: "Mustermann",
      email: "erika@example.org",
    },
  });
  assert.equal(accepted.patient.email, "erika@example.org");
});

test("a revoked link that was once accepted keeps its identity", () => {
  const revoked = linkToJson({
    id: "l2",
    practiceProfileId: "practice-1",
    patientUserId: "patient-1",
    status: "revoked",
    consentAcceptedAt: new Date("2026-01-01"),
    patientUser: { id: "patient-1", firstName: "Erika", lastName: "Mustermann", email: "e@x.org" },
  });
  assert.equal(revoked.patient.email, "e@x.org");

  const neverAccepted = linkToJson({
    id: "l3",
    practiceProfileId: "practice-1",
    patientUserId: "patient-1",
    status: "declined",
    consentAcceptedAt: null,
    patientUser: { id: "patient-1", firstName: "Erika", lastName: "Mustermann", email: "e@x.org" },
  });
  assert.equal(neverAccepted.patient, null);
});

/* ------------------------------------------- part 2: route wiring guards */

/** Routers mounted under /api/practice/patients/:linkId/... */
const LINK_SCOPED_ROUTERS = [
  "practicePatientVitals.js",
  "practicePatientVaccinations.js",
  "practiceSosCard.js",
  "practicePatientHealthHistory.js",
  "practiceErezept.js",
];

for (const file of LINK_SCOPED_ROUTERS) {
  test(`${file} uses the central authorization service`, () => {
    const src = readFileSync(join(routesDir, file), "utf8");

    assert.ok(
      src.includes("requirePracticePatientLinkAccess"),
      `${file} must authorize through the central service`,
    );

    // The vulnerable pattern: trusting a client-supplied practiceId as the tenant.
    assert.ok(
      !/resolvePatientLinkForPractice/.test(src),
      `${file} must not resolve links by a client-supplied practiceId`,
    );
    assert.ok(
      !/req\.query\.practiceId|req\.query\?\.practiceId/.test(src),
      `${file} must not read practiceId from the query string`,
    );
  });

  test(`${file} guards every route handler`, () => {
    const src = readFileSync(join(routesDir, file), "utf8");
    const handlers = src.match(/router\.(get|post|patch|put|delete)\(/g) ?? [];
    const guards = src.match(/requirePracticePatientLinkAccess|requirePrescription\w+|requireHealthHistoryAccess/g) ?? [];
    assert.ok(handlers.length > 0, `${file} should define at least one route`);
    assert.ok(
      guards.length >= handlers.length,
      `${file}: ${handlers.length} handlers but only ${guards.length} authorization references`,
    );
  });
}

test("routers with previously incomplete access checks now use the central check", () => {
  for (const file of ["practiceDashboard.js", "practiceFollowUps.js", "visitMedications.js"]) {
    const src = readFileSync(join(routesDir, file), "utf8");
    assert.ok(
      src.includes("getPracticeAccess"),
      `${file} must delegate to the central getPracticeAccess`,
    );
    assert.ok(
      !/prisma\.practiceMember\.findUnique/.test(src),
      `${file} must not re-implement the membership lookup (it omitted the status check)`,
    );
    assert.ok(
      !/\["owner",\s*"admin"/.test(src),
      `${file} must not hardcode role lists instead of the permission matrix`,
    );
  }
});
