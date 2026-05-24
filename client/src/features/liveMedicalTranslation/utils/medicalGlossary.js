import { isMedaUnclearPhrase } from "./repeatPhrase.js";

/** Lightweight medical glossary protection — keep small and maintainable. */

export const MEDICAL_GLOSSARY = {
  negation: ["keine", "kein", "nicht", "nie", "no", "not", "never", "none"],
  units: ["mg", "ml", "kg", "g", "cm", "mm", "mmol", "°c", "°f"],
  durations: ["seit gestern", "since yesterday", "seit", "since", "tage", "days", "wochen", "weeks"],
  symptoms: [
    { de: "kopfschmerzen", en: "headache" },
    { de: "fieber", en: "fever" },
    { de: "übelkeit", en: "nausea" },
    { de: "schwindel", en: "dizziness" },
    { de: "husten", en: "cough" },
  ],
  allergies: [
    { de: "allergie", en: "allergy" },
    { de: "keine allergien", en: "no allergies" },
  ],
  bodyParts: [
    { de: "kopf", en: "head" },
    { de: "bauch", en: "abdomen" },
    { de: "brust", en: "chest" },
  ],
  conditions: [{ de: "schwanger", en: "pregnant" }],
};

/** Prompt block for Realtime instructions (server + client). */
export function buildMedicalGlossaryBlock() {
  return `
MEDICAL TERM PROTECTION (preserve exactly — never flip or substitute meaning):
- Negation words (keine/kein/nicht/nie/no/not/never): MUST remain negated in translation.
- Units (mg, ml, kg, cm, mmol, °C): keep numbers and units exactly.
- Durations (seit gestern/since yesterday, seit 3 Tagen/for 3 days): preserve time scope.
- Symptoms: Kopfschmerzen=headache, Fieber=fever, Übelkeit=nausea — do NOT substitute other symptoms.
- Allergies: Allergie=allergy; "keine Allergien" = "no allergies" — NEVER drop negation.
- Body parts: Kopf/head, Bauch/abdomen, Brust/chest — translate anatomical terms faithfully.
- Medication names: keep verbatim or standard generic equivalent; do not replace with different drugs.
- Pregnancy: schwanger=pregnant — preserve exactly.

Negation example:
DE "Ich habe keine Allergien." → Correct EN: "I have no allergies." Wrong: "I have allergies."
`.trim();
}

/** @param {string} text @param {string} targetLanguage */
export function isUnclearTranslationPhrase(text, targetLanguage) {
  void targetLanguage;
  return isMedaUnclearPhrase(text);
}
