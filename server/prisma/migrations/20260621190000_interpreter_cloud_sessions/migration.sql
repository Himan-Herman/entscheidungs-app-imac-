-- Medical Interpreter — optional encrypted cloud session storage (Phase 3.2)

CREATE TABLE "InterpreterCloudPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cloudEnabled" BOOLEAN NOT NULL DEFAULT false,
    "consentVersion" TEXT,
    "consentGrantedAt" TIMESTAMP(3),
    "consentRevokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterpreterCloudPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterpreterCloudSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "patientLanguage" VARCHAR(12) NOT NULL,
    "doctorLanguage" VARCHAR(12) NOT NULL,
    "conversationTitle" VARCHAR(200),
    "doctorName" VARCHAR(120),
    "practiceName" VARCHAR(120),
    "specialty" VARCHAR(120),
    "appointmentDateTime" TIMESTAMP(3),
    "profileConsentUsed" BOOLEAN NOT NULL DEFAULT false,
    "cloudStorageConsent" BOOLEAN NOT NULL DEFAULT false,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "endedAt" TIMESTAMP(3),
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InterpreterCloudSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterpreterCloudSessionPayload" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payloadEnc" TEXT NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "checksumSha256" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterpreterCloudSessionPayload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InterpreterCloudPreference_userId_key" ON "InterpreterCloudPreference"("userId");

CREATE UNIQUE INDEX "InterpreterCloudSession_userId_clientSessionId_key" ON "InterpreterCloudSession"("userId", "clientSessionId");

CREATE INDEX "InterpreterCloudSession_userId_updatedAt_idx" ON "InterpreterCloudSession"("userId", "updatedAt");

CREATE INDEX "InterpreterCloudSession_userId_deletedAt_idx" ON "InterpreterCloudSession"("userId", "deletedAt");

CREATE UNIQUE INDEX "InterpreterCloudSessionPayload_sessionId_key" ON "InterpreterCloudSessionPayload"("sessionId");

CREATE INDEX "InterpreterCloudSessionPayload_userId_idx" ON "InterpreterCloudSessionPayload"("userId");

ALTER TABLE "InterpreterCloudPreference" ADD CONSTRAINT "InterpreterCloudPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterpreterCloudSession" ADD CONSTRAINT "InterpreterCloudSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterpreterCloudSessionPayload" ADD CONSTRAINT "InterpreterCloudSessionPayload_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterpreterCloudSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterpreterCloudSessionPayload" ADD CONSTRAINT "InterpreterCloudSessionPayload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
