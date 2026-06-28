-- SOS-Karte: data-minimised public visibility (DSGVO Art. 5(1)(c)) — no schema shape change.
-- Sensitive (health / Art. 9 / third-party-contact) visibility flags now default to opt-in (false).
-- Only non-health basics (showAge, showPreferredLanguage) keep default true.
-- No table/column drops, no renames, no data deletion.

-- 1) New rows: flip the column DEFAULT to false for sensitive flags.
ALTER TABLE "SosCard" ALTER COLUMN "showBloodType" SET DEFAULT false;
ALTER TABLE "SosCard" ALTER COLUMN "showBiologicalSex" SET DEFAULT false;
ALTER TABLE "SosCard" ALTER COLUMN "showHeight" SET DEFAULT false;
ALTER TABLE "SosCard" ALTER COLUMN "showWeight" SET DEFAULT false;
ALTER TABLE "SosCard" ALTER COLUMN "showAllergies" SET DEFAULT false;
ALTER TABLE "SosCard" ALTER COLUMN "showDiagnoses" SET DEFAULT false;
ALTER TABLE "SosCard" ALTER COLUMN "showMedications" SET DEFAULT false;
ALTER TABLE "SosCard" ALTER COLUMN "showImplants" SET DEFAULT false;
ALTER TABLE "SosCard" ALTER COLUMN "showEmergencyContacts" SET DEFAULT false;
ALTER TABLE "SosCard" ALTER COLUMN "showFirstResponderNote" SET DEFAULT false;
ALTER TABLE "SosCard" ALTER COLUMN "showAiSummary" SET DEFAULT false;
-- showDateOfBirth / showPregnancyStatus were already false; showAge / showPreferredLanguage stay true.

-- 2) Existing rows: data-minimise so previously default-true cards stop exposing health data
--    publicly until the patient deliberately re-enables each field. The patient's underlying
--    medical data is NOT touched — only the public-page visibility flags.
UPDATE "SosCard" SET
  "showBloodType"          = false,
  "showBiologicalSex"      = false,
  "showHeight"             = false,
  "showWeight"             = false,
  "showAllergies"          = false,
  "showDiagnoses"          = false,
  "showMedications"        = false,
  "showImplants"           = false,
  "showEmergencyContacts"  = false,
  "showFirstResponderNote" = false,
  "showAiSummary"          = false;
