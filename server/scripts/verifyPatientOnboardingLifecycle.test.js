/**
 * The invitation lifecycle against a REAL PostgreSQL database.
 *
 * Some of what this module promises cannot be proved with an in-memory fake,
 * because the promise IS the database:
 *
 *   - "at most one pending invitation per entry" is a partial unique index, and
 *     a fake that never enforces it would pass a broken implementation
 *   - two simultaneous regenerations must not leave two live credentials, which
 *     needs two genuinely concurrent transactions
 *   - a failed create must leave no invitation AND no audit row, which needs a
 *     real rollback
 *
 * SAFETY
 * ------
 * This suite creates and drops a database of its own, named after its own
 * process id. It connects to the `postgres` maintenance database to do so, and
 * it refuses to run at all unless the target host is loopback — so it cannot
 * touch `medscoutx_dev`, a staging database, or anything remote. If any of that
 * is unavailable, every test skips with a reason instead of falling back to a
 * shared database.
 *
 * Run: node --test scripts/verifyPatientOnboardingLifecycle.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

import {
  hashInvitationToken,
  hashManualCode,
} from "../services/patientOnboarding/invitationTokens.js";

const run = promisify(execFile);
const SANDBOX_DB = `medscoutx_onboarding_${process.pid}`;

/**
 * The maintenance connection, derived from DATABASE_URL but pointed at
 * `postgres`. Deliberately NOT the configured database: this suite must never
 * open a session against the development database, let alone write to it.
 *
 * Returns null — which skips the whole suite — unless the host is loopback.
 */
function adminUrl() {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
  url.pathname = "/postgres";
  url.search = "";
  return url.toString();
}

function sandboxUrlFrom(admin) {
  const url = new URL(admin);
  url.pathname = `/${SANDBOX_DB}`;
  return url.toString();
}

async function psql(url, sql) {
  await run("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql]);
}

let admin = adminUrl();
let sandboxUrl = null;
let db = null;
let skip = false;

try {
  if (!admin) {
    skip = "no loopback DATABASE_URL, so no throwaway database can be created";
  } else {
    sandboxUrl = sandboxUrlFrom(admin);
    await psql(admin, `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
    await psql(admin, `CREATE DATABASE "${SANDBOX_DB}"`);
    await run("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: sandboxUrl },
    });
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });
    await db.$queryRaw`SELECT 1`;
  }
} catch (err) {
  skip = `sandbox database unavailable: ${err?.message ?? err}`;
}

test.after(async () => {
  if (db) await db.$disconnect();
  if (!sandboxUrl || !admin) return;
  try {
    await psql(admin, `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
  } catch {
    /* a leftover throwaway database is noise, not a failure */
  }
});

/* ------------------------------------------------------------ the service */

const svc = skip
  ? null
  : await import("../services/patientOnboarding/practicePatientInvitationService.js");
const entrySvc = skip
  ? null
  : await import("../services/patientOnboarding/practicePatientEntryService.js");

/**
 * The services talk to the shared Prisma singleton, so the sandbox client is
 * swapped in for the duration of the suite. Every model the services touch is
 * delegated; nothing is faked.
 */
if (!skip) {
  const { prisma } = await import("../lib/prisma.js");
  for (const key of [
    "practiceProfile", "practicePatientEntry", "practicePatientInvitation",
    "auditLog", "user", "practiceMember",
  ]) {
    prisma[key] = db[key];
  }
  prisma.$transaction = db.$transaction.bind(db);
}

/* ------------------------------------------------------------- fixtures */

let seq = 0;

async function fixture() {
  seq += 1;
  const user = await db.user.create({
    data: {
      email: `owner-${process.pid}-${seq}@test.invalid`,
      passwordHash: "x",
      firstName: "Owner",
      lastName: "Test",
      dateOfBirth: new Date("1970-01-01"),
    },
  });
  const practice = await db.practiceProfile.create({
    data: {
      userId: user.id,
      practiceName: `Praxis ${seq}`,
      publicSlug: `praxis-${process.pid}-${seq}`,
    },
  });
  const { entry } = await entrySvc.createPracticePatientEntry({
    practiceProfileId: practice.id,
    createdByUserId: user.id,
    givenName: "Anna",
    familyName: "Müller",
    dateOfBirth: "1980-05-04",
  });
  return { user, practice, entry };
}

const pendingCount = (entryId) =>
  db.practicePatientInvitation.count({
    where: { practicePatientEntryId: entryId, status: "pending" },
  });

/* ------------------------------------------------------------------ tests */

test("the partial unique index really exists and really bites", { skip }, async () => {
  const { practice, entry } = await fixture();
  await svc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: practice.id,
  });

  // Bypass the service entirely and insert a second pending row by hand. The
  // database, not the application, has to be the one that refuses.
  await assert.rejects(
    () =>
      db.practicePatientInvitation.create({
        data: {
          practicePatientEntryId: entry.id,
          practiceProfileId: practice.id,
          tokenHash: hashInvitationToken("a-second-token"),
          status: "pending",
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      }),
    (err) => String(err.message).includes("one_pending_per_entry") || err.code === "P2002",
    "a second pending invitation was accepted",
  );

  assert.equal(await pendingCount(entry.id), 1);
});

