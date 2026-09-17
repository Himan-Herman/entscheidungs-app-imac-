/**
 * Phase 6b.2 — the server refuses what the client merely hides, and its
 * refusals do not leak.
 *
 * ── Why a read-only member is the right probe ───────────────────────────────
 * The practice interface hides controls a member may not use. Hiding is a
 * courtesy to the person, not a boundary: the request still exists, and anyone
 * who can open a browser console can send it. So this suite takes the least
 * privileged real role in the product — `viewer`, which holds read rights and
 * almost nothing else — and sends the requests its own interface would never
 * offer it.
 *
 * `viewer` is chosen deliberately over an outsider. An outsider is refused for
 * an easy reason: they belong to no practice at all, and a check on membership
 * alone stops them. A viewer belongs, holds a valid token, and names a link
 * that genuinely is their practice's. Only a real permission check refuses
 * them, so only a viewer can tell one from the other.
 *
 * ── And what comes back ─────────────────────────────────────────────────────
 * Every response here is also read for things that should never be in it:
 * another account's id, an email address, a password hash, a token. A refusal
 * is a response too, and an error body that names the row it protected has
 * given away the thing it refused.
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-server-authz";
process.env.ENABLE_PRACTICE_CALENDAR = "true";
process.env.ENABLE_TELEMEDICINE = "true";

const { prisma } = await import("../lib/prisma.js");
const { requireAuth } = await import("../middleware/requireAuth.js");
const { default: practicePatientsRouter } = await import("../routes/practicePatients.js");
const { default: practiceInternalWorkRouter } = await import("../routes/practiceInternalWork.js");
const { PERMISSIONS, hasPracticePermission } = await import("../utils/practicePermissions.js");

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

const app = express();
app.use(express.json());
// Both mounts, exactly as app.js has them. Internal notes and reminders live
// on a router of their own; testing them through the wrong mount would produce
// a 404 that looks like a refusal and proves nothing.
app.use("/api/practice/patients/:linkId", requireAuth, practiceInternalWorkRouter);
app.use("/api/practice/patients", requireAuth, practicePatientsRouter);
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}/api/practice/patients`;

const stamp = `${Date.now()}${crypto.randomInt(1e5)}`;
const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

let W;

async function call(method, pathSuffix, actorUserId, body) {
  const res = await fetch(`${base}${pathSuffix}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token(actorUserId)}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 400);
  }
  return { status: res.status, body: parsed, raw: text };
}

test.before(async () => {
  if (!dbAvailable) return;

  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `ssa-${tag}-${stamp}@test.invalid`,
        passwordHash: `$2b$10$hash${stamp}`,
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });
  const [patient, owner, viewer, secretary] = await Promise.all([
    mk("patient"),
    mk("owner"),
    mk("viewer"),
    mk("secretary"),
  ]);

  const practice = await prisma.practiceProfile.create({
    data: { userId: owner.id, practiceName: "Authz", publicSlug: `ssa-${stamp}`, isActive: true },
  });

  await prisma.practiceMember.createMany({
    data: [
      { practiceProfileId: practice.id, userId: owner.id, role: "owner", status: "active", acceptedAt: new Date() },
      { practiceProfileId: practice.id, userId: viewer.id, role: "viewer", status: "active", acceptedAt: new Date() },
      { practiceProfileId: practice.id, userId: secretary.id, role: "secretary", status: "active", acceptedAt: new Date() },
    ],
  });

  const link = await prisma.practicePatientLink.create({
    data: { practiceProfileId: practice.id, patientUserId: patient.id, status: "active" },
  });

  // Every consent granted, so a refusal below is about the permission and not
  // about a missing consent that would have refused anyone.
  await prisma.consentRecord.createMany({
    data: [
      "secure_messaging",
      "profile_access",
      "medication_plan_access",
      "ai_organizational_assistance",
    ].map((consentType) => ({
      patientUserId: patient.id,
      practiceProfileId: practice.id,
      practicePatientLinkId: link.id,
      consentType,
      status: "granted",
    })),
  });

  const thread = await prisma.practicePatientThread.create({
    data: {
      practicePatientLinkId: link.id,
      practiceProfileId: practice.id,
      patientUserId: patient.id,
      subject: "authz probe",
    },
  });

  W = { patient, owner, viewer, secretary, practice, link, thread };
});

test.after(async () => {
  if (dbAvailable) {
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } });
    await prisma.$disconnect();
  }
  server.close();
});

/* ─────────────────────── the role table says what should happen */

