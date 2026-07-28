/**
 * Backfill guarantees that can be checked without a database.
 *
 * The sandbox script proves the migration behaves correctly against real
 * PostgreSQL. This file proves the two things a sandbox run cannot: that the
 * classification premise still holds in the source tree (every historical write
 * path is patient-owned), and that the migration text itself never does the one
 * thing it must never do — invent a treatment context.
 *
 * Run: node --test scripts/verifyPatientDataScopeBackfill.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");

const MODELS = ["VitalEntry", "VaccinationEntry", "AllergyEntry", "DiagnosisEntry"];
const PRISMA_MODELS = ["vitalEntry", "vaccinationEntry", "allergyEntry", "diagnosisEntry"];
const CONTEXT_MIGRATION = "20260728090000_add_patient_data_context";
const BACKFILL_MIGRATION = "20260728120000_backfill_patient_data_scope";

const migrationSql = readFileSync(
  join(serverDir, "prisma", "migrations", BACKFILL_MIGRATION, "migration.sql"),
  "utf8",
);

/**
 * SQL with comments removed. Every assertion below runs against this, because
 * an earlier review round produced a false positive by matching a word that
 * only ever appeared inside a comment.
 */
const sqlOnly = migrationSql
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

/** Every .js/.mjs file under server/, excluding generated and verification code. */
function sourceFiles() {
  const out = [];
  const skipDirs = new Set(["node_modules", ".git", "generated", "migrations", "uploads", "coverage"]);
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (!skipDirs.has(entry)) walk(full);
      } else if (/\.(js|mjs)$/.test(entry) && !/\.test\.js$/.test(entry) && !/Sandbox\.mjs$/.test(entry)) {
        out.push(full);
      }
    }
  })(serverDir);
  return out;
}

const SOURCES = sourceFiles().map((f) => ({ path: relative(serverDir, f), text: readFileSync(f, "utf8") }));

/* ======================================================================== */
/* 1. The classification premise: every historical write path is the patient's */
/* ======================================================================== */

test("1a. only the known five write paths create records in the four models", () => {
  const pattern = new RegExp(`(${PRISMA_MODELS.join("|")})\\.(create|createMany|upsert)\\b`);
  const found = SOURCES.filter((f) => pattern.test(f.text)).map((f) => f.path).sort();

  assert.deepEqual(found, [
    "routes/patientAllergies.js",
    "routes/patientDiagnoses.js",
    "routes/patientVaccinations.js",
    "routes/patientVitals.js",
    "services/wearables/importService.js",
  ], "an unknown write path appeared — the backfill premise must be re-verified before it may run");
});

test("1b. no practice route writes to any of the four models", () => {
  const pattern = new RegExp(`(${PRISMA_MODELS.join("|")})\\.(create|createMany|upsert|update|updateMany|delete|deleteMany)\\b`);
  const offenders = SOURCES
    .filter((f) => f.path.startsWith("routes/practice") && pattern.test(f.text))
    .map((f) => f.path);

  assert.deepEqual(offenders, [], "a practice route mutates patient-owned medical data");
});

test("1c. no createMany or upsert on the four models anywhere", () => {
  const pattern = new RegExp(`(${PRISMA_MODELS.join("|")})\\.(createMany|upsert)\\b`);
  const offenders = SOURCES.filter((f) => pattern.test(f.text)).map((f) => f.path);
  assert.deepEqual(offenders, [], "a bulk write path exists — it would bypass the scope-setting service");
});

test("1d. no raw SQL writes to the four tables", () => {
  // Reading them raw is fine — the readiness script counts rows that way.
  // Writing them raw is not: it would bypass the scope-setting service and
  // could produce an unclassified record that NOT NULL alone cannot catch,
  // because raw SQL may supply any value it likes.
  const writeToModel = new RegExp(
    `(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+"(${MODELS.join("|")})"`,
    "i",
  );
  const offenders = SOURCES
    .filter((f) => /\$(executeRaw|queryRaw)/.test(f.text) && writeToModel.test(f.text))
    .map((f) => f.path);
  assert.deepEqual(offenders, [], "raw SQL writes could produce unclassified rows");
});

test("1e. every one of the five write paths sets the scope explicitly", () => {
  const paths = [
    "routes/patientVitals.js",
    "routes/patientVaccinations.js",
    "routes/patientAllergies.js",
    "routes/patientDiagnoses.js",
    "services/wearables/importService.js",
  ];
  for (const p of paths) {
    const file = SOURCES.find((f) => f.path === p);
    assert.ok(file, `${p} not found`);
    assert.match(
      file.text,
      /\.\.\.context,|\.\.\.personalImportContext\(\)/,
      `${p} does not spread a scope-bearing context — NOT NULL would break it at runtime`,
    );
  }
});

/* ======================================================================== */
/* 2. What the migration does — and above all, what it never does           */
/* ======================================================================== */

