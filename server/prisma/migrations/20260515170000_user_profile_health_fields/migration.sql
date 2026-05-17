-- Optional patient health context on UserProfile (orientation / Pre-Visit, not a medical record)
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "heightCm" INTEGER;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "weightKg" DOUBLE PRECISION;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "allergies" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "chronicConditions" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "regularMedications" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "smokingStatus" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "alcoholUse" TEXT;
