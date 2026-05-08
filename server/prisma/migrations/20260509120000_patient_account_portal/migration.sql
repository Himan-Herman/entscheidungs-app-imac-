-- Patient account portal: profile fields, family profiles, doctor favorites, session profile link

ALTER TABLE "UserProfile" ADD COLUMN "genderOrSalutation" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "displayName" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "preferredPatientLanguage" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "preferredDoctorLanguage" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "emergencyNote" TEXT;

ALTER TABLE "DoctorContact" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DoctorContact" ADD COLUMN "lastUsedAt" TIMESTAMP(3);

CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "relationLabel" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "genderOrSalutation" TEXT,
    "preferredPatientLanguage" TEXT,
    "preferredDoctorLanguage" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientProfile_userId_idx" ON "PatientProfile"("userId");

ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreVisitSession" ADD COLUMN "patientProfileId" TEXT;

CREATE INDEX "PreVisitSession_patientProfileId_idx" ON "PreVisitSession"("patientProfileId");

ALTER TABLE "PreVisitSession" ADD CONSTRAINT "PreVisitSession_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
