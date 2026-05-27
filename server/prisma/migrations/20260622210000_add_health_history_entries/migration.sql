-- CreateTable: AllergyEntry
CREATE TABLE IF NOT EXISTS "public"."AllergyEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allergen" VARCHAR(200) NOT NULL,
    "allergyType" VARCHAR(40) NOT NULL,
    "severity" VARCHAR(40) NOT NULL,
    "reaction" TEXT,
    "diagnosedDate" TIMESTAMP(3),
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllergyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DiagnosisEntry
CREATE TABLE IF NOT EXISTS "public"."DiagnosisEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conditionName" VARCHAR(300) NOT NULL,
    "icdCode" VARCHAR(20),
    "diagnosedDate" TIMESTAMP(3),
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "treatingDoctor" VARCHAR(200),
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosisEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AllergyEntry_userId_status_idx" ON "public"."AllergyEntry"("userId", "status");
CREATE INDEX IF NOT EXISTS "AllergyEntry_userId_deletedAt_idx" ON "public"."AllergyEntry"("userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "DiagnosisEntry_userId_status_idx" ON "public"."DiagnosisEntry"("userId", "status");
CREATE INDEX IF NOT EXISTS "DiagnosisEntry_userId_deletedAt_idx" ON "public"."DiagnosisEntry"("userId", "deletedAt");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AllergyEntry_userId_fkey') THEN
    ALTER TABLE "public"."AllergyEntry" ADD CONSTRAINT "AllergyEntry_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiagnosisEntry_userId_fkey') THEN
    ALTER TABLE "public"."DiagnosisEntry" ADD CONSTRAINT "DiagnosisEntry_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
