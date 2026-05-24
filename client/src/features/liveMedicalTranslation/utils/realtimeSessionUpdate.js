import { buildCompactClientInstructions } from "./translationInstructions.js";
import { resolveOpenAiTranscriptionLanguage } from "../constants.js";

/**
 * Minimal valid session.update for WebRTC runtime (no model/voice/speed/VAD — set at client_secrets only).
 * @param {ReturnType<typeof import("./routing.js").buildLanguageRouting>} routing
 * @param {{ medicalDomainWarningDe?: string; medicalDomainWarningEn?: string }} [instructionOptions]
 */
export function buildRuntimeSessionUpdatePayload(routing) {
  const txLanguage = resolveOpenAiTranscriptionLanguage(routing.sourceLanguage);
  const session = {
    instructions: buildCompactClientInstructions(routing),
  };

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
