-- Backfill of the patient data scope, and the end of the transitional state.
--
-- 20260728090000_add_patient_data_context added "dataScope" as nullable, where
-- NULL means "legacy, not yet classified". The read layer hides those rows from
-- every practice, so until this migration runs, practice views of vitals,
-- vaccinations, allergies and diagnoses are empty for pre-existing records.
--
-- Every historical write path of these four models was re-verified before this
-- migration was written and is patient-owned:
--   VitalEntry       - patient entry (routes/patientVitals.js) and the personal
--                      wearable import (services/wearables/importService.js)
--   VaccinationEntry - patient entry only (routes/patientVaccinations.js)
--   AllergyEntry     - patient entry only (routes/patientAllergies.js)
--   DiagnosisEntry   - patient entry only (routes/patientDiagnoses.js)
-- No practice route, worker, seed, import job, createMany or raw SQL has ever
-- written to them. Every legacy row is therefore the patient's own data, with
-- no care-relationship context - which is exactly 'patient_global'.
--
-- What this migration deliberately never does: it never invents a context. It
-- does not derive one from an appointment, a practice link or a timestamp, and
-- it never writes 'practice_contextual' or a link id. A record whose origin is
-- not unambiguous from the code is not classified by guessing; the precondition
-- block below aborts instead.
--
-- Prisma runs a migration file inside a single transaction on PostgreSQL, so
-- any RAISE EXCEPTION below rolls back the entire migration. Nothing is ever
-- partially applied.

-- =============================================================================
-- A. Preconditions - abort on any record whose origin is not unambiguous
-- =============================================================================
-- These states are already rejected by the CHECK constraints of the previous
-- migration, so they should not exist. The guard is kept regardless: a
-- constraint can be dropped by an operator, and a wrong classification of
-- medical provenance is not something to discover after the fact.
DO $$
DECLARE
  t            text;
  offending    bigint;
  reason       text;
BEGIN
  FOREACH t IN ARRAY ARRAY['VitalEntry', 'VaccinationEntry', 'AllergyEntry', 'DiagnosisEntry'] LOOP

    -- Unclassified but carrying a context: origin genuinely unknown. Reading it
    -- as global would leak it to every practice, reading it as contextual would
    -- trust a value no verified write path produced. Neither is defensible.
    EXECUTE format(
      'SELECT count(*) FROM %I WHERE "dataScope" IS NULL AND "contextPracticePatientLinkId" IS NOT NULL', t
    ) INTO offending;
    IF offending > 0 THEN
      RAISE EXCEPTION
        'backfill aborted: % row(s) in "%" have dataScope IS NULL with a context link. Origin is ambiguous; classify manually before retrying.',
        offending, t;
    END IF;

    -- Global with a context, or contextual without one: an inconsistent state
    -- that must be resolved before anything is classified.
    EXECUTE format(
      'SELECT count(*) FROM %I WHERE "dataScope" = ''patient_global'' AND "contextPracticePatientLinkId" IS NOT NULL', t
    ) INTO offending;
    IF offending > 0 THEN
      RAISE EXCEPTION
        'backfill aborted: % row(s) in "%" are patient_global but carry a context link.', offending, t;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I WHERE "dataScope" = ''practice_contextual'' AND "contextPracticePatientLinkId" IS NULL', t
    ) INTO offending;
    IF offending > 0 THEN
      RAISE EXCEPTION
        'backfill aborted: % row(s) in "%" are practice_contextual without a context link.', offending, t;
    END IF;

  END LOOP;

  reason := 'preconditions ok';
  RAISE NOTICE 'patient data scope backfill: %', reason;
END $$;

-- =============================================================================
-- B. Classify the unambiguously historical records
-- =============================================================================
-- Only rows that are BOTH unclassified AND context-free are touched. Anything
-- already classified is left exactly as it is, which is what makes a repeated
-- run a no-op.
--
-- Soft-deleted rows are included on purpose: "deletedAt IS NOT NULL" hides a
-- record from the patient's list, it does not remove it. It still has an origin,
-- it is still restorable, and an unclassified row would stay invisible to a
-- practice forever and would block the NOT NULL below.
--
-- No medical content appears anywhere in this migration - no values, no
-- allergens, no vaccines, no diagnoses, no ids. Only row counts.

UPDATE "VitalEntry"
   SET "dataScope" = 'patient_global'
 WHERE "dataScope" IS NULL
   AND "contextPracticePatientLinkId" IS NULL;

