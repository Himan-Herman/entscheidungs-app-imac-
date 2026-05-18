-- Optional i18n keys for neutral inbox titles (fallback remains in title/summary columns).

ALTER TABLE "PatientInboxItem" ADD COLUMN IF NOT EXISTS "titleKey" TEXT;
ALTER TABLE "PatientInboxItem" ADD COLUMN IF NOT EXISTS "summaryKey" TEXT;
ALTER TABLE "PracticeInboxItem" ADD COLUMN IF NOT EXISTS "titleKey" TEXT;
ALTER TABLE "PracticeInboxItem" ADD COLUMN IF NOT EXISTS "summaryKey" TEXT;
