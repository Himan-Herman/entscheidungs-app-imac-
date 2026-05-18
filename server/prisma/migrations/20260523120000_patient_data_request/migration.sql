-- PR-9: patient data control requests.

CREATE TABLE "PatientDataRequest" (
    "id" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "practiceProfileId" TEXT,
    "practicePatientLinkId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "handledByUserId" TEXT,

    CONSTRAINT "PatientDataRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientDataRequest_patientUserId_createdAt_idx"
    ON "PatientDataRequest"("patientUserId", "createdAt");

CREATE INDEX "PatientDataRequest_practiceProfileId_status_idx"
    ON "PatientDataRequest"("practiceProfileId", "status");

CREATE INDEX "PatientDataRequest_practicePatientLinkId_idx"
    ON "PatientDataRequest"("practicePatientLinkId");

ALTER TABLE "PatientDataRequest" ADD CONSTRAINT "PatientDataRequest_patientUserId_fkey"
    FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientDataRequest" ADD CONSTRAINT "PatientDataRequest_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientDataRequest" ADD CONSTRAINT "PatientDataRequest_practicePatientLinkId_fkey"
    FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientDataRequest" ADD CONSTRAINT "PatientDataRequest_handledByUserId_fkey"
    FOREIGN KEY ("handledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