test("regeneration supersedes an EXPIRED-but-pending invitation", { skip }, async () => {
  const { practice, entry } = await fixture();
  const first = await svc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: practice.id,
  });

  // The trap this test exists for: expiry is derived, so the row stays `pending`
  // and keeps occupying the index slot. An implementation that only superseded
  // "still valid" invitations would fail here and only here — on exactly the
  // entries whose invitation has run out, which is when "send again" is needed.
  await db.practicePatientInvitation.update({
    where: { id: first.invitation.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  const stale = await db.practicePatientInvitation.findUnique({ where: { id: first.invitation.id } });
  assert.equal(stale.status, "pending", "the premise changed: expiry is now stored");

  const second = await svc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: practice.id,
  });

  assert.equal(second.supersededCount, 1);
  assert.equal(await pendingCount(entry.id), 1);
  const old = await db.practicePatientInvitation.findUnique({ where: { id: first.invitation.id } });
  assert.equal(old.status, "superseded");
  assert.ok(old.supersededAt);
  assert.notEqual(second.token, first.token);
});

test("parallel regenerations never leave two pending invitations", { skip }, async () => {
  const { practice, entry } = await fixture();
  await svc.createInvitationForEntry({ entryId: entry.id, practiceProfileId: practice.id });

  // Eight simultaneous "send again" clicks — two colleagues on the same record,
  // or one impatient double-click amplified by a retry. Some of these MUST fail;
  // what must never happen is two live credentials for one person.
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      svc.createInvitationForEntry({ entryId: entry.id, practiceProfileId: practice.id })),
  );

  const won = results.filter((r) => r.status === "fulfilled");
  assert.ok(won.length >= 1, "every concurrent regeneration failed");
  assert.equal(await pendingCount(entry.id), 1, "two live invitations for one entry");

  // The losers must fail on the constraint, not silently do something else.
  for (const r of results.filter((x) => x.status === "rejected")) {
    const msg = String(r.reason?.message ?? "");
    assert.ok(
      r.reason?.code === "P2002" || msg.includes("one_pending_per_entry") || msg.includes("Unique"),
      `a regeneration failed for an unexpected reason: ${msg}`,
    );
  }

  // And every token handed out by a winner except the survivor must be dead.
  const rows = await db.practicePatientInvitation.findMany({
    where: { practicePatientEntryId: entry.id },
  });
  assert.equal(rows.filter((r) => r.status === "pending").length, 1);
  assert.ok(rows.filter((r) => r.status === "superseded").length >= 1);
});

test("revoke racing regenerate is fail-closed: never two usable credentials", { skip }, async () => {
  const { practice, entry } = await fixture();
  const first = await svc.createInvitationForEntry({ entryId: entry.id, practiceProfileId: practice.id });

  const [revoked, regenerated] = await Promise.allSettled([
    svc.revokeInvitation({ invitationId: first.invitation.id, practiceProfileId: practice.id }),
    svc.createInvitationForEntry({ entryId: entry.id, practiceProfileId: practice.id }),
  ]);

  // Whichever order the database settles on, the outcome is bounded: at most one
  // pending row, and the first invitation is never still usable while a newer
  // one exists.
  assert.ok(await pendingCount(entry.id) <= 1);
  const firstRow = await db.practicePatientInvitation.findUnique({ where: { id: first.invitation.id } });
  assert.notEqual(firstRow.status, "pending",
    "the invitation survived both a revoke and a replacement");
  assert.ok(revoked.status === "fulfilled" || regenerated.status === "fulfilled");
});

test("nothing readable is stored: only hashes reach the table", { skip }, async () => {
  const { practice, entry } = await fixture();
  const created = await svc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: practice.id,
  });
  const rotated = await svc.rotateManualCode({
    invitationId: created.invitation.id, practiceProfileId: practice.id,
  });

  // Ask the database itself, column by column, rather than trusting the model.
  const [row] = await db.$queryRawUnsafe(
    `SELECT * FROM "PracticePatientInvitation" WHERE id = $1`,
    created.invitation.id,
  );
  const dump = JSON.stringify(row);
  assert.equal(dump.includes(created.token), false, "the link token is stored in plaintext");
  assert.equal(dump.includes(rotated.manualCode), false, "the manual code is stored in plaintext");
  assert.equal(row.tokenHash, hashInvitationToken(created.token));
  assert.equal(row.manualCodeHash, hashManualCode(rotated.manualCode));
  // The prefix is a recognition aid, and only the first 12 characters of 43.
  assert.equal(created.token.startsWith(row.tokenPrefix), true);
  assert.equal(row.tokenPrefix.length, 12);
  // There is deliberately no manual-code prefix: 4 of 12 characters would give
  // away a third of a short credential.
  assert.equal("manualCodePrefix" in row, false);

  const audits = await db.auditLog.findMany({ where: { entityId: created.invitation.id } });
  const auditDump = JSON.stringify(audits);
  for (const secret of [created.token, rotated.manualCode, row.tokenHash, row.manualCodeHash]) {
    assert.equal(auditDump.includes(secret), false, "a credential reached the audit log");
  }
  assert.ok(audits.length >= 2, "the mutations were not audited");
});

