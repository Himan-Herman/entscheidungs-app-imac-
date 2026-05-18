-- PR-4: neutral patient inbox for practice notifications (no clinical payloads).

CREATE TABLE "PatientInboxItem" (
    "id" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "practiceProfileId" TEXT,
    "practicePatientLinkId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "sourceLabel" TEXT,
    "targetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PatientInboxItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientInboxItem_patientUserId_status_idx"
    ON "PatientInboxItem"("patientUserId", "status");

CREATE INDEX "PatientInboxItem_patientUserId_createdAt_idx"
    ON "PatientInboxItem"("patientUserId", "createdAt");

CREATE INDEX "PatientInboxItem_practiceProfileId_idx"
    ON "PatientInboxItem"("practiceProfileId");

ALTER TABLE "PatientInboxItem" ADD CONSTRAINT "PatientInboxItem_patientUserId_fkey"
    FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientInboxItem" ADD CONSTRAINT "PatientInboxItem_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientInboxItem" ADD CONSTRAINT "PatientInboxItem_practicePatientLinkId_fkey"
    FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
