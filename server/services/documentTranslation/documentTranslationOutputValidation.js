/**
 * Structural validation of a provider response.
 *
 * Runs BEFORE the deterministic marker/integrity checks and before anything is
 * unmasked. Its job is narrow: prove the response is the shape we asked for,
 * covering exactly the segments we sent, with no extra fields. Content
 * questions belong to maskedOutputValidation.js and documentTranslationSafety.js.
 *
 * A provider that supports strict structured output should never fail this. It
 * is still checked, because "the schema was requested" and "the schema was
 * honoured" are different statements, and a JSON-mode fallback or a future
 * provider may not enforce it at all.
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "./documentTranslationPolicy.js";
import {
  FORBIDDEN_RESPONSE_FIELDS,
  segmentIndexFromId,
} from "./prompts/documentTranslationPrompts.js";

const FORBIDDEN = new Set(FORBIDDEN_RESPONSE_FIELDS.map((f) => f.toLowerCase()));

/**
 * Validate a parsed provider response against the segments that were sent.
 *
 * @param {unknown} response  already JSON-parsed
 * @param {{ index: number }[]} sentSegments
 * @returns {{ index: number, text: string }[]} output segments in sent order
 * @throws {DocumentTranslationError} document_translation_invalid_response
 */
export function validateProviderResponse(response, sentSegments) {
  if (response === null || typeof response !== "object" || Array.isArray(response)) {
    throw invalid("response_not_object");
  }

  assertNoForbiddenFields(response, "root");

  const segments = response.segments;
  if (!Array.isArray(segments)) throw invalid("segments_not_array");

  // Extra top-level keys are rejected rather than ignored: a field we did not
  // ask for is a model doing something we did not ask for.
  const extraKeys = Object.keys(response).filter((k) => k !== "segments");
  if (extraKeys.length > 0) throw invalid("unexpected_response_field", { keys: extraKeys.slice(0, 5) });

  if (segments.length !== sentSegments.length) {
    throw invalid("segment_count_mismatch", {
      expected: sentSegments.length,
      actual: segments.length,
    });
  }

  const expectedIndexes = sentSegments.map((s) => s.index);
  const seen = new Set();
  const out = [];

  segments.forEach((segment, position) => {
    if (segment === null || typeof segment !== "object" || Array.isArray(segment)) {
      throw invalid("segment_not_object", { position });
    }

    assertNoForbiddenFields(segment, "segment");

    const keys = Object.keys(segment);
    const unexpected = keys.filter((k) => k !== "id" && k !== "text");
    if (unexpected.length > 0) {
      throw invalid("unexpected_segment_field", { position, keys: unexpected.slice(0, 5) });
    }

    if (typeof segment.text !== "string") throw invalid("segment_text_not_string", { position });

    const index = segmentIndexFromId(segment.id);
    if (index === null) throw invalid("segment_id_malformed", { position });
    if (!expectedIndexes.includes(index)) throw invalid("segment_id_unknown", { position });
    if (seen.has(index)) throw invalid("segment_id_duplicated", { position });
    if (index !== expectedIndexes[position]) {
      // Order carries meaning in a medical letter; a reordered response is not
      // a cosmetic difference.
      throw invalid("segment_out_of_order", { position });
    }

    seen.add(index);
    out.push({ index, text: segment.text });
  });

  return out;
}

/**
 * Parse a raw provider payload.
 * Kept here so a malformed body produces our stable code rather than a
 * SyntaxError escaping into the route.
 *
 * @param {string} raw
 */
export function parseProviderPayload(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw invalid("empty_response");
  try {
    return JSON.parse(raw);
  } catch {
    // The malformed body is NOT attached — it contains document content.
    throw invalid("response_not_json");
  }
}

/** @param {Record<string, unknown>} object @param {string} where */
function assertNoForbiddenFields(object, where) {
  for (const key of Object.keys(object)) {
    if (FORBIDDEN.has(key.toLowerCase())) {
      throw invalid("forbidden_response_field", { where, key });
    }
  }
}

function invalid(reason, detail = {}) {
  return new DocumentTranslationError(TRANSLATION_ERRORS.INVALID_RESPONSE, {
    reason,
    ...detail,
  });
}
