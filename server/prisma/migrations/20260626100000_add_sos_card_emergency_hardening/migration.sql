-- SOS-Karte emergency hardening — additive only.
-- New nullable / safely-defaulted columns on "SosCard".
-- No table drops, no renames, no removals. Existing rows keep full visibility (defaults true).

ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "publicTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "medicationsJson" JSONB;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "implantsJson" JSONB;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "preferredEmergencyLanguage" VARCHAR(5);

ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showBloodType" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showAllergies" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showDiagnoses" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showMedications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showImplants" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showEmergencyContacts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showFirstResponderNote" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showAiSummary" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
