-- Practice calendar / appointments (organizational scheduling)

CREATE TABLE "AppointmentType" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeAvailability" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "appointmentTypeId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeAppointment" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "practicePatientLinkId" TEXT,
    "patientUserId" TEXT,
    "appointmentTypeId" TEXT,
    "preVisitSessionId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "locationType" TEXT NOT NULL DEFAULT 'practice',
    "locationText" TEXT,
    "patientNote" TEXT,
    "practiceNote" TEXT,
    "requestedStartAt" TIMESTAMP(3),
    "requestedEndAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAppointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentType_practiceProfileId_active_idx" ON "AppointmentType"("practiceProfileId", "active");
CREATE INDEX "PracticeAvailability_practiceProfileId_weekday_active_idx" ON "PracticeAvailability"("practiceProfileId", "weekday", "active");
CREATE INDEX "PracticeAppointment_practiceProfileId_startAt_idx" ON "PracticeAppointment"("practiceProfileId", "startAt");
CREATE INDEX "PracticeAppointment_practiceProfileId_status_idx" ON "PracticeAppointment"("practiceProfileId", "status");
CREATE INDEX "PracticeAppointment_patientUserId_startAt_idx" ON "PracticeAppointment"("patientUserId", "startAt");
CREATE INDEX "PracticeAppointment_practicePatientLinkId_idx" ON "PracticeAppointment"("practicePatientLinkId");
CREATE INDEX "AppointmentReminder_appointmentId_status_idx" ON "AppointmentReminder"("appointmentId", "status");
CREATE INDEX "AppointmentReminder_sendAt_status_idx" ON "AppointmentReminder"("sendAt", "status");

ALTER TABLE "AppointmentType" ADD CONSTRAINT "AppointmentType_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeAvailability" ADD CONSTRAINT "PracticeAvailability_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeAvailability" ADD CONSTRAINT "PracticeAvailability_appointmentTypeId_fkey" FOREIGN KEY ("appointmentTypeId") REFERENCES "AppointmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticeAppointment" ADD CONSTRAINT "PracticeAppointment_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeAppointment" ADD CONSTRAINT "PracticeAppointment_practicePatientLinkId_fkey" FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticeAppointment" ADD CONSTRAINT "PracticeAppointment_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticeAppointment" ADD CONSTRAINT "PracticeAppointment_appointmentTypeId_fkey" FOREIGN KEY ("appointmentTypeId") REFERENCES "AppointmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticeAppointment" ADD CONSTRAINT "PracticeAppointment_preVisitSessionId_fkey" FOREIGN KEY ("preVisitSessionId") REFERENCES "PreVisitSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticeAppointment" ADD CONSTRAINT "PracticeAppointment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticeAppointment" ADD CONSTRAINT "PracticeAppointment_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "PracticeAppointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
