-- Phase 4A: a translation of one message, bound to one exact state of it.
--
-- Additive only: a new table and nothing else. No existing column is altered,
-- so a deployment that never enables message translation carries an empty table
-- and behaves exactly as before.
CREATE TABLE IF NOT EXISTS "PracticeMessageTranslation" (
  "id"                TEXT NOT NULL,
  "messageId"         TEXT NOT NULL,
  "threadId"          TEXT NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "targetLanguage"    TEXT NOT NULL,
  "sourceLanguage"    TEXT,
  "mode"              TEXT NOT NULL DEFAULT 'normal',
  "translatedText"    TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PracticeMessageTranslation_pkey" PRIMARY KEY ("id")
);

-- One entry per (message state, language, mode). The fingerprint is part of the
-- key, so an edited message cannot collide with a translation of its previous
-- wording — the two are different rows and the old one simply stops matching.
CREATE UNIQUE INDEX IF NOT EXISTS "PracticeMessageTranslation_version_key"
  ON "PracticeMessageTranslation" ("messageId", "sourceFingerprint", "targetLanguage", "mode");

CREATE INDEX IF NOT EXISTS "PracticeMessageTranslation_messageId_idx"
  ON "PracticeMessageTranslation" ("messageId");

-- CASCADE, deliberately: a translation has no meaning once the message it
-- reads is gone, and leaving orphans would leave readable medical text behind
-- with nothing left to authorize access to it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PracticeMessageTranslation_messageId_fkey'
  ) THEN
    ALTER TABLE "PracticeMessageTranslation"
      ADD CONSTRAINT "PracticeMessageTranslation_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "PracticePatientMessage"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Fail closed rather than leave a half-applied schema behind.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'PracticeMessageTranslation'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PracticeMessageTranslation_messageId_fkey'
  ) THEN
    RAISE EXCEPTION 'PracticeMessageTranslation is incomplete after migration';
  END IF;
END $$;
