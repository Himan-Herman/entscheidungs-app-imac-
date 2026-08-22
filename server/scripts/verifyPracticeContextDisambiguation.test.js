/**
 * Telling two relationships with the SAME practice apart (Phase 2F.0).
 *
 * `PracticePatientLink` is unique on
 * (practiceProfileId, patientUserId, patientProfileId), so one account can hold
 * several links to one practice. `patientProfileId` is NULL for the account
 * holder's own relationship and set for a family profile — a PatientProfile row
 * exists only for the latter.
 *
 * Those relationships are separate contexts everywhere it matters (messages,
 * appointments, documents, medication plans), but on screen they carried the
 * same practice name, specialty and city. This suite pins down the one piece of
 * data that tells them apart, and pins down that it is the RIGHT one: a label
 * naming the wrong person would be worse than no label.
 *
 * Runs against the REAL database. Skips when none is reachable.
 *
 * Run: node --test scripts/verifyPracticeContextDisambiguation.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import { listPatientPracticeContexts } from "../services/careRelationship/patientPracticeDirectoryService.js";

const SUFFIX = "ctx-disambig@test.invalid";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/**
 * Patient P holds TWO links to practice A and one to practice B.
 *
 *   link A1 -> practice A, patientProfileId NULL      (P in person)
 *   link A2 -> practice A, profile "Max Muster"       (a family profile)
 *   link B  -> practice B, patientProfileId NULL
 *
 * Patient Q holds one link to practice A with their own family profile, so the
 * test can check that a profile never crosses accounts.
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

  const practice = async (owner, name, specialty, city) =>
    prisma.practiceProfile.create({
      data: {
        userId: owner.id,
        practiceName: name,
        specialty,
        city,
        publicSlug: `${name}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      },
    });

  // Deliberately identical branding on both links to practice A.
  const practiceA = await practice(ownerA, "Hausarztpraxis Doppelt", "Allgemeinmedizin", "Duesseldorf");
  const practiceB = await practice(ownerB, "Kardiologie Anders", "Kardiologie", "Koeln");

  const profileP = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Max Muster", relationLabel: "child" },
  });
  const profileQ = await prisma.patientProfile.create({
    data: { userId: other.id, displayName: "Fremd Kind", relationLabel: "child" },
  });

  const link = async (pr, pat, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pr.id,
        patientUserId: pat.id,
        patientProfileId: profileId,
        status: "active",
        consentScopes: ["messages"],
        consentAcceptedAt: new Date(),
      },
    });

  const linkA1 = await link(practiceA, patient, null);
  const linkA2 = await link(practiceA, patient, profileP.id);
  const linkB = await link(practiceB, patient, null);
  const linkQ = await link(practiceA, other, profileQ.id);

  return { patient, other, practiceA, practiceB, profileP, profileQ, linkA1, linkA2, linkB, linkQ };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

const byLink = (contexts) => new Map(contexts.map((c) => [c.linkId, c]));

/* ================================================== The disambiguating field */

test("two links to one practice are distinguishable by data, not only by id", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const { contexts } = await listPatientPracticeContexts(f.patient.id);
  const m = byLink(contexts);

  // Precondition: without this the rest would prove nothing.
  assert.equal(
    m.get(f.linkA1.id).practice.displayName,
    m.get(f.linkA2.id).practice.displayName,
    "both links must genuinely show the same practice name",
  );
  assert.equal(m.get(f.linkA1.id).practice.city, m.get(f.linkA2.id).practice.city);

  // The account holder's own relationship carries no name — the client words it.
  assert.equal(m.get(f.linkA1.id).patientProfileName, null);
  // The family relationship names the person it is for.
  assert.equal(m.get(f.linkA2.id).patientProfileName, "Max Muster");

  // Which means the two cards now differ in their rendered data.
  const a1 = m.get(f.linkA1.id);
  const a2 = m.get(f.linkA2.id);
  assert.notDeepEqual(
    [a1.practice.displayName, a1.patientProfileName],
    [a2.practice.displayName, a2.patientProfileName],
  );
});

test("a single relationship to a practice is unaffected", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const { contexts } = await listPatientPracticeContexts(f.patient.id);
  assert.equal(byLink(contexts).get(f.linkB.id).patientProfileName, null);
});

/* ============================================================= Privacy (§11) */

