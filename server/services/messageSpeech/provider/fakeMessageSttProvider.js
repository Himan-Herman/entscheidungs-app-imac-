/**
 * Deterministic in-process dictation double.
 *
 * Recognition cannot be tested against a real service without a microphone, a
 * network and a bill — and the outcome would then depend on what the service
 * happened to hear today. The properties worth proving here are not "did it
 * hear correctly": they are what left the process, what came back, what was
 * refused, and above all that nothing was sent anywhere.
 *
 * It is also the privacy tripwire: it records verbatim what it was handed, so a
 * test can assert that no thread, no identity and no neighbouring message ever
 * accompanied the audio.
 *
 * Never reachable in production: the config refuses "fake" outright when
 * NODE_ENV is production.
 */

import { MESSAGE_STT_ERRORS, MessageSttError } from "../messageSttPolicy.js";

export const FAKE_STT_BEHAVIOURS = Object.freeze({
  /** A plausible, faithful transcript. */
  TRANSCRIPT: "transcript",
  /** Silence: nothing was recognised. */
  EMPTY: "empty",
  /** The service answered, but not with a transcript. */
  MALFORMED: "malformed",
  /** A refusal handed back as though it were speech. */
  REFUSAL: "refusal",
  /** More text than any ninety seconds of speech could contain. */
  HUGE: "huge",
  /** The service volunteered a summary instead of a transcription. */
  SUMMARISED: "summarised",
  /** A field the contract does not have. */
  EXTRA_FIELD: "extra_field",
  /** The service failed. */
  SERVER_ERROR: "server_error",
  /** The service never answered. */
  TIMEOUT: "timeout",
});

/**
 * What the double "hears".
 *
 * Deliberately a sentence with a dose, a negation and a time in it — the three
 * things a test needs in order to check that the SPEAKER gets to correct them
 * before anything is sent.
 */
export const FAKE_TRANSCRIPT =
  "Ich soll Ramipril 5 mg morgens nicht mehr einnehmen, richtig? Termin am 14:30.";

/**
 * @param {{ behaviour?: string, onCall?: Function, transcript?: string }} [options]
 */
export function createFakeMessageSttProvider(options = {}) {
  const behaviour = options.behaviour || FAKE_STT_BEHAVIOURS.TRANSCRIPT;
  /** Everything the adapter was asked to transmit. */
  const calls = [];

  return {
    kind: "fake",
    model: "fake",
    calls,

    /**
     * @param {{ audio: Buffer, mimeType: string, language: string | null }} request
     */
    async transcribe(request) {
      // The audio itself is recorded only by its size: a test asserting on what
      // was transmitted does not need a copy of the recording to do it.
      calls.push({
        bytes: request.audio?.length ?? 0,
        mimeType: request.mimeType,
        language: request.language,
        keys: Object.keys(request).sort(),
      });
      if (typeof options.onCall === "function") options.onCall(request);

      switch (behaviour) {
        case FAKE_STT_BEHAVIOURS.SERVER_ERROR:
          throw new MessageSttError(MESSAGE_STT_ERRORS.PROVIDER_FAILED, { status: 503 });

        case FAKE_STT_BEHAVIOURS.TIMEOUT:
          throw new MessageSttError(MESSAGE_STT_ERRORS.PROVIDER_FAILED, { reason: "timeout" });

        case FAKE_STT_BEHAVIOURS.EMPTY:
          return { text: "", language: request.language };

        case FAKE_STT_BEHAVIOURS.MALFORMED:
          return "not an object at all";

        case FAKE_STT_BEHAVIOURS.REFUSAL:
          return { text: "I'm sorry, I cannot transcribe that.", language: "en" };

        case FAKE_STT_BEHAVIOURS.HUGE:
          return { text: "wort ".repeat(20_000), language: request.language };

        case FAKE_STT_BEHAVIOURS.SUMMARISED:
          return {
            text: FAKE_TRANSCRIPT,
            summary: "The patient asks about their medication.",
            language: request.language,
          };

        case FAKE_STT_BEHAVIOURS.EXTRA_FIELD:
          return {
            text: FAKE_TRANSCRIPT,
            diagnosis: "hypertension",
            language: request.language,
          };

        case FAKE_STT_BEHAVIOURS.TRANSCRIPT:
        default:
          return {
            text: options.transcript ?? FAKE_TRANSCRIPT,
            language: request.language ?? "de",
          };
      }
    },
  };
}
