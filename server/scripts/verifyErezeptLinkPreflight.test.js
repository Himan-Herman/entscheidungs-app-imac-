/**
 * Does the foreign-key preflight actually bite? (Phase 2F.1, reworked in 2G.1)
 *
 * checkErezeptLinkIntegrity.js reports "a foreign key is possible" on an empty
 * table — which is true, and completely uninformative. This suite plants each
 * kind of broken row and requires the script to refuse, so a green preflight
 * before a migration means something.
 *
 * Phase 2F.3B added the foreign key, so those rows can no longer be written on
 * a migrated database. The script nevertheless has to work against databases
 * where the constraint has NOT been deployed yet — production, for one — so
 * this suite builds its OWN throwaway database, drops the constraint THERE, and
 * points the script at it.
 *
 * An earlier version dropped the constraint on the shared development database
 * instead. It passed in isolation and broke other suites at random under the
 * parallel runner: a test that mutates shared schema is not an isolated test.
 *
 * Run: node --test scripts/verifyErezeptLinkPreflight.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

const run = promisify(execFile);
const SUFFIX = "erx-preflight@test.invalid";

/** A database of this suite's own, so nothing it does can reach another test. */
const SANDBOX_DB = `medscoutx_preflight_${process.pid}`;
let sandboxUrl = null;
let sandbox = null;

function adminUrl() {
  return String(process.env.DATABASE_URL || "").replace(/\?.*$/, "");
}

async function psql(url, sql) {
  await run("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql]);
}

async function createSandbox() {
  const admin = adminUrl();
  if (!admin) return null;
  const url = admin.replace(/\/[^/]*$/, `/${SANDBOX_DB}`);
  if (url === admin) return null;

  await psql(admin, `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
  await psql(admin, `CREATE DATABASE "${SANDBOX_DB}"`);
  await run("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
  });
  // The state the script exists for: the foreign key not yet deployed.
  await psql(url, 'ALTER TABLE "ErezeptEntry" DROP CONSTRAINT IF EXISTS "ErezeptEntry_linkId_fkey"');
  return url;
}

let dbAvailable = false;
try {
  sandboxUrl = await createSandbox();
  dbAvailable = Boolean(sandboxUrl);
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable, or no sandbox could be created";

if (dbAvailable) {
  const { PrismaClient } = await import("@prisma/client");
  sandbox = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });
}

test.after(async () => {
  if (sandbox) await sandbox.$disconnect();
  if (!sandboxUrl) return;
  try {
    await psql(adminUrl(), `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
  } catch {
    /* a leftover throwaway database is noise, not a failure */
  }
});

/**
 * Runs the preflight CLI against the sandbox.
 *
 * @returns {Promise<{ code: number, out: string, counts: Record<string, number> }>}
 */
async function preflight() {
  let code = 0;
  let out = "";
  try {
    const { stdout } = await run("node", ["scripts/checkErezeptLinkIntegrity.js"], {
      env: { ...process.env, DATABASE_URL: sandboxUrl },
    });
    out = stdout;
  } catch (err) {
    code = err.code ?? 1;
    out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }

  const num = (letter) => {
    const m = out.match(new RegExp(`^${letter}\\s+.*?:\\s*(\\d+)`, "m"));
    return m ? Number(m[1]) : 0;
  };
  return {
    code,
    out,
    counts: {
      valid: num("A"),
      blank: num("B"),
      orphan: num("C"),
      mismatch: num("D"),
      practiceId: num("E"),
    },
  };
}

/** The contract, checked on every run: the verdict must follow the counts. */
function assertVerdictFollowsCounts({ code, counts, out }) {
  const broken = counts.blank + counts.orphan + counts.mismatch;
  assert.equal(
    code,
    broken > 0 ? 1 : 0,
    `exit code must follow the reported counts (${JSON.stringify(counts)})\n${out}`,
  );
}