test("2a. the backfill migration sorts after the schema migration", () => {
  assert.ok(BACKFILL_MIGRATION > CONTEXT_MIGRATION, "Prisma applies migrations in lexical order");
  const dirs = readdirSync(join(serverDir, "prisma", "migrations")).filter((d) => /^\d{14}_/.test(d));
  assert.ok(dirs.includes(BACKFILL_MIGRATION));
  assert.ok(dirs.includes(CONTEXT_MIGRATION));
});

test("2b. exactly four UPDATE statements, one per model, all setting patient_global", () => {
  const updates = [...sqlOnly.matchAll(/UPDATE\s+"(\w+)"[\s\S]*?;/g)];
  assert.equal(updates.length, 4, "expected exactly one UPDATE per model");
  assert.deepEqual(updates.map((m) => m[1]).sort(), [...MODELS].sort());

  for (const [stmt, model] of updates) {
    assert.match(stmt, /SET\s+"dataScope"\s*=\s*'patient_global'/, `${model}: wrong target scope`);
    assert.match(stmt, /WHERE\s+"dataScope"\s+IS\s+NULL/, `${model}: missing unclassified condition`);
    assert.match(stmt, /AND\s+"contextPracticePatientLinkId"\s+IS\s+NULL/, `${model}: missing context-free condition`);
  }
});

test("2c. the migration never writes practice_contextual and never assigns a link", () => {
  const updates = [...sqlOnly.matchAll(/UPDATE\s+"\w+"[\s\S]*?;/g)].map((m) => m[0]);
  for (const stmt of updates) {
    assert.doesNotMatch(stmt, /=\s*'practice_contextual'/, "a backfill must never claim a treatment context");
    assert.doesNotMatch(stmt, /"contextPracticePatientLinkId"\s*=/, "a backfill must never assign a link id");
    assert.doesNotMatch(stmt, /"practiceProfileId"/, "a backfill must never derive a practice");
  }
});

