-- Practice-initiated patient onboarding, Phase 1 — data model only.
--
-- Strictly additive: two new tables, their indexes and their foreign keys.
-- No existing table is altered, no column is dropped or retyped, no row is read
-- or written. PracticePatientLink.patientUserId stays NOT NULL — a link is
-- still only ever created once a real account exists.

-- CreateTable
CREATE TABLE "PracticePatientEntry" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "givenName" VARCHAR(120) NOT NULL,
    "familyName" VARCHAR(120) NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "email" VARCHAR(255),
    "phone" VARCHAR(40),
    "practiceRecordNumber" VARCHAR(64),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "linkedAt" TIMESTAMP(3),
    "practicePatientLinkId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticePatientEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticePatientInvitation" (
    "id" TEXT NOT NULL,
    "practicePatientEntryId" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "tokenPrefix" VARCHAR(12),
    "manualCodeHash" VARCHAR(64),
    "manualCodeExpiresAt" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "deliveryChannel" VARCHAR(20),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticePatientInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticePatientEntry_practicePatientLinkId_key" ON "PracticePatientEntry"("practicePatientLinkId");

-- CreateIndex
CREATE INDEX "PracticePatientEntry_practiceProfileId_status_idx" ON "PracticePatientEntry"("practiceProfileId", "status");

-- CreateIndex
CREATE INDEX "PracticePatientEntry_practiceProfileId_familyName_givenName_idx" ON "PracticePatientEntry"("practiceProfileId", "familyName", "givenName");

-- CreateIndex
CREATE INDEX "PracticePatientEntry_practiceProfileId_createdAt_idx" ON "PracticePatientEntry"("practiceProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PracticePatientInvitation_tokenHash_key" ON "PracticePatientInvitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PracticePatientInvitation_manualCodeHash_key" ON "PracticePatientInvitation"("manualCodeHash");

-- CreateIndex
CREATE INDEX "PracticePatientInvitation_practicePatientEntryId_status_idx" ON "PracticePatientInvitation"("practicePatientEntryId", "status");

-- CreateIndex
CREATE INDEX "PracticePatientInvitation_practiceProfileId_status_idx" ON "PracticePatientInvitation"("practiceProfileId", "status");

-- CreateIndex
CREATE INDEX "PracticePatientInvitation_status_expiresAt_idx" ON "PracticePatientInvitation"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "PracticePatientEntry" ADD CONSTRAINT "PracticePatientEntry_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePatientEntry" ADD CONSTRAINT "PracticePatientEntry_practicePatientLinkId_fkey" FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePatientEntry" ADD CONSTRAINT "PracticePatientEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePatientInvitation" ADD CONSTRAINT "PracticePatientInvitation_practicePatientEntryId_fkey" FOREIGN KEY ("practicePatientEntryId") REFERENCES "PracticePatientEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePatientInvitation" ADD CONSTRAINT "PracticePatientInvitation_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePatientInvitation" ADD CONSTRAINT "PracticePatientInvitation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePatientInvitation" ADD CONSTRAINT "PracticePatientInvitation_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePatientInvitation" ADD CONSTRAINT "PracticePatientInvitation_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- At most ONE technically pending invitation per practice-local entry.
--
-- Prisma cannot express a partial unique index, so this is written by hand —
-- the same technique already used by
-- PracticePatientLink_practice_patient_active_no_profile_key in
-- 20260518120000_practice_patient_link. A schema test asserts it still exists,
-- because a future `migrate dev` would otherwise silently drop it as drift.
--
-- An EXPIRED invitation deliberately stays `pending` and therefore keeps
-- occupying this slot: expiry is a derived property, never a stored status, so
-- nothing writes to the database merely because time passed. Freeing the slot
-- is the job of the regeneration path, which supersedes every pending row —
-- expired ones included — inside the same transaction.
CREATE UNIQUE INDEX "PracticePatientInvitation_one_pending_per_entry_key"
    ON "PracticePatientInvitation"("practicePatientEntryId")
    WHERE "status" = 'pending';
