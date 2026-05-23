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

/**
 * Infer speaker from Whisper-detected language vs session language pair.
 *
 * @param {string|undefined} detectedLanguage
 * @param {{ patientLanguage: string, doctorLanguage: string }} session
 * @param {import('../constants.js').InterpreterSpeaker} [fallbackSpeaker]
 * @returns {import('../constants.js').InterpreterSpeaker}
 */
export function detectSpeakerFromLanguage(
  detectedLanguage,
  session,
  fallbackSpeaker = SPEAKER_PATIENT,
) {
  if (langMatches(detectedLanguage, session.patientLanguage)) {
    return SPEAKER_PATIENT;
  }
  if (langMatches(detectedLanguage, session.doctorLanguage)) {
    return SPEAKER_DOCTOR;
  }
  return fallbackSpeaker;
}

export { SPEAKER_PATIENT, SPEAKER_DOCTOR };
