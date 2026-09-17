/**
 * Every migration in the folder must be applied where the code runs.
 *
 * THE OUTAGE THIS GUARDS
 *   On 2026-08-22 production served commit ff0b9492 against a database last
 *   migrated on 2026-07-28. Ten migrations sat unapplied, so the practice
 *   overview, both message lists, the practice inbox, the patient practice
 *   directory, exports and eRezept all answered 500 with Prisma P2022
 *   ("The column `PracticePatientThread.practiceArchivedAt` does not exist").
 *   Nothing failed loudly at deploy time: the build shipped the code and the
 *   migrations were simply never run.
 *
 *   `verifyMigrationCompleteness.test.js` checks the other direction — objects
 *   that exist in the database but in no migration. It cannot see this defect,
 *   because here the migration exists and the DATABASE is the one missing out.
 *
 * TWO INDEPENDENT GUARDS
 *   1. The deploy runs the migrations at all. Pure text check on the start
 *      script — no database, so it fails in CI and on a laptop alike.
 *   2. Against a reachable database: nothing pending, nothing failed, nothing
 *      rolled back. Point this at production (DATABASE_URL=<prod> node --test
 *      scripts/verifyMigrationsApplied.test.js) and it reports the drift that
 *      caused the outage.
 *
 * Run: node --test scripts/verifyMigrationsApplied.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
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

/** Migration directory names, i.e. exactly what `_prisma_migrations` records. */
function migrationsOnDisk() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((d) => existsSync(path.join(MIGRATIONS_DIR, d, "migration.sql")))
    .sort();
}

test("the server start command applies migrations before booting the app", () => {
  // The deploy platform may override this, but the repository must not be the
  // reason it is missing: `node app.js` alone is how the outage happened.
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const start = String(pkg.scripts?.start || "");

  assert.ok(
    /prisma\s+migrate\s+deploy/.test(start),
    `start script must run "prisma migrate deploy"; it is: ${start}`,
  );
  assert.ok(
    start.indexOf("migrate deploy") < start.indexOf("app.js"),
    `migrations must run BEFORE the app boots; start script is: ${start}`,
  );
  assert.ok(
    start.includes("&&"),
    `a failed migration must stop the boot, so the two must be chained with &&: ${start}`,
  );
});

test("the migration folder is actually being read", () => {
  // Without this, an empty read would make the comparison below pass vacuously.
  const dirs = migrationsOnDisk();
  assert.ok(dirs.length > 50, `expected the migration history, found ${dirs.length}`);
});

test("no migration in the folder is unapplied in this database", { skip }, async () => {
  const rows = await prisma.$queryRaw`
    SELECT migration_name FROM _prisma_migrations
     WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  const applied = new Set(rows.map((r) => r.migration_name));

  const pending = migrationsOnDisk().filter((name) => !applied.has(name));

  assert.deepEqual(
    pending,
    [],
    "this database is behind the code — run `prisma migrate deploy` against it",
  );
});

test("no migration is recorded as failed or rolled back", { skip }, async () => {
  // A half-applied migration leaves the schema in a state no environment was
  // ever tested against, and `migrate deploy` refuses to continue past it.
  const rows = await prisma.$queryRaw`
    SELECT migration_name FROM _prisma_migrations
     WHERE rolled_back_at IS NOT NULL OR finished_at IS NULL`;

  assert.deepEqual(
    rows.map((r) => r.migration_name),
    [],
    "these migrations did not complete — resolve them before deploying",
  );
});

test("the columns the outage tripped over are present", { skip }, async () => {
  // Named explicitly rather than derived: this is the regression itself, and a
  // rename in the schema should force someone to look at this list.
  const expected = [
    ["PracticePatientThread", "patientArchivedAt"],
    ["PracticePatientThread", "practiceArchivedAt"],
    ["PracticePatientMessage", "clientRequestId"],
    ["PracticePatientMessage", "editedAt"],
    ["PracticePatientMessage", "withdrawnAt"],
    ["ErezeptEntry", "practiceProfileId"],
  ];

  const rows = await prisma.$queryRaw`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'`;
  const present = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));

  const missing = expected
    .map(([t, c]) => `${t}.${c}`)
    .filter((key) => !present.has(key));

  assert.deepEqual(missing, [], "the practice overview and both message lists read these columns");
});
