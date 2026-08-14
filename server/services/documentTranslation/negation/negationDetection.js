/**
 * Source-side negation detection (deterministic, no model).
 *
 * Purpose: attach a `polarity` label to each segment BEFORE translation, so a
 * later stage can (a) hand the model an explicit field it must echo back
 * unchanged, and (b) know which segments deserve extra scrutiny.
 *
 * Phase 2A implements the source analysis only. There is deliberately NO
 * back-translation and no second model call — that would mean sending document
 * text out twice, and the data-protection question is still open.
 *
 * ── Approach ────────────────────────────────────────────────────────────────
 * Cue-based, in the style of NegEx/ConText, applied to the SOURCE language
 * only. Comparing negation across languages by counting cue words does not
 * work: German "kein Hinweis" has one cue, its correct Russian rendering
 * "никаких признаков нет" has two, and a correct English rendering may move the
 * negation from the noun to the verb. Analysing one language avoids all of that.
 *
 * ── What is detected reliably ───────────────────────────────────────────────
 *   • Explicit clinical negation cues: "kein Hinweis auf", "kein Anhalt für",
 *     "kein Nachweis von", "nicht nachweisbar", "ohne", "frei von", "negativ",
 *     and the English equivalents.
 *   • Pseudo-negations that must NOT count as negation ("nicht nur").
 *   • Double negations that flip the meaning back to possible
 *     ("nicht auszuschließen" = the finding is NOT ruled out).
 *
 * ── What is NOT detected, stated plainly ────────────────────────────────────
 *   • Morphological negation: "befundlos", "beschwerdefrei", "unauffällig" is
 *     included as a cue but "symptomlos"-style compounds in general are not.
 *   • Scope: a cue marks the SEGMENT, not the specific finding inside it. A
 *     segment containing both a negated and an affirmed finding is labelled
 *     negated, which is deliberately the cautious direction but is not precise.
 *   • Source languages other than German and English.
 *   • Negation expressed only by layout, e.g. an unticked checkbox.
 *
 * This is a layered defence, not a proof. No mathematical guarantee is claimed
 * here, in contrast to critical-token masking, where the guarantee is real
 * because the value never reaches the model.
 */

/** Segment polarity labels. */
export const POLARITY = Object.freeze({
  AFFIRMED: "affirmed",
  NEGATED: "negated",
});

/**
 * Spans that look like negation but are not, removed before cue matching.
 * Order matters only in that these run first.
 */
const PSEUDO_NEGATION = [
  /\bnicht\s+nur\b/gi,
  /\bnicht\s+zuletzt\b/gi,
  /\bnicht\s+zwingend\b/gi,
  /\bnot\s+only\b/gi,
  /\bnot\s+necessarily\b/gi,
  /\bno\s+wonder\b/gi,
];

/**
 * Double negations: the finding is explicitly NOT excluded, i.e. still possible.
 * These must not be read as a negated finding.
 */
const DOUBLE_NEGATION = [
  /\bnicht\s+(?:sicher\s+)?aus(?:zu)?schlie(?:ss|ß)en\b/gi,
  /\bnicht\s+ausgeschlossen\b/gi,
  /\bkann\s+nicht\s+ausgeschlossen\s+werden\b/gi,
  /\bcannot\s+be\s+(?:fully\s+)?excluded\b/gi,
  /\bcannot\s+be\s+ruled\s+out\b/gi,
  /\bnot\s+excluded\b/gi,
];

/**
 * Clinical negation cues, German and English.
 * Multi-word cues appear before their single-word constituents.
 */
