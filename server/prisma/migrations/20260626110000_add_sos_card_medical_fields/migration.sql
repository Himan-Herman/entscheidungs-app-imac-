-- SOS-Karte medical base data — additive only.
-- New nullable / safely-defaulted columns on "SosCard".
-- No table drops, no renames, no removals. Age / height / weight are NOT stored here —
-- they are referenced read-only from User.dateOfBirth and UserProfile.heightCm / weightKg.

ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "emergencyBiologicalSex" VARCHAR(20);
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "pregnancyStatus" VARCHAR(20);

-- Visibility flags. Sensitive / identifying fields default to opt-in (false); the rest match
-- the existing "visible" default so behaviour for current rows is unchanged.
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showAge" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showDateOfBirth" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showBiologicalSex" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showHeight" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showWeight" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showPregnancyStatus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SosCard" ADD COLUMN IF NOT EXISTS "showPreferredLanguage" BOOLEAN NOT NULL DEFAULT true;
