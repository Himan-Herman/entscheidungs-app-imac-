-- Practice members for multi-user clinic dashboard
CREATE TABLE "PracticeMember" (
  "id" TEXT NOT NULL,
  "practiceProfileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PracticeMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeMember_practiceProfileId_userId_key" ON "PracticeMember"("practiceProfileId", "userId");
CREATE INDEX "PracticeMember_userId_idx" ON "PracticeMember"("userId");
CREATE INDEX "PracticeMember_practiceProfileId_role_idx" ON "PracticeMember"("practiceProfileId", "role");

ALTER TABLE "PracticeMember"
  ADD CONSTRAINT "PracticeMember_practiceProfileId_fkey"
  FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeMember"
  ADD CONSTRAINT "PracticeMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Practice-facing linkage and workflow status on pre-visit sessions
ALTER TABLE "PreVisitSession"
  ADD COLUMN "practiceProfileId" TEXT,
  ADD COLUMN "practiceQrTargetId" TEXT,
  ADD COLUMN "practiceStatus" TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN "openedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "lastStatusChangeAt" TIMESTAMP(3);

CREATE INDEX "PreVisitSession_practiceProfileId_idx" ON "PreVisitSession"("practiceProfileId");
CREATE INDEX "PreVisitSession_practiceQrTargetId_idx" ON "PreVisitSession"("practiceQrTargetId");
CREATE INDEX "PreVisitSession_practiceStatus_idx" ON "PreVisitSession"("practiceStatus");

ALTER TABLE "PreVisitSession"
  ADD CONSTRAINT "PreVisitSession_practiceProfileId_fkey"
  FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PreVisitSession"
  ADD CONSTRAINT "PreVisitSession_practiceQrTargetId_fkey"
  FOREIGN KEY ("practiceQrTargetId") REFERENCES "PracticeQrTarget"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
