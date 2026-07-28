/**
 * Applies the full migration chain to a THROWAWAY sandbox database and checks
 * the document-share-grant constraints for real.
 *
 * The invariants that matter here — only the patient may grant, source and
 * target must differ, at most one active grant per (document, target link) —
 * are enforced by the database, not only by service code. That can only be
 * proven against actual PostgreSQL.
 *
 * Safety: the sandbox URL is built programmatically from DATABASE_URL, then
 * re-parsed and printed, and the connected database is verified with an exact
 * comparison plus a blocklist before anything runs. No sed.
 *
 * The fixture carries no medical content: placeholder titles only.
 *
 * Run: node scripts/verifyDocumentShareGrantSandbox.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");

const SANDBOX_DB = "medscoutx_grant_sandbox";
/** Databases this script must never, under any circumstance, connect to. */
const FORBIDDEN = new Set(["medscoutx_dev", "medscoutx", "postgres", ""]);
const TABLE = "PracticeDocumentShareGrant";

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
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: sandboxUrl },
    stdio: "pipe",
  });
  console.log("  angewendet.");

  /* ------------------------------------------------- three-practice fixture */

  console.log("\n--- Fixture: Patient P, Herkunftspraxis B, Zielpraxis A, Praxis C ---");
  psql(SANDBOX_DB, `
    INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
      VALUES ('P','p@x.invalid','h','P','X',now(),now()),
             ('P2','p2@x.invalid','h','Q','X',now(),now()),
             ('oA','a@x.invalid','h','A','X',now(),now()),
             ('oB','b@x.invalid','h','B','X',now(),now()),
             ('oC','c@x.invalid','h','C','X',now(),now());
    INSERT INTO "PracticeProfile"(id,"userId","practiceName","publicSlug","updatedAt")
      VALUES ('prA','oA','Praxis A','praxis-a',now()),
             ('prB','oB','Praxis B','praxis-b',now()),
             ('prC','oC','Praxis C','praxis-c',now());
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('L-A','prA','P','active',now()),
             ('L-B','prB','P','active',now()),
             ('L-C','prC','P','active',now()),
             ('L-B2','prB','P2','active',now());
    INSERT INTO "PracticeDocument"(id,"practicePatientLinkId","practiceProfileId","patientUserId",type,title,status,"updatedAt")
      VALUES ('D-B','L-B','prB','P','report','placeholder','shared',now()),
             ('D-FOREIGN','L-B2','prB','P2','report','placeholder','shared',now()),
             ('D-DELETED','L-B','prB','P','report','placeholder','deleted',now());
  `);
  console.log("  angelegt.");

  const G = (id, opts = {}) => {
    const o = {
      doc: "D-B", patient: "P", grantedBy: "P",
      srcPractice: "prB", srcLink: "L-B",
      tgtPractice: "prA", tgtLink: "L-A",
      status: "'active'", revokedAt: "NULL", expiresAt: "NULL",
      ...opts,
    };
    return `INSERT INTO "${TABLE}"(id,"documentId","patientUserId","sourcePracticeProfileId","sourcePracticePatientLinkId","targetPracticeProfileId","targetPracticePatientLinkId",status,"grantedByUserId","grantedAt","revokedAt","expiresAt","updatedAt")
            VALUES ('${id}','${o.doc}','${o.patient}','${o.srcPractice}','${o.srcLink}','${o.tgtPractice}','${o.tgtLink}',${o.status},'${o.grantedBy}',now(),${o.revokedAt},${o.expiresAt},now());`;
  };

  console.log("\n--- 1. Schemaobjekte ---");
  check("Tabelle existiert",
    psql(SANDBOX_DB, `SELECT count(*) FROM information_schema.tables WHERE table_name='${TABLE}'`), "1");
  check("7 echte Fremdschluessel",
    psql(SANDBOX_DB, `SELECT count(*) FROM information_schema.table_constraints WHERE table_name='${TABLE}' AND constraint_type='FOREIGN KEY'`), "7");
  check("alle Fremdschluessel sind RESTRICT",
    psql(SANDBOX_DB, `SELECT count(*) FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON tc.constraint_name=rc.constraint_name
      WHERE tc.table_name='${TABLE}' AND rc.delete_rule='RESTRICT'`), "7");
  check("partieller Unique-Index auf aktive Grants",
    psql(SANDBOX_DB, `SELECT count(*) FROM pg_indexes WHERE tablename='${TABLE}' AND indexname='${TABLE}_active_unique' AND indexdef LIKE '%WHERE (status%'`), "1");
  check("4 CHECK-Constraints",
    psql(SANDBOX_DB, `SELECT count(*) FROM pg_constraint WHERE conrelid='"${TABLE}"'::regclass AND contype='c' AND conname LIKE '%_check'`), "4");

  console.log("\n--- 2. Gueltiger Grant ---");
  expectSql("Patient P gibt D-B fuer L-A frei", G("g1"), true);
  check("Grant ist aktiv",
    psql(SANDBOX_DB, `SELECT status FROM "${TABLE}" WHERE id='g1'`), "active");
  check("Source- und Target-Relationen korrekt",
    psql(SANDBOX_DB, `SELECT "sourcePracticeProfileId"||'/'||"sourcePracticePatientLinkId"||' -> '||"targetPracticeProfileId"||'/'||"targetPracticePatientLinkId" FROM "${TABLE}" WHERE id='g1'`),
    "prB/L-B -> prA/L-A");

  console.log("\n--- 3. Nur der Patient darf freigeben ---");
  expectSql("Praxisinhaber als grantedBy VERBOTEN", G("g-bad1", { grantedBy: "oA" }), false);
  expectSql("Praxisinhaber der Herkunftspraxis VERBOTEN", G("g-bad2", { grantedBy: "oB" }), false);
  expectSql("anderer Patient als grantedBy VERBOTEN", G("g-bad3", { grantedBy: "P2" }), false);

  console.log("\n--- 4. Quelle und Ziel muessen verschieden sein ---");
  expectSql("gleiche Praxis VERBOTEN", G("g-bad4", { tgtPractice: "prB", tgtLink: "L-B" }), false);
  expectSql("gleicher Link VERBOTEN", G("g-bad5", { tgtLink: "L-B" }), false);

  console.log("\n--- 5. Zustandsmaschine ---");
  expectSql("unbekannter Status VERBOTEN", G("g-bad6", { status: "'pending'" }), false);
  expectSql("leerer Status VERBOTEN", G("g-bad7", { status: "''" }), false);
  expectSql("active mit revokedAt VERBOTEN", G("g-bad8", { revokedAt: "now()" }), false);
  expectSql("revoked ohne revokedAt VERBOTEN", G("g-bad9", { status: "'revoked'" }), false);
  expectSql("expired ohne expiresAt VERBOTEN", G("g-bad10", { status: "'expired'" }), false);
  expectSql("revoked mit revokedAt erlaubt",
    G("g-rev", { doc: "D-DELETED", status: "'revoked'", revokedAt: "now()" }), true);

  console.log("\n--- 6. Nur ein aktiver Grant je (Dokument, Ziel-Link) ---");
  expectSql("zweiter aktiver Grant VERBOTEN", G("g2"), false);
  expectSql("aktiver Grant fuer anderen Ziel-Link erlaubt",
    G("g3", { tgtPractice: "prC", tgtLink: "L-C" }), true);

  console.log("\n--- 7. Historie: Widerruf bleibt erhalten, Neufreigabe moeglich ---");
  expectSql("Widerruf von g1",
    `UPDATE "${TABLE}" SET status='revoked', "revokedAt"=now() WHERE id='g1' AND status='active';`, true);
  expectSql("neuer aktiver Grant nach Widerruf erlaubt", G("g4"), true);
  check("alter Widerruf nicht ueberschrieben",
    psql(SANDBOX_DB, `SELECT status||'/'||(("revokedAt" IS NOT NULL)::text) FROM "${TABLE}" WHERE id='g1'`), "revoked/true");
  check("genau ein aktiver Grant fuer (D-B, L-A)",
    psql(SANDBOX_DB, `SELECT count(*) FROM "${TABLE}" WHERE "documentId"='D-B' AND "targetPracticePatientLinkId"='L-A' AND status='active'`), "1");

  console.log("\n--- 8. Fremdschluessel greifen ---");
  expectSql("unbekanntes Dokument VERBOTEN", G("g-bad11", { doc: "nope" }), false);
  expectSql("unbekannter Ziel-Link VERBOTEN", G("g-bad12", { tgtLink: "nope" }), false);
  expectSql("unbekannter Patient VERBOTEN", G("g-bad13", { patient: "nope", grantedBy: "nope" }), false);

  console.log("\n--- 9. RESTRICT schuetzt die Nachweisbarkeit ---");
  expectSql("Dokument mit Grant: DELETE blockiert",
    `DELETE FROM "PracticeDocument" WHERE id='D-B';`, false);
  expectSql("Ziel-Link mit Grant: DELETE blockiert",
    `DELETE FROM "PracticePatientLink" WHERE id='L-A';`, false);
  expectSql("Widerruf des Ziel-Links per Status bleibt moeglich",
    `UPDATE "PracticePatientLink" SET status='revoked' WHERE id='L-A';`, true);
  check("Grant ueberlebt den Link-Widerruf",
    psql(SANDBOX_DB, `SELECT count(*) FROM "${TABLE}" WHERE id='g4'`), "1");

  console.log("\n--- 10. Kein Datensatz wurde kopiert ---");
  check("Dokumentanzahl unveraendert",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeDocument"`), "3");
  check("keine Datei angelegt",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeDocumentFile"`), "0");
  check("PracticeDocumentShare unberuehrt",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeDocumentShare"`), "0");
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
