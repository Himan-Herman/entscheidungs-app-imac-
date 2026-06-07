-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "practiceProfileId" TEXT,
    "practicePatientLinkId" TEXT,
    "consentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'granted',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "grantedByUserId" TEXT,
    "revokedByUserId" TEXT,
    "version" TEXT,
    "metadataJson" JSONB,
    -- source added here to match 20260601000000_prepare_practice_meda_metadata which adds this
    -- column on existing databases; on fresh DB this CREATE TABLE is the source of truth.
    "source" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentRecord_patientUserId_createdAt_idx" ON "ConsentRecord"("patientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_practiceProfileId_consentType_idx" ON "ConsentRecord"("practiceProfileId", "consentType");

-- CreateIndex
CREATE INDEX "ConsentRecord_practicePatientLinkId_consentType_status_idx" ON "ConsentRecord"("practicePatientLinkId", "consentType", "status");

-- CreateIndex
CREATE INDEX "ConsentRecord_status_expiresAt_idx" ON "ConsentRecord"("status", "expiresAt");
