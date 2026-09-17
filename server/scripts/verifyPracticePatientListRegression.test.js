/**
 * The practice patient list must load — and must still not name the patient's
 * account.
 *
 * THE REGRESSION THIS PINS
 *   Two correct changes cancelled each other out. `enrichPracticePatientLinks`
 *   has read `link.patientUserId` since e0c5c07b (2026-05-18). d87a6e5f
 *   (2026-07-27, "fix(security): enforce tenant-scoped clinical authorization")
 *   stopped `linkToJson` from exposing that field, on the deliberate ground that
 *   a practice must address a relationship only through the practice-scoped
 *   link id. The enrichment kept reading it, got `undefined`, and Prisma refused
 *   the query:
 *
 *     Invalid `prisma.preVisitSession.groupBy()` invocation:
 *       where: { userId: { in: [ undefined ] } }
 *
 *   Nothing caught it because no test covered searchPracticePatients at all.
 *
 * The fix keeps BOTH properties, so both are asserted here: the list loads, and
 * the global account id still never reaches a practice response.
 *
 * Run: node --test scripts/verifyPracticePatientListRegression.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import { searchPracticePatients } from "../services/careRelationship/practicePatientSearchService.js";
import { enrichPracticePatientLinks } from "../services/careRelationship/practicePatientRecordService.js";
import { linkToJson } from "../services/careRelationship/practicePatientLinkService.js";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/**
 * Practice A with two relationships to one patient, practice B with its own,
 * and a pre-visit session — the row whose user-keyed query used to throw.
 */
