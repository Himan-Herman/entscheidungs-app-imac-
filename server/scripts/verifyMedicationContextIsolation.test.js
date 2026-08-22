/**
 * Medication plan visibility inside ONE practice context (Phase 2E.3).
 *
 * The invariant: a published medication plan and its items are reachable only
 * through the PracticePatientLink they belong to. `practicePatientLinkId` is
 * NOT NULL on MedicationPlan, so every plan already names its one relationship
 * — the boundary exists in the data and only has to be honoured in the query.
 *
 * The two readings that must NOT be confused:
 *   patientUserId  — the same person can hold several relationships,
 *   practiceProfileId — the same practice can hold several links to one person.
 * Both are wider than the boundary. The tests below separate them.
 *
 * Runs against the REAL database, because the rule lives in a Prisma `where`
 * clause. Skips (does not fail) when no database is reachable.
 *
 * Run: node --test scripts/verifyMedicationContextIsolation.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  getPatientLinkMedicationPlan,
  listPatientLinkMedicationPlans,
  listMedicationPlansForPracticePatient,
  submitPatientLinkMedicationPlanQuestion,
} from "../services/medicationPlan/medicationPlanService.js";

const SUFFIX = "med-context@test.invalid";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/**
 * Patient P with three links, plus an unrelated patient Q.
 *
 *   link A  -> practice A     plan A_MED_PLAN_MARKER      (published)
 *   link A2 -> practice A     plan A1_PLAN_MARKER         (published)  <- same practice, other link
 *   link B  -> practice B     plan B_MED_PLAN_MARKER      (published)
 *   link A  -> practice A     plan A_DRAFT_MARKER         (draft)
 *   link A  -> practice A     plan A_ARCHIVED_MARKER      (archived)
 *   link Q  -> practice A     plan Q_PLAN_MARKER          (published, patient Q)
 */
