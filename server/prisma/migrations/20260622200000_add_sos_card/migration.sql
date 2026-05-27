-- CreateTable
CREATE TABLE IF NOT EXISTS "SosCard" (
    "id" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "bloodType" VARCHAR(10),
    "emergencyContact1Name" VARCHAR(120),
    "emergencyContact1Phone" VARCHAR(40),
    "emergencyContact2Name" VARCHAR(120),
    "emergencyContact2Phone" VARCHAR(40),
    "firstResponderNote" TEXT,
    "aiSummary" TEXT,
    "aiSummaryUpdatedAt" TIMESTAMP(3),
    "publicToken" VARCHAR(80),
    "tokenGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SosCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SosCard_patientUserId_key" ON "SosCard"("patientUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SosCard_publicToken_key" ON "SosCard"("publicToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SosCard_publicToken_idx" ON "SosCard"("publicToken");

-- AddForeignKey
ALTER TABLE "SosCard" ADD CONSTRAINT "SosCard_patientUserId_fkey"
    FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
