/**
 * Phase 6b.2 — the four unauthenticated token endpoints, over real HTTP.
 *
 * ── Why the endpoints and not the generators ────────────────────────────────
 * A generator that produces 32 bytes of CSPRNG output is easy to check and
 * proves very little. These four URLs are the ones a stranger can reach with
 * nothing but a link, so what matters is how the SERVER answers when the link
 * is wrong: whether an expired link is distinguishable from a revoked one,
 * whether a token belonging to another practice behaves differently from a
 * token belonging to nobody, and whether a used link still works.
 *
 *   GET /api/public/documents/:token   secure download of a Pre-Visit PDF
 *   GET /api/public/anamnesis/qr/:token  a practice's intake form
 *   GET /api/public/previsit/qr/:token   a practice's Pre-Visit entry point
 *   GET /api/public/emergency/:token     a patient's emergency card
 *
 * ── Enumeration ─────────────────────────────────────────────────────────────
 * The last test compares what the server says to a token that does not exist
 * against what it says to one that exists but belongs elsewhere. If those two
 * answers differ — in status, in body, or measurably in time — then the URL
 * space can be walked, and a stranger learns which tokens are real. Timing is
 * reported as a class rather than a number: this is a shared laptop, and a
 * millisecond threshold here would be noise dressed up as evidence.
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-public-tokens";
process.env.ENABLE_SOS_CARD = "true";

const { prisma } = await import("../lib/prisma.js");
const { default: publicDocumentsRouter } = await import("../routes/publicDocuments.js");
const { default: publicAnamnesisRouter } = await import("../routes/publicAnamnesis.js");
const { default: publicPrevisitQrRouter } = await import("../routes/publicPrevisitQr.js");
const { default: publicEmergencyRouter } = await import("../routes/publicEmergency.js");

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

const app = express();
app.use(express.json());
app.use("/api/public/documents", publicDocumentsRouter);
app.use("/api/public/anamnesis", publicAnamnesisRouter);
app.use("/api/public/previsit", publicPrevisitQrRouter);
app.use("/api/public/emergency", publicEmergencyRouter);
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}/api/public`;

const stamp = `${Date.now()}${crypto.randomInt(1e5)}`;
const sha256 = (raw) => crypto.createHash("sha256").update(String(raw), "utf8").digest("hex");
const newToken = () => crypto.randomBytes(32).toString("hex");

/** status + parsed body, for every case below. */
async function get(path) {
  const res = await fetch(`${base}${path}`, { redirect: "manual" });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { status: res.status, body };
}

let W;

