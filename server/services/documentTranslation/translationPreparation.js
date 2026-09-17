/**
 * The canonical entry point for everything that must happen to a document
 * BEFORE a model could ever see it.
 *
 * A later route must call THIS and nothing else. Assembling the layers by hand
 * at the call site is how a step gets skipped or reordered — and several of the
 * orderings here are load-bearing rather than stylistic.
 *
 * No model call, no network, no database access. Whatever the caller needs from
 * the database (the patient's own identifiers) is passed in, already resolved
 * by the provenance gate.
 *
 * ── Enforced order ──────────────────────────────────────────────────────────
 *
 *   1  source language declared and supported
 *   2  segment structure valid
 *   3  declared language not contradicted by the document
 *   4  polarity read from the ORIGINAL wording
 *   5  masking: patient identifiers first, then medical critical tokens
 *   6  masking self-check — no digits left outside markers
 *   7  medication context fully protected, else refuse
 *   8  written-out dosages fully protected, else refuse
 *   9  outbound payload assembled
 *
 * Why those positions:
 *   1 before everything — the protections downstream are written for German,
 *     so running them over another language proves nothing.
 *   3 after 2 — it needs text to judge, and it can only ever CONTRADICT a
 *     declaration, never confirm one.
 *   4 before 5 — polarity cues are words; after masking the clinically
 *     relevant ones have been replaced by markers.
 *   5 patient first — an email contains the surname, and a name half-consumed
 *     by another rule can no longer be matched whole.
 *   7 and 8 after 5 — both ask "what is still unprotected?", which is only
 *     answerable once masking has run.
 */

import { annotateSegmentsWithPolarity } from "./negation/negationDetection.js";
import { maskSegments } from "./masking/criticalTokenMasking.js";
import { assertMaskingComplete } from "./masking/maskedOutputValidation.js";
import {
  assertDosageProtected,
  assertMedicationContextProtected,
} from "./masking/medicationContextGuard.js";
import {
  assertLanguageNotContradicted,
  assertSupportedSourceLanguage,
} from "./sourceLanguageGate.js";
import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
  TRANSLATION_LIMITS,
} from "./documentTranslationPolicy.js";

/**
 * @param {object} input
 * @param {{ index: number, kind: string, text: string }[]} input.segments
 *   the extraction result, unmasked
 * @param {string} input.sourceLanguage
 *   declared by the caller — never inferred here, see sourceLanguageGate.js
 * @param {object} [input.patientIdentity]
 *   the patient's own known identifiers, resolved by the provenance gate
 * @returns {{
 *   sourceLanguage: string,
 *   outbound: { index: number, kind: string, text: string, polarity: string }[],
 *   tokenMap: Map<string, { marker: string, kind: string, original: string }>,
 *   tokens: { marker: string, kind: string, original: string }[],
 *   stats: object,
 * }}
 */
export function prepareSegmentsForTranslation(input) {
  const { segments, sourceLanguage, patientIdentity } = input ?? {};
  const source = Array.isArray(segments) ? segments : [];

  // 1 — source language
  const language = assertSupportedSourceLanguage(sourceLanguage);

  // 2 — segment structure
  assertSegmentsWellFormed(source);

  // 3 — the declaration must not be contradicted by the document itself
  assertLanguageNotContradicted(source, language);

  // 4 — polarity on the original wording
  const annotated = annotateSegmentsWithPolarity(source);

  // 5 — masking, patient identifiers ahead of the generic passes
  const { segments: masked, tokens, tokenMap } = maskSegments(source, { patientIdentity });

  // 6 — our own masking left nothing numeric behind
  assertMaskingComplete(masked);

  // 7 — every medication is protected, or the document is refused
  assertMedicationContextProtected(source, masked);

  // 8 — every written-out dosage is protected, or the document is refused
  assertDosageProtected(masked);

  // 9 — outbound payload
  const outbound = masked.map((segment, i) => ({
    index: segment.index,
    kind: segment.kind,
    text: segment.text,
    // The model must return this unchanged; a flipped value is a visible field
    // mismatch rather than a subtle wording change.
    polarity: annotated[i]?.polarity ?? "affirmed",
  }));

  return {
    sourceLanguage: language,
    outbound,
    tokenMap,
    tokens,
    stats: {
      segments: outbound.length,
      tokens: tokens.length,
      negatedSegments: annotated.filter((s) => s.polarity === "negated").length,
      patientIdentifierTokens: tokens.filter((t) => t.kind.startsWith("PATIENT")).length,
    },
  };
}

/**
 * Structural validation of the segment list.
 *
 * Extraction already applies plausibility floors, but this is the canonical
 * entry point: it must not depend on having been reached through one particular
 * caller.
 *
 * @param {{ index: number, kind: string, text: string }[]} segments
 */
function assertSegmentsWellFormed(segments) {
  if (segments.length === 0) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TEXT_UNAVAILABLE, {
      reason: "no_segments",
    });
  }
  if (segments.length > TRANSLATION_LIMITS.MAX_SEGMENTS) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TOO_LARGE, {
      reason: "segment_count",
    });
  }

  segments.forEach((segment, position) => {
    if (typeof segment?.text !== "string") {
      throw new DocumentTranslationError(TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED, {
        reason: "segment_without_text",
        position,
      });
    }
    if (segment.index !== position) {
      // Indices are the identity a model response is validated against. A gap
      // or a reordering here would make that comparison meaningless.
      throw new DocumentTranslationError(TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED, {
        reason: "segment_index_not_sequential",
        position,
      });
    }
    if (segment.text.length > TRANSLATION_LIMITS.MAX_SEGMENT_CHARS) {
      throw new DocumentTranslationError(TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED, {
        reason: "segment_too_large",
        position,
      });
    }
  });
}
