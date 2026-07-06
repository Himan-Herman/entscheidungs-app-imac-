import { getMessages } from "../../i18n/translations";
import enPatientMedicationPlan from "../../i18n/translations/en/patientMedicationPlan.js";

function mergeSection(baseSection, localeSection) {
  return {
    ...baseSection,
    ...(localeSection || {}),
  };
}

export function getPatientMedicationPlanMessages(language) {
  const localeCopy = getMessages(language).patientMedicationPlan || {};
  const summary = mergeSection(
    enPatientMedicationPlan.summary,
    localeCopy.summary,
  );
  return {
    ...enPatientMedicationPlan,
    ...localeCopy,
    ownForm: mergeSection(enPatientMedicationPlan.ownForm, localeCopy.ownForm),
    ownCard: mergeSection(enPatientMedicationPlan.ownCard, localeCopy.ownCard),
    supply: mergeSection(enPatientMedicationPlan.supply, localeCopy.supply),
    summary: {
      ...summary,
      pharmacy: mergeSection(
        enPatientMedicationPlan.summary.pharmacy,
        localeCopy.summary?.pharmacy,
      ),
      reminders: mergeSection(
        enPatientMedicationPlan.summary.reminders,
        localeCopy.summary?.reminders,
      ),
    },
  };
}
