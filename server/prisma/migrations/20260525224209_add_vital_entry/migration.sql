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
-- Conditional: AppointmentReminder is created in 20260616120000_practice_calendar_appointments
-- (June 16), which runs AFTER this migration on a fresh CI database. Skip silently on fresh DB.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AppointmentReminder'
  ) THEN
    ALTER TABLE "public"."AppointmentReminder" ALTER COLUMN "templateKey" SET NOT NULL;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "public"."DoctorContact" DROP COLUMN "isFavorite",
DROP COLUMN "lastUsedAt";

-- AlterTable
ALTER TABLE "public"."PracticeIntegrationSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
-- Conditional: PracticeMember.updatedAt is added in 20260529120000_practice_member_team_fields
-- (May 29), which runs AFTER this migration on a fresh CI database. Skip silently on fresh DB;
-- the column-existence check implies table existence.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PracticeMember'
      AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "public"."PracticeMember" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

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
-- Conditional: ConsentRecord is created in 20260602120000_consent_record (June 2), which runs
-- AFTER this migration on a fresh CI database. Skip silently; the FK is re-added by that migration.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ConsentRecord'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'ConsentRecord'
        AND constraint_name = 'ConsentRecord_patientUserId_fkey'
    ) THEN
      ALTER TABLE "public"."ConsentRecord" ADD CONSTRAINT "ConsentRecord_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "public"."VaccinationEntry" ADD CONSTRAINT "VaccinationEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VitalEntry" ADD CONSTRAINT "VitalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
-- Conditional: ExternalResourceReference is created in 20260615120000_pvs_fhir_hl7_integrations
-- (June 15) with the new short name already. On fresh DB this source index never existed; skip.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ExternalResourceReference_externalSystemType_externalResourceId'
  ) THEN
    ALTER INDEX "public"."ExternalResourceReference_externalSystemType_externalResourceId" RENAME TO "ExternalResourceReference_externalSystemType_externalResour_idx";
  END IF;
END $$;

-- RenameIndex
-- Conditional: same table; on fresh DB the source index never existed.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ExternalResourceReference_practiceProfileId_localResourceType_l'
  ) THEN
    ALTER INDEX "public"."ExternalResourceReference_practiceProfileId_localResourceType_l" RENAME TO "ExternalResourceReference_practiceProfileId_localResourceTy_idx";
  END IF;
END $$;

-- RenameIndex
-- Conditional: PatientInboxItem_patientUserId_sourceRef_idx is first created in
-- 20260621170000_patient_inbox_dedupe (June 21). On fresh DB this source index doesn't exist yet.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'PatientInboxItem_patientUserId_sourceRef_idx'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'PatientInboxItem_patientUserId_sourceRefType_sourceRefId_idx'
    ) THEN
      ALTER INDEX "public"."PatientInboxItem_patientUserId_sourceRef_idx" RENAME TO "PatientInboxItem_patientUserId_sourceRefType_sourceRefId_idx";
    END IF;
  END IF;
END $$;

-- RenameIndex
-- Safe: PracticeInboxItem_practiceProfileId_sourceRefType_sourceRefId_idx (65 chars, stored as
-- 63-char truncated name _i) was created in 20260524120000_practice_inbox (May 24). Exists on fresh DB.
ALTER INDEX "public"."PracticeInboxItem_practiceProfileId_sourceRefType_sourceRefId_i" RENAME TO "PracticeInboxItem_practiceProfileId_sourceRefType_sourceRef_idx";

-- RenameIndex
-- Safe: created in 20260520180000_interpreter_practice_sharing (May 20). Exists on fresh DB.
ALTER INDEX "public"."PracticeInterpreterSessionLink_practiceProfileId_consentGranted" RENAME TO "PracticeInterpreterSessionLink_practiceProfileId_consentGra_idx";

-- RenameIndex
-- Safe: created in 20260520180000_interpreter_practice_sharing (May 20). Exists on fresh DB.
ALTER INDEX "public"."PracticeInterpreterSessionLink_practiceProfileId_consentStatus_" RENAME TO "PracticeInterpreterSessionLink_practiceProfileId_consentSta_idx";

-- RenameIndex
-- Safe: created in 20260520180000_interpreter_practice_sharing (May 20). Exists on fresh DB.
ALTER INDEX "public"."PracticeInterpreterSessionLink_practiceProfileId_patientUser_ke" RENAME TO "PracticeInterpreterSessionLink_practiceProfileId_patientUse_key";

-- RenameIndex
-- Conditional: assignedTeamMemberUserId column (and its index) is added in
-- 20260620120000_practice_organization_account (June 20). On fresh DB this source index never existed.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'PracticePatientLink_practiceProfileId_assignedTeamMemberUserId_'
  ) THEN
    ALTER INDEX "public"."PracticePatientLink_practiceProfileId_assignedTeamMemberUserId_" RENAME TO "PracticePatientLink_practiceProfileId_assignedTeamMemberUse_idx";
  END IF;
END $$;

-- RenameIndex
-- Safe: created in 20260518120000_practice_patient_link (May 18) as the 72-char name, stored by
-- PostgreSQL as the 63-char truncated form. Exists on fresh DB.
ALTER INDEX "public"."PracticePatientLink_practiceProfileId_patientUserId_patientProf" RENAME TO "PracticePatientLink_practiceProfileId_patientUserId_patient_key";
