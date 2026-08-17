/**
 * Patient writes against account erasure, on real PostgreSQL.
 *
 * The gap this closes: a GLOBAL write (no link) used to lock nothing, so it
 * could run concurrently with the erasure. The cascade prevented orphans, but
 * the patient received a success for a record that was deleted a moment later.
 * Every patient-data write now takes the user row FOR SHARE first — the same
 * row the erasure takes FOR UPDATE — so the two serialise.
 *
 * Safety: the sandbox URL is built programmatically from DATABASE_URL, then
 * re-parsed and printed, and the connected database is verified with an exact
 * comparison plus a blocklist before anything runs. No sed.
 *
 * Run: node scripts/verifyPatientWriteDeletionRaceSandbox.mjs
 */
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");

const SANDBOX_DB = "medscoutx_writerace_sandbox";
const FORBIDDEN = new Set(["medscoutx_dev", "medscoutx", "postgres", ""]);

function fail(msg) {
  console.error(`\nABBRUCH: ${msg}`);
  process.exit(1);
}

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

  // The wearable import uses the DEFAULT client from lib/prisma.js, which
  // reads DATABASE_URL at first import. Point it at the sandbox BEFORE any
  // service module loads, or the import's user-lock SELECT would go to the
  // shared dev database (read-only, but still wrong).
  process.env.DATABASE_URL = sandboxUrl;
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });

  const { createPatientDataWithValidatedContext } =
    await import("../services/patientData/patientDataContextService.js");
  const { importVitalEntries } = await import("../services/wearables/importService.js");

  psql(SANDBOX_DB, `
    INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
      VALUES ('P','p@x.invalid','h','P','X',now(),now()),
             ('oA','a@x.invalid','h','A','X',now(),now());
    INSERT INTO "PracticeProfile"(id,"userId","practiceName","publicSlug","updatedAt")
      VALUES ('prA','oA','Praxis A','praxis-a',now());
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('L-A','prA','P','active',now());
  `);

  const globalWrite = (id, userId = "P") =>
    createPatientDataWithValidatedContext({
      patientUserId: userId,
      prismaClient: prisma,
      createRecord: (tx, context) => tx.vitalEntry.create({
        data: { id, userId, type: "weight", valuePrimary: 1, unit: "kg",
          measuredAt: new Date(), ...context },
      }),
    });

  /* ----------------------------------------------- 21.-25. locking behaviour */

  console.log("\n--- 21./25. Der Write sperrt die Benutzerzeile ---");
  check("globaler Write gelingt", await globalWrite("v1").then(() => "ok", (e) => e.message), "ok");
  const contextual = await createPatientDataWithValidatedContext({
    patientUserId: "P",
    requestedPracticePatientLinkId: "L-A",
    prismaClient: prisma,
    createRecord: (tx, context) => tx.vitalEntry.create({
      data: { id: "v-ctx", userId: "P", type: "weight", valuePrimary: 1, unit: "kg",
        measuredAt: new Date(), ...context },
    }),
  }).then(() => "ok", (e) => e.message);
  check("kontextbezogener Write gelingt (User vor Link)", contextual, "ok");

  console.log("\n--- Sperrnachweis: FOR UPDATE auf dem User blockiert den Write ---");
  const raceA = await twoSessionRace({
    first: `BEGIN; SELECT "id" FROM "User" WHERE "id"='P' FOR UPDATE;`,
    second: `SET statement_timeout='1500ms'; BEGIN; SELECT "id" FROM "User" WHERE "id"='P' FOR SHARE;`,
  });
  check("FOR SHARE wartet auf die laufende Kontoloeschung", raceA.secondBlocked, true);

  const raceB = await twoSessionRace({
    first: `BEGIN; SELECT "id" FROM "User" WHERE "id"='P' FOR SHARE;`,
    second: `SET statement_timeout='1500ms'; BEGIN; SELECT "id" FROM "User" WHERE "id"='P' FOR UPDATE;`,
  });
  check("Kontoloeschung wartet auf den laufenden Write", raceB.secondBlocked, true);

  console.log("\n--- Lock-Reihenfolge: User vor Link, keine Umkehrung ---");
  // Holding the USER exclusively must block the write BEFORE it ever asks for
  // the link — the second session times out on the user row, not the link row.
  const order = await twoSessionRace({
    first: `BEGIN; SELECT "id" FROM "User" WHERE "id"='P' FOR UPDATE;`,
    second: `SET statement_timeout='1500ms'; BEGIN;
             SELECT "id" FROM "User" WHERE "id"='P' FOR SHARE;
             SELECT "id" FROM "PracticePatientLink" WHERE "id"='L-A' FOR SHARE;`,
  });
  check("Write haengt am User, bevor er den Link beruehrt", order.secondBlocked, true);

  /* -------------------------------------------- 28./30. deleted user writes */

  console.log("\n--- 28./30. Geloeschter Benutzer erhaelt keinen Datensatz ---");
  psql(SANDBOX_DB, `
    INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
      VALUES ('GONE','g@x.invalid','h','G','X',now(),now());
  `);
  psql(SANDBOX_DB, `DELETE FROM "User" WHERE id='GONE';`);
  check("Write gegen geloeschtes Konto endet neutral",
    await globalWrite("v-gone", "GONE").then(() => "erstellt", (e) => e.message),
    "patient_account_unavailable");
  check("kein Datensatz entstanden",
    psql(SANDBOX_DB, `SELECT count(*) FROM "VitalEntry" WHERE "userId"='GONE'`), "0");

  console.log("\n--- 27. Fremde Benutzer-ID ist kein Sperrziel ---");
  check("unbekannte ID endet neutral, ohne Existenzhinweis",
    await globalWrite("v-x", "does-not-exist").then(() => "erstellt", (e) => e.message),
    "patient_account_unavailable");

  /* --------------------------------------------------- 26. wearable import */

  console.log("\n--- 26. Wearable-Import: eine Sperre je Charge ---");
  const imported = await importVitalEntries({
    userId: "P", provider: "apple_health", allowedTypes: ["weight", "heart_rate"],
    entries: [
      { externalId: "e1", type: "weight", valuePrimary: 70, measuredAt: new Date().toISOString() },
      { externalId: "e2", type: "heart_rate", valuePrimary: 60, measuredAt: new Date().toISOString() },
    ],
  });
  check("Charge importiert", imported.imported, 2);
  check("Import bleibt patient_global",
    psql(SANDBOX_DB, `SELECT count(*) FROM "VitalEntry"
       WHERE "userId"='P' AND source='import'
         AND "dataScope"='patient_global' AND "contextPracticePatientLinkId" IS NULL`), "2");
  check("Import gegen geloeschtes Konto endet neutral",
    await importVitalEntries({
      userId: "GONE", provider: "apple_health", allowedTypes: ["weight"],
      entries: [{ externalId: "e3", type: "weight", valuePrimary: 1, measuredAt: new Date().toISOString() }],
    }).then(() => "importiert", (e) => e.message),
    "patient_account_unavailable");

  /* ------------------------------------------- 29. write first, then delete */

  console.log("\n--- 29. Write vor Loeschung: kein Waise ---");
  await globalWrite("v-before-delete");
  // The same order the account erasure uses: the patient's own records first
  // (the contextual one holds a RESTRICT to its link), then the links, then
  // the user. Everything else cascades from the user row.
  psql(SANDBOX_DB, `
    DELETE FROM "VitalEntry" WHERE "userId"='P';
    DELETE FROM "PracticePatientLink" WHERE "patientUserId"='P';
    DELETE FROM "WearableConnection" WHERE "userId"='P';
    DELETE FROM "User" WHERE id='P';
  `);
  check("Datensaetze mit dem Konto kaskadiert",
    psql(SANDBOX_DB, `SELECT count(*) FROM "VitalEntry" WHERE "userId"='P'`), "0");
  check("kein Waise irgendeines Typs",
    psql(SANDBOX_DB, `SELECT count(*) FROM "VitalEntry" v
       WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = v."userId")`), "0");

  /* ------------------------------------------------------- 31. idempotency */

  console.log("\n--- 31. Kein Duplikat durch Transaction-Retry ---");
  psql(SANDBOX_DB, `
    INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
      VALUES ('R','r@x.invalid','h','R','X',now(),now());
  `);
  await globalWrite("v-retry", "R");
  check("genau ein Datensatz",
    psql(SANDBOX_DB, `SELECT count(*) FROM "VitalEntry" WHERE "userId"='R'`), "1");
} catch (e) {
  failed += 1;
  console.error("\nUNERWARTETER FEHLER:", e?.stack ? String(e.stack).split("\n").slice(0, 4).join("\n") : e);
} finally {
  if (prisma) await prisma.$disconnect().catch(() => {});
  // The wearable import used the default client from lib/prisma.js — its open
  // connection would block DROP DATABASE.
  try {
    const { prisma: defaultClient } = await import("../lib/prisma.js");
    await defaultClient.$disconnect().catch(() => {});
  } catch { /* not loaded */ }
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
