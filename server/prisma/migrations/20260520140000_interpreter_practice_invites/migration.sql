-- CreateTable
CREATE TABLE "PracticeInterpreterInvite" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "displayName" VARCHAR(80),
    "inviteType" VARCHAR(32) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" VARCHAR(12),
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "maxUses" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "metadataVersion" VARCHAR(32) NOT NULL DEFAULT 'interpreter-invite-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeInterpreterInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeInterpreterInviteUsage" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" VARCHAR(64),

    CONSTRAINT "PracticeInterpreterInviteUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticeInterpreterInvite_tokenHash_key" ON "PracticeInterpreterInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "PracticeInterpreterInvite_practiceProfileId_status_idx" ON "PracticeInterpreterInvite"("practiceProfileId", "status");

-- CreateIndex
CREATE INDEX "PracticeInterpreterInvite_practiceProfileId_createdAt_idx" ON "PracticeInterpreterInvite"("practiceProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeInterpreterInvite_status_expiresAt_idx" ON "PracticeInterpreterInvite"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PracticeInterpreterInviteUsage_inviteId_usedAt_idx" ON "PracticeInterpreterInviteUsage"("inviteId", "usedAt");

-- AddForeignKey
ALTER TABLE "PracticeInterpreterInvite" ADD CONSTRAINT "PracticeInterpreterInvite_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeInterpreterInvite" ADD CONSTRAINT "PracticeInterpreterInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeInterpreterInvite" ADD CONSTRAINT "PracticeInterpreterInvite_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeInterpreterInviteUsage" ADD CONSTRAINT "PracticeInterpreterInviteUsage_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "PracticeInterpreterInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
