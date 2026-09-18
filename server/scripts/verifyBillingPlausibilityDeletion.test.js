/**
 * Billing plausibility data is erased when a practice or its owner is — against
 * a REAL PostgreSQL database.
 *
 * Why this exists next to the source-text checks in verifyBillingPlausibility.js:
 * those checks look for strings in a particular file, and a refactor that moved
 * practice deletion into a shared service silently broke the thing they were
 * guarding while leaving the strings in a place nobody looked. The account route
 * went on resolving "owned practices" after they were already deleted, found
 * none, and every billing session created by another member of the practice
 * survived the owner's erasure. BillingPlausibilitySession.practiceProfileId is a
 * scalar key with no database foreign key, so nothing cascades to catch it.
 *
 * This suite asserts the behaviour instead of the wording: build the data, run
 * the real deletion, count what is left.
 *
 * SAFETY: creates and drops a throwaway database of its own, connects to the
 * `postgres` maintenance database to do so, and refuses to run unless the host
 * is loopback. DATABASE_URL is repointed at the sandbox BEFORE any application
 * module is imported, so even the shared Prisma singleton cannot reach the
 * development database. Without a reachable loopback database every test skips.
 *
 * Run: node --test scripts/verifyBillingPlausibilityDeletion.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

const run = promisify(execFile);
const SANDBOX_DB = `medscoutx_billingdel_sandbox_${process.pid}`;

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

const psql = (url, sql) => run("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql]);

const admin = adminUrl();
let sandboxUrl = null;
let skip = false;
let db = null;

try {
  if (!admin) {
    skip = "no loopback DATABASE_URL, so no throwaway database can be created";
  } else {
    const u = new URL(admin);
    u.pathname = `/${SANDBOX_DB}`;
    sandboxUrl = u.toString();
    await psql(admin, `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
    await psql(admin, `CREATE DATABASE "${SANDBOX_DB}"`);
    await run("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: sandboxUrl },
    });
  }
} catch (err) {
  skip = `sandbox database unavailable: ${err?.message ?? err}`;
}

// Everything below imports application code. It must see the sandbox, never
// the configured database — so the environment is switched first.
if (!skip) {
  process.env.DATABASE_URL = sandboxUrl;
  process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION = "true";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-billing-deletion";
  const { PrismaClient } = await import("@prisma/client");
  db = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });
}

const svc = skip
  ? null
  : await import("../services/dataLifecycle/archivePracticePatientContext.js");

let server = null;
let base = null;
if (!skip) {
  const { default: express } = await import("express");
  const { requireAuth } = await import("../middleware/requireAuth.js");
  const { default: accountRouter } = await import("../routes/account.js");
  const app = express();
  app.use(express.json());
  app.use("/api/account", requireAuth, accountRouter);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

test.after(async () => {
  if (server) server.close();
  const { prisma } = await import("../lib/prisma.js");
  await prisma.$disconnect().catch(() => {});
  if (db) await db.$disconnect();
  if (!sandboxUrl || !admin) return;
  try {
    await psql(admin, `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
  } catch {
    /* a leftover throwaway database is noise, not a failure */
  }
});

/* ------------------------------------------------------------- fixtures */

let seq = 0;

function user(tag) {
  seq += 1;
  return db.user.create({
    data: {
      email: `${tag}-${process.pid}-${seq}@test.invalid`,
      passwordHash: "x",
      firstName: tag,
      lastName: "Test",
      dateOfBirth: new Date("1970-01-01"),
    },
  });
}

function practice(ownerId) {
  seq += 1;
  return db.practiceProfile.create({
    data: { userId: ownerId, practiceName: `Praxis ${seq}`, publicSlug: `bd-${process.pid}-${seq}` },
  });
}

/** A session with one item and one audit row, so all three tables are exercised. */
async function billingSession(practiceProfileId, createdByUserId) {
  const s = await db.billingPlausibilitySession.create({
    data: {
      practiceProfileId,
      createdByUserId,
      inputSummaryJson: { rowCount: 1, ziffern: ["1"] },
      disclaimerVersion: "1.0.0",
    },
  });
  await db.billingPlausibilityItem.create({
    data: { sessionId: s.id, ziffer: "1", factor: "2.3", count: 1 },
  });
  await db.billingPlausibilityAuditLog.create({
    data: { sessionId: s.id, action: "created" },
  });
  return s;
}

