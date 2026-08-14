/**
 * Everything that must happen to a document BEFORE a model could ever see it.
 *
 * Phase 2A and 2A.1 built the pieces; this composes them into one ordered,
 * testable entry point so a later route cannot accidentally skip a step or run
 * them in the wrong order. It performs no model call and no network access.
 *
 * Order is load-bearing:
 *
 *   1 polarity       on the ORIGINAL text, before anything is replaced
 *   2 masking        critical tokens and direct identifiers become markers
 *   3 masking check  our own masking left no digits behind
 *   4 medication     no medication context contains an unprotected product name
 *
 * Step 4 is the fail-closed gate: if a drug name in a medication context cannot
 * be protected locally, the document is refused rather than translated.
 *
 * What comes back is the only thing a model may be given: masked segment text,
 * plus polarity metadata the model must echo unchanged. The token map stays
 * here and never leaves the server.
 */

import { annotateSegmentsWithPolarity } from "./negation/negationDetection.js";
import { maskSegments } from "./masking/criticalTokenMasking.js";
import { assertMaskingComplete } from "./masking/maskedOutputValidation.js";
import { assertMedicationContextProtected } from "./masking/medicationContextGuard.js";

/**
 * @param {{ index: number, kind: string, text: string, page?: number, cells?: string[] }[]} segments
 *   the extraction result, unmasked
 * @returns {{
 *   outbound: { index: number, kind: string, text: string, polarity: string }[],
 *   tokenMap: Map<string, { marker: string, kind: string, original: string }>,
 *   tokens: { marker: string, kind: string, original: string }[],
 *   stats: { segments: number, tokens: number, negatedSegments: number },
 * }}
 */
export function prepareSegmentsForTranslation(segments) {
  const source = Array.isArray(segments) ? segments : [];

  // 1 — polarity is read from the original wording. Running it after masking
  // would analyse text with markers in place of clinically relevant tokens.
  const annotated = annotateSegmentsWithPolarity(source);

  // 2 — mask
  const { segments: masked, tokens, tokenMap } = maskSegments(source);

  // 3 — self-check: if our own masking left a digit behind, that value would
  // otherwise be exposed to the model. Fail rather than continue.
  assertMaskingComplete(masked);

  // 4 — fail closed on unprotectable medication
  assertMedicationContextProtected(source, masked);

  const outbound = masked.map((segment, i) => ({
    index: segment.index,
    kind: segment.kind,
    text: segment.text,
    // The model must return this field unchanged; a flipped value is a visible
    // field mismatch rather than a subtle wording change.
    polarity: annotated[i]?.polarity ?? "affirmed",
  }));

  return {
    outbound,
    tokenMap,
    tokens,
    stats: {
      segments: outbound.length,
      tokens: tokens.length,
      negatedSegments: annotated.filter((s) => s.polarity === "negated").length,
    },
  };
}
