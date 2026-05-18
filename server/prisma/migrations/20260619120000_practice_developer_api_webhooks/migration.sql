-- Practice developer API clients & webhooks

CREATE TABLE "PracticeApiClient" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tokenHash" TEXT NOT NULL,
    "scopesJson" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeApiClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "secretHash" TEXT NOT NULL,
    "secretEnc" TEXT,
    "eventTypesJson" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeWebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastStatusCode" INTEGER,
    "lastErrorCode" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeApiAuditEvent" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "apiClientId" TEXT,
    "action" TEXT NOT NULL,
    "endpoint" TEXT,
    "statusCode" INTEGER,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeApiAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeApiClient_tokenHash_key" ON "PracticeApiClient"("tokenHash");
CREATE UNIQUE INDEX "PracticeWebhookDelivery_eventId_key" ON "PracticeWebhookDelivery"("eventId");
CREATE INDEX "PracticeApiClient_practiceProfileId_status_idx" ON "PracticeApiClient"("practiceProfileId", "status");
CREATE INDEX "PracticeWebhookEndpoint_practiceProfileId_status_idx" ON "PracticeWebhookEndpoint"("practiceProfileId", "status");
CREATE INDEX "PracticeWebhookDelivery_endpointId_status_idx" ON "PracticeWebhookDelivery"("endpointId", "status");
CREATE INDEX "PracticeWebhookDelivery_practiceProfileId_createdAt_idx" ON "PracticeWebhookDelivery"("practiceProfileId", "createdAt");
CREATE INDEX "PracticeWebhookDelivery_nextRetryAt_idx" ON "PracticeWebhookDelivery"("nextRetryAt");
CREATE INDEX "PracticeApiAuditEvent_practiceProfileId_createdAt_idx" ON "PracticeApiAuditEvent"("practiceProfileId", "createdAt");
CREATE INDEX "PracticeApiAuditEvent_apiClientId_idx" ON "PracticeApiAuditEvent"("apiClientId");

ALTER TABLE "PracticeApiClient" ADD CONSTRAINT "PracticeApiClient_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeApiClient" ADD CONSTRAINT "PracticeApiClient_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticeWebhookEndpoint" ADD CONSTRAINT "PracticeWebhookEndpoint_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeWebhookEndpoint" ADD CONSTRAINT "PracticeWebhookEndpoint_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticeWebhookDelivery" ADD CONSTRAINT "PracticeWebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "PracticeWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeWebhookDelivery" ADD CONSTRAINT "PracticeWebhookDelivery_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeApiAuditEvent" ADD CONSTRAINT "PracticeApiAuditEvent_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeApiAuditEvent" ADD CONSTRAINT "PracticeApiAuditEvent_apiClientId_fkey" FOREIGN KEY ("apiClientId") REFERENCES "PracticeApiClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
