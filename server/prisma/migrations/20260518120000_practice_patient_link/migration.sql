-- Care relationship: practice ↔ patient (foundation for Phase 1 modules).

CREATE TABLE "PracticePatientLink" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "patientProfileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "consentAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticePatientLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticePatientLink_practiceProfileId_patientUserId_patientProfileId_key"
    ON "PracticePatientLink"("practiceProfileId", "patientUserId", "patientProfileId");

CREATE INDEX "PracticePatientLink_practiceProfileId_status_idx"
    ON "PracticePatientLink"("practiceProfileId", "status");

CREATE INDEX "PracticePatientLink_patientUserId_status_idx"
    ON "PracticePatientLink"("patientUserId", "status");

CREATE INDEX "PracticePatientLink_linkedAt_idx" ON "PracticePatientLink"("linkedAt");

ALTER TABLE "PracticePatientLink" ADD CONSTRAINT "PracticePatientLink_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticePatientLink" ADD CONSTRAINT "PracticePatientLink_patientUserId_fkey"
    FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticePatientLink" ADD CONSTRAINT "PracticePatientLink_patientProfileId_fkey"
    FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prevent duplicate active/invited rows when patientProfileId IS NULL (Postgres UNIQUE allows multiple NULLs).
CREATE UNIQUE INDEX "PracticePatientLink_practice_patient_active_no_profile_key"
    ON "PracticePatientLink"("practiceProfileId", "patientUserId")
    WHERE "patientProfileId" IS NULL AND "status" IN ('invited', 'active');
