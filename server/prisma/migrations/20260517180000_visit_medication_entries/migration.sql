-- Practice-entered post-visit medication / intake plans (documentation only).

CREATE TABLE "VisitMedicationEntry" (
    "id" TEXT NOT NULL,
    "preVisitSessionId" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT NOT NULL,
    "intakeInstructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "patientViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitMedicationEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VisitMedicationEntry" ADD CONSTRAINT "VisitMedicationEntry_preVisitSessionId_fkey" FOREIGN KEY ("preVisitSessionId") REFERENCES "PreVisitSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitMedicationEntry" ADD CONSTRAINT "VisitMedicationEntry_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitMedicationEntry" ADD CONSTRAINT "VisitMedicationEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "VisitMedicationEntry_preVisitSessionId_publishedAt_idx" ON "VisitMedicationEntry"("preVisitSessionId", "publishedAt");
CREATE INDEX "VisitMedicationEntry_practiceProfileId_idx" ON "VisitMedicationEntry"("practiceProfileId");
CREATE INDEX "VisitMedicationEntry_createdByUserId_idx" ON "VisitMedicationEntry"("createdByUserId");
