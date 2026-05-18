/**
 * Safe dedupe before unique constraints (AppointmentReminder.reminderKey,
 * PatientInboxItem patientUserId+dedupeKey).
 *
 * Default: --dry-run (no writes)
 * Apply:   node scripts/dedupeDuplicateConstraints.js --execute --confirm
 *
 * Requires DATABASE_URL. Run analyzeDuplicateConstraints.js first.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

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
),
to_remove AS (
  SELECT id FROM ranked WHERE rn > 1
)
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
to_remove AS (
  SELECT id FROM ranked WHERE rn > 1
)
SELECT id FROM to_remove
`;

async function countIds(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.map((r) => r.id);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  if (!dryRun && !confirmed) {
    console.error("Refusing to write without --execute --confirm");
    process.exit(1);
  }

  const reminderIds = await countIds(REMINDER_DELETE_SQL);
  const inboxIds = await countIds(INBOX_DELETE_SQL);

  console.log(`[dedupe] mode=${dryRun ? "DRY-RUN" : "EXECUTE"}`);
  console.log(`[dedupe] AppointmentReminder rows to delete: ${reminderIds.length}`);
  console.log(`[dedupe] PatientInboxItem rows to delete: ${inboxIds.length}`);

  if (dryRun) {
    if (reminderIds.length) {
      console.log("[dedupe] sample reminder ids:", reminderIds.slice(0, 5).join(", "));
    }
    if (inboxIds.length) {
      console.log("[dedupe] sample inbox ids:", inboxIds.slice(0, 5).join(", "));
    }
    console.log("[dedupe] No changes made. Re-run with --execute --confirm to apply.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (reminderIds.length) {
      const r = await tx.appointmentReminder.deleteMany({
        where: { id: { in: reminderIds } },
      });
      console.log(`[dedupe] deleted AppointmentReminder: ${r.count}`);
    }
    if (inboxIds.length) {
      const r = await tx.patientInboxItem.deleteMany({
        where: { id: { in: inboxIds } },
      });
      console.log(`[dedupe] deleted PatientInboxItem: ${r.count}`);
    }
  });

  const rDup = await txCheckReminder();
  const iDup = await txCheckInbox();
  console.log(`[dedupe] post-check reminder duplicate groups: ${rDup}`);
  console.log(`[dedupe] post-check inbox duplicate groups: ${iDup}`);
  console.log("[dedupe] Done. Safe to run: npx prisma migrate deploy OR npx prisma db push");
}

async function txCheckReminder() {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM (
      SELECT "reminderKey" FROM "AppointmentReminder"
      GROUP BY "reminderKey" HAVING COUNT(*) > 1
    ) x
  `;
  return rows[0]?.n ?? 0;
}

async function txCheckInbox() {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM (
      SELECT "patientUserId", "dedupeKey" FROM "PatientInboxItem"
      WHERE "dedupeKey" IS NOT NULL AND TRIM("dedupeKey") != ''
      GROUP BY "patientUserId", "dedupeKey" HAVING COUNT(*) > 1
    ) x
  `;
  return rows[0]?.n ?? 0;
}

main()
  .catch((err) => {
    console.error("[dedupe] failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
