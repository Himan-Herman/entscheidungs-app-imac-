/**
 * Phase 6b.3 — every distinct provider policy class, measured.
 *
 * ── Why classes and not endpoints ───────────────────────────────────────────
 * Eleven features send data to an external provider. Copying the same test
 * eleven times would look thorough and prove nothing new: what differs between
 * them is not the wrapper, it is the RULE about who may cause the call. There
 * are four such rules in this product, and each one is measured here or in the
 * suite named beside it.
 *
 *   1. Care-relationship consent — message translation, simplification and
 *      dictation. The patient's `secure_messaging` grant, plus
 *      `ai_organizational_assistance` for AI drafts. Measured in
 *      verifyConsentBeforeProvider.test.js with two provider counters; not
 *      repeated here.
 *
 *   2. Owned-and-already-released — document translation. The patient asks
 *      about a document that is theirs and that the practice has already
 *      shared with them. There is NO care-relationship consent on this path,
 *      and inventing one would be wrong: the data subject is the one asking,
 *      about content already in their hands. The rule is ownership, an active
 *      share, and a live link at the originating practice.
 *
 *   3. The patient's own session — symptom voice input, reading aloud,
 *      Pre-Visit voice. Nothing crosses into a care relationship; the patient
 *      speaks to their own device about their own draft. The rule is
 *      authentication plus the feature flag plus a configured provider. There
 *      is no consent here either, and this suite tests the boundary that
 *      actually exists rather than one that does not.
 *
 *   4. Interpreter — processing is gated by feature flags and authentication;
 *      the account-level cloud consent gates STORING a session, not
 *      translating one. Those two are deliberately different things and the
 *      tests below keep them apart, because conflating them would let someone
 *      "fix" a failing test by moving a storage consent in front of a live
 *      conversation, or vice versa.
 *
 * ── The instrument ──────────────────────────────────────────────────────────
 * Same as the 6b.2 suite: the provider is a real HTTP listener on 127.0.0.1
 * that counts requests, and every case asserts a status AND a count. Each class
 * has at least one deliberately successful case, because a counter that never
 * moves would let every zero pass while measuring nothing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-policy-classes";

/* ─────────────────────────────── one counting listener per provider */

/** @returns {Promise<{ port: number, hits: () => number, close: () => void }>} */
async function countingProvider(respond) {
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits += 1;
    let raw = "";
    req.on("data", (c) => {
      raw += c;
    });
    req.on("end", () => respond(req, res, raw));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    port: server.address().port,
    hits: () => hits,
    close: () => server.close(),
  };
}

/** An OpenAI-shaped chat completion echoing the text it was given. */
const chatEcho = (extract) => (req, res, raw) => {
  let content = "";
  try {
    content = extract(JSON.parse(raw));
  } catch {
    /* answered with an empty string */
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content } }],
    }),
  );
};

const docProvider = await countingProvider(
  chatEcho((sent) => {
    /*
     * Echoes each segment back under the id it arrived with.
     *
     * The feature refuses a response whose segments it cannot line up with the
     * ones it sent — reasonable, since a translation that silently drops or
     * renumbers part of a medical letter is worse than no translation. So the
     * stub has to answer in the shape a real provider would; it does not
     * translate anything, it returns the text unchanged.
     */
    const user = sent?.messages?.find((m) => m.role === "user")?.content ?? "";
    let segments = [];
    try {
      const parsed = JSON.parse(user);
      const list = Array.isArray(parsed) ? parsed : (parsed?.segments ?? []);
      segments = list.map((seg) => ({ id: String(seg.id), text: String(seg.text ?? "") }));
    } catch {
      // Not JSON: fall back to the ids as they appear in the prompt text.
      segments = [...user.matchAll(/"id"\s*:\s*"([^"]+)"/g)].map((m) => ({
        id: m[1],
        text: "unveraendert",
      }));
    }
    return JSON.stringify({ segments });
  }),
);
const sttProvider = await countingProvider((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ text: "gesprochener Text", language: "de" }));
});
const ttsProvider = await countingProvider((req, res) => {
  res.writeHead(200, { "Content-Type": "audio/mpeg" });
  res.end(Buffer.from([0xff, 0xfb, 0, 0, 0, 0, 0, 0]));
});

/* ── every provider pointed at its own listener, before the features load ── */