async function buildFixture() {
  const mk = async (tag, first) =>
    prisma.user.create({
      data: {
        email: `${tag}-${Date.now()}-${Math.round(Math.random() * 1e6)}-${SUFFIX}`,
        passwordHash: "x",
        firstName: first,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });

  const patient = await mk("p", "Patient");
  const other = await mk("q", "Other");
  const ownerA = await mk("oa", "OwnerA");
  const ownerB = await mk("ob", "OwnerB");

  const practice = async (owner, name) =>
    prisma.practiceProfile.create({
      data: {
        userId: owner.id,
        practiceName: name,
        publicSlug: `${name}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      },
    });
  const practiceA = await practice(ownerA, "PraxisA");
  const practiceB = await practice(ownerB, "PraxisB");

  const link = async (pr, pat, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pr.id,
        patientUserId: pat.id,
        patientProfileId: profileId,
        status: "active",
        consentScopes: ["medication"],
        consentAcceptedAt: new Date(),
      },
    });

  const linkA = await link(practiceA, patient);
  const linkB = await link(practiceB, patient);
  const linkQ = await link(practiceA, other);

  // Second link to the SAME practice for the SAME account — permitted because
  // the uniqueness key includes patientProfileId.
  const profile = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Angehoerige", relationLabel: "child" },
  });
  const linkA2 = await link(practiceA, patient, profile.id);

  const plan = async (lnk, pat, title, status = "published") => {
    const row = await prisma.medicationPlan.create({
      data: {
        practicePatientLinkId: lnk.id,
        practiceProfileId: lnk.practiceProfileId,
        patientUserId: pat.id,
        title,
        status,
        publishedAt: status === "published" ? new Date() : null,
        archivedAt: status === "archived" ? new Date() : null,
      },
    });
    await prisma.medicationPlanItem.create({
      data: {
        medicationPlanId: row.id,
        medicationName: `${title}_DRUG`,
        dosage: "1-0-1",
        frequency: "taeglich",
        sortOrder: 0,
      },
    });
    return row;
  };

  const planA = await plan(linkA, patient, "A_MED_PLAN_MARKER");
  const planB = await plan(linkB, patient, "B_MED_PLAN_MARKER");
  const planA2 = await plan(linkA2, patient, "A1_PLAN_MARKER");
  const planDraft = await plan(linkA, patient, "A_DRAFT_MARKER", "draft");
  const planArchived = await plan(linkA, patient, "A_ARCHIVED_MARKER", "archived");
  const planQ = await plan(linkQ, other, "Q_PLAN_MARKER");

  return {
    patient, other, practiceA, practiceB,
    linkA, linkA2, linkB, linkQ,
    planA, planA2, planB, planDraft, planArchived, planQ,
  };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

const titles = (plans) => plans.map((p) => p.title).sort();

/* ================================================== Same patient, two links */

test("each context shows only its own plan", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const inA = await listPatientLinkMedicationPlans(f.linkA.id, f.patient.id);
  assert.deepEqual(titles(inA), ["A_MED_PLAN_MARKER"]);

  const inB = await listPatientLinkMedicationPlans(f.linkB.id, f.patient.id);
  assert.deepEqual(titles(inB), ["B_MED_PLAN_MARKER"]);
});

test("owning the account is not enough to see a plan", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // Every one of these plans has patientUserId === P. Only the link differs.
  await assert.rejects(
    () => getPatientLinkMedicationPlan(f.linkB.id, f.planA.id, f.patient.id),
    /plan_not_found/,
  );
  await assert.rejects(
    () => getPatientLinkMedicationPlan(f.linkA.id, f.planB.id, f.patient.id),
    /plan_not_found/,
  );
});

/* ========================================= Same practice, two links (§8) */

test("a second link to the same practice is a separate context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  assert.equal(
    f.linkA.practiceProfileId,
    f.linkA2.practiceProfileId,
    "precondition: both links belong to the same practice",
  );
  assert.notEqual(f.linkA.id, f.linkA2.id);

  const inA = await listPatientLinkMedicationPlans(f.linkA.id, f.patient.id);
  assert.equal(titles(inA).includes("A1_PLAN_MARKER"), false, "the other link's plan stays out");

  const inA2 = await listPatientLinkMedicationPlans(f.linkA2.id, f.patient.id);
  assert.deepEqual(titles(inA2), ["A1_PLAN_MARKER"], "and this link shows only its own");

  await assert.rejects(
    () => getPatientLinkMedicationPlan(f.linkA2.id, f.planA.id, f.patient.id),
    /plan_not_found/,
  );
});

/* ================================================================ Status */

test("drafts and archived plans are not patient-visible in any context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const inA = await listPatientLinkMedicationPlans(f.linkA.id, f.patient.id);
  assert.equal(titles(inA).includes("A_DRAFT_MARKER"), false);
  assert.equal(titles(inA).includes("A_ARCHIVED_MARKER"), false);

  for (const id of [f.planDraft.id, f.planArchived.id]) {
    await assert.rejects(
      () => getPatientLinkMedicationPlan(f.linkA.id, id, f.patient.id),
      /plan_not_found/,
    );
  }
});

/* ============================================================ Other patient */

test("another patient's link and plan are unreachable", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => listPatientLinkMedicationPlans(f.linkQ.id, f.patient.id),
    /link_not_found/,
  );
  await assert.rejects(
    () => getPatientLinkMedicationPlan(f.linkA.id, f.planQ.id, f.patient.id),
    /plan_not_found/,
  );
  await assert.rejects(
    () => getPatientLinkMedicationPlan(f.linkQ.id, f.planQ.id, f.patient.id),
    /link_not_found/,
  );
});

test("a foreign link and a missing link are indistinguishable", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const foreign = await listPatientLinkMedicationPlans(f.linkQ.id, f.patient.id).catch((e) => e.message);
  const missing = await listPatientLinkMedicationPlans("clfakefakefakefakefake", f.patient.id).catch((e) => e.message);
  assert.equal(foreign, "link_not_found");
  assert.equal(missing, foreign, "a foreign link must not be distinguishable from a missing one");
});

/* =================================================================== Items */

test("the response carries the items verbatim and no cross-context ids", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const [plan] = await listPatientLinkMedicationPlans(f.linkA.id, f.patient.id);

  assert.equal(plan.items.length, 1);
  // Medical content is passed through, never reformatted.
  assert.equal(plan.items[0].medicationName, "A_MED_PLAN_MARKER_DRUG");
  assert.equal(plan.items[0].dosage, "1-0-1");
  assert.equal(plan.items[0].frequency, "taeglich");

  for (const key of ["patientUserId", "practiceProfileId", "practicePatientLinkId", "deletedAt"]) {
    assert.equal(key in plan, false, `${key} must not travel to the context page`);
  }
});

test("no route accepts a plan item id", { skip }, async () => {
  // Items exist only inside their plan: they are created and deleted in bulk by
  // the practice-side plan update, and no route takes an itemId. That absence
  // IS the item-scope guarantee, so it is asserted rather than assumed.
  const { readFileSync, readdirSync } = await import("node:fs");

  // Two independent signals, because either one alone could be worked around:
  // a route that names a medication item id in its path, and any route that
  // reaches the MedicationPlanItem table directly instead of going through the
  // plan. Inbox items and document items are a different noun and are not
  // matched — the scan is limited to medication routes for the path check.
  const pathOffenders = [];
  const tableOffenders = [];
  for (const file of readdirSync("routes")) {
    if (!file.endsWith(".js")) continue;
    const src = readFileSync(`routes/${file}`, "utf8");
    if (/medication/i.test(file) && /:itemId|:medicationItemId|:medicationPlanItemId/.test(src)) {
      pathOffenders.push(file);
    }
    if (/medicationPlanItem\s*\./.test(src)) tableOffenders.push(file);
  }

  assert.deepEqual(pathOffenders, [], "an item-level route would need its own plan-scope test");
  assert.deepEqual(tableOffenders, [], "items must be reached through their plan, never directly");
});

/* ================================================================ Question */

test("a question can only be raised on a plan of this context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => submitPatientLinkMedicationPlanQuestion(f.linkB.id, f.planA.id, f.patient.id),
    /plan_not_found/,
    "a plan of link A must not address practice B",
  );
  await assert.rejects(
    () => submitPatientLinkMedicationPlanQuestion(f.linkA.id, f.planQ.id, f.patient.id),
    /plan_not_found/,
  );
});

test("a question on an ended relationship is refused, reading is not", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await prisma.practicePatientLink.update({
    where: { id: f.linkA.id },
    data: { status: "revoked" },
  });

  // Reading the history stays possible — the existing patient-side rule.
  const inA = await listPatientLinkMedicationPlans(f.linkA.id, f.patient.id);
  assert.deepEqual(titles(inA), ["A_MED_PLAN_MARKER"]);

  await assert.rejects(
    () => submitPatientLinkMedicationPlanQuestion(f.linkA.id, f.planA.id, f.patient.id),
    /link_not_active/,
  );
});

/* =========================================================== Practice side */

test("a practice sees only the plans of its own link", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const forA = await listMedicationPlansForPracticePatient(f.linkA.id, f.practiceA.id);
  assert.equal(titles(forA).includes("A1_PLAN_MARKER"), false, "not the same practice's other link");
  assert.equal(titles(forA).includes("B_MED_PLAN_MARKER"), false);

  const forA2 = await listMedicationPlansForPracticePatient(f.linkA2.id, f.practiceA.id);
  assert.equal(titles(forA2).includes("A_MED_PLAN_MARKER"), false);

  // Practice B cannot read through practice A's link.
  await assert.rejects(
    () => listMedicationPlansForPracticePatient(f.linkA.id, f.practiceB.id),
    /link_not_found|not_found/,
  );
});

/* ==================================================================== N+1 */

test("listing a context costs the same for one plan or many", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const wrapped = [];
  const count = { n: 0 };
  for (const model of ["practicePatientLink", "medicationPlan", "medicationPlanItem"]) {
    for (const op of ["findFirst", "findMany", "findUnique"]) {
      const original = prisma[model][op];
      if (typeof original !== "function") continue;
      wrapped.push([model, op, original]);
      prisma[model][op] = (...a) => {
        count.n += 1;
        return original.apply(prisma[model], a);
      };
    }
  }
  t.after(() => wrapped.forEach(([m, o, fn]) => { prisma[m][o] = fn; }));

  await listPatientLinkMedicationPlans(f.linkA.id, f.patient.id);
  const withOne = count.n;

  for (let i = 0; i < 6; i += 1) {
    const row = await prisma.medicationPlan.create({
      data: {
        practicePatientLinkId: f.linkA.id,
        practiceProfileId: f.linkA.practiceProfileId,
        patientUserId: f.patient.id,
        title: `BULK_${i}`,
        status: "published",
        publishedAt: new Date(),
      },
    });
    await prisma.medicationPlanItem.createMany({
      data: Array.from({ length: 5 }, (_, k) => ({
        medicationPlanId: row.id,
        medicationName: `BULK_${i}_DRUG_${k}`,
        sortOrder: k,
      })),
    });
  }

  count.n = 0;
  const many = await listPatientLinkMedicationPlans(f.linkA.id, f.patient.id);

  assert.equal(many.length, 7, "six more plans are actually visible");
  assert.equal(many.reduce((n, p) => n + p.items.length, 0), 31, "and their items load with them");
  assert.equal(count.n, withOne, `query count must not grow with the plan count (was ${withOne}, now ${count.n})`);
  assert.ok(count.n <= 2, `bounded at two queries, got ${count.n}`);
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  const left = await prisma.user.count({ where: { email: { contains: SUFFIX } } });
  assert.equal(left, 0);
});
