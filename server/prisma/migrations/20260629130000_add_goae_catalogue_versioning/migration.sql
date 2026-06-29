-- Billing-2: versioned GOÄ reference catalogue (additive only).
-- Reference data only — NO patient data, NO billing records, NO clinical free-text.
-- Adds two NEW tables + indexes + one FK. No existing table is altered, renamed or dropped.

-- CreateTable
CREATE TABLE "GoaeCatalogueVersion" (
    "id" TEXT NOT NULL,
    "codeSystem" VARCHAR(20) NOT NULL DEFAULT 'GOAE',
    "label" VARCHAR(120) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "completeness" VARCHAR(40) NOT NULL,
    "source" VARCHAR(300),
    "sourceUrl" VARCHAR(300),
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "notes" VARCHAR(600),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoaeCatalogueVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoaeCatalogueItem" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "points" INTEGER,
    "section" VARCHAR(20),
    "activeStatus" VARCHAR(20),
    "completenessStatus" VARCHAR(30),
    "sourceName" VARCHAR(200),
    "sourceUrl" VARCHAR(300),
    "sourceReference" VARCHAR(200),
    "sourceVersionDate" VARCHAR(20),
    "notes" VARCHAR(800),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoaeCatalogueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoaeCatalogueVersion_codeSystem_status_idx" ON "GoaeCatalogueVersion"("codeSystem", "status");

-- CreateIndex
CREATE INDEX "GoaeCatalogueVersion_status_idx" ON "GoaeCatalogueVersion"("status");

-- CreateIndex
CREATE INDEX "GoaeCatalogueItem_versionId_idx" ON "GoaeCatalogueItem"("versionId");

-- CreateIndex
CREATE INDEX "GoaeCatalogueItem_code_idx" ON "GoaeCatalogueItem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GoaeCatalogueItem_versionId_code_key" ON "GoaeCatalogueItem"("versionId", "code");

-- AddForeignKey
ALTER TABLE "GoaeCatalogueItem" ADD CONSTRAINT "GoaeCatalogueItem_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GoaeCatalogueVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
