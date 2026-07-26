-- Per-type resume points for truncated health syncs.
-- Purely ADDITIVE: one new NULLABLE column. No drops, no renames, no data changes.
ALTER TABLE "WearableConnection" ADD COLUMN "syncCheckpoints" TEXT;
