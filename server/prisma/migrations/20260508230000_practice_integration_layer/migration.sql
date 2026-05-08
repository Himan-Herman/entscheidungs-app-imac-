-- Practice integration layer: settings shape, secure deliveries, webhook queue, appointment time.

ALTER TABLE "PreVisitSession" ADD COLUMN IF NOT EXISTS "appointmentAt" TIMESTAMP(3);

CREATE TABLE "SecureDocumentDelivery" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "preVisitSessionId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryType" TEXT NOT NULL DEFAULT 'secure_link',

    CONSTRAINT "SecureDocumentDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecureDocumentDelivery_tokenHash_key" ON "SecureDocumentDelivery"("tokenHash");
CREATE INDEX "SecureDocumentDelivery_practiceProfileId_idx" ON "SecureDocumentDelivery"("practiceProfileId");
CREATE INDEX "SecureDocumentDelivery_preVisitSessionId_idx" ON "SecureDocumentDelivery"("preVisitSessionId");

ALTER TABLE "SecureDocumentDelivery" ADD CONSTRAINT "SecureDocumentDelivery_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecureDocumentDelivery" ADD CONSTRAINT "SecureDocumentDelivery_preVisitSessionId_fkey" FOREIGN KEY ("preVisitSessionId") REFERENCES "PreVisitSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecureDocumentDelivery" ADD CONSTRAINT "SecureDocumentDelivery_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PracticeWebhookEvent" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "PracticeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeWebhookEvent_practiceProfileId_status_idx" ON "PracticeWebhookEvent"("practiceProfileId", "status");
CREATE INDEX "PracticeWebhookEvent_createdAt_idx" ON "PracticeWebhookEvent"("createdAt");

ALTER TABLE "PracticeWebhookEvent" ADD CONSTRAINT "PracticeWebhookEvent_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeIntegrationSettings" ADD COLUMN IF NOT EXISTS "webhookSecretHash" TEXT;
ALTER TABLE "PracticeIntegrationSettings" ADD COLUMN IF NOT EXISTS "webhookSecretEnc" TEXT;
ALTER TABLE "PracticeIntegrationSettings" ADD COLUMN IF NOT EXISTS "secureDownloadEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "PracticeIntegrationSettings" DROP COLUMN IF EXISTS "webhookSecret";

ALTER TABLE "PracticeIntegrationSettings" ALTER COLUMN "documentDeliveryMode" SET DEFAULT 'secure_portal';

UPDATE "PracticeIntegrationSettings" SET "documentDeliveryMode" = 'webhook' WHERE "documentDeliveryMode" = 'webhook_later';

UPDATE "PracticeIntegrationSettings" SET "documentDeliveryMode" = 'secure_portal' WHERE "documentDeliveryMode" IS NULL OR "documentDeliveryMode" = '';
