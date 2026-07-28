-- Patient data context: classifies a patient-owned medical record as either
-- globally owned by the patient or created inside one concrete care
-- relationship.
--
-- Purely additive. No row is modified, no backfill, no default: existing rows
-- keep "dataScope" = NULL, which means "legacy / not yet classified" and must
-- never be treated as globally visible by the read layer.

CREATE TYPE "PatientDataScope" AS ENUM ('patient_global', 'practice_contextual');

ALTER TABLE "VitalEntry"       ADD COLUMN "dataScope" "PatientDataScope";
ALTER TABLE "VaccinationEntry" ADD COLUMN "dataScope" "PatientDataScope";
ALTER TABLE "AllergyEntry"     ADD COLUMN "dataScope" "PatientDataScope";
ALTER TABLE "DiagnosisEntry"   ADD COLUMN "dataScope" "PatientDataScope";

ALTER TABLE "VitalEntry"       ADD COLUMN "contextPracticePatientLinkId" TEXT;
ALTER TABLE "VaccinationEntry" ADD COLUMN "contextPracticePatientLinkId" TEXT;
ALTER TABLE "AllergyEntry"     ADD COLUMN "contextPracticePatientLinkId" TEXT;
ALTER TABLE "DiagnosisEntry"   ADD COLUMN "contextPracticePatientLinkId" TEXT;

-- ON DELETE RESTRICT: a contextual medical record must never silently lose
-- its origin. A PracticePatientLink is revoked via its status in the normal
-- lifecycle and is not hard-deleted; a hard delete that would orphan such a
-- record is refused by the database until an explicit archival procedure
-- handles it. See the note on hard-delete paths in the commit message.
ALTER TABLE "VitalEntry"
  ADD CONSTRAINT "VitalEntry_contextPracticePatientLinkId_fkey"
  FOREIGN KEY ("contextPracticePatientLinkId") REFERENCES "PracticePatientLink"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VaccinationEntry"
  ADD CONSTRAINT "VaccinationEntry_contextPracticePatientLinkId_fkey"
  FOREIGN KEY ("contextPracticePatientLinkId") REFERENCES "PracticePatientLink"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AllergyEntry"
  ADD CONSTRAINT "AllergyEntry_contextPracticePatientLinkId_fkey"
  FOREIGN KEY ("contextPracticePatientLinkId") REFERENCES "PracticePatientLink"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEntry"
  ADD CONSTRAINT "DiagnosisEntry_contextPracticePatientLinkId_fkey"
  FOREIGN KEY ("contextPracticePatientLinkId") REFERENCES "PracticePatientLink"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "VitalEntry_contextPracticePatientLinkId_idx"       ON "VitalEntry"("contextPracticePatientLinkId");
CREATE INDEX "VaccinationEntry_contextPracticePatientLinkId_idx" ON "VaccinationEntry"("contextPracticePatientLinkId");
CREATE INDEX "AllergyEntry_contextPracticePatientLinkId_idx"     ON "AllergyEntry"("contextPracticePatientLinkId");
CREATE INDEX "DiagnosisEntry_contextPracticePatientLinkId_idx"   ON "DiagnosisEntry"("contextPracticePatientLinkId");

CREATE INDEX "VitalEntry_userId_dataScope_context_deletedAt_idx"
  ON "VitalEntry"("userId", "dataScope", "contextPracticePatientLinkId", "deletedAt");
CREATE INDEX "VaccinationEntry_userId_dataScope_context_deletedAt_idx"
  ON "VaccinationEntry"("userId", "dataScope", "contextPracticePatientLinkId", "deletedAt");
CREATE INDEX "AllergyEntry_userId_dataScope_context_deletedAt_idx"
  ON "AllergyEntry"("userId", "dataScope", "contextPracticePatientLinkId", "deletedAt");
CREATE INDEX "DiagnosisEntry_userId_dataScope_context_deletedAt_idx"
  ON "DiagnosisEntry"("userId", "dataScope", "contextPracticePatientLinkId", "deletedAt");

-- Write-time invariants, strictly enforced:
--   NULL / NULL                     -> legacy, not yet classified (transitional)
--   patient_global / NULL           -> patient-owned, no care-relationship context
--   practice_contextual / link id   -> created inside one care relationship
-- Everything else is rejected, in particular practice_contextual without a
-- context and any scope-less row that carries one. Combined with ON DELETE
-- RESTRICT this cannot be reached by a cascade either.
--
-- Written as CASE rather than a chain of ORs on purpose: with ORs the row
-- (dataScope IS NULL, context = 'x') evaluates to UNKNOWN, because
-- NULL = 'patient_global' is UNKNOWN rather than false — and PostgreSQL
-- accepts a CHECK that evaluates to UNKNOWN. CASE returns a real boolean for
-- every one of the six combinations. Verified against a sandbox database.
ALTER TABLE "VitalEntry" ADD CONSTRAINT "VitalEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" IS NULL                  THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'patient_global'       THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'practice_contextual'  THEN "contextPracticePatientLinkId" IS NOT NULL
    ELSE false
  END
);
ALTER TABLE "VaccinationEntry" ADD CONSTRAINT "VaccinationEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" IS NULL                  THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'patient_global'       THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'practice_contextual'  THEN "contextPracticePatientLinkId" IS NOT NULL
    ELSE false
  END
);
ALTER TABLE "AllergyEntry" ADD CONSTRAINT "AllergyEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" IS NULL                  THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'patient_global'       THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'practice_contextual'  THEN "contextPracticePatientLinkId" IS NOT NULL
    ELSE false
  END
);
ALTER TABLE "DiagnosisEntry" ADD CONSTRAINT "DiagnosisEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" IS NULL                  THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'patient_global'       THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'practice_contextual'  THEN "contextPracticePatientLinkId" IS NOT NULL
    ELSE false
  END
);
