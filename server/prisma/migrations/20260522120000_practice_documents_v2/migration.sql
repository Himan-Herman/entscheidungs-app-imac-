-- PR-7: practice document sharing on care relationships.

CREATE TABLE "PracticeDocument" (
    "id" TEXT NOT NULL,
    "practicePatientLinkId" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdByUserId" TEXT,
    "sharedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeDocumentFile" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeDocumentFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeDocumentShare" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "sharedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "PracticeDocumentShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeDocument_practicePatientLinkId_status_idx"
    ON "PracticeDocument"("practicePatientLinkId", "status");

CREATE INDEX "PracticeDocument_patientUserId_status_idx"
    ON "PracticeDocument"("patientUserId", "status");

CREATE INDEX "PracticeDocument_practiceProfileId_createdAt_idx"
    ON "PracticeDocument"("practiceProfileId", "createdAt");

CREATE INDEX "PracticeDocumentFile_documentId_idx"
    ON "PracticeDocumentFile"("documentId");

CREATE INDEX "PracticeDocumentShare_documentId_status_idx"
    ON "PracticeDocumentShare"("documentId", "status");

CREATE INDEX "PracticeDocumentShare_patientUserId_status_idx"
    ON "PracticeDocumentShare"("patientUserId", "status");

ALTER TABLE "PracticeDocument" ADD CONSTRAINT "PracticeDocument_practicePatientLinkId_fkey"
    FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeDocument" ADD CONSTRAINT "PracticeDocument_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeDocument" ADD CONSTRAINT "PracticeDocument_patientUserId_fkey"
    FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeDocument" ADD CONSTRAINT "PracticeDocument_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticeDocumentFile" ADD CONSTRAINT "PracticeDocumentFile_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "PracticeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeDocumentShare" ADD CONSTRAINT "PracticeDocumentShare_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "PracticeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeDocumentShare" ADD CONSTRAINT "PracticeDocumentShare_patientUserId_fkey"
    FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeDocumentShare" ADD CONSTRAINT "PracticeDocumentShare_sharedByUserId_fkey"
    FOREIGN KEY ("sharedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