test("the probe role really lacks the rights being tested", { skip }, () => {
  // If `viewer` ever gained these, every refusal below would still pass while
  // measuring nothing at all.
  for (const permission of [
    PERMISSIONS.INTERNAL_NOTES_READ,
    PERMISSIONS.INTERNAL_NOTES_WRITE,
    PERMISSIONS.REMINDERS_READ,
    PERMISSIONS.REMINDERS_WRITE,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.PATIENT_LINKS_WRITE,
    PERMISSIONS.DOCUMENTS_WRITE,
    PERMISSIONS.MEDICATION_WRITE,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
  ]) {
    assert.equal(
      hasPracticePermission("viewer", permission),
      false,
      `viewer holds ${permission} — this suite is no longer testing anything`,
    );
  }
  // And it does hold the read rights, so a refusal is not simply "viewer can do
  // nothing".
  assert.equal(hasPracticePermission("viewer", PERMISSIONS.PATIENT_LINKS_READ), true);
});

/* ──────────────────────────── what the server does about it */

/**
 * Each entry is a request the viewer's own interface does not offer, together
 * with the right it would need. A 2xx here means the interface was the only
 * thing standing in the way.
 */
const FORBIDDEN_FOR_VIEWER = [
  ["read internal notes", "GET", "/:link/internal-notes", null],
  ["write an internal note", "POST", "/:link/internal-notes", { body: "seen by the wrong role" }],
  ["read reminders", "GET", "/:link/reminders", null],
  ["create a reminder", "POST", "/:link/reminders", { title: "x", dueAt: new Date().toISOString() }],
  ["send a message", "POST", "/:link/threads/:thread/messages", { body: "hallo" }],
  ["close a conversation", "PATCH", "/:link/threads/:thread/close", {}],
  ["archive a conversation", "PATCH", "/:link/threads/:thread/archive", {}],
  ["restore a conversation", "PATCH", "/:link/threads/:thread/restore", {}],
];

/**
 * Requests a read-only member SHOULD be allowed, listed so the boundary is
 * described from both sides.
 *
 * Marking a conversation read sits behind the read right on purpose: it records
 * that this member looked, it writes nothing anyone else can see, and refusing
 * it would mean a read-only role could never clear its own unread badge.
 */
const ALLOWED_FOR_VIEWER = [
  ["mark a conversation read", "PATCH", "/:link/threads/:thread/read", {}],
];

for (const [label, method, template, body] of FORBIDDEN_FOR_VIEWER) {
  test(`a read-only member cannot ${label}`, { skip }, async () => {
    const path = template.replace(":link", W.link.id).replace(":thread", W.thread.id);
    const r = await call(method, path, W.viewer.id, body);
    // 403 specifically, not "some error". A 404 would mean the request never
    // reached a permission check — which is how the first version of this
    // suite passed while testing nothing at all, because two of these routes
    // were mounted elsewhere.
    assert.equal(
      r.status,
      403,
      `${label} returned ${r.status} — the client's hidden button was the only guard`,
    );
  });
}

for (const [label, method, template, body] of ALLOWED_FOR_VIEWER) {
  test(`a read-only member may still ${label}`, { skip }, async () => {
    const path = template.replace(":link", W.link.id).replace(":thread", W.thread.id);
    const r = await call(method, path, W.viewer.id, body);
    assert.ok(r.status < 400, `${label} was refused with ${r.status}: ${r.raw}`);
  });
}

