-- CreateTable: PracticeAnamnesisLink
CREATE TABLE "PracticeAnamnesisLink" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "tokenHash" VARCHAR(64) NOT NULL,
    "tokenPrefix" VARCHAR(12),
    "label" VARCHAR(120),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAnamnesisLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PracticeAnamnesisSubmission
CREATE TABLE "PracticeAnamnesisSubmission" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "linkId" TEXT,
    "patientLanguage" VARCHAR(12) NOT NULL,
    "answersJson" JSONB NOT NULL,
    "consentGrantedAt" TIMESTAMP(3) NOT NULL,
    "consentVersion" VARCHAR(20) NOT NULL DEFAULT 'v1',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "viewedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAnamnesisSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticeAnamnesisLink_tokenHash_key" ON "PracticeAnamnesisLink"("tokenHash");

CREATE INDEX "PracticeAnamnesisLink_practiceProfileId_isActive_idx" ON "PracticeAnamnesisLink"("practiceProfileId", "isActive");
CREATE INDEX "PracticeAnamnesisLink_practiceProfileId_createdAt_idx" ON "PracticeAnamnesisLink"("practiceProfileId", "createdAt");
CREATE INDEX "PracticeAnamnesisLink_templateId_idx" ON "PracticeAnamnesisLink"("templateId");

CREATE INDEX "PracticeAnamnesisSubmission_practiceProfileId_status_idx" ON "PracticeAnamnesisSubmission"("practiceProfileId", "status");
CREATE INDEX "PracticeAnamnesisSubmission_practiceProfileId_submittedAt_idx" ON "PracticeAnamnesisSubmission"("practiceProfileId", "submittedAt");
CREATE INDEX "PracticeAnamnesisSubmission_templateId_idx" ON "PracticeAnamnesisSubmission"("templateId");
CREATE INDEX "PracticeAnamnesisSubmission_linkId_idx" ON "PracticeAnamnesisSubmission"("linkId");
CREATE INDEX "PracticeAnamnesisSubmission_deletedAt_idx" ON "PracticeAnamnesisSubmission"("deletedAt");

-- AddForeignKey
ALTER TABLE "PracticeAnamnesisLink" ADD CONSTRAINT "PracticeAnamnesisLink_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeAnamnesisLink" ADD CONSTRAINT "PracticeAnamnesisLink_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PracticeAnamnesisTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeAnamnesisLink" ADD CONSTRAINT "PracticeAnamnesisLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticeAnamnesisSubmission" ADD CONSTRAINT "PracticeAnamnesisSubmission_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeAnamnesisSubmission" ADD CONSTRAINT "PracticeAnamnesisSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PracticeAnamnesisTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeAnamnesisSubmission" ADD CONSTRAINT "PracticeAnamnesisSubmission_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "PracticeAnamnesisLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
