/**
 * purgeBillingPlausibilitySessions — Phase D5 retention purge (manual).
 *
 * Operator/admin-only tool to purge OLD billing plausibility sessions for data
 * retention. This is the manual, dry-run-by-default first implementation of D5.
 *
 * ⚠️  There is NO automatic cron/scheduler. Purge only happens when an operator
 *     runs this script with --confirmPurge against an approved database. A future
 *     scheduled job (Render cron) may be added ONLY after legal approves the
 *     retention period.
 *
 * ⚠️  With --confirmPurge this script PERMANENTLY deletes data. It defaults to
 *     dry-run and refuses to run against any production / Render database.
 *
 * ─── Retention model ──────────────────────────────────────────────────────────
 *
 *   Sessions are matched by `createdAt < (now - days)`. `createdAt` is immutable
 *   and always present, so it is the safest retention anchor (unlike `updatedAt`,
 *   which drifts, or `dismissedAt`, which is null for active sessions).
 *
 *   Recommended retention period: BILLING_SESSION_RETENTION_DAYS=180 (policy
 *   guidance only — this script requires an explicit --days=N and never reads
 *   the env var, to avoid silent behaviour).
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   # Dry-run — all sessions older than 180 days (default, changes nothing):
 *   node scripts/purgeBillingPlausibilitySessions.js --days=180 --dryRun
 *
 *   # Dry-run — only dismissed sessions older than 180 days:
 *   node scripts/purgeBillingPlausibilitySessions.js --days=180 --onlyDismissed --dryRun
 *
 *   # Dry-run — scoped to one practice:
 *   node scripts/purgeBillingPlausibilitySessions.js --days=180 --practiceProfileId=<id> --dryRun
 *
 *   # Confirmed purge (PERMANENT — only after reviewing the dry-run output):
 *   node scripts/purgeBillingPlausibilitySessions.js --days=180 --onlyDismissed --confirmPurge
 *
 * ─── CLI options ──────────────────────────────────────────────────────────────
 *
 *   --days=N                  REQUIRED. Retention period in days; sessions with
 *                             createdAt older than N days are matched. Must be > 0.
 *   --dryRun                  force dry-run (default when --confirmPurge is absent)
 *   --confirmPurge            perform the deletion (ignored if --dryRun present)
 *   --onlyDismissed           additionally require status = "dismissed"
 *   --practiceProfileId=<id>  restrict to a single practice
 *   --allowLargeBatch         permit purging more than the safety threshold (500)
 *
 * ─── Deletion strategy ────────────────────────────────────────────────────────
 *
 *   Hard delete of the matched session tree, in dependency order, in one
 *   transaction:
 *     1. BillingPlausibilityAuditLog  (by session id)
 *     2. BillingPlausibilityItem      (by session id)
 *     3. BillingPlausibilitySession   (by id)
 *
 *   contextText and other free-text fields are NEVER printed.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const SAFE_SESSION_THRESHOLD = 500;
const MAX_PRINTED_IDS = 20;

// ─── Production safety guard ──────────────────────────────────────────────────
//
// Mirrors the conservative guard in eraseBillingPlausibilityData.js /
// verifyBillingPlausibilityService.js. Never run against production / Render.

const DATABASE_URL = process.env.DATABASE_URL || "";

function fatal(msg) {
  console.error(`[purge] FATAL: ${msg}`);
  process.exit(1);
}

if (!DATABASE_URL) {
  fatal("DATABASE_URL is not set. Load a local .env or set DATABASE_URL before running.");
}

const PRODUCTION_INDICATORS = [
  "render.com",
  "dpg-",
  "-prod",
  "production",
  "prod.",
  ".prod",
  "postgres.render",
  "oregon-postgres",
  "frankfurt-postgres",
  "singapore-postgres",
];

let urlHostname = "";
try {
  urlHostname = new URL(DATABASE_URL).hostname.toLowerCase();
} catch {
  fatal("DATABASE_URL is not a valid URL — cannot verify safety.");
}

// Always print the DB host before doing anything else.
console.log("[purge] DATABASE_URL host:", urlHostname);

const detectedIndicator = PRODUCTION_INDICATORS.find(
  (indicator) =>
    DATABASE_URL.toLowerCase().includes(indicator) || urlHostname.includes(indicator),
);

if (detectedIndicator) {
  console.error("[purge] ============================================================");
  console.error("[purge] SAFETY GUARD TRIGGERED — refusing to run.");
  console.error("[purge]");
  console.error("[purge] This script can permanently delete data and must only be run");
  console.error("[purge] against a local/dev or explicitly-approved support database.");
  console.error("[purge]");
  console.error(`[purge] Detected production indicator: "${detectedIndicator}"`);
  console.error("[purge] DATABASE_URL host:", urlHostname);
  console.error("[purge] ============================================================");
  process.exit(1);
}

if (urlHostname !== "localhost" && urlHostname !== "127.0.0.1" && !urlHostname.endsWith(".local")) {
  console.warn("[purge] WARNING: DATABASE_URL host is not localhost:", urlHostname);
  console.warn("[purge] Proceeding — ensure this is a dev/test/approved support database.");
}

// ─── Argument parsing ─────────────────────────────────────────────────────────

function getArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : null;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const daysRaw = getArg("days");
const practiceProfileId = getArg("practiceProfileId");

const forceDryRun = hasFlag("dryRun");
const confirmPurge = hasFlag("confirmPurge");
const onlyDismissed = hasFlag("onlyDismissed");
const allowLargeBatch = hasFlag("allowLargeBatch");

// Purge happens ONLY when --confirmPurge is present AND --dryRun is NOT present.
const isPurge = confirmPurge && !forceDryRun;

// --days is mandatory and must be a positive integer.
if (daysRaw === null) {
  fatal("--days=N is required (retention period in days). Refusing to run without it.");
}
const days = Number(daysRaw);
if (!Number.isFinite(days) || !Number.isInteger(days) || days <= 0) {
  fatal(`--days must be a positive integer; got "${daysRaw}".`);
}

const prisma = new PrismaClient();

function isoOrNull(d) {
  if (!d) return null;
  return typeof d.toISOString === "function" ? d.toISOString() : String(d);
}

async function main() {
  // Compute the cutoff from the DB clock would be ideal; we use process time
  // (Date is allowed in a normal script context). Sessions older than cutoff match.
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const where = { createdAt: { lt: cutoff } };
  if (onlyDismissed) where.status = "dismissed";
  if (practiceProfileId) where.practiceProfileId = practiceProfileId;

  console.log("[purge] mode:", isPurge ? "PURGE (permanent)" : "DRY-RUN (no changes)");
  console.log("[purge] retention days:", days);
  console.log("[purge] cutoff (createdAt <):", cutoff.toISOString());
  console.log("[purge] onlyDismissed:", onlyDismissed);
  console.log("[purge] practiceProfileId:", practiceProfileId || "(all practices)");

  const sessions = await prisma.billingPlausibilitySession.findMany({
    where,
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const sessionIds = sessions.map((s) => s.id);

  // Count related rows — never read contextText or other free text.
  const itemCount =
    sessionIds.length > 0
      ? await prisma.billingPlausibilityItem.count({ where: { sessionId: { in: sessionIds } } })
      : 0;
  const auditCount =
    sessionIds.length > 0
      ? await prisma.billingPlausibilityAuditLog.count({ where: { sessionId: { in: sessionIds } } })
      : 0;

  const oldest = sessions.length > 0 ? isoOrNull(sessions[0].createdAt) : null;
  const newest = sessions.length > 0 ? isoOrNull(sessions[sessions.length - 1].createdAt) : null;

  console.log("[purge] ── Match summary ───────────────────────────────────────");
  console.log("[purge] matching sessions :", sessions.length);
  console.log("[purge] matching items    :", itemCount);
  console.log("[purge] matching auditlogs:", auditCount);
  console.log("[purge] oldest match      :", oldest);
  console.log("[purge] newest match      :", newest);
  console.log(`[purge] affected session IDs (first ${MAX_PRINTED_IDS}):`);
  for (const id of sessionIds.slice(0, MAX_PRINTED_IDS)) console.log("[purge]   -", id);
  if (sessionIds.length > MAX_PRINTED_IDS) {
    console.log(`[purge]   … and ${sessionIds.length - MAX_PRINTED_IDS} more`);
  }

  // No matches.
  if (sessions.length === 0) {
    console.log("[purge] No sessions match the retention filter — nothing to purge. Exiting.");
    return { purged: false };
  }

  // Large-batch guard.
  if (isPurge && sessions.length > SAFE_SESSION_THRESHOLD && !allowLargeBatch) {
    console.error("[purge] ============================================================");
    console.error(`[purge] REFUSING: ${sessions.length} sessions exceed the safety threshold (${SAFE_SESSION_THRESHOLD}).`);
    console.error("[purge] Re-run with --allowLargeBatch if this large purge is intended.");
    console.error("[purge] ============================================================");
    process.exit(1);
  }

  if (!isPurge) {
    console.log("[purge] ── DRY-RUN — no data was modified ──────────────────────");
    console.log("[purge] Re-run with --confirmPurge to permanently delete the above.");
    console.log("[purge] timestamp:", new Date().toISOString());
    return { purged: false };
  }

  // ── Perform the hard delete, in dependency order, atomically ────────────────
  const result = await prisma.$transaction(async (tx) => {
    const deletedAuditLogs = await tx.billingPlausibilityAuditLog.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    const deletedItems = await tx.billingPlausibilityItem.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    const deletedSessions = await tx.billingPlausibilitySession.deleteMany({
      where: { id: { in: sessionIds } },
    });
    return {
      auditLogs: deletedAuditLogs.count,
      items: deletedItems.count,
      sessions: deletedSessions.count,
    };
  });

  console.log("[purge] ── PURGE complete ──────────────────────────────────────");
  console.log("[purge] deleted sessions :", result.sessions);
  console.log("[purge] deleted items    :", result.items);
  console.log("[purge] deleted auditlogs:", result.auditLogs);
  console.log("[purge] executed (not dry-run)");
  console.log("[purge] timestamp:", new Date().toISOString());
  return { purged: true, ...result };
}

main()
  .catch((err) => {
    console.error("[purge] FATAL during operation:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
