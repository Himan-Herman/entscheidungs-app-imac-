/**
 * Validation of a masked translation result — fail closed, no partial output.
 *
 * Nothing here calls a model. This module is the gate a model response must
 * pass before a single marker is restored. If any check fails the whole result
 * is discarded with integrity_failed; there is deliberately no "mostly fine"
 * path and no warning-banner degradation, because a patient cannot tell a
 * partially corrupted medical document from a correct one.
 *
 * Checks performed:
 *   1 segment count matches
 *   2 segment indices match, in order
 *   3 every expected marker is present
 *   4 no expected marker is missing
 *   5 no unknown marker was invented
 *   6 no marker is duplicated
 *   7 every marker stayed in its own segment
 *   8 marker order preserved within a segment (strict mode only)
 *   9 no digits outside markers — i.e. no invented number, dose or measurement
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
  TRANSLATION_MODES,
} from "../documentTranslationPolicy.js";
import { findMarkers, findUnmaskedDigits } from "./criticalTokenMasking.js";

/**
 * @typedef {object} IntegrityViolation
 * @property {string} rule
 * @property {number} [segmentIndex]
 * @property {string[]} [markers]
 */

/**
 * Assert that masking left no digits behind.
 *
 * This is a self-check on our own masking, not on the model. If it ever fires,
 * the token patterns have a gap and unmasked values would otherwise be exposed
 * to the model — so it fails closed rather than continuing.
 *
 * @param {{ index: number, text: string }[]} maskedSegments
 */
export function assertMaskingComplete(maskedSegments) {
  for (const seg of maskedSegments || []) {
    const leftovers = findUnmaskedDigits(seg?.text ?? "");
    if (leftovers.length > 0) {
      throw new DocumentTranslationError(TRANSLATION_ERRORS.INTEGRITY_FAILED, {
        rule: "masking_incomplete",
        segmentIndex: seg?.index,
        // Count only. The values themselves are document content and are never
        // put into an error object that may be logged.
        count: leftovers.length,
      });
    }
  }
}

/**
 * Validate a model response against the masked source.
 *
 * @param {object} input
 * @param {{ index: number, text: string }[]} input.maskedSegments  what was sent
 * @param {{ index: number, text: string }[]} input.outputSegments  what came back
 * @param {string} input.mode  TRANSLATION_MODES value
 * @returns {{ ok: true }}
 * @throws {DocumentTranslationError} integrity_failed on any violation
 */
export function validateMaskedOutput(input) {
  const expected = Array.isArray(input?.maskedSegments) ? input.maskedSegments : [];
  const actual = Array.isArray(input?.outputSegments) ? input.outputSegments : [];
  const mode = input?.mode;

  /** @type {IntegrityViolation[]} */
  const violations = [];

  // 1 — segment count
  if (expected.length !== actual.length) {
    fail({ rule: "segment_count_mismatch", expected: expected.length, actual: actual.length });
  }

  const seenGlobally = new Map();

  for (let i = 0; i < expected.length; i += 1) {
    const src = expected[i];
    const out = actual[i];

    // 2 — segment identity, positionally and by index
    if (!out || out.index !== src.index) {
      fail({
        rule: "segment_index_mismatch",
        position: i,
        expectedIndex: src.index,
        actualIndex: out?.index,
      });
    }

    const outText = typeof out.text === "string" ? out.text : "";

    const srcMarkers = findMarkers(src.text ?? "");
    const outMarkers = findMarkers(outText);

    const srcSet = new Set(srcMarkers);
    const outCounts = countBy(outMarkers);

    // 3 + 4 — every expected marker present exactly once
    for (const marker of srcSet) {
      const n = outCounts.get(marker) ?? 0;
      if (n === 0) violations.push({ rule: "marker_missing", segmentIndex: src.index, markers: [marker] });
      else if (n > 1) violations.push({ rule: "marker_duplicated", segmentIndex: src.index, markers: [marker] });
    }

    // 5 + 7 — nothing invented, nothing migrated in from another segment
    for (const marker of outCounts.keys()) {
      if (!srcSet.has(marker)) {
        violations.push({ rule: "marker_unknown", segmentIndex: src.index, markers: [marker] });
      }
      const previous = seenGlobally.get(marker);
      if (previous !== undefined && previous !== src.index) {
        violations.push({ rule: "marker_moved_between_segments", segmentIndex: src.index, markers: [marker] });
      }
      seenGlobally.set(marker, src.index);
    }

    // 8 — order, strict mode only.
    // Plain-language rendering may legitimately reorder a clause, so order is
    // not enforced there; completeness still is, in every mode.
    if (mode === TRANSLATION_MODES.STRICT) {
      const srcOrder = srcMarkers.filter((m, idx) => srcMarkers.indexOf(m) === idx);
      const outOrder = outMarkers.filter((m, idx) => outMarkers.indexOf(m) === idx);
      if (srcOrder.length === outOrder.length && srcOrder.join("|") !== outOrder.join("|")) {
        violations.push({ rule: "marker_order_changed", segmentIndex: src.index });
      }
    }

    // 9 — invented numeric material.
    // Masked source has no digits outside markers by construction, so any digit
    // here originated with the model: a new dose, value, date or measurement.
    const invented = findUnmaskedDigits(outText);
    if (invented.length > 0) {
      violations.push({
        rule: "invented_numeric_value",
        segmentIndex: src.index,
        count: invented.length,
      });
    }
  }

  if (violations.length > 0) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.INTEGRITY_FAILED, {
      violations: violations.slice(0, 20),
      violationCount: violations.length,
    });
  }

  return { ok: true };
}

/** @param {Record<string, unknown>} detail */
function fail(detail) {
  throw new DocumentTranslationError(TRANSLATION_ERRORS.INTEGRITY_FAILED, detail);
}

/** @param {string[]} list */
function countBy(list) {
  const m = new Map();
  for (const item of list) m.set(item, (m.get(item) ?? 0) + 1);
  return m;
}
