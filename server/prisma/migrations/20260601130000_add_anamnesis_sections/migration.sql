-- CreateTable: PracticeAnamnesisSection
CREATE TABLE IF NOT EXISTS "public"."PracticeAnamnesisSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "titleJson" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAnamnesisSection_pkey" PRIMARY KEY ("id")
);

-- Add sectionId to PracticeAnamnesisQuestion
ALTER TABLE "public"."PracticeAnamnesisQuestion"
    ADD COLUMN IF NOT EXISTS "sectionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PracticeAnamnesisSection_templateId_idx"
    ON "public"."PracticeAnamnesisSection"("templateId");

CREATE INDEX IF NOT EXISTS "PracticeAnamnesisQuestion_sectionId_idx"
    ON "public"."PracticeAnamnesisQuestion"("sectionId");

-- AddForeignKey
ALTER TABLE "public"."PracticeAnamnesisSection"
    ADD CONSTRAINT "PracticeAnamnesisSection_templateId_fkey"
    FOREIGN KEY ("templateId")
    REFERENCES "public"."PracticeAnamnesisTemplate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."PracticeAnamnesisQuestion"
    ADD CONSTRAINT "PracticeAnamnesisQuestion_sectionId_fkey"
    FOREIGN KEY ("sectionId")
    REFERENCES "public"."PracticeAnamnesisSection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
