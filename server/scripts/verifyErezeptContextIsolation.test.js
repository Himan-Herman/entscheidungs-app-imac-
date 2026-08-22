/**
 * e-Prescription visibility inside ONE practice context (Phase 2F.1).
 *
 * Since Phase 2F.3B `ErezeptEntry.linkId` is a real ON DELETE RESTRICT foreign
 * key on `PracticePatientLink`, and `practiceProfileId` records the issuing
 * practice. Two of the attacks this suite was written for therefore moved from
 * "the query must hide it" to "the database must refuse it" — asserted that way
 * rather than deleted, because the guarantee is what matters, not which layer
 * provides it.
 *
 * The scope in the service is unchanged and still carries both conditions: a
 * foreign key protects integrity, it does not perform authorization.
 *
 * Runs against the REAL database. Skips when none is reachable.
 *
 * Run: node --test scripts/verifyErezeptContextIsolation.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  getPatientLinkErezept,
  listPatientLinkErezept,
  updatePatientLinkErezeptStatus,
} from "../services/erezept/patientErezeptContextService.js";

const SUFFIX = "erx-context@test.invalid";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/**
 * Patient P: link A (practice A), link A2 (practice A, family profile),
 *            link B (practice B). Patient Q: link Q (practice A).
 *
 *   E_A       -> link A
 *   E_A2      -> link A2   (same practice as A, different link)
 *   E_B       -> link B
 *   E_ORPHAN  -> linkId "does-not-exist"        (§21)
 *   E_PRACTICE-> linkId = practiceA.id          (a plausible wrong id)
 *   E_Q       -> link Q, patient Q
 *   E_MISMATCH-> link A, but patientUserId = Q  (both ids resolve, and disagree)
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

  const profile = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Angehoerige", relationLabel: "child" },
  });

  const link = async (pr, pat, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pr.id,
        patientUserId: pat.id,
        patientProfileId: profileId,
        status: "active",
        consentScopes: ["prescriptions_access"],
        consentAcceptedAt: new Date(),
      },
    });

  const linkA = await link(practiceA, patient);
  const linkA2 = await link(practiceA, patient, profile.id);
  const linkB = await link(practiceB, patient);
  const linkQ = await link(practiceA, other);

  /** Attribution mirrors the issue path: taken from the link, never invented. */
  const entry = async (link, patientUserId, name, status = "issued", validDays = 28) =>
    prisma.erezeptEntry.create({
      data: {
        patientUserId,
        issuedByUserId: ownerA.id,
        linkId: link.id,
        practiceProfileId: link.practiceProfileId,
        issuerPracticeNameAtIssue: "PraxisAtIssue",
        medicationName: name,
        tokenCode: `ERZ-${name}`,
        status,
        validUntil: new Date(Date.now() + validDays * 86_400_000),
      },
    });

  const eA = await entry(linkA, patient.id, "E_A");
  const eA2 = await entry(linkA2, patient.id, "E_A2");
  const eB = await entry(linkB, patient.id, "E_B");
  const eQ = await entry(linkQ, other.id, "E_Q");
  // Still creatable: both ids resolve, they simply name different people. No
  // foreign key can catch that, so the query still has to.
  const eMismatch = await entry(linkA, other.id, "E_MISMATCH");

  return {
    patient, other, ownerA, practiceA, practiceB,
    linkA, linkA2, linkB, linkQ,
    eA, eA2, eB, eQ, eMismatch,
  };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

const names = (entries) => entries.map((e) => e.medicationName).sort();

/* ============================================== Same patient, two practices */

test("each context shows only its own prescriptions", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  assert.deepEqual(names(await listPatientLinkErezept(f.linkA.id, f.patient.id)), ["E_A"]);
  assert.deepEqual(names(await listPatientLinkErezept(f.linkB.id, f.patient.id)), ["E_B"]);
});