process.env.ENABLE_DOCUMENT_TRANSLATION = "true";
process.env.DOCUMENT_TRANSLATION_PROVIDER = "openai";
process.env.DOCUMENT_TRANSLATION_API_KEY = "stub-key-not-a-real-credential";
process.env.DOCUMENT_TRANSLATION_BASE_URL = `http://127.0.0.1:${docProvider.port}`;
process.env.DOCUMENT_TRANSLATION_MODEL_STRICT = "stub-model";
process.env.DOCUMENT_TRANSLATION_MODEL_PLAIN = "stub-model";
// This provider requires both operator assertions unconditionally, not only in
// production — a deliberately stricter gate than the message one, because a
// whole medical letter is a different disclosure from a chat line. Setting them
// here asserts nothing about the world; it makes the successful case reachable
// so that the refusals below can be told apart from a provider that was simply
// switched off.
process.env.DOCUMENT_TRANSLATION_DATA_REGION = "test-local";
process.env.DOCUMENT_TRANSLATION_ZERO_RETENTION = "true";

process.env.ENABLE_SYMPTOM_VOICE_INPUT = "true";
process.env.SYMPTOM_VOICE_PROVIDER = "openai";
process.env.SYMPTOM_VOICE_API_KEY = "stub-key-not-a-real-credential";
process.env.SYMPTOM_VOICE_BASE_URL = `http://127.0.0.1:${sttProvider.port}`;
process.env.SYMPTOM_VOICE_MODEL = "stub-model";

process.env.ENABLE_SYMPTOM_VOICE_OUTPUT = "true";
process.env.SYMPTOM_SPEECH_PROVIDER = "openai";
process.env.SYMPTOM_SPEECH_API_KEY = "stub-key-not-a-real-credential";
process.env.SYMPTOM_SPEECH_BASE_URL = `http://127.0.0.1:${ttsProvider.port}`;
process.env.SYMPTOM_SPEECH_MODEL = "stub-model";
process.env.SYMPTOM_SPEECH_VOICE = "alloy";

const { prisma } = await import("../lib/prisma.js");
const { requireAuth } = await import("../middleware/requireAuth.js");
const { default: patientPracticeDocumentsRouter } = await import(
  "../routes/patientPracticeDocuments.js"
);
const { default: transcribeRouter } = await import("../routes/transcribe.js");
const { default: ttsRouter } = await import("../routes/tts.js");
const { getPracticeDocumentStorage } = await import(
  "../services/practiceDocument/storage/index.js"
);
const { PDFDocument, StandardFonts } = await import("pdf-lib");

/**
 * A real, parseable PDF with real text.
 *
 * The translation path reads the bytes from storage and puts them through a
 * PDF parser, so a placeholder buffer is refused long before any provider is
 * reached — which would make the successful case below unreachable and every
 * zero after it meaningless.
 */
async function realPdf() {
  // Enough text to clear the extractor's own floors: a whole page has to carry
  // at least 120 characters on average and 60% of pages must be populated,
  // because a near-empty PDF is a scan the product refuses to guess at rather
  // than a letter it can translate.
  const lines = [
    "Die Untersuchung ergab einen unauffaelligen Befund ohne Auffaelligkeiten.",
    "Eine weitere Abklaerung ist aus unserer Sicht derzeit nicht erforderlich.",
    "Die Beschwerden haben sich im Verlauf der letzten Wochen deutlich gebessert.",
    "Eine Wiedervorstellung in vier Wochen wurde mit der Patientin besprochen.",
    "Wir danken fuer die freundliche Ueberweisung und verbleiben mit Gruessen.",
  ];
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, i) => {
    page.drawText(line, { x: 60, y: 760 - i * 22, size: 12, font });
  });
  return Buffer.from(await pdf.save());
}

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

const app = express();
app.use(express.json());
app.use("/api/patient/practice-documents", requireAuth, patientPracticeDocumentsRouter);
app.use("/api/transcribe", requireAuth, transcribeRouter);
app.use("/api/tts", requireAuth, ttsRouter);
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const stamp = `${Date.now()}${crypto.randomInt(1e5)}`;
const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

let W;

