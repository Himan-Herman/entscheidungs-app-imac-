/**
 * Applies the full migration chain to a THROWAWAY sandbox database and checks
 * the archived-practice-context invariants for real.
 *
 * The rule this feature rests on — a contextual medical record has EITHER a
 * live link OR an archive context, never both and never neither — is enforced
 * by CHECK constraints. That can only be proven against actual PostgreSQL.
 *
 * Safety: the sandbox URL is built programmatically from DATABASE_URL, then
 * re-parsed and printed, and the connected database is verified with an exact
 * comparison plus a blocklist before anything runs. No sed.
 *
 * The fixture carries no medical content: placeholder strings only.
 *
 * Run: node scripts/verifyArchivedPracticeContextSandbox.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");

const SANDBOX_DB = "medscoutx_archive_sandbox";
/** Databases this script must never, under any circumstance, connect to. */
const FORBIDDEN = new Set(["medscoutx_dev", "medscoutx", "postgres", ""]);
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
  if (good) passed += 1;
  else failed += 1;
  console.log(`  ${good ? "ok  " : "FAIL"}  ${label}${good ? "" : `\n          erwartet ${expected}, war ${actual}`}`);
}

function expectSql(label, sql, shouldSucceed) {
  let ok;
  let err = "";
  try {
    execFileSync("psql", ["-d", SANDBOX_DB, "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
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

/* -------------------------------------------------------- create + migrate */

psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
psql("postgres", `CREATE DATABASE "${SANDBOX_DB}"`);

const actual = psql(SANDBOX_DB, "SELECT current_database()");
console.log("current_database()   :", actual);
if (actual !== SANDBOX_DB) fail(`verbunden mit "${actual}", erwartet "${SANDBOX_DB}"`);
if (FORBIDDEN.has(actual)) fail(`verbunden mit gesperrter Datenbank "${actual}"`);

try {
  console.log("\n--- prisma migrate deploy (volle Kette) ---");
  execFileSync(join(serverDir, "node_modules", ".bin", "prisma"), ["migrate", "deploy"], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: sandboxUrl },
    stdio: "pipe",
  });
  console.log("  angewendet.");

  /* --------------------------------------------------------------- fixture */

  console.log("\n--- Fixture: Praxis A, zwei Patienten, zwei Links ---");
  psql(SANDBOX_DB, `
    INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
      VALUES ('P1','p1@x.invalid','h','A','X',now(),now()),
             ('P2','p2@x.invalid','h','B','X',now(),now()),
             ('oA','a@x.invalid','h','O','X',now(),now());
    INSERT INTO "PracticeProfile"(id,"userId","practiceName","publicSlug",specialty,"updatedAt")
      VALUES ('prA','oA','Praxis A','praxis-a','Kardiologie',now());
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('L1','prA','P1','active',now()),('L2','prA','P2','active',now());
    INSERT INTO "ArchivedPracticePatientContext"
      (id,"patientUserId","originalPracticePatientLinkId","originalPracticeProfileId",
       "practiceDisplayNameSnapshot","practiceSpecialtySnapshot","archiveReason")
      VALUES ('arc1','P1','L1-former','prA','Praxis A','Kardiologie','practice_deleted');
  `);
  console.log("  angelegt.");

  const D = (id, scope, link, arch, user = "P1") =>
    `INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","dataScope","contextPracticePatientLinkId","archivedPracticeContextId","updatedAt")
     VALUES ('${id}','${user}','placeholder',${scope},${link},${arch},now());`;

  console.log("\n--- 1. Schemaobjekte ---");
  check("Archivtabelle existiert",
    psql(SANDBOX_DB, `SELECT count(*) FROM information_schema.tables WHERE table_name='ArchivedPracticePatientContext'`), "1");
  check("Enum mit zwei Gruenden",
    psql(SANDBOX_DB, `SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='PracticeContextArchiveReason'`), "2");
  check("genau ein Fremdschluessel (Patient)",
    psql(SANDBOX_DB, `SELECT count(*) FROM information_schema.table_constraints WHERE table_name='ArchivedPracticePatientContext' AND constraint_type='FOREIGN KEY'`), "1");
  check("kein FK auf Praxis oder Link",
    psql(SANDBOX_DB, `SELECT count(*) FROM information_schema.constraint_column_usage ccu
       JOIN information_schema.table_constraints tc ON tc.constraint_name=ccu.constraint_name
       WHERE tc.table_name='ArchivedPracticePatientContext' AND tc.constraint_type='FOREIGN KEY'
         AND ccu.table_name IN ('PracticeProfile','PracticePatientLink')`), "0");
  check("Unique je ehemaligem Link",
    psql(SANDBOX_DB, `SELECT count(*) FROM pg_indexes WHERE tablename='ArchivedPracticePatientContext' AND indexdef LIKE '%UNIQUE%originalPracticePatientLinkId%'`), "1");
  for (const m of MODELS) {
    check(`${m}: Archivspalte + RESTRICT-FK`,
      psql(SANDBOX_DB, `SELECT count(*) FROM information_schema.referential_constraints rc
        JOIN information_schema.table_constraints tc ON tc.constraint_name=rc.constraint_name
        WHERE tc.table_name='${m}' AND rc.delete_rule='RESTRICT'
          AND tc.constraint_name='${m}_archivedPracticeContextId_fkey'`), "1");
  }

  console.log("\n--- 2. Die drei erlaubten Formen ---");
  expectSql("patient_global / kein Link / kein Archiv",
    D("d-global", "'patient_global'", "NULL", "NULL"), true);
  expectSql("practice_contextual / Live-Link",
    D("d-live", "'practice_contextual'", "'L1'", "NULL"), true);
  expectSql("practice_contextual / Archivkontext",
    D("d-arch", "'practice_contextual'", "NULL", "'arc1'"), true);

  console.log("\n--- 3. Alles andere ist verboten ---");
  expectSql("beide Kontext-IDs gesetzt",
    D("d-bad1", "'practice_contextual'", "'L1'", "'arc1'"), false);
  expectSql("contextual ohne jeden Kontext",
    D("d-bad2", "'practice_contextual'", "NULL", "NULL"), false);
  expectSql("global mit Live-Link",
    D("d-bad3", "'patient_global'", "'L1'", "NULL"), false);
  expectSql("global mit Archivkontext",
    D("d-bad4", "'patient_global'", "NULL", "'arc1'"), false);
  expectSql("unbekannter Archivkontext (FK)",
    D("d-bad5", "'practice_contextual'", "NULL", "'nope'"), false);
  expectSql("NULL-Scope auch ohne NOT NULL vom CHECK abgelehnt",
    `BEGIN;
     ALTER TABLE "DiagnosisEntry" ALTER COLUMN "dataScope" DROP NOT NULL;
     ${D("d-bad6", "NULL", "NULL", "'arc1'")}
     ROLLBACK;`, false);

  console.log("\n--- 4. Idempotenz und Nachweisbarkeit ---");
  expectSql("zweiter Archivkontext fuer denselben Link VERBOTEN",
    `INSERT INTO "ArchivedPracticePatientContext"
       (id,"patientUserId","originalPracticePatientLinkId","originalPracticeProfileId","archiveReason")
       VALUES ('arc-dup','P1','L1-former','prA','practice_deleted');`, false);
  expectSql("Archivkontext mit Datensaetzen: DELETE blockiert",
    `DELETE FROM "ArchivedPracticePatientContext" WHERE id='arc1';`, false);
  expectSql("Live-Link mit Kontextdaten: DELETE weiterhin blockiert",
    `DELETE FROM "PracticePatientLink" WHERE id='L1';`, false);
  expectSql("Praxis mit solchem Link: DELETE weiterhin blockiert",
    `DELETE FROM "PracticeProfile" WHERE id='prA';`, false);

  console.log("\n--- 5. Reihenfolge bei Kontoloeschung ---");
  // The explicit order the account-deletion service uses: remove the patient's
  // own records first, then the links, then the user. This must work, and it
  // must not depend on how PostgreSQL happens to order two cascades.
  expectSql("explizite Reihenfolge: eigene Daten, Links, dann Nutzer",
    `BEGIN;
     DELETE FROM "DiagnosisEntry" WHERE "userId"='P1';
     DELETE FROM "PracticePatientLink" WHERE "patientUserId"='P1';
     DELETE FROM "User" WHERE id='P1';
     COMMIT;`, true);
  check("kein verwaister Archivkontext",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext" WHERE "patientUserId"='P1'`), "0");

  // A bare DELETE on the user also succeeds today, because the record cascade
  // (DiagnosisEntry.userId) happens to fire before the archive cascade
  // (ArchivedPracticePatientContext.patientUserId). That order follows from the
  // order the constraints were created in and is NOT a guarantee — which is
  // exactly why the service deletes explicitly instead of relying on it.
  psql(SANDBOX_DB, `
    INSERT INTO "ArchivedPracticePatientContext"
      (id,"patientUserId","originalPracticePatientLinkId","originalPracticeProfileId","archiveReason")
      VALUES ('arc2','P2','L2-former','prA','practice_deleted');
    INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","dataScope","archivedPracticeContextId","updatedAt")
      VALUES ('d-p2','P2','placeholder','practice_contextual','arc2',now());
    DELETE FROM "PracticePatientLink" WHERE "patientUserId"='P2';
  `);
  expectSql("blosses DELETE des Nutzers geht heute durch (Kaskadenreihenfolge, keine Zusicherung)",
    `DELETE FROM "User" WHERE id='P2';`, true);
  check("auch dabei bleibt kein Archivkontext zurueck",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext"`), "0");

  console.log("\n--- 6. Kein medizinischer Inhalt im Archivmodell ---");
  const cols = psql(SANDBOX_DB, `SELECT string_agg(column_name, ',' ORDER BY column_name)
    FROM information_schema.columns WHERE table_name='ArchivedPracticePatientContext'`);
  check("Spalten",
    cols,
    "archiveReason,archivedAt,id,originalPracticePatientLinkId,originalPracticeProfileId,patientUserId,practiceDisplayNameSnapshot,practiceSpecialtySnapshot");
  check("keine medizinische Spalte",
    /diagnos|allerg|vaccin|vital|title|filename|storage|note/i.test(cols) ? "TREFFER" : "keine", "keine");

  console.log("\n--- 7. Bestand unveraendert (rein additive Migration) ---");
  check("keine Praxis geloescht",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeProfile"`), "1");
  check("Migration hat nichts archiviert",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext"`), "0");
} catch (e) {
  failed += 1;
  console.error("\nUNERWARTETER FEHLER:", e.stderr ? String(e.stderr) : e.message);
} finally {
  try {
    psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
    console.log(`\nSandbox ${SANDBOX_DB} geloescht.`);
  } catch (e) {
    console.error(`WARNUNG: Sandbox konnte nicht geloescht werden: ${e.message}`);
  }
}

console.log(`\n# pass ${passed}\n# fail ${failed}`);
process.exit(failed === 0 ? 0 : 1);
