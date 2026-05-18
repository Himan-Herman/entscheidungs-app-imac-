import { isPatientInboxEnabled, isPracticeInboxEnabled } from "../../config/featureFlags.js";
import { notifyPatientInbox } from "../patientInbox/patientInboxNotify.js";
import { upsertPracticeInboxItem } from "../practiceInbox/practiceInboxService.js";

/**
 * @param {import('@prisma/client').PracticeAppointment} appt
 * @param {'created'|'updated'|'confirmed'|'cancelled'|'rescheduled'|'request'} event
 */
export async function notifyAppointmentEvent(appt, event) {
  const practiceId = appt.practiceProfileId;
  const linkId = appt.practicePatientLinkId;
  const patientUserId = appt.patientUserId;
  const apptUrlPractice = `/practice/calendar?practiceId=${practiceId}&appointmentId=${appt.id}`;
  const apptUrlPatient = `/patient/appointments?appointmentId=${appt.id}`;

  const patientTitles = {
    created: { de: "Neuer Termin von Ihrer Praxis", en: "New appointment from your practice" },
    updated: { de: "Ihr Termin wurde geändert", en: "Your appointment has been updated" },
    confirmed: { de: "Termin bestätigt", en: "Appointment confirmed" },
    cancelled: { de: "Termin abgesagt", en: "Appointment cancelled" },
    rescheduled: { de: "Termin verschoben", en: "Appointment rescheduled" },
    request: { de: "Terminanfrage eingegangen", en: "Appointment request received" },
  };

  const practiceTitles = {
    request: { de: "Neue Terminanfrage", en: "New appointment request" },
    confirmed: { de: "Patient bestätigt Termin", en: "Patient confirmed appointment" },
    cancelled: { de: "Absage angefragt", en: "Cancellation requested" },
    updated: { de: "Termin aktualisiert", en: "Appointment updated" },
  };

  if (patientUserId && isPatientInboxEnabled()) {
    const pt = patientTitles[event] || patientTitles.updated;
    await notifyPatientInbox({
      patientUserId,
      practiceProfileId: practiceId,
      practicePatientLinkId: linkId || undefined,
      type: "system",
      title: pt.de,
      summary: "Organisatorischer Terminhinweis.",
      targetUrl: apptUrlPatient,
      sourceRefType: "appointment",
      sourceRefId: appt.id,
    }).catch(() => {});
  }

  if (isPracticeInboxEnabled()) {
    const pt = practiceTitles[event];
    if (pt) {
      await upsertPracticeInboxItem({
        practiceProfileId: practiceId,
        practicePatientLinkId: linkId || undefined,
        patientUserId: patientUserId || undefined,
        type: "system",
        title: pt.de,
        summary: "Kalender — organisatorischer Hinweis.",
        sourceRefType: "appointment",
        sourceRefId: appt.id,
        targetUrl: apptUrlPractice,
      }).catch(() => {});
    }
  }
}
