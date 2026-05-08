-- Privacy-preserving product analytics (hashes + JSON metadata allowlist enforced in application code).

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "userHash" TEXT,
    "practiceHash" TEXT,
    "sessionHash" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
CREATE INDEX "AnalyticsEvent_practiceHash_eventType_idx" ON "AnalyticsEvent"("practiceHash", "eventType");
CREATE INDEX "AnalyticsEvent_practiceHash_createdAt_idx" ON "AnalyticsEvent"("practiceHash", "createdAt");
