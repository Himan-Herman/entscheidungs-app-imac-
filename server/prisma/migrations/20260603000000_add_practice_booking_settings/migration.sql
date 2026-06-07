-- Phase 1A: Add consent tracking fields to PracticeAppointment (all nullable, no data loss)
-- Conditional: PracticeAppointment is created in 20260616120000_practice_calendar_appointments
-- (June 16), which runs AFTER this migration on a fresh CI database. Skip silently on fresh DB;
-- the June 16 CREATE TABLE includes these three columns directly for fresh installs.
-- On an existing database the table already exists and the columns are added normally.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PracticeAppointment'
  ) THEN
    ALTER TABLE "public"."PracticeAppointment"
      ADD COLUMN IF NOT EXISTS "requestConsentGrantedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "requestConsentVersion"   VARCHAR(20),
      ADD COLUMN IF NOT EXISTS "requestConsentScope"     VARCHAR(100);
  END IF;
END $$;

-- Phase 1A: Create PracticeBookingSettings table
CREATE TABLE "public"."PracticeBookingSettings" (
    "id"                    TEXT         NOT NULL,
    "practiceProfileId"     TEXT         NOT NULL,
    "bookingEnabled"        BOOLEAN      NOT NULL DEFAULT false,
    "bookingMode"           VARCHAR(30)  NOT NULL DEFAULT 'disabled',
    "requestFormNote"       VARCHAR(300),
    "linkedAnamnesisLinkId" TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeBookingSettings_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one settings row per practice
CREATE UNIQUE INDEX "PracticeBookingSettings_practiceProfileId_key"
    ON "public"."PracticeBookingSettings"("practiceProfileId");

-- Index for fast lookup by practice
CREATE INDEX "PracticeBookingSettings_practiceProfileId_idx"
    ON "public"."PracticeBookingSettings"("practiceProfileId");

-- FK: PracticeBookingSettings → PracticeProfile (cascade delete)
ALTER TABLE "public"."PracticeBookingSettings"
    ADD CONSTRAINT "PracticeBookingSettings_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId")
    REFERENCES "public"."PracticeProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: PracticeBookingSettings → PracticeAnamnesisLink (set null on delete)
ALTER TABLE "public"."PracticeBookingSettings"
    ADD CONSTRAINT "PracticeBookingSettings_linkedAnamnesisLinkId_fkey"
    FOREIGN KEY ("linkedAnamnesisLinkId")
    REFERENCES "public"."PracticeAnamnesisLink"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
