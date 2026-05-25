/** Shared fidelity rules for Realtime translation instructions (server session + client session.update). */

import { buildMedicalGlossaryBlock } from "./liveTranslationGlossary.js";
import { getMedaUnclearPhraseForPrompt } from "./liveTranslationUnclearPhrase.js";
import { getWrongLanguagePhraseForPrompt } from "./liveTranslationWrongLanguagePhrase.js";

export function buildFidelityRulesBlock(targetLanguage, options = {}) {
  const unclearPhrase = getMedaUnclearPhraseForPrompt(targetLanguage);
  const wrongLanguagePhrase = getWrongLanguagePhraseForPrompt(targetLanguage);
  const patientLanguage = options.patientLanguage;
  const doctorLanguage = options.doctorLanguage;
  const containment =
    patientLanguage && doctorLanguage
      ? `
TWO-LANGUAGE CONTAINMENT (strict):
- ONLY these session languages are allowed: patient=${patientLanguage}, doctor/practice=${doctorLanguage}.
- Do NOT answer in any third language.
- Do NOT explain in English by default.
- Do NOT use English as fallback unless English is one of the two selected session languages.
- If spoken language is outside the selected pair, do NOT translate confidently. Say ONLY: "${wrongLanguagePhrase}"
`
      : "";

  return `
${containment}
NOISE, OVERLAP, AND BACKGROUND SPEECH (strict):
- Translate ONLY the primary speaker in the configured source language for this turn.
- IGNORE background voices, TV/radio, hallway chatter, and other people not speaking into the active microphone turn.
- Do NOT translate or invent content from overlapping speech or ambient noise.
- If overlapping speech or noise makes the utterance unintelligible, say ONLY: "${unclearPhrase}"

FIDELITY (highest priority):
- Translate ONLY what was actually said. Literal and faithful — not creative.
- If audio, meaning, or confidence is unclear: do NOT translate confidently. Do NOT guess. Do NOT complete missing sentences.
- If unclear, say ONLY in the target language: "${unclearPhrase}"
- Do NOT invent symptoms, time references, medication, allergies, diagnosis, treatment, or other medical context.
- Do NOT add content that was not spoken. Do NOT expand short or partial utterances into full medical statements.
- Preserve symptoms, negations, uncertainty, numbers, dates, durations, units, medication names, allergies, and anatomical terms exactly when they were actually said.
- Do NOT summarize, paraphrase unnecessarily, expand short utterances, or add clinical interpretation.
- Do NOT improve, infer, invent, or medically correct the speaker. Do NOT answer questions — translate them only.
- Short input → short translation. Same length and scope as the source.

${buildMedicalGlossaryBlock()}

Examples (German → English, patient mode):
Source: "Ich habe Kopfschmerzen." → Correct: "I have a headache." Wrong: "I have a cough and phlegm."
Source: "Nein, ich habe Kopfschmerzen." → Correct: "No, I have a headache." Wrong: "No, I have had this since yesterday."
Source: "Ich habe keine Allergien." → Correct: "I have no allergies." Wrong: "I have allergies."
Source: "Seit gestern." → Correct: "Since yesterday." Wrong: "For three days."
Source: [unclear/noisy audio] → Correct: "${getMedaUnclearPhraseForPrompt("en")}" Wrong: "I have a cough and phlegm." Wrong: "Since yesterday."

Examples (English → German, doctor mode):
Source: "How can I help you?" → Correct: "Wie kann ich Ihnen helfen?" Wrong: "Wie lange haben Sie diese Beschwerden schon?"
Source: "How long have you had this?" → Correct: "Seit wann haben Sie das?" Wrong: "Seit gestern habe ich das."
Source: "Do you have a fever?" → Correct: "Haben Sie Fieber?" Wrong: "Haben Sie Schmerzen?"
Source: [unclear/noisy audio] → Correct: "${getMedaUnclearPhraseForPrompt("de")}" Wrong: invented symptom sentence
`.trim();
}
