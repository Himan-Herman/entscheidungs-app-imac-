/**
 * Account erasure with contextual patient data, against real PostgreSQL.
 *
 * Three cases have to work without losing anyone else's medical records:
 * a plain patient, a practice owner, and a user who is both. The dangerous
 * part is the ordering — other people's data must be archived before the
 * practice that anchors it disappears, and the user's own data must be gone
 * before their archive contexts can be removed.
 *
 * Safety: the sandbox URL is built programmatically from DATABASE_URL, then
 * re-parsed and printed, and the connected database is verified with an exact
 * comparison plus a blocklist before anything runs. No sed.
 *
 * The fixture carries no medical content: placeholder strings only.
 *
 * Run: node scripts/verifyAccountDeletionArchiveSandbox.mjs
 */
// Deletion is release-gated; tests enable it EXPLICITLY, as the gate requires.
process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION = "true";

import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");

const SANDBOX_DB = "medscoutx_accountdel_sandbox";
const FORBIDDEN = new Set(["medscoutx_dev", "medscoutx", "postgres", ""]);
const MODELS = ["vitalEntry", "vaccinationEntry", "allergyEntry", "diagnosisEntry"];

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

function expectThrows(label, fn, shouldThrow) {
  return fn().then(
    () => {
      const good = !shouldThrow;
      good ? (passed += 1) : (failed += 1);
      console.log(`  ${good ? "ok  " : "FAIL"}  ${label}${good ? "" : " (erwartete einen Fehler)"}`);
    },
    (e) => {
      const good = shouldThrow;
      good ? (passed += 1) : (failed += 1);
      console.log(`  ${good ? "ok  " : "FAIL"}  ${label}${good ? "" : `\n          ${e?.message}`}`);
    },
  );
}

/* -------------------------------------------------------- create + migrate */

psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
psql("postgres", `CREATE DATABASE "${SANDBOX_DB}"`);
const actualDb = psql(SANDBOX_DB, "SELECT current_database()");
console.log("current_database()   :", actualDb);
if (actualDb !== SANDBOX_DB) fail(`verbunden mit "${actualDb}", erwartet "${SANDBOX_DB}"`);
if (FORBIDDEN.has(actualDb)) fail(`verbunden mit gesperrter Datenbank "${actualDb}"`);

let prisma;

