-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "practiceProfileId" TEXT,
    "patientUserId" TEXT,
    "practicePatientLinkId" TEXT,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "storageKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportJob_requestedByUserId_createdAt_idx" ON "ExportJob"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportJob_patientUserId_createdAt_idx" ON "ExportJob"("patientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportJob_practiceProfileId_createdAt_idx" ON "ExportJob"("practiceProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportJob_practicePatientLinkId_idx" ON "ExportJob"("practicePatientLinkId");

-- CreateIndex
CREATE INDEX "ExportJob_status_expiresAt_idx" ON "ExportJob"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
