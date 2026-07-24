-- Wearable / health-data connections (Phase 0, provider-neutral).
-- Purely ADDITIVE: one new table + two new NULLABLE columns on "VitalEntry".
-- No table/column drops, no renames, no data deletion, no default backfill needed.
-- Existing manual vital entries keep sourceProvider = NULL and externalId = NULL.

-- 1) Provenance columns on existing vital entries (nullable; manual rows stay NULL).
ALTER TABLE "VitalEntry" ADD COLUMN "sourceProvider" VARCHAR(40);
ALTER TABLE "VitalEntry" ADD COLUMN "externalId" VARCHAR(191);

-- Idempotent imports: a given provider value is stored at most once per user.
-- Postgres treats NULLs as distinct, so manual rows (both NULL) never collide.
CREATE UNIQUE INDEX "VitalEntry_userId_sourceProvider_externalId_key"
  ON "VitalEntry" ("userId", "sourceProvider", "externalId");

-- 2) New table: patient-owned wearable connections (no OAuth secrets stored here).
CREATE TABLE "WearableConnection" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "provider"       VARCHAR(40) NOT NULL,
  "status"         VARCHAR(20) NOT NULL DEFAULT 'connected',
  "scopes"         TEXT,
  "consentAt"      TIMESTAMP(3),
  "lastSyncedAt"   TIMESTAMP(3),
  "lastError"      VARCHAR(300),
  "disconnectedAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WearableConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WearableConnection_userId_provider_key"
  ON "WearableConnection" ("userId", "provider");
CREATE INDEX "WearableConnection_userId_idx"
  ON "WearableConnection" ("userId");

ALTER TABLE "WearableConnection"
  ADD CONSTRAINT "WearableConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