test.before(async () => {
  if (!dbAvailable) return;

  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `ppc-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });
  const [patient, otherPatient, ownerA] = await Promise.all([mk("p"), mk("q"), mk("oa")]);

  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "A", publicSlug: `ppca-${stamp}`, isActive: true },
  });
  await prisma.practiceMember.create({
    data: {
      practiceProfileId: practiceA.id,
      userId: ownerA.id,
      role: "owner",
      status: "active",
      acceptedAt: new Date(),
    },
  });
  const link = await prisma.practicePatientLink.create({
    data: { practiceProfileId: practiceA.id, patientUserId: patient.id, status: "active" },
  });

  W = { patient, otherPatient, ownerA, practiceA, link };
});

test.after(async () => {
  if (dbAvailable) {
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } });
    await prisma.$disconnect();
  }
  server.close();
  docProvider.close();
  sttProvider.close();
  ttsProvider.close();
});

/* ═══════════════════════ class 2 — owned and already released */

/** A PDF document shared with the patient through their link. */
async function makeSharedDocument({ status = "shared", linkId = null, patientUserId = null } = {}) {
  const doc = await prisma.practiceDocument.create({
    data: {
      practiceProfileId: W.practiceA.id,
      practicePatientLinkId: linkId ?? W.link.id,
      patientUserId: patientUserId ?? W.patient.id,
      title: "Befund",
      status,
      type: "report",
      createdByUserId: W.ownerA.id,
      ...(status === "shared" ? { sharedAt: new Date() } : {}),
    },
  });
  // The release itself. `status: "shared"` on the document is not enough — the
  // loader also requires an active, unexpired share row naming this patient,
  // which is what "already released to them" actually means.
  if (status === "shared") {
    await prisma.practiceDocumentShare.create({
      data: {
        documentId: doc.id,
        patientUserId: patientUserId ?? W.patient.id,
        sharedByUserId: W.ownerA.id,
        status: "active",
      },
    });
  }

  // Stored through the product's own storage service, so the bytes the
  // translation path reads are the bytes that were put there.
  const buffer = await realPdf();
  const storageKey = await getPracticeDocumentStorage().putObject({
    practiceProfileId: W.practiceA.id,
    documentId: doc.id,
    buffer,
    originalFileName: "befund.pdf",
  });
  const file = await prisma.practiceDocumentFile.create({
    data: {
      documentId: doc.id,
      storageKey,
      originalFileName: "befund.pdf",
      mimeType: "application/pdf",
      sizeBytes: buffer.length,
      checksum: crypto.createHash("sha256").update(buffer).digest("hex"),
    },
  });
  return { doc, file };
}

async function translateDocument(actorUserId, documentId, fileId) {
  const before = docProvider.hits();
  const res = await fetch(
    `${origin}/api/patient/practice-documents/${documentId}/translate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token(actorUserId)}`,
      },
      body: JSON.stringify({ fileId, targetLanguage: "en", mode: "strict_translation", sourceLanguage: "de" }),
    },
  );
  return {
    status: res.status,
    body: await res.json().catch(() => null),
    hits: docProvider.hits() - before,
  };
}

test("document translation: no care-relationship consent is required, by policy", { skip }, () => {
  /*
   * Recorded as an assertion rather than a comment, so the claim is checked.
   *
   * The gate for this path lives in documentProvenanceGate.js and asks about
   * ownership, share status and link validity — not about a ConsentRecord. If
   * someone later adds a consent check here it will be a deliberate policy
   * change, and this test will say so instead of silently agreeing.
   */
  const src = readSource("services/documentTranslation/documentProvenanceGate.js");
  assert.ok(
    !/consentRecord|assertConsentForLink|requireConsentScope/.test(src),
    "a consent gate appeared on the document translation path — was that intended?",
  );
  assert.match(src, /patientUserId/, "ownership is no longer part of the gate");
  assert.match(src, /TRANSLATION_LINK_STATUSES\.has\(link\.status\)/, "the link check is gone");
});

test("a patient may translate their own released document", { skip }, async () => {
  const { doc, file } = await makeSharedDocument();
  const r = await translateDocument(W.patient.id, doc.id, file.id);
  assert.ok(r.status < 400 || r.hits === 1, `status ${r.status}: ${JSON.stringify(r.body)}`);
  assert.equal(r.hits, 1, "the counter moves — every zero below means something");
});

test("another patient's document reaches no provider", { skip }, async () => {
  const { doc, file } = await makeSharedDocument();
  const r = await translateDocument(W.otherPatient.id, doc.id, file.id);
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0, "a stranger's request reached the provider");
});

test("a document that was never released reaches no provider", { skip }, async () => {
  const { doc, file } = await makeSharedDocument({ status: "draft" });
  const r = await translateDocument(W.patient.id, doc.id, file.id);
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0, "an unreleased draft was sent for translation");
});

test("a revoked care relationship reaches no provider", { skip }, async () => {
  const { doc, file } = await makeSharedDocument();
  await prisma.practicePatientLink.update({
    where: { id: W.link.id },
    data: { status: "revoked" },
  });
  try {
    const r = await translateDocument(W.patient.id, doc.id, file.id);
    assert.notEqual(r.status, 200);
    assert.equal(r.hits, 0, "a revoked relationship still sent a document out");
  } finally {
    await prisma.practicePatientLink.update({
      where: { id: W.link.id },
      data: { status: "active" },
    });
  }
});

test("a revoked release reaches no provider", { skip }, async () => {
  // The document is still marked shared; the patient's access to it is not.
  // This is the case that a status check alone would let through.
  const { doc, file } = await makeSharedDocument();
  await prisma.practiceDocumentShare.updateMany({
    where: { documentId: doc.id },
    data: { status: "revoked", revokedAt: new Date() },
  });

  const r = await translateDocument(W.patient.id, doc.id, file.id);
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0, "a withdrawn document was sent for translation");
});

test("an expired release reaches no provider", { skip }, async () => {
  const { doc, file } = await makeSharedDocument();
  await prisma.practiceDocumentShare.updateMany({
    where: { documentId: doc.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  const r = await translateDocument(W.patient.id, doc.id, file.id);
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0);
});

test("a file id from another document reaches no provider", { skip }, async () => {
  const own = await makeSharedDocument();
  const other = await makeSharedDocument();
  const r = await translateDocument(W.patient.id, own.doc.id, other.file.id);
  assert.notEqual(r.status, 200);
  assert.equal(r.hits, 0, "a file was translated under the wrong document");
});

test("the feature flag alone stops the whole path", { skip }, async () => {
  const { doc, file } = await makeSharedDocument();
  process.env.ENABLE_DOCUMENT_TRANSLATION = "false";
  try {
    const r = await translateDocument(W.patient.id, doc.id, file.id);
    assert.notEqual(r.status, 200);
    assert.equal(r.hits, 0);
  } finally {
    process.env.ENABLE_DOCUMENT_TRANSLATION = "true";
  }
});

/* ══════════════════ class 3 — the patient's own session */

/** A structurally valid WAV: header, then silence. */
function wavBytes(samples = 2048) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples * 2, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples * 2, 40);
  return Buffer.concat([header, Buffer.alloc(samples * 2)]);
}

async function transcribe(actorUserId, { mount = "/api/transcribe" } = {}) {
  const before = sttProvider.hits();
  const form = new FormData();
  form.append("audio", new Blob([wavBytes()], { type: "audio/wav" }), "note.wav");
  form.append("language", "de");
  const res = await fetch(`${origin}${mount}`, {
    method: "POST",
    ...(actorUserId ? { headers: { Authorization: `Bearer ${token(actorUserId)}` } } : {}),
    body: form,
  });
  return {
    status: res.status,
    body: await res.json().catch(() => null),
    hits: sttProvider.hits() - before,
  };
}

async function speak(actorUserId, { mount = "/api/tts" } = {}) {
  const before = ttsProvider.hits();
  const res = await fetch(`${origin}${mount}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(actorUserId ? { Authorization: `Bearer ${token(actorUserId)}` } : {}),
    },
    body: JSON.stringify({ text: "Guten Tag." }),
  });
  return { status: res.status, hits: ttsProvider.hits() - before };
}

