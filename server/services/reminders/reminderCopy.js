/**
 * Organizational reminder copy only — no medical content.
 */

const COPY = {
  patient_appointment_24h_inbox: {
    de: {
      title: "Erinnerung: Termin morgen",
      summary: "Sie haben morgen einen Termin bei Ihrer Praxis. Bitte prüfen Sie die Details in der App.",
    },
    en: {
      title: "Reminder: appointment tomorrow",
      summary: "You have an appointment with your practice tomorrow. Please check the details in the app.",
    },
  },
  patient_appointment_24h_system: {
    de: {
      title: "Terminerinnerung",
      summary: "Organisatorischer Hinweis zu Ihrem bevorstehenden Termin.",
    },
    en: {
      title: "Appointment reminder",
      summary: "Organizational notice about your upcoming appointment.",
    },
  },
  patient_video_1h_inbox: {
    de: {
      title: "Videosprechstunde in Kürze",
      summary: "Ihre Videosprechstunde beginnt bald. Bitte öffnen Sie den Termin in der App.",
    },
    en: {
      title: "Video consultation soon",
      summary: "Your video consultation starts soon. Please open the appointment in the app.",
    },
  },
  patient_video_15m_inbox: {
    de: {
      title: "Videosprechstunde beginnt bald",
      summary: "Ihre Videosprechstunde startet in Kürze. Bitte bereiten Sie sich organisatorisch vor.",
    },
    en: {
      title: "Video consultation starting soon",
      summary: "Your video consultation is starting soon. Please prepare to join when ready.",
    },
  },
  patient_follow_up_nudge_inbox: {
    de: {
      title: "Rückfrage offen",
      summary: "Ihre Praxis hat eine organisatorische Rückfrage gestellt. Bitte antworten Sie, wenn möglich.",
    },
    en: {
      title: "Follow-up question open",
      summary: "Your practice has an organizational follow-up question. Please reply when you can.",
    },
  },
  patient_appointment_24h_email: {
    de: {
      title: "Erinnerung: Termin morgen",
      summary: "Organisatorischer Hinweis zu Ihrem Termin (E-Mail).",
    },
    en: {
      title: "Reminder: appointment tomorrow",
      summary: "Organizational notice about your appointment (email).",
    },
  },
  practice_appointment_24h_inbox: {
    de: {
      title: "Termin morgen",
      summary: "Organisatorische Erinnerung: Ein bestätigter Termin findet morgen statt.",
    },
    en: {
      title: "Appointment tomorrow",
      summary: "Organizational reminder: a confirmed appointment is scheduled for tomorrow.",
    },
  },
};

/**
 * @param {string} templateKey
 * @param {string} [locale]
 */
export function reminderCopyForTemplate(templateKey, locale) {
  const lang = String(locale || "de").toLowerCase().startsWith("en") ? "en" : "de";
  const row = COPY[templateKey];
  if (!row) {
    return {
      title: lang === "en" ? "Practice reminder" : "Praxis-Erinnerung",
      summary:
        lang === "en"
          ? "Organizational reminder from your practice."
          : "Organisatorische Erinnerung Ihrer Praxis.",
    };
  }
  return row[lang];
}
