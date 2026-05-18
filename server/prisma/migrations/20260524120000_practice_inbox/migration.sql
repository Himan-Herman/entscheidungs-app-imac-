-- PR: central practice inbox items.

CREATE TABLE "PracticeInboxItem" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "practicePatientLinkId" TEXT,
    "patientUserId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "sourceRefType" TEXT,
    "sourceRefId" TEXT,
    "targetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeInboxItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeInboxItem_practiceProfileId_status_idx"
    ON "PracticeInboxItem"("practiceProfileId", "status");

CREATE INDEX "PracticeInboxItem_practiceProfileId_type_idx"
    ON "PracticeInboxItem"("practiceProfileId", "type");

CREATE INDEX "PracticeInboxItem_practiceProfileId_lastActivityAt_idx"
    ON "PracticeInboxItem"("practiceProfileId", "lastActivityAt");

CREATE INDEX "PracticeInboxItem_practiceProfileId_sourceRefType_sourceRefId_idx"
    ON "PracticeInboxItem"("practiceProfileId", "sourceRefType", "sourceRefId");

ALTER TABLE "PracticeInboxItem" ADD CONSTRAINT "PracticeInboxItem_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeInboxItem" ADD CONSTRAINT "PracticeInboxItem_practicePatientLinkId_fkey"
    FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticeInboxItem" ADD CONSTRAINT "PracticeInboxItem_patientUserId_fkey"
    FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
