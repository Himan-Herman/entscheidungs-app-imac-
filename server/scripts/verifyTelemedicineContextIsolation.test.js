/**
 * Video consultations inside ONE practice context (Phase 2G.2).
 *
 * `TelemedicineSession.practicePatientLinkId` is NULLABLE and legitimately so:
 * both creation paths can produce a session that names a practice but no care
 * relationship. Such a session must not be pulled into a context, exactly like
 * the inbox notices of Phase 2G.1.
 *
 * The second theme here is that listing is not joining. A meeting URL is issued
 * by the join call and nowhere else, and the room id that would reconstruct it
 * must not travel in a list.
 *
 * Runs against the REAL database. Skips when none is reachable.
 *
 * Run: node --test scripts/verifyTelemedicineContextIsolation.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  getPatientLinkSession,
  grantPatientLinkConsent,
  joinPatientLinkSession,
  leavePatientLinkSession,
  listPatientLinkSessions,
} from "../services/telemedicine/telemedicineContextService.js";

const SUFFIX = "tele-context@test.invalid";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/**
 * Patient P: link A and link A2 (same practice, different profile), link B.
 * Patient Q: link Q at practice A.
 *
 *   S_A          -> link A
 *   S_A2         -> link A2
 *   S_B          -> link B
 *   S_Q          -> link Q, patient Q
 *   S_LINKLESS   -> practice A, patient P, NO link  (legitimate, see the model)
 *   S_NO_PATIENT -> practice A, no link, no patient (a practice-only session)
 */
async function buildFixture() {
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
  const other = await mk("q");
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
    data: { userId: patient.id, displayName: "Angehoerige", relationLabel: "child" },
  });

  const link = (pr, pat, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pr.id,
        patientUserId: pat.id,
        patientProfileId: profileId,
        status: "active",
        consentScopes: ["telemedicine"],
        consentAcceptedAt: new Date(),
      },
    });
  const linkA = await link(practiceA, patient);
  const linkA2 = await link(practiceA, patient, profile.id);
  const linkB = await link(practiceB, patient);
  const linkQ = await link(practiceA, other);

  let seq = 0;
  const session = (opts) =>
    prisma.telemedicineSession.create({
      data: {
        practiceProfileId: opts.practiceProfileId,
        practicePatientLinkId: opts.linkId ?? null,
        patientUserId: opts.patientUserId ?? null,
        providerType: "sandbox",
        status: opts.status ?? "planned",
        title: opts.title,
        scheduledStartAt: new Date(Date.now() + ++seq * 3600_000),
        joinUrlHash: `jh-${opts.title}`,
        hostUrlHash: `hh-${opts.title}`,
        providerRoomId: `msx-secret-${opts.title}`,
        consentVersion: "1",
      },
    });

  const sA = await session({ practiceProfileId: practiceA.id, linkId: linkA.id, patientUserId: patient.id, title: "S_A" });
  const sA2 = await session({ practiceProfileId: practiceA.id, linkId: linkA2.id, patientUserId: patient.id, title: "S_A2" });
  const sB = await session({ practiceProfileId: practiceB.id, linkId: linkB.id, patientUserId: patient.id, title: "S_B" });
  const sQ = await session({ practiceProfileId: practiceA.id, linkId: linkQ.id, patientUserId: other.id, title: "S_Q" });
  const sLinkless = await session({ practiceProfileId: practiceA.id, linkId: null, patientUserId: patient.id, title: "S_LINKLESS" });
  const sNoPatient = await session({ practiceProfileId: practiceA.id, linkId: null, patientUserId: null, title: "S_NO_PATIENT" });

  return {
    patient, other, practiceA, practiceB, linkA, linkA2, linkB, linkQ,
    sA, sA2, sB, sQ, sLinkless, sNoPatient, session,
  };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  const practices = await prisma.practiceProfile.findMany({
    where: { userId: { in: ids } },
    select: { id: true },
  });
  // Sessions hold their practice with Cascade, but a practice-only session
  // survives the patient; remove them explicitly.
  await prisma.telemedicineSession.deleteMany({
    where: { practiceProfileId: { in: practices.map((p) => p.id) } },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

const titles = (rows) => rows.map((r) => r.title).sort();

/* ================================================ Same patient, two links */

test("each context shows only its own consultations", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  assert.deepEqual(titles(await listPatientLinkSessions(f.linkA.id, f.patient.id)), ["S_A"]);
  assert.deepEqual(titles(await listPatientLinkSessions(f.linkB.id, f.patient.id)), ["S_B"]);
});

test("owning the account is not enough to reach a consultation", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => getPatientLinkSession(f.linkB.id, f.sA.id, f.patient.id),
    /session_not_found/,
  );
});

