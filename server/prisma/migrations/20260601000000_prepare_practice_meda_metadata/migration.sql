-- AlterTable: add source audit field to ConsentRecord
-- Conditional: ConsentRecord is created in 20260602120000_consent_record (June 2),
-- which runs AFTER this migration on a fresh CI database. Skip silently on fresh DB;
-- the CREATE TABLE in the later migration includes "source" directly for fresh installs.
-- On an existing database the table already exists and the column is added normally.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ConsentRecord'
  ) THEN
    ALTER TABLE "public"."ConsentRecord" ADD COLUMN IF NOT EXISTS "source" VARCHAR(40);
  END IF;
END $$;

-- AlterTable: add extended profile fields to PracticeProfile
ALTER TABLE "public"."PracticeProfile"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "preferredInterpreterLanguages" TEXT,
  ADD COLUMN "street" TEXT;

-- CreateTable: PracticeMedaSession (metadata only, no content)
CREATE TABLE "public"."PracticeMedaSession" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT,
    "patientUserId" TEXT,
    "practicePatientLinkId" TEXT,
    "createdByUserId" TEXT,
    "consentRecordId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "patientLanguage" VARCHAR(12) NOT NULL,
    "practiceLanguage" VARCHAR(12) NOT NULL,
    "durationSeconds" INTEGER,
    "storageMode" VARCHAR(20) NOT NULL DEFAULT 'none',
    "status" VARCHAR(20) NOT NULL DEFAULT 'started',
    "pdfDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeMedaSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeMedaSession_practiceProfileId_status_idx" ON "public"."PracticeMedaSession"("practiceProfileId", "status");

-- CreateIndex
CREATE INDEX "PracticeMedaSession_practiceProfileId_startedAt_idx" ON "public"."PracticeMedaSession"("practiceProfileId", "startedAt");

-- CreateIndex
CREATE INDEX "PracticeMedaSession_patientUserId_idx" ON "public"."PracticeMedaSession"("patientUserId");

-- CreateIndex
CREATE INDEX "PracticeMedaSession_practicePatientLinkId_idx" ON "public"."PracticeMedaSession"("practicePatientLinkId");

-- CreateIndex
CREATE INDEX "PracticeMedaSession_deletedAt_idx" ON "public"."PracticeMedaSession"("deletedAt");

-- AddForeignKey
ALTER TABLE "public"."PracticeMedaSession"
  ADD CONSTRAINT "PracticeMedaSession_practiceProfileId_fkey"
  FOREIGN KEY ("practiceProfileId") REFERENCES "public"."PracticeProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PracticeMedaSession"
  ADD CONSTRAINT "PracticeMedaSession_practicePatientLinkId_fkey"
  FOREIGN KEY ("practicePatientLinkId") REFERENCES "public"."PracticePatientLink"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