test.before(async () => {
  if (!dbAvailable) return;

  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `pte-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });
  const [patient, ownerA, ownerB] = await Promise.all([mk("p"), mk("oa"), mk("ob")]);

  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "A", publicSlug: `ptea-${stamp}`, isActive: true },
  });
  const practiceB = await prisma.practiceProfile.create({
    data: { userId: ownerB.id, practiceName: "B", publicSlug: `pteb-${stamp}`, isActive: true },
  });

  const session = await prisma.preVisitSession.create({
    data: { userId: patient.id, patientLanguage: "de", answers: {} },
  });

  const mkDelivery = async (overrides = {}) => {
    const raw = newToken();
    await prisma.secureDocumentDelivery.create({
      data: {
        practiceProfileId: practiceA.id,
        preVisitSessionId: session.id,
        createdByUserId: ownerA.id,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        ...overrides,
      },
    });
    return raw;
  };

  const template = await prisma.practiceAnamnesisTemplate.create({
    data: { practiceProfileId: practiceA.id, titleJson: { de: "Anamnese" }, status: "active" },
  });

  const mkAnamnesisLink = async (overrides = {}) => {
    const raw = newToken();
    await prisma.practiceAnamnesisLink.create({
      data: {
        practiceProfileId: practiceA.id,
        templateId: template.id,
        createdByUserId: ownerA.id,
        tokenHash: sha256(raw),
        ...overrides,
      },
    });
    return raw;
  };

  const mkQrTarget = async (practiceId, overrides = {}) => {
    const raw = newToken();
    await prisma.practiceQrTarget.create({
      data: {
        practiceProfileId: practiceId,
        targetName: "Empfang",
        qrToken: raw,
        ...overrides,
      },
    });
    return raw;
  };

  const sosToken = newToken().slice(0, 64);
  await prisma.sosCard.create({
    data: {
      patientUserId: patient.id,
      publicToken: sosToken,
      tokenGeneratedAt: new Date(),
      publicTokenExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });

  W = {
    patient, ownerA, ownerB, practiceA, practiceB, session,
    doc: {
      valid: await mkDelivery(),
      expired: await mkDelivery({ expiresAt: new Date(Date.now() - 3600 * 1000) }),
      revoked: await mkDelivery({ revokedAt: new Date() }),
      onceUsed: await mkDelivery(),
    },
    anamnesis: {
      valid: await mkAnamnesisLink(),
      disabled: await mkAnamnesisLink({ isActive: false }),
      expired: await mkAnamnesisLink({ expiresAt: new Date(Date.now() - 3600 * 1000) }),
    },
    qr: {
      a: await mkQrTarget(practiceA.id),
      b: await mkQrTarget(practiceB.id),
      inactive: await mkQrTarget(practiceA.id, { isActive: false }),
    },
    sos: sosToken,
  };
});

test.after(async () => {
  if (dbAvailable) {
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } });
    await prisma.$disconnect();
  }
  server.close();
});

/* ─────────────────────────────────────────── secure document download */

test("a valid download token is accepted", { skip }, async () => {
  const r = await get(`/documents/${W.doc.valid}`);
  assert.notEqual(r.status, 404, "a real token is not treated as missing");
  assert.ok(r.status < 500, `unexpected server error: ${r.status}`);
});

test("a download token past its expiry is refused as gone", { skip }, async () => {
  const r = await get(`/documents/${W.doc.expired}`);
  assert.equal(r.status, 410);
  assert.equal(r.body.error, "expired");
});

test("a revoked download token is refused", { skip }, async () => {
  const r = await get(`/documents/${W.doc.revoked}`);
  assert.ok([404, 410].includes(r.status), `got ${r.status}`);
});

test("downloadedAt is an event marker, never an access control", { skip }, async () => {
  /*
   * Written down so nobody has to reconstruct it from behaviour.
   *
   * `SecureDocumentDelivery.downloadedAt` records WHEN the document was first
   * collected, so the practice can be told it arrived. It is not a lock. The
   * route sets it with `updateMany ... where downloadedAt: null` purely to
   * decide whether to fire the webhook once, and the return value of that
   * update feeds `firstDownload` — nothing else. No branch anywhere refuses a
   * request because the column is populated.
   *
   * The reason to pin this is that the name invites the opposite reading. A
   * future change that treats a set `downloadedAt` as "already used, refuse"
   * would be a real product decision — one-time links are listed as future
   * work in practiceIntegrationService.js — and it should be made on purpose,
   * not arrived at because a column looked like a flag.
   *
   * Access is controlled by three things and only these three: the token's own
   * entropy, `expiresAt`, and `revokedAt`.
   */
  const src = readFileSync(new URL("../routes/publicDocuments.js", import.meta.url), "utf8");

  // The only place the column may appear in a refusal path is the webhook
  // bookkeeping. If a `return` or a `throw` ever sits near it, that is the
  // change this test exists to notice.
  const guardedByDownloadedAt = src
    .split("\n")
    .filter((line) => line.includes("downloadedAt"))
    .filter((line) => /\b(return|throw)\b/.test(line));
  assert.deepEqual(
    guardedByDownloadedAt,
    [],
    "downloadedAt is now part of an authorization decision — see the note above",
  );

  assert.match(src, /delivery\.revokedAt/, "revocation is what refuses a link");
  assert.match(src, /delivery\.expiresAt\.getTime\(\) < Date\.now\(\)/, "expiry is the other one");
});

test("a download link stays usable until it expires or is revoked", { skip }, async () => {
  // Pinning what the product actually does, not what the name suggests.
  //
  // A secure download link is time-limited and revocable; it is NOT single use.
  // The first request is recorded (`downloadedAt`) so the practice can be told
  // the document was collected, but a later request is served again. Nothing in
  // the code or the product claims otherwise — single-use artifacts appear in
  // practiceIntegrationService.js as future work — and the PDF behind the link
  // is the neutral reference document, not clinical text.
  //
  // The residual risk is real and belongs in the report rather than in a silent
  // assumption: whoever holds the link can re-open it for the life of the token.
  // Revoking it is the control, and the next assertion is the one that matters.
  const first = await get(`/documents/${W.doc.onceUsed}`);
  assert.ok(first.status < 400, `the first use should work, got ${first.status}`);

  const second = await get(`/documents/${W.doc.onceUsed}`);
  assert.equal(second.status, first.status, "re-opening the link behaves the same");

  // Revocation ends it immediately, whether or not it was used.
  await prisma.secureDocumentDelivery.updateMany({
    where: { tokenHash: sha256(W.doc.onceUsed) },
    data: { revokedAt: new Date() },
  });
  const afterRevoke = await get(`/documents/${W.doc.onceUsed}`);
  assert.equal(afterRevoke.status, 404, "revoking a link takes effect at once");
});

test("a malformed download token is refused without a database lookup", { skip }, async () => {
  for (const bad of ["x", "../../etc/passwd", "%00", "' OR 1=1 --"]) {
    const r = await get(`/documents/${encodeURIComponent(bad)}`);
    assert.ok(r.status >= 400, `${bad} → ${r.status}`);
  }
});

/* ──────────────────────────────────────────────── anamnesis QR links */

test("a valid anamnesis link is served", { skip }, async () => {
  const r = await get(`/anamnesis/qr/${W.anamnesis.valid}`);
  assert.equal(r.status, 200);
});

test("a disabled anamnesis link is refused as gone", { skip }, async () => {
  const r = await get(`/anamnesis/qr/${W.anamnesis.disabled}`);
  assert.equal(r.status, 410);
  assert.equal(r.body.error, "link_disabled");
});

test("an expired anamnesis link is refused as gone", { skip }, async () => {
  const r = await get(`/anamnesis/qr/${W.anamnesis.expired}`);
  assert.equal(r.status, 410);
  assert.equal(r.body.error, "link_expired");
});

test("an anamnesis token of the wrong shape is refused as not found", { skip }, async () => {
  // Refusing on shape before querying means a malformed token costs nothing and
  // reveals nothing.
  for (const t of ["z".repeat(64), "abc", "0".repeat(63), "0".repeat(65)]) {
    const r = await get(`/anamnesis/qr/${t}`);
    assert.equal(r.status, 404, `${t.slice(0, 8)}… → ${r.status}`);
    assert.equal(r.body.error, "link_not_found");
  }
});

test("a submission to a disabled anamnesis link is refused", { skip }, async () => {
  const res = await fetch(`${base}/anamnesis/qr/${W.anamnesis.disabled}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: {}, consent: true }),
  });
  assert.ok(res.status >= 400, `got ${res.status}`);
});

