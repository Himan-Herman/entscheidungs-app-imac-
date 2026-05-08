/**
 * Short category hints for adaptive intake (documentation-oriented, non-diagnostic).
 * Keep in sync with client adaptiveCategories.js intent (not UI copy).
 */

export const CATEGORY_MICRO_RULES = {
  symptomsOwnWords:
    "Focus: plain patient wording. Stop when complaints are understandable without adding interpretation.",
  onsetAndCourse:
    "Focus: timing and change since start (when, sudden/gradual). Stop when timeline is clear enough.",
  medications:
    "Focus: names/doses/frequency as patient knows them. Stop when list is usable for documentation.",
  preExistingConditions:
    "Focus: prior conditions as reported by patient. Stop when background is clear in everyday words.",
  patientQuestions:
    "Focus: questions/priorities for the visit. Stop when priorities are clear and concise.",
};
