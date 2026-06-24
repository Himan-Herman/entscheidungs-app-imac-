-- CreateTable
CREATE TABLE "public"."PatientPracticeConnectCode" (
    "id" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" VARCHAR(12),
    "consentScopesJson" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "usedByPracticeProfileId" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PatientPracticeConnectCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientPracticeConnectCode_tokenHash_key" ON "public"."PatientPracticeConnectCode"("tokenHash");

-- CreateIndex
CREATE INDEX "PatientPracticeConnectCode_patientUserId_status_idx" ON "public"."PatientPracticeConnectCode"("patientUserId", "status");

-- CreateIndex
CREATE INDEX "PatientPracticeConnectCode_status_expiresAt_idx" ON "public"."PatientPracticeConnectCode"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "public"."PatientPracticeConnectCode" ADD CONSTRAINT "PatientPracticeConnectCode_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
