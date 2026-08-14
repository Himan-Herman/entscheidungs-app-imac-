/**
 * Curated lexicon of tokens that must survive a translation unchanged.
 *
 * ── Why a curated list and not a heuristic ──────────────────────────────────
 * "Mask every capitalised word" would swallow half of a German document and
 * leave the patient with an untranslated text. "Mask nothing" lets a model
 * rewrite CRP into "C-reaktives Protein" or Ramipril into Lisinopril. So the
 * lists below are explicit, reviewable, and deliberately incomplete rather than
 * clever. What is not on them is stated as a known limit, not quietly assumed
 * to be safe.
 *
 * ── No external drug database ───────────────────────────────────────────────
 * There is no lexicon service, no download and no AI classification here. The
 * drug coverage rests mainly on STRUCTURE (a name standing immediately before a
 * strength), which is a property of the text rather than of a database. The
 * name list below is a small safety net for the most common substances that
 * appear without a strength, not a pharmacopoeia.
 *
 * All matching is case-sensitive where the token's case is part of its identity
 * (HbA1c, SpO2, fT4) — normalising those would itself be a change.
 */

/**
 * Medical and technical abbreviations that must not be expanded, translated or
 * "corrected".
 *
 * Selection rule: an abbreviation is listed only if, as a standalone token, it
 * is unambiguous in a clinical document. Two-letter forms are included only
 * where a plain-word collision is implausible in German or English medical
 * prose (RR, CT, HF). Deliberately NOT listed: highly ambiguous short forms
 * such as "US", "OP", "AZ", "BE" — masking those would cost more in unreadable
 * output than it buys in safety.
 */
export const MEDICAL_ABBREVIATIONS = [
  // Laboratory
  "CRP", "HbA1c", "INR", "TSH", "fT3", "fT4", "BSG", "LDH", "GGT", "GOT", "GPT",
  "ALT", "AST", "AP", "HDL", "LDL", "VLDL", "Hb", "Hkt", "MCV", "MCH", "MCHC",
  "MPV", "RDW", "PTT", "aPTT", "TPZ", "eGFR", "GFR", "PSA", "CK", "CK-MB",
  "BNP", "NT-proBNP", "TnT", "hsTnT", "PCT", "IgA", "IgE", "IgG", "IgM",
  "ANA", "ANCA", "RF", "TPO", "PTH", "HCG",
  // Imaging and functional diagnostics
  "MRT", "CT", "PET", "EKG", "EEG", "EMG", "ENG", "CTG", "TTE", "TEE",
  "MRCP", "ERCP", "DSA", "DXA",
  // Vital signs and scores
  "SpO2", "BMI", "RR", "HF", "AF", "ZVD", "GCS", "NYHA", "ASA",
  // Conditions and anatomy in abbreviated form
  "COPD", "KHK", "TIA", "COVID", "HWS", "BWS", "LWS", "ISG",
  "HIV", "HBV", "HCV", "MRSA", "VRE",
  // Classification systems
  "ICD", "ICD-10", "ICD-11", "OPS", "TNM", "GOÄ", "EBM", "DRG",
];

/**
 * Substance and trade names that commonly appear WITHOUT a strength, where the
 * structural rule (name + strength) would therefore not fire.
 *
 * Small and curated on purpose. It is a safety net for the highest-frequency
 * substances in German outpatient letters, not a claim of coverage. A drug not
 * listed here and written without a strength is NOT protected — see the known
 * limits in the module documentation.
 */
export const KNOWN_SUBSTANCE_NAMES = [
  "ASS", "Aspirin", "Ibuprofen", "Paracetamol", "Metamizol", "Novalgin",
  "Diclofenac", "Naproxen", "Metformin", "Insulin", "Marcumar", "Cortison",
  "Prednisolon", "Pantoprazol", "Omeprazol", "Ramipril", "Enalapril",
  "Bisoprolol", "Metoprolol", "Amlodipin", "Torasemid", "Furosemid",
  "Simvastatin", "Atorvastatin", "Levothyroxin", "L-Thyroxin", "Euthyrox",
  "Xarelto", "Eliquis", "Clopidogrel", "Allopurinol", "Tamsulosin",
];

