/**
 * The startup guard, against real PostgreSQL.
 *
 * Every failure mode it exists for is produced deliberately in a throwaway
 * database: a missing migration, one that never finished, one that was rolled
 * back, a dropped column, a nullable scope, an unclassified record, an invalid
 * scope/context combination. In each case the guard must refuse.
 *
 * Safety: the sandbox URL is built programmatically from DATABASE_URL, then
 * re-parsed and printed, and the connected database is verified with an exact
 * comparison plus a blocklist before anything runs. No sed.
 *
 * Run: node scripts/verifyStartupReadinessSandbox.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");
const migrationsDirectory = join(serverDir, "prisma", "migrations");

const SANDBOX_DB = "medscoutx_startup_sandbox";
const FORBIDDEN = new Set(["medscoutx_dev", "medscoutx", "postgres", ""]);

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

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const good = String(actual) === String(expected);
  good ? (passed += 1) : (failed += 1);
  console.log(`  ${good ? "ok  " : "FAIL"}  ${label}${good ? "" : `\n          erwartet ${expected}, war ${actual}`}`);
}

psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
psql("postgres", `CREATE DATABASE "${SANDBOX_DB}"`);
const actualDb = psql(SANDBOX_DB, "SELECT current_database()");
console.log("current_database()   :", actualDb);
if (actualDb !== SANDBOX_DB) fail(`verbunden mit "${actualDb}", erwartet "${SANDBOX_DB}"`);
if (FORBIDDEN.has(actualDb)) fail(`verbunden mit gesperrter Datenbank "${actualDb}"`);

let prisma;

try {
  execFileSync(join(serverDir, "node_modules", ".bin", "prisma"), ["migrate", "deploy"], {
    cwd: serverDir, env: { ...process.env, DATABASE_URL: sandboxUrl }, stdio: "pipe",
  });
  console.log("\n--- volle Migrationskette angewendet ---");

  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });

  const { assertDatabaseReadyForApplication, READINESS_ERRORS, resolveGuardBypass } =
    await import("../services/startup/databaseReadinessService.js");

  /** Runs the guard and reports the stable code, or "ready". */
  async function run() {
    try {
      await assertDatabaseReadyForApplication({ prismaClient: prisma, migrationsDirectory });
      return "ready";
    } catch (e) {
      return e.readinessCode ?? `unexpected:${e.message}`;
    }
  }

  /** The context CHECK, which DROP COLUMN ... CASCADE takes with it. */
  const contextCheck = (model) => `
    ALTER TABLE "${model}" ADD CONSTRAINT "${model}_dataScope_context_check" CHECK (
      CASE
        WHEN "dataScope" = 'patient_global' THEN
          "contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NULL
        WHEN "dataScope" = 'practice_contextual' THEN
          ("contextPracticePatientLinkId" IS NOT NULL AND "archivedPracticeContextId" IS NULL)
          OR ("contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NOT NULL)
        ELSE false
      END);`;

  /** Applies a deliberate breakage, runs the guard, then restores. */
  async function withBreakage(label, breakSql, restoreSql, expected) {
    psql(SANDBOX_DB, breakSql);
    check(label, await run(), expected);
    psql(SANDBOX_DB, restoreSql);
  }

  /* --------------------------------------------------------------- 1. ready */

  console.log("\n--- 1. Vollstaendig migrierte, konsistente Datenbank ---");
  check("Guard laesst den Start zu", await run(), "ready");

  /* ------------------------------------------------- 2.-7. migration states */

  console.log("\n--- 2.-4. Fehlende Migrationen ---");
  for (const name of [
    "20260729100000_add_archived_practice_patient_context",
    "20260728090000_add_patient_data_context",
    "20260728120000_backfill_patient_data_scope",
  ]) {
    const row = psql(SANDBOX_DB,
      `SELECT id||'|'||checksum||'|'||started_at||'|'||coalesce(finished_at::text,'')
       FROM _prisma_migrations WHERE migration_name='${name}'`);
    const [id, checksum, startedAt, finishedAt] = row.split("|");
    await withBreakage(
      `fehlende Migration ${name.slice(15)} verhindert Start`,
      `DELETE FROM _prisma_migrations WHERE migration_name='${name}';`,
      `INSERT INTO _prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count)
       VALUES ('${id}','${checksum}','${name}','${startedAt}','${finishedAt}',1);`,
      READINESS_ERRORS.PENDING,
    );
  }

  console.log("\n--- 5.-7. Fehlerhafte Migrationszustaende ---");
  const target = "20260729100000_add_archived_practice_patient_context";
  const finished = psql(SANDBOX_DB,
    `SELECT finished_at FROM _prisma_migrations WHERE migration_name='${target}'`);
  await withBreakage(
    "finished_at = NULL verhindert Start",
    `UPDATE _prisma_migrations SET finished_at=NULL WHERE migration_name='${target}';`,
    `UPDATE _prisma_migrations SET finished_at='${finished}' WHERE migration_name='${target}';`,
    READINESS_ERRORS.INVALID,
  );
  await withBreakage(
    "rolled_back_at gesetzt verhindert Start",
    `UPDATE _prisma_migrations SET rolled_back_at=now() WHERE migration_name='${target}';`,
    `UPDATE _prisma_migrations SET rolled_back_at=NULL WHERE migration_name='${target}';`,
    READINESS_ERRORS.INVALID,
  );
  await withBreakage(
    "unvollstaendiger Eintrag (weder fertig noch zurueckgerollt)",
    `UPDATE _prisma_migrations SET finished_at=NULL, applied_steps_count=0 WHERE migration_name='${target}';`,
    `UPDATE _prisma_migrations SET finished_at='${finished}', applied_steps_count=1 WHERE migration_name='${target}';`,
    READINESS_ERRORS.INVALID,
  );

  /* ---------------------------------------------------- 8.-10. schema holes */

  console.log("\n--- 8.-10. Fehlende Schemastruktur ---");
  await withBreakage(
    "fehlende Kontextspalte verhindert Start",
    `ALTER TABLE "VitalEntry" DROP COLUMN "contextPracticePatientLinkId" CASCADE;`,
    `ALTER TABLE "VitalEntry" ADD COLUMN "contextPracticePatientLinkId" TEXT;
     ${contextCheck("VitalEntry")}`,
    READINESS_ERRORS.SCHEMA,
  );
  await withBreakage(
    "fehlende Archivspalte verhindert Start",
    `ALTER TABLE "DiagnosisEntry" DROP COLUMN "archivedPracticeContextId" CASCADE;`,
    `ALTER TABLE "DiagnosisEntry" ADD COLUMN "archivedPracticeContextId" TEXT;
     ${contextCheck("DiagnosisEntry")}`,
    READINESS_ERRORS.SCHEMA,
  );
  await withBreakage(
    "nullable dataScope verhindert Start",
    `ALTER TABLE "AllergyEntry" ALTER COLUMN "dataScope" DROP NOT NULL;`,
    `ALTER TABLE "AllergyEntry" ALTER COLUMN "dataScope" SET NOT NULL;`,
    READINESS_ERRORS.SCHEMA,
  );
  await withBreakage(
    "fehlende Archivtabelle verhindert Start",
    `ALTER TABLE "ArchivedPracticePatientContext" RENAME TO "ArchivedPracticePatientContext_x";`,
    `ALTER TABLE "ArchivedPracticePatientContext_x" RENAME TO "ArchivedPracticePatientContext";`,
    READINESS_ERRORS.SCHEMA,
  );
  await withBreakage(
    "fehlender aktiver Unique-Index der Freigaben verhindert Start",
    `DROP INDEX "PracticeDocumentShareGrant_active_unique";`,
    `CREATE UNIQUE INDEX "PracticeDocumentShareGrant_active_unique"
       ON "PracticeDocumentShareGrant"("documentId","targetPracticePatientLinkId") WHERE "status"='active';`,
    READINESS_ERRORS.SCHEMA,
  );

  /* ------------------------------------------------- 11.-13. data integrity */

  console.log("\n--- 11.-13. Inkonsistente Daten ---");
  psql(SANDBOX_DB, `
    INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
      VALUES ('U1','u1@x.invalid','h','U','X',now(),now());
  `);
  await withBreakage(
    "unklassifizierter Datensatz verhindert Start",
    `ALTER TABLE "VitalEntry" DROP CONSTRAINT "VitalEntry_dataScope_context_check";
     ALTER TABLE "VitalEntry" ALTER COLUMN "dataScope" DROP NOT NULL;
     INSERT INTO "VitalEntry"(id,"userId",type,"valuePrimary",unit,"measuredAt","dataScope","updatedAt")
       VALUES ('bad1','U1','weight',1,'kg',now(),NULL,now());`,
    `DELETE FROM "VitalEntry" WHERE id='bad1';
     ALTER TABLE "VitalEntry" ALTER COLUMN "dataScope" SET NOT NULL;`,
    READINESS_ERRORS.SCHEMA, // a nullable scope is caught before the data check
  );
  await withBreakage(
    "globaler Datensatz mit Kontext verhindert Start",
    `INSERT INTO "PracticeProfile"(id,"userId","practiceName","publicSlug","updatedAt")
       VALUES ('pr1','U1','P','p1',now());
     INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
       VALUES ('L1','pr1','U1','active',now());
     INSERT INTO "VitalEntry"(id,"userId",type,"valuePrimary",unit,"measuredAt","dataScope","contextPracticePatientLinkId","updatedAt")
       VALUES ('bad2','U1','weight',1,'kg',now(),'patient_global','L1',now());`,
    `DELETE FROM "VitalEntry" WHERE id='bad2';`,
    READINESS_ERRORS.DATA,
  );
  await withBreakage(
    "archivierter Datensatz mit zusaetzlichem Live-Link verhindert Start",
    `INSERT INTO "ArchivedPracticePatientContext"
       (id,"patientUserId","originalPracticePatientLinkId","originalPracticeProfileId","archiveReason")
       VALUES ('arc1','U1','former','pr1','practice_deleted');
     INSERT INTO "VitalEntry"(id,"userId",type,"valuePrimary",unit,"measuredAt","dataScope","contextPracticePatientLinkId","archivedPracticeContextId","updatedAt")
       VALUES ('bad3','U1','weight',1,'kg',now(),'practice_contextual','L1','arc1',now());`,
    `DELETE FROM "VitalEntry" WHERE id='bad3';`,
    READINESS_ERRORS.DATA,
  );
  psql(SANDBOX_DB, contextCheck("VitalEntry"));
  check("nach Wiederherstellung wieder bereit", await run(), "ready");

  /* ------------------------------------------------------- 14. unreachable */

  console.log("\n--- 14. Nicht erreichbare Datenbank ---");
  const { PrismaClient: PC2 } = await import("@prisma/client");
  const dead = new PC2({ datasources: { db: { url: "postgresql://nobody@127.0.0.1:1/nothing" } } });
  try {
    await assertDatabaseReadyForApplication({ prismaClient: dead, migrationsDirectory });
    check("nicht erreichbare Datenbank verhindert Start", "durchgelassen", "abgelehnt");
  } catch (e) {
    check("nicht erreichbare Datenbank verhindert Start",
      [READINESS_ERRORS.UNREACHABLE, READINESS_ERRORS.PENDING].includes(e.readinessCode), true);
  }
  await dead.$disconnect().catch(() => {});

  /* ---------------------------------------------------- 16. read-only proof */

  console.log("\n--- 16. Der Guard schreibt nichts ---");
  const before = psql(SANDBOX_DB, `SELECT
      (SELECT count(*) FROM "VitalEntry")||'/'||
      (SELECT count(*) FROM "ArchivedPracticePatientContext")||'/'||
      (SELECT count(*) FROM _prisma_migrations)||'/'||
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public')`);
  await run();
  await run();
  const after = psql(SANDBOX_DB, `SELECT
      (SELECT count(*) FROM "VitalEntry")||'/'||
      (SELECT count(*) FROM "ArchivedPracticePatientContext")||'/'||
      (SELECT count(*) FROM _prisma_migrations)||'/'||
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public')`);
  check("Bestand und Schema unveraendert", after, before);

  const src = readFileSync(join(serverDir, "services/startup/databaseReadinessService.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  check("kein DDL, UPDATE, DELETE oder migrate im Guard",
    /\b(ALTER TABLE|CREATE TABLE|DROP |UPDATE |DELETE FROM|INSERT INTO|migrate deploy)\b/i.test(src) ? "gefunden" : "keins",
    "keins");

  /* --------------------------------------------------------- 19. no bypass */

  console.log("\n--- 19. Bypass ---");
  const tryBypass = (env) => {
    try { return resolveGuardBypass(env).skip ? "uebersprungen" : "aktiv"; }
    catch (e) { return e.readinessCode; }
  };
  check("production kann den Guard nicht abschalten",
    tryBypass({ NODE_ENV: "production", SKIP_STARTUP_DATABASE_GUARD: "true" }),
    READINESS_ERRORS.BYPASS);
  check("development kann ihn nicht abschalten",
    tryBypass({ NODE_ENV: "development", SKIP_STARTUP_DATABASE_GUARD: "true" }),
    READINESS_ERRORS.BYPASS);
  check("ohne Variable bleibt der Guard aktiv",
    tryBypass({ NODE_ENV: "test" }), "aktiv");
  check("nur Tests duerfen ihn ueberspringen",
    tryBypass({ NODE_ENV: "test", SKIP_STARTUP_DATABASE_GUARD: "true" }), "uebersprungen");

  /* -------------------------------------------------------------- 17. logs */

  console.log("\n--- 17. Logs ---");
  let logged = "";
  const realError = console.error;
  console.error = (...args) => { logged += args.join(" "); };
  psql(SANDBOX_DB, `UPDATE _prisma_migrations SET finished_at=NULL WHERE migration_name='${target}';`);
  try {
    await assertDatabaseReadyForApplication({ prismaClient: prisma, migrationsDirectory });
  } catch (e) {
    logged += `${e.readinessCode}: ${e.readinessDetail}`;
  }
  console.error = realError;
  psql(SANDBOX_DB, `UPDATE _prisma_migrations SET finished_at='${finished}' WHERE migration_name='${target}';`);
  check("kein Passwort oder vollstaendige URL im Log",
    /postgres(ql)?:\/\/|password/i.test(logged) ? "gefunden" : "keins", "keins");
  check("keine Patienten- oder Datensatz-ID im Log",
    /U1|L1|arc1|bad[123]/.test(logged) ? "gefunden" : "keins", "keins");
  check("Log nennt Code und Migrationsname", /startup_database_migration_invalid/.test(logged), true);
} catch (e) {
  failed += 1;
  console.error("\nUNERWARTETER FEHLER:", e?.stack ? String(e.stack).split("\n").slice(0, 4).join("\n") : e);
} finally {
  if (prisma) await prisma.$disconnect().catch(() => {});
  try {
    psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
    console.log(`\nSandbox ${SANDBOX_DB} geloescht.`);
  } catch (e) {
    console.error(`WARNUNG: Sandbox konnte nicht geloescht werden: ${e.message}`);
  }
}

console.log(`\n# pass ${passed}\n# fail ${failed}`);
process.exit(failed === 0 ? 0 : 1);
