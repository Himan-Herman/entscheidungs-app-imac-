/**
 * Schema + migration guards for the patient data context fields.
 *
 * These run without a database: they read schema.prisma and the migration SQL
 * as text. The constraint semantics were additionally verified for real against
 * a throwaway PostgreSQL database (see the commit message); those results are
 * pinned here as expectations on the SQL so a later edit cannot weaken them
 * unnoticed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const prismaDir = join(here, "..", "prisma");
const schema = readFileSync(join(prismaDir, "schema.prisma"), "utf8");

const MIGRATION = "20260728090000_add_patient_data_context";
const sql = readFileSync(join(prismaDir, "migrations", MIGRATION, "migration.sql"), "utf8");

/** The four patient-owned models that gain a context in this commit. */
const TARGETS = ["VitalEntry", "VaccinationEntry", "AllergyEntry", "DiagnosisEntry"];

const RELATION_NAMES = {
  VitalEntry: "VitalEntryContextLink",
  VaccinationEntry: "VaccinationEntryContextLink",
  AllergyEntry: "AllergyEntryContextLink",
  DiagnosisEntry: "DiagnosisEntryContextLink",
};

/** Extracts one model body from schema.prisma. */
function modelBody(name) {
  const m = schema.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(m, `model ${name} not found`);
  return m[1];
}

/* ------------------------------------------------------------------ schema */

test("1) all four models carry dataScope", () => {
  for (const model of TARGETS) {
    assert.match(
      modelBody(model), /^\s+dataScope\s+PatientDataScope\?/m,
      `${model}: dataScope missing or not nullable`,
    );
  }
});

test("2) all four models carry contextPracticePatientLinkId", () => {
  for (const model of TARGETS) {
    assert.match(
      modelBody(model), /^\s+contextPracticePatientLinkId\s+String\?/m,
      `${model}: context id missing or not nullable`,
    );
  }
});

test("3) all four have a real relation to PracticePatientLink with Restrict", () => {
  for (const model of TARGETS) {
    const body = modelBody(model);
    const rel = body.match(
      /^\s+contextPracticePatientLink\s+PracticePatientLink\?\s+@relation\((.*)\)/m,
    );
    assert.ok(rel, `${model}: relation field missing`);
    assert.match(rel[1], /fields: \[contextPracticePatientLinkId\]/, `${model}: wrong fields`);
    assert.match(rel[1], /references: \[id\]/, `${model}: wrong reference`);
    assert.match(
      rel[1], /onDelete: Restrict/,
      `${model}: must be Restrict — a contextual record may never silently lose its origin`,
    );
    assert.ok(rel[1].includes(RELATION_NAMES[model]), `${model}: relation name missing`);
  }

  // Named back-relations live on PracticePatientLink, not on PracticeProfile.
  const link = modelBody("PracticePatientLink");
  const profile = modelBody("PracticeProfile");
  for (const [model, name] of Object.entries(RELATION_NAMES)) {
    assert.ok(link.includes(`@relation("${name}")`), `back-relation ${name} missing on the link`);
    assert.ok(link.includes(`${model}[]`), `${model}[] missing on PracticePatientLink`);
    assert.ok(!profile.includes(name), `${name} must not sit on PracticeProfile`);
  }
});

test("4) all four have the context index and the composite query index", () => {
  for (const model of TARGETS) {
    const body = modelBody(model);
    assert.ok(
      body.includes("@@index([contextPracticePatientLinkId])"),
      `${model}: context index missing`,
    );
    assert.ok(
      body.includes("@@index([userId, dataScope, contextPracticePatientLinkId, deletedAt])"),
      `${model}: composite index missing`,
    );
  }
});

test("the enum exposes exactly the two intended values", () => {
  const e = schema.match(/^enum PatientDataScope \{([\s\S]*?)^\}/m);
  assert.ok(e, "enum missing");
  const values = e[1].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("/"));
  assert.deepEqual(values, ["patient_global", "practice_contextual"]);
});

/** Body of a model's dataScope/context check constraint. */
function checkBody(model) {
  const m = sql.match(
    new RegExp(`ALTER TABLE "${model}" ADD CONSTRAINT "${model}_dataScope_context_check" CHECK \\(([\\s\\S]*?)\\);`),
  );
  assert.ok(m, `${model}: check constraint missing`);
  return m[1];
}

/* --------------------------------------------------------------- migration */

