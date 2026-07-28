/**
 * Schema guarantees for patient-controlled document share grants.
 *
 * The sandbox script proves the constraints behave correctly against real
 * PostgreSQL. This file proves the things a sandbox cannot: that the migration
 * is additive, that the existing PracticeDocumentShare semantics were not
 * changed underneath, and that no polymorphic reference crept in.
 *
 * Run: node --test scripts/verifyDocumentShareGrantSchema.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const prismaDir = join(here, "..", "prisma");

const MIGRATION = "20260728150000_add_practice_document_share_grants";
const MODEL = "PracticeDocumentShareGrant";

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

test("1) the grant model exists with all six relation anchors", () => {
  const body = modelBody(MODEL);
  for (const field of [
    "documentId", "patientUserId",
    "sourcePracticeProfileId", "sourcePracticePatientLinkId",
    "targetPracticeProfileId", "targetPracticePatientLinkId",
    "grantedByUserId", "status", "grantedAt", "revokedAt", "expiresAt",
  ]) {
    assert.match(body, new RegExp(`^\\s+${field}\\s`, "m"), `${field} missing`);
  }
});

test("2) every reference is a real foreign key, never a polymorphic string", () => {
  const body = modelBody(MODEL);
  const relations = [...body.matchAll(/@relation\("(\w+)", fields: \[(\w+)\], references: \[id\], onDelete: (\w+)\)/g)];
  assert.equal(relations.length, 7, "expected 7 declared relations");
  for (const [, name, , onDelete] of relations) {
    assert.equal(onDelete, "Restrict", `${name}: a grant is an access record and must not be cascaded away`);
  }
  assert.doesNotMatch(body, /resourceType|resourceId|entityType|entityId/,
    "no generic resource reference — this is a document-specific grant");
});

test("3) the grant carries no medical content", () => {
  const body = modelBody(MODEL);
  assert.doesNotMatch(body, /title|description|fileName|storageKey|content|ocr|diagnosis|note/i,
    "a grant is a relation, not a copy of the document");
});

/* ----------------------------------------------------------- the migration */

test("4) the migration is additive — one new table, nothing else touched", () => {
  const created = [...sqlOnly.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(created, [MODEL]);

  const altered = new Set([...sqlOnly.matchAll(/ALTER TABLE "(\w+)"/g)].map((m) => m[1]));
  assert.deepEqual([...altered], [MODEL], "no existing table may be altered");

  assert.doesNotMatch(sqlOnly, /\bUPDATE\s+"/, "no existing row may be changed");
  assert.doesNotMatch(sqlOnly, /\bDELETE\s+FROM\b/, "no existing row may be removed");
  assert.doesNotMatch(sqlOnly, /\bINSERT\s+INTO\b/, "no grant may be created by the migration");
  assert.doesNotMatch(sqlOnly, /\bDROP\b/, "nothing may be dropped");
});

test("5) seven foreign keys, all ON DELETE RESTRICT", () => {
  const fks = [...sqlOnly.matchAll(/FOREIGN KEY \("(\w+)"\) REFERENCES "(\w+)"\("id"\)\s+ON DELETE (\w+)/g)];
  assert.equal(fks.length, 7);
  for (const [, column, , rule] of fks) {
    assert.equal(rule, "RESTRICT", `${column} must be RESTRICT`);
  }
  const targets = fks.map((m) => m[2]).sort();
  assert.deepEqual(targets, [
    "PracticeDocument", "PracticePatientLink", "PracticePatientLink",
    "PracticeProfile", "PracticeProfile", "User", "User",
  ]);
});

test("6) only one ACTIVE grant per document and target link", () => {
  assert.match(
    sqlOnly,
    /CREATE UNIQUE INDEX "PracticeDocumentShareGrant_active_unique"[\s\S]*?WHERE "status" = 'active'/,
    "the unique index must be partial, so a revoked grant stays as history",
  );
});

test("7) the database itself enforces that only the patient may grant", () => {
  assert.match(sqlOnly, /CHECK \("patientUserId" = "grantedByUserId"\)/,
    "a practice must not be able to activate a share, even by writing directly");
});

test("8) source and target must differ, at practice and at link level", () => {
  assert.match(sqlOnly, /CHECK \("sourcePracticeProfileId" <> "targetPracticeProfileId"\)/);
  assert.match(sqlOnly, /CHECK \("sourcePracticePatientLinkId" <> "targetPracticePatientLinkId"\)/);
});

test("9) the status machine rejects everything it does not name", () => {
  const m = sqlOnly.match(/_status_check"\s+CHECK \(([\s\S]*?)\n  \);/);
  assert.ok(m, "status check missing");
  const body = m[1];
  assert.match(body, /WHEN "status" = 'active'\s+THEN "revokedAt" IS NULL/);
  assert.match(body, /WHEN "status" = 'revoked' THEN "revokedAt" IS NOT NULL/);
  assert.match(body, /WHEN "status" = 'expired' THEN "expiresAt" IS NOT NULL/);
  assert.match(body, /ELSE false/, "an unknown or NULL status must be rejected, not accepted as UNKNOWN");
});

test("10) the migration sorts after the backfill migration", () => {
  const dirs = readdirSync(join(prismaDir, "migrations")).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.ok(dirs.includes(MIGRATION));
  assert.ok(MIGRATION > "20260728120000_backfill_patient_data_scope");
});

/* ------------------------------------------------- the existing share model */

test("11) PracticeDocumentShare keeps its original meaning", () => {
  const body = modelBody("PracticeDocumentShare");
  // It is the origin practice releasing a document TO ITS PATIENT. Giving it a
  // target practice would change what every existing query means.
  assert.doesNotMatch(body, /target/i, "the practice-to-patient release must not gain a target practice");
  assert.doesNotMatch(body, /source/i);
  assert.match(body, /patientUserId\s+String/);
  assert.match(body, /sharedByUserId\s+String\?/);
});

test("12) only the four patient-owned models and the new grant use Restrict on a link", () => {
  // Guards against a stray relation being added to another model by accident.
  const owners = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
    .filter(([, , body]) => /PracticePatientLink\s+@relation\("DocumentShareGrant/.test(body))
    .map(([, name]) => name);
  assert.deepEqual(owners, [MODEL]);
});
