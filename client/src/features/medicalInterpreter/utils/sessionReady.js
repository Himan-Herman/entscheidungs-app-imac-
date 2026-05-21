/** @typedef {import('../types.js').InterpreterSession} InterpreterSession */

/**
 * @param {InterpreterSession|null|undefined} session
 * @returns {boolean}
 */
export function isSessionReadyForLive(session) {
  if (!session) return false;
  return Boolean(
    String(session.patientLanguage || "").trim() &&
      String(session.doctorLanguage || "").trim(),
  );
}
