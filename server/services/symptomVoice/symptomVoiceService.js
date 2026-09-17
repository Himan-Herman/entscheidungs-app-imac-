/**
 * Transcribing a patient's spoken symptom description.
 *
 * Produces a string for a text field, exactly as before this phase. What has
 * changed is everything around it: the feature has a flag, the provider has its
 * own credential and endpoint, the payload is checked against its bytes, and
 * nothing happens at all unless both gates are open.
 *
 * ── What happens to the audio ───────────────────────────────────────────────
 * It arrives in memory, is checked, is handed to the provider, and is
 * unreferenced when this returns. No file, no row, no log.
 */

import { isSymptomVoiceInputEnabled } from "../../config/featureFlags.js";
import {
  SYMPTOM_VOICE_ERRORS,
  SymptomVoiceError,
  assertUsableSymptomVoice,
} from "./symptomVoicePolicy.js";
import { resolveSymptomVoiceProvider } from "./provider/index.js";

/** Ninety seconds of speech is a few hundred words; this catches a document. */
const MAX_TRANSCRIPT_CHARS = 10_000;

const REFUSAL_MARKERS = [
  "i'm sorry", "i am sorry", "i cannot", "i can't", "as an ai",
  "unable to transcribe", "cannot transcribe",
];

/**
 * Checks that what came back is a transcription and not something else.
 * @param {unknown} payload
 */
export function validateSymptomTranscript(payload) {
  const reject = (reason, extra = {}) => {
    throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.TRANSCRIPT_REJECTED, { reason, ...extra });
  };

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) reject("not_structured");

  // A service volunteering a "diagnosis" alongside the words has done something
  // this feature must never pass on, and dropping it quietly would hide it.
  const allowed = new Set(["text", "language", "duration", "segments", "task"]);
  const unexpected = Object.keys(payload).filter((k) => !allowed.has(k));
  if (unexpected.length > 0) reject("unexpected_fields", { fields: unexpected.slice(0, 5) });

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) reject("empty");
  if (text.length > MAX_TRANSCRIPT_CHARS) reject("too_long", { length: text.length });
  if (REFUSAL_MARKERS.some((m) => text.toLowerCase().includes(m))) reject("looks_like_refusal");

  return {
    text,
    language:
      typeof payload.language === "string" && payload.language.trim()
        ? payload.language.trim().toLowerCase().slice(0, 12)
        : null,
  };
}

/**
 * @param {{ file: { buffer: Buffer, mimetype: string }, providerOptions?: object }} input
 */
export async function transcribeSymptomVoice(input) {
  if (!isSymptomVoiceInputEnabled()) {
    throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.FEATURE_DISABLED);
  }

  // Everything cheap and local first: an oversized, mislabelled or empty upload
  // is refused before a provider is resolved, let alone contacted.
  const mimeType = assertUsableSymptomVoice(input.file);

  const provider = resolveSymptomVoiceProvider(input.providerOptions);

  let payload;
  try {
    payload = await provider.transcribe({ audio: input.file.buffer, mimeType });
  } catch (err) {
    throw err instanceof SymptomVoiceError
      ? err
      : new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.PROVIDER_FAILED);
  }

  const result = validateSymptomTranscript(payload);
  return { text: result.text, language: result.language, providerKind: provider.kind };
}
