-- AlterTable
ALTER TABLE "public"."PreVisitSession" ADD COLUMN     "preVisitCaseId" TEXT;

-- CreateTable
CREATE TABLE "public"."PreVisitCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PreVisitCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreVisitCase_userId_idx" ON "public"."PreVisitCase"("userId");

-- CreateIndex
CREATE INDEX "PreVisitSession_preVisitCaseId_idx" ON "public"."PreVisitSession"("preVisitCaseId");

-- AddForeignKey
ALTER TABLE "public"."PreVisitCase" ADD CONSTRAINT "PreVisitCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PreVisitSession" ADD CONSTRAINT "PreVisitSession_preVisitCaseId_fkey" FOREIGN KEY ("preVisitCaseId") REFERENCES "public"."PreVisitCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