test("owning the account is not enough to see a prescription", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // Every one of these has patientUserId === P. Only the link differs.
  await assert.rejects(
    () => getPatientLinkErezept(f.linkB.id, f.eA.id, f.patient.id),
    /entry_not_found/,
  );
  await assert.rejects(
    () => getPatientLinkErezept(f.linkA.id, f.eB.id, f.patient.id),
    /entry_not_found/,
  );
});

/* ========================================= Same practice, different link */

test("a second link to the same practice is a separate context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  assert.equal(
    f.linkA.practiceProfileId,
    f.linkA2.practiceProfileId,
    "precondition: both links belong to the same practice",
  );

  assert.equal(names(await listPatientLinkErezept(f.linkA.id, f.patient.id)).includes("E_A2"), false);
  assert.deepEqual(names(await listPatientLinkErezept(f.linkA2.id, f.patient.id)), ["E_A2"]);

  await assert.rejects(
    () => getPatientLinkErezept(f.linkA2.id, f.eA.id, f.patient.id),
    /entry_not_found/,
  );
});

/* ================================== The unconstrained string field (§21) */

test("a linkId that names nothing cannot be stored at all", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // Until Phase 2F.3B this row existed and the query had to hide it. The
  // guarantee now sits one layer lower: it cannot be written.
  await assert.rejects(
    () =>
      prisma.erezeptEntry.create({
        data: {
          patientUserId: f.patient.id,
          issuedByUserId: f.ownerA.id,
          linkId: "does-not-exist",
          practiceProfileId: f.practiceA.id,
          medicationName: "E_ORPHAN",
          tokenCode: "ERZ-E_ORPHAN",
          status: "issued",
          validUntil: new Date(Date.now() + 86_400_000),
        },
      }),
    /Foreign key constraint|violates foreign key/i,
  );

  // And a string that is not a link is still not a context.
  await assert.rejects(
    () => listPatientLinkErezept("does-not-exist", f.patient.id),
    /link_not_found/,
  );
});

test("a practiceProfileId in the link field cannot be stored either", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // A REAL id — just of the wrong table. Previously accepted, and the scope had
  // to make sure it was never read as a practice.
  await assert.rejects(
    () =>
      prisma.erezeptEntry.create({
        data: {
          patientUserId: f.patient.id,
          issuedByUserId: f.ownerA.id,
          linkId: f.practiceA.id,
          practiceProfileId: f.practiceA.id,
          medicationName: "E_PRACTICE_ID",
          tokenCode: "ERZ-E_PRACTICE_ID",
          status: "issued",
          validUntil: new Date(Date.now() + 86_400_000),
        },
      }),
    /Foreign key constraint|violates foreign key/i,
  );

  await assert.rejects(
    () => listPatientLinkErezept(f.practiceA.id, f.patient.id),
    /link_not_found/,
    "a practice id is not a context",
  );
});

/* ================================================ Historical attribution */

test("a prescription records which practice issued it, and under what name", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const row = await prisma.erezeptEntry.findUnique({ where: { id: f.eA.id } });
  assert.equal(row.practiceProfileId, f.linkA.practiceProfileId, "the issuing practice is named");
  assert.equal(row.issuerPracticeNameAtIssue, "PraxisAtIssue", "and so is the name it had then");

  // Renaming the practice must not rewrite what the prescription says.
  await prisma.practiceProfile.update({
    where: { id: f.practiceA.id },
    data: { practiceName: "Umbenannt", displayNameForPatients: "Umbenannt" },
  });
  const after = await prisma.erezeptEntry.findUnique({ where: { id: f.eA.id } });
  assert.equal(after.issuerPracticeNameAtIssue, "PraxisAtIssue", "history is not retroactive");
  assert.equal(after.practiceProfileId, f.linkA.practiceProfileId, "and the relation still resolves");
});

