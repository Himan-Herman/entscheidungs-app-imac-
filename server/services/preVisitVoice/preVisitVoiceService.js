/**
 * Transcribing a Pre-Visit recording.
 *
 * Produces a string for the preparation form, exactly as before this phase.
 * What has changed is everything around it: the feature has a flag, the
 * provider has its own credential and endpoint, the caller has to be inside a
 * real Pre-Visit context, and the payload is checked against its bytes.
 *
 * ── The order, and why it is that order ─────────────────────────────────────
 *   1. Is the feature on?          — cheapest, and decides everything.
 *   2. May this caller be here?    — before anything expensive.
 *   3. Is the payload plausible?   — before anything leaves.
 *   4. Only then: the provider.
 *
 * The recording lives in a buffer for the duration of one call. No file, no
 * row, no log.
 */

import { isPreVisitVoiceInputEnabled } from "../../config/featureFlags.js";
import {
  PREVISIT_VOICE_ERRORS,
  PreVisitVoiceError,
  assertUsablePreVisitVoice,
  normalizeDictationLanguage,
} from "./preVisitVoicePolicy.js";
import { assertPreVisitVoiceAllowed } from "./preVisitVoiceAuthorization.js";
import { resolvePreVisitVoiceProvider } from "./provider/index.js";

/** Three minutes of speech is several hundred words; this catches a document. */
const MAX_TRANSCRIPT_CHARS = 20_000;

const REFUSAL_MARKERS = [
  "i'm sorry", "i am sorry", "i cannot", "i can't", "as an ai",
  "unable to transcribe", "cannot transcribe",
];

/**
 * Checks that what came back is a transcription and not something else.
 * @param {unknown} payload
 */
export function validatePreVisitTranscript(payload) {
  const reject = (reason, extra = {}) => {
    throw new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.TRANSCRIPT_REJECTED, { reason, ...extra });
  };

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) reject("not_structured");

  // A service volunteering a "diagnosis" beside the words has done something
  // this feature must never put into a form a clinician will read as the
  // patient's own account.
  const allowed = new Set(["text", "language", "duration", "segments", "task"]);
  const unexpected = Object.keys(payload).filter((k) => !allowed.has(k));
  if (unexpected.length > 0) reject("unexpected_fields", { fields: unexpected.slice(0, 5) });

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) reject("empty");
  if (text.length > MAX_TRANSCRIPT_CHARS) reject("too_long", { length: text.length });
  if (REFUSAL_MARKERS.some((m) => text.toLowerCase().includes(m))) reject("looks_like_refusal");

  return { text };
}

/**
 * @param {{
 *   file: { buffer: Buffer, mimetype: string },
 *   language?: unknown,
 *   userId?: string | null,
 *   qrToken?: unknown,
 *   providerOptions?: object,
 * }} input
 */
export async function transcribePreVisitVoice(input) {
  if (!isPreVisitVoiceInputEnabled()) {
    throw new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.FEATURE_DISABLED);
  }

  // Before the payload is even looked at: an unauthorized caller must not be
  // able to make the server do work, and certainly not to spend a provider
  // call, by uploading something.
  await assertPreVisitVoiceAllowed({ userId: input.userId, qrToken: input.qrToken });

  const mimeType = assertUsablePreVisitVoice(input.file);
  const language = normalizeDictationLanguage(input.language);

  const provider = resolvePreVisitVoiceProvider(input.providerOptions);

  let payload;
  try {
    payload = await provider.transcribe({ audio: input.file.buffer, mimeType, language });
  } catch (err) {
    throw err instanceof PreVisitVoiceError
      ? err
      : new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.PROVIDER_FAILED);
  }

  const result = validatePreVisitTranscript(payload);
  return { text: result.text, providerKind: provider.kind };
}
