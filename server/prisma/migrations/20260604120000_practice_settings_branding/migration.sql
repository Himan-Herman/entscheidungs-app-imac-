-- Practice settings & branding fields
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "supportedLanguages" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "openingHours" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "displayNameForPatients" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "logoStorageKey" TEXT;
ALTER TABLE "PracticeProfile" ADD COLUMN IF NOT EXISTS "logoMimeType" TEXT;
