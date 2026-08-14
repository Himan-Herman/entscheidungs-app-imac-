/**
 * Medication context guard — fail closed instead of best effort.
 *
 * ── The problem this closes ─────────────────────────────────────────────────
 * Masking protects a drug name when it stands next to a strength, is on the
 * curated list, or carries a WHO INN stem. That leaves a real gap: a rare trade
 * name written without a strength ("Gabe von Quensyl erfolgt") reaches the
 * model as ordinary text, and "Quensyl" -> "Resochin" would pass every marker
 * and digit check. Phase 2A.1 recorded that as a known limit. It is not
 * compatible with "medication names stay unchanged", so it is now handled the
 * only way that is honest without a drug database: the document is refused.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 * 1. Decide whether a segment is a MEDICATION CONTEXT at all.
 * 2. Inside such a context, every word that could be a drug name must already
 *    be masked.
 * 3. If even one candidate is left unprotected, the whole document is refused
 *    with document_medication_unverifiable. No partial translation, no warning
 *    banner, no guessing which of the two it was.
 *
 * No drug database and no AI classification — the decision uses structure plus
 * curated vocabulary only, exactly like the rest of this layer.
 *
 * ── The cost, stated up front ───────────────────────────────────────────────
 * This will refuse some legitimate letters, for instance one recommending an
 * unusual preparation by name. That is the intended direction: a refused
 * document leaves the patient with the unaltered original, whereas a silently
 * renamed medication reads as authoritative. The safe-word list below exists to
 * keep that cost proportionate, not to erode the rule.
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "../documentTranslationPolicy.js";
import { stripMarkers } from "./criticalTokenMasking.js";

/**
 * Section headings that put everything under them into a medication context.
 * Matched against the segment text itself; a heading segment carries the
 * context forward to the segments that follow it.
 */
const MEDICATION_HEADINGS =
  /\b(?:Dauermedikation|Hausmedikation|Entlassmedikation|Bedarfsmedikation|Medikation|Medikamente|Arzneimittel|Medikamentenplan|Therapieplan|Medication|Medications|Drug\s+therapy|Current\s+medic\w*)\b/i;

/**
 * Narrative phrases that introduce a specific medicinal product.
 *
 * The capture group is the material that must be protected. Only the words
 * immediately after the trigger are examined, so ordinary prose elsewhere in
 * the sentence does not raise the bar for the whole segment.
 */
const MEDICATION_TRIGGERS = [
  /\b(?:Gabe|Einnahme|Verordnung|Rezept)\s+(?:von|des|der)\s+([^.,;:]{1,60})/gi,
  /\b(?:Therapie|Behandlung|Umstellung|Wechsel)\s+(?:mit|auf)\s+([^.,;:]{1,60})/gi,
  /\b(?:nimmt|nehmen|eingenommen|einnehmen|erhielt|erhalten|verordnet|rezeptiert|angesetzt|abgesetzt|pausiert|umgestellt)\s+(?:auf\s+|mit\s+)?([^.,;:]{1,60})/gi,
  /\b(?:treated|continued|started|switched)\s+(?:on|with|to)\s+([^.,;:]{1,60})/gi,
  /\b(?:takes|taking|prescribed|received)\s+([^.,;:]{1,60})/gi,
];

/**
 * Vocabulary that may legitimately appear unmasked inside a medication context.
 *
 * Everything here is either grammar, an administration detail, a dosage form, a
 * frequency, a route, or a drug CLASS. None of it identifies a specific
 * medicinal product, which is what the rule protects.
 */
