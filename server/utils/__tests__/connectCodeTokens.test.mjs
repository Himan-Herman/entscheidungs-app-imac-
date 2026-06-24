/**
 * Unit tests for connectCodeTokens.js — patient-generated practice connection code:
 * high-entropy generation, hash-only storage, timing-safe verification, TTL and the
 * redeemability rules (active / expired / used / revoked).
 * Run: node --test server/utils/__tests__/connectCodeTokens.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CONNECT_CODE_TTL_MINUTES,
  CONNECT_CODE_STATUSES,
  generateConnectCode,
  normalizeConnectCode,
  hashConnectCode,
  connectCodePrefix,
  verifyConnectCode,
  connectCodeExpiry,
  evaluateConnectCodeRedeemable,
} from "../connectCodeTokens.js";

test("generateConnectCode returns unique, unambiguous, grouped codes", () => {
  const a = generateConnectCode();
  const b = generateConnectCode();
  assert.match(a, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/, "ABCD-EFGH-JKLM shape");
  assert.ok(!/[01OI]/.test(a), "no ambiguous chars 0/1/O/I");
  assert.notEqual(a, b, "two codes must differ");
  // entropy sanity: 50 codes should be unique
  const set = new Set(Array.from({ length: 50 }, () => generateConnectCode()));
  assert.equal(set.size, 50, "no collisions across 50 codes");
});

test("normalizeConnectCode strips separators and uppercases", () => {
  assert.equal(normalizeConnectCode("abcd-efgh-jklm"), "ABCDEFGHJKLM");
  assert.equal(normalizeConnectCode("  ABCD efgh\tjklm "), "ABCDEFGHJKLM");
  assert.equal(normalizeConnectCode(null), "");
});

test("hashConnectCode is SHA-256 hex and format-insensitive; plaintext not derivable", () => {
  const code = generateConnectCode();
  const h = hashConnectCode(code);
  assert.match(h, /^[0-9a-f]{64}$/, "64-char hex digest");
  assert.equal(hashConnectCode(code), h, "deterministic");
  // formatting (hyphens/case) must not change the hash
  assert.equal(hashConnectCode(normalizeConnectCode(code).toLowerCase()), h, "case/format-insensitive");
  assert.notEqual(hashConnectCode("ABCD-EFGH-JKLN"), h, "different code => different hash");
  // the hash must not contain the plaintext
  assert.ok(!h.includes(normalizeConnectCode(code)), "hash does not leak plaintext");
});

test("connectCodePrefix returns the first group of the normalized code", () => {
  assert.equal(connectCodePrefix("ABCD-EFGH-JKLM"), "ABCD");
  assert.equal(connectCodePrefix("abcdefghjklm"), "ABCD");
});

test("verifyConnectCode accepts only the matching code, format-insensitive, safe on junk", () => {
  const code = generateConnectCode();
  const hash = hashConnectCode(code);
  assert.equal(verifyConnectCode(code, hash), true, "matching code verifies");
  assert.equal(verifyConnectCode(normalizeConnectCode(code).toLowerCase(), hash), true, "lowercased + unhyphenated still verifies");
  assert.equal(verifyConnectCode("WRON-GCOD-E234", hash), false, "wrong code rejected");
  assert.equal(verifyConnectCode("", hash), false);
  assert.equal(verifyConnectCode(code, ""), false);
  assert.equal(verifyConnectCode(null, null), false);
  assert.equal(verifyConnectCode(code, "not-a-valid-hex-hash"), false, "malformed hash must not throw");
});

test("connectCodeExpiry adds the TTL (default 15 min)", () => {
  const now = new Date("2026-06-24T10:00:00.000Z");
  assert.equal(CONNECT_CODE_TTL_MINUTES, 15);
  assert.equal(connectCodeExpiry(now).toISOString(), "2026-06-24T10:15:00.000Z");
  assert.equal(connectCodeExpiry(now, 10).toISOString(), "2026-06-24T10:10:00.000Z");
});

test("CONNECT_CODE_STATUSES are the 4 lifecycle states", () => {
  assert.deepEqual([...CONNECT_CODE_STATUSES], ["active", "used", "expired", "revoked"]);
});

test("evaluateConnectCodeRedeemable enforces active + unexpired + unused + not-revoked", () => {
  const now = new Date("2026-06-24T10:00:00.000Z");
  const future = new Date("2026-06-24T10:10:00.000Z");
  const past = new Date("2026-06-24T09:50:00.000Z");

  assert.deepEqual(evaluateConnectCodeRedeemable(null, now), { ok: false, reason: "not_found" });
  assert.deepEqual(
    evaluateConnectCodeRedeemable({ status: "active", expiresAt: future }, now),
    { ok: true, reason: "ok" },
    "active + future expiry => redeemable",
  );
  assert.deepEqual(
    evaluateConnectCodeRedeemable({ status: "active", expiresAt: past }, now),
    { ok: false, reason: "expired" },
    "active but past expiry => expired",
  );
  assert.deepEqual(
    evaluateConnectCodeRedeemable({ status: "used", expiresAt: future }, now),
    { ok: false, reason: "used" },
  );
  assert.deepEqual(
    evaluateConnectCodeRedeemable({ status: "revoked", expiresAt: future }, now),
    { ok: false, reason: "revoked" },
  );
  assert.deepEqual(
    evaluateConnectCodeRedeemable({ status: "expired", expiresAt: future }, now),
    { ok: false, reason: "expired" },
    "explicit expired status => expired even if expiresAt is future",
  );
  // boundary: expiry exactly == now is treated as expired (<=)
  assert.equal(evaluateConnectCodeRedeemable({ status: "active", expiresAt: now }, now).ok, false);
  // accepts ISO string expiresAt too
  assert.equal(
    evaluateConnectCodeRedeemable({ status: "active", expiresAt: future.toISOString() }, now).ok,
    true,
  );
});
