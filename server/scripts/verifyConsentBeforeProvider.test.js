/**
 * Phase 6b.2 — nothing reaches an external provider without consent.
 *
 * ── What this measures, and why it is measured rather than argued ───────────
 * The consent gate sits in middleware, so reading the code makes it obvious
 * that a refused request never reaches the handler. That argument is worth
 * very little: middleware order changes, a route gets a second mount, someone
 * adds a "quick" endpoint without the guard. What matters is not where the
 * check lives but whether anything actually leaves the machine.
 *
 * So the provider is a real HTTP server on 127.0.0.1 that counts requests, and
 * the feature is pointed at it. The provider gate exempts localhost from its
 * HTTPS requirement precisely so a stub can stand in. Every case below asserts
 * a status AND a request count, and one case deliberately succeeds — a counter
 * that never moves would let every other assertion pass while measuring
 * nothing.
 *
 * ── The fixture ─────────────────────────────────────────────────────────────
 *   Practice A ── Link A1  (the patient's own account)  — thread + message here
 *              └─ Link A2  (a second PatientProfile, same practice, same human)
 *   Practice B ── Link B1  (the same patient, a different practice)
 *
 * A1 vs A2 is the case that separates a boundary drawn at the relationship
 * from one drawn at the practice. Both are asserted, in both directions.
 *
 * No message text is ever sent anywhere: the stub records that a request
 * arrived and answers; it is not a translation service.
 *
 * ── One trap worth naming ───────────────────────────────────────────────────
 * A translation, once produced, is stored and served from storage. So a second
 * request for the SAME message in the SAME language never reaches the provider
 * — and a test reusing one message would read a count of zero and call it
 * proof that the gate held, when in fact the gate had been removed and the
 * answer came from the cache. Every case below therefore gets its own freshly
 * created message. This was not hypothetical: it is what the first version of
 * this suite did, and a double mutation is what exposed it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-consent-provider";
process.env.ENABLE_MESSAGE_TRANSLATION = "true";
process.env.MESSAGE_TRANSLATION_IP_MAX = "10000";
process.env.ENABLE_MESSAGE_STT = "true";
process.env.MESSAGE_STT_IP_MAX = "10000";

/* ── the provider stub: a real listener, so "was it contacted" is observable ─ */

let providerHits = 0;
const providerStub = http.createServer((req, res) => {
  providerHits += 1;
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    // The text is echoed back unchanged as the "translation". The feature
    // refuses output that says more than the source did — a sensible rule, and
    // one a stub answering with a fixed word would trip. Echoing keeps the
    // successful case genuinely successful, which is what makes the counter
    // trustworthy in every other case.
    let source = "";
    try {
      const sent = JSON.parse(raw);
      source = sent?.messages?.find((m) => m.role === "user")?.content ?? "";
    } catch { /* answered below with an empty string */ }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({ sourceLanguage: "de", translatedText: source }),
            },
          },
        ],
      }),
    );
  });
});
await new Promise((r) => providerStub.listen(0, "127.0.0.1", r));

/**
 * The dictation provider gets its own listener and its own counter.
 *
 * Translation is a read; dictation is part of composing a message, and it sits
 * behind a different gate. Two providers and both directions are measured, so
 * a result here is a property of the boundary rather than of one endpoint.
 */
let sttHits = 0;
const sttStub = http.createServer((req, res) => {
  sttHits += 1;
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ text: "diktierter Text", language: "de" }));
});
await new Promise((r) => sttStub.listen(0, "127.0.0.1", r));

process.env.MESSAGE_STT_PROVIDER = "openai";
process.env.MESSAGE_STT_API_KEY = "stub-key-not-a-real-credential";
process.env.MESSAGE_STT_BASE_URL = `http://127.0.0.1:${sttStub.address().port}`;
process.env.MESSAGE_STT_MODEL = "stub-model";

// Pointed at the stub BEFORE the feature is imported, so the configuration it
// resolves is the one under test.
process.env.MESSAGE_TRANSLATION_PROVIDER = "openai";
process.env.MESSAGE_TRANSLATION_API_KEY = "stub-key-not-a-real-credential";
process.env.MESSAGE_TRANSLATION_BASE_URL = `http://127.0.0.1:${providerStub.address().port}`;
process.env.MESSAGE_TRANSLATION_MODEL = "stub-model";

const { prisma } = await import("../lib/prisma.js");
const { requireAuth } = await import("../middleware/requireAuth.js");
const { default: practicePatientsRouter } = await import("../routes/practicePatients.js");

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

