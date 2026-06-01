-- AlterTable: add source audit field to ConsentRecord
ALTER TABLE "public"."ConsentRecord" ADD COLUMN "source" VARCHAR(40);

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
