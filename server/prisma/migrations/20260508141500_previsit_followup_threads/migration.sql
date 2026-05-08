CREATE TABLE "PreVisitFollowUpThread" (
  "id" TEXT NOT NULL,
  "preVisitSessionId" TEXT NOT NULL,
  "practiceProfileId" TEXT,
  "qrTargetId" TEXT,
  "patientUserId" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "title" TEXT,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "followUpAccessToken" TEXT,
  "followUpTokenExpiresAt" TIMESTAMP(3),
  CONSTRAINT "PreVisitFollowUpThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreVisitFollowUpMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "senderType" TEXT NOT NULL,
  "senderUserId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "PreVisitFollowUpMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PreVisitFollowUpThread_followUpAccessToken_key"
ON "PreVisitFollowUpThread"("followUpAccessToken");

CREATE INDEX "PreVisitFollowUpThread_preVisitSessionId_idx"
ON "PreVisitFollowUpThread"("preVisitSessionId");
CREATE INDEX "PreVisitFollowUpThread_practiceProfileId_status_idx"
ON "PreVisitFollowUpThread"("practiceProfileId", "status");
CREATE INDEX "PreVisitFollowUpThread_patientUserId_status_idx"
ON "PreVisitFollowUpThread"("patientUserId", "status");
CREATE INDEX "PreVisitFollowUpThread_updatedAt_idx"
ON "PreVisitFollowUpThread"("updatedAt");

CREATE INDEX "PreVisitFollowUpMessage_threadId_createdAt_idx"
ON "PreVisitFollowUpMessage"("threadId", "createdAt");

ALTER TABLE "PreVisitFollowUpThread"
ADD CONSTRAINT "PreVisitFollowUpThread_preVisitSessionId_fkey"
FOREIGN KEY ("preVisitSessionId") REFERENCES "PreVisitSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreVisitFollowUpThread"
ADD CONSTRAINT "PreVisitFollowUpThread_practiceProfileId_fkey"
FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PreVisitFollowUpThread"
ADD CONSTRAINT "PreVisitFollowUpThread_qrTargetId_fkey"
FOREIGN KEY ("qrTargetId") REFERENCES "PracticeQrTarget"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PreVisitFollowUpThread"
ADD CONSTRAINT "PreVisitFollowUpThread_patientUserId_fkey"
FOREIGN KEY ("patientUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PreVisitFollowUpThread"
ADD CONSTRAINT "PreVisitFollowUpThread_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PreVisitFollowUpMessage"
ADD CONSTRAINT "PreVisitFollowUpMessage_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "PreVisitFollowUpThread"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
