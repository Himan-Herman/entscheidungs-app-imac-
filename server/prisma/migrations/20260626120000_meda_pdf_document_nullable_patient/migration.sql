-- Meda PDF-QR: allow practice-owned PDF documents without a registered/linked patient.
-- Relaxes the two NOT NULL constraints on PracticeDocument so a Meda session PDF can
-- be stored for an unregistered, unlinked patient. Patient-linked documents continue
-- to set both fields; the FK ON DELETE CASCADE behaviour is preserved.
ALTER TABLE "public"."PracticeDocument"
  ALTER COLUMN "practicePatientLinkId" DROP NOT NULL,
  ALTER COLUMN "patientUserId" DROP NOT NULL;