/**
 * Laboratory analyte names written out in full.
 *
 * These are masked for the same reason as abbreviations: swapping "Kalium" for
 * "Natrium" attaches a correct value to the wrong parameter, which reads as
 * authoritative and is not recoverable from the translation alone.
 *
 * The cost is real and accepted: a masked analyte stays in its German form in,
 * say, a Russian translation. That is the safe direction — the value keeps its
 * correct label, and the unaltered original document remains one click away.
 *
 * Ordinary measurement labels ("Gewicht", "Temperatur", "Größe") are
 * deliberately NOT here. They are not analytes, their values are masked
 * anyway, and masking every label word would leave the patient with a mostly
 * untranslated document.
 */
export const LABORATORY_ANALYTES = [
  "Kalium", "Natrium", "Calcium", "Kalzium", "Magnesium", "Chlorid", "Phosphat",
  "Kreatinin", "Harnstoff", "Harnsäure", "Glukose", "Glucose", "Bilirubin",
  "Hämoglobin", "Haemoglobin", "Hämatokrit", "Leukozyten", "Thrombozyten",
  "Erythrozyten", "Ferritin", "Transferrin", "Albumin", "Cholesterin",
  "Triglyceride", "Troponin", "Laktat", "Ammoniak", "Lipase", "Amylase",
  "Eisen", "Folsäure", "Cortisol", "Östradiol", "Testosteron", "Progesteron",
];

/**
 * WHO INN stems — the internationally standardised suffixes that identify a
 * substance class. A word ending in one of these is a drug name with very high
 * probability, so this generalises beyond the curated name list without needing
 * a database.
 *
 * Kept to stems with no plausible German or English everyday-word collision.
 * Excluded on purpose: short or common endings such as "-in", "-on", "-al",
 * which would match ordinary vocabulary.
 */
export const INN_STEMS = [
  "pril", "prilat", "sartan", "olol", "alol", "statin", "prazol", "tidin",
  "mycin", "micin", "cillin", "oxacin", "floxacin", "conazol", "parin",
  "dipin", "profen", "icam", "setron", "triptan", "gliptin", "glitazon",
  "xaban", "gatran", "mab", "tinib", "ciclib", "vastatin", "cyclin",
  "azepam", "zolam", "oxetin", "peridon", "thiazid", "semid", "formin",
  "thyroxin", "adipin", "curonium", "caine", "kain", "morphin", "codein",
];

/** Minimum length before a word is considered for INN-stem matching. */
export const INN_MIN_LENGTH = 6;

/**
 * Units that denote the STRENGTH of a medicinal product.
 *
 * Deliberately a subset of the general unit list: concentration units (mg/dl,
 * mmol/l), physical units (kg, cm) and measurement units (°C, mmHg, %) are
 * excluded so that "CRP 1,5 mg/dl", "Gewicht 80 kg" and "Temperatur 36,6 °C"
 * are not mistaken for medication lines. Ordering matters — longer
 * alternatives first.
 */
export const STRENGTH_UNITS = ["mg", "µg", "mcg", "ng", "ml", "IE", "IU", "mmol", "g"];

/**
 * Structured direct identifiers.
 *
 * A practice letter routinely carries an insurance number in the header, a
 * practice email in the footer, and sometimes a patient or case number in the
 * subject line. None of that needs translating, and all of it is exactly the
 * material that should not travel to an external processor when it does not
 * have to.
 *
 * Masking them is data minimisation, not anonymisation, and is described as
 * such: a name and a date of birth in running prose are NOT covered by these
 * patterns and are not claimed to be. What is covered is the set of formats
 * that can be recognised structurally with no guessing.
 *
 * Ordering note: these run early because most contain digits and would
 * otherwise be shredded by the numeric passes — the same failure that broke
 * "HbA1c" before Phase 2A.1.
 */
