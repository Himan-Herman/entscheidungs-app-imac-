-- Add patient personal data, doctor language and consent scopes to PracticeAnamnesisSubmission.
-- All new columns are nullable (no breaking change for existing rows).

ALTER TABLE "public"."PracticeAnamnesisSubmission"
  ADD COLUMN IF NOT EXISTS "patientInfoJson"  JSONB,
  ADD COLUMN IF NOT EXISTS "doctorLanguage"   VARCHAR(12),
  ADD COLUMN IF NOT EXISTS "consentScopes"    JSONB;