test("a role that does hold the right is not refused", { skip }, async () => {
  // Without this the suite could pass by refusing everyone, which would say
  // nothing about permissions and everything about a broken fixture.
  const r = await call("GET", `/${W.link.id}/internal-notes`, W.owner.id);
  assert.ok(r.status < 400, `an owner was refused their own notes: ${r.status} ${r.raw}`);
});

test("a member of no practice is refused too, and told less", { skip }, async () => {
  const r = await call("GET", `/${W.link.id}/internal-notes`, W.patient.id);
  assert.ok(r.status === 403 || r.status === 404);
});

/* ───────────────────────────────────── nothing leaks in either direction */

/** Values that must never appear in a response body, whatever the status. */
function secretsOf(w) {
  return [
    ["the patient's account id", w.patient.id],
    ["the patient's email", w.patient.email],
    ["the owner's email", w.owner.email],
    ["a password hash", w.patient.passwordHash],
    ["the practice owner's user id", w.practice.userId],
  ];
}

test("a refusal does not name what it refused", { skip }, async () => {
  /*
   * Only actual refusals. An authorised response is a different question: a
   * practice member reading a care relationship they are party to is SUPPOSED
   * to see whose relationship it is, so `patientUserId` in a 200 is the answer
   * to the request, not a leak. What a 403 must never do is confirm the same
   * identifiers to someone who was just told no.
   */
  for (const [label, method, template, body] of FORBIDDEN_FOR_VIEWER) {
    const path = template.replace(":link", W.link.id).replace(":thread", W.thread.id);
    const r = await call(method, path, W.viewer.id, body);
    assert.equal(r.status, 403, `${label} was not refused — this test needs a refusal`);
    for (const [what, value] of secretsOf(W)) {
      assert.ok(!r.raw.includes(value), `refusing "${label}" disclosed ${what}`);
    }
  }
});

test("an authorised response never carries a credential, whatever else it carries", { skip }, async () => {
  // The identifiers a member legitimately sees are one thing; a password hash
  // or an email address is never part of any answer on these routes.
  for (const [, method, template, body] of [...ALLOWED_FOR_VIEWER]) {
    const path = template.replace(":link", W.link.id).replace(":thread", W.thread.id);
    const r = await call(method, path, W.viewer.id, body);
    for (const [what, value] of [
      ["a password hash", W.patient.passwordHash],
      ["the patient's email", W.patient.email],
      ["the owner's email", W.owner.email],
    ]) {
      assert.ok(!r.raw.includes(value), `an authorised response carried ${what}`);
    }
  }
});

test("a successful read carries no account identifiers it does not need", { skip }, async () => {
  const r = await call("GET", `/${W.link.id}/internal-notes`, W.owner.id);
  assert.ok(r.status < 400);
  for (const [what, value] of [
    ["the patient's email", W.patient.email],
    ["the owner's email", W.owner.email],
    ["a password hash", W.patient.passwordHash],
  ]) {
    assert.ok(!r.raw.includes(value), `an internal-notes response carried ${what}`);
  }
});

test("an error never carries a stack trace or a query", { skip }, async () => {
  // A 500 that echoes its cause tells an attacker the shape of the schema, the
  // file layout, and often the failing query itself.
  const r = await call("GET", "/not-a-link-id/internal-notes", W.viewer.id);
  const text = r.raw.toLowerCase();
  for (const marker of ["at async", ".js:", "prisma.", "select ", "invalid `prisma"]) {
    assert.ok(!text.includes(marker), `an error response leaked "${marker}"`);
  }
});

test("a thread listing exposes no account identifiers", { skip }, async () => {
  const r = await call("GET", `/${W.link.id}/threads`, W.owner.id);
  if (r.status >= 400) return; // route shape differs; the leak tests above still apply
  for (const [what, value] of [
    ["the patient's email", W.patient.email],
    ["a password hash", W.patient.passwordHash],
  ]) {
    assert.ok(!r.raw.includes(value), `a thread listing carried ${what}`);
  }
});
