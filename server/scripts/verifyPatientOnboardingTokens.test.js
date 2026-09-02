/**
 * The credential rules of practice-issued invitations, without a database.
 *
 * Everything asserted here is decided in pure functions on purpose: entropy,
 * hash-only storage, and the two independent clocks are the parts that must not
 * depend on a schema, a transaction or a route to be correct.
 *
 * Run: node --test scripts/verifyPatientOnboardingTokens.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  INVITATION_TTL_DAYS,
  MANUAL_CODE_TTL_MINUTES,
  INVITATION_STATUSES,
  canRotateManualCode,
  evaluateInvitationRedeemable,
  evaluateManualCodeUsable,
  generateInvitationToken,
  generateManualCode,
  hashInvitationToken,
  hashManualCode,
  invitationExpiry,
  invitationTokenPrefix,
  manualCodeExpiry,
  normalizeManualCode,
} from "../services/patientOnboarding/invitationTokens.js";

const NOW = new Date("2026-09-01T12:00:00.000Z");
const pending = (over = {}) => ({
  status: "pending",
  expiresAt: new Date(NOW.getTime() + 60_000),
  ...over,
});

/* -------------------------------------------------------------- link token */

test("a link token is unguessable and never repeats", () => {
  const seen = new Set();
  for (let i = 0; i < 500; i += 1) {
    const t = generateInvitationToken();
    // 32 random bytes in base64url. Below 43 characters something truncated it.
    assert.ok(t.length >= 43, `token too short: ${t.length}`);
    assert.match(t, /^[A-Za-z0-9_-]+$/);
    assert.equal(seen.has(t), false, "generator repeated a token");
    seen.add(t);
  }
});

test("hashing a link token is one-way, stable and collision-free across tokens", () => {
  const a = generateInvitationToken();
  const b = generateInvitationToken();
  const ha = hashInvitationToken(a);

  assert.match(ha, /^[0-9a-f]{64}$/);
  assert.equal(ha, hashInvitationToken(a), "same token hashed differently twice");
  assert.notEqual(ha, hashInvitationToken(b));
  // The plaintext must not be recoverable from, or visible in, the stored value.
  assert.equal(ha.includes(a), false);
  assert.equal(a.includes(ha), false);
});

test("the stored prefix keeps far more of the token secret than it reveals", () => {
  const t = generateInvitationToken();
  const p = invitationTokenPrefix(t);
  assert.equal(p.length, 12);
  assert.equal(t.startsWith(p), true);
  // The point of the assertion: a leaked prefix must not shorten a search to
  // anything reachable. 43 - 12 characters of base64url is still ~180 bits.
  assert.ok(t.length - p.length >= 30, "prefix leaves too little of the token");
});

/* ------------------------------------------------------------- manual code */

test("a manual code avoids characters people confuse, and hashes case-insensitively", () => {
  const code = generateManualCode();
  assert.match(code, /^[A-Z0-9-]+$/);
  // 0/O and 1/I are exactly the pairs that produce failed on-site entries.
  assert.equal(/[01OI]/.test(code.replace(/-/g, "")), false, `ambiguous glyph in ${code}`);

  const normalized = normalizeManualCode(code.toLowerCase().replace(/-/g, " "));
  assert.equal(
    hashManualCode(code),
    hashManualCode(normalized),
    "display formatting changed the stored hash",
  );
  assert.match(hashManualCode(code), /^[0-9a-f]{64}$/);
});

test("a manual code hash is not a link token hash", () => {
  const code = generateManualCode();
  assert.notEqual(hashManualCode(code), hashInvitationToken(code));
});

/* ------------------------------------------------------------------ clocks */

test("the two lifetimes are the frozen ones and are independent", () => {
  assert.equal(INVITATION_TTL_DAYS, 7);
  assert.equal(MANUAL_CODE_TTL_MINUTES, 60);
  assert.equal(invitationExpiry(NOW).getTime() - NOW.getTime(), 7 * 24 * 60 * 60 * 1000);
  assert.equal(manualCodeExpiry(NOW).getTime() - NOW.getTime(), 60 * 60 * 1000);
  // The short clock must never be able to outlive the long one.
  assert.ok(manualCodeExpiry(NOW) < invitationExpiry(NOW));
});

