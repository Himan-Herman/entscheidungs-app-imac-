/**
 * e-Rezept cancellation semantics: request-body allowlist, the cancel-only
 * state machine, and the guarantee that a prescription is never physically
 * removed. Pure functions plus a source guard — no database required.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = join(here, "..", "routes");

import { validatePrescriptionCancel } from "../routes/practiceErezept.js";

/* ------------------------- part 3: prescription cancel state machine (pure) */

test("PATCH body allowlist rejects any field outside { status, notes }", () => {
  for (const bad of [
    { medicationName: "X" },
    { dosage: "500mg" },
    { patientUserId: "someone-else" },
    { id: "other-id" },
    { linkId: "other-link" },
    { status: "cancelled", tokenCode: "ERZ-FAKE" },
  ]) {
    const res = validatePrescriptionCancel(bad, "issued");
    assert.equal(res.ok, false, `must reject ${JSON.stringify(bad)}`);
    assert.equal(res.error, "unsupported_field");
    assert.equal(res.status, 400);
  }
});

test("only 'cancelled' is an accepted target status", () => {
  for (const status of ["issued", "at_pharmacy", "redeemed", "expired", "nonsense", "", null, 1]) {
    const res = validatePrescriptionCancel({ status }, "issued");
    assert.equal(res.ok, false, `must reject status=${String(status)}`);
    assert.equal(res.error, "unsupported_status_transition");
  }
  assert.equal(validatePrescriptionCancel({ status: "cancelled" }, "issued").ok, true);
});

test("state machine: only live prescriptions can be cancelled", () => {
  for (const from of ["issued", "at_pharmacy"]) {
    assert.equal(validatePrescriptionCancel({ status: "cancelled" }, from).ok, true, from);
  }
  for (const from of ["redeemed", "expired", "cancelled"]) {
    const res = validatePrescriptionCancel({ status: "cancelled" }, from);
    assert.equal(res.ok, false, `${from} is terminal`);
    assert.equal(res.error, "status_transition_not_allowed");
    assert.equal(res.status, 409);
  }
});

test("notes are type-checked, trimmed and capped", () => {
  assert.equal(validatePrescriptionCancel({ notes: 42 }, "issued").error, "invalid_notes");
  assert.equal(validatePrescriptionCancel({ notes: {} }, "issued").error, "invalid_notes");
  assert.equal(validatePrescriptionCancel({ notes: null }, "issued").notes, null);
  assert.equal(validatePrescriptionCancel({ notes: "  hi  " }, "issued").notes, "hi");
  assert.equal(validatePrescriptionCancel({ notes: "x".repeat(5000) }, "issued").notes.length, 2000);
  // Omitting notes must leave the existing value untouched (undefined, not null).
  assert.equal(validatePrescriptionCancel({}, "issued").notes, undefined);
});

test("DELETE never physically removes a prescription", () => {
  const src = readFileSync(join(routesDir, "practiceErezept.js"), "utf8");
  assert.ok(!/prisma\.erezeptEntry\.delete/.test(src), "no hard delete");
  assert.ok(
    !/deletedAt:\s*new Date\(\)/.test(src),
    "DELETE must cancel, not soft-delete the record out of view",
  );
  assert.ok(src.includes("cancelPrescription"), "DELETE routes through the cancel path");
});

test("security-relevant prescription mutations use the mandatory audit", () => {
  const src = readFileSync(join(routesDir, "practiceErezept.js"), "utf8");
  assert.ok(
    !/\bwriteAuditLog\b/.test(src),
    "prescription mutations must not use the best-effort logger",
  );
  const required = src.match(/await writeRequiredAuditLog\(/g) ?? [];
  assert.ok(
    required.length >= 2,
    `expected issue + cancel to audit mandatorily, found ${required.length}`,
  );
});

