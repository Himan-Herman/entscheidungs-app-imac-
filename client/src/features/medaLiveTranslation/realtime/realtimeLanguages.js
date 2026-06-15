/**
 * Language list for Meda Realtime interpreter.
 * All codes are ISO 639-1 and accepted by gpt-4o-transcribe (Whisper-based).
 * label: displayed in the German UI.
 */
export const REALTIME_LANGUAGES = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'Englisch' },
  { code: 'fr', label: 'Französisch' },
  { code: 'es', label: 'Spanisch' },
  { code: 'it', label: 'Italienisch' },
  { code: 'pt', label: 'Portugiesisch' },
  { code: 'nl', label: 'Niederländisch' },
  { code: 'pl', label: 'Polnisch' },
  { code: 'ru', label: 'Russisch' },
  { code: 'ar', label: 'Arabisch' },
  { code: 'tr', label: 'Türkisch' },
  { code: 'ro', label: 'Rumänisch' },
  { code: 'hr', label: 'Kroatisch' },
  { code: 'uk', label: 'Ukrainisch' },
  { code: 'vi', label: 'Vietnamesisch' },
  { code: 'zh', label: 'Chinesisch' },
  { code: 'fa', label: 'Persisch (Farsi)' },
  { code: 'sr', label: 'Serbisch' },
  { code: 'cs', label: 'Tschechisch' },
  { code: 'sk', label: 'Slowakisch' },
];

/** Fast label lookup: code → label. */
export const REALTIME_LANGUAGE_MAP = Object.fromEntries(
  REALTIME_LANGUAGES.map(l => [l.code, l.label])
);

// ── Language detection ───────────────────────────────────────────────────────

// Script classification per language.
// Languages not listed here are assumed to be Latin-script.
const LANG_SCRIPT = {
  ar: 'arabic',
  fa: 'arabic',    // Persian uses Arabic-based script
  ru: 'cyrillic',
  uk: 'cyrillic',
  sr: 'cyrillic',  // Serbian Cyrillic; Latin Serbian is a separate choice
  zh: 'cjk',
};

function getLangScript(lang) {
  return LANG_SCRIPT[lang] ?? 'latin';
}

// Unicode ranges per script family (inclusive).
// Any script listed here is checked by hasForeignScript — text containing
// characters from an unlisted-configured script is rejected as foreign.
const SCRIPT_RANGES = {
  arabic:     [[0x0600, 0x06FF], [0x0750, 0x077F], [0xFB50, 0xFDFF]],
  cyrillic:   [[0x0400, 0x04FF]],
  cjk:        [[0x4E00, 0x9FFF], [0x3400, 0x4DBF]],
  hangul:     [[0xAC00, 0xD7A3], [0x1100, 0x11FF]], // Korean
  greek:      [[0x0370, 0x03FF]],                    // Greek and Coptic
  hebrew:     [[0x0590, 0x05FF]],
  thai:       [[0x0E00, 0x0E7F]],
  devanagari: [[0x0900, 0x097F]],                    // Hindi, Sanskrit, etc.
};

function countCharsInRanges(text, ranges) {
  let count = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    for (const [lo, hi] of ranges) {
      if (cp >= lo && cp <= hi) { count++; break; }
    }
  }
  return count;
}

/**
 * Returns true when text contains characters from a script family not used by
 * either of the two configured languages.  Blocks e.g. Korean/Arabic/Cyrillic
 * content from appearing as a valid turn in a Latin-only (DE/EN) session.
 */
function hasForeignScript(text, scriptA, scriptB) {
  const configured = new Set([scriptA, scriptB]);
  for (const [script, ranges] of Object.entries(SCRIPT_RANGES)) {
    if (!configured.has(script) && countCharsInRanges(text, ranges) > 0) return true;
  }
  return false;
}

