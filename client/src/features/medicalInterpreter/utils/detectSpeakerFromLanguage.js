import { SPEAKER_DOCTOR, SPEAKER_PATIENT } from "../constants.js";

/** @param {string|undefined} code */
function normalizeLangCode(code) {
  return String(code || "").trim().toLowerCase().split("-")[0];
}

/** @param {string|undefined} a @param {string|undefined} b */
function langMatches(a, b) {
  const na = normalizeLangCode(a);
  const nb = normalizeLangCode(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

function isArabicScript(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(text || ""));
}

function isCyrillicScript(text) {
  return /[\u0400-\u04FF]/.test(String(text || ""));
}

function scriptFamilyForLanguage(code) {
  const normalized = normalizeLangCode(code);
  if (!normalized) return null;
  if (["fa", "ar", "ckb", "ku"].includes(normalized)) return "arabic";
  if (["ru", "uk", "sr"].includes(normalized)) return "cyrillic";
  return "latin";
}

function inferSpeakerFromScript(transcript, session) {
  const text = String(transcript || "").trim();
  if (!text) return null;

  const patientScript = scriptFamilyForLanguage(session.patientLanguage);
  const doctorScript = scriptFamilyForLanguage(session.doctorLanguage);
  if (!patientScript || !doctorScript || patientScript === doctorScript) {
    return null;
  }

  const detectedScript = isArabicScript(text)
    ? "arabic"
    : isCyrillicScript(text)
      ? "cyrillic"
      : "latin";

  if (detectedScript === patientScript) return SPEAKER_PATIENT;
  if (detectedScript === doctorScript) return SPEAKER_DOCTOR;
  return null;
}

/**
 * Infer speaker from Whisper-detected language vs session language pair.
 *
 * @param {string|undefined} detectedLanguage
 * @param {string|undefined} transcript
 * @param {{ patientLanguage: string, doctorLanguage: string }} session
 * @param {import('../constants.js').InterpreterSpeaker} [fallbackSpeaker]
 * @returns {import('../constants.js').InterpreterSpeaker}
 */
export function detectSpeakerFromLanguage(
  detectedLanguage,
  transcript,
  session,
  fallbackSpeaker = SPEAKER_PATIENT,
) {
  if (langMatches(detectedLanguage, session.patientLanguage)) {
    return SPEAKER_PATIENT;
  }
  if (langMatches(detectedLanguage, session.doctorLanguage)) {
    return SPEAKER_DOCTOR;
  }
  const scriptSpeaker = inferSpeakerFromScript(transcript, session);
  if (scriptSpeaker) {
    return scriptSpeaker;
  }
  return fallbackSpeaker;
}

export { SPEAKER_PATIENT, SPEAKER_DOCTOR };