async function seed() {
  const mk = (tag) =>
    sandbox.user.create({
      data: {
        email: `${tag}-${Date.now()}-${Math.round(Math.random() * 1e6)}-${SUFFIX}`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });

  const patient = await mk("p");
  const other = await mk("q");
  const owner = await mk("o");

  const practice = await sandbox.practiceProfile.create({
    data: {
      userId: owner.id,
      practiceName: "PraxisPreflight",
      publicSlug: `pf-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    },
  });
  const link = await sandbox.practicePatientLink.create({
    data: {
      practiceProfileId: practice.id,
      patientUserId: patient.id,
      status: "active",
      consentScopes: ["prescriptions_access"],
      consentAcceptedAt: new Date(),
    },
  });

  const entry = (linkId, patientUserId, name) =>
    sandbox.erezeptEntry.create({
      data: {
        patientUserId,
        issuedByUserId: owner.id,
        linkId,
        practiceProfileId: practice.id,
        medicationName: name,
        tokenCode: `ERZ-${name}-${Math.round(Math.random() * 1e6)}`.slice(0, 40),
        status: "issued",
        validUntil: new Date(Date.now() + 28 * 86_400_000),
      },
    });

  return { patient, other, practice, owner, link, entry };
}

async function cleanup() {
  const users = await sandbox.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  // Prescriptions hold their link and practice with RESTRICT, so they go first.
  await sandbox.erezeptEntry.deleteMany({ where: { patientUserId: { in: ids } } });
  await sandbox.user.deleteMany({ where: { id: { in: ids } } });
}

/**
 * Plants a row the foreign key would reject, runs `body`, and always removes it.
 *
 * No DDL: the sandbox already has the constraint dropped. The row is committed
 * because the preflight is a separate process and cannot see an open
 * transaction.
 */
async function withUnconstrainedRow(row, body) {
  const id = `pf-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  try {
    await sandbox.$executeRawUnsafe(
      `INSERT INTO "ErezeptEntry"
         ("id","patientUserId","issuedByUserId","linkId","practiceProfileId",
          "medicationName","tokenCode","status","validUntil","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'issued', NOW() + INTERVAL '28 days', NOW())`,
      id,
      row.patientUserId,
      row.issuedByUserId,
      row.linkId,
      row.practiceProfileId,
      row.name,
      `ERZ-${id}`.slice(0, 40),
    );
    await body();
  } finally {
    await sandbox.$executeRawUnsafe('DELETE FROM "ErezeptEntry" WHERE "id" = $1', id);
  }
}

test("a valid row is counted as valid, and the verdict follows the counts", { skip }, async (t) => {
  const f = await seed();
  t.after(cleanup);

  await f.entry(f.link.id, f.patient.id, "VALID");
  const after = await preflight();

  assert.ok(after.counts.valid >= 1, `the valid row is counted\n${after.out}`);
  assertVerdictFollowsCounts(after);
});

test("an orphaned linkId blocks the migration", { skip }, async (t) => {
  const f = await seed();
  t.after(cleanup);
  await f.entry(f.link.id, f.patient.id, "VALID");

  await withUnconstrainedRow(
    {
      linkId: "does-not-exist",
      patientUserId: f.patient.id,
      issuedByUserId: f.owner.id,
      practiceProfileId: f.practice.id,
      name: "ORPHAN",
    },
    async () => {
      const { code, out, counts } = await preflight();
      assert.equal(code, 1, `the preflight must refuse\n${out}`);
      assert.ok(counts.orphan >= 1, "the orphan is counted");
      assert.match(out, /would FAIL/);
    },
  );
});

test("a blank linkId blocks the migration", { skip }, async (t) => {
  const f = await seed();
  t.after(cleanup);

  await withUnconstrainedRow(
    {
      linkId: "   ",
      patientUserId: f.patient.id,
      issuedByUserId: f.owner.id,
      practiceProfileId: f.practice.id,
      name: "BLANK",
    },
    async () => {
      const { code, counts, out } = await preflight();
      assert.equal(code, 1, out);
      assert.ok(counts.blank >= 1, "the blank id is counted as blank, not as an orphan");
    },
  );
});

test("a practiceProfileId in the link field is reported as such", { skip }, async (t) => {
  const f = await seed();
  t.after(cleanup);

  await withUnconstrainedRow(
    {
      linkId: f.practice.id,
      patientUserId: f.patient.id,
      issuedByUserId: f.owner.id,
      practiceProfileId: f.practice.id,
      name: "PRACTICE_ID",
    },
    async () => {
      const { code, counts, out } = await preflight();
      assert.equal(code, 1, out);
      // Counting it as a plain orphan would hide WHY it is broken.
      assert.ok(
        counts.practiceId >= 1,
        `a practice id in the link field must be named as such, not a nameless orphan\n${out}`,
      );
    },
  );
});

test("a link belonging to another patient is reported, not silently accepted", { skip }, async (t) => {
  const f = await seed();
  t.after(cleanup);

  // Both ids resolve; they simply name different people. No foreign key catches
  // that, which is why the preflight has to.
  await f.entry(f.link.id, f.other.id, "MISMATCH");

  const { code, counts, out } = await preflight();
  assert.equal(code, 1, `a constraint would succeed here, so only this check catches it\n${out}`);
  assert.ok(counts.mismatch >= 1, "the mismatch is counted");
});

test("the preflight prints no prescription content", { skip }, async (t) => {
  const f = await seed();
  t.after(cleanup);

  await withUnconstrainedRow(
    {
      linkId: "does-not-exist",
      patientUserId: f.patient.id,
      issuedByUserId: f.owner.id,
      practiceProfileId: f.practice.id,
      name: "SECRET_DRUG_NAME",
    },
    async () => {
      const { out } = await preflight();
      assert.equal(out.includes("SECRET_DRUG_NAME"), false, "a diagnostic must not copy the data");
    },
  );
});

test("the sandbox really lacks the constraint the shared database has", { skip }, async () => {
  // Without this the suite could be silently testing a constrained database and
  // passing because nothing was ever inserted.
  const rows = await sandbox.$queryRaw`
    SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'ErezeptEntry_linkId_fkey'`;
  assert.equal(rows[0].n, 0, "the sandbox must be in the pre-migration state");
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  assert.equal(await sandbox.user.count({ where: { email: { contains: SUFFIX } } }), 0);
});
