/**
 * eraseBillingPlausibilityData — Phase D4 operator erasure script.
 *
 * Controlled, operator/admin-only tool to identify and (optionally) hard-delete
 * GOÄ/PKV billing plausibility data for a given scope. Intended for manual
 * support, GDPR Art. 17 erasure requests, and closed-pilot cleanup.
 *
 * This is NOT a user-facing endpoint. It is a command-line script that must be
 * run by an operator against a known, safe database.
 *
 * ⚠️  WARNING: With --confirmErase this script PERMANENTLY deletes data.
 *     It defaults to dry-run and refuses to run against any database whose
 *     DATABASE_URL contains production / Render indicators.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   # Dry-run (default — shows what WOULD be deleted, changes nothing):
 *   node scripts/eraseBillingPlausibilityData.js --practiceProfileId=<id>
 *   node scripts/eraseBillingPlausibilityData.js --sessionId=<id> --dryRun
 *   node scripts/eraseBillingPlausibilityData.js --createdByUserId=<id>
 *
 *   # Confirmed erase (PERMANENT — only after reviewing the dry-run output):
 *   node scripts/eraseBillingPlausibilityData.js --practiceProfileId=<id> --confirmErase
 *
 *   # Large batch (> 100 sessions) requires an extra explicit flag:
 *   node scripts/eraseBillingPlausibilityData.js --createdByUserId=<id> --confirmErase --allowLargeBatch
 *
 * ─── Scopes (at least one required) ──────────────────────────────────────────
 *
 *   --sessionId=<id>            single session
 *   --practiceProfileId=<id>    all sessions owned by a practice
 *   --createdByUserId=<id>      all sessions created by a user
 *
 *   Multiple scopes are combined with AND semantics (they NARROW the match —
 *   they can never broaden it). Example: --sessionId + --practiceProfileId matches
 *   that one session only if it also belongs to that practice.
 *
 * ─── Flags ────────────────────────────────────────────────────────────────────
 *
 *   --dryRun           force dry-run (default when --confirmErase is absent)
 *   --confirmErase     perform the deletion (ignored if --dryRun also present)
 *   --allowLargeBatch  permit erasing more than the safety threshold (100 sessions)
 *
 * ─── Deletion strategy ────────────────────────────────────────────────────────
 *
 *   Hard delete of the billing session tree, in dependency order:
 *     1. BillingPlausibilityAuditLog  (by session id)
 *     2. BillingPlausibilityItem      (by session id)
 *     3. BillingPlausibilitySession   (by id)
 *   All inside a single transaction. Audit logs and items DO cascade from the
 *   session (onDelete: Cascade) but are deleted explicitly for defense-in-depth.
 *
 *   Anonymisation mode is intentionally NOT implemented in this first version —
 *   for closed-pilot erasure, hard delete is the simplest defensible choice and
 *   matches the D2 account-deletion behaviour. (See docs for the future option.)
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const SAFE_SESSION_THRESHOLD = 100;

// ─── Production safety guard ──────────────────────────────────────────────────
//
// Mirrors the conservative guard in verifyBillingPlausibilityService.js.
// This script must never run against a production or Render-hosted database.

const DATABASE_URL = process.env.DATABASE_URL || "";

function fatal(msg) {
  console.error(`[erase] FATAL: ${msg}`);
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
console.log("[erase] DATABASE_URL host:", urlHostname);

const detectedIndicator = PRODUCTION_INDICATORS.find(
  (indicator) =>
    DATABASE_URL.toLowerCase().includes(indicator) || urlHostname.includes(indicator),
);

if (detectedIndicator) {
  console.error("[erase] ============================================================");
  console.error("[erase] SAFETY GUARD TRIGGERED — refusing to run.");
  console.error("[erase]");
  console.error("[erase] This script can permanently delete data and must only be run");
  console.error("[erase] against a local/dev or explicitly-approved support database.");
  console.error("[erase]");
  console.error(`[erase] Detected production indicator: "${detectedIndicator}"`);
  console.error("[erase] DATABASE_URL host:", urlHostname);
  console.error("[erase] ============================================================");
  process.exit(1);
}

if (urlHostname !== "localhost" && urlHostname !== "127.0.0.1" && !urlHostname.endsWith(".local")) {
  console.warn("[erase] WARNING: DATABASE_URL host is not localhost:", urlHostname);
  console.warn("[erase] Proceeding — ensure this is a dev/test/approved support database.");
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

const sessionId = getArg("sessionId");
const practiceProfileId = getArg("practiceProfileId");
const createdByUserId = getArg("createdByUserId");

const forceDryRun = hasFlag("dryRun");
const confirmErase = hasFlag("confirmErase");
const allowLargeBatch = hasFlag("allowLargeBatch");

// Dry-run is the default. Erase happens ONLY when --confirmErase is present AND
// --dryRun is NOT present.
const isErase = confirmErase && !forceDryRun;

// At least one scope is mandatory — refuse blanket operations.
const scopes = { sessionId, practiceProfileId, createdByUserId };
const activeScopes = Object.entries(scopes).filter(([, v]) => typeof v === "string" && v.length > 0);

if (activeScopes.length === 0) {
  console.error("[erase] FATAL: no scope provided.");
  console.error("[erase] Provide at least one of --sessionId / --practiceProfileId / --createdByUserId.");
  console.error("[erase] Refusing to operate on the entire billing dataset.");
  process.exit(1);
}

// ─── Build the (AND-combined) where clause ───────────────────────────────────

const where = {};
if (sessionId) where.id = sessionId;
if (practiceProfileId) where.practiceProfileId = practiceProfileId;
if (createdByUserId) where.createdByUserId = createdByUserId;

const prisma = new PrismaClient();

function isoOrNull(d) {
  if (!d) return null;
  return typeof d.toISOString === "function" ? d.toISOString() : String(d);
}

async function main() {
  console.log("[erase] mode:", isErase ? "ERASE (permanent)" : "DRY-RUN (no changes)");
  console.log("[erase] active scopes:", activeScopes.map(([k, v]) => `${k}=${v}`).join(", "));

  const sessions = await prisma.billingPlausibilitySession.findMany({
    where,
    select: { id: true, createdAt: true, practiceProfileId: true, createdByUserId: true },
    orderBy: { createdAt: "asc" },
  });

  const sessionIds = sessions.map((s) => s.id);

  // Count related rows (do NOT read contextText — never print sensitive content).
  const itemCount =
    sessionIds.length > 0
      ? await prisma.billingPlausibilityItem.count({ where: { sessionId: { in: sessionIds } } })
      : 0;
  const auditCount =
    sessionIds.length > 0
      ? await prisma.billingPlausibilityAuditLog.count({ where: { sessionId: { in: sessionIds } } })
      : 0;

  const dateRange =
    sessions.length > 0
      ? {
          earliest: isoOrNull(sessions[0].createdAt),
          latest: isoOrNull(sessions[sessions.length - 1].createdAt),
        }
      : { earliest: null, latest: null };

  console.log("[erase] ── Match summary ───────────────────────────────────────");
  console.log("[erase] matching sessions :", sessions.length);
  console.log("[erase] matching items    :", itemCount);
  console.log("[erase] matching auditlogs:", auditCount);
  console.log("[erase] session date range:", dateRange.earliest, "→", dateRange.latest);
  console.log("[erase] affected session IDs:");
  for (const id of sessionIds) console.log("[erase]   -", id);

  // No matches.
  if (sessions.length === 0) {
    if (isErase) {
      console.error("[erase] No sessions match the given scope — nothing to erase. Exiting.");
      process.exit(1);
    }
    console.log("[erase] DRY-RUN complete — 0 sessions match. Nothing would be deleted.");
    return { deleted: false };
  }

  // Large-batch guard.
  if (isErase && sessions.length > SAFE_SESSION_THRESHOLD && !allowLargeBatch) {
    console.error("[erase] ============================================================");
    console.error(`[erase] REFUSING: ${sessions.length} sessions exceed the safety threshold (${SAFE_SESSION_THRESHOLD}).`);
    console.error("[erase] Re-run with --allowLargeBatch if this large deletion is intended.");
    console.error("[erase] ============================================================");
    process.exit(1);
  }

  if (!isErase) {
    console.log("[erase] ── DRY-RUN — no data was modified ──────────────────────");
    console.log("[erase] Re-run with --confirmErase to permanently delete the above.");
    console.log("[erase] timestamp:", new Date().toISOString());
    return { deleted: false };
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

  console.log("[erase] ── ERASE complete ──────────────────────────────────────");
  console.log("[erase] deleted sessions :", result.sessions);
  console.log("[erase] deleted items    :", result.items);
  console.log("[erase] deleted auditlogs:", result.auditLogs);
  console.log("[erase] executed (not dry-run)");
  console.log("[erase] timestamp:", new Date().toISOString());
  return { deleted: true, ...result };
}

main()
  .catch((err) => {
    console.error("[erase] FATAL during operation:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
