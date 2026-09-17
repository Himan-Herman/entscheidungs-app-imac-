/**
 * Every table must come from a migration (Phase 2F.3A).
 *
 * `ErezeptEntry` reached production-shaped environments through `prisma db
 * push` and was never written into the migration history. `prisma migrate
 * status` still reported "up to date", because it compares applied migrations
 * against the folder — not the folder against the database. A database built
 * from `migrate deploy` alone therefore had 86 of 87 tables and the application
 * failed at runtime on the missing one.
 *
 * This test compares the DATABASE against the migration SQL. It is deliberately
 * a text comparison rather than a second schema engine: the question is only
 * "does any migration ever mention this table", which is exactly the property
 * that was missing.
 *
 * Run: node --test scripts/verifyMigrationCompleteness.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

const MIGRATIONS_DIR = "prisma/migrations";

/** Prisma's own bookkeeping table; it is created by the CLI, not by a migration. */
const NOT_FROM_MIGRATIONS = new Set(["_prisma_migrations"]);

function allMigrationSql() {
  let sql = "";
  for (const dir of readdirSync(MIGRATIONS_DIR)) {
    const file = path.join(MIGRATIONS_DIR, dir, "migration.sql");
    try {
      sql += readFileSync(file, "utf8") + "\n";
    } catch {
      /* migration_lock.toml and friends have no migration.sql */
    }
  }
  return sql;
}

test("no table exists that the migration history never creates", { skip }, async () => {
  const rows = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`;

  const sql = allMigrationSql();
  const missing = rows
    .map((r) => r.table_name)
    .filter((name) => !NOT_FROM_MIGRATIONS.has(name))
    .filter((name) => !sql.includes(`"${name}"`));

  assert.deepEqual(
    missing,
    [],
    "these tables reached the database without a migration — a fresh environment would not have them",
  );
});

test("the migration folder is actually being read", { skip }, () => {
  // Without this the test above would pass on an empty read: no SQL, no
  // matches — but also no tables to compare, if the query had failed too.
  const sql = allMigrationSql();
  assert.ok(sql.length > 10_000, `expected the migration history, read ${sql.length} characters`);
  assert.ok(sql.includes('"PracticePatientLink"'), "a known table must appear in the SQL");
});

test("the eRezept baseline is part of the history", { skip }, () => {
  const dirs = readdirSync(MIGRATIONS_DIR);
  const baseline = dirs.find((d) => d.includes("baseline_erezept_entry"));
  assert.ok(baseline, "the baseline migration must exist");

  const sql = readFileSync(path.join(MIGRATIONS_DIR, baseline, "migration.sql"), "utf8");
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS"), "it must tolerate an existing table");
  assert.ok(
    sql.includes("baseline mismatch"),
    "and it must PROVE that existing table matches, not merely skip creation",
  );
});

test("the structural proof covers every column the baseline itself creates", { skip }, () => {
  // A baseline that verified only some of the columns it creates would accept a
  // divergent table. Deliberately scoped to the baseline's OWN columns: later
  // migrations add more (Phase 2F.3B added practice attribution), and those are
  // the business of the migrations that introduce them.
  const dirs = readdirSync(MIGRATIONS_DIR);
  const baseline = dirs.find((d) => d.includes("baseline_erezept_entry"));
  const sql = readFileSync(path.join(MIGRATIONS_DIR, baseline, "migration.sql"), "utf8");

  const createTable = sql.slice(
    sql.indexOf("CREATE TABLE IF NOT EXISTS"),
    sql.indexOf("CREATE INDEX"),
  );
  const created = [...createTable.matchAll(/^\s{4}"(\w+)"\s/gm)].map((m) => m[1]);
  assert.ok(created.length >= 15, `expected the baseline columns, parsed ${created.length}`);

  const unchecked = created.filter((name) => !sql.includes(`['${name}',`));
  assert.deepEqual(unchecked, [], "a column the baseline creates but never verifies could differ");
});

test("no foreign key exists that the migration history never declares", { skip }, async () => {
  // The table-level check above would not have caught this: ConsentRecord was
  // created by a migration, but its foreign key to User reached the database
  // only through `prisma db push`. A fresh environment therefore had the table
  // without the constraint — the same drift, one level down.
  const rows = await prisma.$queryRaw`
    SELECT conname FROM pg_constraint WHERE contype = 'f' ORDER BY conname`;

  const sql = allMigrationSql();
  const missing = rows.map((r) => r.conname).filter((name) => !sql.includes(name));

  assert.deepEqual(
    missing,
    [],
    "these foreign keys are in the database but in no migration — a fresh environment would lack them",
  );
});

test("the foreign key inventory is not empty", { skip }, async () => {
  const rows = await prisma.$queryRaw`SELECT conname FROM pg_constraint WHERE contype = 'f'`;
  assert.ok(rows.length > 100, `expected the full foreign key inventory, found ${rows.length}`);
});
