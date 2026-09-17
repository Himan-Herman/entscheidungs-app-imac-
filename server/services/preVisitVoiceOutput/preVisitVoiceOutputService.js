/**
 * Reading a Pre-Visit preparation question aloud.
 *
 * ── The order is the security property ──────────────────────────────────────
 * Feature gate, then authorization, then payload, then provider. A closed
 * deployment refuses before any text is examined; an unauthorized caller is
 * refused before the body is validated, so a malformed request is not a parser
 * oracle for someone who was never allowed to be here; and a payload that
 * breaks the rules is refused before anything leaves the process.
 *
 * ── The boundary ────────────────────────────────────────────────────────────
 * The same one the dictation route uses, from the same module: an authenticated
 * user, or a QR token that resolves to an active target of an active practice.
 * It is shared because it is the same question — is this person inside a real
 * Pre-Visit context — and two copies of that rule would eventually disagree.
 *
 * Nothing here is stored.
 */

import { isPreVisitSpeechEnabled } from "../../config/featureFlags.js";
import { resolvePreVisitParticipation } from "../preVisitAccess/preVisitParticipation.js";
import {
  SPEECH_OUTPUT_MIME,
  looksLikeSpeechAudio,
} from "../speechOutput/speechAudioFormat.js";
import { resolvePreVisitSpeechProvider } from "./provider/index.js";
import {
  PREVISIT_SPEECH_ERRORS,
  PreVisitSpeechError,
  assertUsablePreVisitSpeechRequest,
} from "./preVisitVoiceOutputPolicy.js";

/**
 * @param {{ userId?: string | null, body?: unknown, providerOptions?: object }} input
 * @returns {Promise<{ audio: Buffer, contentType: string }>}
 */
export async function speakPreVisitText(input) {
  if (!isPreVisitSpeechEnabled()) {
    throw new PreVisitSpeechError(PREVISIT_SPEECH_ERRORS.FEATURE_DISABLED);
  }

  const participation = await resolvePreVisitParticipation({
    userId: input?.userId,
    qrToken: input?.body?.qrToken,
  });
  if (!participation.allowed) {
    throw new PreVisitSpeechError(PREVISIT_SPEECH_ERRORS.NOT_AUTHORIZED);
  }

  const request = assertUsablePreVisitSpeechRequest(input?.body);

  const provider = resolvePreVisitSpeechProvider(input?.providerOptions);

  // Only the text. Not the QR token that authorized this, not the practice it
  // resolved to, not the account, not the session, not the surrounding
  // preparation — the provider cannot tell whose appointment this is.
  const result = await provider.synthesize({ text: request.text });

  const audio = Buffer.isBuffer(result?.audio) ? result.audio : Buffer.from(result?.audio ?? []);
  if (!looksLikeSpeechAudio(audio)) {
    throw new PreVisitSpeechError(PREVISIT_SPEECH_ERRORS.AUDIO_MALFORMED, { bytes: audio.length });
  }

  return { audio, contentType: SPEECH_OUTPUT_MIME };
}
