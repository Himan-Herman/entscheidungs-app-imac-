/**
 * Unit tests for telemedicineTokens.js — access-token generation, hashing and
 * timing-safe verification used for video join/host links.
 * Run: node --test server/utils/__tests__/telemedicineTokens.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateAccessToken,
  hashAccessToken,
  verifyAccessToken,
} from "../telemedicineTokens.js";

test("generateAccessToken returns unique base64url tokens", () => {
  const a = generateAccessToken();
  const b = generateAccessToken();
  assert.match(a, /^[A-Za-z0-9_-]+$/, "base64url charset");
  assert.ok(a.length >= 40, "32 random bytes encode to >= 40 chars");
  assert.notEqual(a, b, "two tokens must differ");
});

test("hashAccessToken is deterministic SHA-256 hex", () => {
  const token = "example-token";
  const h1 = hashAccessToken(token);
  const h2 = hashAccessToken(token);
  assert.equal(h1, h2, "same input => same hash");
  assert.match(h1, /^[0-9a-f]{64}$/, "64-char hex digest");
  assert.notEqual(hashAccessToken("other-token"), h1, "different input => different hash");
});

test("verifyAccessToken accepts the matching token only", () => {
  const token = generateAccessToken();
  const hash = hashAccessToken(token);
  assert.equal(verifyAccessToken(token, hash), true, "matching token verifies");
  assert.equal(verifyAccessToken("wrong-token", hash), false, "wrong token rejected");
  assert.equal(
    verifyAccessToken(token, hashAccessToken("different")),
    false,
    "tampered hash rejected",
  );
});

test("verifyAccessToken handles missing / malformed input safely", () => {
  const token = generateAccessToken();
  const hash = hashAccessToken(token);
  assert.equal(verifyAccessToken("", hash), false);
  assert.equal(verifyAccessToken(token, ""), false);
  assert.equal(verifyAccessToken(null, null), false);
  // non-hex hash must not throw, just return false
  assert.equal(verifyAccessToken(token, "not-a-valid-hex-hash"), false);
});
