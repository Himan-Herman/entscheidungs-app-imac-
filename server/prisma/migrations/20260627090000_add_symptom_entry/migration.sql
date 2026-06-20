-- CreateTable
CREATE TABLE "public"."SymptomEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symptom" VARCHAR(200) NOT NULL,
    "severity" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "durationText" VARCHAR(120),
    "bodyRegion" VARCHAR(120),
    "trigger" VARCHAR(300),
    "betterWith" VARCHAR(300),
    "worseWith" VARCHAR(300),
    "measuresText" VARCHAR(300),
    "notes" TEXT,
    "source" VARCHAR(40) NOT NULL DEFAULT 'manual',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymptomEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SymptomEntry_userId_occurredAt_idx" ON "public"."SymptomEntry"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "SymptomEntry_userId_deletedAt_idx" ON "public"."SymptomEntry"("userId", "deletedAt");

-- AddForeignKey
ALTER TABLE "public"."SymptomEntry" ADD CONSTRAINT "SymptomEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