/* ======================================= Same practice, different link */

test("a second link to the same practice is a separate context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  assert.equal(f.linkA.practiceProfileId, f.linkA2.practiceProfileId, "precondition");

  assert.equal(titles(await listPatientLinkSessions(f.linkA.id, f.patient.id)).includes("S_A2"), false);
  assert.deepEqual(titles(await listPatientLinkSessions(f.linkA2.id, f.patient.id)), ["S_A2"]);

  await assert.rejects(
    () => joinPatientLinkSession(f.linkA2.id, f.sA.id, f.patient.id),
    /session_not_found/,
    "not even the same practice's other link may join it",
  );
});

/* ================================== The nullable link (legitimate, §8) */

test("a session without a care relationship belongs to no context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // It names practice A and this very patient — everything except a
  // relationship. Both creation paths produce such sessions on purpose.
  const raw = await prisma.telemedicineSession.findUnique({ where: { id: f.sLinkless.id } });
  assert.equal(raw.practicePatientLinkId, null, "precondition: no relationship");
  assert.equal(raw.patientUserId, f.patient.id, "but it is this patient's");

  for (const link of [f.linkA, f.linkA2, f.linkB]) {
    const list = await listPatientLinkSessions(link.id, f.patient.id);
    assert.equal(titles(list).includes("S_LINKLESS"), false, "no context may claim it");
  }
  await assert.rejects(
    () => joinPatientLinkSession(f.linkA.id, f.sLinkless.id, f.patient.id),
    /session_not_found/,
  );
});

test("a practice-only session is unreachable from any patient context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  for (const link of [f.linkA, f.linkA2, f.linkB]) {
    assert.equal(
      titles(await listPatientLinkSessions(link.id, f.patient.id)).includes("S_NO_PATIENT"),
      false,
    );
  }
});

/* ============================================================ Cross-patient */

test("another patient's link and consultation are unreachable", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => listPatientLinkSessions(f.linkQ.id, f.patient.id),
    /link_not_found/,
  );
  for (const op of [getPatientLinkSession, joinPatientLinkSession, leavePatientLinkSession, grantPatientLinkConsent]) {
    await assert.rejects(() => op(f.linkA.id, f.sQ.id, f.patient.id), /session_not_found/);
  }
});

test("a foreign link and a missing link are indistinguishable", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const foreign = await listPatientLinkSessions(f.linkQ.id, f.patient.id).catch((e) => e.message);
  const missing = await listPatientLinkSessions("clfakefakefake", f.patient.id).catch((e) => e.message);
  assert.equal(foreign, "link_not_found");
  assert.equal(missing, foreign);
});

/* ============================================ Listing is not joining (§9) */

test("a listed consultation still cannot be joined without consent", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // Visible in the list...
  assert.deepEqual(titles(await listPatientLinkSessions(f.linkA.id, f.patient.id)), ["S_A"]);

  // ...and still refused, because joining re-derives its own authorization.
  await assert.rejects(
    () => joinPatientLinkSession(f.linkA.id, f.sA.id, f.patient.id),
    /consent_required/,
    "seeing a session in a list is not permission to enter it",
  );
});

test("a revoked link cannot be joined even after consent", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await grantPatientLinkConsent(f.linkA.id, f.sA.id, f.patient.id);
  await prisma.telemedicineSession.update({
    where: { id: f.sA.id },
    data: { linkRevokedAt: new Date() },
  });

  await assert.rejects(
    () => joinPatientLinkSession(f.linkA.id, f.sA.id, f.patient.id),
    /link_revoked/,
  );
});

test("a join after consent issues the meeting URL", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await grantPatientLinkConsent(f.linkA.id, f.sA.id, f.patient.id);
  const result = await joinPatientLinkSession(f.linkA.id, f.sA.id, f.patient.id);

  // Precondition for the privacy test below: the URL exists, and it exists HERE.
  assert.ok(result.joinUrl, "the join call is where the meeting URL comes from");
  assert.ok(result.joinUrl.includes("msx-secret-S_A"), "and it is built from the room id");
});

/* ================================================ The room id is a secret */

