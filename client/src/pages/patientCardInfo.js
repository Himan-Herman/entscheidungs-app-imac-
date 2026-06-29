/**
 * Patient "Meine Praxis" hub — per-tile info-overlay config (mirrors the practice-side
 * practiceCardInfo.js). Holds only i18n KEY NAMES + a stable DOM id (never translated
 * strings), keyed by the hub-link `key`, so the shared tile renderer shows an ⓘ button
 * + explanation modal ONLY for these "Meine Praxis" tiles. Framework-free + node --test
 * friendly. Keys resolve against the `patientCardInfo` i18n namespace.
 */
export const PATIENT_CARD_INFO = {
  hubLinkInbox: {
    titleId: "patient-card-info-inbox-title",
    buttonKey: "inboxButton",
    titleKey: "inboxTitle",
    paragraphKeys: ["inboxP1", "inboxP2", "inboxP3"],
  },
  hubLinkThreads: {
    titleId: "patient-card-info-messages-title",
    buttonKey: "messagesButton",
    titleKey: "messagesTitle",
    paragraphKeys: ["messagesP1", "messagesP2", "messagesP3"],
  },
  hubLinkAppointments: {
    titleId: "patient-card-info-appointments-title",
    buttonKey: "appointmentsButton",
    titleKey: "appointmentsTitle",
    paragraphKeys: ["appointmentsP1", "appointmentsP2", "appointmentsP3"],
  },
  hubLinkTelemedicine: {
    titleId: "patient-card-info-telemedicine-title",
    buttonKey: "telemedicineButton",
    titleKey: "telemedicineTitle",
    paragraphKeys: ["telemedicineP1", "telemedicineP2", "telemedicineP3"],
  },
  hubLinkPracticeDocuments: {
    titleId: "patient-card-info-documents-title",
    buttonKey: "documentsButton",
    titleKey: "documentsTitle",
    paragraphKeys: ["documentsP1", "documentsP2", "documentsP3"],
  },
  hubLinkPracticeErezept: {
    titleId: "patient-card-info-erezept-title",
    buttonKey: "erezeptButton",
    titleKey: "erezeptTitle",
    paragraphKeys: ["erezeptP1", "erezeptP2", "erezeptP3"],
  },
  hubLinkVisitMedications: {
    titleId: "patient-card-info-medications-title",
    buttonKey: "medicationsButton",
    titleKey: "medicationsTitle",
    paragraphKeys: ["medicationsP1", "medicationsP2", "medicationsP3"],
  },
  hubLinkDataControl: {
    titleId: "patient-card-info-data-control-title",
    buttonKey: "dataControlButton",
    titleKey: "dataControlTitle",
    paragraphKeys: ["dataControlP1", "dataControlP2", "dataControlP3"],
  },
  hubLinkPatientActivity: {
    titleId: "patient-card-info-activity-title",
    buttonKey: "activityButton",
    titleKey: "activityTitle",
    paragraphKeys: ["activityP1", "activityP2", "activityP3"],
  },
  hubLinkCases: {
    titleId: "patient-card-info-cases-title",
    buttonKey: "casesButton",
    titleKey: "casesTitle",
    paragraphKeys: ["casesP1", "casesP2", "casesP3"],
  },
  hubLinkFindPractices: {
    titleId: "patient-card-info-find-practices-title",
    buttonKey: "findPracticesButton",
    titleKey: "findPracticesTitle",
    paragraphKeys: ["findPracticesP1", "findPracticesP2", "findPracticesP3"],
  },
  hubLinkMedScoutXDirectory: {
    titleId: "patient-card-info-directory-title",
    buttonKey: "directoryButton",
    titleKey: "directoryTitle",
    paragraphKeys: ["directoryP1", "directoryP2", "directoryP3"],
  },
  hubLinkMyPractice: {
    titleId: "patient-card-info-my-practice-title",
    buttonKey: "myPracticeButton",
    titleKey: "myPracticeTitle",
    paragraphKeys: ["myPracticeP1", "myPracticeP2", "myPracticeP3"],
  },
};

/** Hub-link keys that expose an info (ⓘ) button + modal. */
export const PATIENT_INFO_TILE_KEYS = Object.keys(PATIENT_CARD_INFO);

/** @param {string} tileKey */
export function hasPatientCardInfo(tileKey) {
  return Object.prototype.hasOwnProperty.call(PATIENT_CARD_INFO, tileKey);
}

/**
 * Stop a click on the info button from triggering the surrounding tile link.
 * Safe to call with a partial / missing event.
 * @param {{ preventDefault?: () => void, stopPropagation?: () => void }} [event]
 */
export function suppressTileNavigation(event) {
  if (!event) return;
  if (typeof event.preventDefault === "function") event.preventDefault();
  if (typeof event.stopPropagation === "function") event.stopPropagation();
}
