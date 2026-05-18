/**
 * Read-only analysis: duplicates blocking unique constraints.
 * Schema-aware: skips tables/columns not yet migrated.
 * Usage: node scripts/analyzeDuplicateConstraints.js
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  columnExists,
  getSchemaConstraintState,
  logColumnMissing,
} from "./lib/schemaColumns.js";

const prisma = new PrismaClient();

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function reminderDuplicates(hasReminderKey) {
  section("AppointmentReminder.reminderKey");

  if (!hasReminderKey) {
    logColumnMissing("AppointmentReminder", "reminderKey");
    return;
  }

  const groups = await prisma.$queryRaw`
    SELECT "reminderKey", COUNT(*)::int AS cnt
    FROM "AppointmentReminder"
    GROUP BY "reminderKey"
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, "reminderKey"
  `;

  const totalExtra = await prisma.$queryRaw`
    SELECT COALESCE(SUM(cnt - 1), 0)::int AS rows_to_remove
    FROM (
      SELECT COUNT(*)::int AS cnt
      FROM "AppointmentReminder"
      GROUP BY "reminderKey"
      HAVING COUNT(*) > 1
    ) t
  `;

  console.log("Duplicate groups:", groups.length);
  console.log("Rows to remove (if dedupe):", totalExtra[0]?.rows_to_remove ?? 0);

  if (groups.length === 0) {
    console.log("No duplicate reminderKey values.");
    return;
  }

  for (const g of groups.slice(0, 15)) {
    const rows = await prisma.$queryRaw`
      SELECT id, "reminderKey", status, "sendAt", "sentAt", "createdAt", "updatedAt",
             "appointmentId", "followUpThreadId", type, "templateKey"
      FROM "AppointmentReminder"
      WHERE "reminderKey" = ${g.reminderKey}
      ORDER BY
        CASE status
          WHEN 'sent' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'processing' THEN 3
          WHEN 'failed' THEN 4
          WHEN 'cancelled' THEN 5
          ELSE 6
        END,
        "updatedAt" DESC,
        id ASC
    `;
    console.log(`\n  key=${g.reminderKey} count=${g.cnt}`);
    for (const r of rows) {
      const keep = r === rows[0] ? " [KEEP]" : " [remove]";
      console.log(
        `    ${r.id}${keep} status=${r.status} sendAt=${r.sendAt?.toISOString?.() ?? r.sendAt} appt=${r.appointmentId ?? "-"}`,
      );
    }
  }
  if (groups.length > 15) {
    console.log(`  ... and ${groups.length - 15} more groups`);
  }
}

async function inboxDuplicates(hasDedupeKey) {
  section("PatientInboxItem(patientUserId, dedupeKey)");

  if (!hasDedupeKey) {
    logColumnMissing("PatientInboxItem", "dedupeKey");
    return;
  }

  const nullDedupe = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM "PatientInboxItem"
    WHERE "dedupeKey" IS NULL OR TRIM("dedupeKey") = ''
  `;

  const groups = await prisma.$queryRaw`
    SELECT "patientUserId", "dedupeKey", COUNT(*)::int AS cnt
    FROM "PatientInboxItem"
    WHERE "dedupeKey" IS NOT NULL AND TRIM("dedupeKey") != ''
    GROUP BY "patientUserId", "dedupeKey"
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `;

  const totalExtra = await prisma.$queryRaw`
    SELECT COALESCE(SUM(cnt - 1), 0)::int AS rows_to_remove
    FROM (
      SELECT COUNT(*)::int AS cnt
      FROM "PatientInboxItem"
      WHERE "dedupeKey" IS NOT NULL AND TRIM("dedupeKey") != ''
      GROUP BY "patientUserId", "dedupeKey"
      HAVING COUNT(*) > 1
    ) t
  `;

  console.log("Rows with NULL/empty dedupeKey (unique allows many):", nullDedupe[0]?.n ?? 0);
  console.log("Duplicate groups:", groups.length);
  console.log("Rows to remove (if dedupe):", totalExtra[0]?.rows_to_remove ?? 0);

  if (groups.length === 0) {
    console.log("No duplicate (patientUserId, dedupeKey) pairs.");
    return;
  }

  for (const g of groups.slice(0, 15)) {
    const rows = await prisma.$queryRaw`
      SELECT id, status, "createdAt", "readAt", "archivedAt", "lastActivityAt",
             type, "sourceRefType", "sourceRefId", "titleKey", "targetUrl"
      FROM "PatientInboxItem"
      WHERE "patientUserId" = ${g.patientUserId} AND "dedupeKey" = ${g.dedupeKey}
      ORDER BY
        CASE status
          WHEN 'unread' THEN 1
          WHEN 'read' THEN 2
          WHEN 'archived' THEN 3
          ELSE 4
        END,
        COALESCE("lastActivityAt", "createdAt") DESC,
        "createdAt" DESC,
        id ASC
    `;
    console.log(`\n  user=${g.patientUserId} dedupeKey=${g.dedupeKey} count=${g.cnt}`);
    for (const r of rows) {
      const keep = r === rows[0] ? " [KEEP]" : " [remove]";
      console.log(
        `    ${r.id}${keep} status=${r.status} lastActivity=${r.lastActivityAt?.toISOString?.() ?? r.lastActivityAt ?? "-"} ref=${r.sourceRefType}:${r.sourceRefId}`,
      );
    }
  }
  if (groups.length > 15) {
    console.log(`  ... and ${groups.length - 15} more groups`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const state = await getSchemaConstraintState(prisma);

  console.log("[analyze] Connected — read-only duplicate constraint report");
  console.log("[analyze] Schema state:", state);

  if (!state.reminderKey && !state.dedupeKey) {
    console.log(
      "\n[analyze] Neither target column exists yet. Run migrate deploy first; analyze/dedupe scripts are for post-column / pre-unique-check only.",
    );
    return;
  }

  await reminderDuplicates(state.reminderKey);
  await inboxDuplicates(state.dedupeKey);

  if (state.reminderUnique && state.inboxUnique) {
    console.log("\n[analyze] Unique indexes already present — constraints are applied.");
  } else if (state.reminderKey || state.dedupeKey) {
    console.log(
      "\n[analyze] Columns exist; unique indexes may still be missing. Use migrate deploy (includes dedupe migration) or dedupe script if duplicates remain.",
    );
  }

  console.log("\n[analyze] Done.");
}

main()
  .catch((err) => {
    console.error("[analyze] failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