const SAFE_WORDS = new Set(
  [
    // German grammar and connectives
    "und", "oder", "mit", "ohne", "bei", "bis", "zur", "zum", "als", "aus",
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
    "einer", "eines", "für", "fuer", "von", "vom", "nach", "vor", "seit", "ab",
    "pro", "je", "am", "an", "auf", "im", "in", "ist", "sind", "wird", "werden",
    "wurde", "wurden", "war", "waren", "haben", "hat", "hatte", "kann", "soll",
    "sollte", "muss", "darf", "wir", "sie", "ihr", "ihre", "ihren", "ihrem",
    "sich", "nicht", "kein", "keine", "keinen", "noch", "nur", "auch", "dann",
    "sowie", "bzw", "ggf", "etc", "usw", "weiter", "weiterhin", "unter",
    "über", "ueber", "zwischen", "aktuell", "derzeit", "bisher", "bereits",
    "patient", "patientin", "herr", "frau",
    // Actions on a therapy
    "gabe", "einnahme", "verordnung", "rezept", "therapie", "behandlung",
    "umstellung", "wechsel", "nimmt", "nehmen", "eingenommen", "einnehmen",
    "erhielt", "erhalten", "verordnet", "rezeptiert", "angesetzt", "abgesetzt",
    "pausiert", "umgestellt", "fortgeführt", "fortgefuehrt", "fortgesetzt",
    "reduziert", "erhöht", "erhoeht", "gesteigert", "empfohlen", "empfehlen",
    "empfehlung", "beibehalten", "belassen", "begonnen", "beendet",
    // Dosage forms
    "tablette", "tabletten", "filmtablette", "filmtabletten", "kapsel",
    "kapseln", "hartkapseln", "tropfen", "hub", "sprühstoß", "spruehstoss",
    "ampulle", "ampullen", "zäpfchen", "zaepfchen", "salbe", "creme", "gel",
    "pflaster", "lösung", "loesung", "saft", "spray", "inhalation",
    "fertigspritze", "injektion", "infusion", "beutel", "sachet", "retard",
    "ret", "stück", "stueck", "dosis", "dosierung", "menge", "stärke", "staerke",
    // Frequency and timing
    "morgens", "mittags", "abends", "nachts", "nacht", "täglich", "taeglich",
    "wöchentlich", "woechentlich", "monatlich", "stündlich", "stuendlich",
    "stunde", "stunden", "tag", "tage", "tagen", "woche", "wochen", "monat",
    "monate", "monaten", "jahr", "jahre", "bedarf", "bedarfsweise", "einmal",
    "zweimal", "dreimal", "viermal", "abendlich", "morgendlich", "dauerhaft",
    // Route
    "oral", "peroral", "subkutan", "intravenös", "intravenoes", "intramuskulär",
    "intramuskulaer", "inhalativ", "topisch", "rektal", "transdermal", "nasal",
    // Drug CLASSES — a category, never a specific product
    "betablocker", "betarezeptorenblocker", "ace-hemmer", "acehemmer",
    "sartane", "sartan", "diuretika", "diuretikum", "statine", "statin",
    "antibiotika", "antibiotikum", "antikoagulanzien", "antikoagulation",
    "thrombozytenaggregationshemmer", "protonenpumpenhemmer", "opioide",
    "opioid", "analgetika", "analgetikum", "schmerzmittel", "kortison",
    "kortikosteroide", "steroide", "insuline", "antidiabetika", "laxantien",
    "antihistaminika", "immunsuppressiva", "chemotherapie", "impfstoff",
    // English
    "and", "or", "with", "without", "the", "a", "an", "of", "for", "to", "on",
    "in", "at", "as", "is", "are", "was", "were", "be", "been", "daily",
    "twice", "once", "three", "times", "morning", "evening", "night", "bedtime",
    "tablet", "tablets", "capsule", "capsules", "drops", "oral", "orally",
    "intravenous", "subcutaneous", "needed", "required", "per", "day", "week",
    "month", "continue", "continued", "started", "stopped", "increased",
    "reduced", "dose", "dosage", "therapy", "treatment", "medication",
    "medications", "prescribed", "received", "takes", "taking", "treated",
    "switched", "patient", "regimen",
  ].map((w) => w.toLowerCase()),
);

/** Shortest word that is worth treating as a possible product name. */
const MIN_CANDIDATE_LENGTH = 4;

/**
 * @typedef {object} MedicationFinding
 * @property {number} segmentIndex
 * @property {string} trigger  what made this a medication context
 * @property {number} candidateCount
 */

/**
 * Inspect masked segments and refuse the document if any medication context
 * contains an unprotected product name.
 *
 * @param {{ index: number, kind: string, text: string }[]} sourceSegments  unmasked
 * @param {{ index: number, kind: string, text: string }[]} maskedSegments
 * @throws {DocumentTranslationError} document_medication_unverifiable
 */
