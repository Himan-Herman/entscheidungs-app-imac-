import { buildCompactClientInstructions } from "./translationInstructions.js";
import { resolveOpenAiTranscriptionLanguage } from "../constants.js";
import { isLanguageRoutingEnabled } from "./languageBasedRouting.js";

/**
 * Minimal valid session.update for WebRTC runtime (no model/voice/speed/VAD — set at client_secrets only).
 * @param {ReturnType<typeof import("./routing.js").buildLanguageRouting>} routing
 */
export function buildRuntimeSessionUpdatePayload(routing) {
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
    session.audio = {
      input: {
        transcription: {
          language: txLanguage,
        },
      },
    };
  }

  return {
    type: "session.update",
    session,
  };
}
