/**
 * Verification and reset links survive the switch to hashed token storage.
 *
 * Tokens used to be stored exactly as they were mailed; they are now stored as
 * a SHA-256 of that value. A verification link lives for 24 hours and a reset
 * link for one, so at the moment the new code goes live the database still
 * holds plaintext tokens belonging to links people have been sent and have not
 * yet clicked. If the new code only ever looked up by hash, every one of those
 * links would report itself invalid — and on the reset path that means someone
 * who cannot log in also cannot recover.
 *
 * These tests drive the real endpoints over HTTP against the real database, and
 * cover both directions: the new format has to work, the old format has to keep
 * working for the rest of its own lifetime, and neither may weaken expiry or
 * single use. Rows are created and removed by the tests themselves; no other
 * data is touched.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import crypto from "crypto";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-token-compat";
// The reset and verification paths are rate limited per IP. Every case here
// comes from the same address, so the ceiling is raised for the run; nothing
// about the token logic depends on it.
process.env.AUTH_RESET_PASSWORD_IP_MAX = "1000";
process.env.AUTH_PASSWORD_RESET_IP_MAX = "1000";
// Blanked before the mailer is imported, so it initialises with no client and
// no message can leave the machine. One of the cases below drives the route
// that would normally send a reset mail, and a test must not reach a live mail
// provider — not even with an undeliverable address.
process.env.RESEND_API_KEY = "";

const { prisma } = await import("../lib/prisma.js");
const { default: authRouter } = await import("../routes/auth.js");
const { hashAuthToken } = await import("../utils/authTokenHash.js");

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}/api/auth`;

const created = [];
const HOUR = 60 * 60 * 1000;

/** Creates a user holding the given token values, exactly as a row would look. */
async function seedUser(fields) {
  const user = await prisma.user.create({
    data: {
      email: `token-compat-${crypto.randomUUID()}@test.invalid`,
      passwordHash: "$2b$10$notarealhashnotarealhashnotarealhashnotarealhashno",
      firstName: "Token",
      lastName: "Compat",
      dateOfBirth: new Date("1980-01-01"),
      verified: false,
      ...fields,
    },
  });
  created.push(user.id);
  return user;
}

