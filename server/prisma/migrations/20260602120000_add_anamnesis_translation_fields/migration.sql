-- Add AI translation fields to PracticeAnamnesisSubmission.
-- All new columns are nullable (no breaking change for existing rows).

ALTER TABLE "public"."PracticeAnamnesisSubmission"
  ADD COLUMN IF NOT EXISTS "translatedAnswersJson"     JSONB,
  ADD COLUMN IF NOT EXISTS "translationStatus"         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "translatedAt"              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "translationTargetLanguage" VARCHAR(12);

CREATE INDEX IF NOT EXISTS "PracticeAnamnesisSubmission_translationStatus_idx"
  ON "public"."PracticeAnamnesisSubmission"("translationStatus");
