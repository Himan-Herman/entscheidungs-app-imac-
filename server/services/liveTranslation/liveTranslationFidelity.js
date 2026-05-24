/** Shared fidelity rules for Realtime translation instructions (server session + client session.update). */

import { buildMedicalGlossaryBlock } from "./liveTranslationGlossary.js";

export function buildFidelityRulesBlock(targetLanguage) {
  const unclearPhrase =
    targetLanguage === "de"
      ? "Die vorherige Aussage war unklar. Bitte wiederholen."
      : "The previous statement was unclear. Please repeat.";

  return `
FIDELITY (highest priority):
- Translate EXACTLY what was said. Literal and faithful — not creative.
- Preserve symptoms, negations, uncertainty, numbers, dates, durations, units, medication names, allergies, and anatomical terms exactly.
- Do NOT summarize, paraphrase unnecessarily, expand short utterances, or add clinical interpretation.
- Do NOT improve, infer, invent, or medically correct the speaker. Do NOT answer questions — translate them only.
- Short input → short translation. Same length and scope as the source.
- If audio or meaning is unclear, say ONLY in the target language: "${unclearPhrase}"

${buildMedicalGlossaryBlock()}

Examples (German → English, patient mode):
Source: "Ich habe Kopfschmerzen." → Correct: "I have a headache." Wrong: "I have a cough and phlegm."
Source: "Nein, ich habe Kopfschmerzen." → Correct: "No, I have a headache." Wrong: "No, I have had this since yesterday."
Source: "Ich habe keine Allergien." → Correct: "I have no allergies." Wrong: "I have allergies."
Source: "Seit gestern." → Correct: "Since yesterday." Wrong: "For three days."

Examples (English → German, doctor mode):
Source: "How long have you had this?" → Correct: "Seit wann haben Sie das?" Wrong: "Seit gestern habe ich das."
Source: "Do you have a fever?" → Correct: "Haben Sie Fieber?" Wrong: "Haben Sie Schmerzen?"
`.trim();
}
