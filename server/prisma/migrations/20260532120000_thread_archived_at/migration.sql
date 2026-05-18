-- Add archivedAt to practice patient threads for consistent lifecycle metadata.
ALTER TABLE "PracticePatientThread" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