// Distinctive common words per language — used for same-script pairs.
// Words are lowercase; matched against tokenised transcript words.
// Chosen for minimal cross-language overlap within the supported set.
const FINGERPRINTS = {
  de: [
    // core
    'ich', 'nicht', 'haben', 'sind', 'wird', 'wenn', 'aber', 'auch', 'eine', 'einem',
    'seit', 'schmerz', 'schmerzen', 'noch', 'gibt', 'wurde',
    // common German function words unambiguous in Latin-script pairs
    'du', 'mir', 'wir', 'sie', 'bitte', 'danke', 'nein', 'und', 'ist', 'bin',
    'habe', 'hast', 'kein', 'keine', 'mein', 'meine', 'für', 'auf', 'bei',
    'mit', 'wie', 'wann', 'wo', 'kannst', 'können', 'sehr', 'jetzt', 'hier', 'das',
    'der', 'dieser', 'diese', 'dieses', 'ihnen', 'alle', 'durch', 'nach', 'über',
    'einen', 'diesem', 'werden', 'hatte', 'waren', 'haben',
  ],
  en: [
    // already present
    'the', 'have', 'been', 'from', 'they', 'with', 'this', 'that', 'does',
    'pain', 'since', 'long', 'would', 'their', 'about',
    // common English function words unambiguous in Latin-script pairs
    'you', 'can', 'are', 'not', 'your', 'has', 'for', 'help', 'yes', 'how',
    'when', 'where', 'what', 'why', 'could', 'should', 'any', 'more', 'just',
    'my', 'me', 'it', 'here', 'there', 'please', 'good', 'do', 'did', 'get',
    'some', 'still', 'know', 'think', 'need', 'feel',
  ],
  fr: ['dans', 'mais', 'avec', 'depuis', 'encore', 'toujours', 'douleur', 'jours', 'bien', 'très', 'plus', 'cette', 'aussi', 'vous', 'été'],
  es: ['porque', 'también', 'cuando', 'donde', 'dolor', 'días', 'pero', 'desde', 'siempre', 'tiene', 'muchos', 'mejor', 'usted', 'hace'],
  it: ['perché', 'anche', 'quando', 'dove', 'dolore', 'giorni', 'però', 'sempre', 'molto', 'questi', 'sono', 'aveva', 'fare', 'cosa'],
  pt: ['porque', 'também', 'quando', 'onde', 'dor', 'dias', 'mas', 'sempre', 'muito', 'esses', 'está', 'tinha', 'você', 'isso'],
  nl: ['omdat', 'wanneer', 'maar', 'ook', 'pijn', 'dagen', 'altijd', 'hebben', 'zijn', 'voor', 'wordt', 'heeft', 'bij', 'nog'],
  pl: ['ponieważ', 'kiedy', 'gdzie', 'ból', 'zawsze', 'teraz', 'bardzo', 'tego', 'się', 'nie', 'pan', 'pani', 'jest', 'była'],
  ro: ['pentru', 'când', 'unde', 'durere', 'zile', 'întotdeauna', 'acum', 'foarte', 'este', 'sunt', 'mai', 'că', 'din'],
  hr: ['zašto', 'kada', 'gdje', 'bol', 'uvijek', 'sada', 'jako', 'sam', 'nije', 'što', 'biti', 'koja'],
  cs: ['proč', 'kdy', 'kde', 'bolest', 'vždy', 'teď', 'velmi', 'není', 'jsem', 'jsou', 'také', 'která'],
  sk: ['prečo', 'kedy', 'kde', 'bolesť', 'vždy', 'teraz', 'veľmi', 'nie', 'som', 'sú', 'tiež', 'ktorá'],
  tr: ['çünkü', 'neden', 'nerede', 'ağrı', 'şimdi', 'çok', 'olan', 'için', 'ile', 'bir', 'bu', 'gün', 'her'],
  vi: ['vì', 'tại', 'khi', 'đau', 'ngày', 'luôn', 'bây', 'giờ', 'rất', 'một', 'và', 'có', 'không', 'của'],
  ar: ['من', 'إلى', 'في', 'على', 'هذا', 'ألم', 'يوم', 'منذ', 'كيف', 'متى', 'هل', 'لا'],
  fa: ['از', 'به', 'در', 'این', 'که', 'درد', 'روز', 'چه', 'چطور', 'آیا', 'نه', 'هست'],
  ru: ['это', 'что', 'как', 'боль', 'день', 'когда', 'почему', 'где', 'есть', 'был', 'были', 'нет'],
  uk: ['це', 'що', 'як', 'біль', 'день', 'коли', 'чому', 'де', 'є', 'був', 'були', 'ні'],
  sr: ['ово', 'шта', 'као', 'бол', 'дан', 'када', 'зашто', 'где', 'је', 'био', 'биле', 'не'],
  zh: ['疼', '痛', '天', '多', '久', '什么', '时候', '哪里', '怎么', '吃', '药', '没有'],
};

