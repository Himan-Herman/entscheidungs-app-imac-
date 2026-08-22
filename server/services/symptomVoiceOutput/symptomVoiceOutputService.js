/**
 * Reading a symptom-module reply aloud.
 *
 * ── The order is the security property ──────────────────────────────────────
 * Feature gate, then authorization, then payload, then provider. A closed
 * deployment refuses before any text is examined; an unauthorized caller is
 * refused before the body is parsed, so a malformed request is not a parser
 * oracle for someone who was never allowed to be here; and a payload that
 * breaks the rules is refused before anything leaves the process.
 *
 * Nothing here is stored. The text arrives, is spoken, and the audio is
 * returned; no request or response is written to a database or to disk.
 */

import { isSymptomSpeechEnabled } from "../../config/featureFlags.js";
import {
  SPEECH_OUTPUT_MIME,
  looksLikeSpeechAudio,
} from "../speechOutput/speechAudioFormat.js";
import { resolveSymptomSpeechProvider } from "./provider/index.js";
import {
  SYMPTOM_SPEECH_ERRORS,
  SymptomSpeechError,
  assertUsableSymptomSpeechRequest,
} from "./symptomVoiceOutputPolicy.js";

/**
 * @param {{ userId?: string | null, body?: unknown, providerOptions?: object }} input
 * @returns {Promise<{ audio: Buffer, contentType: string }>}
 */
export async function speakSymptomText(input) {
  if (!isSymptomSpeechEnabled()) {
    throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.FEATURE_DISABLED);
  }

  // All three clients sit behind ProtectedRoute and the route is mounted with
  // requireAuth, so this is a second lock on the same door rather than the only
  // one. It is here because a mount is a line in another file, and this path
  // spends money on a third party.
  const userId = typeof input?.userId === "string" ? input.userId.trim() : "";
  if (!userId) throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.NOT_AUTHORIZED);

  const request = assertUsableSymptomSpeechRequest(input?.body);

  const provider = resolveSymptomSpeechProvider(input?.providerOptions);

  // Only the text. No account, no session, no conversation, no module name —
  // the provider cannot tell which patient, or even which of the three
  // features, this came from.
  const result = await provider.synthesize({ text: request.text });

  const audio = Buffer.isBuffer(result?.audio) ? result.audio : Buffer.from(result?.audio ?? []);
  if (!looksLikeSpeechAudio(audio)) {
    throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.AUDIO_MALFORMED, { bytes: audio.length });
  }

  return { audio, contentType: SPEECH_OUTPUT_MIME };
}
