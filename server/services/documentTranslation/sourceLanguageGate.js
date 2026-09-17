/**
 * Source-language gate.
 *
 * ── Why this is a security control, not a convenience ───────────────────────
 * Almost every protection in this feature is written for ONE language. The
 * medication-context triggers ("Gabe von", "nimmt", "Therapie mit"), the
 * safe-word list, the dosage quantity words, the negation cues and the section
 * headings are German, with a partial English overlay. Run them over a French
 * or Russian letter and they simply do not fire: no medication context is
 * recognised, so nothing is refused, and a document nobody checked would be
 * handed to a model as if it had passed.
 *
 * Six UI target languages therefore does NOT mean six source languages.
 *
 * ── What the repository actually knows ──────────────────────────────────────
 * PracticeDocument has no language field. The only nearby language values are
 * DocumentOcrJob.locale — the locale a practice REQUESTED for an OCR run — and
 * DocumentOcrResult.language, which the stub engine derives from that same
 * request (`locale?.startsWith("en") ? "en" : "de"`). Neither is an observation
 * about the document, so neither may be used as one.
 *
 * PracticeProfile.preferredDoctorLanguage exists and defaults to "de", but that
 * is a practice preference for other features. Treating it as "this document is
 * German" is exactly the "a German practice writes German" assumption that must
 * not be made.
 *
 * ── The V1 rule ─────────────────────────────────────────────────────────────
 * The source language must be DECLARED by the caller and must be German. A
 * declaration that is missing, unsupported, or contradicted by the document
 * itself fails closed.
 *
 * The contradiction check is not language detection and does not decide what a
 * document is. It only answers "is this clearly NOT German?" from deterministic
 * evidence — a non-Latin script, or another language's function words with none
 * of German's. No model, no probabilistic classifier.
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "./documentTranslationPolicy.js";

/**
 * Source languages V1 can process safely.
 *
 * German only. Widening this list means porting the medication triggers, safe
 * words, dosage vocabulary and negation cues to that language AND testing them
 * adversarially — not just adding a code here.
 */
export const SUPPORTED_DOCUMENT_SOURCE_LANGUAGES = Object.freeze(["de"]);

/** Minimum characters before the contradiction check can say anything. */
const MIN_CHARS_FOR_LANGUAGE_CHECK = 120;

/**
 * Scripts that rule German out on sight.
 *
 * Unicode property escapes rather than literal character ranges: a range typed
 * as raw characters is easy to mangle in transit and silently stops matching,
 * which is exactly what happened to an earlier draft of this list.
 */
const NON_LATIN_SCRIPTS = [
  { name: "cyrillic", re: /\p{Script=Cyrillic}/gu },
  { name: "greek", re: /\p{Script=Greek}/gu },
  { name: "arabic", re: /\p{Script=Arabic}/gu },
  { name: "hebrew", re: /\p{Script=Hebrew}/gu },
  { name: "han", re: /\p{Script=Han}/gu },
  { name: "hiragana", re: /\p{Script=Hiragana}/gu },
  { name: "katakana", re: /\p{Script=Katakana}/gu },
];

/**
 * Share of non-Latin characters above which the declaration is contradicted.
 * A few Greek letters in a formula are normal; a Cyrillic letter is not.
 */
const MAX_NON_LATIN_RATIO = 0.02;

/** Function words that are common and distinctive in each language. */
const FUNCTION_WORDS = {
  de: ["der", "die", "das", "und", "nicht", "wurde", "wurden", "sich", "eine",
    "einer", "mit", "bei", "auf", "für", "von", "dem", "den", "ist", "sind",
    "wir", "sehr", "geehrte", "ueber", "über", "kein", "keine"],
  en: ["the", "and", "was", "were", "with", "have", "has", "this", "that",
    "there", "which", "patient", "dear", "sincerely", "his", "her", "not"],
  fr: ["le", "la", "les", "des", "une", "est", "sont", "avec", "pour", "dans",
    "cette", "nous", "vous", "aucun", "monsieur", "madame"],
  es: ["el", "la", "los", "las", "una", "con", "para", "por", "que", "del",
    "este", "esta", "usted", "señor", "señora"],
  it: ["il", "la", "le", "dei", "una", "con", "per", "che", "del", "questa",
    "questo", "signora", "signore", "non"],
};

/**
 * Validate the declared source language.
 *
 * @param {unknown} declared  BCP-47-ish code supplied by the caller
 * @returns {string} the normalised, supported language code
 * @throws {DocumentTranslationError} document_source_language_unsupported
 */
export function assertSupportedSourceLanguage(declared) {
  const code = String(declared ?? "").trim().toLowerCase().split("-")[0];

  if (!code) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNSUPPORTED, {
      reason: "not_declared",
    });
  }
  if (!SUPPORTED_DOCUMENT_SOURCE_LANGUAGES.includes(code)) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNSUPPORTED, {
      reason: "unsupported_source_language",
      declared: code,
    });
  }
  return code;
}

/**
 * Check the declaration against the document.
 *
 * Deliberately one-directional: it can only CONTRADICT a declaration, never
 * confirm one. Silence here means "no evidence against", not "verified German".
 *
 * @param {{ text: string }[]} segments  extracted, unmasked
 * @param {string} declaredLanguage  already validated as supported
 * @throws {DocumentTranslationError} document_source_language_uncertain
 */
export function assertLanguageNotContradicted(segments, declaredLanguage) {
  const text = (segments || []).map((s) => String(s?.text ?? "")).join("\n");
  const letters = text.replace(/[^\p{L}]/gu, "").length;

  // Script first, and deliberately BEFORE the length gate. A Cyrillic letter
  // is unambiguous evidence in a way a function-word count is not, so it does
  // not need a corpus to be trustworthy.
  for (const script of NON_LATIN_SCRIPTS) {
    script.re.lastIndex = 0;
    const hits = (text.match(script.re) || []).length;
    if (hits / letters > MAX_NON_LATIN_RATIO) {
      throw new DocumentTranslationError(TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNCERTAIN, {
        reason: "script_mismatch",
        script: script.name,
        declared: declaredLanguage,
      });
    }
  }

  if (letters < MIN_CHARS_FOR_LANGUAGE_CHECK) {
    // Too little text for the function-word comparison to mean anything. The
    // extraction plausibility floors already refuse documents this short, so
    // this is a guard against a needless verdict rather than a gap.
    return { ok: true, checked: false };
  }

  const scores = scoreFunctionWords(text);
  const declaredScore = scores[declaredLanguage] ?? 0;
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  // Fires only on clear evidence: the declared language shows almost no
  // function words while another language shows plenty. A mixed-language
  // document trips this too, which is the intended outcome — the protections
  // are not written for the other half of it.
  if (declaredScore < 3 && best && best[1] >= 5 && best[0] !== declaredLanguage) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNCERTAIN, {
      reason: "function_words_contradict_declaration",
      declared: declaredLanguage,
      // Which language the evidence points at is metadata about form, not
      // content — no document text is included.
      evidenceFor: best[0],
    });
  }

  return { ok: true, checked: true };
}

/**
 * Count distinctive function-word hits per language.
 * @param {string} text
 */
function scoreFunctionWords(text) {
  const words = (text.toLowerCase().match(/\p{L}+/gu) || []).slice(0, 5000);
  const counts = new Set(words);
  const scores = {};
  for (const [language, list] of Object.entries(FUNCTION_WORDS)) {
    scores[language] = list.filter((w) => counts.has(w)).length;
  }
  return scores;
}