test("a profile name never crosses accounts", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const { contexts } = await listPatientPracticeContexts(f.patient.id);
  const names = contexts.map((c) => c.patientProfileName).filter(Boolean);
  assert.equal(names.includes("Fremd Kind"), false, "another account's profile must not appear");
  assert.deepEqual(names, ["Max Muster"]);

  // And Q's directory holds none of P's.
  const q = await listPatientPracticeContexts(f.other.id);
  assert.equal(q.contexts.map((c) => c.patientProfileName).includes("Max Muster"), false);
});

test("a profile belonging to someone else is not shown even if a link points at it", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // A data fault: P's link now references Q's profile. Link ownership still
  // says the relationship is P's, so the row is still listed — but the label
  // must fall silent rather than name the wrong person.
  await prisma.practicePatientLink.update({
    where: { id: f.linkA2.id },
    data: { patientProfileId: f.profileQ.id },
  });

  const { contexts } = await listPatientPracticeContexts(f.patient.id);
  const ctx = byLink(contexts).get(f.linkA2.id);
  assert.ok(ctx, "the relationship itself is still P's and stays listed");
  assert.equal(ctx.patientProfileName, null, "but it must not be labelled with Q's profile");
});

/* ======================================================= Unread stays scoped */

test("unread counts stay with their own link when the practice is shared", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const owner = await prisma.practiceProfile.findUnique({
    where: { id: f.practiceA.id },
    select: { userId: true },
  });

  const thread = await prisma.practicePatientThread.create({
    data: {
      practicePatientLinkId: f.linkA2.id,
      practiceProfileId: f.practiceA.id,
      patientUserId: f.patient.id,
      status: "open",
    },
  });
  await prisma.practicePatientMessage.create({
    data: {
      threadId: thread.id,
      senderType: "practice",
      senderUserId: owner.userId,
      body: "unread on A2 only",
    },
  });

  const { contexts } = await listPatientPracticeContexts(f.patient.id);
  const m = byLink(contexts);
  assert.equal(m.get(f.linkA2.id).unreadCount, 1);
  assert.equal(m.get(f.linkA1.id).unreadCount, 0, "the sibling link of the same practice stays at zero");
  assert.equal(m.get(f.linkB.id).unreadCount, 0);
});

/* ============================================================== Performance */

test("the added field costs no extra query, however many profiles exist", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const wrapped = [];
  const count = { n: 0 };
  for (const model of [
    "practicePatientLink",
    "practicePatientThread",
    "practicePatientMessage",
    "patientProfile",
  ]) {
    for (const op of ["findFirst", "findMany", "findUnique", "groupBy"]) {
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

  const first = await listPatientPracticeContexts(f.patient.id);
  const withOneProfile = count.n;
  assert.equal(first.contexts.length, 3);

  // Six more relationships, each with its OWN family profile. A per-row lookup
  // would grow with them; riding along with the link query does not. An
  // absolute bound would not catch that, because the baseline here depends on
  // whether a channel exists — the growth is what matters.
  for (let i = 0; i < 6; i += 1) {
    const profile = await prisma.patientProfile.create({
      data: { userId: f.patient.id, displayName: `Kind ${i}`, relationLabel: "child" },
    });
    await prisma.practicePatientLink.create({
      data: {
        practiceProfileId: f.practiceA.id,
        patientUserId: f.patient.id,
        patientProfileId: profile.id,
        status: "active",
        consentScopes: ["messages"],
        consentAcceptedAt: new Date(),
      },
    });
  }

  count.n = 0;
  const { contexts } = await listPatientPracticeContexts(f.patient.id);

  assert.equal(contexts.length, 9, "the six extra relationships are actually listed");
  assert.equal(
    contexts.filter((c) => c.patientProfileName).length,
    7,
    "and every one of them is labelled",
  );
  assert.equal(
    count.n,
    withOneProfile,
    `query count must not grow with the number of profiles (was ${withOneProfile}, now ${count.n})`,
  );
});

/* ============================================== Content still never travels */

test("the directory still carries no message content", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const { contexts } = await listPatientPracticeContexts(f.patient.id);
  const serialized = JSON.stringify(contexts);
  for (const key of ["body", "subject", "messages", "relationLabel", "dateOfBirth", "patientUserId"]) {
    assert.equal(serialized.includes(key), false, `${key} must not travel in the directory`);
  }
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  assert.equal(await prisma.user.count({ where: { email: { contains: SUFFIX } } }), 0);
});
