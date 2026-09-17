/**
 * Deletion guards for practice, account and family profile (Phase 2F.3A).
 *
 * Three defects this pins down, all measured before they were fixed:
 *
 *   1. A practice holding a document share grant could not be deleted, and the
 *      refusal came from the database as an opaque constraint error AFTER the
 *      preflight had reported "fine".
 *   2. A patient who had ever released a document to a second practice could
 *      not delete their account at all — same RESTRICT foreign key, same
 *      opaque failure, in a path whose entire purpose is erasure.
 *   3. Deleting a family profile did not detach its practice relationship; it
 *      silently REASSIGNED it to the account holder, because
 *      PracticePatientLink.patientProfileId is ON DELETE SET NULL and a NULL
 *      profile means "the account holder's own".
 *
 * Runs against the REAL database. Skips when none is reachable.
 *
 * Run: node --test scripts/verifyDeletionLifecycleGuards.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  ACTIVE_SHARING_BLOCKED,
  CONTEXTUAL_DATA_BLOCKED,
  blockingErrorCode,
  checkPracticeDeletionBlockers,
  checkUserDeletionBlockers,
} from "../services/dataLifecycle/contextualPatientDataDeletionGuard.js";

const SUFFIX = "lifecycle-guard@test.invalid";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/**
 * Patient P with a family profile, linked to practice A (own) and practice B
 * (family). A document of A is released into B, which is what creates the
 * share grant and its RESTRICT foreign keys.
 */
