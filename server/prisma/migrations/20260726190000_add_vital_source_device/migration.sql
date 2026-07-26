-- Coarse device category for imported vital readings (display only).
-- Purely ADDITIVE: one new NULLABLE column. No drops, no renames, no data changes.
-- Existing rows keep sourceDevice = NULL and are shown with the neutral platform label.
ALTER TABLE "VitalEntry" ADD COLUMN "sourceDevice" VARCHAR(40);