test("`expired` is derived, never a stored status", () => {
  assert.deepEqual([...INVITATION_STATUSES], ["pending", "redeemed", "revoked", "superseded"]);
  assert.equal(INVITATION_STATUSES.includes("expired"), false);
});

/* ------------------------------------------------- link redeemability rules */

test("only a live pending invitation is usable, and each refusal names itself", () => {
  const cases = [
    [null, "not_found"],
    [undefined, "not_found"],
    [pending({ status: "redeemed" }), "redeemed"],
    [pending({ status: "revoked" }), "revoked"],
    [pending({ status: "superseded" }), "superseded"],
    [pending({ status: "something_else" }), "not_pending"],
    [pending({ expiresAt: new Date(NOW.getTime() - 1) }), "expired"],
    [pending({ expiresAt: null }), "expired"],
    [pending({ expiresAt: "not a date" }), "expired"],
    [pending(), "ok"],
  ];
  for (const [row, reason] of cases) {
    const v = evaluateInvitationRedeemable(row, NOW);
    assert.equal(v.reason, reason, `wrong reason for ${JSON.stringify(row)}`);
    assert.equal(v.ok, reason === "ok");
  }
});

test("expiry is exclusive at the boundary — the last millisecond is already gone", () => {
  assert.equal(evaluateInvitationRedeemable(pending({ expiresAt: NOW }), NOW).ok, false);
  assert.equal(
    evaluateInvitationRedeemable(pending({ expiresAt: new Date(NOW.getTime() + 1) }), NOW).ok,
    true,
  );
});

test("an expired invitation is still technically pending", () => {
  // The partial unique index counts this row, which is why regeneration has to
  // supersede expired rows too. If this ever stops being true, the "send again"
  // path silently changes meaning.
  const row = pending({ expiresAt: new Date(NOW.getTime() - 1) });
  assert.equal(row.status, "pending");
  assert.equal(evaluateInvitationRedeemable(row, NOW).ok, false);
});

/* --------------------------------------------------- manual code usability */

test("a manual code needs BOTH clocks and its own hash", () => {
  const live = pending({
    manualCodeHash: "h",
    manualCodeExpiresAt: new Date(NOW.getTime() + 60_000),
  });
  assert.equal(evaluateManualCodeUsable(live, NOW).ok, true);

  assert.equal(
    evaluateManualCodeUsable({ ...live, manualCodeHash: null }, NOW).reason,
    "no_manual_code",
  );
  assert.equal(
    evaluateManualCodeUsable({ ...live, manualCodeExpiresAt: NOW }, NOW).reason,
    "manual_code_expired",
  );
  // A live code on a dead invitation is worth nothing: the invitation decides first.
  assert.equal(evaluateManualCodeUsable({ ...live, status: "revoked" }, NOW).reason, "revoked");
});

test("an expired manual code leaves the link invitation alone", () => {
  const row = pending({
    expiresAt: new Date(NOW.getTime() + 6 * 24 * 60 * 60 * 1000),
    manualCodeHash: "h",
    manualCodeExpiresAt: new Date(NOW.getTime() - 1),
  });
  assert.equal(evaluateManualCodeUsable(row, NOW).ok, false);
  assert.equal(evaluateInvitationRedeemable(row, NOW).ok, true, "the link must survive");
});

test("rotation is allowed exactly while the invitation itself is live", () => {
  assert.equal(canRotateManualCode(pending(), NOW).ok, true);
  assert.equal(canRotateManualCode(pending({ status: "revoked" }), NOW).ok, false);
  assert.equal(canRotateManualCode(pending({ status: "superseded" }), NOW).ok, false);
  assert.equal(
    canRotateManualCode(pending({ expiresAt: new Date(NOW.getTime() - 1) }), NOW).ok,
    false,
    "an expired invitation must not be revived by issuing a fresh code",
  );
});