UPDATE "VaccinationEntry"
   SET "dataScope" = 'patient_global'
 WHERE "dataScope" IS NULL
   AND "contextPracticePatientLinkId" IS NULL;

UPDATE "AllergyEntry"
   SET "dataScope" = 'patient_global'
 WHERE "dataScope" IS NULL
   AND "contextPracticePatientLinkId" IS NULL;

UPDATE "DiagnosisEntry"
   SET "dataScope" = 'patient_global'
 WHERE "dataScope" IS NULL
   AND "contextPracticePatientLinkId" IS NULL;

-- =============================================================================
-- C. Validate the result before making the column mandatory
-- =============================================================================
DO $$
DECLARE
  t          text;
  remaining  bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['VitalEntry', 'VaccinationEntry', 'AllergyEntry', 'DiagnosisEntry'] LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE "dataScope" IS NULL', t) INTO remaining;
    IF remaining > 0 THEN
      RAISE EXCEPTION
        'backfill aborted: % row(s) in "%" are still unclassified after the backfill.', remaining, t;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- D. Make the scope mandatory
-- =============================================================================
-- All legacy rows are classified, all five write paths set the scope explicitly,
-- and there is deliberately no DEFAULT: a future write path that forgets the
-- scope must fail loudly instead of silently producing an unclassified record.
ALTER TABLE "VitalEntry"       ALTER COLUMN "dataScope" SET NOT NULL;
ALTER TABLE "VaccinationEntry" ALTER COLUMN "dataScope" SET NOT NULL;
ALTER TABLE "AllergyEntry"     ALTER COLUMN "dataScope" SET NOT NULL;
ALTER TABLE "DiagnosisEntry"   ALTER COLUMN "dataScope" SET NOT NULL;

-- =============================================================================
-- E. Tighten the CHECK constraints - the transitional state is now illegal
-- =============================================================================
-- The previous constraints still permitted NULL / NULL, which was correct while
-- the backfill was pending. After this migration exactly two shapes are legal:
--
--   patient_global      + no context link   -> allowed
--   practice_contextual + context link      -> allowed
--   patient_global      + context link      -> rejected
--   practice_contextual + no context link   -> rejected
--   NULL                + anything          -> rejected
--
-- NOT NULL alone would already exclude the NULL cases, but the constraint is
-- rewritten so the invariant does not depend on a separate column property: if
-- someone ever drops NOT NULL, unclassified rows still cannot be written.
-- A NULL scope reaches neither WHEN branch (NULL = 'patient_global' is UNKNOWN,
-- and UNKNOWN does not match), so it falls through to ELSE false and is
-- rejected. Verified against a sandbox database with NOT NULL dropped.

ALTER TABLE "VitalEntry" DROP CONSTRAINT "VitalEntry_dataScope_context_check";
ALTER TABLE "VitalEntry" ADD CONSTRAINT "VitalEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" = 'patient_global'       THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'practice_contextual'  THEN "contextPracticePatientLinkId" IS NOT NULL
    ELSE false
  END
);

ALTER TABLE "VaccinationEntry" DROP CONSTRAINT "VaccinationEntry_dataScope_context_check";
ALTER TABLE "VaccinationEntry" ADD CONSTRAINT "VaccinationEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" = 'patient_global'       THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'practice_contextual'  THEN "contextPracticePatientLinkId" IS NOT NULL
    ELSE false
  END
);

ALTER TABLE "AllergyEntry" DROP CONSTRAINT "AllergyEntry_dataScope_context_check";
ALTER TABLE "AllergyEntry" ADD CONSTRAINT "AllergyEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" = 'patient_global'       THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'practice_contextual'  THEN "contextPracticePatientLinkId" IS NOT NULL
    ELSE false
  END
);

ALTER TABLE "DiagnosisEntry" DROP CONSTRAINT "DiagnosisEntry_dataScope_context_check";
ALTER TABLE "DiagnosisEntry" ADD CONSTRAINT "DiagnosisEntry_dataScope_context_check" CHECK (
  CASE
    WHEN "dataScope" = 'patient_global'       THEN "contextPracticePatientLinkId" IS NULL
    WHEN "dataScope" = 'practice_contextual'  THEN "contextPracticePatientLinkId" IS NOT NULL
    ELSE false
  END
);
