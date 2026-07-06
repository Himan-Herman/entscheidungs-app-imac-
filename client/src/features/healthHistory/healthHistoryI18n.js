import { getMessages } from "../../i18n/translations";
import enHealthHistory from "../../i18n/translations/en/healthHistory.js";

function mergeSection(baseSection, localeSection) {
  return {
    ...baseSection,
    ...(localeSection || {}),
  };
}

export function getHealthHistoryMessages(language) {
  const localeCopy = getMessages(language).healthHistory || {};
  return {
    ...enHealthHistory,
    ...localeCopy,
    allergy: mergeSection(enHealthHistory.allergy, localeCopy.allergy),
    diagnosis: mergeSection(enHealthHistory.diagnosis, localeCopy.diagnosis),
    practice: mergeSection(enHealthHistory.practice, localeCopy.practice),
  };
}

export function withHealthHistoryAiLoading(section, aiLoadingLabel) {
  return {
    ...(section || {}),
    aiLoading: aiLoadingLabel,
  };
}
