-- AddTable: BillingPlausibilitySession
-- Additive only. No changes to existing tables.
-- Scalar FKs used (no ON DELETE CASCADE to PracticeProfile) to keep this fully additive.
-- status: pending | reviewed | dismissed
-- sourceType: manual | upload | api
-- disclaimerVersion: semver string of the disclaimer accepted at submission time.

CREATE TABLE "BillingPlausibilitySession" (
    "id"                TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "createdByUserId"   TEXT NOT NULL,
    "status"            VARCHAR(20) NOT NULL DEFAULT 'pending',
    "sourceType"        VARCHAR(20) NOT NULL DEFAULT 'manual',
    "inputSummaryJson"  JSONB NOT NULL,
    "resultSummaryJson" JSONB,
    "disclaimerVersion" VARCHAR(20) NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    "dismissedAt"       TIMESTAMP(3),

    CONSTRAINT "BillingPlausibilitySession_pkey" PRIMARY KEY ("id")
);

-- AddTable: BillingPlausibilityItem
-- One row per GOÄ ziffer submitted in a session.
-- factor stored as VARCHAR to preserve original input format (e.g. "2,3").
-- warningsJson: deterministic warning codes only — no AI output in Phase D.

CREATE TABLE "BillingPlausibilityItem" (
    "id"                 TEXT NOT NULL,
    "sessionId"          TEXT NOT NULL,
    "ziffer"             VARCHAR(20) NOT NULL,
    "factor"             VARCHAR(10) NOT NULL,
    "count"              INTEGER NOT NULL,
    "contextText"        VARCHAR(600),
    "catalogueMatchJson" JSONB,
    "warningsJson"       JSONB,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPlausibilityItem_pkey" PRIMARY KEY ("id")
);

-- AddTable: BillingPlausibilityAuditLog
-- Immutable append-only audit trail for session lifecycle events.
-- action: created | dismissed | reviewed

CREATE TABLE "BillingPlausibilityAuditLog" (
    "id"           TEXT NOT NULL,
    "sessionId"    TEXT NOT NULL,
    "actorUserId"  TEXT,
    "action"       VARCHAR(40) NOT NULL,
    "metadataJson" JSONB,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPlausibilityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: BillingPlausibilitySession
CREATE INDEX "BillingPlausibilitySession_practiceProfileId_createdAt_idx"
    ON "BillingPlausibilitySession"("practiceProfileId", "createdAt");

CREATE INDEX "BillingPlausibilitySession_practiceProfileId_status_idx"
    ON "BillingPlausibilitySession"("practiceProfileId", "status");

CREATE INDEX "BillingPlausibilitySession_createdByUserId_idx"
    ON "BillingPlausibilitySession"("createdByUserId");

-- CreateIndex: BillingPlausibilityItem
CREATE INDEX "BillingPlausibilityItem_sessionId_idx"
    ON "BillingPlausibilityItem"("sessionId");

CREATE INDEX "BillingPlausibilityItem_ziffer_idx"
    ON "BillingPlausibilityItem"("ziffer");

-- AddForeignKey: BillingPlausibilityItem → BillingPlausibilitySession
ALTER TABLE "BillingPlausibilityItem"
    ADD CONSTRAINT "BillingPlausibilityItem_sessionId_fkey"
    FOREIGN KEY ("sessionId")
    REFERENCES "BillingPlausibilitySession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: BillingPlausibilityAuditLog
CREATE INDEX "BillingPlausibilityAuditLog_sessionId_createdAt_idx"
    ON "BillingPlausibilityAuditLog"("sessionId", "createdAt");

CREATE INDEX "BillingPlausibilityAuditLog_actorUserId_idx"
    ON "BillingPlausibilityAuditLog"("actorUserId");

-- AddForeignKey: BillingPlausibilityAuditLog → BillingPlausibilitySession
ALTER TABLE "BillingPlausibilityAuditLog"
    ADD CONSTRAINT "BillingPlausibilityAuditLog_sessionId_fkey"
    FOREIGN KEY ("sessionId")
    REFERENCES "BillingPlausibilitySession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
