#!/usr/bin/env node
/**
 * READ-ONLY preflight for the "one communication channel per care relationship"
 * migration (20260817120000_thread_one_channel_per_link).
 *
 * Reports every PracticePatientLink that carries more than one
 * PracticePatientThread, so the unique index cannot fail unexpectedly during a
 * deploy — and so nobody has to guess whether production is affected.
 *
 * This script NEVER writes. It does not merge, delete, archive or modify any
 * thread or message. Consolidating duplicates is a product decision and is
 * deliberately not automated.
 *
 * Usage (point DATABASE_URL at the environment you want to inspect):
 *   node scripts/checkThreadChannelUniqueness.js
 *
 * Exit codes:
 *   0  no duplicates — the migration can be applied
 *   1  duplicates found — do not migrate yet
 *   2  could not check (connection/permission problem)
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [threadCount, linkCount, messageCount] = await Promise.all([
    prisma.practicePatientThread.count(),
    prisma.practicePatientLink.count(),
    prisma.practicePatientMessage.count(),
  ]);

  console.log("Inventory");
  console.log(`  care relationships (links) : ${linkCount}`);
  console.log(`  threads                    : ${threadCount}`);
  console.log(`  messages                   : ${messageCount}`);
  console.log("");

  const duplicates = await prisma.$queryRaw`
    SELECT
      t."practicePatientLinkId"                                       AS "linkId",
      COUNT(*)::int                                                   AS "threads",
      SUM(CASE WHEN t.status = 'open'     THEN 1 ELSE 0 END)::int     AS "open",
      SUM(CASE WHEN t.status = 'closed'   THEN 1 ELSE 0 END)::int     AS "closed",
      SUM(CASE WHEN t.status = 'archived' THEN 1 ELSE 0 END)::int     AS "archived",
      MIN(t."createdAt")                                              AS "oldest",
      MAX(t."updatedAt")                                              AS "newestActivity"
    FROM "PracticePatientThread" t
    GROUP BY t."practicePatientLinkId"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;

  // --- legacy archive state (Phase 2A.2) --------------------------------
  // The old model recorded THAT a conversation was archived, never BY WHOM.
  // The party-scoped migration copies such rows to BOTH parties so nothing
  // reappears in anyone's list; this reports how many rows that affects so the
  // decision is made on facts rather than on an assumption of an empty table.
  const legacy = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE "archivedAt" IS NOT NULL)::int AS "legacyArchived",
      COUNT(*) FILTER (WHERE status = 'archived')::int      AS "statusArchived",
      COUNT(*) FILTER (WHERE status NOT IN ('open','closed','archived'))::int AS "unexpectedStatus"
    FROM "PracticePatientThread"
  `;
  const l = legacy[0] ?? { legacyArchived: 0, statusArchived: 0, unexpectedStatus: 0 };

  console.log("Legacy archive state (Phase 2A.2 migration)");
  console.log(`  threads with a shared archivedAt : ${l.legacyArchived}`);
  console.log(`  threads with status='archived'   : ${l.statusArchived}`);
  console.log(`  threads with an unexpected status: ${l.unexpectedStatus}`);
  if (l.legacyArchived > 0 || l.statusArchived > 0) {
    console.log("  -> these rows will be copied to BOTH parties and their status");
    console.log("     rewritten to closed/open. No conversation changes visibility.");
    console.log("     The original archivedAt is preserved as unattributed evidence.");
  }
  if (l.unexpectedStatus > 0) {
    console.log("  ! An unexpected status value exists. STOP and report before migrating —");
    console.log("    the migration only rewrites 'archived'.");
    return 1;
  }
  console.log("");

  if (duplicates.length === 0) {
    console.log("✓ No care relationship carries more than one thread.");
    console.log("  The migrations can be applied safely.");
    return 0;
  }

  console.log(`✗ ${duplicates.length} care relationship(s) carry more than one thread.`);
  console.log("  DO NOT apply the migration yet — it would be rejected by the database.");
  console.log("");
  console.table(duplicates);

  // Per-thread detail, so the decision can be made on facts rather than counts.
  console.log("");
  console.log("Per-thread detail (no content, metadata only):");
  for (const row of duplicates) {
    const threads = await prisma.practicePatientThread.findMany({
      where: { practicePatientLinkId: row.linkId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        closedAt: true,
        archivedAt: true,
        _count: { select: { messages: true } },
      },
    });
    console.log(`\n  link ${row.linkId}`);
    for (const t of threads) {
      console.log(
        `    ${t.id}  status=${t.status.padEnd(8)} messages=${String(t._count.messages).padStart(4)}` +
          `  created=${t.createdAt.toISOString().slice(0, 10)}` +
          `  lastActivity=${t.updatedAt.toISOString().slice(0, 10)}`,
      );
    }
  }

  console.log("");
  console.log("Options (all require an explicit decision — none is applied here):");
  console.log("  a) keep the thread with the most recent activity as the channel and");
  console.log("     archive the others, preserving every message;");
  console.log("  b) move all messages onto the oldest thread so the history stays");
  console.log("     chronological, then remove the emptied threads;");
  console.log("  c) postpone the unique index and keep the service-level invariant only.");
  console.log("No message may be deleted without that decision.");
  return 1;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error("Could not complete the check:", err?.message ?? err);
    await prisma.$disconnect();
    process.exit(2);
  });