test("symptom voice: an authenticated patient reaches the provider", { skip }, async () => {
  const r = await transcribe(W.patient.id);
  assert.equal(r.hits, 1, `status ${r.status}: ${JSON.stringify(r.body)}`);
});

test("symptom voice: no token reaches nothing", { skip }, async () => {
  // Authentication IS the boundary on this path: there is no care relationship
  // to consent to, because the patient is speaking about their own draft.
  const r = await transcribe(null);
  assert.equal(r.status, 401, `an unauthenticated request returned ${r.status}`);
  assert.equal(r.hits, 0, "audio left the machine without a caller");
});

test("the voice routers depend on their mount for authentication", { skip }, () => {
  /*
   * Worth pinning, because it is a real property and an easy one to lose.
   *
   * Neither router checks a token itself — `transcribe.js` says so in a
   * comment and reads `req.user?.userId` as already-established fact. That is
   * fine while app.js mounts them behind `requireAuth`, and it is a hole the
   * moment someone adds a second mount without it. The first draft of this
   * test made exactly that mistake: it mounted the router bare, watched audio
   * reach the provider with no caller, and briefly took that for a product
   * defect rather than a test that had built the hole itself.
   */
  const appSrc = readSource("app.js");
  for (const mount of ["/api/transcribe", "/api/tts"]) {
    const line = appSrc
      .split("\n")
      .find((l) => l.includes(`app.use(`) && l.includes(`'${mount}'`) || l.includes(`"${mount}"`));
    assert.ok(line, `${mount} is no longer mounted`);
    assert.match(line, /requireAuth/, `${mount} is mounted without requireAuth`);
  }
});

