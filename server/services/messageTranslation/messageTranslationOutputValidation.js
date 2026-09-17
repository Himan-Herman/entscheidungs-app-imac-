/**
 * What a provider answer must satisfy before it is shown to anyone.
 *
 * ── What these checks can and cannot establish ──────────────────────────────
 * They are structural. They can prove that no digit was invented, that every
 * placeholder came back intact, that the answer is a translation-shaped object
 * rather than a chat reply, and that nothing was silently dropped. They cannot
 * establish that the translation is medically correct, and nothing here should
 * be read as claiming otherwise. The strongest guarantee in this feature is not
 * a check at all — it is that the critical values were never sent.
 */

import {
  MESSAGE_TRANSLATION_ERRORS,
  MessageTranslationError,
} from "./messageTranslationPolicy.js";
import { FORBIDDEN_RESPONSE_FIELDS } from "./prompts/messageTranslationPrompts.js";
import {
  MARKER_PATTERN,
  findMarkers,
  findUnmaskedDigits,
} from "../documentTranslation/masking/criticalTokenMasking.js";

/** Generous, but bounded: a translation of a short message is not a document. */
const MAX_OUTPUT_RATIO = 6;
const MAX_OUTPUT_CHARS = 24_000;

/**
 * Phrases that mean a provider error was handed back as if it were content.
 * A message reading "I'm sorry, I can't help with that" is not a translation,
 * and presenting it as one would be worse than failing.
 */
const REFUSAL_MARKERS = [
  "i'm sorry", "i am sorry", "i cannot", "i can't", "as an ai",
  "i'm unable", "i am unable", "language model", "cannot assist",
];

/**
 * Parses the raw provider payload into an object, or refuses it.
 * @param {unknown} raw
 */
export function parseMessageProviderPayload(raw) {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.OUTPUT_REJECTED, {
      reason: "output_empty",
    });
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not_an_object");
    }
    return parsed;
  } catch {
    // A model that answered in prose instead of the required shape has ignored
    // the contract; there is nothing here worth salvaging.
    throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.OUTPUT_REJECTED, {
      reason: "output_not_structured",
    });
  }
}

/**
 * @param {object} payload parsed provider answer
 * @param {{ maskedText: string }} sent what was actually transmitted
 * @returns {{ sourceLanguage: string | null, translatedText: string }}
 */
export function validateMessageProviderResponse(payload, sent) {
  const reject = (reason, extra = {}) => {
    throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.OUTPUT_REJECTED, {
      reason,
      ...extra,
    });
  };

  // 1 — the shape. Extra fields are refused rather than ignored: a provider
  // volunteering "advice" or "diagnosis" has done something this feature must
  // never pass on, and quietly dropping it would hide that it happened.
  const keys = Object.keys(payload);
  const unexpected = keys.filter((k) => k !== "sourceLanguage" && k !== "translatedText");
  if (unexpected.length > 0) {
    reject("output_unexpected_fields", { fields: unexpected.slice(0, 5) });
  }
  const forbidden = keys.filter((k) => FORBIDDEN_RESPONSE_FIELDS.includes(k.toLowerCase()));
  if (forbidden.length > 0) reject("output_forbidden_fields", { fields: forbidden });

  const text = typeof payload.translatedText === "string" ? payload.translatedText : "";
  if (!text.trim()) reject("output_empty");

  // 2 — length. A translation that is many times its source is no longer a
  // translation, whatever else it is.
  const sourceLen = String(sent?.maskedText ?? "").length || 1;
  if (text.length > MAX_OUTPUT_CHARS || text.length > sourceLen * MAX_OUTPUT_RATIO) {
    reject("output_too_long", { length: text.length, sourceLength: sourceLen });
  }

  // 3 — a provider refusal handed back as content.
  const lowered = text.toLowerCase();
  if (REFUSAL_MARKERS.some((m) => lowered.includes(m))) {
    reject("output_looks_like_refusal");
  }

  // 4 — placeholders. Every marker that went out must come back exactly once,
  // and none may appear that was never sent. This is what protects the dose.
  const expected = countMarkers(String(sent?.maskedText ?? ""));
  const returned = countMarkers(text);
  for (const [marker, n] of expected) {
    if (!returned.has(marker)) reject("output_marker_missing", { marker });
    if (returned.get(marker) !== n) {
      reject("output_marker_count_changed", { marker });
    }
  }
  for (const marker of returned.keys()) {
    if (!expected.has(marker)) reject("output_marker_invented", { marker });
  }

  // 5 — digits. Masking leaves no digit outside a marker, so a digit here is
  // numeric material the model made up.
  const strayDigits = findUnmaskedDigits(text);
  if (strayDigits.length > 0) reject("output_invented_number");

  const sourceLanguage =
    typeof payload.sourceLanguage === "string" && payload.sourceLanguage.trim()
      ? payload.sourceLanguage.trim().toLowerCase().slice(0, 12)
      : null;

  return { sourceLanguage, translatedText: text };
}

/** @param {string} text */
function countMarkers(text) {
  const counts = new Map();
  for (const marker of findMarkers(text)) {
    counts.set(marker, (counts.get(marker) ?? 0) + 1);
  }
  return counts;
}

export { MARKER_PATTERN };
