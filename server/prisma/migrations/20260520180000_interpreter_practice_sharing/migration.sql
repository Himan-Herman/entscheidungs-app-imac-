-- Phase 4: consent-based practice interpreter session sharing

CREATE TABLE "PracticeInterpreterSessionLink" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "inviteId" TEXT,
    "clientSessionId" VARCHAR(36) NOT NULL,
    "consentRecordId" TEXT,
    "consentStatus" TEXT NOT NULL DEFAULT 'pending',
    "consentGrantedAt" TIMESTAMP(3),
    "consentRevokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "metadataVersion" VARCHAR(32) NOT NULL DEFAULT 'interpreter-practice-link-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeInterpreterSessionLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeInterpreterSharePayload" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "payloadEnc" TEXT NOT NULL,
    "checksumSha256" VARCHAR(64) NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "turnCount" INTEGER NOT NULL,
    "charCount" INTEGER NOT NULL,
    "patientLanguage" VARCHAR(16) NOT NULL,
    "doctorLanguage" VARCHAR(16) NOT NULL,
    "sessionStatus" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeInterpreterSharePayload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeInterpreterSessionLink_practiceProfileId_patientUser_key" ON "PracticeInterpreterSessionLink"("practiceProfileId", "patientUserId", "clientSessionId");
CREATE INDEX "PracticeInterpreterSessionLink_practiceProfileId_consentStatus_idx" ON "PracticeInterpreterSessionLink"("practiceProfileId", "consentStatus");
CREATE INDEX "PracticeInterpreterSessionLink_practiceProfileId_consentGrantedAt_idx" ON "PracticeInterpreterSessionLink"("practiceProfileId", "consentGrantedAt");
CREATE INDEX "PracticeInterpreterSessionLink_patientUserId_consentStatus_idx" ON "PracticeInterpreterSessionLink"("patientUserId", "consentStatus");

CREATE UNIQUE INDEX "PracticeInterpreterSharePayload_linkId_key" ON "PracticeInterpreterSharePayload"("linkId");

ALTER TABLE "PracticeInterpreterSessionLink" ADD CONSTRAINT "PracticeInterpreterSessionLink_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeInterpreterSessionLink" ADD CONSTRAINT "PracticeInterpreterSessionLink_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeInterpreterSessionLink" ADD CONSTRAINT "PracticeInterpreterSessionLink_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "PracticeInterpreterInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticeInterpreterSessionLink" ADD CONSTRAINT "PracticeInterpreterSessionLink_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticeInterpreterSharePayload" ADD CONSTRAINT "PracticeInterpreterSharePayload_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "PracticeInterpreterSessionLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