async function buildFixture(opts = {}) {
  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `${tag}-${Date.now()}-${Math.round(Math.random() * 1e6)}-${SUFFIX}`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });

  const patient = await mk("p");
  const ownerA = await mk("oa");
  const ownerB = await mk("ob");

  const practice = (owner, name) =>
    prisma.practiceProfile.create({
      data: {
        userId: owner.id,
        practiceName: name,
        publicSlug: `${name}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      },
    });
  const practiceA = await practice(ownerA, "PraxisA");
  const practiceB = await practice(ownerB, "PraxisB");

  const profile = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Max Muster", relationLabel: "child" },
  });

  const link = (pr, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pr.id,
        patientUserId: patient.id,
        patientProfileId: profileId,
        status: "active",
        consentScopes: ["documents"],
        consentAcceptedAt: new Date(),
      },
    });
  const linkA = await link(practiceA);
  const linkB = await link(practiceB, profile.id);

  const document = await prisma.practiceDocument.create({
    data: {
      practiceProfileId: practiceA.id,
      practicePatientLinkId: linkA.id,
      patientUserId: patient.id,
      title: "DOC",
      type: "report",
      status: "shared",
      sharedAt: new Date(),
    },
  });
  const file = await prisma.practiceDocumentFile.create({
    data: {
      documentId: document.id,
      originalFileName: "d.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      storageKey: `t/${document.id}`,
    },
  });

  let grant = null;
  let token = null;
  if (opts.withGrant !== false) {
    grant = await prisma.practiceDocumentShareGrant.create({
      data: {
        documentId: document.id,
        patientUserId: patient.id,
        sourcePracticeProfileId: practiceA.id,
        sourcePracticePatientLinkId: linkA.id,
        targetPracticeProfileId: practiceB.id,
        targetPracticePatientLinkId: linkB.id,
        status: "active",
        grantedByUserId: patient.id,
        grantedAt: new Date(),
      },
    });
    token = await prisma.secureDocumentAccessToken.create({
      data: {
        documentId: document.id,
        fileId: file.id,
        tokenHash: `hash-${Date.now()}-${Math.random()}`,
        audience: "practice",
        practiceProfileId: practiceB.id,
        practicePatientLinkId: linkB.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
  }

  return { patient, ownerA, ownerB, practiceA, practiceB, profile, linkA, linkB, document, file, grant, token };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.practiceDocumentShareGrant.deleteMany({
    where: { OR: [{ patientUserId: { in: ids } }, { grantedByUserId: { in: ids } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

/* ============================================ 1. Practice deletion guard */

test("a live document release blocks practice deletion before the database does", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // The source practice: deleting it would strand a release it granted.
  const source = await checkPracticeDeletionBlockers(f.practiceA.id);
  assert.equal(source.requiresGrantCleanup, true, "the grant must be seen");
  assert.ok(source.grantCount >= 1);
  assert.equal(blockingErrorCode(source), ACTIVE_SHARING_BLOCKED);

  // And the TARGET practice too — the grant names four objects, and any of them
  // being deleted hits the same RESTRICT.
  const target = await checkPracticeDeletionBlockers(f.practiceB.id);
  assert.equal(target.requiresGrantCleanup, true, "the receiving practice is blocked as well");
});

test("the preflight verdict matches what the database would actually do", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const report = await checkPracticeDeletionBlockers(f.practiceA.id);
  assert.ok(blockingErrorCode(report), "precondition: the preflight refuses");

  // The claim under test: the preflight is not merely cautious — the database
  // really would refuse. Attempted in a transaction that is always rolled back.
  let dbRefused = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.practiceProfile.delete({ where: { id: f.practiceA.id } });
      throw new Error("__ROLLBACK__");
    });
  } catch (err) {
    if (err.message !== "__ROLLBACK__") dbRefused = true;
  }
  assert.equal(dbRefused, true, "the preflight and the database must agree");
});

test("a practice with no dependants is not blocked", { skip }, async (t) => {
  const f = await buildFixture({ withGrant: false });
  t.after(cleanup);

  const report = await checkPracticeDeletionBlockers(f.practiceB.id);
  assert.equal(report.blocked, false);
  assert.equal(report.requiresGrantCleanup, false);
  assert.equal(blockingErrorCode(report), null, "nothing to report, nothing to refuse");
});

test("the guard reports counts and categories, never content", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const report = await checkPracticeDeletionBlockers(f.practiceA.id);
  const serialized = JSON.stringify(report);
  for (const secret of ["DOC", "PraxisA", "PraxisB", "Max Muster", "d.pdf"]) {
    assert.equal(serialized.includes(secret), false, `${secret} must not appear in a guard report`);
  }
});

/* ============================================= 2. Account deletion */

test("a share grant does not block account deletion — it is ended first", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // The grant is visible to the guard, but as cleanup work rather than a
  // refusal: the patient asked for erasure.
  const report = await checkUserDeletionBlockers(f.patient.id);
  assert.equal(report.blocked, false, "a permission artifact must not block erasure");
  assert.equal(report.requiresGrantCleanup, true, "but it must not go unnoticed either");
  assert.equal(blockingErrorCode(report), ACTIVE_SHARING_BLOCKED);
});

test("ending a grant during account deletion revokes its tokens and records it", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const { revokeGrantWithin } = await import(
    "../services/practiceDocument/documentShareGrantService.js"
  );

  const auditBefore = await prisma.auditLog.count({
    where: { action: "document_share_grant_revoked", entityId: f.grant.id },
  });

  await prisma.$transaction(async (tx) => {
    const grant = await tx.practiceDocumentShareGrant.findUnique({ where: { id: f.grant.id } });
    await revokeGrantWithin(tx, grant, {
      actorUserId: f.patient.id,
      actorRole: "patient",
      reason: "account_deletion",
    });
  });

  const grant = await prisma.practiceDocumentShareGrant.findUnique({ where: { id: f.grant.id } });
  assert.equal(grant.status, "revoked");
  assert.ok(grant.revokedAt);

  const token = await prisma.secureDocumentAccessToken.findUnique({ where: { id: f.token.id } });
  assert.ok(token.revokedAt, "a token must not outlive the permission it was issued under");

  const auditAfter = await prisma.auditLog.count({
    where: { action: "document_share_grant_revoked", entityId: f.grant.id },
  });
  assert.equal(auditAfter, auditBefore + 1, "the mandatory audit entry is written");
});

test("the account deletion route clears every RESTRICT foreign key to User", { skip }, async () => {
  // The route used to claim there was only one. Comparing the claim against
  // pg_constraint is the only way that claim stays true.
  const rows = await prisma.$queryRaw`
    SELECT c.relname AS child, a.attname AS col
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN unnest(con.conkey) WITH ORDINALITY k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
    WHERE con.contype = 'f' AND con.confdeltype IN ('r', 'a')
      AND (SELECT relname FROM pg_class WHERE oid = con.confrelid) = 'User'`;

  const { readFileSync } = await import("node:fs");
  const src = readFileSync("routes/account.js", "utf8");

  const missing = rows
    .map((r) => ({ table: r.child, delegate: r.child[0].toLowerCase() + r.child.slice(1) }))
    .filter(({ delegate }) => !src.includes(`tx.${delegate}.`));

  assert.deepEqual(
    missing.map((m) => m.table),
    [],
    "a RESTRICT foreign key to User that account deletion never touches will fail the erasure",
  );
});

/* ================================= 3. Family profile deletion */

test("a family profile linked to a practice cannot be deleted", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const linked = await prisma.practicePatientLink.count({
    where: { patientProfileId: f.profile.id },
  });
  assert.equal(linked, 1, "precondition: the relationship points at the profile");

  const { readFileSync } = await import("node:fs");
  const src = readFileSync("routes/accountPatientPortal.js", "utf8");
  assert.ok(
    src.includes("profile_linked_to_practice"),
    "the delete route must refuse a linked profile",
  );
  assert.ok(
    /patientProfileId:\s*existing\.id/.test(src),
    "and it must look for the relationship by the profile's own id",
  );
});

test("deleting the profile would rebind the relationship to the account holder", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // This is the behaviour the guard exists to prevent, demonstrated and rolled
  // back. Without it the test would only assert that a string appears in a file.
  let after = null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.patientProfile.delete({ where: { id: f.profile.id } });
      after = await tx.practicePatientLink.findUnique({
        where: { id: f.linkB.id },
        select: { id: true, patientProfileId: true },
      });
      throw new Error("__ROLLBACK__");
    });
  } catch (err) {
    if (err.message !== "__ROLLBACK__") throw err;
  }

  assert.ok(after, "the relationship survives the profile");
  assert.equal(
    after.patientProfileId,
    null,
    "and its profile becomes NULL — which the UI reads as the account holder's own",
  );

  // Nothing actually changed.
  const still = await prisma.practicePatientLink.findUnique({
    where: { id: f.linkB.id },
    select: { patientProfileId: true },
  });
  assert.equal(still.patientProfileId, f.profile.id, "the rollback held");
});

test("a family profile with no practice relationship stays deletable", { skip }, async (t) => {
  const f = await buildFixture({ withGrant: false });
  t.after(cleanup);

  const lonely = await prisma.patientProfile.create({
    data: { userId: f.patient.id, displayName: "Unlinked", relationLabel: "other" },
  });
  const linked = await prisma.practicePatientLink.count({
    where: { patientProfileId: lonely.id },
  });
  assert.equal(linked, 0, "the guard must not turn into a blanket ban");

  await prisma.patientProfile.delete({ where: { id: lonely.id } });
  assert.equal(await prisma.patientProfile.count({ where: { id: lonely.id } }), 0);
});

/* ============ 4. Practice-issued clinical artifacts (Phase 2F.3B) ======== */

/**
 * A published medication plan and a prescription both hold their practice with
 * ON DELETE RESTRICT since Phase 2F.3B. Before that, deleting a practice
 * cascaded through the care relationship and destroyed the plan and its items
 * without a trace, while the prescription kept a dangling id.
 */
async function withClinicalArtifacts(f, opts = {}) {
  const wantPlan = opts.plan !== false;
  const wantPrescription = opts.prescription !== false;

  const plan = !wantPlan ? null : await prisma.medicationPlan.create({
    data: {
      practicePatientLinkId: f.linkA.id,
      practiceProfileId: f.practiceA.id,
      patientUserId: f.patient.id,
      title: "PLAN",
      status: "published",
      publishedAt: new Date(),
    },
  });
  const item = !wantPlan ? null : await prisma.medicationPlanItem.create({
    data: { medicationPlanId: plan.id, medicationName: "DRUG" },
  });
  const prescription = !wantPrescription ? null : await prisma.erezeptEntry.create({
    data: {
      patientUserId: f.patient.id,
      issuedByUserId: f.ownerA.id,
      linkId: f.linkA.id,
      practiceProfileId: f.practiceA.id,
      issuerPracticeNameAtIssue: "PraxisA",
      medicationName: "RX",
      tokenCode: `ERZ-${Date.now()}`,
      status: "issued",
      validUntil: new Date(Date.now() + 28 * 86_400_000),
    },
  });
  return { plan, item, prescription };
}

test("a published medication plan blocks practice deletion", { skip }, async (t) => {
  const f = await buildFixture({ withGrant: false });
  t.after(cleanup);
  // ONLY the plan: with a prescription alongside, the database would refuse on
  // its account and this test would pass even with the plan back on CASCADE.
  const { plan, item } = await withClinicalArtifacts(f, { prescription: false });

  const report = await checkPracticeDeletionBlockers(f.practiceA.id);
  assert.equal(report.blocked, true, "a clinical artifact must block, not merely be noticed");
  assert.deepEqual(report.categories, ["medication_plans"], "and it is the plan doing it");
  assert.equal(blockingErrorCode(report), CONTEXTUAL_DATA_BLOCKED);

  // And the database agrees — attempted for real, rolled back.
  let refused = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.practiceProfile.delete({ where: { id: f.practiceA.id } });
      throw new Error("__ROLLBACK__");
    });
  } catch (err) {
    if (err.message !== "__ROLLBACK__") refused = true;
  }
  assert.equal(refused, true, "the practice cannot be deleted while the plan exists");

  // Nothing was destroyed by the attempt.
  assert.equal(await prisma.medicationPlan.count({ where: { id: plan.id } }), 1);
  assert.equal(await prisma.medicationPlanItem.count({ where: { id: item.id } }), 1);
});

test("a prescription blocks practice deletion too", { skip }, async (t) => {
  const f = await buildFixture({ withGrant: false });
  t.after(cleanup);
  const { prescription } = await withClinicalArtifacts(f, { plan: false });

  const report = await checkPracticeDeletionBlockers(f.practiceA.id);
  assert.equal(report.blocked, true);
  assert.deepEqual(report.categories, ["prescriptions"], "and it is named as such");
  assert.equal(await prisma.erezeptEntry.count({ where: { id: prescription.id } }), 1);
});

test("both categories are reported together, and nothing is partially deleted", { skip }, async (t) => {
  const f = await buildFixture({ withGrant: false });
  t.after(cleanup);
  const { plan, prescription } = await withClinicalArtifacts(f);

  const report = await checkPracticeDeletionBlockers(f.practiceA.id);
  assert.deepEqual(
    [...report.categories].sort(),
    ["medication_plans", "prescriptions"],
    "a partial report would let one artifact be destroyed to reach the other",
  );
  assert.equal(report.total, 2);

  // Counts and categories only — never a medication name or a practice name.
  const serialized = JSON.stringify(report);
  for (const secret of ["PLAN", "DRUG", "RX", "PraxisA"]) {
    assert.equal(serialized.includes(secret), false, `${secret} must not appear in a guard report`);
  }

  assert.equal(await prisma.medicationPlan.count({ where: { id: plan.id } }), 1);
  assert.equal(await prisma.erezeptEntry.count({ where: { id: prescription.id } }), 1);
});

test("a care relationship cannot be deleted while a plan hangs off it", { skip }, async (t) => {
  const f = await buildFixture({ withGrant: false });
  t.after(cleanup);
  await withClinicalArtifacts(f);

  let refused = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.practicePatientLink.delete({ where: { id: f.linkA.id } });
      throw new Error("__ROLLBACK__");
    });
  } catch (err) {
    if (err.message !== "__ROLLBACK__") refused = true;
  }
  assert.equal(refused, true, "the relationship a clinical artifact names must survive it");
});

test("deleting a plan through its own domain logic still takes its items", { skip }, async (t) => {
  const f = await buildFixture({ withGrant: false });
  t.after(cleanup);
  const { plan, item } = await withClinicalArtifacts(f);

  // The restriction is about the practice and the relationship. A plan deleted
  // deliberately still owns its items — that semantics is unchanged.
  await prisma.medicationPlan.delete({ where: { id: plan.id } });
  assert.equal(await prisma.medicationPlanItem.count({ where: { id: item.id } }), 0);
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  assert.equal(await prisma.user.count({ where: { email: { contains: SUFFIX } } }), 0);
});