const app = express();
app.use(express.json());
app.use("/api/practice/patients", requireAuth, practicePatientsRouter);
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}/api/practice/patients`;

const stamp = `${Date.now()}${crypto.randomInt(1e5)}`;
const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

/* ─────────────────────────────────────────────────────────────── the world */

let W;

async function buildWorld() {
  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `cbp-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });
  const [patient, ownerA, ownerB] = await Promise.all([mk("p"), mk("oa"), mk("ob")]);

  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "A", publicSlug: `cbpa-${stamp}`, isActive: true },
  });
  const practiceB = await prisma.practiceProfile.create({
    data: { userId: ownerB.id, practiceName: "B", publicSlug: `cbpb-${stamp}`, isActive: true },
  });

  await prisma.practiceMember.createMany({
    data: [
      { practiceProfileId: practiceA.id, userId: ownerA.id, role: "owner", status: "active", acceptedAt: new Date() },
      { practiceProfileId: practiceB.id, userId: ownerB.id, role: "owner", status: "active", acceptedAt: new Date() },
    ],
  });

  // The only way to have two relationships with the same practice.
  const relative = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Relative", relationLabel: "child" },
  });

  const mkLink = (pid, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pid,
        patientUserId: patient.id,
        patientProfileId: profileId,
        status: "active",
      },
    });
  const [a1, a2, b1] = await Promise.all([
    mkLink(practiceA.id),
    mkLink(practiceA.id, relative.id),
    mkLink(practiceB.id),
  ]);

  // Consent is granted on every link, so that when a case is refused below it
  // is refused for the reason under test and not incidentally for a missing
  // consent somewhere else.
  await prisma.consentRecord.createMany({
    data: [a1, a2, b1].map((l) => ({
      patientUserId: patient.id,
      practiceProfileId: l.practiceProfileId,
      practicePatientLinkId: l.id,
      consentType: "secure_messaging",
      status: "granted",
    })),
  });

  // One conversation, belonging to A1 and to nothing else.
  const thread = await prisma.practicePatientThread.create({
    data: {
      practicePatientLinkId: a1.id,
      practiceProfileId: practiceA.id,
      patientUserId: patient.id,
      subject: "consent probe",
    },
  });
  const message = await prisma.practicePatientMessage.create({
    data: { threadId: thread.id, senderType: "patient", senderUserId: patient.id, body: "Guten Tag." },
  });

  return { patient, ownerA, ownerB, practiceA, practiceB, a1, a2, b1, thread, message };
}

/**
 * A message nobody has translated yet, in A1's thread.
 *
 * Each case creates its own, so a stored translation from an earlier case can
 * never be what makes the provider counter read zero.
 */
async function freshMessage() {
  const m = await prisma.practicePatientMessage.create({
    data: {
      threadId: W.thread.id,
      senderType: "patient",
      senderUserId: W.patient.id,
      body: `Guten Tag, Nachricht ${crypto.randomUUID()}.`,
    },
  });
  return m.id;
}

/** Asks for a translation as `actor`, through `linkId`, of a message in A1's thread. */
async function translate(actorUserId, linkId, threadId = W.thread.id, messageId = null) {
  messageId = messageId ?? (await freshMessage());
  const before = providerHits;
  const res = await fetch(`${base}/${linkId}/threads/${threadId}/messages/${messageId}/translation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(actorUserId)}` },
    body: JSON.stringify({ targetLanguage: "en", mode: "normal" }),
  });
  return { status: res.status, body: await res.json().catch(() => null), hits: providerHits - before };
}

/** A structurally valid WAV of 2 KiB: header, then silence. */
function wavBytes(samples = 1024) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples * 2, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples * 2, 40);
  return Buffer.concat([header, Buffer.alloc(samples * 2)]);
}

/** Dictates into a thread as `actor`, through `linkId`. */
async function dictate(actorUserId, linkId, threadId = null) {
  const before = sttHits;
  const form = new FormData();
  // A real WAV header followed by enough silence to clear the minimum length
  // the feature enforces. Content is irrelevant — the stub never listens to it
  // — but the file has to be accepted for the successful case to be genuine.
  form.append("audio", new Blob([wavBytes()], { type: "audio/wav" }), "note.wav");
  form.append("language", "de");
  const res = await fetch(`${base}/${linkId}/threads/${threadId ?? W.thread.id}/dictation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token(actorUserId)}` },
    body: form,
  });
  return { status: res.status, body: await res.json().catch(() => null), hits: sttHits - before };
}

/** Sets a link's consent for messaging to a given status. */
const setConsent = (linkId, status) =>
  prisma.consentRecord.updateMany({
    where: { practicePatientLinkId: linkId, consentType: "secure_messaging" },
    data: { status, revokedAt: status === "revoked" ? new Date() : null },
  });

test.before(async () => {
  if (!dbAvailable) return;
  W = await buildWorld();
});

test.after(async () => {
  if (dbAvailable) {
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } });
    await prisma.$disconnect();
  }
  server.close();
  providerStub.close();
  sttStub.close();
});

/* ────────────────────────────────────────── the instrument proves itself */

test("with consent and the right link, the provider IS contacted", { skip }, async () => {
  const r = await translate(W.ownerA.id, W.a1.id);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.hits, 1, "the counter moves when it should — every zero below means something");
});

/* ────────────────────────────────────────────────── consent is the gate */

