/**
 * Safety policy for document transformation — invented advice detection.
 *
 * ── Why this is not the existing sanitizer ──────────────────────────────────
 * services/aiSafetySanitizer.js scrubs forbidden wording out of AI output. That
 * is right for a symptom checker, where every sentence originates with the
 * model. It is wrong here: this feature translates a document a clinician
 * wrote, and a real letter legitimately says "Bitte stellen Sie sich morgen
 * erneut vor." Scrubbing that would delete the doctor's own instruction and
 * hand the patient a quietly incomplete document — a worse failure than
 * refusing.
 *
 * So the question is not "does the output contain advice?" but "does the output
 * contain advice the SOURCE did not?".
 *
 * ── How it decides ──────────────────────────────────────────────────────────
 * Per segment: count advice-like cues in the source, count them in the output,
 * and fail only when the output has them and the source had none. Cues are
 * listed for German (the only supported source language) and for all six target
 * languages, so a translated instruction is recognised on both sides.
 *
 * ── Deliberate limits ───────────────────────────────────────────────────────
 * This is a per-segment presence comparison, not semantic understanding. It
 * reliably catches the case that matters — a model appending "You should
 * consult your doctor immediately" to a segment that carried no instruction at
 * all. It cannot detect an invented recommendation inside a segment that
 * already contained a different one.
 *
 * On detection the whole transformation is REFUSED. Nothing is deleted or
 * rewritten: silently editing medical text is precisely the failure mode this
 * feature exists to avoid, and a refusal leaves the patient with the unaltered
 * original.
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "./documentTranslationPolicy.js";

/**
 * Advice and directive cues.
 *
 * Grouped by language for reviewability. German covers the source side; the
 * others cover the target side, since an instruction translated into English
 * has to be recognised as the same instruction.
 */
const ADVICE_CUES = [
  // German — imperatives and directives
  /\bbitte\s+(?:stellen|kommen|nehmen|melden|vereinbaren|suchen|wenden|beachten|setzen)\b/i,
  /\bsollten?\s+Sie\b/i,
  /\bmüssen\s+Sie\b/i,
  /\bwir\s+empfehlen\b/i,
  /\bempfohlen\s+wird\b/i,
  /\bsuchen\s+Sie\b/i,
  /\bwenden\s+Sie\s+sich\b/i,
  /\bstellen\s+Sie\s+sich\b/i,
  /\bvereinbaren\s+Sie\b/i,
  /\bunverzüglich\b/i,
  /\bsofort\s+(?:einen|zum|zur|ärztlich)/i,
  /\bnotfall\w*\s+(?:aufsuchen|kontaktieren)/i,
  // English
  /\byou\s+should\b/i,
  /\byou\s+must\b/i,
  /\byou\s+need\s+to\b/i,
  /\bwe\s+recommend\b/i,
  /\bit\s+is\s+recommended\b/i,
  /\bplease\s+(?:contact|consult|see|arrange|attend|return|seek)\b/i,
  /\bconsult\s+(?:your|a)\s+(?:doctor|physician|gp)\b/i,
  /\bseek\s+(?:medical|immediate|urgent)\b/i,
  /\bimmediately\b/i,
  /\bas\s+soon\s+as\s+possible\b/i,
  // French
  /\bvous\s+(?:devez|devriez)\b/i,
  /\bnous\s+recommandons\b/i,
  /\bveuillez\s+(?:consulter|contacter|prendre)\b/i,
  /\bimmédiatement\b/i,
  // Spanish
  /\b(?:debe|debería)\s+(?:usted\s+)?(?:consultar|acudir|contactar|tomar)\b/i,
  /\brecomendamos\b/i,
  /\bpor\s+favor,?\s+(?:consulte|acuda|contacte)\b/i,
  /\binmediatamente\b/i,
  // Italian
  /\b(?:deve|dovrebbe)\s+(?:consultare|contattare|rivolgersi|prendere)\b/i,
  /\bconsigliamo\b/i,
  /\bsi\s+rivolga\b/i,
  /\bimmediatamente\b/i,
  // Russian
  /\bвам\s+сле́?дует\b/i,
  /\bмы\s+рекоменду[еи]м\b/i,
  /\bобратитесь\b/i,
  /\bнемедленно\b/i,
  /\bсрочно\s+обрат/i,
];

/**
 * Cues for claims a translation must never introduce: a risk, a prognosis or a
 * causal medical consequence. These are the plain-language failure mode —
 * "Bluthochdruck, dadurch haben Sie ein erhöhtes Herzinfarktrisiko".
 */
const CLAIM_CUES = [
  /\berhöht[es]?\s+risiko\b/i,
  /\brisiko\s+für\b/i,
  /\bdadurch\s+(?:haben|besteht|steigt)\b/i,
  /\bkann\s+zu\s+\w+\s+führen\b/i,
  /\bführt\s+zu\s+(?:einem|einer)\b/i,
  /\blebensgefährlich\b/i,
  /\bincreased\s+risk\b/i,
  /\brisk\s+of\b/i,
  /\bcan\s+lead\s+to\b/i,
  /\bmay\s+cause\b/i,
  /\bthis\s+means\s+(?:that\s+)?you\b/i,
  /\blife[-\s]threatening\b/i,
  /\brisque\s+(?:accru|de)\b/i,
  /\bpeut\s+(?:entraîner|provoquer)\b/i,
  /\briesgo\s+(?:de|elevado)\b/i,
  /\bpuede\s+(?:causar|provocar)\b/i,
  /\brischio\s+(?:di|elevato)\b/i,
  /\bpuò\s+(?:causare|provocare)\b/i,
  /\bриск\b/i,
  /\bможет\s+привести\b/i,
];

/**
 * Compare source and output per segment and refuse if the output introduced
 * directive or claim language the source did not have.
 *
 * @param {object} input
 * @param {{ index: number, text: string }[]} input.sourceSegments   original, unmasked
 * @param {{ index: number, text: string }[]} input.outputSegments   restored, unmasked
 * @returns {{ ok: true }}
 * @throws {DocumentTranslationError} integrity_failed
 */
export function assertNoInventedGuidance(input) {
  const source = new Map(
    (input?.sourceSegments ?? []).map((s) => [s.index, String(s?.text ?? "")]),
  );

  const violations = [];

  for (const segment of input?.outputSegments ?? []) {
    const originalText = source.get(segment.index) ?? "";
    const outputText = String(segment?.text ?? "");

    for (const [rule, cues] of [
      ["invented_directive", ADVICE_CUES],
      ["invented_claim", CLAIM_CUES],
    ]) {
      const inOutput = matches(outputText, cues);
      if (inOutput === 0) continue;
      const inSource = matches(originalText, cues);
      if (inSource === 0) {
        violations.push({ rule, segmentIndex: segment.index });
      }
    }
  }

  if (violations.length > 0) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.INTEGRITY_FAILED, {
      // Metadata only — the offending sentence is document-derived content.
      reason: "invented_guidance",
      violations: violations.slice(0, 20),
      violationCount: violations.length,
    });
  }

  return { ok: true };
}

/**
 * Count cue hits.
 * @param {string} text
 * @param {RegExp[]} cues
 */
function matches(text, cues) {
  let count = 0;
  for (const cue of cues) {
    cue.lastIndex = 0;
    if (cue.test(text)) count += 1;
  }
  return count;
}

/** Exposed for tests so the cue sets can be asserted on directly. */
export const SAFETY_CUE_COUNTS = Object.freeze({
  advice: ADVICE_CUES.length,
  claim: CLAIM_CUES.length,
});
