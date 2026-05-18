-- PVS/FHIR/HL7 integration layer (MVP: architecture + sandbox; no production sync by default)

CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "connectorKey" TEXT NOT NULL DEFAULT 'custom_placeholder',
    "vendorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disabled',
    "baseUrl" TEXT,
    "authType" TEXT DEFAULT 'none',
    "configJson" JSONB,
    "fhirVersion" TEXT DEFAULT 'R4',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationJob" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resourceType" TEXT,
    "practicePatientLinkId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationMapping" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "connectionId" TEXT,
    "sourceType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "mappingJson" JSONB NOT NULL,
    "version" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalResourceReference" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "practicePatientLinkId" TEXT,
    "patientUserId" TEXT,
    "localResourceType" TEXT NOT NULL,
    "localResourceId" TEXT NOT NULL,
    "externalSystemType" TEXT NOT NULL,
    "externalResourceType" TEXT NOT NULL,
    "externalResourceId" TEXT NOT NULL,
    "externalVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalResourceReference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationConnection_practiceProfileId_status_idx" ON "IntegrationConnection"("practiceProfileId", "status");
CREATE INDEX "IntegrationConnection_practiceProfileId_type_idx" ON "IntegrationConnection"("practiceProfileId", "type");

CREATE INDEX "IntegrationJob_practiceProfileId_createdAt_idx" ON "IntegrationJob"("practiceProfileId", "createdAt");
CREATE INDEX "IntegrationJob_connectionId_status_idx" ON "IntegrationJob"("connectionId", "status");

CREATE INDEX "IntegrationMapping_practiceProfileId_active_idx" ON "IntegrationMapping"("practiceProfileId", "active");
CREATE INDEX "IntegrationMapping_connectionId_idx" ON "IntegrationMapping"("connectionId");

CREATE INDEX "ExternalResourceReference_practiceProfileId_localResourceType_localResourceId_idx" ON "ExternalResourceReference"("practiceProfileId", "localResourceType", "localResourceId");
CREATE INDEX "ExternalResourceReference_practicePatientLinkId_idx" ON "ExternalResourceReference"("practicePatientLinkId");
CREATE INDEX "ExternalResourceReference_externalSystemType_externalResourceId_idx" ON "ExternalResourceReference"("externalSystemType", "externalResourceId");

ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IntegrationJob" ADD CONSTRAINT "IntegrationJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationJob" ADD CONSTRAINT "IntegrationJob_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntegrationMapping" ADD CONSTRAINT "IntegrationMapping_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationMapping" ADD CONSTRAINT "IntegrationMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExternalResourceReference" ADD CONSTRAINT "ExternalResourceReference_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
