import { buildCompactClientInstructions } from "./translationInstructions.js";
import {
  LIVE_TRANSLATION_TRANSCRIPTION_MODEL,
  resolveOpenAiTranscriptionLanguage,
} from "../constants.js";
import { isLanguageRoutingEnabled } from "./languageBasedRouting.js";

/**
 * Runtime session.update for WebRTC (speaker/language change — no model/voice/VAD changes).
 * Flat session structure: transcription at session.input_audio_transcription (not nested under audio).
 * @param {ReturnType<typeof import("./routing.js").buildLanguageRouting>} routing
 * @param {string} [transcriptionModel]
 */
export function buildRuntimeSessionUpdatePayload(routing, transcriptionModel) {
  const session = {
    type: "realtime",
    instructions: buildCompactClientInstructions(routing),
  };

  const lockTranscriptionLanguage = !isLanguageRoutingEnabled(
    routing.patientLanguage,
    routing.doctorLanguage,
  );
  const txLanguage = lockTranscriptionLanguage
    ? resolveOpenAiTranscriptionLanguage(routing.sourceLanguage)
    : null;

  if (txLanguage) {
    // Flat structure — input_audio_transcription at session root, not nested under audio.input.
    session.input_audio_transcription = {
      model: transcriptionModel || LIVE_TRANSLATION_TRANSCRIPTION_MODEL,
      language: txLanguage,
    };
  }

  return {
    type: "session.update",
    session,
  };
}
