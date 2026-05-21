import { INTERPRETER_CLOUD_SCHEMA_VERSION } from "../constants/cloud.js";

/**
 * Build API body from local session — no audio, no profileSnapshot.
 * @param {import('../types.js').InterpreterSession} session
 * @param {{ cloudStorageConsent: boolean }} opts
 */
export function sessionToCloudPayload(session, opts) {
  const turns = (session.turns || []).map((turn) => {
    /** @type {Record<string, unknown>} */
    const t = {
      turnId: turn.turnId,
      speaker: turn.speaker,
      sourceLanguage: turn.sourceLanguage,
      targetLanguage: turn.targetLanguage,
      originalText: turn.originalText,
      status: turn.status,
      createdAt: turn.createdAt,
    };
    if (turn.translatedText) t.translatedText = turn.translatedText;
    if (turn.simplifiedText) t.simplifiedText = turn.simplifiedText;
    if (turn.confidence) t.confidence = turn.confidence;
    if (turn.editedAt) t.editedAt = turn.editedAt;
    if (turn.translationDirection) t.translationDirection = turn.translationDirection;
    if (turn.translationUncertain === true) t.translationUncertain = true;
    if (turn.terminologyWarning === true) t.terminologyWarning = true;
    if (turn.unclearSource === true) t.unclearSource = true;
    return t;
  });

  return {
    sessionId: session.sessionId,
    status: session.status,
    patientLanguage: session.patientLanguage,
    doctorLanguage: session.doctorLanguage,
    conversationTitle: session.conversationTitle,
    doctorName: session.doctorName,
    practiceName: session.practiceName,
    specialty: session.specialty,
    appointmentDateTime: session.appointmentDateTime,
    profileConsentUsed: session.profileConsentUsed === true,
    cloudStorageConsent: opts.cloudStorageConsent === true,
    schemaVersion: INTERPRETER_CLOUD_SCHEMA_VERSION,
    endedAt: session.endedAt,
    turns,
  };
}

/**
 * @param {import('../types.js').InterpreterSession} session
 */
export function sessionToPracticeSharePayload(session) {
  const base = sessionToCloudPayload(session, { cloudStorageConsent: true });
  return {
    ...base,
    practiceShareConsent: true,
  };
}
