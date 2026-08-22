/**
 * Deterministic double for Pre-Visit voice input.
 *
 * Lets the gate, the authorization boundary and the payload checks be tested
 * without a microphone, a network or a credential — and records what it was
 * handed, so a test can assert that nothing accompanied the recording.
 *
 * Never reachable in production: the config refuses "fake" when NODE_ENV is
 * production.
 */

import { PREVISIT_VOICE_ERRORS, PreVisitVoiceError } from "../preVisitVoicePolicy.js";

export const FAKE_PREVISIT_VOICE_BEHAVIOURS = Object.freeze({
  TRANSCRIPT: "transcript",
  EMPTY: "empty",
  MALFORMED: "malformed",
  EXTRA_FIELD: "extra_field",
  SERVER_ERROR: "server_error",
});

export const FAKE_PREVISIT_TRANSCRIPT =
  "Ich habe seit etwa zwei Wochen Rückenschmerzen, vor allem beim Bücken.";

/** @param {{ behaviour?: string, onCall?: Function }} [options] */
export function createFakePreVisitVoiceProvider(options = {}) {
  const behaviour = options.behaviour || FAKE_PREVISIT_VOICE_BEHAVIOURS.TRANSCRIPT;
  const calls = [];

  return {
    kind: "fake",
    model: "fake",
    calls,

    async transcribe(request) {
      // Recorded by size, not by content.
      calls.push({
        bytes: request.audio?.length ?? 0,
        mimeType: request.mimeType,
        language: request.language,
        keys: Object.keys(request).sort(),
      });
      if (typeof options.onCall === "function") options.onCall(request);

      switch (behaviour) {
        case FAKE_PREVISIT_VOICE_BEHAVIOURS.SERVER_ERROR:
          throw new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.PROVIDER_FAILED, { status: 503 });
        case FAKE_PREVISIT_VOICE_BEHAVIOURS.EMPTY:
          return { text: "" };
        case FAKE_PREVISIT_VOICE_BEHAVIOURS.MALFORMED:
          return "not an object";
        case FAKE_PREVISIT_VOICE_BEHAVIOURS.EXTRA_FIELD:
          return { text: FAKE_PREVISIT_TRANSCRIPT, diagnosis: "lumbago" };
        case FAKE_PREVISIT_VOICE_BEHAVIOURS.TRANSCRIPT:
        default:
          return { text: FAKE_PREVISIT_TRANSCRIPT, language: request.language ?? "de" };
      }
    },
  };
}
