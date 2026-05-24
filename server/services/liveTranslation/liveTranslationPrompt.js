import { MEDICAL_INTERPRETER_COMMUNICATION_STYLE } from "../../config/aiSafetyPolicy.js";
import { buildFidelityRulesBlock } from "./liveTranslationFidelity.js";
import { buildMedicalScopeBlock } from "./liveTranslationMedicalScope.js";
import { buildLanguageRouting } from "./liveTranslationRouting.js";

/** ISO 639-1 → English language name for Realtime instructions. */
const LANGUAGE_NAMES = {
  de: "German",
  en: "English",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ru: "Russian",
  uk: "Ukrainian",
  tr: "Turkish",
  pt: "Portuguese",
  ar: "Arabic",
  fa: "Persian",
  pl: "Polish",
  ro: "Romanian",
  nl: "Dutch",
  ckb: "Central Kurdish (Sorani)",
  ku: "Kurdish (Kurmanji)",
  el: "Greek",
  sq: "Albanian",
  hr: "Croatian",
  bs: "Bosnian",
  sr: "Serbian",
  he: "Hebrew",
  ur: "Urdu",
};

export function resolveLanguageName(code) {
  if (!code || typeof code !== "string") return "Unknown";
  return LANGUAGE_NAMES[code.toLowerCase()] || code;
}

const VOICE_DELIVERY_RULES = `
Voice delivery (neutral_medical profile):
- Speak clearly, calmly, and at a moderate pace.
- Do not sound hectic, rushed, playful, dramatic, or emotional.
- Use professional pronunciation suitable for doctor–patient communication.
- Keep a balanced, neutral tone — not strongly male or strongly female.
`.trim();

/**
 * Build strict Realtime system instructions for manual speaker ping-pong translation.
 * @param {{ patientLanguage: string; doctorLanguage: string; activeSpeaker: "patient" | "doctor" }} params
 */
export function buildLiveTranslationInstructions({
  patientLanguage,
  doctorLanguage,
  activeSpeaker,
}) {
  const routing = buildLanguageRouting({ patientLanguage, doctorLanguage, activeSpeaker });
  const speakerLabel = routing.activeSpeaker === "patient" ? "patient" : "doctor";

  return `
You are a live medical conversation translator ONLY. You are NOT a doctor, nurse, triage system, or medical advisor.

SESSION CONTEXT (authoritative — provided by the UI, never guess):
- activeSpeaker: ${routing.activeSpeaker}
- patientLanguage: ${routing.patientLanguage} (${routing.patientLanguageName})
- doctorLanguage: ${routing.doctorLanguage} (${routing.doctorLanguageName})
- sourceLanguage: ${routing.sourceLanguage} (${routing.sourceLanguageName})
- targetLanguage: ${routing.targetLanguage} (${routing.targetLanguageName})

LANGUAGE ROUTING (use only activeSpeaker from the UI):
- When activeSpeaker is patient: listen/transcribe ${routing.patientLanguageName}, translate into ${routing.doctorLanguageName}, speak output in ${routing.doctorLanguageName}.
- When activeSpeaker is doctor: listen/transcribe ${routing.doctorLanguageName}, translate into ${routing.patientLanguageName}, speak output in ${routing.patientLanguageName}.
- Do NOT infer speaker identity from voice, accent, or content. Use ONLY the activeSpeaker value above.

CURRENT MODE:
- activeSpeaker: ${speakerLabel}
- Listen/transcribe: ${routing.sourceLanguageName} (${routing.sourceLanguage})
- Translate and speak aloud: ${routing.targetLanguageName} (${routing.targetLanguage})

${buildFidelityRulesBlock(routing.targetLanguage)}

${buildMedicalScopeBlock()}

Translation boundaries:
- Do NOT diagnose, triage, classify urgency, recommend treatment, give medication advice, suggest specialists, explain symptoms medically, or infer missing content.
- Output ONLY the translation in ${routing.targetLanguageName}. No commentary.

${VOICE_DELIVERY_RULES}

${MEDICAL_INTERPRETER_COMMUNICATION_STYLE}
`.trim();
}

export { buildLanguageRouting };
