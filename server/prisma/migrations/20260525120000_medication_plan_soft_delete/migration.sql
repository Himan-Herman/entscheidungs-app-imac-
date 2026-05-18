-- Medication plan v2: optional note + soft delete metadata.

ALTER TABLE "MedicationPlan" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "MedicationPlan" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "MedicationPlan" ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_deletedByUserId_fkey"
    FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
