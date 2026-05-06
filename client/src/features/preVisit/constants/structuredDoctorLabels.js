/**
 * Clinical-style headings for “Structured doctor version” (UI locale DE/EN).
 * Content remains the patient’s own wording until optional AI translation later.
 */
export const STRUCTURED_DOCTOR_LABELS = {
  appointmentReason: {
    de: "Aktueller Anlass",
    en: "Current reason for appointment",
  },
  symptomsOwnWords: {
    de: "Beschwerden in eigenen Worten",
    en: "Symptoms in patient’s own words",
  },
  onsetAndCourse: {
    de: "Beginn und Verlauf",
    en: "Start and development over time",
  },
  medications: {
    de: "Medikamente",
    en: "Current medication",
  },
  preExistingConditions: {
    de: "Bekannte Vorerkrankungen",
    en: "Known pre-existing conditions",
  },
  relevantDocuments: {
    de: "Relevante Dokumente",
    en: "Relevant documents",
  },
  patientQuestions: {
    de: "Fragen an den Arzt",
    en: "Questions for the doctor",
  },
};

/** Stable iteration order — matches PRE_VISIT_QUESTION_STEPS keys */
export const STRUCTURED_SECTION_ORDER = [
  "appointmentReason",
  "symptomsOwnWords",
  "onsetAndCourse",
  "medications",
  "preExistingConditions",
  "relevantDocuments",
  "patientQuestions",
];
