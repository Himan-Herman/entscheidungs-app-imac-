/**
 * Neutral inbox copy — no clinical content, no urgency wording.
 * titleKey maps to client i18n: patientInbox.titles.* / practiceInbox.titles.*
 */

export const PATIENT_INBOX_TITLES = {
  message: {
    titleKey: "message",
    titleDe: "Neue Nachricht von Ihrer Praxis",
    titleEn: "New message from your practice",
  },
  document: {
    titleKey: "document",
    titleDe: "Neues Dokument von Ihrer Praxis",
    titleEn: "New document from your practice",
  },
  medication: {
    titleKey: "medication",
    titleDe: "Neue Medikationsinformation von Ihrer Praxis",
    titleEn: "New medication information from your practice",
  },
  profile: {
    titleKey: "profile",
    titleDe: "Neue Information zu Ihrer Profilfreigabe",
    titleEn: "New information about your profile sharing",
  },
  data_request: {
    titleKey: "data_request",
    titleDe: "Aktualisierung zu Ihrer Datenanfrage",
    titleEn: "Update on your data request",
  },
  system: {
    titleKey: "system",
    titleDe: "Neue Information von Ihrer Praxis",
    titleEn: "New information from your practice",
  },
};

export const PRACTICE_INBOX_TITLES = {
  message: {
    titleKey: "message",
    titleDe: "Neue Patientennachricht",
    titleEn: "New patient message",
    summaryDe: "Neue Nachricht im sicheren Bereich.",
    summaryEn: "New message in the secure workspace.",
  },
  document: {
    titleKey: "document_question",
    titleDe: "Rückfrage zu einem Praxisdokument",
    titleEn: "Question about a practice document",
    summaryDe: "Patient:in hat eine Rückfrage gestellt.",
    summaryEn: "Patient asked a question.",
  },
  medication: {
    titleKey: "medication_question",
    titleDe: "Rückfrage zu einer Medikationsinformation",
    titleEn: "Question about medication information",
    summaryDe: "Patient:in hat eine Rückfrage gestellt.",
    summaryEn: "Patient asked a question.",
  },
  data_request: {
    titleKey: "data_request",
    titleDe: "Patienten-Datenanfrage",
    titleEn: "Patient data request",
    summaryDe: "Bitte organisatorisch prüfen.",
    summaryEn: "Please review operationally.",
  },
  profile: {
    titleKey: "profile_revoked",
    titleDe: "Profilfreigabe widerrufen",
    titleEn: "Profile sharing revoked",
    summaryDe: "Patient:in hat die Profilfreigabe beendet.",
    summaryEn: "Patient ended profile sharing.",
  },
  previsit: {
    titleKey: "previsit",
    titleDe: "Neue Pre-Visit-Vorbereitung",
    titleEn: "New Pre-Visit preparation",
    summaryDe: "Eine Vorbereitung wurde eingereicht.",
    summaryEn: "A preparation was submitted.",
  },
  follow_up: {
    titleKey: "follow_up",
    titleDe: "Neue Pre-Visit-Rückfrage",
    titleEn: "New Pre-Visit follow-up reply",
    summaryDe: "Patient:in hat geantwortet.",
    summaryEn: "Patient replied.",
  },
  system: {
    titleKey: "system",
    titleDe: "Neuer Praxis-Hinweis",
    titleEn: "New practice notice",
    summaryDe: "Organisatorischer Hinweis.",
    summaryEn: "Organizational notice.",
  },
};

/**
 * @param {string} [lang]
 */
export function isEnglishLocale(lang) {
  return String(lang || "").toLowerCase().startsWith("en");
}

/**
 * @param {string} type
 * @param {string} [lang]
 */
export function patientInboxTitleForType(type, lang) {
  const row = PATIENT_INBOX_TITLES[type] || PATIENT_INBOX_TITLES.system;
  return isEnglishLocale(lang) ? row.titleEn : row.titleDe;
}

/**
 * @param {string} type
 * @param {string} [lang]
 */
export function practiceInboxCopyForType(type, lang) {
  const row = PRACTICE_INBOX_TITLES[type] || PRACTICE_INBOX_TITLES.system;
  const en = isEnglishLocale(lang);
  return {
    titleKey: row.titleKey,
    title: en ? row.titleEn : row.titleDe,
    summary: en ? row.summaryEn : row.summaryDe,
  };
}
