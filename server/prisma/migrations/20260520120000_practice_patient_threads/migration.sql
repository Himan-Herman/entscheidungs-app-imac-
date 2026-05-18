-- PR-5: practice ↔ patient messaging threads (CareRelationship-bound).

CREATE TABLE "PracticePatientThread" (
    "id" TEXT NOT NULL,
    "practicePatientLinkId" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "PracticePatientThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticePatientMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "PracticePatientMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticePatientThread_practicePatientLinkId_status_idx"
    ON "PracticePatientThread"("practicePatientLinkId", "status");

CREATE INDEX "PracticePatientThread_patientUserId_status_idx"
    ON "PracticePatientThread"("patientUserId", "status");

CREATE INDEX "PracticePatientThread_practiceProfileId_updatedAt_idx"
    ON "PracticePatientThread"("practiceProfileId", "updatedAt");

CREATE INDEX "PracticePatientMessage_threadId_createdAt_idx"
    ON "PracticePatientMessage"("threadId", "createdAt");

ALTER TABLE "PracticePatientThread" ADD CONSTRAINT "PracticePatientThread_practicePatientLinkId_fkey"
    FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticePatientThread" ADD CONSTRAINT "PracticePatientThread_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticePatientThread" ADD CONSTRAINT "PracticePatientThread_patientUserId_fkey"
    FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticePatientMessage" ADD CONSTRAINT "PracticePatientMessage_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "PracticePatientThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
