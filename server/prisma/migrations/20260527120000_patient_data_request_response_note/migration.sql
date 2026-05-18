-- Optional practice response note on patient data requests (organizational only).

ALTER TABLE "PatientDataRequest" ADD COLUMN IF NOT EXISTS "responseNote" TEXT;
