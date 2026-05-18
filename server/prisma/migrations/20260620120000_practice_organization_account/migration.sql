-- Practice organization account: extended profile, team profiles, patient assignment

ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "organizationType" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "specialtiesJson" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "stateRegion" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "acceptsPublicInsurance" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "acceptsPrivateInsurance" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "acceptsSelfPay" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "emergencyCareAvailable" BOOLEAN;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "onlineAppointmentsAvailable" BOOLEAN;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "videoConsultationAvailable" BOOLEAN;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "accessibilityJson" TEXT;

ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "positionTitle" TEXT;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "specialty" TEXT;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "languagesJson" TEXT;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "visibleToPatients" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "acceptsPatientRequests" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "doctorTitle" TEXT;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "focusArea" TEXT;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "officeHours" TEXT;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "internalContact" TEXT;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "onlineAppointmentsAvailable" BOOLEAN;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "videoConsultationAvailable" BOOLEAN;
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "assignmentStatus" TEXT NOT NULL DEFAULT 'unassigned';
ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "assignedDoctorUserId" TEXT;
ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "assignedTeamMemberUserId" TEXT;
ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "assignedByUserId" TEXT;
ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "assignmentNote" TEXT;
ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "lastForwardedAt" TIMESTAMP(3);
ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "patientSelectedDoctorUserId" TEXT;

ALTER TABLE "PracticePatientLink" ADD CONSTRAINT "PracticePatientLink_assignedDoctorUserId_fkey"
  FOREIGN KEY ("assignedDoctorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticePatientLink" ADD CONSTRAINT "PracticePatientLink_assignedTeamMemberUserId_fkey"
  FOREIGN KEY ("assignedTeamMemberUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticePatientLink" ADD CONSTRAINT "PracticePatientLink_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticePatientLink" ADD CONSTRAINT "PracticePatientLink_patientSelectedDoctorUserId_fkey"
  FOREIGN KEY ("patientSelectedDoctorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "PracticePatientLink_practiceProfileId_assignmentStatus_idx"
  ON "PracticePatientLink"("practiceProfileId", "assignmentStatus");
CREATE INDEX IF NOT EXISTS "PracticePatientLink_practiceProfileId_assignedDoctorUserId_idx"
  ON "PracticePatientLink"("practiceProfileId", "assignedDoctorUserId");
CREATE INDEX IF NOT EXISTS "PracticePatientLink_practiceProfileId_assignedTeamMemberUserId_idx"
  ON "PracticePatientLink"("practiceProfileId", "assignedTeamMemberUserId");

CREATE TABLE IF NOT EXISTS "PracticePatientAssignment" (
  "id" TEXT NOT NULL,
  "practicePatientLinkId" TEXT NOT NULL,
  "assignedToUserId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "assignmentType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "PracticePatientAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PracticePatientAssignment" ADD CONSTRAINT "PracticePatientAssignment_practicePatientLinkId_fkey"
  FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticePatientAssignment" ADD CONSTRAINT "PracticePatientAssignment_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticePatientAssignment" ADD CONSTRAINT "PracticePatientAssignment_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "PracticePatientAssignment_practicePatientLinkId_createdAt_idx"
  ON "PracticePatientAssignment"("practicePatientLinkId", "createdAt");
CREATE INDEX IF NOT EXISTS "PracticePatientAssignment_assignedToUserId_status_idx"
  ON "PracticePatientAssignment"("assignedToUserId", "status");
