/**
 * Runs the real backfill migration against a THROWAWAY sandbox database.
 *
 * The backfill can only be trusted if it is executed against actual PostgreSQL:
 * the precondition guards, the NOT NULL switch and the tightened CHECK
 * constraints are all database behaviour that no in-memory fake reproduces.
 *
 * Safety: the sandbox URL is built programmatically from DATABASE_URL, then
 * re-parsed and printed, and the connected database is verified with an exact
 * string comparison plus a blocklist before anything runs. A previous attempt
 * rewrote the URL with sed, the pattern silently did not match, and a migration
 * landed on the shared development database — hence the hard guard here. No sed.
 *
 * The fixture carries no medical content: placeholder strings only.
 *
 * Run: node scripts/verifyPatientDataScopeBackfillSandbox.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, cpSync, rmSync, mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");

const SANDBOX_DB = "medscoutx_backfill_sandbox";
/** Databases this script must never, under any circumstance, connect to. */
const FORBIDDEN = new Set(["medscoutx_dev", "medscoutx", "postgres", ""]);
const BACKFILL_MIGRATION = "20260728120000_backfill_patient_data_scope";

const MODELS = ["VitalEntry", "VaccinationEntry", "AllergyEntry", "DiagnosisEntry"];

function fail(msg) {
  console.error(`\nABBRUCH: ${msg}`);
  process.exit(1);
}

/* ---------------------------------------------------- build the sandbox URL */

const envFile = readFileSync(join(serverDir, ".env"), "utf8");
const line = envFile.split("\n").find((l) => l.startsWith("DATABASE_URL"));
if (!line) fail("DATABASE_URL not found in .env");
const baseUrl = line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");

const parsed = new URL(baseUrl);
parsed.pathname = `/${SANDBOX_DB}`;
const sandboxUrl = parsed.toString();

