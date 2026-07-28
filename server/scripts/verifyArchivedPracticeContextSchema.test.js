/**
 * Schema guarantees for archived practice contexts.
 *
 * The sandbox script proves the constraints behave correctly against real
 * PostgreSQL. This file proves what a sandbox cannot: that the migration is
 * additive, that the archive model carries no medical content and no foreign
 * key to the rows it outlives, and that the invariant now names exactly three
 * legal shapes.
 *
 * Run: node --test scripts/verifyArchivedPracticeContextSchema.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const prismaDir = join(here, "..", "prisma");

const MIGRATION = "20260729100000_add_archived_practice_patient_context";
const MODEL = "ArchivedPracticePatientContext";
const TARGETS = ["VitalEntry", "VaccinationEntry", "AllergyEntry", "DiagnosisEntry"];

const schema = readFileSync(join(prismaDir, "schema.prisma"), "utf8");
const sql = readFileSync(join(prismaDir, "migrations", MIGRATION, "migration.sql"), "utf8");

/** SQL with comments stripped — a comment must never satisfy an assertion. */
const sqlOnly = sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");

function modelBody(name) {
  const m = schema.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(m, `model ${name} not found`);
  return m[1];
}

/* --------------------------------------------------------------- the model */

test("1) the archive model exists with its historical references", () => {
  const body = modelBody(MODEL);
  for (const field of [
    "patientUserId", "originalPracticePatientLinkId", "originalPracticeProfileId",
    "practiceDisplayNameSnapshot", "practiceSpecialtySnapshot", "archiveReason", "archivedAt",
  ]) {
    assert.match(body, new RegExp(`^\\s+${field}\\s`, "m"), `${field} missing`);
  }
  assert.match(body, /originalPracticePatientLinkId String\s+@unique/,
    "one archive per former link keeps archiving idempotent");
});

test("2) the only foreign key is the patient — never the practice or the link", () => {
  const body = modelBody(MODEL);
  const relations = [...body.matchAll(/@relation\("(\w+)", fields: \[(\w+)\]/g)].map((m) => m[2]);
  assert.deepEqual(relations, ["patientUserId"],
    "a foreign key to a deleted practice or link is exactly what an archive must not have");
});

test("3) the archive carries no medical content and no staff identity", () => {
  // Scalar fields only: the back-relation list names the four models on
  // purpose, and comments are prose. Neither stores anything.
  const scalars = modelBody(MODEL)
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("///") && !l.trim().startsWith("@@"))
    .filter((l) => !/\[\]\s*@relation/.test(l))
    .join("\n");
  assert.doesNotMatch(
    scalars,
    /diagnos|allerg|vaccin|vital|measurement|title|fileName|storageKey|note|createdByUserId|memberId/i,
    `an archive records that a context ended, not what was in it: ${scalars}`,
  );
});

test("4) the archive reason names only real hard deletions", () => {
  const m = schema.match(/^enum PracticeContextArchiveReason \{([\s\S]*?)^\}/m);
  assert.ok(m, "enum missing");
  const values = m[1].split("\n").map((l) => l.trim()).filter(Boolean).sort();
  assert.deepEqual(values, ["owner_account_deleted", "practice_deleted"],
    "revoking a link is a status change and must not be an archive reason");
});

/* --------------------------------------------------- the four target models */

test("5) each patient-owned model gains a restricted archive reference", () => {
  for (const model of TARGETS) {
    const body = modelBody(model);
    assert.match(body, /^\s+archivedPracticeContextId\s+String\?/m, `${model}: column missing`);
    assert.match(
      body,
      /archivedPracticeContext\s+ArchivedPracticePatientContext\?\s+@relation\("\w+", fields: \[archivedPracticeContextId\], references: \[id\], onDelete: Restrict\)/,
      `${model}: an archive must not be removable while records point at it`,
    );
    assert.match(body, /@@index\(\[archivedPracticeContextId\]\)/, `${model}: index missing`);
  }
});

/* ----------------------------------------------------------- the migration */

test("6) the migration is additive — nothing is archived, changed or deleted", () => {
  const created = [...sqlOnly.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(created, [MODEL]);

  assert.doesNotMatch(sqlOnly, /\bUPDATE\s+"/, "no existing row may be changed");
  assert.doesNotMatch(sqlOnly, /\bDELETE\s+FROM\b/, "nothing may be deleted");
  assert.doesNotMatch(sqlOnly, /INSERT\s+INTO/, "no context may be archived by the migration");

  // The only DROPs are the four CHECK constraints being replaced.
  const drops = [...sqlOnly.matchAll(/DROP CONSTRAINT "(\w+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(drops, TARGETS.map((t) => `${t}_dataScope_context_check`).sort());
});

test("7) the migration sorts after every existing one", () => {
  const dirs = readdirSync(join(prismaDir, "migrations")).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION);
});

test("8) four restricted foreign keys to the archive, one per model", () => {
  const fks = [...sqlOnly.matchAll(
    /ADD CONSTRAINT "(\w+)_archivedPracticeContextId_fkey"[\s\S]*?ON DELETE (\w+)/g,
  )];
  assert.deepEqual(fks.map((m) => m[1]).sort(), [...TARGETS].sort());
  for (const [, model, rule] of fks) assert.equal(rule, "RESTRICT", `${model}`);
});

test("9) the patient reference cascades, so no archive outlives its patient", () => {
  assert.match(
    sqlOnly,
    /ArchivedPracticePatientContext_patientUserId_fkey"\s+FOREIGN KEY \("patientUserId"\) REFERENCES "User"\("id"\)\s+ON DELETE CASCADE/,
  );
});

test("10) the invariant permits exactly three shapes and rejects everything else", () => {
  const checks = [...sqlOnly.matchAll(/ADD CONSTRAINT "(\w+)_dataScope_context_check" CHECK \(([\s\S]*?)\n\);/g)];
  assert.equal(checks.length, 4, "one per model");

  for (const [, model, body] of checks) {
    // patient_global: neither context id
    assert.match(body, /WHEN "dataScope" = 'patient_global' THEN\s*\n\s*"contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NULL/,
      `${model}: global must carry no context at all`);
    // practice_contextual: exactly one of the two
    assert.match(body, /\("contextPracticePatientLinkId" IS NOT NULL AND "archivedPracticeContextId" IS NULL\)/,
      `${model}: live shape missing`);
    assert.match(body, /\("contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NOT NULL\)/,
      `${model}: archived shape missing`);
    // and nothing else, including a NULL scope
    assert.match(body, /ELSE false/, `${model}: an unknown or NULL scope must be rejected`);
    assert.doesNotMatch(body, /WHEN "dataScope" IS NULL/, `${model}: no permissive NULL branch`);
  }
});

test("11) an archived record keeps its practice scope — it is never re-labelled", () => {
  // The scope value patient_global must not appear as an assignment anywhere in
  // this migration: archiving must never turn a practice record into the
  // patient's own global data.
  // The value appears in the CHECK as a comparison; what must never appear is
  // an assignment of it, or any assignment to dataScope at all.
  assert.doesNotMatch(sqlOnly, /SET[\s\S]{0,80}?'patient_global'/,
    "no statement may set a record to global");
  assert.doesNotMatch(sqlOnly, /SET\s+"dataScope"/, "no statement may change a scope");
});