test("2d. the migration derives nothing from links, appointments or timestamps", () => {
  const updates = [...sqlOnly.matchAll(/UPDATE\s+"\w+"[\s\S]*?;/g)].map((m) => m[0]);
  for (const stmt of updates) {
    assert.doesNotMatch(stmt, /\bJOIN\b|\bFROM\b|\bEXISTS\b|\bIN\s*\(\s*SELECT/i,
      "the classification must not depend on any other table");
    // Matched as a quoted table reference: the column name
    // "contextPracticePatientLinkId" legitimately contains the same substring.
    assert.doesNotMatch(stmt, /"(PracticePatientLink|PracticeAppointment|PracticeProfile)"/,
      "origin must not be inferred from a link, an appointment or a practice");
    assert.doesNotMatch(stmt, /"createdAt"|"updatedAt"/,
      "origin must not be inferred from a date");
  }
});

test("2e. soft-deleted rows are classified too", () => {
  const updates = [...sqlOnly.matchAll(/UPDATE\s+"\w+"[\s\S]*?;/g)].map((m) => m[0]);
  for (const stmt of updates) {
    assert.doesNotMatch(stmt, /"deletedAt"/,
      "restricting to live rows would leave soft-deleted rows unclassified and block NOT NULL");
  }
});

test("2f. all three ambiguous states abort the migration before anything is written", () => {
  const preconditions = sqlOnly.slice(0, sqlOnly.indexOf("UPDATE"));
  assert.match(preconditions, /"dataScope" IS NULL AND "contextPracticePatientLinkId" IS NOT NULL/);
  assert.match(preconditions, /"dataScope" = ''patient_global'' AND "contextPracticePatientLinkId" IS NOT NULL/);
  assert.match(preconditions, /"dataScope" = ''practice_contextual'' AND "contextPracticePatientLinkId" IS NULL/);
  assert.equal((preconditions.match(/RAISE EXCEPTION/g) || []).length, 3, "one abort per ambiguous state");
});

test("2g. the result is validated inside the same migration", () => {
  const afterUpdates = sqlOnly.slice(sqlOnly.lastIndexOf("UPDATE"));
  assert.match(afterUpdates, /count\(\*\) FROM %I WHERE "dataScope" IS NULL/);
  assert.match(afterUpdates, /RAISE EXCEPTION[\s\S]*still unclassified/);
});

test("2h. dataScope becomes NOT NULL for all four models, with no default", () => {
  for (const model of MODELS) {
    assert.match(
      sqlOnly,
      new RegExp(`ALTER TABLE "${model}"\\s+ALTER COLUMN "dataScope" SET NOT NULL`),
      `${model}: missing NOT NULL`,
    );
  }
  assert.doesNotMatch(sqlOnly, /SET DEFAULT/, "a default would let a forgotten write path pass silently");
});

test("2i. the tightened CHECK permits exactly the two legal shapes", () => {
  for (const model of MODELS) {
    const re = new RegExp(`ADD CONSTRAINT "${model}_dataScope_context_check" CHECK \\(([\\s\\S]*?)\\n\\);`);
    const match = sqlOnly.match(re);
    assert.ok(match, `${model}: constraint not rebuilt`);
    const body = match[1];
    assert.match(body, /WHEN "dataScope" = 'patient_global'\s+THEN "contextPracticePatientLinkId" IS NULL/);
    assert.match(body, /WHEN "dataScope" = 'practice_contextual'\s+THEN "contextPracticePatientLinkId" IS NOT NULL/);
    assert.match(body, /ELSE false/, "anything unlisted, including a NULL scope, must be rejected");
    assert.doesNotMatch(body, /WHEN "dataScope" IS NULL/, "the transitional state is no longer permitted");
  }
});

test("2j. no table other than the four is touched", () => {
  const tables = new Set([...sqlOnly.matchAll(/(?:UPDATE|ALTER TABLE)\s+"(\w+)"/g)].map((m) => m[1]));
  assert.deepEqual([...tables].sort(), [...MODELS].sort());
});

test("2k. no medical content can reach the migration log", () => {
  const messages = [...sqlOnly.matchAll(/RAISE (?:EXCEPTION|NOTICE)\s*\n?\s*'([^']*)'/g)].map((m) => m[1]);
  assert.ok(messages.length > 0);
  const medicalColumns = /allergen|vaccineName|conditionName|icdCode|valuePrimary|reaction|diagnosedDate|notes/i;
  for (const msg of messages) {
    assert.doesNotMatch(msg, medicalColumns, `log message would expose medical content: ${msg}`);
  }
  // Only counts and table names are interpolated.
  assert.doesNotMatch(sqlOnly, /RAISE[\s\S]{0,400}?SELECT\s+"(allergen|vaccineName|conditionName)"/);
});

/* ======================================================================== */
/* 3. Idempotency of the backfill semantics                                  */
/* ======================================================================== */

/** The exact WHERE/SET of the migration, as plain JavaScript. */
function applyBackfill(rows) {
  let changed = 0;
  for (const row of rows) {
    if (row.dataScope === null && row.contextPracticePatientLinkId === null) {
      row.dataScope = "patient_global";
      changed += 1;
    }
  }
  return changed;
}

function fixture() {
  return [
    { id: "legacy", dataScope: null, contextPracticePatientLinkId: null, deletedAt: null },
    { id: "legacyDeleted", dataScope: null, contextPracticePatientLinkId: null, deletedAt: "2026-01-01" },
    { id: "global", dataScope: "patient_global", contextPracticePatientLinkId: null, deletedAt: null },
    { id: "ctx", dataScope: "practice_contextual", contextPracticePatientLinkId: "lkA", deletedAt: null },
  ];
}

test("3a. the first run classifies only the unclassified rows", () => {
  const rows = fixture();
  assert.equal(applyBackfill(rows), 2, "exactly the two legacy rows");
  assert.equal(rows.find((r) => r.id === "legacy").dataScope, "patient_global");
  assert.equal(rows.find((r) => r.id === "legacyDeleted").dataScope, "patient_global");
});

test("3b. a soft-deleted legacy row is classified and stays deleted", () => {
  const rows = fixture();
  applyBackfill(rows);
  const row = rows.find((r) => r.id === "legacyDeleted");
  assert.equal(row.dataScope, "patient_global");
  assert.equal(row.deletedAt, "2026-01-01");
});

test("3c. already classified rows are left exactly as they were", () => {
  const rows = fixture();
  applyBackfill(rows);
  assert.deepEqual(rows.find((r) => r.id === "global"),
    { id: "global", dataScope: "patient_global", contextPracticePatientLinkId: null, deletedAt: null });
  assert.deepEqual(rows.find((r) => r.id === "ctx"),
    { id: "ctx", dataScope: "practice_contextual", contextPracticePatientLinkId: "lkA", deletedAt: null });
});

test("3d. no row ever gains a context link", () => {
  const rows = fixture();
  applyBackfill(rows);
  const withLink = rows.filter((r) => r.contextPracticePatientLinkId !== null).map((r) => r.id);
  assert.deepEqual(withLink, ["ctx"], "only the row that already had one");
  assert.equal(rows.filter((r) => r.dataScope === "practice_contextual").length, 1);
});

test("3e. a second run changes nothing", () => {
  const rows = fixture();
  applyBackfill(rows);
  const snapshot = JSON.stringify(rows);
  assert.equal(applyBackfill(rows), 0, "second run must be a no-op");
  assert.equal(JSON.stringify(rows), snapshot, "second run must not alter any row");
});

/* ======================================================================== */
/* 4. Schema                                                                 */
/* ======================================================================== */

test("4a. dataScope is mandatory in the Prisma schema for all four models", () => {
  const schema = readFileSync(join(serverDir, "prisma", "schema.prisma"), "utf8");
  assert.doesNotMatch(schema, /dataScope\s+PatientDataScope\?/, "no model may keep an optional scope");
  assert.equal((schema.match(/dataScope\s+PatientDataScope\b/g) || []).length, 4);
  assert.doesNotMatch(schema, /dataScope\s+PatientDataScope\s+@default/, "no default in the schema either");
});
