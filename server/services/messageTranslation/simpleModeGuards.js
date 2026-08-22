/**
 * Semantic guardrails for the simple mode.
 *
 * ── The problem these address ───────────────────────────────────────────────
 * Faithful translation and plain rewriting fail differently. A translation that
 * goes wrong usually goes visibly wrong. A rewrite that goes wrong reads
 * perfectly: "Verdacht auf Migräne" becomes "Sie haben Migräne", "das
 * Medikament nicht weiternehmen" becomes "nehmen Sie das Medikament weiter",
 * and both are fluent, confident and false.
 *
 * Critical-token masking cannot help here. It protects VALUES — doses, dates,
 * drug names — and these failures do not touch a value. They change what the
 * sentence around it asserts.
 *
 * ── What is checked, and how far it reaches ─────────────────────────────────
 * Three properties, in one direction only: if the ORIGINAL expresses something
 * and the output expresses none of it, the output is refused.
 *
 *   negation     "nicht", "kein", "ohne"        — an instruction not to do
 *                                                 something must not become an
 *                                                 instruction to do it
 *   condition    "wenn", "falls", "bei Bedarf"  — a conditional must not become
 *                                                 unconditional
 *   uncertainty  "Verdacht auf", "vermutlich"   — a suspicion must not become a
 *                                                 statement of fact
 *
 * The reverse direction is deliberately NOT checked here. A rewrite that ADDS a
 * condition or a hedge is caught by the invented-guidance detector, and a rule
 * against it would fire on legitimate rewordings.
 *
 * ── What this is not ────────────────────────────────────────────────────────
 * Presence detection, not semantic comparison. It can tell that a negation
 * disappeared entirely; it cannot tell that a negation moved to the wrong
 * clause, that "for three days" became "for three weeks" in words rather than
 * digits, or that one of four statements was dropped. Nothing here establishes
 * that two texts mean the same thing, and this module must never be described
 * as if it did.
 *
 * ── Across languages the reach is shorter ───────────────────────────────────
 * When the output is in the source's own language, cue comparison is direct and
 * this is at its strongest — and that is the main case, a German message made
 * easier to read in German. When the output is a translation, the cue sets are
 * matched per language, which detects a property vanishing but not one rendered
 * in a construction the list does not know. `strength` reports which of the two
 * applied, so a caller never mistakes the weaker check for the stronger one.
 */

import { detectPolarity, POLARITY } from "../documentTranslation/negation/negationDetection.js";

/**
 * Cues per language.
 *
 * Grouped by property and then by language so a reviewer can read one property
 * across all six at once. Written out rather than generated: a cue list is a
 * claim about a language, and each entry deserves to be visible.
 */
