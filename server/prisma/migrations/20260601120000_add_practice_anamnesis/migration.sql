-- Add anamnesisEnabled flag to PracticeProfile
ALTER TABLE "public"."PracticeProfile" ADD COLUMN IF NOT EXISTS "anamnesisEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: PracticeAnamnesisTemplate
CREATE TABLE IF NOT EXISTS "public"."PracticeAnamnesisTemplate" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "titleJson" JSONB NOT NULL,
    "descriptionJson" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAnamnesisTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PracticeAnamnesisQuestion
CREATE TABLE IF NOT EXISTS "public"."PracticeAnamnesisQuestion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "labelJson" JSONB NOT NULL,
    "hintJson" JSONB,
    "optionsJson" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAnamnesisQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PracticeAnamnesisTemplate_practiceProfileId_status_idx"
    ON "public"."PracticeAnamnesisTemplate"("practiceProfileId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PracticeAnamnesisQuestion_templateId_idx"
    ON "public"."PracticeAnamnesisQuestion"("templateId");

-- AddForeignKey
ALTER TABLE "public"."PracticeAnamnesisTemplate"
    ADD CONSTRAINT "PracticeAnamnesisTemplate_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId")
    REFERENCES "public"."PracticeProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PracticeAnamnesisQuestion"
    ADD CONSTRAINT "PracticeAnamnesisQuestion_templateId_fkey"
    FOREIGN KEY ("templateId")
    REFERENCES "public"."PracticeAnamnesisTemplate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