test("an entry whose link and patient disagree is unreadable from either side", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // E_MISMATCH sits on P's link but names Q as the patient. Both ids resolve.
  assert.equal(names(await listPatientLinkErezept(f.linkA.id, f.patient.id)).includes("E_MISMATCH"), false);
  await assert.rejects(
    () => getPatientLinkErezept(f.linkA.id, f.eMismatch.id, f.patient.id),
    /entry_not_found/,
  );
  // Q cannot reach it either: the link is not Q's.
  await assert.rejects(
    () => listPatientLinkErezept(f.linkA.id, f.other.id),
    /link_not_found/,
  );
});

/* ============================================================ Cross-patient */

test("another patient's link and prescription are unreachable", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => listPatientLinkErezept(f.linkQ.id, f.patient.id),
    /link_not_found/,
  );
  await assert.rejects(
    () => getPatientLinkErezept(f.linkA.id, f.eQ.id, f.patient.id),
    /entry_not_found/,
  );
  await assert.rejects(
    () => updatePatientLinkErezeptStatus(f.linkA.id, f.eQ.id, f.patient.id, "at_pharmacy"),
    /entry_not_found/,
  );
});

test("a foreign link and a missing link are indistinguishable", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const foreign = await listPatientLinkErezept(f.linkQ.id, f.patient.id).catch((e) => e.message);
  const missing = await listPatientLinkErezept("clfakefakefakefake", f.patient.id).catch((e) => e.message);
  assert.equal(foreign, "link_not_found");
  assert.equal(missing, foreign);
});

/* ================================================================ Mutations */

test("a status change is refused outside its own context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => updatePatientLinkErezeptStatus(f.linkB.id, f.eA.id, f.patient.id, "at_pharmacy"),
    /entry_not_found/,
  );
  await assert.rejects(
    () => updatePatientLinkErezeptStatus(f.linkA2.id, f.eA.id, f.patient.id, "at_pharmacy"),
    /entry_not_found/,
    "not even from the same practice's other link",
  );
  // Untouched by any of the above.
  const still = await prisma.erezeptEntry.findUnique({ where: { id: f.eA.id } });
  assert.equal(still.status, "issued");
});

test("the status machine is unchanged — same targets, same final states", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => updatePatientLinkErezeptStatus(f.linkA.id, f.eA.id, f.patient.id, "cancelled"),
    /invalid_status/,
    "cancelling belongs to the practice side",
  );
  await assert.rejects(
    () => updatePatientLinkErezeptStatus(f.linkA.id, f.eA.id, f.patient.id, "issued"),
    /invalid_status/,
  );

  const { json } = await updatePatientLinkErezeptStatus(f.linkA.id, f.eA.id, f.patient.id, "redeemed");
  assert.equal(json.status, "redeemed");
  assert.ok(json.redeemedAt, "redeeming stamps the time");

  await assert.rejects(
    () => updatePatientLinkErezeptStatus(f.linkA.id, f.eA.id, f.patient.id, "at_pharmacy"),
    /already_final/,
  );
});

/* ================================================================== Expiry */

test("expiry is applied inside the context and nowhere else", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // Both A's and B's prescriptions are past their validity.
  await prisma.erezeptEntry.updateMany({
    where: { id: { in: [f.eA.id, f.eB.id] } },
    data: { validUntil: new Date(Date.now() - 86_400_000) },
  });

  const inA = await listPatientLinkErezept(f.linkA.id, f.patient.id);
  assert.equal(inA[0].status, "expired", "the context's own entry is expired on read");

  const bRow = await prisma.erezeptEntry.findUnique({ where: { id: f.eB.id } });
  assert.equal(bRow.status, "issued", "reading practice A must not write practice B's rows");
});

/* ============================================================== Response */

test("no internal identifier travels to the client", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const [entry] = await listPatientLinkErezept(f.linkA.id, f.patient.id);
  for (const key of ["linkId", "patientUserId", "issuedByUserId", "deletedAt", "updatedAt", "practiceProfileId"]) {
    assert.equal(key in entry, false, `${key} must not travel to the context page`);
  }
  assert.equal(entry.medicationName, "E_A", "but the prescription itself is intact");
});

/* ================================================================= Queries */

