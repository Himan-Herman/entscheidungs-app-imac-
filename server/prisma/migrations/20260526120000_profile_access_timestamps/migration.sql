-- Profile sharing timestamps on care links (consent scope "profile").

ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "profileAccessGrantedAt" TIMESTAMP(3);
ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "profileAccessRevokedAt" TIMESTAMP(3);
ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "profileAccessGrantedByUserId" TEXT;

ALTER TABLE "PracticePatientLink" ADD CONSTRAINT "PracticePatientLink_profileAccessGrantedByUserId_fkey"
    FOREIGN KEY ("profileAccessGrantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
