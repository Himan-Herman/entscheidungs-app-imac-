-- PR-7: soft delete fields + document audit trail.

ALTER TABLE "PracticeDocument" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "PracticeDocument" ADD COLUMN "deletedByUserId" TEXT;

ALTER TABLE "PracticeDocument" ADD CONSTRAINT "PracticeDocument_deletedByUserId_fkey"
    FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PracticeDocumentAuditEntry" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "practiceProfileId" TEXT,
    "patientUserId" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeDocumentAuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeDocumentAuditEntry_resourceType_resourceId_idx"
    ON "PracticeDocumentAuditEntry"("resourceType", "resourceId");

CREATE INDEX "PracticeDocumentAuditEntry_practiceProfileId_createdAt_idx"
    ON "PracticeDocumentAuditEntry"("practiceProfileId", "createdAt");

CREATE INDEX "PracticeDocumentAuditEntry_patientUserId_createdAt_idx"
    ON "PracticeDocumentAuditEntry"("patientUserId", "createdAt");

ALTER TABLE "PracticeDocumentAuditEntry" ADD CONSTRAINT "PracticeDocumentAuditEntry_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