const NEGATION_CUES = {
  de: [/\bnicht\b/i, /\bnichts\b/i, /\bkein(e|en|em|er|es)?\b/i, /\bohne\b/i, /\bniemals\b/i, /\bnie\b/i, /\bweder\b/i, /\bfrei\s+von\b/i, /\bunauff[äa]llig\b/i, /\bnegativ\b/i],
  en: [/\bnot\b/i, /\bnothing\b/i, /\bno\b/i, /\bnone\b/i, /\bwithout\b/i, /\bnever\b/i, /\bneither\b/i, /n't\b/i, /\bfree\s+of\b/i, /\bunremarkable\b/i, /\bnegative\b/i],
  fr: [/\bne\b/i, /\bpas\b/i, /\brien\b/i, /\baucun(e)?\b/i, /\bsans\b/i, /\bjamais\b/i, /\bni\b/i, /\bn[ée]gatif\b/i, /\bnormale?\b/i],
  es: [/\bno\b/i, /\bnada\b/i, /\bning[uú]n(a|o)?\b/i, /\bsin\b/i, /\bnunca\b/i, /\bjam[aá]s\b/i, /\btampoco\b/i, /\bnegativ[oa]\b/i, /\bnormal\b/i],
  it: [/\bnon\b/i, /\bnulla\b/i, /\bniente\b/i, /\bnessun(a|o)?\b/i, /\bsenza\b/i, /\bmai\b/i, /\bn[eé]\b/i, /\bnegativ[oa]\b/i, /\bnormale\b/i],
  ru: [/\bне\b/i, /\bнет\b/i, /\bничего\b/i, /\bни\b/i, /\bбез\b/i, /\bникогда\b/i, /\bотрицательн/i, /\bнорм/i],
};

const CONDITION_CUES = {
  de: [/\bwenn\b/i, /\bfalls\b/i, /\bsofern\b/i, /\bsobald\b/i, /\bbei\s+bedarf\b/i, /\bnur\s+wenn\b/i, /\bau[sß]er\b/i, /\bandernfalls\b/i],
  en: [/\bif\b/i, /\bin\s+case\b/i, /\bas\s+soon\s+as\b/i, /\bwhen(ever)?\b/i, /\bas\s+needed\b/i, /\bonly\s+if\b/i, /\bunless\b/i, /\botherwise\b/i],
  fr: [/\bsi\b/i, /\ben\s+cas\b/i, /\bd[eè]s\s+que\b/i, /\bau\s+besoin\b/i, /\bseulement\s+si\b/i, /\bsauf\b/i, /\bsinon\b/i],
  es: [/\bsi\b/i, /\ben\s+caso\b/i, /\ben\s+cuanto\b/i, /\bsi\s+es\s+necesario\b/i, /\bsolo\s+si\b/i, /\bsalvo\b/i, /\bde\s+lo\s+contrario\b/i],
  it: [/\bse\b/i, /\bin\s+caso\b/i, /\bappena\b/i, /\bal\s+bisogno\b/i, /\bsolo\s+se\b/i, /\bsalvo\b/i, /\baltrimenti\b/i],
  ru: [/\bесли\b/i, /\bв\s+случае\b/i, /\bкак\s+только\b/i, /\bпри\s+необходимости\b/i, /\bтолько\s+если\b/i, /\bкроме\b/i, /\bиначе\b/i],
};

const UNCERTAINTY_CUES = {
  de: [/\bverdacht\s+auf\b/i, /\bvermutlich\b/i, /\bm[oö]glicherweise\b/i, /\bwahrscheinlich\b/i, /\beventuell\b/i, /\bvielleicht\b/i, /\bk[oö]nnte\b/i, /\bkann\b/i, /\bich\s+glaube\b/i, /\bscheint\b/i, /\bggf\b/i],
  en: [/\bsuspected\b/i, /\bsuspicion\b/i, /\bpossibly\b/i, /\bprobably\b/i, /\blikely\b/i, /\bperhaps\b/i, /\bmaybe\b/i, /\bmight\b/i, /\bcould\b/i, /\bmay\b/i, /\bi\s+think\b/i, /\bseems\b/i],
  fr: [/\bsuspicion\b/i, /\bsuspect[ée]e?\b/i, /\bprobablement\b/i, /\bpeut-[êe]tre\b/i, /\bpossiblement\b/i, /\b[ée]ventuellement\b/i, /\bpourrait\b/i, /\bsemble\b/i, /\bje\s+crois\b/i],
  es: [/\bsospecha\b/i, /\bprobablemente\b/i, /\bposiblemente\b/i, /\bquiz[aá]s?\b/i, /\btal\s+vez\b/i, /\bpodr[ií]a\b/i, /\bparece\b/i, /\bcreo\b/i],
  it: [/\bsospetto\b/i, /\bprobabilmente\b/i, /\bpossibilmente\b/i, /\bforse\b/i, /\beventualmente\b/i, /\bpotrebbe\b/i, /\bsembra\b/i, /\bcredo\b/i],
  ru: [/\bподозрение\b/i, /\bвероятно\b/i, /\bвозможно\b/i, /\bскорее\s+всего\b/i, /\bможет\b/i, /\bкажется\b/i, /\bдумаю\b/i],
};

/**
 * Reassurance — the one property checked in the OTHER direction.
 *
 * The invented-guidance detector catches an added instruction ("you should see
 * a doctor"). It does not catch an added comfort: "Der Befund ist unauffällig"
 * followed by "Sie müssen sich keine Sorgen machen" is not advice and not a
 * claim about a finding — it is a sentence about how the reader should feel,
 * and nobody wrote it.
 *
 * That failure belongs to this mode in particular. A faithful translation has
 * no reason to reassure anyone; a rewrite asked to be "easier to understand"
 * has every temptation to. So the rule is narrow and one-directional: comfort
 * in the output that was not in the original means the rendering is discarded.
 * A message whose author DID write it keeps it, because the source is checked
 * too.
 */
const REASSURANCE_CUES = {
  de: [/\bkeine\s+sorgen\b/i, /\bkein\s+grund\s+zur\s+sorge\b/i, /\bnichts\s+zu\s+bef[üu]rchten\b/i, /\bunbedenklich\b/i, /\balles\s+(ist\s+)?in\s+ordnung\b/i, /\bbeunruhig/i, /\bentwarnung\b/i],
  en: [/\bdon'?t\s+worry\b/i, /\bno\s+(need\s+to\s+worry|cause\s+for\s+concern|reason\s+to\s+worry)\b/i, /\bnothing\s+to\s+worry\b/i, /\beverything\s+is\s+fine\b/i, /\breassur/i],
  fr: [/\bne\s+vous\s+inqui[ée]tez\b/i, /\baucune\s+inqui[ée]tude\b/i, /\brien\s+[àa]\s+craindre\b/i, /\btout\s+va\s+bien\b/i, /\brassur/i],
  es: [/\bno\s+se\s+preocupe\b/i, /\bno\s+hay\s+(de\s+qu[ée]\s+preocuparse|motivo\s+de\s+preocupaci[óo]n)\b/i, /\bnada\s+que\s+temer\b/i, /\btodo\s+est[áa]\s+bien\b/i],
  it: [/\bnon\s+si\s+preoccupi\b/i, /\bnessuna\s+preoccupazione\b/i, /\bnulla\s+di\s+cui\s+preoccuparsi\b/i, /\btutto\s+(va\s+)?bene\b/i],
  ru: [/\bне\s+беспокойтесь\b/i, /\bне\s+волнуйтесь\b/i, /\bнет\s+повода\s+для\s+беспокойства\b/i, /\bвсё\s+в\s+порядке\b/i],
};

const PROPERTIES = Object.freeze([
  { key: "negation", cues: NEGATION_CUES },
  { key: "condition", cues: CONDITION_CUES },
  { key: "uncertainty", cues: UNCERTAINTY_CUES },
]);

/** Languages whose cue lists exist. Anything else is reported, not guessed at. */
export const GUARDED_LANGUAGES = Object.freeze(Object.keys(NEGATION_CUES));

/** @param {string} text @param {RegExp[]} cues */
function hasAny(text, cues) {
  return (cues ?? []).some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

/** Languages the shared clinical negation detector actually analyses. */
const DETECTOR_LANGUAGES = new Set(["de", "en"]);

/**
 * Which of the three properties the SOURCE expresses.
 *
 * For negation in German and English the shared clinical detector decides ALONE.
 * It knows that "nicht nur" is not a negation and that "nicht auszuschließen"
 * negates twice and therefore affirms; a plain cue list does not, and ORing one
 * in would undo exactly that knowledge — "Nicht nur die Werte sind gut" would
 * count as negated, and a correct rewrite dropping the "nicht" would then be
 * refused.
 *
 * For the other source languages there is no detector, so the cue list is what
 * there is. That is a weaker answer, and `findLostProperties` reports it as
 * such rather than presenting the two as equivalent.
 *
 * @param {string} text
 * @param {string} language source language code
 */
export function describeSourceProperties(text, language) {
  const lang = String(language ?? "").toLowerCase();
  const source = String(text ?? "");

  const negation = DETECTOR_LANGUAGES.has(lang)
    ? detectPolarity(source).polarity === POLARITY.NEGATED
    : hasAny(source, NEGATION_CUES[lang]);

  return {
    language: lang,
    negation,
    condition: hasAny(source, CONDITION_CUES[lang]),
    uncertainty: hasAny(source, UNCERTAINTY_CUES[lang]),
  };
}

/**
 * Did any of the source's properties disappear from the output?
 *
 * @param {{ sourceText: string, sourceLanguage: string, outputText: string, targetLanguage: string }} input
 * @returns {{ ok: boolean, lost: string[], strength: "same_language" | "cross_language" | "unguarded", checked: string[] }}
 */
export function findLostProperties(input) {
  const sourceLanguage = String(input?.sourceLanguage ?? "").toLowerCase();
  const targetLanguage = String(input?.targetLanguage ?? "").toLowerCase();
  const sourceText = String(input?.sourceText ?? "");
  const outputText = String(input?.outputText ?? "");

  // Without cue lists for both sides there is nothing to compare. Saying so is
  // the honest answer; inventing a comparison would be worse than none.
  const guardable =
    GUARDED_LANGUAGES.includes(sourceLanguage) && GUARDED_LANGUAGES.includes(targetLanguage);
  if (!guardable) {
    return { ok: true, lost: [], strength: "unguarded", checked: [] };
  }

  const present = describeSourceProperties(sourceText, sourceLanguage);
  const lost = [];
  const checked = [];

  for (const { key, cues } of PROPERTIES) {
    if (!present[key]) continue;
    checked.push(key);

    // Negation in German and English is read on BOTH sides with the same
    // instrument. Judging the source with the clinical detector and the output
    // with a plainer cue list would refuse correct rewrites: the detector reads
    // "unauffällig" as negated, and a rewrite saying "zeigt nichts Auffälliges"
    // is right — it simply says it another way. One instrument, both sides.
    const stillPresent = DETECTOR_LANGUAGES.has(targetLanguage) && key === "negation"
      ? detectPolarity(outputText).polarity === POLARITY.NEGATED ||
        hasAny(outputText, cues[targetLanguage])
      : hasAny(outputText, cues[targetLanguage]);

    if (!stillPresent) lost.push(key);
  }

  // The one check in the other direction. Comfort the author did not write is
  // not a plainer rendering of anything.
  checked.push("reassurance");
  const addedReassurance =
    hasAny(outputText, REASSURANCE_CUES[targetLanguage]) &&
    !hasAny(sourceText, REASSURANCE_CUES[sourceLanguage]);
  if (addedReassurance) lost.push("added_reassurance");

  return {
    ok: lost.length === 0,
    lost,
    strength: sourceLanguage === targetLanguage ? "same_language" : "cross_language",
    checked,
  };
}
