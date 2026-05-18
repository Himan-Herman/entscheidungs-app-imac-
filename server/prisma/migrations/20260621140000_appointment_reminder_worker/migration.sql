-- Appointment reminder worker: retry, idempotency, follow-up support

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
WHERE "reminderKey" IS NULL OR "reminderKey" = '';

UPDATE "AppointmentReminder"
SET "templateKey" = CASE
  WHEN "type" = 'inbox' THEN 'patient_appointment_24h_inbox'
  WHEN "type" = 'system' THEN 'patient_appointment_24h_system'
  WHEN "type" = 'email' THEN 'patient_appointment_24h_email'
  ELSE 'patient_appointment_24h_inbox'
END
WHERE "templateKey" IS NULL;

ALTER TABLE "AppointmentReminder" ALTER COLUMN "reminderKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentReminder_reminderKey_key" ON "AppointmentReminder"("reminderKey");

CREATE INDEX IF NOT EXISTS "AppointmentReminder_status_sendAt_nextRetryAt_idx"
  ON "AppointmentReminder"("status", "sendAt", "nextRetryAt");

CREATE INDEX IF NOT EXISTS "AppointmentReminder_followUpThreadId_status_idx"
  ON "AppointmentReminder"("followUpThreadId", "status");

ALTER TABLE "AppointmentReminder" ALTER COLUMN "appointmentId" DROP NOT NULL;

ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_followUpThreadId_fkey"
  FOREIGN KEY ("followUpThreadId") REFERENCES "PreVisitFollowUpThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
