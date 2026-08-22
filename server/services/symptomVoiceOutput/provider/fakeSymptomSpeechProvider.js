/**
 * Deterministic double for symptom read-aloud.
 *
 * Lets the gate, the authorization boundary and the payload checks be tested
 * without a network or a credential — and records what it was handed, so a test
 * can assert that nothing accompanied the text.
 *
 * Never reachable in production: the config refuses "fake" when NODE_ENV is
 * production.
 */

import { SYMPTOM_SPEECH_ERRORS, SymptomSpeechError } from "../symptomVoiceOutputPolicy.js";

export const FAKE_SYMPTOM_SPEECH_BEHAVIOURS = Object.freeze({
  AUDIO: "audio",
  EMPTY: "empty",
  NOT_AUDIO: "not_audio",
  SERVER_ERROR: "server_error",
  TIMEOUT: "timeout",
});

/** A minimal but genuinely MP3-shaped buffer: an ID3 header and silence. */
export function fakeSpeechAudio() {
  const buf = Buffer.alloc(1024, 0);
  buf.write("ID3", 0, "ascii");
  return buf;
}

/** @param {{ behaviour?: string, onCall?: Function }} [options] */
export function createFakeSymptomSpeechProvider(options = {}) {
  const behaviour = options.behaviour || FAKE_SYMPTOM_SPEECH_BEHAVIOURS.AUDIO;
  const calls = [];

  return {
    kind: "fake",
    model: "fake",
    calls,

    async synthesize(request) {
      calls.push({
        chars: request.text?.length ?? 0,
        text: request.text,
        keys: Object.keys(request).sort(),
      });
      if (typeof options.onCall === "function") options.onCall(request);

      switch (behaviour) {
        case FAKE_SYMPTOM_SPEECH_BEHAVIOURS.SERVER_ERROR:
          throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.PROVIDER_FAILED, { status: 503 });
        case FAKE_SYMPTOM_SPEECH_BEHAVIOURS.TIMEOUT:
          throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.PROVIDER_FAILED, { reason: "timeout" });
        case FAKE_SYMPTOM_SPEECH_BEHAVIOURS.EMPTY:
          return { audio: Buffer.alloc(0) };
        case FAKE_SYMPTOM_SPEECH_BEHAVIOURS.NOT_AUDIO:
          return { audio: Buffer.from("<html>rate limited</html>".repeat(20), "utf8") };
        case FAKE_SYMPTOM_SPEECH_BEHAVIOURS.AUDIO:
        default:
          return { audio: fakeSpeechAudio() };
      }
    },
  };
}
