-- Phase 3B: a message may be edited or withdrawn while the recipient has not
-- read it.
--
-- Additive only. Both columns are nullable with no default, so every existing
-- message keeps exactly the meaning it had: never edited, never withdrawn.
-- Nothing is rewritten and nothing is dropped.
ALTER TABLE "PracticePatientMessage" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
ALTER TABLE "PracticePatientMessage" ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3);

-- Fail closed rather than leave a half-applied schema behind: the code that
-- follows depends on both columns existing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PracticePatientMessage' AND column_name = 'editedAt'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PracticePatientMessage' AND column_name = 'withdrawnAt'
  ) THEN
    RAISE EXCEPTION 'PracticePatientMessage is missing editedAt/withdrawnAt after migration';
  END IF;
END $$;