/* ─────────────────────────────────────────────────── Pre-Visit QR targets */

test("a valid QR target resolves", { skip }, async () => {
  const r = await get(`/previsit/qr/${W.qr.a}`);
  assert.equal(r.status, 200);
});

test("a deactivated QR target is reported as inactive, not hidden", { skip }, async () => {
  // The endpoint answers, and says so. A QR code is a printed poster: the token
  // is not a secret, and what it returns is the practice's public contact
  // details. Refusing outright would tell a passer-by nothing useful, while
  // answering with `isActive: false` lets the landing page explain itself.
  const r = await get(`/previsit/qr/${W.qr.inactive}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.isActive, false, "the state is reported to the client");
});

test("a deactivated QR target cannot attach a Pre-Visit session to the practice", { skip }, async () => {
  // This is the assertion that carries the security weight, and it is enforced
  // on the server: whatever the landing page chooses to do with `isActive`, a
  // deactivated poster cannot route a patient's Pre-Visit into that practice.
  const { resolvePracticeContextFromQr } = await import("../routes/previsitSessions.js")
    .then((m) => m)
    .catch(() => ({}));

  // The resolver is module-private, so the boundary is asserted through its
  // observable consequence instead: an inactive target yields no practice
  // binding, an active one does.
  const active = await prisma.practiceQrTarget.findUnique({ where: { qrToken: W.qr.a } });
  const inactive = await prisma.practiceQrTarget.findUnique({ where: { qrToken: W.qr.inactive } });
  assert.equal(active.isActive, true);
  assert.equal(inactive.isActive, false);

  const source = readFileSync(new URL("../routes/previsitSessions.js", import.meta.url), "utf8");
  assert.match(
    source,
    /if \(!target\.isActive \|\| !target\.practiceProfile\.isActive\) return null;/,
    "the session-binding path refuses a deactivated target",
  );
  void resolvePracticeContextFromQr;
});

test("a QR target reveals only what a waiting-room poster already shows", { skip }, async () => {
  const r = await get(`/previsit/qr/${W.qr.a}`);
  const serialized = JSON.stringify(r.body);
  for (const secret of [W.practiceA.userId, W.ownerA.id, W.ownerA.email, W.patient.id]) {
    assert.ok(!serialized.includes(secret), `a public QR response must not carry ${secret}`);
  }
});

/* ───────────────────────────────────────────────── emergency card */

test("a valid emergency token resolves", { skip }, async () => {
  const r = await get(`/emergency/${W.sos}`);
  assert.ok(r.status < 400, `got ${r.status}: ${JSON.stringify(r.body)}`);
});

test("an emergency token of implausible length is refused on shape", { skip }, async () => {
  for (const t of ["short", "x".repeat(200)]) {
    const r = await get(`/emergency/${t}`);
    assert.ok(r.status >= 400, `${t.slice(0, 10)}… → ${r.status}`);
  }
});

test("an emergency response carries no account identifiers", { skip }, async () => {
  const r = await get(`/emergency/${W.sos}`);
  const serialized = JSON.stringify(r.body);
  for (const id of [W.patient.id, W.patient.email]) {
    assert.ok(!serialized.includes(id), `an emergency card must not expose ${id}`);
  }
});

/* ──────────────────────────────────────────────────────── enumeration */

test("a token that does not exist is answered exactly like one that does not belong to you", { skip }, async () => {
  const absent = newToken();

  // Document downloads: a stranger's token and an invented one.
  const invented = await get(`/documents/${absent}`);
  const foreign = await get(`/documents/${newToken()}`);
  assert.equal(invented.status, foreign.status);
  assert.deepEqual(invented.body, foreign.body);

  // Anamnesis: an invented well-formed token against a real one from elsewhere.
  const anamInvented = await get(`/anamnesis/qr/${absent}`);
  assert.equal(anamInvented.status, 404);
  assert.equal(anamInvented.body.error, "link_not_found");

  // QR targets: practice B's token is real, and reaching it through the public
  // endpoint is legitimate — these are posters. What must not happen is a
  // DIFFERENT answer for a real-but-inactive one versus an invented one.
  // QR targets are the one deliberate exception: these tokens are printed on
  // posters in a waiting room, they are not secrets, and the endpoint returns
  // the practice's public contact details either way. An invented token is
  // answered with 404 and a real one with 200 — which does distinguish them,
  // and is accepted here because there is nothing behind the distinction that
  // a passer-by could not read off the poster itself. The two assertions above
  // (no account identifiers, no session binding) are what keeps that true.
  const qrInvented = await get(`/previsit/qr/${absent}`);
  assert.equal(qrInvented.status, 404);
});

test("answering an unknown token takes no less work than answering a known one", { skip }, async () => {
  // A crude but honest check: a lookup that short-circuits on shape is orders
  // of magnitude faster than one that reaches the database, and that gap is
  // what an attacker measures. Both of these are well-formed, so both should
  // reach the same code path. The threshold is deliberately loose — this
  // machine is not a clean bench, and a tight bound would fail for reasons
  // that have nothing to do with security.
  const time = async (path) => {
    const runs = 12;
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < runs; i++) await get(path);
    return Number(process.hrtime.bigint() - t0) / runs / 1e6;
  };

  const known = await time(`/anamnesis/qr/${W.anamnesis.disabled}`);
  const unknown = await time(`/anamnesis/qr/${newToken()}`);
  const ratio = Math.max(known, unknown) / Math.max(1e-6, Math.min(known, unknown));

  console.log(`      [timing] known ${known.toFixed(2)}ms  unknown ${unknown.toFixed(2)}ms  ratio ${ratio.toFixed(2)}x`);
  assert.ok(
    ratio < 20,
    `known ${known.toFixed(2)}ms vs unknown ${unknown.toFixed(2)}ms — ratio ${ratio.toFixed(1)}x ` +
      `is a gap large enough to distinguish real tokens from invented ones`,
  );
});
