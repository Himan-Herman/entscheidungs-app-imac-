-- Restore DoctorContact.isFavorite and DoctorContact.lastUsedAt.
-- These columns were originally added in 20260509120000_patient_account_portal and were then
-- dropped unintentionally by 20260525224209_add_vital_entry (a drift-catch-all migration whose
-- DoctorContact change was an unrelated side effect). The application code (account overview +
-- doctorContacts routes) still relies on both fields, so ordering by the now-missing columns made
-- GET /api/account/overview throw and return 500 ("Konnte nicht geladen werden.").
--
-- Additive and idempotent: IF NOT EXISTS guards keep this safe on a fresh CI database (where the
-- drop migration already removed the columns) and on any database where they still exist.

ALTER TABLE "public"."DoctorContact" ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."DoctorContact" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);
