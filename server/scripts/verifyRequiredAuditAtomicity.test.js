/**
 * Required audit and its mutation must commit or fail TOGETHER.
 *
 * The gap this closes: a security-relevant change was written, then the audit
 * row failed, then the request errored — leaving the change in place with no
 * record and the user told it had not happened.
 *
 * These run against a REAL PostgreSQL database inside REAL transactions,
 * because that is the only way to prove a rollback. An in-memory fake can be
 * made to return anything; only Postgres can actually undo a committed
 * statement. The audit insert is made to fail by intercepting
 * `prisma.$transaction` and handing the service a transaction client whose
 * `auditLog.create` throws — the rest of the transaction is genuine.
 *
 * Skips (does not fail) when no database is reachable, matching how the
 * environment-dependent specs in e2e/ behave.
 *
 * Run: node --test scripts/verifyRequiredAuditAtomicity.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";

const SUFFIX = "audit-atomicity@test.invalid";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

/** Poisons only `auditLog.create` on the transaction client the service receives. */
function withFailingAudit(fn) {
  const real = prisma.$transaction.bind(prisma);
  prisma.$transaction = (arg, opts) => {
    if (typeof arg !== "function") return real(arg, opts);
    return real(
      (tx) =>
        arg(
          new Proxy(tx, {
            get(target, prop) {
              if (prop === "auditLog") {
                return {
                  create: async () => {
                    throw new Error("audit table unavailable");
                  },
                };
              }
              return target[prop];
            },
          }),
        ),
      opts,
    );
  };
  return fn().finally(() => {
    prisma.$transaction = real;
  });
}

async function makeFixture(tag) {
  const patient = await prisma.user.create({
    data: {
      email: `patient-${tag}-${SUFFIX}`,
      passwordHash: "x",
      firstName: "Test",
      lastName: "Patient",
      dateOfBirth: new Date("1980-01-01"),
      verified: true,
    },
  });
  const owner = await prisma.user.create({
    data: {
      email: `owner-${tag}-${SUFFIX}`,
      passwordHash: "x",
      firstName: "Test",
      lastName: "Owner",
      dateOfBirth: new Date("1980-01-01"),
      verified: true,
    },
  });
  const practice = await prisma.practiceProfile.create({
    data: { userId: owner.id, practiceName: `Praxis ${tag}`, publicSlug: `audit-${tag}-${Date.now()}` },
  });
  const link = await prisma.practicePatientLink.create({
    data: {
      practiceProfileId: practice.id,
      patientUserId: patient.id,
      status: "active",
      consentScopes: [],
      consentAcceptedAt: new Date(),
    },
  });
  return { patient, owner, practice, link };
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { contains: SUFFIX } } });
}

/* ============================================================ CONSENT */

test("consent grant: a failing audit rolls the consent back", { skip: !dbAvailable && "no database reachable" }, async (t) => {
  const { patient, link } = await makeFixture("consent-fail");
  t.after(cleanup);

  const { grantConsentRecord } = await import("../services/consent/consentRecordService.js");

  await assert.rejects(
    () =>
      withFailingAudit(() =>
        grantConsentRecord({
          patientUserId: patient.id,
          practicePatientLinkId: link.id,
          consentType: "secure_messaging",
        }),
      ),
    /audit table unavailable/,
    "the caller must learn the operation failed",
  );

  const records = await prisma.consentRecord.findMany({
    where: { practicePatientLinkId: link.id },
  });
  assert.equal(records.length, 0, "no consent may exist without its audit row");
});

test("consent grant: success writes both the consent and its audit", { skip: !dbAvailable && "no database reachable" }, async (t) => {
  const { patient, link } = await makeFixture("consent-ok");
  t.after(cleanup);

  const { grantConsentRecord } = await import("../services/consent/consentRecordService.js");
  const result = await grantConsentRecord({
    patientUserId: patient.id,
    practicePatientLinkId: link.id,
    consentType: "secure_messaging",
  });

  assert.ok(result, "the grant is reported");
  const records = await prisma.consentRecord.findMany({
    where: { practicePatientLinkId: link.id, status: "granted" },
  });
  assert.equal(records.length, 1);

  const audits = await prisma.auditLog.findMany({
    where: { practicePatientLinkId: link.id, action: "consent_record_granted" },
  });
  assert.equal(audits.length, 1, "exactly one audit row, no duplicate");
});

