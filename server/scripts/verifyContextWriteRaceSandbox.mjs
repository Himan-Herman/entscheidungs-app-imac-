/**
 * Real concurrency test for contextual patient-data writes.
 *
 * Two connections race:
 *   A  reads the link (active) and then inserts a practice_contextual record
 *   B  revokes that same link in between
 *
 * Acceptable outcomes: A is rolled back with a serialization conflict, or B
 * waits until A has committed. Unacceptable: a record appears that was written
 * against a revocation which was already effective.
 *
 * Also demonstrates why Serializable alone is not enough here, by running the
 * same race once without the row lock.
 *
 * Concurrency is driven by two independent psql sessions over stdin, so this
 * needs no additional npm dependency. Whether the revoking session blocks is
 * detected with a short statement_timeout rather than a sleep.
 *
 * Safety: the sandbox URL is built programmatically, re-parsed and printed, and
 * current_database() is compared against an exact name with a hard blocklist
 * before anything runs. No sed.
 *
 * Run: node scripts/verifyContextWriteRaceSandbox.mjs
 */
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");

const SANDBOX_DB = "medscoutx_race_sandbox";
const FORBIDDEN = new Set(["medscoutx_dev", "medscoutx", "postgres", ""]);

function fail(msg) {
  console.error(`\nABBRUCH: ${msg}`);
  process.exit(1);
}

/* ------------------------------------------------------------ sandbox URL */

const envLine = readFileSync(join(serverDir, ".env"), "utf8")
  .split("\n").find((l) => l.startsWith("DATABASE_URL"));
if (!envLine) fail("DATABASE_URL not found");
const baseUrl = envLine.slice(envLine.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");

const built = new URL(baseUrl);
built.pathname = `/${SANDBOX_DB}`;
const sandboxUrl = built.toString();

const reparsed = new URL(sandboxUrl);
const targetName = reparsed.pathname.replace(/^\//, "");
console.log("Basis-DB   :", new URL(baseUrl).pathname.replace(/^\//, ""));
console.log("Sandbox-URL:", targetName);
if (targetName !== SANDBOX_DB) fail(`URL zeigt auf "${targetName}"`);
if (FORBIDDEN.has(targetName)) fail(`"${targetName}" steht auf der Sperrliste`);

const psql = (db, sql) =>
  execFileSync("psql", ["-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { encoding: "utf8" }).trim();

psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
psql("postgres", `CREATE DATABASE "${SANDBOX_DB}"`);

const actual = psql(SANDBOX_DB, "SELECT current_database()");
console.log("current_database():", actual);
if (actual !== SANDBOX_DB || FORBIDDEN.has(actual)) fail(`verbunden mit "${actual}"`);

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${ok ? "" : `\n          ${detail}`}`);
};

try {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: sandboxUrl },
    stdio: "pipe",
  });
  console.log("Migrationskette angewendet.\n");

  /** Runs one psql session with the given SQL, returning stdout/stderr. */
  const session = (sql) => {
    try {
      return {
        ok: true,
        out: execFileSync("psql", ["-d", SANDBOX_DB, "-v", "ON_ERROR_STOP=1", "-tA"], {
          input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
        }),
        err: "",
      };
    } catch (e) {
      return { ok: false, out: String(e.stdout || ""), err: String(e.stderr || "").trim() };
    }
  };

  const seed = () => session(`
    DELETE FROM "DiagnosisEntry"; DELETE FROM "PracticePatientLink";
    DELETE FROM "PracticeProfile"; DELETE FROM "User";
    INSERT INTO "User"(id,email,"passwordHash","firstName","lastName","dateOfBirth","updatedAt")
      VALUES ('p','p@x.org','h','P','X',now(),now()),('o','o@x.org','h','O','W',now(),now());
    INSERT INTO "PracticeProfile"(id,"userId","practiceName","publicSlug","updatedAt")
      VALUES ('pr','o','A','a',now());
    INSERT INTO "PracticePatientLink"(id,"practiceProfileId","patientUserId",status,"updatedAt")
      VALUES ('lk','pr','p','active',now());
  `);

  /**
   * Session A holds a serializable transaction open, having read the link
   * (optionally FOR SHARE), and pauses. While it pauses, session B tries to
   * revoke the link with a 1s statement_timeout: a timeout proves B is blocked.
   *
   * @param {boolean} lock
   */
  const race = (lock) => {
    seed();

    // A: open, read the link, then wait long enough for B to try.
    const a = spawn("psql", ["-d", SANDBOX_DB, "-v", "ON_ERROR_STOP=1", "-tA"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let aOut = "";
    let aErr = "";
    a.stdout.on("data", (d) => { aOut += d; });
    a.stderr.on("data", (d) => { aErr += d; });
    a.stdin.write(`BEGIN ISOLATION LEVEL SERIALIZABLE;
      SELECT status FROM "PracticePatientLink"
      WHERE id='lk' AND "patientUserId"='p'${lock ? " FOR SHARE" : ""};
    `);

    // Give A a moment to actually acquire its snapshot/lock.
    execFileSync("sleep", ["0.4"]);

    // B: try to revoke. If A holds a FOR SHARE lock, this must time out.
    const b = session(`SET statement_timeout = '1s';
      UPDATE "PracticePatientLink" SET status='revoked' WHERE id='lk';`);
    const bBlocked = !b.ok && /statement timeout|canceling statement/i.test(b.err);

    // A now inserts and commits.
    a.stdin.write(`INSERT INTO "DiagnosisEntry"(id,"userId","conditionName","dataScope","contextPracticePatientLinkId","updatedAt")
      VALUES ('d1','p','X','practice_contextual','lk',now());
      COMMIT;
    `);
    a.stdin.end();
    execFileSync("sleep", ["0.6"]);
    try { a.kill(); } catch { /* already gone */ }

    const count = Number(session(`SELECT count(*) FROM "DiagnosisEntry";`).out.trim() || "0");
    const status = session(`SELECT status FROM "PracticePatientLink" WHERE id='lk';`).out.trim();
    return { inserted: count > 0, bBlocked, aErr: aErr.trim(), status };
  };

  console.log("--- Ohne Zeilensperre (nur Serializable) ---");
  const without = race(false);
  console.log(`      Widerruf blockierte: ${without.bBlocked} | Datensatz entstanden: ${without.inserted} | Linkstatus: ${without.status}`);
  check(
    "Serializable ALLEIN laesst den Widerruf durch (Beleg fuer die Zeilensperre)",
    without.bBlocked === false,
    JSON.stringify(without),
  );

  console.log("\n--- Mit FOR SHARE (Produktionsverhalten) ---");
  const withLock = race(true);
  console.log(`      Widerruf blockierte: ${withLock.bBlocked} | Datensatz entstanden: ${withLock.inserted} | Linkstatus: ${withLock.status}`);
  check(
    "Widerruf muss warten, bis der Schreibvorgang abgeschlossen ist",
    withLock.bBlocked === true,
    JSON.stringify(withLock),
  );
  check(
    "kein Datensatz entsteht gegen einen bereits wirksamen Widerruf",
    withLock.bBlocked === true || withLock.inserted === false,
    JSON.stringify(withLock),
  );
} finally {
  psql("postgres", `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
  console.log(`\nSandbox ${SANDBOX_DB} geloescht.`);
}

console.log(`\n# pass ${passed}\n# fail ${failed}`);
process.exit(failed === 0 ? 0 : 1);
