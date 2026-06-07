-- Document OCR / lab structuring (organizational only)

CREATE TABLE "DocumentOcrJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "practicePatientLinkId" TEXT,
    "patientUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "engine" TEXT NOT NULL DEFAULT 'local_stub',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentOcrJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentOcrResult" (
    "id" TEXT NOT NULL,
    "ocrJobId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'needs_review',
    "extractedTextStorageKey" TEXT,
    "structuredJson" JSONB,
    "confidence" DOUBLE PRECISION,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentOcrResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabStructuredEntry" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ocrJobId" TEXT,
    "label" TEXT NOT NULL,
    "valueText" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRangeText" TEXT,
    "collectedAt" TIMESTAMP(3),
    "sourcePage" INTEGER,
    "sourceLine" INTEGER,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabStructuredEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentOcrResult_ocrJobId_key" ON "DocumentOcrResult"("ocrJobId");
CREATE INDEX "DocumentOcrJob_documentId_status_idx" ON "DocumentOcrJob"("documentId", "status");
CREATE INDEX "DocumentOcrJob_practiceProfileId_createdAt_idx" ON "DocumentOcrJob"("practiceProfileId", "createdAt");
-- IF NOT EXISTS: on an existing database 20260525224209_add_vital_entry may have already
-- created this index with the correct two-column definition; skip silently in that case.
-- Columns corrected to ("documentId", "reviewStatus") to match schema.prisma @@index([documentId, reviewStatus]).
CREATE INDEX IF NOT EXISTS "DocumentOcrResult_documentId_reviewStatus_idx" ON "DocumentOcrResult"("documentId", "reviewStatus");
CREATE INDEX "LabStructuredEntry_documentId_idx" ON "LabStructuredEntry"("documentId");
CREATE INDEX "LabStructuredEntry_ocrJobId_idx" ON "LabStructuredEntry"("ocrJobId");

ALTER TABLE "DocumentOcrJob" ADD CONSTRAINT "DocumentOcrJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PracticeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentOcrJob" ADD CONSTRAINT "DocumentOcrJob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "PracticeDocumentFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentOcrJob" ADD CONSTRAINT "DocumentOcrJob_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentOcrJob" ADD CONSTRAINT "DocumentOcrJob_practicePatientLinkId_fkey" FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentOcrJob" ADD CONSTRAINT "DocumentOcrJob_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentOcrJob" ADD CONSTRAINT "DocumentOcrJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentOcrResult" ADD CONSTRAINT "DocumentOcrResult_ocrJobId_fkey" FOREIGN KEY ("ocrJobId") REFERENCES "DocumentOcrJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentOcrResult" ADD CONSTRAINT "DocumentOcrResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PracticeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LabStructuredEntry" ADD CONSTRAINT "LabStructuredEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PracticeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabStructuredEntry" ADD CONSTRAINT "LabStructuredEntry_ocrJobId_fkey" FOREIGN KEY ("ocrJobId") REFERENCES "DocumentOcrJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
