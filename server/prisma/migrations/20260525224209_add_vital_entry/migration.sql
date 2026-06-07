/*
  Warnings:

  - You are about to drop the column `isFavorite` on the `DoctorContact` table. All the data in the column will be lost.
  - You are about to drop the column `lastUsedAt` on the `DoctorContact` table. All the data in the column will be lost.
  - Made the column `templateKey` on table `AppointmentReminder` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."MedicationPlan" DROP CONSTRAINT "MedicationPlan_deletedByUserId_fkey";

-- DropIndex
-- IF EXISTS: safe on a fresh database where DocumentOcrResult is created in a later migration
-- (20260618120000_document_ocr_lab). On an existing database the index exists and is dropped normally.
DROP INDEX IF EXISTS "public"."DocumentOcrResult_documentId_reviewStatus_idx";

-- AlterTable
ALTER TABLE "public"."AppointmentReminder" ALTER COLUMN "templateKey" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."DoctorContact" DROP COLUMN "isFavorite",
DROP COLUMN "lastUsedAt";

-- AlterTable
ALTER TABLE "public"."PracticeIntegrationSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."PracticeMember" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."PracticeWebhookEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."VaccinationEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vaccineName" VARCHAR(200) NOT NULL,
    "disease" VARCHAR(200) NOT NULL,
    "vaccinationDate" DATE NOT NULL,
    "doseLabel" VARCHAR(80),
    "lotNumber" VARCHAR(80),
    "location" VARCHAR(200),
    "nextDueDate" DATE,
    "notes" TEXT,
    "documentKey" VARCHAR(500),
    "documentName" VARCHAR(200),
    "documentMime" VARCHAR(80),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaccinationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VitalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "valuePrimary" DOUBLE PRECISION NOT NULL,
    "valueSecondary" DOUBLE PRECISION,
    "unit" VARCHAR(20) NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "source" VARCHAR(40) NOT NULL DEFAULT 'manual',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VitalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaccinationEntry_userId_vaccinationDate_idx" ON "public"."VaccinationEntry"("userId", "vaccinationDate");

-- CreateIndex
CREATE INDEX "VaccinationEntry_userId_deletedAt_idx" ON "public"."VaccinationEntry"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "VitalEntry_userId_type_measuredAt_idx" ON "public"."VitalEntry"("userId", "type", "measuredAt");

-- CreateIndex
CREATE INDEX "VitalEntry_userId_deletedAt_idx" ON "public"."VitalEntry"("userId", "deletedAt");

-- CreateIndex
-- Conditional block: on a fresh database DocumentOcrResult does not yet exist at this point
-- (the table is created in 20260618120000_document_ocr_lab, which runs later).
-- On an existing database the DROP above removed the old single-column index, so the
-- IF NOT EXISTS guard prevents a duplicate-index error on any intermediate state.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'DocumentOcrResult'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'DocumentOcrResult'
        AND indexname = 'DocumentOcrResult_documentId_reviewStatus_idx'
    ) THEN
      CREATE INDEX "DocumentOcrResult_documentId_reviewStatus_idx"
        ON "public"."DocumentOcrResult"("documentId", "reviewStatus");
    END IF;
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "public"."ConsentRecord" ADD CONSTRAINT "ConsentRecord_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VaccinationEntry" ADD CONSTRAINT "VaccinationEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VitalEntry" ADD CONSTRAINT "VitalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."ExternalResourceReference_externalSystemType_externalResourceId" RENAME TO "ExternalResourceReference_externalSystemType_externalResour_idx";

-- RenameIndex
ALTER INDEX "public"."ExternalResourceReference_practiceProfileId_localResourceType_l" RENAME TO "ExternalResourceReference_practiceProfileId_localResourceTy_idx";

-- RenameIndex
ALTER INDEX "public"."PatientInboxItem_patientUserId_sourceRef_idx" RENAME TO "PatientInboxItem_patientUserId_sourceRefType_sourceRefId_idx";

-- RenameIndex
ALTER INDEX "public"."PracticeInboxItem_practiceProfileId_sourceRefType_sourceRefId_i" RENAME TO "PracticeInboxItem_practiceProfileId_sourceRefType_sourceRef_idx";

-- RenameIndex
ALTER INDEX "public"."PracticeInterpreterSessionLink_practiceProfileId_consentGranted" RENAME TO "PracticeInterpreterSessionLink_practiceProfileId_consentGra_idx";

-- RenameIndex
ALTER INDEX "public"."PracticeInterpreterSessionLink_practiceProfileId_consentStatus_" RENAME TO "PracticeInterpreterSessionLink_practiceProfileId_consentSta_idx";

-- RenameIndex
ALTER INDEX "public"."PracticeInterpreterSessionLink_practiceProfileId_patientUser_ke" RENAME TO "PracticeInterpreterSessionLink_practiceProfileId_patientUse_key";

-- RenameIndex
ALTER INDEX "public"."PracticePatientLink_practiceProfileId_assignedTeamMemberUserId_" RENAME TO "PracticePatientLink_practiceProfileId_assignedTeamMemberUse_idx";

-- RenameIndex
ALTER INDEX "public"."PracticePatientLink_practiceProfileId_patientUserId_patientProf" RENAME TO "PracticePatientLink_practiceProfileId_patientUserId_patient_key";