test("rotation keeps the same invitation, the same status and the same expiry", { skip }, async () => {
  const { practice, entry } = await fixture();
  const created = await svc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: practice.id,
  });
  const before = await db.practicePatientInvitation.findUnique({ where: { id: created.invitation.id } });

  const one = await svc.rotateManualCode({ invitationId: created.invitation.id, practiceProfileId: practice.id });
  const two = await svc.rotateManualCode({ invitationId: created.invitation.id, practiceProfileId: practice.id });
  assert.notEqual(one.manualCode, two.manualCode);

  const after = await db.practicePatientInvitation.findUnique({ where: { id: created.invitation.id } });
  assert.equal(after.status, "pending");
  assert.equal(after.expiresAt.getTime(), before.expiresAt.getTime(), "rotation moved the 7-day clock");
  assert.equal(after.supersededAt, null);
  assert.equal(await db.practicePatientInvitation.count({
    where: { practicePatientEntryId: entry.id },
  }), 1, "rotation created a second invitation row");

  // The superseded code must no longer resolve to anything.
  const byOldCode = await db.practicePatientInvitation.findUnique({
    where: { manualCodeHash: hashManualCode(one.manualCode) },
  });
  assert.equal(byOldCode, null, "the previous code still resolves");
});

test("the preview reads and never writes, even under repetition", { skip }, async () => {
  const { practice, entry } = await fixture();
  const created = await svc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: practice.id,
  });

  const before = await db.practicePatientInvitation.findUnique({ where: { id: created.invitation.id } });
  const auditsBefore = await db.auditLog.count();

  for (let i = 0; i < 5; i += 1) {
    const preview = await svc.previewInvitationByToken(created.token);
    // Against a real row: the DTO identifies the practice by NAME, never by id,
    // and carries nothing beyond the three frozen fields.
    assert.deepEqual(Object.keys(preview), ["practice"]);
    assert.deepEqual(Object.keys(preview.practice).sort(), ["city", "displayName", "specialty"]);
    assert.equal(preview.practice.displayName, `Praxis ${seq}`);
    for (const secret of [practice.id, entry.id, created.invitation.id]) {
      assert.equal(JSON.stringify(preview).includes(secret), false);
    }
  }

  const after = await db.practicePatientInvitation.findUnique({ where: { id: created.invitation.id } });
  assert.deepEqual(after, before, "a read changed the row");
  assert.equal(await db.auditLog.count(), auditsBefore, "a read wrote an audit row");
});

test("a rejected create leaves no invitation and no audit row behind", { skip }, async () => {
  const { practice } = await fixture();
  const auditsBefore = await db.auditLog.count();

  await assert.rejects(
    () => svc.createInvitationForEntry({
      entryId: "entry-that-does-not-exist", practiceProfileId: practice.id,
    }),
    /entry_not_found/,
  );

  // Scoped to THIS fixture: the sandbox is shared across the suite's tests.
  assert.equal(
    await db.practicePatientInvitation.count({ where: { practiceProfileId: practice.id } }),
    0,
  );
  assert.equal(await db.auditLog.count(), auditsBefore,
    "an audit row survived a rolled-back operation");
});

test("an entry of another practice is invisible even with its exact id", { skip }, async () => {
  const a = await fixture();
  const b = await fixture();

  await assert.rejects(
    () => entrySvc.getPracticePatientEntry(b.entry.id, a.practice.id),
    /entry_not_found/,
  );
  await assert.rejects(
    () => svc.createInvitationForEntry({ entryId: b.entry.id, practiceProfileId: a.practice.id }),
    /entry_not_found/,
  );
  assert.equal(await pendingCount(b.entry.id), 0, "a cross-tenant invitation was issued");
});

test("archiving revokes the live invitation in the same transaction", { skip }, async () => {
  const { practice, entry, user } = await fixture();
  const created = await svc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: practice.id,
  });

  await entrySvc.archivePracticePatientEntry({
    entryId: entry.id, practiceProfileId: practice.id, actorUserId: user.id,
  });

  const row = await db.practicePatientInvitation.findUnique({ where: { id: created.invitation.id } });
  assert.equal(row.status, "revoked");
  assert.equal(await pendingCount(entry.id), 0);

  // The entry itself survives — archiving is not deletion.
  const stillThere = await db.practicePatientEntry.findUnique({ where: { id: entry.id } });
  assert.ok(stillThere);
  assert.equal(stillThere.status, "archived");

  // And the freed index slot means a later invitation is still refused, because
  // the entry is no longer invitable.
  await assert.rejects(
    () => svc.createInvitationForEntry({ entryId: entry.id, practiceProfileId: practice.id }),
    /entry_archived/,
  );
});
