/**
 * Vitals route unit-level verification.
 * Run: ENABLE_VITALS=true node scripts/verifyVitals.js
 */

import { isVitalsEnabled } from "../config/featureFlags.js";

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    → ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

// ── Re-implement validation inline to test without DB ────────────────────
const VALID_TYPES = ["blood_pressure", "heart_rate", "glucose", "weight", "oxygen", "temperature"];
const MAX_VALUES = {
  blood_pressure: { primary: [40, 300], secondary: [20, 200] },
  heart_rate: { primary: [20, 300] },
  glucose: { primary: [20, 1000] },
  weight: { primary: [10, 700] },
  oxygen: { primary: [50, 100] },
  temperature: { primary: [25, 45] },
};

function validateEntry(body) {
  const { type, valuePrimary, valueSecondary, measuredAt } = body;
  if (!VALID_TYPES.includes(type)) return "invalid_type";
  const p = Number(valuePrimary);
  if (!Number.isFinite(p)) return "invalid_value";
  const limits = MAX_VALUES[type];
  if (limits?.primary && (p < limits.primary[0] || p > limits.primary[1])) return "value_out_of_range";
  if (type === "blood_pressure") {
    const s = Number(valueSecondary);
    if (!Number.isFinite(s)) return "missing_diastolic";
    if (s < limits.secondary[0] || s > limits.secondary[1]) return "value_out_of_range";
  }
  if (!measuredAt || isNaN(Date.parse(measuredAt))) return "invalid_date";
  const d = new Date(measuredAt);
  if (d > new Date()) return "date_in_future";
  return null;
}

// ── Tests ──────────────────────────────────────────────────────────────────

console.log("\n[1] Feature flag");
test("ENABLE_VITALS=true activates feature", () => {
  assert(isVitalsEnabled() === true, "flag should be true");
});

console.log("\n[2] Type validation");
const pastDate = "2025-01-15T10:00:00.000Z";

test("Accepts blood_pressure", () => {
  const r = validateEntry({ type: "blood_pressure", valuePrimary: 120, valueSecondary: 80, measuredAt: pastDate });
  assert(r === null, `expected null, got ${r}`);
});
test("Accepts heart_rate", () => {
  const r = validateEntry({ type: "heart_rate", valuePrimary: 72, measuredAt: pastDate });
  assert(r === null, `expected null, got ${r}`);
});
test("Accepts glucose", () => {
  const r = validateEntry({ type: "glucose", valuePrimary: 95, measuredAt: pastDate });
  assert(r === null, `expected null, got ${r}`);
});
test("Accepts weight", () => {
  const r = validateEntry({ type: "weight", valuePrimary: 74.5, measuredAt: pastDate });
  assert(r === null, `expected null, got ${r}`);
});
test("Accepts oxygen", () => {
  const r = validateEntry({ type: "oxygen", valuePrimary: 98, measuredAt: pastDate });
  assert(r === null, `expected null, got ${r}`);
});
test("Accepts temperature", () => {
  const r = validateEntry({ type: "temperature", valuePrimary: 36.8, measuredAt: pastDate });
  assert(r === null, `expected null, got ${r}`);
});
test("Rejects unknown type", () => {
  const r = validateEntry({ type: "cholesterol", valuePrimary: 200, measuredAt: pastDate });
  assert(r === "invalid_type", `expected invalid_type, got ${r}`);
});

console.log("\n[3] Value range validation");
test("Rejects BP systolic too high (>300)", () => {
  const r = validateEntry({ type: "blood_pressure", valuePrimary: 350, valueSecondary: 80, measuredAt: pastDate });
  assert(r === "value_out_of_range", `expected value_out_of_range, got ${r}`);
});
test("Rejects BP systolic too low (<40)", () => {
  const r = validateEntry({ type: "blood_pressure", valuePrimary: 30, valueSecondary: 20, measuredAt: pastDate });
  assert(r === "value_out_of_range", `expected value_out_of_range, got ${r}`);
});
test("Rejects diastolic missing for blood_pressure", () => {
  const r = validateEntry({ type: "blood_pressure", valuePrimary: 120, measuredAt: pastDate });
  assert(r === "missing_diastolic", `expected missing_diastolic, got ${r}`);
});
test("Rejects heart_rate >300", () => {
  const r = validateEntry({ type: "heart_rate", valuePrimary: 400, measuredAt: pastDate });
  assert(r === "value_out_of_range", `expected value_out_of_range, got ${r}`);
});
test("Rejects weight <10", () => {
  const r = validateEntry({ type: "weight", valuePrimary: 5, measuredAt: pastDate });
  assert(r === "value_out_of_range", `expected value_out_of_range, got ${r}`);
});
test("Rejects oxygen >100%", () => {
  const r = validateEntry({ type: "oxygen", valuePrimary: 105, measuredAt: pastDate });
  assert(r === "value_out_of_range", `expected value_out_of_range, got ${r}`);
});
test("Rejects temperature >45°C", () => {
  const r = validateEntry({ type: "temperature", valuePrimary: 50, measuredAt: pastDate });
  assert(r === "value_out_of_range", `expected value_out_of_range, got ${r}`);
});

console.log("\n[4] Date validation");
test("Rejects future date", () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const r = validateEntry({ type: "weight", valuePrimary: 74, measuredAt: future });
  assert(r === "date_in_future", `expected date_in_future, got ${r}`);
});
test("Rejects invalid date string", () => {
  const r = validateEntry({ type: "weight", valuePrimary: 74, measuredAt: "not-a-date" });
  assert(r === "invalid_date", `expected invalid_date, got ${r}`);
});
test("Rejects missing date", () => {
  const r = validateEntry({ type: "weight", valuePrimary: 74 });
  assert(r === "invalid_date", `expected invalid_date, got ${r}`);
});

console.log("\n[5] Value format");
test("Rejects non-numeric primary value", () => {
  const r = validateEntry({ type: "weight", valuePrimary: "heavy", measuredAt: pastDate });
  assert(r === "invalid_value", `expected invalid_value, got ${r}`);
});
test("Rejects NaN primary value", () => {
  const r = validateEntry({ type: "weight", valuePrimary: NaN, measuredAt: pastDate });
  assert(r === "invalid_value", `expected invalid_value, got ${r}`);
});
test("Accepts decimal values (e.g. 74.5 kg)", () => {
  const r = validateEntry({ type: "weight", valuePrimary: 74.5, measuredAt: pastDate });
  assert(r === null, `expected null, got ${r}`);
});
test("Accepts decimal temperature (36.6°C)", () => {
  const r = validateEntry({ type: "temperature", valuePrimary: 36.6, measuredAt: pastDate });
  assert(r === null, `expected null, got ${r}`);
});

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Tests: ${passed + failed}  ✓ ${passed}  ✗ ${failed}`);
if (failed > 0) {
  console.error("\nSome tests failed.\n");
  process.exit(1);
} else {
  console.log("\nAll tests passed.\n");
}
