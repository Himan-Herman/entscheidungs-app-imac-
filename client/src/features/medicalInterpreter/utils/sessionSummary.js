import {
  TURN_STATUS_DRAFT,
  TURN_STATUS_SPOKEN,
  TURN_STATUS_TRANSLATED,
  SPEAKER_DOCTOR,
  SPEAKER_PATIENT,
} from "../constants.js";
import { buildAutoSessionTitle } from "./sessionAutoTitle.js";
import { getLanguageNativeName } from "./sessionDisplayTitle.js";

/**
 * @param {import('../types.js').InterpreterSession} session
 */
export function getSessionSummaryStats(session) {
  const turns = session?.turns ?? [];
  let translated = 0;
  let draft = 0;
  let patient = 0;
  let clinician = 0;

  for (const turn of turns) {
    if (
      turn.status === TURN_STATUS_TRANSLATED ||
      turn.status === TURN_STATUS_SPOKEN
    ) {
      translated += 1;
    }
    if (turn.status === TURN_STATUS_DRAFT) draft += 1;
    if (turn.speaker === SPEAKER_PATIENT) patient += 1;
    if (turn.speaker === SPEAKER_DOCTOR) clinician += 1;
  }

  return {
    turnCount: turns.length,
    translatedCount: translated,
    draftCount: draft,
    patientTurnCount: patient,
    clinicianTurnCount: clinician,
  };
}

/**
 * Local-only history search (no server).
 * @param {import('../types.js').InterpreterSession[]} sessions
 * @param {string} query
 * @param {object} t
 * @param {string} [uiLanguage]
 */
export function filterSessionsForHistory(sessions, query, t, uiLanguage = "de") {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return sessions;

  return sessions.filter((session) => {
    const title =
      session.conversationTitle?.trim() ||
      buildAutoSessionTitle(session, t, uiLanguage);
    const haystack = [
      title,
      session.doctorName,
      session.practiceName,
      session.specialty,
      getLanguageNativeName(session.patientLanguage),
      getLanguageNativeName(session.doctorLanguage),
      session.patientLanguage,
      session.doctorLanguage,
      session.status,
      session.createdAt,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