test("the room id never travels in a list or a detail response", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // For the sandbox provider the meeting URL is
  // https://meet.jit.si/MedScoutX-<providerRoomId>. Anyone holding the room id
  // can therefore enter the room WITHOUT passing the join endpoint, which is
  // where consent and revocation are checked.
  const list = await listPatientLinkSessions(f.linkA.id, f.patient.id);
  const detail = await getPatientLinkSession(f.linkA.id, f.sA.id, f.patient.id);

  for (const payload of [list, detail]) {
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes("msx-secret"), false, "the room id must not leave the server");
    assert.equal(serialized.includes("providerRoomId"), false);
    assert.equal(serialized.includes("joinUrlHash"), false);
    assert.equal(serialized.includes("hostUrlHash"), false);
  }
  // But the page can still tell whether a link exists.
  assert.equal(typeof list[0].hasJoinLink, "boolean");
});

test("no internal identifier travels to the client", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const [session] = await listPatientLinkSessions(f.linkA.id, f.patient.id);
  for (const key of ["patientUserId", "practiceProfileId", "practicePatientLinkId", "providerRoomId"]) {
    assert.equal(key in session, false, `${key} must not travel to the context page`);
  }
  assert.equal(session.title, "S_A", "but the consultation itself is intact");
});

test("participants are exposed as roles, never as people", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await prisma.telemedicineParticipant.create({
    data: { sessionId: f.sA.id, userId: f.patient.id, role: "patient", status: "waiting" },
  });

  const detail = await getPatientLinkSession(f.linkA.id, f.sA.id, f.patient.id);
  assert.equal(detail.participants.length, 1);
  assert.equal(detail.participants[0].role, "patient");
  assert.equal("userId" in detail.participants[0], false, "a participant's account id is not needed");
});

/* ============================================================ Performance */

test("listing a context costs the same for one consultation or many", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const wrapped = [];
  const count = { n: 0 };
  for (const model of ["practicePatientLink", "telemedicineSession"]) {
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

  await listPatientLinkSessions(f.linkA.id, f.patient.id);
  const withOne = count.n;

  for (let i = 0; i < 8; i += 1) {
    await f.session({
      practiceProfileId: f.practiceA.id,
      linkId: f.linkA.id,
      patientUserId: f.patient.id,
      title: `BULK_${i}`,
    });
  }

  count.n = 0;
  const many = await listPatientLinkSessions(f.linkA.id, f.patient.id);

  assert.equal(many.length, 9, "the extra consultations are actually listed");
  assert.equal(count.n, withOne, `query count must not grow with the session count (was ${withOne}, now ${count.n})`);
  assert.ok(count.n <= 2, `bounded at two queries, got ${count.n}`);
});

test("two consultations at the same moment keep a stable order", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const at = new Date();
  await prisma.telemedicineSession.updateMany({
    where: { practicePatientLinkId: f.linkA.id },
    data: { scheduledStartAt: at },
  });
  await f.session({
    practiceProfileId: f.practiceA.id,
    linkId: f.linkA.id,
    patientUserId: f.patient.id,
    title: "SAME_MOMENT",
  });
  await prisma.telemedicineSession.updateMany({
    where: { practicePatientLinkId: f.linkA.id },
    data: { scheduledStartAt: at },
  });

  const first = (await listPatientLinkSessions(f.linkA.id, f.patient.id)).map((s) => s.id);
  const second = (await listPatientLinkSessions(f.linkA.id, f.patient.id)).map((s) => s.id);
  assert.deepEqual(first, second, "identical timestamps must not leave order to the database");
});

/* ============================================ Practice side and inbox */

test("the practice-side query is link-aware where it has to be", { skip }, async () => {
  // The practice list is scoped by practice, which is correct for its own
  // overview. What matters is that it does not treat a patient's sessions as
  // interchangeable across relationships: the source must carry the link.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("services/telemedicine/telemedicineService.js", "utf8");
  assert.ok(
    src.includes("practicePatientLinkId: appointment.practicePatientLinkId"),
    "a session created from an appointment must inherit its relationship",
  );
  assert.equal(
    /patientUserId:\s*(String\()?body\.patientUserId/.test(src),
    false,
    "the patient must never be taken from the request body",
  );
});

test("an inbox notice for a consultation leads to the scoped page", { skip }, async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("services/patientInbox/patientInboxContextService.js", "utf8");
  assert.ok(
    /case "telemedicine_session":/.test(src),
    "a consultation notice must have a scoped destination",
  );
  assert.ok(src.includes("${base}/telemedicine"), "and it is built from the authorized link");
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  assert.equal(await prisma.user.count({ where: { email: { contains: SUFFIX } } }), 0);
});
