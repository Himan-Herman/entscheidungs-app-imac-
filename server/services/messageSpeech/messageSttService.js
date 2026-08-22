/**
 * Turning a recording into a draft.
 *
 * ── What this produces, and what it does not ────────────────────────────────
 * A string. That is all. It creates no message, touches no thread, writes no
 * row, and changes no read state — because at this point there IS no message.
 * What comes back goes into a text field the speaker can read, correct or throw
 * away, and a message exists only if they later press send. That send is the
 * ordinary send path, with its own validation, its own idempotency key and its
 * own audit entry.
 *
 * So this service is the only part of the messaging feature that never touches
 * the database, and that is a property worth keeping rather than an oversight.
 *
 * ── What happens to the audio ───────────────────────────────────────────────
 * It arrives in memory, is checked, is handed to the provider, and is
 * unreferenced when this function returns. It is never written to disk, never
 * given a filename, never stored in a row, and never logged. There is no
 * cleanup step because there is nothing to clean up — the absence of a file is
 * a stronger guarantee than deleting one.
 *
 * ── What leaves the process ─────────────────────────────────────────────────
 * The recording and, at most, a language hint. No thread, no message, no
 * neighbouring text, no identities, and deliberately no medical vocabulary from
 * the patient's record: priming a recogniser with someone's diagnoses would
 * transmit those diagnoses and would push the recognition towards words the
 * speaker may not have said.
 */

import { isMessageSttEnabled } from "../../config/featureFlags.js";
import {
  MESSAGE_STT_ERRORS,
  MessageSttError,
  assertDictationLanguage,
  assertUsableDictation,
} from "./messageSttPolicy.js";
import { resolveMessageSttProvider } from "./provider/index.js";

/**
 * Longest transcript accepted back.
 *
 * Ninety seconds of speech is a few hundred words. Ten thousand characters is
 * far beyond that and still far below anything that would break a text field —
 * it catches a service that returned a document instead of a transcription.
 */
const MAX_TRANSCRIPT_CHARS = 10_000;

/**
 * Phrases that mean a service refusal came back dressed as speech.
 * Showing one in a composer would put words in the speaker's mouth.
 */
const REFUSAL_MARKERS = [
  "i'm sorry", "i am sorry", "i cannot", "i can't", "as an ai",
  "unable to transcribe", "cannot transcribe", "no audio",
];

/**
 * Checks what came back is a transcript and not something else.
 *
 * @param {unknown} payload
 * @param {{ bytes: number }} sent
 */
export function validateTranscript(payload, sent) {
  const reject = (reason, extra = {}) => {
    throw new MessageSttError(MESSAGE_STT_ERRORS.TRANSCRIPT_REJECTED, { reason, ...extra });
  };

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    reject("not_structured");
  }

  // Extra fields are refused rather than ignored. A service volunteering a
  // "summary" or a "diagnosis" has done something this feature must not pass
  // on, and dropping it quietly would hide that it happened at all.
  const allowed = new Set(["text", "language", "duration", "segments", "task"]);
  const unexpected = Object.keys(payload).filter((k) => !allowed.has(k));
  if (unexpected.length > 0) reject("unexpected_fields", { fields: unexpected.slice(0, 5) });

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) reject("empty");
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    reject("too_long", { length: text.length, max: MAX_TRANSCRIPT_CHARS });
  }

  const lowered = text.toLowerCase();
  if (REFUSAL_MARKERS.some((m) => lowered.includes(m))) reject("looks_like_refusal");

  return {
    text,
    language:
      typeof payload.language === "string" && payload.language.trim()
        ? payload.language.trim().toLowerCase().slice(0, 12)
        : null,
    bytes: sent.bytes,
  };
}

/**
 * Transcribes one recording into a draft.
 *
 * The caller has already established that this actor may WRITE in this
 * conversation — dictation is the first half of composing a message, and a
 * relationship that accepts no new messages accepts no dictation for one
 * either. That check belongs to the route, which is where the practice
 * permissions and the consent gate live; this function refuses to run without
 * having been told it happened.
 *
 * @param {{
 *   file: { buffer: Buffer, mimetype: string },
 *   language?: string,
 *   writeAuthorized: boolean,
 *   signal?: AbortSignal,
 *   providerOptions?: object,
 * }} input
 */
export async function transcribeDictation(input) {
  if (!isMessageSttEnabled()) {
    throw new MessageSttError(MESSAGE_STT_ERRORS.FEATURE_DISABLED);
  }
  if (input?.writeAuthorized !== true) {
    // Defensive: unreachable through the routes, which gate first. Repeated so
    // a future caller cannot reach a provider without having decided this.
    throw new MessageSttError(MESSAGE_STT_ERRORS.PROVIDER_NOT_CONFIGURED, {
      reason: "write_authorization_not_established",
    });
  }

  // Everything cheap and local first: an oversized, mislabelled or empty upload
  // is refused before a provider is even resolved, let alone contacted.
  const mimeType = assertUsableDictation(input.file);
  const language = assertDictationLanguage(input.language);

  const provider = resolveMessageSttProvider(input.providerOptions);

  let payload;
  try {
    payload = await provider.transcribe({
      audio: input.file.buffer,
      mimeType,
      language,
      signal: input.signal,
    });
  } catch (err) {
    throw err instanceof MessageSttError
      ? err
      : new MessageSttError(MESSAGE_STT_ERRORS.PROVIDER_FAILED);
  }

  const result = validateTranscript(payload, { bytes: input.file.buffer.length });

  return {
    // The draft. Not a message, and named so that no caller mistakes it for one.
    draftText: result.text,
    detectedLanguage: result.language,
    providerKind: provider.kind,
  };
}