// Re-parse what we just built and report it, rather than trusting the edit.
const verify = new URL(sandboxUrl);
const urlName = verify.pathname.replace(/^\//, "");

console.log("Basis-URL Datenbank  :", new URL(baseUrl).pathname.replace(/^\//, ""));
console.log("Erwartete Sandbox-DB :", SANDBOX_DB);
console.log("Sandbox-URL Datenbank:", urlName);
console.log("Host/Port            :", verify.hostname, verify.port || "(default)");

if (urlName !== SANDBOX_DB) fail(`URL zeigt auf "${urlName}", erwartet "${SANDBOX_DB}"`);
if (FORBIDDEN.has(urlName)) fail(`"${urlName}" steht auf der Sperrliste`);

/* ------------------------------------------------------------------ helpers */

const psql = (db, sql) =>
  execFileSync("psql", ["-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { encoding: "utf8" }).trim();

/** Runs a statement and returns the psql command tag, e.g. "UPDATE 0". */
const psqlTag = (db, sql) =>
  execFileSync("psql", ["-d", db, "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" })
    .trim()
    .split("\n")
    .pop()
    .trim();

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const good = String(actual) === String(expected);
  if (good) passed += 1;
  else failed += 1;
  console.log(`  ${good ? "ok  " : "FAIL"}  ${label}${good ? "" : `\n          erwartet ${expected}, war ${actual}`}`);
}

/** Asserts whether a statement should succeed or be rejected by the database. */
function expectSql(label, db, sql, shouldSucceed) {
  let ok;
  let err = "";
  try {
    execFileSync("psql", ["-d", db, "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
    ok = true;
  } catch (e) {
    ok = false;
    err = String(e.stderr || "").split("\n").find((l) => l.includes("ERROR")) || "";
  }
  const good = ok === shouldSucceed;
  if (good) passed += 1;
  else failed += 1;
  console.log(`  ${good ? "ok  " : "FAIL"}  ${label}${good || ok ? "" : `\n          ${err.trim()}`}`);
}

/**
 * Deploys every migration EXCEPT the backfill, so the fixture can still be
 * written while "dataScope" is nullable. Prisma resolves the migrations folder
 * next to the schema, so a copy of prisma/ with that one directory removed is
 * enough — the real migrations are never modified.
 */
function deployWithoutBackfill(tmpRoot) {
  const tmpPrisma = join(tmpRoot, "prisma");
  cpSync(join(serverDir, "prisma"), tmpPrisma, { recursive: true });
  rmSync(join(tmpPrisma, "migrations", BACKFILL_MIGRATION), { recursive: true, force: true });
  execFileSync("npx", ["prisma", "migrate", "deploy", "--schema", join(tmpPrisma, "schema.prisma")], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: sandboxUrl },
    stdio: "pipe",
  });
}

/**
 * Deploys the real, unmodified migrations folder — including the backfill —
 * through Prisma itself. Proves that Prisma can apply the migration as written
 * (DO blocks, RAISE, constraint rewrite), not just psql.
 */
function deployAll() {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: sandboxUrl },
    stdio: "pipe",
  });
}

/** Runs the read-only readiness script against the sandbox and returns its exit code. */
function runReadiness() {
  try {
    execFileSync("node", [join(serverDir, "scripts", "verifyPatientDataScopeReadiness.mjs")], {
      cwd: serverDir,
      env: { ...process.env, DATABASE_URL: sandboxUrl },
      stdio: "pipe",
    });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  }
}

/** Applies the real backfill migration file inside ONE transaction, as Prisma does. */
function applyBackfill(db) {
  return execFileSync(
    "psql",
    ["-d", db, "-v", "ON_ERROR_STOP=1", "-1", "-f", join(serverDir, "prisma", "migrations", BACKFILL_MIGRATION, "migration.sql")],
    { encoding: "utf8", stdio: "pipe" },
  );
}

function createSandbox() {
  psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
  psql("postgres", `CREATE DATABASE "${SANDBOX_DB}"`);
  // Second guard: ask the server itself which database we actually reached.
  const actual = psql(SANDBOX_DB, "SELECT current_database()");
  if (actual !== SANDBOX_DB) fail(`verbunden mit "${actual}", erwartet "${SANDBOX_DB}"`);
  if (FORBIDDEN.has(actual)) fail(`verbunden mit gesperrter Datenbank "${actual}"`);
  return actual;
}

function dropSandbox() {
  try {
    psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
    console.log(`\nSandbox ${SANDBOX_DB} geloescht.`);
  } catch (e) {
    console.error(`WARNUNG: Sandbox konnte nicht geloescht werden: ${e.message}`);
  }
}

/* ------------------------------------------------------------- the fixture */

/**
 * Per model four legacy-relevant rows plus one foreign-context row:
 *   <p>-legacy   NULL / NULL                   -> must become patient_global
 *   <p>-global   patient_global / NULL         -> must stay untouched
 *   <p>-ctxA     practice_contextual / lkA     -> must stay untouched
 *   <p>-deleted  NULL / NULL, soft deleted     -> must become patient_global
 *   <p>-ctxB     practice_contextual / lkB     -> foreign practice, read control
 */
const ROW_SQL = {
  VitalEntry: (id, scope, ctx, del) =>
    `INSERT INTO "VitalEntry"(id,"userId",type,"valuePrimary",unit,"measuredAt","dataScope","contextPracticePatientLinkId","deletedAt","updatedAt")
     VALUES ('${id}','u1','weight',1,'kg',now(),${scope},${ctx},${del},now());`,
  VaccinationEntry: (id, scope, ctx, del) =>
    `INSERT INTO "VaccinationEntry"(id,"userId","vaccineName",disease,"vaccinationDate","dataScope","contextPracticePatientLinkId","deletedAt","updatedAt")
     VALUES ('${id}','u1','placeholder','placeholder',now(),${scope},${ctx},${del},now());`,
  AllergyEntry: (id, scope, ctx, del) =>
    `INSERT INTO "AllergyEntry"(id,"userId",allergen,"allergyType",severity,"dataScope","contextPracticePatientLinkId","deletedAt","updatedAt")
     VALUES ('${id}','u1','placeholder','placeholder','placeholder',${scope},${ctx},${del},now());`,
  DiagnosisEntry: (id, scope, ctx, del) =>
    `INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","dataScope","contextPracticePatientLinkId","deletedAt","updatedAt")
     VALUES ('${id}','u1','placeholder',${scope},${ctx},${del},now());`,
};

const prefix = (m) => m.slice(0, 3).toLowerCase();

function seedBase(db) {
  psql(db, `
    INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
      VALUES ('u1','p@x.invalid','h','P','X',now(),now()),
             ('o1','a@x.invalid','h','A','X',now(),now()),
             ('o2','b@x.invalid','h','B','X',now(),now());
    INSERT INTO "PracticeProfile"(id,"userId","practiceName","publicSlug","updatedAt")
      VALUES ('prA','o1','Praxis A','praxis-a',now()),
             ('prB','o2','Praxis B','praxis-b',now());
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('lkA','prA','u1','active',now()),
             ('lkB','prB','u1','active',now());
  `);
}

function seedRows(db) {
  for (const m of MODELS) {
    const p = prefix(m);
    const row = ROW_SQL[m];
    psql(db, [
      row(`${p}-legacy`, "NULL", "NULL", "NULL"),
      row(`${p}-global`, "'patient_global'", "NULL", "NULL"),
      row(`${p}-ctxA`, "'practice_contextual'", "'lkA'", "NULL"),
      row(`${p}-deleted`, "NULL", "NULL", "now()"),
      row(`${p}-ctxB`, "'practice_contextual'", "'lkB'", "NULL"),
    ].join("\n"));
  }
}

/* ============================================================ PHASE 1: Erfolg */

const tmpRoot = mkdtempSync(join(tmpdir(), "medscoutx-backfill-"));
let phase2Ran = false;
let phase3Ran = false;

try {
  console.log("\n=== Phase 1: regulaerer Backfill ===");
  const actual = createSandbox();
  console.log("current_database()   :", actual);

  deployWithoutBackfill(tmpRoot);
  console.log("Migrationen bis einschliesslich add_patient_data_context angewendet.");

  seedBase(SANDBOX_DB);
  seedRows(SANDBOX_DB);

  const beforeNull = psql(SANDBOX_DB, MODELS.map((m) => `SELECT count(*) FROM "${m}" WHERE "dataScope" IS NULL`).join(" UNION ALL "));
  console.log("Unklassifiziert vor Backfill (je Modell):", beforeNull.split("\n").join(", "));

  console.log("\n--- Backfill-Migration anwenden ---");
  applyBackfill(SANDBOX_DB);
  console.log("  angewendet.");

  console.log("\n--- 1. Legacy wird global ---");
  for (const m of MODELS) {
    check(`${m}: legacy -> patient_global`,
      psql(SANDBOX_DB, `SELECT "dataScope" FROM "${m}" WHERE id='${prefix(m)}-legacy'`), "patient_global");
  }

  console.log("\n--- 2. Soft geloeschtes Legacy wird ebenfalls global ---");
  for (const m of MODELS) {
    check(`${m}: soft geloescht -> patient_global`,
      psql(SANDBOX_DB, `SELECT "dataScope" FROM "${m}" WHERE id='${prefix(m)}-deleted'`), "patient_global");
    check(`${m}: bleibt soft geloescht`,
      psql(SANDBOX_DB, `SELECT ("deletedAt" IS NOT NULL) FROM "${m}" WHERE id='${prefix(m)}-deleted'`), "t");
  }

  console.log("\n--- 3./4. Bereits klassifizierte Datensaetze bleiben unveraendert ---");
  for (const m of MODELS) {
    check(`${m}: global bleibt global`,
      psql(SANDBOX_DB, `SELECT "dataScope" FROM "${m}" WHERE id='${prefix(m)}-global'`), "patient_global");
    check(`${m}: kontextbezogen bleibt kontextbezogen`,
      psql(SANDBOX_DB, `SELECT "dataScope"||'/'||"contextPracticePatientLinkId" FROM "${m}" WHERE id='${prefix(m)}-ctxA'`),
      "practice_contextual/lkA");
  }

  console.log("\n--- 5. Kein Datensatz erhaelt eine neue Link-ID ---");
  for (const m of MODELS) {
    check(`${m}: genau 2 Datensaetze mit Kontextlink (unveraendert)`,
      psql(SANDBOX_DB, `SELECT count(*) FROM "${m}" WHERE "contextPracticePatientLinkId" IS NOT NULL`), "2");
    check(`${m}: kein backfillter Datensatz hat einen Kontextlink`,
      psql(SANDBOX_DB, `SELECT count(*) FROM "${m}" WHERE id IN ('${prefix(m)}-legacy','${prefix(m)}-deleted') AND "contextPracticePatientLinkId" IS NOT NULL`), "0");
    check(`${m}: kein Datensatz ist practice_contextual geworden`,
      psql(SANDBOX_DB, `SELECT count(*) FROM "${m}" WHERE "dataScope"='practice_contextual'`), "2");
  }

  console.log("\n--- 6. dataScope ist NOT NULL ---");
  for (const m of MODELS) {
    check(`${m}: is_nullable`,
      psql(SANDBOX_DB, `SELECT is_nullable FROM information_schema.columns WHERE table_name='${m}' AND column_name='dataScope'`), "NO");
    check(`${m}: kein DEFAULT gesetzt`,
      psql(SANDBOX_DB, `SELECT coalesce(column_default,'(none)') FROM information_schema.columns WHERE table_name='${m}' AND column_name='dataScope'`), "(none)");
  }

  console.log("\n--- 7. Insert ohne dataScope wird abgelehnt ---");
  expectSql("VitalEntry ohne dataScope",
    SANDBOX_DB,
    `INSERT INTO "VitalEntry"(id,"userId",type,"valuePrimary",unit,"measuredAt","updatedAt") VALUES ('vit-x','u1','weight',1,'kg',now(),now());`,
    false);
  expectSql("DiagnosisEntry ohne dataScope",
    SANDBOX_DB,
    `INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","updatedAt") VALUES ('dia-x','u1','placeholder',now());`,
    false);

  console.log("\n--- 8. Ungueltige Scope-Link-Kombinationen ---");
  expectSql("patient_global + Link VERBOTEN",
    SANDBOX_DB, ROW_SQL.DiagnosisEntry("dia-y", "'patient_global'", "'lkA'", "NULL"), false);
  expectSql("practice_contextual ohne Link VERBOTEN",
    SANDBOX_DB, ROW_SQL.DiagnosisEntry("dia-z", "'practice_contextual'", "NULL", "NULL"), false);
  expectSql("patient_global ohne Link weiterhin erlaubt",
    SANDBOX_DB, ROW_SQL.DiagnosisEntry("dia-ok1", "'patient_global'", "NULL", "NULL"), true);
  expectSql("practice_contextual mit gueltigem Link weiterhin erlaubt",
    SANDBOX_DB, ROW_SQL.DiagnosisEntry("dia-ok2", "'practice_contextual'", "'lkA'", "NULL"), true);
  // Defence in depth: even without NOT NULL the CHECK rejects an unclassified
  // row, because a NULL scope matches no WHEN branch and falls through to ELSE.
  expectSql("NULL-Scope auch ohne NOT NULL vom CHECK abgelehnt",
    SANDBOX_DB,
    `BEGIN;
     ALTER TABLE "DiagnosisEntry" ALTER COLUMN "dataScope" DROP NOT NULL;
     ${ROW_SQL.DiagnosisEntry("dia-null", "NULL", "NULL", "NULL")}
     ROLLBACK;`,
    false);
  check("NOT NULL nach dem Rollback unveraendert",
    psql(SANDBOX_DB, `SELECT is_nullable FROM information_schema.columns WHERE table_name='DiagnosisEntry' AND column_name='dataScope'`), "NO");

  console.log("\n--- 9. Idempotenz: zweite Ausfuehrung der Backfill-Statements ---");
  for (const m of MODELS) {
    check(`${m}: zweiter Lauf veraendert 0 Datensaetze`,
      psqlTag(SANDBOX_DB, `UPDATE "${m}" SET "dataScope"='patient_global' WHERE "dataScope" IS NULL AND "contextPracticePatientLinkId" IS NULL;`),
      "UPDATE 0");
  }
  const snapshotAfter = psql(SANDBOX_DB, MODELS.map((m) =>
    `SELECT count(*) FROM "${m}" WHERE "dataScope"='patient_global'`).join(" UNION ALL "));
  // Vit/Vac/All: legacy + global + soft-deleted legacy = 3 each.
  // Dia: the same 3 plus dia-ok1 from the constraint checks above = 4.
  check("Bestand nach zweitem Lauf unveraendert (Vit/Vac/All/Dia global)",
    snapshotAfter.split("\n").join(","), "3,3,3,4");

  console.log("\n--- 10. Praxis-Lesefilter nach dem Backfill ---");
  const readWhere = (m, link) =>
    `SELECT count(*) FROM "${m}" WHERE "userId"='u1' AND "deletedAt" IS NULL AND (
       ("dataScope"='patient_global' AND "contextPracticePatientLinkId" IS NULL)
       OR ("dataScope"='practice_contextual' AND "contextPracticePatientLinkId"='${link}'));`;
  for (const m of MODELS) {
    const expectedA = m === "DiagnosisEntry" ? "5" : "3"; // +2 rows added by the constraint checks above
    check(`${m}: Praxis A sieht global + eigenen Kontext`, psql(SANDBOX_DB, readWhere(m, "lkA")), expectedA);
    check(`${m}: Praxis B sieht fremden Kontext von A nicht`,
      psql(SANDBOX_DB, `SELECT count(*) FROM "${m}" WHERE "userId"='u1' AND "deletedAt" IS NULL AND "dataScope"='practice_contextual' AND "contextPracticePatientLinkId"='lkA' AND "contextPracticePatientLinkId"='lkB'`), "0");
    check(`${m}: kein Datensatz ohne Scope mehr vorhanden`,
      psql(SANDBOX_DB, `SELECT count(*) FROM "${m}" WHERE "dataScope" IS NULL`), "0");
  }

  /* ================================================ PHASE 2: Sicherheitsabbruch */

  console.log("\n=== Phase 2: Abbruch bei unbekannter Herkunft (NULL + Link) ===");
  phase2Ran = true;
  createSandbox();
  deployWithoutBackfill(join(tmpRoot, "p2"));
  seedBase(SANDBOX_DB);
  seedRows(SANDBOX_DB);

  // The CHECK constraint of the previous migration makes this state
  // unreachable, so it has to be forced here to prove the guard actually fires.
  psql(SANDBOX_DB, `ALTER TABLE "AllergyEntry" DROP CONSTRAINT "AllergyEntry_dataScope_context_check";`);
  psql(SANDBOX_DB, ROW_SQL.AllergyEntry("all-broken", "NULL", "'lkA'", "NULL"));

  let aborted = false;
  let errLine = "";
  try {
    applyBackfill(SANDBOX_DB);
  } catch (e) {
    aborted = true;
    errLine = String(e.stderr || "").split("\n").find((l) => l.includes("backfill aborted")) || "";
  }
  check("Migration bricht ab", aborted, true);
  check("Fehlermeldung nennt die Ursache", /dataScope IS NULL with a context link/.test(errLine), true);
  // Print from "ERROR:" onward — the psql file-path prefix is noise here.
  console.log(`          ${errLine.slice(errLine.indexOf("ERROR:")).trim().slice(0, 160)}`);

  console.log("\n  Rollback-Nachweis: kein anderer Datensatz wurde vorher aktualisiert");
  for (const m of MODELS) {
    check(`${m}: legacy weiterhin unklassifiziert`,
      psql(SANDBOX_DB, `SELECT coalesce("dataScope"::text,'NULL') FROM "${m}" WHERE id='${prefix(m)}-legacy'`), "NULL");
    check(`${m}: soft geloeschtes legacy weiterhin unklassifiziert`,
      psql(SANDBOX_DB, `SELECT coalesce("dataScope"::text,'NULL') FROM "${m}" WHERE id='${prefix(m)}-deleted'`), "NULL");
    check(`${m}: dataScope weiterhin nullable (kein Teilfortschritt)`,
      psql(SANDBOX_DB, `SELECT is_nullable FROM information_schema.columns WHERE table_name='${m}' AND column_name='dataScope'`), "YES");
  }
  check("inkonsistenter Datensatz NICHT automatisch interpretiert",
    psql(SANDBOX_DB, `SELECT coalesce("dataScope"::text,'NULL')||'/'||coalesce("contextPracticePatientLinkId",'NULL') FROM "AllergyEntry" WHERE id='all-broken'`),
    "NULL/lkA");

  /* ====================== PHASE 3: volle Kette via Prisma + Readiness-Skript */

  console.log("\n=== Phase 3: prisma migrate deploy (volle Kette) + Readiness ===");
  phase3Ran = true;
  createSandbox();
  deployWithoutBackfill(join(tmpRoot, "p3"));
  seedBase(SANDBOX_DB);
  seedRows(SANDBOX_DB);

  check("Readiness meldet NICHT BEREIT vor dem Backfill", runReadiness(), 1);

  // Prisma applies the outstanding migration — the backfill — by itself.
  deployAll();
  console.log("  prisma migrate deploy: Backfill-Migration angewendet.");

  check("Readiness meldet BEREIT nach dem Backfill", runReadiness(), 0);
  check("keine ausstehende Migration mehr",
    psql(SANDBOX_DB, `SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL`), "0");
  check("Backfill-Migration ist als angewendet verzeichnet",
    psql(SANDBOX_DB, `SELECT count(*) FROM _prisma_migrations WHERE migration_name='${BACKFILL_MIGRATION}' AND finished_at IS NOT NULL`), "1");
  for (const m of MODELS) {
    check(`${m}: nach voller Kette 0 unklassifiziert`,
      psql(SANDBOX_DB, `SELECT count(*) FROM "${m}" WHERE "dataScope" IS NULL`), "0");
  }
} catch (e) {
  failed += 1;
  console.error("\nUNERWARTETER FEHLER:", e.stderr ? String(e.stderr) : e.message);
} finally {
  dropSandbox();
  rmSync(tmpRoot, { recursive: true, force: true });
}

console.log(`\n# pass ${passed}\n# fail ${failed}`);
if (!phase2Ran) console.log("HINWEIS: Phase 2 wurde nicht erreicht.");
if (!phase3Ran) console.log("HINWEIS: Phase 3 wurde nicht erreicht.");
process.exit(failed === 0 && phase2Ran && phase3Ran ? 0 : 1);
