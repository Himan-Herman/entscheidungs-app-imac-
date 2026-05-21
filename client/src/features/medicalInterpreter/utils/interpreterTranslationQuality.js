import { INTERPRETER_SETUP_LANGUAGE_CODES } from "../constants/setupLanguages.js";
import { TURN_STATUS_BLOCKED, TURN_STATUS_TRANSLATED } from "../constants.js";
import { sessionIsMixedDirection } from "./interpreterLocale.js";

/**
 * Legacy or unknown language codes stored on device.
 * @param {{ patientLanguage?: string, doctorLanguage?: string }} session
 */
export function isLimitedLanguagePair(session) {
  if (!session) return false;
  const patient = String(session.patientLanguage || "")
    .toLowerCase()
    .split(/[-_]/)[0];
  const doctor = String(session.doctorLanguage || "")
    .toLowerCase()
    .split(/[-_]/)[0];
  return (
    !INTERPRETER_SETUP_LANGUAGE_CODES.includes(patient) ||
    !INTERPRETER_SETUP_LANGUAGE_CODES.includes(doctor)
  );
}

/**
 * Calm quality warnings for translation panel (no panic wording).
 * @param {import('../types.js').InterpreterTurn | null} turn
 * @param {{ patientLanguage?: string, doctorLanguage?: string } | null} session
 * @param {object} labels — medicalInterpreter i18n slice
 * @returns {string[]}
 */
export function getTranslationQualityWarnings(turn, session, labels) {
  if (!turn) return [];
  const t = labels?.translation ?? {};
  /** @type {string[]} */
  const warnings = [];

  if (turn.status === TURN_STATUS_BLOCKED) {
    warnings.push(t.blocked);
    return warnings;
  }

  if (turn.status !== TURN_STATUS_TRANSLATED || !turn.translatedText?.trim()) {
    return warnings;
  }

  warnings.push(t.verifyTermsNotice);

  if (turn.confidence === "low") {
    warnings.push(t.lowConfidence);
  }
  if (turn.translationUncertain) {
    warnings.push(t.uncertainLabel);
  }
  if (turn.terminologyWarning) {
    warnings.push(t.terminologyWarning);
  }
  if (turn.unclearSource) {
    warnings.push(t.unclearSourceWarning);
  }
  if (session && sessionIsMixedDirection(session)) {
    warnings.push(t.mixedDirectionSession);
  }
  if (isLimitedLanguagePair(session)) {
    warnings.push(t.languagePairLimited);
  }

  return [...new Set(warnings.filter(Boolean))];
}

/**
 * Per-turn notes on review/PDF (no repeating full verify banner).
 * @param {import('../types.js').InterpreterTurn | null} turn
 * @param {object} labels
 * @returns {string[]}
 */
export function getTurnReviewNotes(turn, labels) {
  if (!turn) return [];
  const t = labels?.translation ?? {};
  /** @type {string[]} */
  const notes = [];

  if (turn.confidence === "low") notes.push(t.lowConfidence);
  if (turn.translationUncertain) notes.push(t.uncertainLabel);
  if (turn.terminologyWarning) notes.push(t.terminologyWarning);
  if (turn.unclearSource) notes.push(t.unclearSourceWarning);

  return [...new Set(notes.filter(Boolean))];
}