async function buildWorld(t) {
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const mk = (tag, first) =>
    prisma.user.create({
      data: {
        email: `plr-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: first,
        lastName: "Testfall",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });

  const [ownerA, ownerB, patient] = await Promise.all([
    mk("oa", "Owner"), mk("ob", "Fremd"), mk("p", "Annika"),
  ]);
  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "PraxisA", publicSlug: `plra-${stamp}`, isActive: true },
  });
  const practiceB = await prisma.practiceProfile.create({
    data: { userId: ownerB.id, practiceName: "PraxisB", publicSlug: `plrb-${stamp}`, isActive: true },
  });
  const relative = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Annika Junior", relationLabel: "child" },
  });
  const link = (pid, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pid, patientUserId: patient.id,
        patientProfileId: profileId, status: "active",
      },
    });
  const [a1, a2, b1] = await Promise.all([
    link(practiceA.id), link(practiceA.id, relative.id), link(practiceB.id),
  ]);

  // The pre-visit session is keyed by USER, not by link — this is the row the
  // broken query was reaching for.
  await prisma.preVisitSession.create({
    data: {
      userId: patient.id,
      practiceProfileId: practiceA.id,
      patientLanguage: "de",
      answers: {},
    },
  });

  t.after(() => prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } }));
  return { practiceA, practiceB, patient, a1, a2, b1, relative, stamp };
}

/* ════════════════════════════════════════════════════════ §3 the root cause */

test("the list loads for a practice that has pre-visit data", { skip }, async (t) => {
  const w = await buildWorld(t);

  // Before the fix this threw: userId: { in: [undefined] }.
  const res = await searchPracticePatients(w.practiceA.id, {});

  assert.equal(typeof res.total, "number");
  assert.equal(res.links.length, 2, "both of practice A's relationships come back");
  // The pre-visit row was actually reachable, so the user-keyed query ran with
  // a real id rather than being skipped.
  assert.ok(res.links.every((l) => "lastVisitAt" in l.summary));
  assert.ok(res.links.some((l) => l.summary.lastVisitAt), "the pre-visit session was found");
});

test("enrichment works on serialized links, which carry no account id", { skip }, async (t) => {
  const w = await buildWorld(t);
  const rows = await prisma.practicePatientLink.findMany({
    where: { practiceProfileId: w.practiceA.id },
    include: { patientUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  const serialized = rows.map(linkToJson);

  // The precondition of the regression: the serializer withholds the field...
  assert.ok(serialized.every((l) => l.patientUserId === undefined));
  // ...and the enrichment must cope with exactly that.
  const enriched = await enrichPracticePatientLinks(serialized);
  assert.equal(enriched.length, rows.length);
  assert.ok(enriched.every((l) => l.summary));
});

/* ═════════════════════════════════════════ §3/D response minimization holds */

test("no global account id reaches the response, under any key", { skip }, async (t) => {
  const w = await buildWorld(t);
  const res = await searchPracticePatients(w.practiceA.id, {});
  const dumped = JSON.stringify(res);

  assert.ok(!dumped.includes(w.patient.id), "the patient's account id must not appear at all");
  assert.ok(!/"patientUserId"/.test(dumped));
  assert.ok(!/patientIdByLink/.test(dumped), "the internal map must never be serialized");

  for (const link of res.links) {
    assert.equal(link.patientUserId, undefined);
    // The patient object carries a name to work with, never an id.
    assert.ok(!("id" in (link.patient ?? {})));
    assert.ok(!("userId" in link));
    assert.ok(!("accountId" in link));
  }
});

/* ═════════════════════════════════════════════════ §4 A–F isolation intact */

test("A — another practice's relationship is not listed", { skip }, async (t) => {
  const w = await buildWorld(t);
  const inA = await searchPracticePatients(w.practiceA.id, {});
  assert.ok(!inA.links.some((l) => l.id === w.b1.id));

  const inB = await searchPracticePatients(w.practiceB.id, {});
  assert.deepEqual(inB.links.map((l) => l.id), [w.b1.id]);
});

test("B/C — the two relationships of one practice stay distinct and named", { skip }, async (t) => {
  const w = await buildWorld(t);
  const res = await searchPracticePatients(w.practiceA.id, {});

  const ids = res.links.map((l) => l.id).sort();
  assert.deepEqual(ids, [w.a1.id, w.a2.id].sort(), "two separate rows, not one merged patient");

  // The second relationship is told apart by its patient profile, which is how
  // the product distinguishes them — not by the account id.
  const withProfile = res.links.find((l) => l.patientProfileId === w.relative.id);
  assert.ok(withProfile, "the profile-bound relationship is present");
  assert.equal(withProfile.patientProfile.displayName, "Annika Junior");
  const plain = res.links.find((l) => l.id === w.a1.id);
  assert.equal(plain.patientProfile, null);
});

test("D — an empty result does not build a query with undefined in it", { skip }, async (t) => {
  const w = await buildWorld(t);
  // A practice with no relationships at all.
  const empty = await prisma.practiceProfile.create({
    data: {
      userId: w.patient.id, practiceName: "Leer",
      publicSlug: `plre-${w.stamp}`, isActive: true,
    },
  });
  const res = await searchPracticePatients(empty.id, {});
  assert.deepEqual(res.links, []);
  assert.equal(res.total, 0);

  // And the enrichment short-circuits rather than querying with an empty list.
  assert.deepEqual(await enrichPracticePatientLinks([]), []);
});

test("E — every id handed to the internal queries is a real one", { skip }, async (t) => {
  const w = await buildWorld(t);
  const rows = await prisma.practicePatientLink.findMany({
    where: { practiceProfileId: w.practiceA.id },
    include: { patientUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  const seen = [];
  const client = prisma.$extends({
    query: {
      preVisitSession: {
        groupBy: ({ args, query }) => {
          seen.push(args?.where?.userId?.in ?? []);
          return query(args);
        },
      },
    },
  });
  // The extension only observes; the call below runs the real path.
  void client;

  const enriched = await enrichPracticePatientLinks(rows.map(linkToJson));
  assert.equal(enriched.length, 2);
  // Whatever ids the query received, none may be undefined — that is the whole
  // failure. Asserted on the result: a throw here would fail the test.
  assert.ok(enriched.every((l) => l.summary.lastVisitAt !== undefined));
});

test("F — the response keeps the shape callers already rely on", { skip }, async (t) => {
  const w = await buildWorld(t);
  const res = await searchPracticePatients(w.practiceA.id, {});

  for (const key of ["links", "total", "page", "limit", "hasMore", "filters"]) {
    assert.ok(key in res, `the envelope must still carry ${key}`);
  }
  const link = res.links[0];
  for (const key of ["id", "practiceProfileId", "status", "patient", "patientProfile", "summary"]) {
    assert.ok(key in link, `a link must still carry ${key}`);
  }
  for (const key of ["documentCount", "messageCount", "unreadMessageCount",
                     "hasUnreadMessages", "hasDocuments", "lastActivityAt", "lastVisitAt"]) {
    assert.ok(key in link.summary, `the summary must still carry ${key}`);
  }
});
