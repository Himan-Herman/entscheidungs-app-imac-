-- Practice-internal notes and reminders on one patient–practice relationship.
--
-- ADDITIVE ONLY
-- Two new tables, their indexes and their foreign keys. Nothing existing is
-- altered or dropped: no column changes, no data migration, no backfill. The
-- application works unchanged before this runs and after it runs; only the two
-- new practice-internal features need it.
--
-- SCOPE COLUMNS
-- Both tables carry practicePatientLinkId AND practiceProfileId. The practice
-- id is denormalized from the link on purpose, so every query can be
-- tenant-scoped in one WHERE clause instead of relying on a join a caller
-- might forget.
--
-- ON DELETE
-- Cascade from the link and from the practice, matching
-- PracticePatientAssignment, which is the existing link-scoped internal record.
-- Deleting a care link or a practice removes that practice's own working notes
-- with it; nothing belonging to a patient is affected, because a patient owns
-- none of these rows.
--
-- Author and assignee ids carry NO foreign key, matching
-- PracticePatientMessage.senderUserId: a staff member leaving the product must
-- not erase the practice's working history.

-- CreateTable
CREATE TABLE "PracticePatientInternalNote" (
    "id" TEXT NOT NULL,
    "practicePatientLinkId" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticePatientInternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticePatientReminder" (
    "id" TEXT NOT NULL,
    "practicePatientLinkId" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "assignedToUserId" TEXT,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticePatientReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticePatientInternalNote_practicePatientLinkId_createdAt_idx" ON "PracticePatientInternalNote"("practicePatientLinkId", "createdAt");

-- CreateIndex
CREATE INDEX "PracticePatientInternalNote_practiceProfileId_idx" ON "PracticePatientInternalNote"("practiceProfileId");

-- CreateIndex
CREATE INDEX "PracticePatientReminder_practicePatientLinkId_dueAt_idx" ON "PracticePatientReminder"("practicePatientLinkId", "dueAt");

-- CreateIndex
CREATE INDEX "PracticePatientReminder_practiceProfileId_completedAt_dueAt_idx" ON "PracticePatientReminder"("practiceProfileId", "completedAt", "dueAt");

-- AddForeignKey
ALTER TABLE "PracticePatientInternalNote" ADD CONSTRAINT "PracticePatientInternalNote_practicePatientLinkId_fkey" FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePatientInternalNote" ADD CONSTRAINT "PracticePatientInternalNote_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePatientReminder" ADD CONSTRAINT "PracticePatientReminder_practicePatientLinkId_fkey" FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePatientReminder" ADD CONSTRAINT "PracticePatientReminder_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
