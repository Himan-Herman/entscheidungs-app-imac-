/**
 * Safe dedupe before unique constraints (schema-aware).
 * Default: --dry-run | Apply: --execute --confirm
 *
 * Requires columns from migrate deploy. If columns missing, exits 0 with instructions.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  columnExists,
  logColumnMissing,
} from "./lib/schemaColumns.js";

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--execute");
const confirmed = args.has("--confirm");

const REMINDER_DELETE_SQL = `
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "reminderKey"
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
        "createdAt" DESC,
        id ASC
    ) AS rn
  FROM "AppointmentReminder"
  WHERE "reminderKey" IS NOT NULL AND TRIM("reminderKey") != ''
),
to_remove AS (SELECT id FROM ranked WHERE rn > 1)
SELECT id FROM to_remove
`;

const INBOX_DELETE_SQL = `
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "patientUserId", "dedupeKey"
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
    ) AS rn
  FROM "PatientInboxItem"
  WHERE "dedupeKey" IS NOT NULL AND TRIM("dedupeKey") != ''
),
to_remove AS (SELECT id FROM ranked WHERE rn > 1)
SELECT id FROM to_remove
`;

async function idsIfColumn(sql, hasColumn, table, column) {
  if (!hasColumn) {
    logColumnMissing(table, column);
    return null;
  }
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.map((r) => r.id);
}

async function countDuplicateGroups(hasReminderKey, hasDedupeKey) {
  let r = 0;
  let i = 0;
  if (hasReminderKey) {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n FROM (
        SELECT "reminderKey" FROM "AppointmentReminder"
        GROUP BY "reminderKey" HAVING COUNT(*) > 1
      ) x
    `;
    r = rows[0]?.n ?? 0;
  }
  if (hasDedupeKey) {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n FROM (
        SELECT "patientUserId", "dedupeKey" FROM "PatientInboxItem"
        WHERE "dedupeKey" IS NOT NULL AND TRIM("dedupeKey") != ''
        GROUP BY "patientUserId", "dedupeKey" HAVING COUNT(*) > 1
      ) x
    `;
    i = rows[0]?.n ?? 0;
  }
  return { r, i };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const hasReminderKey = await columnExists(prisma, "AppointmentReminder", "reminderKey");
  const hasDedupeKey = await columnExists(prisma, "PatientInboxItem", "dedupeKey");

  console.log(`[dedupe] mode=${dryRun ? "DRY-RUN" : "EXECUTE"}`);
  console.log(`[dedupe] schema: reminderKey=${hasReminderKey} dedupeKey=${hasDedupeKey}`);

  if (!hasReminderKey && !hasDedupeKey) {
    console.log(
      "[dedupe] Nothing to do — run `npx prisma migrate deploy` first (adds columns, backfill, dedupe, indexes).",
    );
    return;
  }

  if (!dryRun && !confirmed) {
    console.error("Refusing to write without --execute --confirm");
    process.exit(1);
  }

  const reminderIds = await idsIfColumn(
    REMINDER_DELETE_SQL,
    hasReminderKey,
    "AppointmentReminder",
    "reminderKey",
  );
  const inboxIds = await idsIfColumn(
    INBOX_DELETE_SQL,
    hasDedupeKey,
    "PatientInboxItem",
    "dedupeKey",
  );

  const rCount = reminderIds === null ? 0 : reminderIds.length;
  const iCount = inboxIds === null ? 0 : inboxIds.length;

  console.log(`[dedupe] AppointmentReminder rows to delete: ${rCount}`);
  console.log(`[dedupe] PatientInboxItem rows to delete: ${iCount}`);

  if (dryRun) {
    if (rCount) console.log("[dedupe] sample reminder ids:", reminderIds.slice(0, 5).join(", "));
    if (iCount) console.log("[dedupe] sample inbox ids:", inboxIds.slice(0, 5).join(", "));
    console.log("[dedupe] No changes made.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (reminderIds?.length) {
      const r = await tx.appointmentReminder.deleteMany({ where: { id: { in: reminderIds } } });
      console.log(`[dedupe] deleted AppointmentReminder: ${r.count}`);
    }
    if (inboxIds?.length) {
      const r = await tx.patientInboxItem.deleteMany({ where: { id: { in: inboxIds } } });
      console.log(`[dedupe] deleted PatientInboxItem: ${r.count}`);
    }
  });

  const post = await countDuplicateGroups(hasReminderKey, hasDedupeKey);
  console.log(`[dedupe] post-check reminder duplicate groups: ${post.r}`);
  console.log(`[dedupe] post-check inbox duplicate groups: ${post.i}`);
  console.log("[dedupe] Done.");
}

main()
  .catch((err) => {
    console.error("[dedupe] failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