export const IDENTIFIER_PATTERNS = [
  {
    kind: "EMAIL",
    source: String.raw`(?<![\w.@-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])`,
  },
  {
    kind: "URL",
    source: String.raw`(?<![\w/])(?:https?:\/\/|www\.)[^\s<>"']{3,200}`,
  },
  {
    kind: "IBAN",
    // Groups of four with a possibly shorter final group — a German IBAN ends
    // in a two-character group, which a strict multiple-of-four pattern would
    // leave dangling for the numeric pass to pick up separately.
    source: String.raw`(?<![\w])[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?(?![\w])`,
  },
  {
    kind: "INSURANCE",
    // German Krankenversichertennummer: one letter followed by nine digits.
    // Masked before the ICD pattern, which would otherwise claim its first
    // three characters and leave the rest to the numeric pass.
    source: String.raw`(?<![\w-])[A-Z]\d{9}(?![\w-])`,
  },
  {
    kind: "CASENO",
    // Labelled case, patient or invoice numbers. Only the VALUE is masked —
    // the label stays translatable, so the reader still sees what the number
    // refers to. A bare number carries no such label and is masked as a number.
    source: String.raw`(?<=(?:Fall|Patienten|Pat\.|Rechnungs|Vorgangs)[-\s]?(?:Nr\.?|Nummer|ID)[:\s]{1,3})[A-Za-z0-9][A-Za-z0-9\/-]{2,30}(?![\w])`,
  },
  {
    kind: "PHONE",
    // Requires at least seven digits and at least one separator, so a dosing
    // schedule ("1-0-0") and a reference range ("70 - 110") cannot match.
    // Runs after DATE/TIME so an ISO date is not read as a phone number.
    // The optional "+" sits before the digit-count lookahead so an
    // international prefix is part of the token rather than left behind.
    source:
      String.raw`(?<![\w+])\+?(?=(?:[ \/-]*\d){7})\d{1,6}(?:[ \/-]\d{2,10}){1,4}(?![\w])`,
  },
];

/**
 * Marker kinds must be letters only.
 *
 * The marker grammar is ⟦KIND_ORDINAL⟧ with KIND matched as [A-Z]+, so a kind
 * containing an underscore produces a marker the unmasker cannot parse — it
 * survives masking but never comes back. That was a real bug in an earlier
 * draft of this file ("INSURANCE_ID"), caught only because a round-trip test
 * compared the restored text byte for byte.
 */
export function assertKindNamesAreParsable(kinds) {
  for (const kind of kinds) {
    if (!/^[A-Z]+$/.test(kind)) {
      throw new Error(`marker kind "${kind}" must match [A-Z]+ or it cannot be unmasked`);
    }
  }
}

/** Escapes a literal for safe inclusion in a regular expression. */
function escapeForRegex(literal) {
  return String(literal).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build one alternation, longest first, so that "ICD-10" wins over "ICD" and
 * "CK-MB" over "CK".
 * @param {string[]} literals
 */
export function buildAlternation(literals) {
  return [...literals]
    .sort((a, b) => b.length - a.length)
    .map(escapeForRegex)
    .join("|");
}

/**
 * Regex source matching any curated abbreviation as a standalone token.
 *
 * Boundaries are explicit rather than \b because several entries end in a digit
 * (SpO2, fT4) or contain a hyphen (CK-MB, NT-proBNP), where \b behaves
 * differently than intended.
 */
export const ABBREVIATION_PATTERN_SOURCE =
  `(?<![\\w-])(?:${buildAlternation(MEDICAL_ABBREVIATIONS)})(?![\\w-])`;

/**
 * Regex source matching a curated substance name or laboratory analyte as a
 * standalone token. Both lists share a pattern because both are "a name whose
 * exact wording carries clinical meaning".
 */
export const SUBSTANCE_NAME_PATTERN_SOURCE =
  `(?<![\\w-])(?:${buildAlternation([...KNOWN_SUBSTANCE_NAMES, ...LABORATORY_ANALYTES])})(?![\\w-])`;

/** Regex source matching a word that ends in a WHO INN stem. */
export const INN_STEM_PATTERN_SOURCE =
  `(?<![\\w-])[A-Za-zÄÖÜäöü][A-Za-zÄÖÜäöüß-]{${INN_MIN_LENGTH - 2},40}` +
  `(?:${buildAlternation(INN_STEMS)})(?![\\w-])`;

/** Regex source matching a strength unit not followed by a further unit part. */
export const STRENGTH_UNIT_PATTERN_SOURCE =
  `(?:${buildAlternation(STRENGTH_UNITS)})(?![\\w/])`;