test("consent revoked: refused, and nothing leaves the machine", { skip }, async () => {
  await setConsent(W.a1.id, "revoked");
  try {
    const r = await translate(W.ownerA.id, W.a1.id);
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "consent_required");
    assert.equal(r.hits, 0, "no request reached the provider");
  } finally {
    await setConsent(W.a1.id, "granted");
  }
});

test("consent never granted: refused, and nothing leaves the machine", { skip }, async () => {
  await prisma.consentRecord.deleteMany({
    where: { practicePatientLinkId: W.a1.id, consentType: "secure_messaging" },
  });
  try {
    const r = await translate(W.ownerA.id, W.a1.id);
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "consent_required");
    assert.equal(r.hits, 0);
  } finally {
    await prisma.consentRecord.create({
      data: {
        patientUserId: W.patient.id,
        practiceProfileId: W.practiceA.id,
        practicePatientLinkId: W.a1.id,
        consentType: "secure_messaging",
        status: "granted",
      },
    });
  }
});

test("consent expired: refused, and nothing leaves the machine", { skip }, async () => {
  await prisma.consentRecord.updateMany({
    where: { practicePatientLinkId: W.a1.id, consentType: "secure_messaging" },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  try {
    const r = await translate(W.ownerA.id, W.a1.id);
    assert.equal(r.status, 403);
    assert.equal(r.hits, 0);
  } finally {
    await prisma.consentRecord.updateMany({
      where: { practicePatientLinkId: W.a1.id, consentType: "secure_messaging" },
      data: { expiresAt: null, status: "granted", revokedAt: null },
    });
  }
});

/* ──────────────────────────────────────────────── the link is the boundary */

test("same practice, different link: refused, and nothing leaves the machine", { skip }, async () => {
  // A2 is the same practice and the same human. A boundary drawn at the
  // practice would let this through.
  const r = await translate(W.ownerA.id, W.a2.id);
  assert.notEqual(r.status, 200, "A1's message is not A2's to read");
  assert.equal(r.hits, 0);
});

test("a different practice cannot translate this message", { skip }, async () => {
  const r = await translate(W.ownerB.id, W.b1.id);
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0);
});

test("a practice member of B cannot borrow A's link id", { skip }, async () => {
  const r = await translate(W.ownerB.id, W.a1.id);
  // 404 rather than 403: an outsider is not told that the link exists at all,
  // which is the stronger of the two answers. Pinned so a later change to a
  // more talkative status has to be a deliberate one.
  assert.equal(r.status, 404);
  assert.equal(r.hits, 0);
});

test("the patient's own id is not a practice credential", { skip }, async () => {
  const r = await translate(W.patient.id, W.a1.id);
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0);
});

test("an unrelated message id is not reachable through an authorized link", { skip }, async () => {
  const r = await translate(W.ownerA.id, W.a1.id, W.thread.id, "cl00000000000000000000000");
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0);
});

test("a thread id that belongs to nobody is refused", { skip }, async () => {
  const r = await translate(W.ownerA.id, W.a1.id, "cl00000000000000000000000", await freshMessage());
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0);
});

test("no authorization at all: refused before anything is read", { skip }, async () => {
  const before = providerHits;
  const res = await fetch(
    `${base}/${W.a1.id}/threads/${W.thread.id}/messages/${await freshMessage()}/translation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage: "en", mode: "normal" }),
    },
  );
  assert.equal(res.status, 401);
  assert.equal(providerHits - before, 0);
});

test("an inactive link is refused even with consent on file", { skip }, async () => {
  await prisma.practicePatientLink.update({ where: { id: W.a1.id }, data: { status: "revoked" } });
  try {
    const r = await translate(W.ownerA.id, W.a1.id);
    assert.notEqual(r.status, 200);
    assert.equal(r.hits, 0);
  } finally {
    await prisma.practicePatientLink.update({ where: { id: W.a1.id }, data: { status: "active" } });
  }
});

/* ────────────────────────────────── a second provider, and a write path */

test("dictation with consent reaches its provider", { skip }, async () => {
  const r = await dictate(W.ownerA.id, W.a1.id);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.hits, 1, "this counter moves too — the zeros below mean something");
});

test("dictation with consent revoked reaches nothing", { skip }, async () => {
  await setConsent(W.a1.id, "revoked");
  try {
    const r = await dictate(W.ownerA.id, W.a1.id);
    assert.equal(r.status, 403);
    assert.equal(r.hits, 0, "no audio left the machine");
  } finally {
    await setConsent(W.a1.id, "granted");
  }
});

test("dictation through the wrong link of the same practice reaches nothing", { skip }, async () => {
  const r = await dictate(W.ownerA.id, W.a2.id);
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0);
});

test("dictation by another practice reaches nothing", { skip }, async () => {
  const r = await dictate(W.ownerB.id, W.a1.id);
  assert.equal(r.status, 404);
  assert.equal(r.hits, 0);
});

test("the patient cannot dictate through the practice endpoint", { skip }, async () => {
  const r = await dictate(W.patient.id, W.a1.id);
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0);
});