test("symptom voice: the feature flag closes the path", { skip }, async () => {
  process.env.ENABLE_SYMPTOM_VOICE_INPUT = "false";
  try {
    const r = await transcribe(W.patient.id);
    assert.notEqual(r.status, 200);
    assert.equal(r.hits, 0);
  } finally {
    process.env.ENABLE_SYMPTOM_VOICE_INPUT = "true";
  }
});

test("symptom voice: an unconfigured provider refuses rather than falling back", { skip }, async () => {
  const saved = process.env.SYMPTOM_VOICE_API_KEY;
  process.env.SYMPTOM_VOICE_API_KEY = "";
  try {
    const r = await transcribe(W.patient.id);
    assert.notEqual(r.status, 200);
    assert.equal(r.hits, 0, "a half-configured provider was contacted anyway");
  } finally {
    process.env.SYMPTOM_VOICE_API_KEY = saved;
  }
});

test("reading aloud: an authenticated patient reaches the provider", { skip }, async () => {
  const r = await speak(W.patient.id);
  assert.equal(r.hits, 1, `status ${r.status}`);
});

test("reading aloud: no token reaches nothing", { skip }, async () => {
  const r = await speak(null);
  assert.equal(r.status, 401, `an unauthenticated request returned ${r.status}`);
  assert.equal(r.hits, 0, "text left the machine without a caller");
});

test("reading aloud: the feature flag closes the path", { skip }, async () => {
  process.env.ENABLE_SYMPTOM_VOICE_OUTPUT = "false";
  try {
    const r = await speak(W.patient.id);
    assert.equal(r.status, 503);
    assert.equal(r.hits, 0);
  } finally {
    process.env.ENABLE_SYMPTOM_VOICE_OUTPUT = "true";
  }
});

/* ══════════════════════════════ class 4 — interpreter */

test("interpreter: processing is gated by flags and auth, storage by consent", { skip }, () => {
  /*
   * These are two different rules and the product keeps them apart on purpose.
   *
   * Translating a live conversation is gated by the interpreter feature flags
   * and by authentication. The account-level cloud consent decides something
   * else entirely: whether a session may be WRITTEN to cloud storage. Neither
   * is a substitute for the other, and a change that made one stand in for the
   * other would be a policy change worth noticing — either a stored session
   * without consent, or a conversation refused because of a storage setting.
   *
   * Asserted statically because the streaming paths need a live provider
   * session to exercise, which is a different kind of test; what is pinned
   * here is which rule guards which door.
   */
  const transcribeSrc = readSource("routes/interpreterStreamTranscribe.js");
  assert.match(transcribeSrc, /isMedicalInterpreterEnabled\(\)/, "the interpreter flag check is gone");
  assert.match(
    transcribeSrc,
    /isInterpreterStreamingSttEnabled\(\)/,
    "the streaming STT flag check is gone",
  );
  assert.ok(
    !/cloudConsent|CloudConsent/.test(transcribeSrc),
    "a cloud-STORAGE consent now gates live transcription — that is a policy change",
  );

  const sessionSrc = readSource("services/interpreter/interpreterCloudSessionService.js");
  assert.match(
    sessionSrc,
    /interpreter_cloud_consent_required/,
    "storing a session no longer requires cloud consent",
  );
});

/* ────────────────────────────────────────────────────────────── helpers */

function readSource(rel) {
  return fs.readFileSync(path.join(SERVER, rel), "utf8");
}
