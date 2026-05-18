-- Idempotent production repair: add columns → backfill → dedupe → unique indexes.
-- Safe when earlier worker migrations (20260621140000 / 20260621170000) were never applied.
-- No accept-data-loss: duplicate rows are merged by priority, not truncated blindly.

-- =============================================================================
-- 1) AppointmentReminder — columns (from 20260621140000)
-- =============================================================================
ALTER TABLE "AppointmentReminder" ADD COLUMN IF NOT EXISTS "reminderKey" TEXT;
ALTER TABLE "AppointmentReminder" ADD COLUMN IF NOT EXISTS "subjectKind" TEXT NOT NULL DEFAULT 'appointment';
ALTER TABLE "AppointmentReminder" ADD COLUMN IF NOT EXISTS "templateKey" TEXT;
ALTER TABLE "AppointmentReminder" ADD COLUMN IF NOT EXISTS "followUpThreadId" TEXT;
ALTER TABLE "AppointmentReminder" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AppointmentReminder" ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "AppointmentReminder" ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3);
ALTER TABLE "AppointmentReminder" ADD COLUMN IF NOT EXISTS "failedReason" TEXT;
ALTER TABLE "AppointmentReminder" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "AppointmentReminder" ADD COLUMN IF NOT EXISTS "processingAt" TIMESTAMP(3);

UPDATE "AppointmentReminder"
SET "reminderKey" = 'legacy:' || "id"
WHERE "reminderKey" IS NULL OR TRIM("reminderKey") = '';

UPDATE "AppointmentReminder"
SET "templateKey" = CASE
  WHEN "type" = 'inbox' THEN 'patient_appointment_24h_inbox'
  WHEN "type" = 'system' THEN 'patient_appointment_24h_system'
  WHEN "type" = 'email' THEN 'patient_appointment_24h_email'
  ELSE 'patient_appointment_24h_inbox'
END
WHERE "templateKey" IS NULL;

-- =============================================================================
-- 2) PatientInboxItem — columns (from 20260621170000)
-- =============================================================================
ALTER TABLE "PatientInboxItem" ADD COLUMN IF NOT EXISTS "sourceRefType" TEXT;
ALTER TABLE "PatientInboxItem" ADD COLUMN IF NOT EXISTS "sourceRefId" TEXT;
ALTER TABLE "PatientInboxItem" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
ALTER TABLE "PatientInboxItem" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

UPDATE "PatientInboxItem"
SET "lastActivityAt" = "createdAt"
WHERE "lastActivityAt" IS NULL;

-- Backfill dedupeKey from sourceRef (may surface duplicates → dedupe below)
UPDATE "PatientInboxItem"
SET "dedupeKey" = CASE
  WHEN "titleKey" IS NOT NULL AND TRIM("titleKey") != '' THEN
    LEFT(CONCAT("type", ':', "sourceRefType", ':', "sourceRefId", ':', "titleKey"), 180)
  ELSE
    LEFT(CONCAT("type", ':', "sourceRefType", ':', "sourceRefId"), 180)
END
WHERE ("dedupeKey" IS NULL OR TRIM("dedupeKey") = '')
  AND "sourceRefType" IS NOT NULL AND TRIM("sourceRefType") != ''
  AND "sourceRefId" IS NOT NULL AND TRIM("sourceRefId") != '';

-- =============================================================================
-- 3) Dedupe AppointmentReminder (one row per reminderKey)
-- =============================================================================
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
)
DELETE FROM "AppointmentReminder" ar
USING ranked r
WHERE ar.id = r.id AND r.rn > 1;

ALTER TABLE "AppointmentReminder" ALTER COLUMN "reminderKey" SET NOT NULL;

-- =============================================================================
-- 4) Dedupe PatientInboxItem (one row per patientUserId + dedupeKey)
-- =============================================================================
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

-- =============================================================================
-- 5) Unique indexes (after dedupe)
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentReminder_reminderKey_key"
  ON "AppointmentReminder"("reminderKey");

DROP INDEX IF EXISTS "PatientInboxItem_patientUserId_dedupeKey_key";

CREATE UNIQUE INDEX "PatientInboxItem_patientUserId_dedupeKey_key"
  ON "PatientInboxItem"("patientUserId", "dedupeKey");

CREATE INDEX IF NOT EXISTS "AppointmentReminder_status_sendAt_nextRetryAt_idx"
  ON "AppointmentReminder"("status", "sendAt", "nextRetryAt");

CREATE INDEX IF NOT EXISTS "PatientInboxItem_patientUserId_sourceRef_idx"
  ON "PatientInboxItem"("patientUserId", "sourceRefType", "sourceRefId");

CREATE INDEX IF NOT EXISTS "PatientInboxItem_patientUserId_lastActivityAt_idx"
  ON "PatientInboxItem"("patientUserId", "lastActivityAt");
