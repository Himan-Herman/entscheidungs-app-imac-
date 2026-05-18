import { emitPracticeDeveloperWebhook } from "./practiceDeveloperWebhookService.js";
import { PracticeDeveloperWebhookEvent } from "../../constants/practiceDeveloperApi.js";

export function emitDocumentShared(doc) {
  return emitPracticeDeveloperWebhook(doc.practiceProfileId, PracticeDeveloperWebhookEvent.DOCUMENT_SHARED, {
    resourceType: "practice_document",
    resourceId: doc.id,
    practicePatientLinkId: doc.practicePatientLinkId,
    patientUserId: doc.patientUserId,
  });
}

export function emitDocumentRevoked(doc) {
  return emitPracticeDeveloperWebhook(doc.practiceProfileId, PracticeDeveloperWebhookEvent.DOCUMENT_REVOKED, {
    resourceType: "practice_document",
    resourceId: doc.id,
    practicePatientLinkId: doc.practicePatientLinkId,
    patientUserId: doc.patientUserId,
  });
}

export function emitAppointmentCreated(appointment) {
  return emitPracticeDeveloperWebhook(
    appointment.practiceProfileId,
    PracticeDeveloperWebhookEvent.APPOINTMENT_CREATED,
    {
      resourceType: "practice_appointment",
      resourceId: appointment.id,
      practicePatientLinkId: appointment.practicePatientLinkId,
      patientUserId: appointment.patientUserId,
    },
  );
}
