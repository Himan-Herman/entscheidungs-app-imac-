-- Archived practice contexts: the frozen origin of medical records whose
-- practice no longer exists.
--
-- Until now a hard deletion of a practice was refused outright, because every
-- contextual VitalEntry, VaccinationEntry, AllergyEntry and DiagnosisEntry
-- holds an ON DELETE RESTRICT foreign key to the care link. That was the right
-- default — a medical record must not silently lose its origin — but it left
-- practice and account deletion permanently blocked.
--
-- A record now moves from its live link to an immutable archive context. It is
-- never deleted, never re-labelled as the patient's own global data, and never
-- left without an origin. Its dataScope stays practice_contextual: the record
-- still belongs to a care relationship, that relationship simply ended.
--
-- Purely additive. No existing row is read, changed or archived; no backfill,
-- no deletion. Archiving happens only when a deletion actually runs.

CREATE TYPE "PracticeContextArchiveReason" AS ENUM ('practice_deleted', 'owner_account_deleted');

CREATE TABLE "ArchivedPracticePatientContext" (
  "id"                            TEXT NOT NULL,
  "patientUserId"                 TEXT NOT NULL,
  "originalPracticePatientLinkId" TEXT NOT NULL,
  "originalPracticeProfileId"     TEXT NOT NULL,
  "practiceDisplayNameSnapshot"   VARCHAR(200),
  "practiceSpecialtySnapshot"     VARCHAR(160),
  "archiveReason"                 "PracticeContextArchiveReason" NOT NULL,
  "archivedAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ArchivedPracticePatientContext_pkey" PRIMARY KEY ("id")
);

-- The only foreign key. originalPracticePatientLinkId and
-- originalPracticeProfileId deliberately have NONE: they name rows that no
-- longer exist, which is the entire point of an archive.
--
-- Cascade from the patient: if the patient erases their account, their own
-- archive contexts go with them. The four models keep a RESTRICT to this table,
-- so the account deletion path must remove the patient's medical records first
-- — that ordering is explicit in the service rather than left to cascade order.
ALTER TABLE "ArchivedPracticePatientContext"
  ADD CONSTRAINT "ArchivedPracticePatientContext_patientUserId_fkey"
  FOREIGN KEY ("patientUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- One archive per former link: makes archiving idempotent, so a retried
-- deletion reuses the context instead of creating a second one.
CREATE UNIQUE INDEX "ArchivedPracticePatientContext_originalLink_key"
  ON "ArchivedPracticePatientContext"("originalPracticePatientLinkId");

CREATE INDEX "ArchivedPracticePatientContext_patientUserId_archivedAt_idx"
  ON "ArchivedPracticePatientContext"("patientUserId", "archivedAt");
CREATE INDEX "ArchivedPracticePatientContext_originalPracticeProfileId_idx"
  ON "ArchivedPracticePatientContext"("originalPracticeProfileId");

-- ============================================================================
-- The archived-context column on the four patient-owned models
-- ============================================================================

ALTER TABLE "VitalEntry"       ADD COLUMN "archivedPracticeContextId" TEXT;
ALTER TABLE "VaccinationEntry" ADD COLUMN "archivedPracticeContextId" TEXT;
ALTER TABLE "AllergyEntry"     ADD COLUMN "archivedPracticeContextId" TEXT;
ALTER TABLE "DiagnosisEntry"   ADD COLUMN "archivedPracticeContextId" TEXT;

-- RESTRICT: an archive context may never be removed while medical records still
-- point at it. The same reasoning as the live link, for the same reason.
ALTER TABLE "VitalEntry"
  ADD CONSTRAINT "VitalEntry_archivedPracticeContextId_fkey"
  FOREIGN KEY ("archivedPracticeContextId") REFERENCES "ArchivedPracticePatientContext"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VaccinationEntry"
  ADD CONSTRAINT "VaccinationEntry_archivedPracticeContextId_fkey"
  FOREIGN KEY ("archivedPracticeContextId") REFERENCES "ArchivedPracticePatientContext"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AllergyEntry"
  ADD CONSTRAINT "AllergyEntry_archivedPracticeContextId_fkey"
  FOREIGN KEY ("archivedPracticeContextId") REFERENCES "ArchivedPracticePatientContext"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEntry"
  ADD CONSTRAINT "DiagnosisEntry_archivedPracticeContextId_fkey"
  FOREIGN KEY ("archivedPracticeContextId") REFERENCES "ArchivedPracticePatientContext"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "VitalEntry_archivedPracticeContextId_idx"       ON "VitalEntry"("archivedPracticeContextId");
CREATE INDEX "VaccinationEntry_archivedPracticeContextId_idx" ON "VaccinationEntry"("archivedPracticeContextId");
CREATE INDEX "AllergyEntry_archivedPracticeContextId_idx"     ON "AllergyEntry"("archivedPracticeContextId");
CREATE INDEX "DiagnosisEntry_archivedPracticeContextId_idx"   ON "DiagnosisEntry"("archivedPracticeContextId");

-- ============================================================================
-- The invariant, extended to three legal shapes
-- ============================================================================
--
--   patient_global      + no link + no archive   -> the patient's own data
--   practice_contextual + link    + no archive   -> a live care relationship
--   practice_contextual + no link + archive      -> a care relationship that ended
--
-- Everything else is rejected: both context ids set, neither set on a
-- contextual record, any context id on a global record, and a NULL scope.
--
-- Written as CASE so every combination yields a real boolean. A chain of ORs
-- would let a NULL scope through as UNKNOWN, which PostgreSQL accepts.

ALTER TABLE "VitalEntry" DROP CONSTRAINT "VitalEntry_dataScope_context_check";
ALTER TABLE "VitalEntry" ADD CONSTRAINT "VitalEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" = 'patient_global' THEN
      "contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NULL
    WHEN "dataScope" = 'practice_contextual' THEN
      ("contextPracticePatientLinkId" IS NOT NULL AND "archivedPracticeContextId" IS NULL)
      OR ("contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NOT NULL)
    ELSE false
  END
);

ALTER TABLE "VaccinationEntry" DROP CONSTRAINT "VaccinationEntry_dataScope_context_check";
ALTER TABLE "VaccinationEntry" ADD CONSTRAINT "VaccinationEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" = 'patient_global' THEN
      "contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NULL
    WHEN "dataScope" = 'practice_contextual' THEN
      ("contextPracticePatientLinkId" IS NOT NULL AND "archivedPracticeContextId" IS NULL)
      OR ("contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NOT NULL)
    ELSE false
  END
);

ALTER TABLE "AllergyEntry" DROP CONSTRAINT "AllergyEntry_dataScope_context_check";
ALTER TABLE "AllergyEntry" ADD CONSTRAINT "AllergyEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" = 'patient_global' THEN
      "contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NULL
    WHEN "dataScope" = 'practice_contextual' THEN
      ("contextPracticePatientLinkId" IS NOT NULL AND "archivedPracticeContextId" IS NULL)
      OR ("contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NOT NULL)
    ELSE false
  END
);

ALTER TABLE "DiagnosisEntry" DROP CONSTRAINT "DiagnosisEntry_dataScope_context_check";
ALTER TABLE "DiagnosisEntry" ADD CONSTRAINT "DiagnosisEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" = 'patient_global' THEN
      "contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NULL
    WHEN "dataScope" = 'practice_contextual' THEN
      ("contextPracticePatientLinkId" IS NOT NULL AND "archivedPracticeContextId" IS NULL)
      OR ("contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NOT NULL)
    ELSE false
  END
);