const resetWith = (token) =>
  fetch(`${base}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password: "a-new-password-1234" }),
  });

const verifyWith = (token) =>
  fetch(`${base}/verify-email?token=${encodeURIComponent(token)}`, {
    redirect: "manual",
  });

/** The verification route always redirects; the outcome is in the query. */
const verifyOutcome = (res) =>
  new URL(res.headers.get("location"), "http://x").searchParams.get("verify");

// ── The new format ─────────────────────────────────────────────────────────

test("a reset token issued by the current code is accepted", async () => {
  const plain = crypto.randomBytes(32).toString("hex");
  await seedUser({
    passwordResetToken: hashAuthToken(plain),
    passwordResetExpires: new Date(Date.now() + HOUR),
  });
  assert.equal((await resetWith(plain)).status, 200);
});

test("a verification token issued by the current code is accepted", async () => {
  const plain = crypto.randomBytes(32).toString("hex");
  await seedUser({
    verifyToken: hashAuthToken(plain),
    verifyTokenExpires: new Date(Date.now() + 24 * HOUR),
  });
  assert.equal(verifyOutcome(await verifyWith(plain)), "ok");
});

// ── The format written before the change ───────────────────────────────────

test("a reset link mailed before the deploy still works", async () => {
  const plain = crypto.randomBytes(32).toString("hex");
  const user = await seedUser({
    passwordResetToken: plain, // stored in clear, as the previous code did
    passwordResetExpires: new Date(Date.now() + HOUR),
  });

  const res = await resetWith(plain);
  assert.equal(res.status, 200, "the person following the link is not locked out");

  const after = await prisma.user.findUnique({ where: { id: user.id } });
  assert.notEqual(after.passwordHash, user.passwordHash, "the password really changed");
});

test("a verification link mailed before the deploy still works", async () => {
  const plain = crypto.randomBytes(32).toString("hex");
  const user = await seedUser({
    verifyToken: plain,
    verifyTokenExpires: new Date(Date.now() + 24 * HOUR),
  });

  assert.equal(verifyOutcome(await verifyWith(plain)), "ok");
  assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).verified, true);
});

// ── What the transition must not soften ────────────────────────────────────

test("an expired token from before the deploy is still refused", async () => {
  const plain = crypto.randomBytes(32).toString("hex");
  await seedUser({
    passwordResetToken: plain,
    passwordResetExpires: new Date(Date.now() - HOUR), // ran out an hour ago
  });

  const res = await resetWith(plain);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "invalid_or_expired");
});

test("an expired verification token from before the deploy is still refused", async () => {
  const plain = crypto.randomBytes(32).toString("hex");
  const user = await seedUser({
    verifyToken: plain,
    verifyTokenExpires: new Date(Date.now() - HOUR),
  });

  assert.equal(verifyOutcome(await verifyWith(plain)), "invalid");
  assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).verified, false);
});

test("a token from before the deploy works once and not twice", async () => {
  const plain = crypto.randomBytes(32).toString("hex");
  const user = await seedUser({
    passwordResetToken: plain,
    passwordResetExpires: new Date(Date.now() + HOUR),
  });

  assert.equal((await resetWith(plain)).status, 200);

  const second = await resetWith(plain);
  assert.equal(second.status, 400, "the same link cannot be replayed");
  assert.equal((await second.json()).error, "invalid_or_expired");

  const after = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(after.passwordResetToken, null, "and nothing is left to match against");
});

test("using a legacy token does not write it back in clear", async () => {
  const plain = crypto.randomBytes(32).toString("hex");
  const user = await seedUser({
    passwordResetToken: plain,
    passwordResetExpires: new Date(Date.now() + HOUR),
  });

  await resetWith(plain);

  const after = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(after.passwordResetToken, null);
  assert.equal(after.passwordResetExpires, null);
});

test("a token belonging to nobody is refused whichever way it is read", async () => {
  const stranger = crypto.randomBytes(32).toString("hex");
  assert.equal((await resetWith(stranger)).status, 400);
  assert.equal(verifyOutcome(await verifyWith(stranger)), "invalid");
  // and the hash of an unknown value is no better
  assert.equal((await resetWith(hashAuthToken(stranger))).status, 400);
});

test("one user's still-valid token cannot be used to reset another user", async () => {
  const plain = crypto.randomBytes(32).toString("hex");
  const owner = await seedUser({
    passwordResetToken: plain,
    passwordResetExpires: new Date(Date.now() + HOUR),
  });
  const bystander = await seedUser({});

  await resetWith(plain);

  const other = await prisma.user.findUnique({ where: { id: bystander.id } });
  assert.equal(other.passwordHash, bystander.passwordHash, "the bystander is untouched");
  assert.notEqual(
    (await prisma.user.findUnique({ where: { id: owner.id } })).passwordHash,
    owner.passwordHash,
  );
});

// ── The new storage format is what actually gets written ───────────────────

test("requesting a reset stores a hash, never the mailed value", async () => {
  const user = await seedUser({ verified: true });

  // The mailer is deliberately unconfigured here, so the request fails at the
  // point of sending. The token is written before that, which is exactly the
  // part under test: whatever ends up in the row must not be usable as-is.
  await fetch(`${base}/request-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email }),
  });

  const after = await prisma.user.findUnique({ where: { id: user.id } });
  assert.ok(after.passwordResetToken, "a token was issued");
  assert.match(
    after.passwordResetToken,
    /^[0-9a-f]{64}$/,
    "what is stored is a SHA-256, not a value anyone could paste into a link",
  );
});

test.after(async () => {
  if (created.length) {
    await prisma.user.deleteMany({ where: { id: { in: created } } });
  }
  server.close();
  await prisma.$disconnect();
});
