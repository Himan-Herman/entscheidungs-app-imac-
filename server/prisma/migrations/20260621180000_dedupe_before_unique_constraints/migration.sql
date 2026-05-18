-- Safe data dedupe before enforcing unique constraints (no accept-data-loss).
-- Keeps one row per duplicate group using operational priority rules.
-- Idempotent: safe to re-run when duplicate groups are already empty.

-- ---------------------------------------------------------------------------
-- AppointmentReminder: one row per reminderKey
-- Keep: sent > pending > processing > failed > cancelled; then newest updatedAt
-- ---------------------------------------------------------------------------
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
)
DELETE FROM "AppointmentReminder" ar
USING ranked r
WHERE ar.id = r.id AND r.rn > 1;

-- ---------------------------------------------------------------------------
-- PatientInboxItem: one row per (patientUserId, dedupeKey) where dedupeKey set
-- Keep: unread > read > archived; then latest activity
-- NULL dedupeKey rows are untouched (multiple allowed)
-- ---------------------------------------------------------------------------
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
)
DELETE FROM "PatientInboxItem" pi
USING ranked r
WHERE pi.id = r.id AND r.rn > 1;

-- Ensure unique indexes exist (may have failed on prior deploy)
CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentReminder_reminderKey_key"
  ON "AppointmentReminder"("reminderKey");

DROP INDEX IF EXISTS "PatientInboxItem_patientUserId_dedupeKey_key";

CREATE UNIQUE INDEX "PatientInboxItem_patientUserId_dedupeKey_key"
  ON "PatientInboxItem"("patientUserId", "dedupeKey");