/**
 * Detects which of the two configured languages (langA or langB) was spoken.
 *
 * Strategy:
 *  1. If the two languages use different scripts, count Unicode characters in
 *     each script range — 100% reliable for all non-Latin pairs.
 *  2. For same-script pairs (usually Latin), score the transcript words against
 *     per-language fingerprint word lists — reliable for utterances ≥ 3 words.
 *
 * Returns null when detection is inconclusive (too short, tied score, etc.).
 *
 * @param {string} text  Transcribed text from the Realtime API
 * @param {string} langA ISO 639-1 code of the first language (e.g. 'de')
 * @param {string} langB ISO 639-1 code of the second language (e.g. 'en')
 * @returns {string|null} langA, langB, or null
 */
export function detectLanguage(text, langA, langB) {
  if (!text || !langA || !langB || langA === langB) return null;
  const clean = text.trim();
  if (!clean) return null;

  const scriptA = getLangScript(langA);
  const scriptB = getLangScript(langB);

  // Reject text that contains characters from scripts not used by either language.
  // Blocks Korean/Arabic/Cyrillic hallucinations in a Latin-script (DE/EN) session.
  if (hasForeignScript(clean, scriptA, scriptB)) return null;

  if (scriptA !== scriptB) {
    // Different scripts → count characters per script
    const rangesA = SCRIPT_RANGES[scriptA] ?? [];
    const rangesB = SCRIPT_RANGES[scriptB] ?? [];
    const scoreA  = countCharsInRanges(clean, rangesA);
    const scoreB  = countCharsInRanges(clean, rangesB);
    if (scoreA > scoreB) return langA;
    if (scoreB > scoreA) return langB;
    return null;
  }

  // Same script (Latin, Cyrillic, or Arabic) → word fingerprints
  const words  = clean.toLowerCase()
    .split(/[\s.,!?;:()\-"'«»„""‚'​ ]+/)
    .filter(w => w.length > 1);

  if (words.length < 2) return null; // too short for reliable detection

  const fpA    = FINGERPRINTS[langA] ?? [];
  const fpB    = FINGERPRINTS[langB] ?? [];
  const scoreA = words.filter(w => fpA.includes(w)).length;
  const scoreB = words.filter(w => fpB.includes(w)).length;

  if (scoreA > scoreB) return langA;
  if (scoreB > scoreA) return langB;
  return null; // inconclusive
}

/**
 * Returns true when text is clearly in a third language — definitively NOT in langA or langB.
 * Used as a secondary output guard after detectLanguage() returns null.
 *
 * Conservative rules (to avoid false-positives on short/ambiguous text):
 *  1. Text contains characters from a non-configured script (e.g. Arabic, Korean) → true.
 *  2. No fingerprint hits for langA or langB, AND ≥2 fingerprint hits for a third language → true.
 *  3. Text shorter than 10 chars or fewer than 3 words → false (not enough signal).
 *
 * @param {string} text
 * @param {string} langA  First allowed language (e.g. 'de')
 * @param {string} langB  Second allowed language (e.g. 'en')
 * @returns {boolean}
 */
export function isDefinitelyThirdLanguage(text, langA, langB) {
  if (!text || !langA || !langB || langA === langB) return false;
  const clean = text.trim();
  if (clean.length < 10) return false;

  const scriptA = getLangScript(langA);
  const scriptB = getLangScript(langB);

  // Non-configured script characters → definitively foreign
  if (hasForeignScript(clean, scriptA, scriptB)) return true;

  // Same-script (Latin, etc.) — use fingerprints
  const words  = clean.toLowerCase()
    .split(/[\s.,!?;:()\-"'«»„""‚'​ ]+/)
    .filter(w => w.length > 1);
  if (words.length < 3) return false; // too short for reliable cross-language detection

  const fpA    = FINGERPRINTS[langA] ?? [];
  const fpB    = FINGERPRINTS[langB] ?? [];
  const scoreA = words.filter(w => fpA.includes(w)).length;
  const scoreB = words.filter(w => fpB.includes(w)).length;

  // If either configured language has any fingerprint hits → not definitively a third language
  if (scoreA > 0 || scoreB > 0) return false;

  // No hits for either configured language — check if a third language clearly dominates
  for (const [lang, fp] of Object.entries(FINGERPRINTS)) {
    if (lang === langA || lang === langB) continue;
    const score = words.filter(w => fp.includes(w)).length;
    if (score >= 2) return true;
  }

  return false;
}