test("listing a context costs the same for one prescription or many", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const wrapped = [];
  const count = { n: 0 };
  for (const model of ["practicePatientLink", "erezeptEntry"]) {
    for (const op of ["findFirst", "findMany", "findUnique", "updateMany"]) {
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

  await listPatientLinkErezept(f.linkA.id, f.patient.id);
  const withOne = count.n;

  for (let i = 0; i < 8; i += 1) {
    await prisma.erezeptEntry.create({
      data: {
        patientUserId: f.patient.id,
        issuedByUserId: f.patient.id,
        linkId: f.linkA.id,
        practiceProfileId: f.linkA.practiceProfileId,
        medicationName: `BULK_${i}`,
        tokenCode: `ERZ-BULK-${i}`,
        status: "issued",
        validUntil: new Date(Date.now() + 28 * 86_400_000),
      },
    });
  }

  count.n = 0;
  const many = await listPatientLinkErezept(f.linkA.id, f.patient.id);

  assert.equal(many.length, 9, "eight more prescriptions are actually visible");
  assert.equal(count.n, withOne, `query count must not grow with the entry count (was ${withOne}, now ${count.n})`);
  assert.ok(count.n <= 2, `bounded at two queries, got ${count.n}`);
});

/* =========================================================== Practice side */

test("the issue path takes attribution from the authorized link, never from the body", { skip }, async () => {
  // The practice endpoints deny every role today (PRESCRIPTION_* require a
  // verified professional qualification), so this asserts the invariant at the
  // source rather than over HTTP.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("routes/practiceErezept.js", "utf8");

  // Searched FORWARD from the create: writeRequiredAuditLog also appears in the
  // import block at the top, so a plain indexOf would slice backwards and match
  // nothing — which would pass this test for the wrong reason.
  const createAt = src.indexOf("erezeptEntry.create");
  assert.ok(createAt > 0, "the create call must exist");
  const create = src.slice(createAt, src.indexOf("writeRequiredAuditLog", createAt));
  assert.ok(create.length > 100, `expected the create block, got ${create.length} characters`);

  assert.ok(
    /practiceProfileId:\s*issuer\.id/.test(create),
    "the issuing practice must be derived from the authorized link",
  );
  assert.ok(
    /issuerPracticeNameAtIssue:\s*\n?\s*issuer\./.test(create),
    "and so must the name it had at the time — a prescription outlives the relationship",
  );

  // The decisive half: nothing about the practice may come from the request.
  assert.equal(
    /(practiceProfileId|issuerPracticeName\w*|practiceName)\s*:\s*req\.(body|query|params)/.test(src),
    false,
    "attribution from the request would let a caller name a practice that never issued it",
  );

  // And the practice it names is looked up by the link's own practice id.
  assert.ok(
    /findUnique\(\{\s*where:\s*\{\s*id:\s*link\.practiceProfileId/.test(src),
    "the issuer is resolved from the link, not from anything the caller supplied",
  );
});

test("the practice route scopes by link, not by practice or patient", { skip }, async () => {
  // The practice endpoints are permission-denied for every role today, so this
  // asserts the query shape at the source rather than through HTTP.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("routes/practiceErezept.js", "utf8");

  // Every database read must carry the authorized link's id.
  const reads = src.match(/erezeptEntry\.find\w+\(\{[\s\S]*?\}\)/g) || [];
  assert.ok(reads.length >= 3, `expected the list/patch/delete reads, found ${reads.length}`);
  for (const read of reads) {
    assert.ok(read.includes("linkId: link.id"), `a practice read is not link-scoped: ${read.slice(0, 90)}`);
  }

  // And the one write must take the link from the authorization, never the body.
  assert.ok(src.includes("linkId: link.id,"), "the create path must persist the authorized link id");
  assert.equal(
    /linkId:\s*req\.(body|params|query)/.test(src),
    false,
    "a client-supplied linkId must never reach the row",
  );
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  assert.equal(await prisma.user.count({ where: { email: { contains: SUFFIX } } }), 0);
});