const NEGATION_CUES = [
  // German — explicit clinical phrasings
  /\bkein(?:e|en|em|er|es)?\s+Hinweis(?:e)?\s+(?:auf|für)\b/gi,
  /\bkein(?:e|en|em|er|es)?\s+Anhalt\s+(?:für|auf)\b/gi,
  /\bkein(?:e|en|em|er|es)?\s+Nachweis\s+(?:von|für)\b/gi,
  /\bkein(?:e|en|em|er|es)?\s+Anzeichen\b/gi,
  /\bkein(?:e|en|em|er|es)?\s+Zeichen\s+(?:für|von)\b/gi,
  /\bnicht\s+nachweisbar\b/gi,
  /\bnicht\s+nachgewiesen\b/gi,
  /\bnicht\s+erkennbar\b/gi,
  /\bnicht\s+feststellbar\b/gi,
  /\bfrei\s+von\b/gi,
  /\bnegativ\s+(?:für|auf)\b/gi,
  /\bausgeschlossen\b/gi,
  /\bverneint\b/gi,
  /\bunauffällig\b/gi,
  /\bregelrecht\b/gi,
  /\bohne\s+(?:Hinweis|Anhalt|Nachweis|Befund|pathologisch)/gi,
  // German — bare cues, matched last
  /\bkein(?:e|en|em|er|es)?\b/gi,
  /\bnicht\b/gi,
  /\bniemals\b/gi,
  /\bnie\b/gi,

  // English
  /\bno\s+evidence\s+of\b/gi,
  /\bno\s+sign(?:s)?\s+of\b/gi,
  /\bno\s+indication\s+of\b/gi,
  /\bnot\s+detected\b/gi,
  /\bnot\s+present\b/gi,
  /\bfree\s+(?:of|from)\b/gi,
  /\bnegative\s+for\b/gi,
  /\bruled\s+out\b/gi,
  /\bunremarkable\b/gi,
  /\bwithout\s+(?:evidence|sign|indication)/gi,
  /\bno\b/gi,
  /\bnot\b/gi,
  /\bnever\b/gi,
];

/**
 * @typedef {object} PolarityResult
 * @property {string} polarity           POLARITY value
 * @property {string[]} cues             matched cue surface forms, source language
 * @property {boolean} doubleNegation    a "not excluded" construct was present
 */

/**
 * Analyse one piece of source text.
 *
 * @param {string} text
 * @returns {PolarityResult}
 */
export function detectPolarity(text) {
  const source = String(text ?? "");
  if (!source.trim()) {
    return { polarity: POLARITY.AFFIRMED, cues: [], doubleNegation: false };
  }

  let doubleNegation = false;
  let working = source;

  // Pseudo-negations are blanked out so their "nicht" cannot trigger a cue.
  for (const re of PSEUDO_NEGATION) {
    re.lastIndex = 0;
    working = working.replace(re, (m) => " ".repeat(m.length));
  }

  // Double negations are recorded and then blanked: "nicht auszuschließen"
  // means the finding stands, so its "nicht" must not negate the segment.
  for (const re of DOUBLE_NEGATION) {
    re.lastIndex = 0;
    working = working.replace(re, (m) => {
      doubleNegation = true;
      return " ".repeat(m.length);
    });
  }

  const cues = [];
  const claimed = [];

  for (const re of NEGATION_CUES) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(working)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      // A longer, more specific cue already covers this span — do not count the
      // bare "kein" inside "kein Hinweis auf" a second time.
      if (claimed.some(([s, e]) => start >= s && end <= e)) continue;
      claimed.push([start, end]);
      cues.push(match[0].trim());
      if (match[0].length === 0) re.lastIndex += 1;
    }
  }

  return {
    polarity: cues.length > 0 ? POLARITY.NEGATED : POLARITY.AFFIRMED,
    cues,
    doubleNegation,
  };
}

/**
 * Attach polarity metadata to an ordered segment list.
 *
 * Returns new objects; the input is not mutated, so the extraction result stays
 * the untouched record of what the document actually contained.
 *
 * @param {{ index: number, kind: string, text: string }[]} segments
 * @returns {{ index: number, kind: string, text: string, polarity: string, negationCues: string[], doubleNegation: boolean }[]}
 */
export function annotateSegmentsWithPolarity(segments) {
  return (segments || []).map((seg) => {
    const result = detectPolarity(seg?.text);
    return {
      ...seg,
      polarity: result.polarity,
      negationCues: result.cues,
      doubleNegation: result.doubleNegation,
    };
  });
}

/**
 * Segments a later verification stage should treat as high-risk.
 * @param {{ polarity: string, doubleNegation: boolean }[]} segments
 */
export function selectPolaritySensitiveSegments(segments) {
  return (segments || []).filter(
    (s) => s?.polarity === POLARITY.NEGATED || s?.doubleNegation === true,
  );
}
