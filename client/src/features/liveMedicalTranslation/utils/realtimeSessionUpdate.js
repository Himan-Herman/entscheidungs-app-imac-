import { buildCompactClientInstructions } from "./translationInstructions.js";
import {
  LIVE_TRANSLATION_TRANSCRIPTION_MODEL,
  resolveOpenAiTranscriptionLanguage,
} from "../constants.js";
import { isLanguageRoutingEnabled } from "./languageBasedRouting.js";

/**
 * Minimal valid session.update for WebRTC runtime (no model/voice/speed/VAD — set at client_secrets only).
 * @param {ReturnType<typeof import("./routing.js").buildLanguageRouting>} routing
 * @param {string} [transcriptionModel]
 */
export function buildRuntimeSessionUpdatePayload(routing, transcriptionModel) {
  const session = {
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
    // input_audio_transcription must be at the session root, not nested under audio.input
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