export function assertMedicationContextProtected(sourceSegments, maskedSegments) {
  const findings = analyseMedicationContexts(sourceSegments, maskedSegments);
  if (findings.length === 0) return { ok: true };

  throw new DocumentTranslationError(TRANSLATION_ERRORS.MEDICATION_UNVERIFIABLE, {
    // Metadata only. The unprotected words are document content and are
    // deliberately NOT included — this detail may be audited or logged.
    contexts: findings.length,
    segmentIndexes: findings.slice(0, 20).map((f) => f.segmentIndex),
    triggers: [...new Set(findings.map((f) => f.trigger))].slice(0, 5),
  });
}

/**
 * The analysis behind the guard, exposed separately so tests can assert on WHY
 * a document was refused without catching an exception.
 *
 * @returns {MedicationFinding[]}
 */
export function analyseMedicationContexts(sourceSegments, maskedSegments) {
  const masked = new Map((maskedSegments || []).map((s) => [s.index, s.text]));
  const findings = [];
  let headingActive = false;

  for (const segment of sourceSegments || []) {
    const source = String(segment?.text ?? "");
    const maskedText = String(masked.get(segment?.index) ?? "");

    if (MEDICATION_HEADINGS.test(source)) {
      headingActive = true;
      // The heading line itself carries no product name to protect.
      continue;
    }

    const structured = isStructuredMedicationLine(maskedText);

    if (headingActive || structured) {
      const candidates = unprotectedCandidates(maskedText);
      if (candidates.length > 0) {
        findings.push({
          segmentIndex: segment.index,
          trigger: headingActive ? "medication_section" : "structured_medication_line",
          candidateCount: candidates.length,
        });
      }
      // A blank or clearly narrative segment ends a medication section.
      if (headingActive && !structured && candidates.length === 0 && source.length > 120) {
        headingActive = false;
      }
      continue;
    }

    const narrative = narrativeCandidates(source, maskedText);
    if (narrative.length > 0) {
      findings.push({
        segmentIndex: segment.index,
        trigger: "narrative_medication_reference",
        candidateCount: narrative.length,
      });
    }
  }

  return findings;
}

/* ------------------------------------------------------------- internals */

/**
 * A masked line counts as a structured medication entry when it carries a
 * medication token, a dosing schedule, or a strength.
 * @param {string} maskedText
 */
function isStructuredMedicationLine(maskedText) {
  return /⟦(?:MEDICATION|SCHEDULE|DOSE)_[A-Z]{4}⟧/.test(maskedText);
}

/**
 * Words left unmasked that could be a product name.
 * @param {string} maskedText
 */
function unprotectedCandidates(maskedText) {
  const withoutMarkers = stripMarkers(maskedText);
  const words = withoutMarkers.match(/[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9-]*/g) || [];

  return words.filter((word) => {
    if (word.length < MIN_CANDIDATE_LENGTH) return false;
    if (SAFE_WORDS.has(word.toLowerCase())) return false;
    // Hyphenated compounds count as safe only if every part is safe, so
    // "ACE-Hemmer" passes while "Beta-Quensyl" does not.
    const parts = word.split("-").filter(Boolean);
    if (parts.length > 1 && parts.every((p) => SAFE_WORDS.has(p.toLowerCase()))) return false;
    return true;
  });
}

/**
 * For narrative references, only the words directly after the trigger phrase
 * are examined — the rest of the sentence is ordinary prose and must stay
 * translatable.
 *
 * @param {string} sourceText
 * @param {string} maskedText
 */
function narrativeCandidates(sourceText, maskedText) {
  const found = [];

  for (const trigger of MEDICATION_TRIGGERS) {
    trigger.lastIndex = 0;
    let match;
    while ((match = trigger.exec(sourceText)) !== null) {
      const object = String(match[1] ?? "");

      // If the corresponding position in the masked text is a marker, the
      // product is already protected. Comparing on the masked text avoids
      // re-deriving which token the mask covered.
      const objectWords = object.match(/[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9-]*/g) || [];
      const leading = objectWords.slice(0, 3);

      for (const word of leading) {
        if (word.length < MIN_CANDIDATE_LENGTH) continue;
        if (SAFE_WORDS.has(word.toLowerCase())) continue;
        const parts = word.split("-").filter(Boolean);
        if (parts.length > 1 && parts.every((p) => SAFE_WORDS.has(p.toLowerCase()))) continue;
        // Still present verbatim in the masked text => it was not masked.
        if (maskedText.includes(word)) found.push(word);
      }
    }
  }

  return found;
}
