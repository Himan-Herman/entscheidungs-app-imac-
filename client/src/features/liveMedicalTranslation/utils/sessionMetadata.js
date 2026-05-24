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
 * Merge live transcript turns into export-ready metadata (PDF integration later).
 * @param {ReturnType<typeof buildSessionMetadata>} metadata
 * @param {Array<{ speaker: string; sourceLanguage: string; targetLanguage: string; originalText: string; originalMissing?: boolean; translatedText: string; timestamp: string }>} turns
 */
export function buildExportMetadata(metadata, turns) {
  return {
    ...metadata,
    sessionEndedAt: new Date().toISOString(),
    transcript: turns.map((turn) => ({
      speaker: turn.speaker,
      sourceLanguage: turn.sourceLanguage,
      targetLanguage: turn.targetLanguage,
      originalText: turn.originalText,
      originalMissing: turn.originalMissing,
      translatedText: turn.translatedText,
      timestamp: turn.timestamp,
    })),
  };
}
