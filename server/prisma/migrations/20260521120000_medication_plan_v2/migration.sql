-- PR-6: relationship-based medication plans (v2).

CREATE TABLE "MedicationPlan" (
    "id" TEXT NOT NULL,
    "practicePatientLinkId" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "createdByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicationPlanItem" (
    "id" TEXT NOT NULL,
    "medicationPlanId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "schedule" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "instructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MedicationPlan_practicePatientLinkId_status_idx"
    ON "MedicationPlan"("practicePatientLinkId", "status");

CREATE INDEX "MedicationPlan_patientUserId_status_idx"
    ON "MedicationPlan"("patientUserId", "status");

CREATE INDEX "MedicationPlan_practiceProfileId_version_idx"
    ON "MedicationPlan"("practiceProfileId", "version");

CREATE INDEX "MedicationPlanItem_medicationPlanId_sortOrder_idx"
    ON "MedicationPlanItem"("medicationPlanId", "sortOrder");

ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_practicePatientLinkId_fkey"
    FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_patientUserId_fkey"
    FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MedicationPlanItem" ADD CONSTRAINT "MedicationPlanItem_medicationPlanId_fkey"
    FOREIGN KEY ("medicationPlanId") REFERENCES "MedicationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