test("consent revoke: a failing audit leaves the consent granted", { skip: !dbAvailable && "no database reachable" }, async (t) => {
  const { patient, link } = await makeFixture("consent-revoke");
  t.after(cleanup);

  const { grantConsentRecord, revokeConsentRecord } = await import(
    "../services/consent/consentRecordService.js"
  );
  const granted = await grantConsentRecord({
    patientUserId: patient.id,
    practicePatientLinkId: link.id,
    consentType: "secure_messaging",
  });

  await assert.rejects(
    () => withFailingAudit(() => revokeConsentRecord(granted.id, patient.id, {})),
    /audit table unavailable/,
  );

  const row = await prisma.consentRecord.findUnique({ where: { id: granted.id } });
  assert.equal(row.status, "granted", "withdrawal must not take effect unrecorded");
  assert.equal(row.revokedAt, null, "and no partial state is left behind");
});

/* ================================================== CARE-LINK LIFECYCLE */

test("link decline: a failing audit leaves the relationship untouched", { skip: !dbAvailable && "no database reachable" }, async (t) => {
  const { patient, link } = await makeFixture("link-decline");
  t.after(cleanup);
  await prisma.practicePatientLink.update({
    where: { id: link.id },
    data: { status: "invited" },
  });

  const { declinePracticePatientLink } = await import(
    "../services/careRelationship/practicePatientLinkService.js"
  );

  await assert.rejects(
    () => withFailingAudit(() => declinePracticePatientLink(link.id, patient.id)),
    /audit table unavailable/,
  );

  const row = await prisma.practicePatientLink.findUnique({ where: { id: link.id } });
  assert.equal(row.status, "invited", "the lifecycle state must not move");
});

test("link archive: a failing audit leaves the relationship active", { skip: !dbAvailable && "no database reachable" }, async (t) => {
  const { patient, link } = await makeFixture("link-archive");
  t.after(cleanup);

  const { archiveLinkForPatient } = await import(
    "../services/careRelationship/patientLinkArchiveService.js"
  );

  await assert.rejects(
    () => withFailingAudit(() => archiveLinkForPatient(link.id, patient.id)),
    /audit table unavailable/,
  );

  const row = await prisma.practicePatientLink.findUnique({ where: { id: link.id } });
  assert.equal(row.status, "active", "ending a relationship must not happen unrecorded");
});

test("link archive: success writes both the state change and its audit", { skip: !dbAvailable && "no database reachable" }, async (t) => {
  const { patient, link } = await makeFixture("link-archive-ok");
  t.after(cleanup);

  const { archiveLinkForPatient } = await import(
    "../services/careRelationship/patientLinkArchiveService.js"
  );
  await archiveLinkForPatient(link.id, patient.id);

  const row = await prisma.practicePatientLink.findUnique({ where: { id: link.id } });
  assert.equal(row.status, "archived");

  const audits = await prisma.auditLog.findMany({
    where: { practicePatientLinkId: link.id, action: "practice_patient_link_archived" },
  });
  assert.equal(audits.length, 1);
});

/* ========================================================== SHARING */

test("share grant: a failing audit means no grant exists", { skip: !dbAvailable && "no database reachable" }, async (t) => {
  const { patient, practice, link } = await makeFixture("share");
  t.after(cleanup);

  const target = await makeFixture("share-target");
  const targetLink = await prisma.practicePatientLink.update({
    where: { id: target.link.id },
    data: { patientUserId: patient.id },
  });

  const document = await prisma.practiceDocument.create({
    data: {
      practiceProfileId: practice.id,
      practicePatientLinkId: link.id,
      patientUserId: patient.id,
      title: "Befund",
      type: "report",
      status: "shared",
      sharedAt: new Date(),
    },
  });

  const { createDocumentShareGrant } = await import(
    "../services/practiceDocument/documentShareGrantService.js"
  );

  await assert.rejects(
    () =>
      withFailingAudit(() =>
        createDocumentShareGrant({
          patientUserId: patient.id,
          documentId: document.id,
          targetPracticePatientLinkId: targetLink.id,
        }),
      ),
    /audit table unavailable/,
  );

  const grants = await prisma.practiceDocumentShareGrant.findMany({
    where: { documentId: document.id },
  });
  assert.equal(
    grants.length,
    0,
    "a share grant is the ONLY reason a document may appear in a second practice context — it must not exist unrecorded",
  );

  await prisma.practiceDocument.deleteMany({ where: { id: document.id } });
});

test("cleanup leaves no fixture rows behind", { skip: !dbAvailable && "no database reachable" }, async () => {
  await cleanup();
  const left = await prisma.user.count({ where: { email: { contains: SUFFIX } } });
  assert.equal(left, 0);
});
