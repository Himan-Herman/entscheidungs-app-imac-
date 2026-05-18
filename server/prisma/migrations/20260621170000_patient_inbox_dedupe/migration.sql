-- Patient inbox deduplication (sourceRef + dedupeKey)

ALTER TABLE "PatientInboxItem" ADD COLUMN IF NOT EXISTS "sourceRefType" TEXT;
ALTER TABLE "PatientInboxItem" ADD COLUMN IF NOT EXISTS "sourceRefId" TEXT;
ALTER TABLE "PatientInboxItem" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
ALTER TABLE "PatientInboxItem" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

UPDATE "PatientInboxItem"
SET "lastActivityAt" = "createdAt"
WHERE "lastActivityAt" IS NULL;

CREATE INDEX IF NOT EXISTS "PatientInboxItem_patientUserId_sourceRef_idx"
  ON "PatientInboxItem"("patientUserId", "sourceRefType", "sourceRefId");

CREATE INDEX IF NOT EXISTS "PatientInboxItem_patientUserId_lastActivityAt_idx"
  ON "PatientInboxItem"("patientUserId", "lastActivityAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PatientInboxItem_patientUserId_dedupeKey_key"
  ON "PatientInboxItem"("patientUserId", "dedupeKey")
  WHERE "dedupeKey" IS NOT NULL;
