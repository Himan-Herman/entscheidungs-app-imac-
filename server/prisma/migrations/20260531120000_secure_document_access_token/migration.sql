-- Time-limited secure download tokens for practice documents (hashed at rest).

CREATE TABLE "SecureDocumentAccessToken" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fileId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "userId" TEXT,
    "practiceProfileId" TEXT,
    "practicePatientLinkId" TEXT,
    "createdByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecureDocumentAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecureDocumentAccessToken_tokenHash_key" ON "SecureDocumentAccessToken"("tokenHash");
CREATE INDEX "SecureDocumentAccessToken_documentId_idx" ON "SecureDocumentAccessToken"("documentId");
CREATE INDEX "SecureDocumentAccessToken_practiceProfileId_idx" ON "SecureDocumentAccessToken"("practiceProfileId");
CREATE INDEX "SecureDocumentAccessToken_expiresAt_idx" ON "SecureDocumentAccessToken"("expiresAt");

ALTER TABLE "SecureDocumentAccessToken" ADD CONSTRAINT "SecureDocumentAccessToken_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "PracticeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecureDocumentAccessToken" ADD CONSTRAINT "SecureDocumentAccessToken_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "PracticeDocumentFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecureDocumentAccessToken" ADD CONSTRAINT "SecureDocumentAccessToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecureDocumentAccessToken" ADD CONSTRAINT "SecureDocumentAccessToken_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecureDocumentAccessToken" ADD CONSTRAINT "SecureDocumentAccessToken_practicePatientLinkId_fkey"
    FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecureDocumentAccessToken" ADD CONSTRAINT "SecureDocumentAccessToken_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
