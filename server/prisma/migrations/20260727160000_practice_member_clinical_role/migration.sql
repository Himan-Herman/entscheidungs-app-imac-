-- Clinical role held IN ADDITION to the organizational membership role, so a
-- practice owner can also be a treating doctor without the owner membership
-- being downgraded.
--
-- Purely additive: every column is nullable with no default, so existing rows
-- are untouched and existing active members with role='doctor' keep working
-- through the organizational role exactly as before.
ALTER TABLE "PracticeMember" ADD COLUMN "clinicalRole" VARCHAR(40);
ALTER TABLE "PracticeMember" ADD COLUMN "clinicalRoleStatus" VARCHAR(20);
ALTER TABLE "PracticeMember" ADD COLUMN "clinicalRoleRequestedAt" TIMESTAMP(3);
ALTER TABLE "PracticeMember" ADD COLUMN "clinicalRoleApprovedAt" TIMESTAMP(3);
ALTER TABLE "PracticeMember" ADD COLUMN "clinicalRoleApprovedByUserId" TEXT;

ALTER TABLE "PracticeMember"
  ADD CONSTRAINT "PracticeMember_clinicalRoleApprovedByUserId_fkey"
  FOREIGN KEY ("clinicalRoleApprovedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PracticeMember_practiceProfileId_clinicalRole_clinicalRoleStatus_idx"
  ON "PracticeMember"("practiceProfileId", "clinicalRole", "clinicalRoleStatus");
