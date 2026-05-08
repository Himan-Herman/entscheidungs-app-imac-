export const ADAPTIVE_CATEGORIES = {
  symptomsOwnWords: {
    key: "symptomsOwnWords",
    maxFollowups: 4,
    seedPromptDe:
      "Beschreiben Sie Ihre Beschwerden in eigenen Worten, neutral und möglichst konkret.",
    seedPromptEn:
      "Describe your symptoms in your own words, neutrally and as concretely as possible.",
    allowedFollowupTypes: ["clarification", "missing_information", "patient_confirmation"],
    completionRule:
      "Complete when description is understandable without adding medical interpretation.",
  },
  onsetAndCourse: {
    key: "onsetAndCourse",
    maxFollowups: 3,
    seedPromptDe:
      "Beschreiben Sie Beginn und Verlauf zeitlich (wann, wie entwickelt, Muster).",
    seedPromptEn:
      "Describe onset and course over time (when, how it changed, pattern).",
    allowedFollowupTypes: ["timing", "pattern", "clarification"],
    completionRule:
      "Complete when timeline and course are sufficiently clear in patient wording.",
  },
  medications: {
    key: "medications",
    maxFollowups: 3,
    seedPromptDe:
      "Nennen Sie Medikamente, soweit bekannt mit Name, Dosis und Häufigkeit.",
    seedPromptEn:
      "List medications, if known with name, dose, and frequency.",
    allowedFollowupTypes: ["missing_information", "clarification", "patient_confirmation"],
    completionRule:
      "Complete when medication info is clear enough for documentation.",
  },
  preExistingConditions: {
    key: "preExistingConditions",
    maxFollowups: 2,
    seedPromptDe:
      "Nennen Sie bekannte Vorerkrankungen nur nach Ihren eigenen Angaben.",
    seedPromptEn:
      "List known pre-existing conditions only as you personally report them.",
    allowedFollowupTypes: ["clarification", "missing_information"],
    completionRule:
      "Complete when known background conditions are understandable in plain language.",
  },
  patientQuestions: {
    key: "patientQuestions",
    maxFollowups: 2,
    seedPromptDe:
      "Welche Fragen möchten Sie im Termin klären?",
    seedPromptEn:
      "What questions do you want to clarify during the appointment?",
    allowedFollowupTypes: ["clarification", "missing_information"],
    completionRule:
      "Complete when patient priorities/questions are clear and concise.",
  },
};

export const ADAPTIVE_CATEGORY_KEYS = new Set(Object.keys(ADAPTIVE_CATEGORIES));

export function isAdaptiveCategoryKey(categoryKey) {
  return ADAPTIVE_CATEGORY_KEYS.has(categoryKey);
}

export function getAdaptiveCategoryConfig(categoryKey) {
  return ADAPTIVE_CATEGORIES[categoryKey] || null;
}

