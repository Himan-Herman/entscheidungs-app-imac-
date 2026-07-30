-- Practice membership lifecycle (pause / close / reactivate / request deletion)
-- and the written proof that accompanies each of those actions.
--
-- Applies AFTER 20260729100000_add_archived_practice_patient_context and is
-- independent of it: that migration owns the archive of PHYSICALLY DELETED
-- practices, this one owns the membership status of practices that still
-- exist. Nothing here touches ArchivedPracticePatientContext, the contextual
-- data-scope constraints, or the destructive-deletion release gate.
--
-- Purely additive and non-destructive by construction:
--   * two new columns on PracticeProfile, the status one NOT NULL DEFAULT
--     'active', so every existing practice stays active and operative;
--   * two new stand-alone tables with NO foreign keys — a LifecycleCase must
--     outlive the practice or user it documents, exactly like the archive
--     snapshots;
--   * no backfill, no UPDATE of existing rows, no case rows for existing data,
--     no grant or token change, no DELETE of any kind.

ALTER TABLE "PracticeProfile" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "PracticeProfile" ADD COLUMN "lifecycleStatusChangedAt" TIMESTAMP(3);

-- Only the five known states may ever be stored. A typo'd status string would
-- otherwise silently read as non-active and lock a practice out.
ALTER TABLE "PracticeProfile" ADD CONSTRAINT "PracticeProfile_lifecycleStatus_check"
  CHECK ("lifecycleStatus" IN (
    'active', 'suspended', 'closed', 'reactivation_requested', 'deletion_requested'
  ));

CREATE INDEX "PracticeProfile_lifecycleStatus_idx" ON "PracticeProfile"("lifecycleStatus");

CREATE TABLE "LifecycleCase" (
  "id"                TEXT NOT NULL,
  "seq"               SERIAL NOT NULL,
  "caseNumber"        TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  "action"            TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'recorded',
  "entityType"        TEXT NOT NULL,
  "practiceProfileId" TEXT,
  "practiceName"      TEXT,
  "requestedByUserId" TEXT,
  "reason"            TEXT,
  "emailStatus"       TEXT NOT NULL DEFAULT 'pending',

  CONSTRAINT "LifecycleCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LifecycleCase_seq_key" ON "LifecycleCase"("seq");
CREATE UNIQUE INDEX "LifecycleCase_caseNumber_key" ON "LifecycleCase"("caseNumber");
CREATE INDEX "LifecycleCase_practiceProfileId_createdAt_idx"
  ON "LifecycleCase"("practiceProfileId", "createdAt");
CREATE INDEX "LifecycleCase_action_status_idx" ON "LifecycleCase"("action", "status");

CREATE TABLE "LifecycleOutboxEmail" (
  "id"             TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "caseNumber"     TEXT NOT NULL,
  "kind"           TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "locale"         TEXT NOT NULL DEFAULT 'de',
  "paramsJson"     TEXT,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "lastError"      TEXT,
  "sentAt"         TIMESTAMP(3),

  CONSTRAINT "LifecycleOutboxEmail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LifecycleOutboxEmail_status_createdAt_idx"
  ON "LifecycleOutboxEmail"("status", "createdAt");
CREATE INDEX "LifecycleOutboxEmail_caseNumber_idx" ON "LifecycleOutboxEmail"("caseNumber");
