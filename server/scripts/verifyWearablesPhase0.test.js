/**
 * Wearables Phase 0 — import service + provider registry.
 * Runs without a database: prisma.vitalEntry is mocked via a module-level stub.
 * Verifies validation, scope gating, idempotency and batch-duplicate handling.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { validateVital, DEFAULT_UNITS, VALID_TYPES } from "../services/vitals/vitalConstants.js";
import { sanitizeScopes, isConnectableProvider, isKnownProvider, getProvider } from "../services/wearables/providers.js";

const iso = (d) => new Date(d).toISOString();
const past = iso(Date.now() - 3600_000);

test("validateVital accepts a plausible reading", () => {
  assert.equal(validateVital({ type: "heart_rate", valuePrimary: 72, measuredAt: past }), null);
});

test("validateVital rejects out-of-range, future dates and unknown types", () => {
  assert.equal(validateVital({ type: "heart_rate", valuePrimary: 5000, measuredAt: past }), "value_out_of_range");
  assert.equal(validateVital({ type: "nonsense", valuePrimary: 10, measuredAt: past }), "invalid_type");
  assert.equal(
    validateVital({ type: "heart_rate", valuePrimary: 70, measuredAt: iso(Date.now() + 86_400_000) }),
    "date_in_future"
  );
});

test("blood_pressure requires a diastolic value", () => {
  assert.equal(validateVital({ type: "blood_pressure", valuePrimary: 120, measuredAt: past }), "missing_diastolic");
  assert.equal(
    validateVital({ type: "blood_pressure", valuePrimary: 120, valueSecondary: 80, measuredAt: past }),
    null
  );
});

test("sanitizeScopes drops unknown types and defaults to provider capabilities", () => {
  assert.deepEqual(sanitizeScopes("apple_health", ["heart_rate", "hacking", "weight"]), ["heart_rate", "weight"]);
  assert.deepEqual(sanitizeScopes("apple_health", []), getProvider("apple_health").supportedTypes);
  assert.deepEqual(sanitizeScopes("unknown_provider", ["heart_rate"]), []);
  // never yields a type outside the supported vitals
  for (const s of sanitizeScopes("withings", null)) assert.ok(VALID_TYPES.includes(s));
});

test("only app-backed providers are connectable", () => {
  assert.ok(isConnectableProvider("apple_health"));
  assert.ok(isConnectableProvider("health_connect"));
  assert.equal(isConnectableProvider("withings"), false, "planned cloud provider must not be connectable yet");
  assert.equal(isKnownProvider("evil_provider"), false);
});

// ── importVitalEntries with a mocked prisma ────────────────────────────────
const { importVitalEntries, MAX_IMPORT_BATCH } = await import("../services/wearables/importService.js");
const prismaModule = await import("../lib/prisma.js");
function mockPrisma() {
  const rows = [];
  prismaModule.prisma.vitalEntry = {
    findUnique: async ({ where }) => {
      const k = where.userId_sourceProvider_externalId;
      return rows.find(r => r.userId === k.userId && r.sourceProvider === k.sourceProvider && r.externalId === k.externalId) || null;
    },
    create: async ({ data }) => { rows.push(data); return data; },
  };
  // The import now runs the batch in one transaction and locks the user row
  // first. $queryRaw lives on the client prototype, so it must be overridden
  // rather than deleted — every fixture user exists.
  prismaModule.prisma.$transaction = async (fn) => fn(prismaModule.prisma);
  prismaModule.prisma.$queryRaw = async (_strings, ...values) => [{ id: values[0] }];
  return rows;
}

test("import stores valid entries with import provenance", async () => {
  const rows = mockPrisma();
  const res = await importVitalEntries({
    userId: "u1", provider: "apple_health", allowedTypes: ["heart_rate"],
    entries: [{ type: "heart_rate", valuePrimary: 68, measuredAt: past, externalId: "a1" }],
  });
  assert.equal(res.imported, 1);
  assert.equal(rows[0].source, "import");
  assert.equal(rows[0].sourceProvider, "apple_health");
  assert.equal(rows[0].unit, DEFAULT_UNITS.heart_rate);
});

test("import is idempotent — re-sending the same externalId does not duplicate", async () => {
  const rows = mockPrisma();
  const batch = { userId: "u1", provider: "apple_health", allowedTypes: ["heart_rate"],
    entries: [{ type: "heart_rate", valuePrimary: 68, measuredAt: past, externalId: "same" }] };
  const first = await importVitalEntries(batch);
  const second = await importVitalEntries(batch);
  assert.equal(first.imported, 1);
  assert.equal(second.imported, 0);
  assert.equal(second.duplicates, 1);
  assert.equal(rows.length, 1, "must not create a second row");
});

test("import rejects types outside the consented scope", async () => {
  const rows = mockPrisma();
  const res = await importVitalEntries({
    userId: "u1", provider: "apple_health", allowedTypes: ["heart_rate"],
    entries: [{ type: "glucose", valuePrimary: 90, measuredAt: past, externalId: "g1" }],
  });
  assert.equal(res.imported, 0);
  assert.equal(rows.length, 0);
  assert.equal(res.skipped[0].reason, "type_not_in_scope");
});

test("one bad entry never aborts the batch", async () => {
  const rows = mockPrisma();
  const res = await importVitalEntries({
    userId: "u1", provider: "apple_health", allowedTypes: ["heart_rate"],
    entries: [
      { type: "heart_rate", valuePrimary: 70, measuredAt: past, externalId: "ok1" },
      { type: "heart_rate", valuePrimary: 99999, measuredAt: past, externalId: "bad" }, // out of range
      { type: "heart_rate", valuePrimary: 75, measuredAt: past },                        // missing externalId
      { type: "heart_rate", valuePrimary: 80, measuredAt: past, externalId: "ok2" },
    ],
  });
  assert.equal(res.imported, 2);
  assert.equal(rows.length, 2);
  assert.equal(res.skipped.length, 2);
});

test("duplicate externalIds inside one batch are collapsed", async () => {
  const rows = mockPrisma();
  const res = await importVitalEntries({
    userId: "u1", provider: "apple_health", allowedTypes: ["heart_rate"],
    entries: [
      { type: "heart_rate", valuePrimary: 70, measuredAt: past, externalId: "dup" },
      { type: "heart_rate", valuePrimary: 71, measuredAt: past, externalId: "dup" },
    ],
  });
  assert.equal(res.imported, 1);
  assert.equal(rows.length, 1);
  assert.equal(res.skipped[0].reason, "duplicate_in_batch");
});

test("batch cap is a sane bound", () => {
  assert.ok(MAX_IMPORT_BATCH > 0 && MAX_IMPORT_BATCH <= 1000);
});
