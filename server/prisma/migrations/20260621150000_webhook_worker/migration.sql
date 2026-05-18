-- Webhook worker: retry scheduling, processing lock, safe payload snapshot (developer)

ALTER TABLE "PracticeWebhookEvent" ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3);
ALTER TABLE "PracticeWebhookEvent" ADD COLUMN IF NOT EXISTS "processingAt" TIMESTAMP(3);
ALTER TABLE "PracticeWebhookEvent" ADD COLUMN IF NOT EXISTS "lastStatusCode" INTEGER;

ALTER TABLE "PracticeWebhookDelivery" ADD COLUMN IF NOT EXISTS "processingAt" TIMESTAMP(3);
ALTER TABLE "PracticeWebhookDelivery" ADD COLUMN IF NOT EXISTS "payloadJson" JSONB;
ALTER TABLE "PracticeWebhookDelivery" ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 5;

CREATE INDEX IF NOT EXISTS "PracticeWebhookEvent_status_nextRetryAt_idx"
  ON "PracticeWebhookEvent"("status", "nextRetryAt");

CREATE INDEX IF NOT EXISTS "PracticeWebhookDelivery_status_nextRetryAt_idx"
  ON "PracticeWebhookDelivery"("status", "nextRetryAt");
