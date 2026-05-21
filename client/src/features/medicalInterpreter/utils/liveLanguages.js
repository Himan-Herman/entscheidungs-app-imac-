import { SPEAKER_DOCTOR, SPEAKER_PATIENT } from "../constants.js";

/**
 * @param {{ patientLanguage: string, doctorLanguage: string }} session
 * @param {'patient'|'doctor'} speaker
 */
export function languagesForSpeaker(session, speaker) {
  if (speaker === SPEAKER_DOCTOR) {
    return {
      sourceLanguage: session.doctorLanguage,
      targetLanguage: session.patientLanguage,
    };
  }
  return {
    sourceLanguage: session.patientLanguage,
    targetLanguage: session.doctorLanguage,
  };
}

export { SPEAKER_PATIENT, SPEAKER_DOCTOR };