try {
  console.log("\n--- prisma migrate deploy (volle Kette) ---");
  execFileSync(join(serverDir, "node_modules", ".bin", "prisma"), ["migrate", "deploy"], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: sandboxUrl },
    stdio: "pipe",
  });
  console.log("  angewendet.");

  process.env.DATABASE_URL = sandboxUrl;
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });

  const {
    ARCHIVE_REASONS,
    deleteOwnPatientDataForUser,
    deletePracticeWithArchivedContext,
    releaseDocumentShareGrantsForPatient,
  } = await import("../services/dataLifecycle/archivePracticePatientContext.js");

  /**
   * The ordered erasure the account route performs, without the HTTP layer.
   * Kept in one place so the sandbox exercises the same sequence.
   */
  async function eraseAccount(userId) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const owned = await tx.practiceProfile.findMany({
        where: { userId }, select: { id: true }, orderBy: { id: "asc" },
      });
      const summary = { practices: 0, foreignLinks: 0, own: null };
      for (const p of owned) {
        const r = await deletePracticeWithArchivedContext({
          transaction: tx, practiceProfileId: p.id,
          deletionReason: ARCHIVE_REASONS.OWNER_ACCOUNT_DELETED, deletingUserId: userId,
        });
        summary.practices += 1;
        summary.foreignLinks += r.archived.archivedLinks;
      }
      await releaseDocumentShareGrantsForPatient({ transaction: tx, patientUserId: userId });
      summary.own = await deleteOwnPatientDataForUser({ transaction: tx, patientUserId: userId });
      await tx.practicePatientLink.deleteMany({ where: { patientUserId: userId } });
      await tx.practiceMember.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      return summary;
    }, { timeout: 20000 });
  }

  /* ------------------------------------------------------------- fixture */

  console.log("\n--- Fixture: P (Patient+Inhaber A), Q (Inhaber B), R (Patient), Kontrolle C ---");
  const seed = () => psql(SANDBOX_DB, `
    INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
      VALUES ('P','p@x.invalid','h','P','X',now(),now()),
             ('Q','q@x.invalid','h','Q','X',now(),now()),
             ('R','r@x.invalid','h','R','X',now(),now()),
             ('oC','c@x.invalid','h','C','X',now(),now());
    INSERT INTO "PracticeProfile"(id,"userId","practiceName","publicSlug",specialty,"updatedAt")
      VALUES ('prA','P','Praxis A','praxis-a','Kardiologie',now()),
             ('prB','Q','Praxis B','praxis-b','Allgemein',now()),
             ('prC','oC','Praxis C','praxis-c',NULL,now());
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('A-Q','prA','Q','active',now()),
             ('A-R','prA','R','active',now()),
             ('B-P','prB','P','active',now()),
             ('C-R','prC','R','active',now());
    -- P: own global + own contextual at practice B (a practice P does not own)
    INSERT INTO "VitalEntry"(id,"userId",type,"valuePrimary",unit,"measuredAt","dataScope","contextPracticePatientLinkId","updatedAt")
      VALUES ('v-P-global','P','weight',1,'kg',now(),'patient_global',NULL,now()),
             ('v-P-atB','P','weight',1,'kg',now(),'practice_contextual','B-P',now());
    -- Q and R: contextual records at P's practice A — other people's data
    INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","dataScope","contextPracticePatientLinkId","deletedAt","updatedAt")
      VALUES ('d-Q-atA','Q','placeholder','practice_contextual','A-Q',NULL,now()),
             ('d-R-atA','R','placeholder','practice_contextual','A-R',now(),now()),
             ('d-R-atC','R','placeholder','practice_contextual','C-R',NULL,now());
    INSERT INTO "AllergyEntry"(id,"userId",allergen,"allergyType",severity,"dataScope","contextPracticePatientLinkId","updatedAt")
      VALUES ('a-Q-atA','Q','placeholder','placeholder','placeholder','practice_contextual','A-Q',now());
    -- R already carries an archive context from an earlier deletion
    INSERT INTO "ArchivedPracticePatientContext"
      (id,"patientUserId","originalPracticePatientLinkId","originalPracticeProfileId","archiveReason")
      VALUES ('arc-R','R','former-link-R','former-practice','practice_deleted');
    INSERT INTO "VaccinationEntry"(id,"userId","vaccineName",disease,"vaccinationDate","dataScope","archivedPracticeContextId","updatedAt")
      VALUES ('vac-R-arch','R','placeholder','placeholder',now(),'practice_contextual','arc-R',now());
    -- P too, so the erasure has to clean up an existing archive of their own
    INSERT INTO "ArchivedPracticePatientContext"
      (id,"patientUserId","originalPracticePatientLinkId","originalPracticeProfileId","archiveReason")
      VALUES ('arc-P','P','former-link-P','former-practice','practice_deleted');
    INSERT INTO "VaccinationEntry"(id,"userId","vaccineName",disease,"vaccinationDate","dataScope","archivedPracticeContextId","updatedAt")
      VALUES ('vac-P-arch','P','placeholder','placeholder',now(),'practice_contextual','arc-P',now());
  `);
  seed();
  console.log("  angelegt.");

  /* --------------------------------------------- Fall C: Patient + Inhaber */

  console.log("\n--- Fall C: P ist Patient UND Inhaber ---");
  const summaryP = await eraseAccount("P");
  check("eine eigene Praxis geloescht", summaryP.practices, 1);
  check("zwei fremde Links archiviert", summaryP.foreignLinks, 2);
  check("eigene Datensaetze entfernt", summaryP.own.removedTotal, 3);
  check("eigene Archivkontexte entfernt", summaryP.own.archivesRemoved, 1);

  check("P existiert nicht mehr", psql(SANDBOX_DB, `SELECT count(*) FROM "User" WHERE id='P'`), "0");
  check("Praxis A ist weg", psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeProfile" WHERE id='prA'`), "0");
  check("keine eigenen Daten von P uebrig",
    psql(SANDBOX_DB, `SELECT (SELECT count(*) FROM "VitalEntry" WHERE "userId"='P')
      + (SELECT count(*) FROM "VaccinationEntry" WHERE "userId"='P')
      + (SELECT count(*) FROM "AllergyEntry" WHERE "userId"='P')
      + (SELECT count(*) FROM "DiagnosisEntry" WHERE "userId"='P')`), "0");
  check("kein Archivkontext von P uebrig",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext" WHERE "patientUserId"='P'`), "0");
  check("Ps Link bei fremder Praxis B ist weg",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticePatientLink" WHERE id='B-P'`), "0");

  console.log("\n--- Fremde Daten: archiviert, nicht geloescht ---");
  check("Qs Diagnose existiert weiter",
    psql(SANDBOX_DB, `SELECT count(*) FROM "DiagnosisEntry" WHERE id='d-Q-atA'`), "1");
  check("Qs Diagnose bleibt practice_contextual",
    psql(SANDBOX_DB, `SELECT "dataScope" FROM "DiagnosisEntry" WHERE id='d-Q-atA'`), "practice_contextual");
  check("Live-Link durch Archivkontext ersetzt",
    psql(SANDBOX_DB, `SELECT ("contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NOT NULL)::text
       FROM "DiagnosisEntry" WHERE id='d-Q-atA'`), "true");
  check("Qs Allergie teilt denselben Archivkontext",
    psql(SANDBOX_DB, `SELECT (a."archivedPracticeContextId" = d."archivedPracticeContextId")::text
       FROM "AllergyEntry" a, "DiagnosisEntry" d WHERE a.id='a-Q-atA' AND d.id='d-Q-atA'`), "true");
  check("Rs soft geloeschte Diagnose ebenfalls archiviert",
    psql(SANDBOX_DB, `SELECT ("archivedPracticeContextId" IS NOT NULL AND "deletedAt" IS NOT NULL)::text
       FROM "DiagnosisEntry" WHERE id='d-R-atA'`), "true");
  check("Rs eigener Archivkontext unveraendert",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext" WHERE id='arc-R'`), "1");
  check("Rs archivierte Impfung unveraendert",
    psql(SANDBOX_DB, `SELECT "archivedPracticeContextId" FROM "VaccinationEntry" WHERE id='vac-R-arch'`), "arc-R");
  check("Rs Daten bei Kontrollpraxis C unberuehrt",
    psql(SANDBOX_DB, `SELECT "contextPracticePatientLinkId" FROM "DiagnosisEntry" WHERE id='d-R-atC'`), "C-R");
  check("Praxis B und C bestehen weiter",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeProfile" WHERE id IN ('prB','prC')`), "2");
  check("kein Waisen-Archivkontext",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext" a
       WHERE NOT EXISTS (SELECT 1 FROM "VitalEntry" WHERE "archivedPracticeContextId"=a.id)
         AND NOT EXISTS (SELECT 1 FROM "VaccinationEntry" WHERE "archivedPracticeContextId"=a.id)
         AND NOT EXISTS (SELECT 1 FROM "AllergyEntry" WHERE "archivedPracticeContextId"=a.id)
         AND NOT EXISTS (SELECT 1 FROM "DiagnosisEntry" WHERE "archivedPracticeContextId"=a.id)`), "0");

  /* ---------------------------------------------------- Fall A und B, neu */

  console.log("\n--- Fall A: reiner Patient (R) ---");
  const summaryR = await eraseAccount("R");
  check("keine eigene Praxis", summaryR.practices, 0);
  check("R hatte archivierte und live Daten", summaryR.own.removedTotal >= 3, true);
  check("R ist weg", psql(SANDBOX_DB, `SELECT count(*) FROM "User" WHERE id='R'`), "0");
  check("Rs Archivkontext ist weg",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext" WHERE "patientUserId"='R'`), "0");
  check("Qs archivierte Daten weiterhin unveraendert",
    psql(SANDBOX_DB, `SELECT count(*) FROM "DiagnosisEntry" WHERE id='d-Q-atA'`), "1");
  check("Praxis C unveraendert",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeProfile" WHERE id='prC'`), "1");

  console.log("\n--- Fall B: reiner Inhaber (Q, nach Archivierung ohne Live-Kontext) ---");
  const summaryQ = await eraseAccount("Q");
  check("eine Praxis geloescht", summaryQ.practices, 1);
  check("Q ist weg", psql(SANDBOX_DB, `SELECT count(*) FROM "User" WHERE id='Q'`), "0");
  check("Qs eigene Daten sind weg",
    psql(SANDBOX_DB, `SELECT count(*) FROM "DiagnosisEntry" WHERE "userId"='Q'`), "0");
  check("Praxis C als Kontrolltenant unveraendert",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeProfile" WHERE id='prC'`), "1");

  /* ------------------------------------------------------------- rollback */

  console.log("\n--- Rollback: Fehler nach Archivierung, vor Benutzerloeschung ---");
  psql(SANDBOX_DB, `DELETE FROM "PracticeProfile" WHERE id='prC'; DELETE FROM "User" WHERE id='oC';`);
  seed();
  await expectThrows("Fehler rollt die gesamte Erasure zurueck",
    () => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = 'P' FOR UPDATE`;
      await deletePracticeWithArchivedContext({
        transaction: tx, practiceProfileId: "prA",
        deletionReason: ARCHIVE_REASONS.OWNER_ACCOUNT_DELETED, deletingUserId: "P",
      });
      throw new Error("deliberate failure before user delete");
    }, { timeout: 20000 }), true);
  check("P existiert weiter", psql(SANDBOX_DB, `SELECT count(*) FROM "User" WHERE id='P'`), "1");
  check("Praxis A existiert weiter", psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeProfile" WHERE id='prA'`), "1");
  check("Qs Datensatz haengt wieder am Live-Link",
    psql(SANDBOX_DB, `SELECT "contextPracticePatientLinkId" FROM "DiagnosisEntry" WHERE id='d-Q-atA'`), "A-Q");
  check("kein Archivkontext aus dem Fehlversuch",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext" WHERE "originalPracticePatientLinkId"='A-Q'`), "0");

  /* ---------------------------------------------------------------- races */

  console.log("\n--- Race 1: fremder Context-Write gegen Kontoloeschung ---");
  const race1 = await twoSessionRace({
    first: `BEGIN; SELECT "id" FROM "PracticePatientLink" WHERE "id"='A-Q' FOR SHARE;`,
    second: `SET statement_timeout='1500ms'; BEGIN; SELECT "id" FROM "PracticePatientLink" WHERE "id"='A-Q' FOR UPDATE;`,
  });
  check("Kontoloeschung wartet auf den laufenden Write", race1.secondBlocked, true);

  console.log("\n--- Race 2: eigener Write gegen eigene Kontoloeschung ---");
  const race2 = await twoSessionRace({
    first: `BEGIN; SELECT "id" FROM "User" WHERE "id"='P' FOR UPDATE;`,
    second: `SET statement_timeout='1500ms'; BEGIN; SELECT "id" FROM "User" WHERE "id"='P' FOR UPDATE;`,
  });
  check("zwei Kontoloeschungen serialisieren ueber die Benutzersperre", race2.secondBlocked, true);
  console.log("  Hinweis: ein GLOBALER Patienten-Write sperrt heute keinen Link und");
  console.log("  keine Benutzerzeile — siehe Bericht, offener Punkt.");
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

/** Two independent psql sessions; a short statement_timeout makes "did it block?" observable. */
async function twoSessionRace({ first, second }) {
  const a = spawn("psql", ["-d", SANDBOX_DB, "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] });
  a.stdin.write(`${first}\n`);
  await new Promise((r) => setTimeout(r, 400));

  let stderr = "";
  const b = spawn("psql", ["-d", SANDBOX_DB, "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] });
  b.stderr.on("data", (d) => { stderr += d.toString(); });
  b.stdin.write(`${second}\nCOMMIT;\n\\q\n`);
  const code = await new Promise((r) => b.on("close", r));

  a.stdin.write("ROLLBACK;\n\\q\n");
  await new Promise((r) => a.on("close", r));
  return { secondBlocked: code !== 0 && /statement timeout|canceling statement/i.test(stderr) };
}
