import { normalizePatientName } from "./setupValidation.js";

/** @typedef {{
 *   practiceName: string;
 *   doctorName: string;
 *   specialty: string;
 *   practiceAddress: string;
 *   insurance: string;
 *   appointmentNote: string;
 * }} LiveTranslationPracticeInfo */

export const EMPTY_PRACTICE_INFO = /** @type {LiveTranslationPracticeInfo} */ ({
  practiceName: "",
  doctorName: "",
  specialty: "",
  practiceAddress: "",
  insurance: "",
  appointmentNote: "",
});

/**
 * In-memory session metadata for future PDF export. Not persisted or sent to analytics.
 * @param {{
 *   patientName: string;
 *   birthDate: string;
 *   patientLanguage: string;
 *   doctorLanguage: string;
 *   practice?: Partial<LiveTranslationPracticeInfo>;
 *   sessionStartedAt?: string;
 * }} input
 */
export function buildSessionMetadata(input) {
  const practice = { ...EMPTY_PRACTICE_INFO, ...(input.practice || {}) };
  const trimmedPractice = Object.fromEntries(
    Object.entries(practice).map(([key, value]) => [key, typeof value === "string" ? value.trim() : ""]),
  );

  return {
    productName: "MedScoutX",
    sessionStartedAt: input.sessionStartedAt || new Date().toISOString(),
    patientName: normalizePatientName(input.patientName),
    birthDate: input.birthDate,
    patientLanguage: input.patientLanguage,
    doctorLanguage: input.doctorLanguage,
    practice: trimmedPractice,
  };
}

/**
 * Merge live transcript turns into export-ready metadata for client-side PDF.
 * @param {ReturnType<typeof buildSessionMetadata>} metadata
 * @param {Array<{
 *   id?: string;
 *   speaker: string;
 *   sourceLanguage: string;
 *   targetLanguage: string;
 *   originalText: string;
 *   originalMissing?: boolean;
 *   translatedText: string;
 *   timestamp: string;
 *   status?: string;
 *   correctsTurnId?: string;
 *   wrongOriginalText?: string;
 *   wrongTranslatedText?: string;
 * }>} turns
 * @param {{ autoSwitchSpeaker?: boolean; sessionEndedAt?: string }} [options]
 */
export function buildExportMetadata(metadata, turns, options = {}) {
  const sorted = [...turns].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return {
    ...metadata,
    sessionEndedAt: options.sessionEndedAt || new Date().toISOString(),
    autoSwitchSpeaker: Boolean(options.autoSwitchSpeaker),
    transcript: sorted.map((turn) => ({
      id: turn.id,
      speaker: turn.speaker,
      sourceLanguage: turn.sourceLanguage,
      targetLanguage: turn.targetLanguage,
      originalText: turn.originalText,
      originalMissing: Boolean(turn.originalMissing),
      translatedText: turn.translatedText,
      timestamp: turn.timestamp,
      status: turn.status || "translated",
      correctsTurnId: turn.correctsTurnId,
      wrongOriginalText: turn.wrongOriginalText,
      wrongTranslatedText: turn.wrongTranslatedText,
    })),
  };
}
