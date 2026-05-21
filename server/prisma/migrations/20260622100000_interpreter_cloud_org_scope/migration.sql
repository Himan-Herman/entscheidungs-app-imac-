-- Phase 3 — optional org/practice scope on cloud sessions (metadata only, no access grants).

ALTER TABLE "InterpreterCloudSession" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "InterpreterCloudSession" ADD COLUMN IF NOT EXISTS "practiceProfileId" TEXT;

CREATE INDEX IF NOT EXISTS "InterpreterCloudSession_organizationId_idx" ON "InterpreterCloudSession"("organizationId");
CREATE INDEX IF NOT EXISTS "InterpreterCloudSession_practiceProfileId_idx" ON "InterpreterCloudSession"("practiceProfileId");
