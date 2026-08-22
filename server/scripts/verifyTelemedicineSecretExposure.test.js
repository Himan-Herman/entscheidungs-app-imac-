/**
 * A meeting URL must never be derivable outside an authorized join.
 *
 * For the sandbox provider the meeting URL is
 * `https://meet.jit.si/MedScoutX-<providerRoomId>`. The room id is therefore a
 * bearer secret in everything but name: whoever holds it can enter the room
 * without passing the join endpoint, which is where consent, revocation and
 * ownership are checked.
 *
 * Phase 2G.2 removed it from the practice-context response. This suite pins the
 * rule down for EVERY patient- and practice-facing response, so the next
 * serializer added to this feature cannot quietly reintroduce it.
 *
 * Runs against the REAL database. Skips when none is reachable.
 *
 * Run: node --test scripts/verifyTelemedicineSecretExposure.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  getPatientSession,
  grantPatientConsent,
  listPatientSessions,
  patientJoinWaitingRoom,
} from "../services/telemedicine/telemedicineService.js";
import { listPatientLinkSessions } from "../services/telemedicine/telemedicineContextService.js";
import { listPatientLinkInboxItems } from "../services/patientInbox/patientInboxContextService.js";

const SUFFIX = "tele-secret@test.invalid";
/** Recognisable enough that a substring search cannot miss it. */
const ROOM_SECRET = "msx-BEARERSECRET-do-not-leak";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

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
  const owner = await mk("o");

  const practice = await prisma.practiceProfile.create({
    data: {
      userId: owner.id,
      practiceName: "PraxisSecret",
      publicSlug: `sec-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    },
  });
  const link = await prisma.practicePatientLink.create({
    data: {
      practiceProfileId: practice.id,
      patientUserId: patient.id,
      status: "active",
      consentScopes: ["telemedicine"],
      consentAcceptedAt: new Date(),
    },
  });

  const session = await prisma.telemedicineSession.create({
    data: {
      practiceProfileId: practice.id,
      practicePatientLinkId: link.id,
      patientUserId: patient.id,
      providerType: "sandbox",
      status: "planned",
      title: "SECRET_PROBE",
      scheduledStartAt: new Date(Date.now() + 3600_000),
      joinUrlHash: "jh-secret-probe",
      hostUrlHash: "hh-secret-probe",
      providerRoomId: ROOM_SECRET,
      consentVersion: "1",
    },
  });

  await prisma.patientInboxItem.create({
    data: {
      patientUserId: patient.id,
      practiceProfileId: practice.id,
      practicePatientLinkId: link.id,
      type: "system",
      title: "Videosprechstunde",
      titleKey: "telemedicine_waiting",
      status: "unread",
      sourceRefType: "telemedicine_session",
      sourceRefId: session.id,
      dedupeKey: `secret-probe-${session.id}`,
      lastActivityAt: new Date(),
    },
  });

  return { patient, owner, practice, link, session };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  const practices = await prisma.practiceProfile.findMany({
    where: { userId: { in: ids } },
    select: { id: true },
  });
  await prisma.telemedicineSession.deleteMany({
    where: { practiceProfileId: { in: practices.map((p) => p.id) } },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

/** Everything that would let a reader reconstruct the meeting URL. */
function assertNoMeetingSecret(payload, where) {
  const serialized = JSON.stringify(payload);
  for (const forbidden of [ROOM_SECRET, "providerRoomId", "meet.jit.si", "MedScoutX-msx", "joinUrlHash", "hostUrlHash"]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `${where} must not carry "${forbidden}" — it reconstructs the meeting URL`,
    );
  }
}

/* ============================================ A — list / overview responses */

test("the cross-practice list carries no meeting secret", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const sessions = await listPatientSessions(f.patient.id);
  // Precondition: the session really is in this response.
  assert.ok(sessions.some((s) => s.title === "SECRET_PROBE"), "the probe session is listed");
  assertNoMeetingSecret(sessions, "the cross-practice list");
});

test("the practice-context list carries no meeting secret", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const sessions = await listPatientLinkSessions(f.link.id, f.patient.id);
  assert.ok(sessions.some((s) => s.title === "SECRET_PROBE"));
  assertNoMeetingSecret(sessions, "the practice-context list");
});

/* ================================== B — detail response, before any join */

test("the cross-practice detail carries no meeting secret", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const session = await getPatientSession(f.patient.id, f.session.id);
  assert.equal(session.title, "SECRET_PROBE", "the probe session is returned");
  assert.equal(session.hasJoinLink, true, "and the page can still tell a link exists");
  assertNoMeetingSecret(session, "the cross-practice detail");
});

/* ================================================= C — the authorized join */

test("consent is still required before a meeting URL is issued", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => patientJoinWaitingRoom(f.patient.id, f.session.id, {}),
    /consent_required/,
    "the gate this whole rule exists to protect must still hold",
  );
});

test("an authorized join still returns a working meeting URL", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await grantPatientConsent(f.patient.id, f.session.id);
  const result = await patientJoinWaitingRoom(f.patient.id, f.session.id, {});

  assert.ok(result.joinUrl, "the join call is the one place a URL is handed out");
  assert.ok(
    result.joinUrl.includes(ROOM_SECRET),
    "and it is still the real room — removing the field must not have broken the flow",
  );
  // The session payload that travels alongside it stays clean.
  assertNoMeetingSecret(result.session, "the session object returned by join");
});

test("a revoked link yields no meeting URL even after consent", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await grantPatientConsent(f.patient.id, f.session.id);
  await prisma.telemedicineSession.update({
    where: { id: f.session.id },
    data: { linkRevokedAt: new Date() },
  });

  await assert.rejects(
    () => patientJoinWaitingRoom(f.patient.id, f.session.id, {}),
    /link_revoked/,
  );
});

/* ======================================================== D — practice host */

test("the practice host flow still has its own URL path", { skip }, async () => {
  // Removing the field from the shared serializer must not have taken the host
  // URL with it: it is built from the Prisma row, not from the payload.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("services/telemedicine/telemedicineService.js", "utf8");

  assert.ok(
    /const hostUrl = getVideoAdapter\(row\.providerType\)\.getHostUrl\(/.test(src),
    "the host URL must still be derived for the practice flow",
  );
  assert.ok(
    /return \{ session: sessionToJson\(row, \{ includeParticipants: true \} \), hostUrl \}/.test(src) ||
      src.includes("hostUrl };"),
    "and still returned to the practice",
  );
  assert.equal(
    /providerRoomId: row\.providerRoomId,\s*$/m.test(src.slice(0, src.indexOf("function trimText") >>> 0 || src.length)),
    false,
    "but never through the serializer",
  );
});

/* ================================================================ Inbox */

test("a telemedicine inbox notice carries no meeting secret", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const { items } = await listPatientLinkInboxItems(f.link.id, f.patient.id);
  const notice = items.find((i) => i.titleKey === "telemedicine_waiting");
  assert.ok(notice, "the probe notice is listed");
  assert.equal(
    notice.targetPath,
    `/patient/practice/${f.link.id}/telemedicine`,
    "it navigates to the scoped page",
  );
  assertNoMeetingSecret(items, "a telemedicine inbox notice");
});

/* ========================================= The serializer itself, pinned */

test("no serializer in this feature returns the room id", { skip }, async () => {
  // A source-level guard as well as the behavioural ones above: a new response
  // shape added later would otherwise have to be caught by someone noticing.
  const { readFileSync, readdirSync } = await import("node:fs");

  const offenders = [];
  for (const dir of ["services/telemedicine", "routes"]) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;
      if (!/telemedicine/i.test(file) && dir === "routes") continue;
      // The adapter legitimately produces the room id; it is the boundary.
      if (file === "videoProviderAdapter.js") continue;

      const src = readFileSync(`${dir}/${file}`, "utf8");

      for (const m of src.matchAll(/providerRoomId:\s*(row|session|r)\.providerRoomId/g)) {
        // Passing the room id INTO the adapter is how a URL gets built at all —
        // that is the legitimate use and happens inside getJoinUrl/getHostUrl/
        // checkStatus calls. What must not exist is the same assignment inside a
        // payload returned to a caller.
        const before = src.slice(Math.max(0, m.index - 200), m.index);
        const intoAdapter = /(getJoinUrl|getHostUrl|checkStatus)\(\s*$/.test(
          before.replace(/\s+$/, "").replace(/\{\s*$/, "") + "(",
        ) || /(getJoinUrl|getHostUrl|checkStatus)\([\s\S]*$/.test(before);
        if (!intoAdapter) offenders.push(`${dir}/${file}: ${m[0]}`);
      }
    }
  }

  assert.deepEqual(offenders, [], "these hand the room id to a caller");

  // Vacuity check: the scan must actually be looking at the file that used to
  // contain the offending line, or it would pass on any path mistake.
  const service = readFileSync("services/telemedicine/telemedicineService.js", "utf8");
  assert.ok(
    service.includes("providerRoomId: row.providerRoomId"),
    "the legitimate adapter calls still exist — otherwise this test proves nothing",
  );
  assert.equal(
    /providerRoomId: row\.providerRoomId,\n\s*hasJoinLink/.test(service),
    false,
    "and the serializer no longer carries it",
  );
});

test("the provider create-room endpoint does not hand out the room id", { skip }, async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("routes/telemedicineProvider.js", "utf8");
  assert.equal(
    /providerRoomId:\s*room\.providerRoomId/.test(src),
    false,
    "any authenticated user can call this endpoint; it must not return the room id",
  );
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  assert.equal(await prisma.user.count({ where: { email: { contains: SUFFIX } } }), 0);
});
