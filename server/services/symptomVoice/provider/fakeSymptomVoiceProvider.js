/**
 * Deterministic double for symptom voice input.
 *
 * Lets the gate, the payload checks and the refusals be tested without a
 * microphone, a network or a credential — and records what it was handed, so a
 * test can assert that nothing accompanied the recording.
 *
 * Never reachable in production: the config refuses "fake" when NODE_ENV is
 * production.
 */

import { SYMPTOM_VOICE_ERRORS, SymptomVoiceError } from "../symptomVoicePolicy.js";

export const FAKE_SYMPTOM_VOICE_BEHAVIOURS = Object.freeze({
  TRANSCRIPT: "transcript",
  EMPTY: "empty",
  MALFORMED: "malformed",
  EXTRA_FIELD: "extra_field",
  SERVER_ERROR: "server_error",
});

export const FAKE_SYMPTOM_TRANSCRIPT =
  "Seit gestern habe ich Kopfschmerzen und mir ist etwas schwindelig.";

/** @param {{ behaviour?: string, onCall?: Function }} [options] */
export function createFakeSymptomVoiceProvider(options = {}) {
  const behaviour = options.behaviour || FAKE_SYMPTOM_VOICE_BEHAVIOURS.TRANSCRIPT;
  const calls = [];

  return {
    kind: "fake",
    model: "fake",
    calls,

    async transcribe(request) {
      // Recorded by size, not by content: a test asserting what was transmitted
      // does not need a copy of the recording to do it.
      calls.push({
        bytes: request.audio?.length ?? 0,
        mimeType: request.mimeType,
        keys: Object.keys(request).sort(),
      });
      if (typeof options.onCall === "function") options.onCall(request);

      switch (behaviour) {
        case FAKE_SYMPTOM_VOICE_BEHAVIOURS.SERVER_ERROR:
          throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.PROVIDER_FAILED, { status: 503 });
        case FAKE_SYMPTOM_VOICE_BEHAVIOURS.EMPTY:
          return { text: "" };
        case FAKE_SYMPTOM_VOICE_BEHAVIOURS.MALFORMED:
          return "not an object";
        case FAKE_SYMPTOM_VOICE_BEHAVIOURS.EXTRA_FIELD:
          return { text: FAKE_SYMPTOM_TRANSCRIPT, diagnosis: "migraine" };
        case FAKE_SYMPTOM_VOICE_BEHAVIOURS.TRANSCRIPT:
        default:
          return { text: FAKE_SYMPTOM_TRANSCRIPT, language: "de" };
      }
    },
  };
}
