/**
 * Practice deletion with contextual-data archiving, against real PostgreSQL.
 *
 * The behaviour this proves cannot be faked: FOR UPDATE against FOR SHARE,
 * ON DELETE RESTRICT actually releasing, a rollback leaving nothing behind.
 * All of it runs in a throwaway database.
 *
 * Safety: the sandbox URL is built programmatically from DATABASE_URL, then
 * re-parsed and printed, and the connected database is verified with an exact
 * comparison plus a blocklist before anything runs. No sed.
 *
 * The fixture carries no medical content: placeholder strings only.
 *
 * Run: node scripts/verifyPracticeDeletionArchiveSandbox.mjs
 */
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");

const SANDBOX_DB = "medscoutx_practicedel_sandbox";
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
    archiveContextualPatientDataForLinks,
    releaseDocumentShareGrantsForPractice,
    ARCHIVE_REASONS,
  } = await import("../services/dataLifecycle/archivePracticePatientContext.js");
  const { checkPracticeDeletionBlockers } =
    await import("../services/dataLifecycle/contextualPatientDataDeletionGuard.js");

  /* ------------------------------------------------------------- fixture */

  console.log("\n--- Fixture: Praxis A (2 Patienten), Praxis B, Praxis C ---");
  psql(SANDBOX_DB, `
    INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
      VALUES ('P1','p1@x.invalid','h','P','X',now(),now()),
             ('P2','p2@x.invalid','h','Q','X',now(),now()),
             ('P3','p3@x.invalid','h','R','X',now(),now()),
             ('oA','a@x.invalid','h','A','X',now(),now()),
             ('oB','b@x.invalid','h','B','X',now(),now()),
             ('oC','c@x.invalid','h','C','X',now(),now());
    INSERT INTO "PracticeProfile"(id,"userId","practiceName","publicSlug",specialty,"displayNameForPatients","updatedAt")
      VALUES ('prA','oA','Praxis A','praxis-a','Kardiologie','Kardiologiepraxis A',now()),
             ('prB','oB','Praxis B','praxis-b','Allgemeinmedizin',NULL,now()),
             ('prC','oC','Praxis C','praxis-c',NULL,NULL,now());
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('A-P1','prA','P1','active',now()),
             ('A-P2','prA','P2','active',now()),
             ('B-P1','prB','P1','active',now()),
             ('C-P1','prC','P1','active',now());
  `);

  const seedRecords = () => psql(SANDBOX_DB, `
    INSERT INTO "VitalEntry"(id,"userId",type,"valuePrimary",unit,"measuredAt","dataScope","contextPracticePatientLinkId","updatedAt")
      VALUES ('v-global','P1','weight',1,'kg',now(),'patient_global',NULL,now()),
             ('v-A','P1','weight',1,'kg',now(),'practice_contextual','A-P1',now()),
             ('v-B','P1','weight',1,'kg',now(),'practice_contextual','B-P1',now());
    INSERT INTO "VaccinationEntry"(id,"userId","vaccineName",disease,"vaccinationDate","dataScope","contextPracticePatientLinkId","updatedAt")
      VALUES ('vac-A','P1','placeholder','placeholder',now(),'practice_contextual','A-P1',now());
    INSERT INTO "AllergyEntry"(id,"userId",allergen,"allergyType",severity,"dataScope","contextPracticePatientLinkId","updatedAt")
      VALUES ('all-A','P1','placeholder','placeholder','placeholder','practice_contextual','A-P1',now());
    INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","dataScope","contextPracticePatientLinkId","deletedAt","updatedAt")
      VALUES ('dia-A','P1','placeholder','practice_contextual','A-P1',NULL,now()),
             ('dia-A-del','P1','placeholder','practice_contextual','A-P1',now(),now()),
             ('dia-A2','P2','placeholder','practice_contextual','A-P2',NULL,now());
  `);
  seedRecords();
  console.log("  angelegt.");

  /* ------------------------------------------ 1.–13. archiving on deletion */

  console.log("\n--- 1. Vor der Archivierung blockiert der Guard ---");
  check("Guard meldet blockiert",
    (await checkPracticeDeletionBlockers("prA", prisma)).blocked, true);
  check("Praxis mit Kontextdaten: DELETE blockiert",
    await prisma.$queryRawUnsafe(`SELECT 1`).then(async () => {
      try { await prisma.practiceProfile.delete({ where: { id: "prA" } }); return "durchgelassen"; }
      catch { return "blockiert"; }
    }), "blockiert");

  console.log("\n--- 2. Archivierung im Transaktionskontext ---");
  const result = await prisma.$transaction(async (tx) => {
    const links = await tx.practicePatientLink.findMany({
      where: { practiceProfileId: "prA" }, select: { id: true }, orderBy: { id: "asc" },
    });
    return archiveContextualPatientDataForLinks({
      transaction: tx,
      linkIds: links.map((l) => l.id),
      archiveReason: ARCHIVE_REASONS.PRACTICE_DELETED,
      expectedPracticeProfileId: "prA",
    });
  });
  check("zwei Links archiviert", result.archivedLinks, 2);
  check("sechs Datensaetze verschoben", result.movedTotal, 6);
  check("je Modell", JSON.stringify(result.movedByModel),
    '{"vitalEntry":1,"vaccinationEntry":1,"allergyEntry":1,"diagnosisEntry":3}');

  console.log("\n--- 3. Ergebnis im Datenbestand ---");
  check("ein Archivkontext je Link",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext"`), "2");
  check("alle vier Typen desselben Links teilen einen Kontext",
    psql(SANDBOX_DB, `SELECT count(DISTINCT ctx) FROM (
       SELECT "archivedPracticeContextId" AS ctx FROM "VitalEntry" WHERE id='v-A'
       UNION SELECT "archivedPracticeContextId" FROM "VaccinationEntry" WHERE id='vac-A'
       UNION SELECT "archivedPracticeContextId" FROM "AllergyEntry" WHERE id='all-A'
       UNION SELECT "archivedPracticeContextId" FROM "DiagnosisEntry" WHERE id='dia-A') t`), "1");
  check("verschiedene Links, verschiedene Kontexte",
    psql(SANDBOX_DB, `SELECT ("archivedPracticeContextId" <> (SELECT "archivedPracticeContextId" FROM "DiagnosisEntry" WHERE id='dia-A2'))::text
       FROM "DiagnosisEntry" WHERE id='dia-A'`), "true");
  check("dataScope bleibt practice_contextual",
    psql(SANDBOX_DB, `SELECT count(*) FROM "DiagnosisEntry" WHERE id IN ('dia-A','dia-A-del','dia-A2') AND "dataScope"='practice_contextual'`), "3");
  check("Live-Link entfernt",
    psql(SANDBOX_DB, `SELECT count(*) FROM "DiagnosisEntry" WHERE "contextPracticePatientLinkId"='A-P1'`), "0");
  check("soft geloeschter Datensatz ebenfalls archiviert",
    psql(SANDBOX_DB, `SELECT ("archivedPracticeContextId" IS NOT NULL AND "deletedAt" IS NOT NULL)::text FROM "DiagnosisEntry" WHERE id='dia-A-del'`), "true");
  check("globaler Datensatz unveraendert",
    psql(SANDBOX_DB, `SELECT ("dataScope"='patient_global' AND "contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NULL)::text FROM "VitalEntry" WHERE id='v-global'`), "true");
  check("fremde Praxis B unberuehrt",
    psql(SANDBOX_DB, `SELECT ("contextPracticePatientLinkId"='B-P1')::text FROM "VitalEntry" WHERE id='v-B'`), "true");
  check("Praxisname im Snapshot",
    psql(SANDBOX_DB, `SELECT "practiceDisplayNameSnapshot"||'/'||"practiceSpecialtySnapshot" FROM "ArchivedPracticePatientContext" WHERE "originalPracticePatientLinkId"='A-P1'`),
    "Kardiologiepraxis A/Kardiologie");
  check("kein medizinischer Inhalt im Archiv",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext" WHERE
       "practiceDisplayNameSnapshot" ILIKE '%placeholder%' OR "practiceSpecialtySnapshot" ILIKE '%placeholder%'`), "0");

  console.log("\n--- 4. Guard ist frei, Praxis loeschbar ---");
  check("Guard meldet frei",
    (await checkPracticeDeletionBlockers("prA", prisma)).blocked, false);
  await expectThrows("Praxis A jetzt loeschbar",
    () => prisma.practiceProfile.delete({ where: { id: "prA" } }), false);
  check("medizinische Datensaetze ueberleben",
    psql(SANDBOX_DB, `SELECT count(*) FROM "DiagnosisEntry" WHERE id IN ('dia-A','dia-A-del','dia-A2')`), "3");
  check("Archivkontexte ueberleben",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext"`), "2");
  check("Links sind weg",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticePatientLink" WHERE "practiceProfileId"='prA'`), "0");
  check("keine andere Praxis sieht die archivierten Daten",
    psql(SANDBOX_DB, `SELECT count(*) FROM "DiagnosisEntry" d
       WHERE d."archivedPracticeContextId" IS NOT NULL AND d."contextPracticePatientLinkId" IS NOT NULL`), "0");

  console.log("\n--- 5. Idempotenz und Konflikt ---");
  psql(SANDBOX_DB, `
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('B-P2','prB','P2','active',now());
    INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","dataScope","contextPracticePatientLinkId","updatedAt")
      VALUES ('dia-B2','P2','placeholder','practice_contextual','B-P2',now());
  `);
  const twice = async () => prisma.$transaction(async (tx) =>
    archiveContextualPatientDataForLinks({
      transaction: tx, linkIds: ["B-P2"], archiveReason: ARCHIVE_REASONS.PRACTICE_DELETED,
    }));
  const first = await twice();
  const second = await twice();
  check("erster Lauf verschiebt 1", first.movedTotal, 1);
  check("zweiter Lauf verschiebt 0 (idempotent)", second.movedTotal, 0);
  check("weiterhin genau ein Archivkontext fuer diesen Link",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext" WHERE "originalPracticePatientLinkId"='B-P2'`), "1");

  psql(SANDBOX_DB, `
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('C-P2','prC','P2','active',now());
    INSERT INTO "ArchivedPracticePatientContext"
      (id,"patientUserId","originalPracticePatientLinkId","originalPracticeProfileId","archiveReason")
      VALUES ('arc-wrong','P1','C-P2','prC','practice_deleted');
    -- The link needs something to move, or the service skips it before it ever
    -- reaches the conflicting archive.
    INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","dataScope","contextPracticePatientLinkId","updatedAt")
      VALUES ('dia-C2','P2','placeholder','practice_contextual','C-P2',now());
  `);
  await expectThrows("widerspruechlicher Archivkontext bricht ab",
    () => prisma.$transaction(async (tx) => archiveContextualPatientDataForLinks({
      transaction: tx, linkIds: ["C-P2"], archiveReason: ARCHIVE_REASONS.PRACTICE_DELETED,
    })), true);
  // Remove the deliberately wrong row so it cannot poison the later run.
  psql(SANDBOX_DB, `DELETE FROM "ArchivedPracticePatientContext" WHERE id='arc-wrong';`);

  console.log("\n--- 6. Rollback bei Fehler nach halber Verarbeitung ---");
  psql(SANDBOX_DB, `
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('B-P3','prB','P3','active',now());
    INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","dataScope","contextPracticePatientLinkId","updatedAt")
      VALUES ('dia-roll','P3','placeholder','practice_contextual','B-P3',now());
  `);
  await expectThrows("Fehler nach der Archivierung rollt alles zurueck",
    () => prisma.$transaction(async (tx) => {
      await archiveContextualPatientDataForLinks({
        transaction: tx, linkIds: ["B-P3"], archiveReason: ARCHIVE_REASONS.PRACTICE_DELETED,
      });
      throw new Error("deliberate failure after archiving");
    }), true);
  check("Datensatz haengt wieder am Live-Link",
    psql(SANDBOX_DB, `SELECT "contextPracticePatientLinkId" FROM "DiagnosisEntry" WHERE id='dia-roll'`), "B-P3");
  check("kein Archivkontext zurueckgeblieben",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext" WHERE "originalPracticePatientLinkId"='B-P3'`), "0");

  console.log("\n--- 7. Link-Widerruf allein archiviert nichts ---");
  psql(SANDBOX_DB, `UPDATE "PracticePatientLink" SET status='revoked' WHERE id='B-P1';`);
  check("Vitalwert haengt weiter am widerrufenen Link",
    psql(SANDBOX_DB, `SELECT "contextPracticePatientLinkId" FROM "VitalEntry" WHERE id='v-B'`), "B-P1");
  check("kein Archivkontext dafuer",
    psql(SANDBOX_DB, `SELECT count(*) FROM "ArchivedPracticePatientContext" WHERE "originalPracticePatientLinkId"='B-P1'`), "0");

  /* ---------------------------------------------------- grants and tokens */

  console.log("\n--- 8. Grants und Tokens ---");
  psql(SANDBOX_DB, `
    INSERT INTO "PracticeDocument"(id,"practicePatientLinkId","practiceProfileId","patientUserId",type,title,status,"updatedAt")
      VALUES ('docB','B-P1','prB','P1','report','placeholder','shared',now()),
             ('docC','C-P1','prC','P1','report','placeholder','shared',now());
    INSERT INTO "PracticeDocumentFile"(id,"documentId","storageKey","originalFileName","mimeType","sizeBytes")
      VALUES ('fileB','docB','k/b','placeholder.pdf','application/pdf',4);
    INSERT INTO "PracticeDocumentShareGrant"
      (id,"documentId","patientUserId","sourcePracticeProfileId","sourcePracticePatientLinkId",
       "targetPracticeProfileId","targetPracticePatientLinkId",status,"grantedByUserId","grantedAt","updatedAt")
      VALUES ('g-BtoC','docB','P1','prB','B-P1','prC','C-P1','active','P1',now(),now()),
             ('g-CtoB','docC','P1','prC','C-P1','prB','B-P1','active','P1',now(),now());
    INSERT INTO "SecureDocumentAccessToken"(id,"documentId","fileId","tokenHash",audience,"practiceProfileId","practicePatientLinkId","expiresAt")
      VALUES ('tok-C','docB','fileB','hash-c','practice','prC','C-P1',now()+interval '1 hour'),
             ('tok-B','docB','fileB','hash-b','practice','prB','B-P1',now()+interval '1 hour');
  `);
  check("Praxis C mit Grants: DELETE blockiert",
    await (async () => { try { await prisma.practiceProfile.delete({ where: { id: "prC" } }); return "durchgelassen"; } catch { return "blockiert"; } })(),
    "blockiert");

  const grantResult = await prisma.$transaction(async (tx) =>
    releaseDocumentShareGrantsForPractice({ transaction: tx, practiceProfileId: "prC" }));
  check("beide Richtungen erfasst", grantResult.grantsTouched, 2);
  check("als Zielpraxis", grantResult.grantsAsTarget, 1);
  check("als Herkunftspraxis", grantResult.grantsAsSource, 1);
  check("aktive widerrufen", grantResult.grantsRevoked, 2);
  check("Grant-Zeilen entfernt", grantResult.grantsRemoved, 2);
  check("Tokens widerrufen", grantResult.tokensRevoked >= 1, true);
  check("Token der Praxis C ist widerrufen",
    psql(SANDBOX_DB, `SELECT ("revokedAt" IS NOT NULL)::text FROM "SecureDocumentAccessToken" WHERE id='tok-C'`), "true");

  console.log("\n--- 9. Praxis C jetzt loeschbar, fremde Daten unberuehrt ---");
  await prisma.$transaction(async (tx) => {
    const links = await tx.practicePatientLink.findMany({
      where: { practiceProfileId: "prC" }, select: { id: true }, orderBy: { id: "asc" },
    });
    await archiveContextualPatientDataForLinks({
      transaction: tx, linkIds: links.map((l) => l.id),
      archiveReason: ARCHIVE_REASONS.PRACTICE_DELETED, expectedPracticeProfileId: "prC",
    });
  });
  await expectThrows("Praxis C loeschbar",
    () => prisma.practiceProfile.delete({ where: { id: "prC" } }), false);
  check("Dokument der Praxis B unberuehrt",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeDocument" WHERE id='docB'`), "1");
  check("Praxis B existiert weiter",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeProfile" WHERE id='prB'`), "1");
  check("keine Grant-Zeile blockiert noch",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticeDocumentShareGrant"`), "0");

  /* --------------------------------------------------------------- races */

  console.log("\n--- 10. Race, Richtung A: Write haelt FOR SHARE, Archivierung will FOR UPDATE ---");
  psql(SANDBOX_DB, `
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('R1','prB','P1','active',now());
  `);
  const raceA = await twoSessionRace({
    first: `BEGIN; SELECT "id" FROM "PracticePatientLink" WHERE "id"='R1' FOR SHARE;`,
    second: `SET statement_timeout='1500ms'; BEGIN; SELECT "id" FROM "PracticePatientLink" WHERE "id"='R1' FOR UPDATE;`,
  });
  check("FOR UPDATE wartet auf den laufenden Write", raceA.secondBlocked, true);

  console.log("\n--- 11. Race, Richtung B: Archivierung haelt FOR UPDATE, Write will FOR SHARE ---");
  const raceB = await twoSessionRace({
    first: `BEGIN; SELECT "id" FROM "PracticePatientLink" WHERE "id"='R1' FOR UPDATE;`,
    second: `SET statement_timeout='1500ms'; BEGIN; SELECT "id" FROM "PracticePatientLink" WHERE "id"='R1' FOR SHARE;`,
  });
  check("FOR SHARE wartet auf die laufende Archivierung", raceB.secondBlocked, true);

  console.log("\n--- 12. Nach der Loeschung findet ein neuer Write den Link nicht mehr ---");
  await prisma.$transaction(async (tx) => archiveContextualPatientDataForLinks({
    transaction: tx, linkIds: ["R1"], archiveReason: ARCHIVE_REASONS.PRACTICE_DELETED,
  }));
  psql(SANDBOX_DB, `DELETE FROM "PracticePatientLink" WHERE id='R1';`);
  check("Link existiert nicht mehr",
    psql(SANDBOX_DB, `SELECT count(*) FROM "PracticePatientLink" WHERE id='R1'`), "0");
  await expectThrows("kontextbezogener Write gegen den toten Link scheitert",
    () => prisma.diagnosisEntry.create({
      data: { id: "dia-dead", userId: "P1", conditionName: "placeholder",
        dataScope: "practice_contextual", contextPracticePatientLinkId: "R1" },
    }), true);
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

/**
 * Two independent psql sessions. The first holds its lock open; the second gets
 * a short statement_timeout, so "did it block?" becomes an observable outcome
 * rather than a guess. No new dependency — two processes and stdin.
 */
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
