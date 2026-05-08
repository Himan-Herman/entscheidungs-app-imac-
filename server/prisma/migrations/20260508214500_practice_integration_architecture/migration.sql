-- Practice integration architecture (future-ready; no live third-party traffic from this migration).

ALTER TABLE "PreVisitSession" ADD COLUMN "appointmentReference" TEXT;

CREATE TABLE "PracticeIntegrationSettings" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "calendarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "calendarProvider" TEXT,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "documentDeliveryMode" TEXT NOT NULL DEFAULT 'download_only',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeIntegrationSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeIntegrationSettings_practiceProfileId_key" ON "PracticeIntegrationSettings"("practiceProfileId");

ALTER TABLE "PracticeIntegrationSettings" ADD CONSTRAINT "PracticeIntegrationSettings_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
