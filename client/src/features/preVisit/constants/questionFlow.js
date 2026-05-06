/**
 * Deterministic pre-visit intake steps (frontend-only MVP).
 * Title/explanation: keyed by locale; extend with fr, es, … later — fallback in UI.
 */

export const PRE_VISIT_SESSION_KEY = "medscoutx_previsit_session";

/** Keys aligned with the agreed payload shape for PDF/API later */
export const PRE_VISIT_QUESTION_STEPS = [
  {
    key: "appointmentReason",
    title: {
      de: "Aktueller Anlass des Termins",
      en: "Reason for this appointment",
    },
    explanation: {
      de: "Worum geht es bei diesem Besuch? Kurz in eigenen Worten.",
      en: "What is this visit about? Briefly, in your own words.",
    },
  },
  {
    key: "symptomsOwnWords",
    title: {
      de: "Symptome in Ihren eigenen Worten",
      en: "Symptoms in your own words",
    },
    explanation: {
      de: "Was nehmen Sie wahr (z. B. Schmerz, Druck, Einschränkung)?",
      en: "What do you notice (e.g. pain, pressure, limitation)?",
    },
  },
  {
    key: "onsetAndCourse",
    title: {
      de: "Beginn und Verlauf",
      en: "Onset and course over time",
    },
    explanation: {
      de: "Seit wann bestehen die Beschwerden? Wie haben sie sich entwickelt?",
      en: "When did symptoms start? How have they changed since then?",
    },
  },
  {
    key: "medications",
    title: {
      de: "Aktuelle Medikamente",
      en: "Current medications",
    },
    explanation: {
      de: "Welche Medikamente nehmen Sie ein (Name, Dosis, wie oft)?",
      en: "Which medicines do you take (name, dose, how often)?",
    },
  },
  {
    key: "preExistingConditions",
    title: {
      de: "Bekannte Vorerkrankungen",
      en: "Known pre-existing conditions",
    },
    explanation: {
      de: "Welche Diagnosen oder chronischen Erkrankungen sind bekannt?",
      en: "Which diagnoses or chronic conditions are known?",
    },
  },
  {
    key: "relevantDocuments",
    title: {
      de: "Relevante Unterlagen",
      en: "Relevant documents",
    },
    explanation: {
      de: "Welche Befunde oder Unterlagen möchten Sie erwähnen (z. B. Labor, Vor-Befunde)?",
      en: "Which results or documents should be mentioned (e.g. labs, prior reports)?",
    },
  },
  {
    key: "patientQuestions",
    title: {
      de: "Fragen an die Ärztin / den Arzt",
      en: "Questions you want to ask",
    },
    explanation: {
      de: "Was möchten Sie im Gespräch unbedingt klären?",
      en: "What do you want to clarify during the consultation?",
    },
  },
];

export function createEmptyAnswers() {
  return {
    appointmentReason: "",
    symptomsOwnWords: "",
    onsetAndCourse: "",
    medications: "",
    preExistingConditions: "",
    relevantDocuments: "",
    patientQuestions: "",
  };
}

/** Pick localized string; fallback de → en → first available */
export function pickLocalized(record, lang) {
  if (!record || typeof record !== "object") return "";
  if (record[lang]) return record[lang];
  if (record.de) return record.de;
  if (record.en) return record.en;
  const first = Object.values(record).find(Boolean);
  return first ?? "";
}
