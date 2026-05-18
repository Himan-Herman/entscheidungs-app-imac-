-- AuditLog context fields for compliance queries (metadata only, no clinical content).

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "practiceProfileId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "patientUserId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "practicePatientLinkId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'info';
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'internal';

CREATE INDEX IF NOT EXISTS "AuditLog_practiceProfileId_createdAt_idx" ON "AuditLog"("practiceProfileId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_patientUserId_createdAt_idx" ON "AuditLog"("patientUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_practicePatientLinkId_createdAt_idx" ON "AuditLog"("practicePatientLinkId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_visibility_createdAt_idx" ON "AuditLog"("visibility", "createdAt");
