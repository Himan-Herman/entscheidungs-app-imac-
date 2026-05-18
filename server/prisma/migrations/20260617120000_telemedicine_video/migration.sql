-- Telemedicine / video consultation layer (organizational MVP)

CREATE TABLE "PracticeTelemedicineSettings" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "videoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "providerType" TEXT NOT NULL DEFAULT 'sandbox',
    "consentVersion" TEXT NOT NULL DEFAULT '1',
    "sandboxMode" BOOLEAN NOT NULL DEFAULT true,
    "externalLinkMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeTelemedicineSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelemedicineSession" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT,
    "practiceProfileId" TEXT NOT NULL,
    "practicePatientLinkId" TEXT,
    "patientUserId" TEXT,
    "providerType" TEXT NOT NULL DEFAULT 'sandbox',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "title" TEXT,
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "joinUrlHash" TEXT,
    "hostUrlHash" TEXT,
    "providerRoomId" TEXT,
    "linkRevokedAt" TIMESTAMP(3),
    "consentAcceptedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemedicineSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelemedicineParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemedicineParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelemedicineConsent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'granted',
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemedicineConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeTelemedicineSettings_practiceProfileId_key" ON "PracticeTelemedicineSettings"("practiceProfileId");
CREATE UNIQUE INDEX "TelemedicineSession_appointmentId_key" ON "TelemedicineSession"("appointmentId");
CREATE INDEX "TelemedicineSession_practiceProfileId_status_idx" ON "TelemedicineSession"("practiceProfileId", "status");
CREATE INDEX "TelemedicineSession_practiceProfileId_scheduledStartAt_idx" ON "TelemedicineSession"("practiceProfileId", "scheduledStartAt");
CREATE INDEX "TelemedicineSession_patientUserId_idx" ON "TelemedicineSession"("patientUserId");
CREATE INDEX "TelemedicineParticipant_sessionId_status_idx" ON "TelemedicineParticipant"("sessionId", "status");
CREATE INDEX "TelemedicineParticipant_userId_idx" ON "TelemedicineParticipant"("userId");
CREATE INDEX "TelemedicineConsent_sessionId_status_idx" ON "TelemedicineConsent"("sessionId", "status");
CREATE INDEX "TelemedicineConsent_patientUserId_idx" ON "TelemedicineConsent"("patientUserId");

ALTER TABLE "PracticeTelemedicineSettings" ADD CONSTRAINT "PracticeTelemedicineSettings_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelemedicineSession" ADD CONSTRAINT "TelemedicineSession_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelemedicineSession" ADD CONSTRAINT "TelemedicineSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "PracticeAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelemedicineSession" ADD CONSTRAINT "TelemedicineSession_practicePatientLinkId_fkey" FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelemedicineSession" ADD CONSTRAINT "TelemedicineSession_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelemedicineSession" ADD CONSTRAINT "TelemedicineSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelemedicineParticipant" ADD CONSTRAINT "TelemedicineParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelemedicineSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelemedicineParticipant" ADD CONSTRAINT "TelemedicineParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelemedicineConsent" ADD CONSTRAINT "TelemedicineConsent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelemedicineSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelemedicineConsent" ADD CONSTRAINT "TelemedicineConsent_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
