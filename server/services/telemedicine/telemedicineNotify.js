import { isPatientInboxEnabled, isPracticeInboxEnabled } from "../../config/featureFlags.js";
import { notifyPatientInbox } from "../patientInbox/patientInboxNotify.js";
import { upsertPracticeInboxItem } from "../practiceInbox/practiceInboxService.js";

/**
 * @param {import('@prisma/client').TelemedicineSession} session
 * @param {'created'|'consent'|'waiting'|'link'|'completed'|'cancelled'|'closed'} event
 */
export async function notifyTelemedicineEvent(session, event) {
  const practiceId = session.practiceProfileId;
  const patientUserId = session.patientUserId;
  const targetPatient = `/patient/telemedicine/${session.id}`;
  const targetPractice = `/practice/telemedicine/${session.id}`;

  const patientTitles = {
    created: { de: "Neuer Video-Termin", en: "New video appointment" },
    link: { de: "Video-Link verfügbar", en: "Video link available" },
    completed: { de: "Videosprechstunde abgeschlossen", en: "Video consultation completed" },
    cancelled: { de: "Video-Termin geändert", en: "Video appointment updated" },
    closed: {
      de: "Ihre Videosprechstunde wurde geschlossen.",
      en: "Your video consultation has been closed.",
    },
  };

  const practiceTitles = {
    waiting: { de: "Patient wartet im Warteraum", en: "Patient waiting in waiting room" },
    consent: { de: "Video-Consent bestätigt", en: "Video consent confirmed" },
  };

  if (patientUserId && isPatientInboxEnabled()) {
    const pt = patientTitles[event];
    if (pt) {
      await notifyPatientInbox({
        patientUserId,
        practiceProfileId: practiceId,
        practicePatientLinkId: session.practicePatientLinkId || undefined,
        type: "system",
        title: pt.de,
        summary:
          event === "closed"
            ? pt.de
            : "Organisatorischer Video-Hinweis.",
        targetUrl: targetPatient,
        sourceRefType: "telemedicine_session",
        sourceRefId: session.id,
        titleKey: `telemedicine_${event}`,
      }).catch(() => {});
    }
  }

  if (isPracticeInboxEnabled()) {
    const pt = practiceTitles[event];
    if (pt) {
      await upsertPracticeInboxItem({
        practiceProfileId: practiceId,
        practicePatientLinkId: session.practicePatientLinkId || undefined,
        patientUserId: patientUserId || undefined,
        type: "system",
        title: pt.de,
        summary: "Videosprechstunde — organisatorisch.",
        sourceRefType: "telemedicine_session",
        sourceRefId: session.id,
        targetUrl: targetPractice,
      }).catch(() => {});
    }
  }
}
