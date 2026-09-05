/**
 * The claim at the HTTP boundary: who may call it, what it accepts, what it
 * discloses, and the two limiters.
 *
 * Only the contract lives here. Everything about links, races and invariants is
 * proved against a real PostgreSQL database in verifyPatientOnboardingClaim.test.js
 * — an in-memory fake could not prove any of it.
 *
 * Run: node --test scripts/verifyPatientOnboardingClaimRoute.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-claim-route";
process.env.PATIENT_ONBOARDING_V2 = "true";
// Every request in this file comes from one loopback address, so the IP ceiling
// has to clear the contract tests -- otherwise they would fail on a 429 that has
// nothing to do with what they assert. The IP limiter is exercised on purpose in
// the LAST test, which deliberately runs past that ceiling. The user ceiling is
// low because it is per-account and cannot be exhausted by another test.
process.env.INVITATION_CLAIM_IP_MAX = "40";
process.env.INVITATION_CLAIM_USER_MAX = "4";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

/* ------------------------------------------------------------- prisma fake */
// The claim service resolves the credential before it ever opens a transaction,
// so a fake that knows no invitations is enough to exercise every route-level
// branch: validation, the generic credential answer, auth and the limiters.
prisma.practicePatientInvitation = { findUnique: async () => null };
prisma.practiceProfile = { findUnique: async () => null };
prisma.practiceMember = { findUnique: async () => null };
prisma.auditLog = { create: async () => ({}) };

const { default: claimRouter } = await import("../routes/patientInvitationClaim.js");

/* ---------------------------------------------------------------- harness */

const app = express();
app.use(express.json());
app.use("/api/patient/invitations", requireAuth, claimRouter);

const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "10m" });

async function post(body, { userId = "user-1", auth = true } = {}) {
  const res = await fetch(`${base}/api/patient/invitations/claim`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: `Bearer ${token(userId)}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const VALID = { token: "a".repeat(43), subject: { type: "self" } };

/* ------------------------------------------------------------------ tests */

test("an unauthenticated claim is refused before anything is read", async () => {
  const { status } = await post(VALID, { auth: false });
  assert.equal(status, 401);
});

test("an unknown credential gets the generic answer, never a hint", async () => {
  const { status, body } = await post(VALID, { userId: "u-generic" });
  assert.equal(status, 404);
  assert.deepEqual(body, { ok: false, error: "invalid_or_expired_invitation" });
});

test("the subject is mandatory, and malformed subjects are rejected", async () => {
  // A distinct account per case: the per-user limiter is deliberately tiny in
  // this file, and reusing one account here would trip it mid-loop and report a
  // 429 as if the payload had been accepted.
  const cases = [undefined, null, {}, { type: "" }, { type: "nope" },
    { type: "patient_profile" }, { type: "patient_profile", patientProfileId: "  " }];
  for (const [i, subject] of cases.entries()) {
    const { status, body } = await post({ token: VALID.token, subject }, { userId: `u-sub-${i}` });
    assert.equal(status, 400, `accepted subject ${JSON.stringify(subject)}`);
    assert.match(body.error, /validation_subject/);
  }
});

test("exactly one credential — both or neither is a 400", async () => {
  const payloads = [
    { token: "x", code: "ABCD-EFGH-JKLM", subject: { type: "self" } },
    { subject: { type: "self" } },
    { token: "", code: "", subject: { type: "self" } },
  ];
  for (const [i, payload] of payloads.entries()) {
    const { status, body } = await post(payload, { userId: `u-cred-${i}` });
    assert.equal(status, 400, `accepted ${JSON.stringify(payload)}`);
    assert.equal(body.error, "validation_credential_required");
  }
});

test("the response never carries an identifier the caller did not need", async () => {
  // The failure path is the only one reachable without a database, and it must
  // be as bare as the success path.
  const { body } = await post(VALID, { userId: "u-shape" });
  for (const key of ["entryId", "invitationId", "practiceId", "patientUserId",
    "patientProfileId", "consentRequired", "consentAcceptedAt"]) {
    assert.equal(key in body, false, `unexpected key ${key}`);
  }
});

test("with the flag off the route is absent, not forbidden", async () => {
  const previous = process.env.PATIENT_ONBOARDING_V2;
  delete process.env.PATIENT_ONBOARDING_V2;
  try {
    const { status, body } = await post(VALID, { userId: "u-flag" });
    assert.equal(status, 404);
    assert.deepEqual(body, { ok: false, error: "feature_disabled" });
  } finally {
    process.env.PATIENT_ONBOARDING_V2 = previous;
  }
});

test("the per-user limiter bounds one account without touching another", async () => {
  // Five calls against a ceiling of four: the fifth must be refused. This is
  // what a stolen session runs into even when it moves between addresses.
  const codes = [];
  for (let i = 0; i < 5; i += 1) {
    codes.push((await post(VALID, { userId: "u-limited" })).status);
  }
  assert.equal(codes.at(-1), 429, `expected the fifth call to be refused, got ${codes.join(",")}`);
  assert.equal(codes.slice(0, 4).every((c) => c !== 429), true, "refused too early");

  // A different account on the SAME address is unaffected — the two limiters
  // count different things, which is the reason for having both.
  assert.notEqual((await post(VALID, { userId: "u-fresh-account" })).status, 429);
});

// LAST on purpose: it exhausts the shared IP budget for the whole file.
test("the per-IP limiter eventually refuses everyone from this address", async () => {
  let refused = false;
  for (let i = 0; i < 60 && !refused; i += 1) {
    // A new account each time, so only the IP counter can be the one that trips.
    refused = (await post(VALID, { userId: `u-ip-${i}` })).status === 429;
  }
  assert.equal(refused, true, "the IP ceiling was never reached");
});
