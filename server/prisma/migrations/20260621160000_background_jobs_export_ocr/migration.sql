-- Async export + OCR job worker fields

ALTER TABLE "ExportJob" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExportJob" ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3);
ALTER TABLE "ExportJob" ADD COLUMN IF NOT EXISTS "processingAt" TIMESTAMP(3);
ALTER TABLE "ExportJob" ADD COLUMN IF NOT EXISTS "locale" TEXT;

ALTER TABLE "DocumentOcrJob" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DocumentOcrJob" ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3);
ALTER TABLE "DocumentOcrJob" ADD COLUMN IF NOT EXISTS "processingAt" TIMESTAMP(3);
ALTER TABLE "DocumentOcrJob" ADD COLUMN IF NOT EXISTS "locale" TEXT;

CREATE INDEX IF NOT EXISTS "ExportJob_status_nextRetryAt_idx"
  ON "ExportJob"("status", "nextRetryAt");

CREATE INDEX IF NOT EXISTS "DocumentOcrJob_status_nextRetryAt_idx"
  ON "DocumentOcrJob"("status", "nextRetryAt");