async function remaining(sessionIds) {
  return {
    sessions: await db.billingPlausibilitySession.count({ where: { id: { in: sessionIds } } }),
    items: await db.billingPlausibilityItem.count({ where: { sessionId: { in: sessionIds } } }),
    audits: await db.billingPlausibilityAuditLog.count({ where: { sessionId: { in: sessionIds } } }),
  };
}

/* ------------------------------------------------------------------ tests */

test("deleting a practice erases ALL its billing data, whoever created it", { skip }, async () => {
  const owner = await user("owner");
  const staff = await user("staff");
  const p = await practice(owner.id);
  const byOwner = await billingSession(p.id, owner.id);
  // The case that was orphaned: authored by a member, not the owner.
  const byStaff = await billingSession(p.id, staff.id);

  await db.$transaction((tx) => svc.deletePracticeWithArchivedContext({
    transaction: tx,
    practiceProfileId: p.id,
    deletionReason: svc.ARCHIVE_REASONS.PRACTICE_DELETED,
    deletingUserId: owner.id,
  }));

  assert.equal(await db.practiceProfile.count({ where: { id: p.id } }), 0);
  assert.deepEqual(await remaining([byOwner.id, byStaff.id]), { sessions: 0, items: 0, audits: 0 },
    "billing data of a deleted practice survived");
});

test("deleting a practice does not touch another practice's billing data", { skip }, async () => {
  const ownerA = await user("ownerA");
  const ownerB = await user("ownerB");
  const a = await practice(ownerA.id);
  const b = await practice(ownerB.id);
  await billingSession(a.id, ownerA.id);
  const other = await billingSession(b.id, ownerB.id);

  await db.$transaction((tx) => svc.deletePracticeWithArchivedContext({
    transaction: tx,
    practiceProfileId: a.id,
    deletionReason: svc.ARCHIVE_REASONS.PRACTICE_DELETED,
    deletingUserId: ownerA.id,
  }));

  assert.deepEqual(await remaining([other.id]), { sessions: 1, items: 1, audits: 1 },
    "erasing one practice removed another practice's billing data");
});

test("account erasure over HTTP removes owned-practice AND authored billing data, nothing else", { skip }, async () => {
  const owner = await user("owner");
  const staff = await user("staff");
  const stranger = await user("stranger");

  const owned = await practice(owner.id);
  const foreign = await practice(stranger.id); // the owner works here as a member

  const ownedByOwner = await billingSession(owned.id, owner.id);
  const ownedByStaff = await billingSession(owned.id, staff.id);       // was orphaned
  const foreignByOwner = await billingSession(foreign.id, owner.id);   // authored elsewhere
  const foreignByStranger = await billingSession(foreign.id, stranger.id);

  const { default: jwt } = await import("jsonwebtoken");
  const token = jwt.sign({ userId: owner.id }, process.env.JWT_SECRET, { expiresIn: "10m" });
  const res = await fetch(`${base}/api/account/delete`, {
    method: "DELETE",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirmation: "DELETE_MY_MEDSCOUTX_DATA" }),
  });
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 200, `account deletion failed: ${JSON.stringify(body)}`);

  assert.equal(await db.user.count({ where: { id: owner.id } }), 0, "the account survived");
  assert.equal(await db.practiceProfile.count({ where: { id: owned.id } }), 0, "the owned practice survived");

  assert.deepEqual(
    await remaining([ownedByOwner.id, ownedByStaff.id, foreignByOwner.id]),
    { sessions: 0, items: 0, audits: 0 },
    "billing data owned by, or authored by, the erased account survived",
  );

  // Proportionate: the practice the owner merely worked at, and what its own
  // owner created there, are untouched.
  assert.equal(await db.practiceProfile.count({ where: { id: foreign.id } }), 1);
  assert.deepEqual(await remaining([foreignByStranger.id]), { sessions: 1, items: 1, audits: 1 },
    "account erasure removed billing data that belongs to someone else");
});
