-- PR-2: store patient-granted consent scopes on the care link.
ALTER TABLE "PracticePatientLink" ADD COLUMN IF NOT EXISTS "consentScopes" JSONB;
