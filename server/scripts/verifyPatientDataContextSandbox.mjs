/**
 * Applies the full migration chain to a THROWAWAY sandbox database and checks
 * the patient-data-context constraints for real.
 *
 * Safety: the sandbox URL is built programmatically from DATABASE_URL, then
 * re-parsed and printed, and the connected database is verified with an exact
 * string comparison before anything runs. A previous attempt rewrote the URL
 * with sed, the pattern silently did not match, and the migration landed on the
 * shared development database — hence the hard guard here.
 *
 * Run: node scripts/verifyPatientDataContextSandbox.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");

const SANDBOX_DB = "medscoutx_ctx_sandbox";
/** Databases this script must never, under any circumstance, connect to. */
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

// Re-parse what we just built and report it, rather than trusting the edit.
const verify = new URL(sandboxUrl);
const connectedName = verify.pathname.replace(/^\//, "");

console.log("Basis-URL Datenbank :", new URL(baseUrl).pathname.replace(/^\//, ""));
console.log("Sandbox-URL Datenbank:", connectedName);
console.log("Host/Port           :", verify.hostname, verify.port || "(default)");

if (connectedName !== SANDBOX_DB) fail(`URL zeigt auf "${connectedName}", erwartet "${SANDBOX_DB}"`);
if (FORBIDDEN.has(connectedName)) fail(`"${connectedName}" steht auf der Sperrliste`);

/* ------------------------------------------------- create a fresh sandbox */

const psql = (db, sql) =>
  execFileSync("psql", ["-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { encoding: "utf8" }).trim();

psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
psql("postgres", `CREATE DATABASE "${SANDBOX_DB}"`);

// Second guard: ask the server itself which database we reached.
const actual = psql(SANDBOX_DB, "SELECT current_database()");
console.log("current_database()  :", actual);
if (actual !== SANDBOX_DB) fail(`verbunden mit "${actual}", erwartet "${SANDBOX_DB}"`);
if (FORBIDDEN.has(actual)) fail(`verbunden mit gesperrter Datenbank "${actual}"`);

/* ------------------------------------------------------- migrate + assert */

console.log("\n--- prisma migrate deploy (Sandbox) ---");
execFileSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: serverDir,
  env: { ...process.env, DATABASE_URL: sandboxUrl },
  stdio: "inherit",
});

let passed = 0;
let failed = 0;

/** Runs SQL and asserts whether it should succeed or be rejected. */
function expect(label, sql, shouldSucceed) {
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

console.log("\n--- Fixture ---");
psql(SANDBOX_DB, `
  INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
    VALUES ('u1','p@x.org','h','P','X',now(),now()),
           ('u2','o@x.org','h','O','W',now(),now()),
           ('u3','q@x.org','h','Q','Y',now(),now());
  INSERT INTO "PracticeProfile"(id,"userId","practiceName","publicSlug","updatedAt")
    VALUES ('pr1','u2','Praxis A','praxis-a',now());
  -- Only one active link per (practice, patient) is allowed, so lk2 belongs to
  -- a second patient: it is the control for "link without contextual records".
  INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
    VALUES ('lk1','pr1','u1','active',now()),('lk2','pr1','u3','active',now());
`);

console.log("\n--- Check-Constraints ---");
const D = (id, scope, ctx) =>
  `INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","dataScope","contextPracticePatientLinkId","updatedAt")
   VALUES ('${id}','u1','X',${scope},${ctx},now());`;

// Was the transitional state while the backfill was pending. This script
// deploys the FULL migration chain, so 20260728120000_backfill_patient_data_scope
// has run: the scope is mandatory and the CHECK rejects an unclassified row.
expect("NULL / NULL nach Backfill VERBOTEN",       D("d1", "NULL", "NULL"), false);
expect("patient_global / NULL erlaubt",            D("d2", "'patient_global'", "NULL"), true);
expect("practice_contextual / Link-ID erlaubt",    D("d3", "'practice_contextual'", "'lk1'"), true);
expect("patient_global / Link-ID VERBOTEN",        D("d4", "'patient_global'", "'lk1'"), false);
expect("practice_contextual / NULL VERBOTEN",      D("d5", "'practice_contextual'", "NULL"), false);
expect("NULL / Link-ID VERBOTEN",                  D("d6", "NULL", "'lk1'"), false);
expect("unbekannter Link VERBOTEN (FK)",           D("d7", "'practice_contextual'", "'nope'"), false);

console.log("\n--- Löschsemantik ---");
expect("Link MIT Kontextdaten: DELETE blockiert",
  `DELETE FROM "PracticePatientLink" WHERE id='lk1';`, false);
expect("Link OHNE Kontextdaten: DELETE moeglich",
  `DELETE FROM "PracticePatientLink" WHERE id='lk2';`, true);
expect("Widerruf per Status bleibt moeglich",
  `UPDATE "PracticePatientLink" SET status='revoked', "revokedAt"=now() WHERE id='lk1';`, true);
expect("medizinischer Datensatz ueberlebt den Widerruf",
  `SELECT 1/(CASE WHEN (SELECT count(*) FROM "DiagnosisEntry" WHERE id='d3')=1 THEN 1 ELSE 0 END);`, true);

/* ------------------------------------------------------------- teardown */

psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
console.log(`\nSandbox ${SANDBOX_DB} geloescht.`);
console.log(`\n# pass ${passed}\n# fail ${failed}`);
process.exit(failed === 0 ? 0 : 1);