test("5) the migration contains no backfill and no data change", () => {
  // Checked per statement, not per substring: "ON UPDATE CASCADE" is a
  // referential action on a foreign key, not a data-modifying UPDATE.
  const statements = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const FORBIDDEN_LEADING = /^(UPDATE|DELETE|INSERT|TRUNCATE|DROP)\b/i;
  for (const statement of statements) {
    assert.ok(
      !FORBIDDEN_LEADING.test(statement),
      `migration must not start a statement with a data-changing keyword: "${statement.slice(0, 60)}…"`,
    );
  }

  // Only additive DDL is expected.
  const ALLOWED_LEADING = /^(CREATE TYPE|ALTER TABLE|CREATE INDEX)\b/i;
  for (const statement of statements) {
    assert.ok(
      ALLOWED_LEADING.test(statement),
      `unexpected statement kind: "${statement.slice(0, 60)}…"`,
    );
  }
});

test("6) the migration sets no default on dataScope", () => {
  assert.ok(!/DEFAULT\s+'patient_global'/i.test(sql), "must not default to patient_global");
  assert.ok(!/"dataScope"[^;]*DEFAULT/i.test(sql), "dataScope must have no default at all");
  assert.ok(
    !/@default\(patient_global\)/.test(schema),
    "schema must not default dataScope either",
  );
});

test("7) the check constraint allows the three legitimate states", () => {
  // Verified for real against PostgreSQL (verifyPatientDataContextSandbox.mjs).
  for (const model of TARGETS) {
    const c = checkBody(model);
    assert.match(
      c, /WHEN "dataScope" IS NULL\s+THEN "contextPracticePatientLinkId" IS NULL/,
      `${model}: legacy state must be allowed only without a context`,
    );
    assert.match(
      c, /WHEN "dataScope" = 'patient_global'\s+THEN "contextPracticePatientLinkId" IS NULL/,
      `${model}: patient_global must require an empty context`,
    );
    assert.match(
      c, /WHEN "dataScope" = 'practice_contextual'\s+THEN "contextPracticePatientLinkId" IS NOT NULL/,
      `${model}: practice_contextual must require a context`,
    );
  }
});

test("8) the check constraint forbids every other combination", () => {
  for (const model of TARGETS) {
    const c = checkBody(model);
    // A CASE, not a chain of ORs: with ORs the row (NULL, 'x') evaluates to
    // UNKNOWN and PostgreSQL accepts it. Caught by the sandbox run.
    assert.match(c, /^\s*CASE/m, `${model}: must be written as CASE`);
    assert.match(c, /ELSE false/, `${model}: unknown scope values must be rejected`);
    assert.ok(
      !/OR \("dataScope"/.test(c),
      `${model}: the OR form lets (NULL, context) through as UNKNOWN`,
    );
  }
});

test("9) a link with contextual records cannot be hard-deleted", () => {
  // Schema side: Restrict, asserted in test 3.
  // SQL side: the foreign key must spell it out.
  for (const model of TARGETS) {
    const fk = sql.match(
      new RegExp(`ADD CONSTRAINT "${model}_contextPracticePatientLinkId_fkey"[\\s\\S]*?ON DELETE (\\w+)`),
    );
    assert.ok(fk, `${model}: foreign key missing`);
    assert.equal(fk[1], "RESTRICT", `${model}: must be ON DELETE RESTRICT, found ${fk[1]}`);
  }
  assert.ok(!/ON DELETE CASCADE/.test(sql), "no cascade may reach a medical record");
  assert.ok(!/ON DELETE SET NULL/.test(sql), "SetNull would silently orphan the origin");
});

test("the migration is ordered after the pending clinical role migration", () => {
  const dirs = readdirSync(join(prismaDir, "migrations")).filter((d) => /^\d{14}_/.test(d)).sort();
  const clinical = dirs.indexOf("20260727160000_practice_member_clinical_role");
  const context = dirs.indexOf(MIGRATION);
  assert.notEqual(clinical, -1, "clinical role migration missing");
  assert.notEqual(context, -1, "context migration missing");
  assert.ok(context > clinical, "the context migration must sort after the clinical role one");
  assert.equal(context, dirs.length - 1, "the context migration must be the newest");
});

/* --------------------------------------------------------- diff boundary */

test("10) no other medical model gained context fields in this commit", () => {
  const touched = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
    .filter(([, , body]) => /contextPracticePatientLinkId|dataScope\s+PatientDataScope/.test(body))
    .map(([, name]) => name);
  assert.deepEqual(
    touched.sort(), [...TARGETS].sort(),
    "only the four patient-owned models may carry the context fields",
  );

  // The migration must touch exactly those four tables.
  const tables = new Set([...sql.matchAll(/ALTER TABLE "(\w+)"/g)].map((m) => m[1]));
  assert.deepEqual([...tables].sort(), [...TARGETS].sort(), "migration touches other tables");
});
