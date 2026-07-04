/**
 * Deterministic, rule-based pharmacy assistant.
 *
 * STRICT & NON-HALLUCINATING BY DESIGN:
 *  - No AI, no network, no free-text generation. Pure keyword matching against a
 *    small, curated, high-confidence ruleset that any pharmacist would confirm.
 *  - It is NOT an interaction checker and must never imply completeness or safety.
 *    Absence of a hint does NOT mean "safe" (see the `none`/disclaimer copy).
 *  - Every finding defers to the pharmacy/doctor. No diagnosis, no dosing, no
 *    therapy recommendation — intentionally outside medical-device territory.
 *
 * All human-readable text lives in i18n (`summary.pharmacy.*`); this module only
 * emits stable rule ids + the list of affected medication names.
 */

/** Curated drug-category keyword map. Keywords are matched case/diacritic-insensitively. */
export const MED_CATEGORIES = {
  // Tetracyclines + fluoroquinolones bind di-/trivalent cations (Ca, Mg, Fe).
  cation_binding_antibiotic: [
    "tetracyclin", "tetrazyklin", "doxycyclin", "minocyclin", "oxytetracyclin",
    "ciprofloxacin", "levofloxacin", "moxifloxacin", "norfloxacin", "ofloxacin",
    "doxy", "cipro",
  ],
  levothyroxine: [
    "levothyroxin", "l-thyroxin", "lthyroxin", "thyroxin", "euthyrox", "eltroxin",
  ],
  anticoagulant: [
    "warfarin", "marcumar", "phenprocoumon", "falithrom", "rivaroxaban", "xarelto",
    "apixaban", "eliquis", "dabigatran", "pradaxa", "edoxaban", "lixiana",
  ],
  nsaid: [
    "ibuprofen", "diclofenac", "voltaren", "naproxen", "dexketoprofen", "ketoprofen",
    "indometacin", "etoricoxib", "celecoxib", "acetylsalicyl", "aspirin", "ass",
  ],
};

/** Single-medication intake hints (info level). */
const INTAKE_RULES = [
  { id: "antibiotic_dairy", category: "cation_binding_antibiotic", severity: "info" },
  { id: "levothyroxine_fasting", category: "levothyroxine", severity: "info" },
];

/**
 * Combination cautions (warning / red level).
 * `a === b` means "two or more medications of the same category".
 */
const COMBO_RULES = [
  { id: "anticoag_nsaid", a: "anticoagulant", b: "nsaid", severity: "warning" },
  { id: "double_anticoag", a: "anticoagulant", b: "anticoagulant", severity: "warning" },
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function matchesKeyword(normName, keyword) {
  if (keyword.length >= 6) return normName.includes(keyword);
  // Short tokens (e.g. "ass", "doxy", "cipro") require a word boundary to avoid
  // false positives inside longer, unrelated words.
  return new RegExp(`(^|[^a-z])${keyword}([^a-z]|$)`).test(normName);
}

/** @returns {string[]} category keys the given medication name matches. */
export function categoriesForName(name) {
  const norm = normalize(name);
  if (!norm) return [];
  const hits = [];
  for (const [category, keywords] of Object.entries(MED_CATEGORIES)) {
    if (keywords.some((kw) => matchesKeyword(norm, kw))) hits.push(category);
  }
  return hits;
}

/**
 * Analyze medication entries deterministically.
 *
 * @param {Array<{name?: string}>} entries
 * @param {(id: string, field: string) => string} tr  Translator: rule id + field → text.
 * @returns {Array<{id: string, severity: "warning"|"info", title: string, message: string, meds: string[]}>}
 */
export function analyzeMedications(entries, tr) {
  const list = Array.isArray(entries) ? entries : [];
  const tagged = list
    .map((e) => ({ name: String(e?.name || "").trim(), cats: categoriesForName(e?.name) }))
    .filter((e) => e.name);

  const findings = [];

  for (const rule of INTAKE_RULES) {
    const meds = tagged.filter((e) => e.cats.includes(rule.category)).map((e) => e.name);
    if (meds.length > 0) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        title: tr(rule.id, "title"),
        message: tr(rule.id, "message"),
        meds: [...new Set(meds)],
      });
    }
  }

  for (const rule of COMBO_RULES) {
    let meds;
    if (rule.a === rule.b) {
      const matching = tagged.filter((e) => e.cats.includes(rule.a)).map((e) => e.name);
      meds = matching.length >= 2 ? [...new Set(matching)] : [];
    } else {
      const inA = tagged.filter((e) => e.cats.includes(rule.a)).map((e) => e.name);
      const inB = tagged.filter((e) => e.cats.includes(rule.b)).map((e) => e.name);
      meds = inA.length > 0 && inB.length > 0 ? [...new Set([...inA, ...inB])] : [];
    }
    if (meds.length > 0) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        title: tr(rule.id, "title"),
        message: tr(rule.id, "message"),
        meds,
      });
    }
  }

  // Warnings (red) first, then info hints. Stable within each group.
  const order = { warning: 0, info: 1 };
  return findings.sort((x, y) => order[x.severity] - order[y.severity]);
}
