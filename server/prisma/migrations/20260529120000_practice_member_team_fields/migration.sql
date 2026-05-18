-- Practice team membership lifecycle (invite / active / revoked).

ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "invitedByUserId" TEXT;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "invitedAt" TIMESTAMP(3);
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PracticeMember" ADD CONSTRAINT "PracticeMember_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "PracticeMember_practiceProfileId_status_idx" ON "PracticeMember"("practiceProfileId", "status");
