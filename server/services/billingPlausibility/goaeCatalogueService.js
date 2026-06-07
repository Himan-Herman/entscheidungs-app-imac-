/**
 * GOÄ catalogue lookup and deterministic warning generation.
 *
 * IMPORTANT: All output is a plausibility HINT only — not a legally binding billing
 * decision, not medical advice, not a reimbursement determination. No AI is used.
 * All logic is static and deterministic based on the local catalogue test subset.
 */

import {
  GOAE_CATALOGUE_META,
  GOAE_ENTRIES,
  GOAE_FACTOR_THRESHOLDS,
} from "../../data/goaeCatalogue.js";

/** Build an in-memory index for O(1) ziffer lookups. */
const CATALOGUE_INDEX = new Map(GOAE_ENTRIES.map((e) => [e.ziffer, e]));

/**
 * Parse a factor string that may use comma or dot as decimal separator.
 * Returns the numeric value, or null if unparseable.
 * @param {string | number | undefined | null} raw
 * @returns {number | null}
 */
function parseFactor(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim().replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Parse a count value. Accepts strings or numbers.
 * @param {string | number | undefined | null} raw
 * @returns {number | null}
 */
function parseCount(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = parseInt(String(raw).trim(), 10);
  return isNaN(n) || n < 1 ? null : n;
}

/**
 * Look up a single GOÄ ziffer in the local catalogue subset.
 *
 * G3b-2: returned object now includes provenance/verification fields so callers
 * and stored catalogueMatchJson capture catalogue quality transparently.
 * Unknown-ziffer path is unchanged — provenance fields are absent when not found.
 *
 * @param {string} ziffer
 * @returns {{
 *   found: boolean,
 *   ziffer: string,
 *   title?: string,
 *   points?: number | null,
 *   section?: string,
 *   source?: string,
 *   completenessStatus?: string | null,
 *   activeStatus?: string | null,
 *   sourceName?: string | null,
 *   sourceUrl?: string | null,
 *   sourceLineOrReference?: string | null,
 *   sourceVersionDate?: string | null,
 *   verifiedAt?: string | null,
 *   catalogueMeta: typeof GOAE_CATALOGUE_META
 * }}
 */
export function findGoaeEntry(ziffer) {
  const z = String(ziffer ?? "").trim();
  const entry = CATALOGUE_INDEX.get(z);
  if (!entry) {
    return { found: false, ziffer: z, catalogueMeta: GOAE_CATALOGUE_META };
  }
  return {
    found: true,
    ziffer: entry.ziffer,
    title: entry.title,
    points: entry.points,
    section: entry.section,
    source: entry.source,
    // G3b-2: provenance and verification metadata
    completenessStatus: entry.completenessStatus ?? null,
    activeStatus: entry.activeStatus ?? null,
    sourceName: entry.sourceName ?? null,
    sourceUrl: entry.sourceUrl ?? null,
    sourceLineOrReference: entry.sourceLineOrReference ?? null,
    sourceVersionDate: entry.sourceVersionDate ?? null,
    verifiedAt: entry.verifiedAt ?? null,
    catalogueMeta: GOAE_CATALOGUE_META,
  };
}

/**
 * Build a catalogue match object for a single row (suitable for catalogueMatchJson storage).
 * @param {{ ziffer: string }} row
 * @returns {ReturnType<typeof findGoaeEntry>}
 */
export function buildCatalogueMatch(row) {
  return findGoaeEntry(row.ziffer);
}

/**
 * Build deterministic warning codes for a single row.
 *
 * Warning codes (i18n keys in the frontend):
 *   unknown_goae_ziffer           — ziffer not found in local catalogue subset
 *   invalid_factor                — factor could not be parsed as a number
 *   invalid_count                 — count could not be parsed or is < 1
 *   factor_requires_justification — factor above § 5 GOÄ normal upper bound (2.3)
 *   justification_missing         — factor above threshold but contextText is empty
 *
 * All warnings are advisory only. They do not constitute a final billing decision.
 *
 * @param {{ ziffer: string, factor: string | number, count: string | number, contextText?: string }} row
 * @param {ReturnType<typeof findGoaeEntry>} match
 * @returns {string[]} array of warning code strings
 */
export function buildDeterministicWarnings(row, match) {
  const warnings = [];

  if (!match.found) {
    warnings.push("unknown_goae_ziffer");
  }

  const factorNum = parseFactor(row.factor);
  if (factorNum === null) {
    warnings.push("invalid_factor");
  } else if (factorNum > GOAE_FACTOR_THRESHOLDS.JUSTIFICATION_THRESHOLD) {
    warnings.push("factor_requires_justification");
    const context = (row.contextText ?? "").trim();
    if (!context) {
      warnings.push("justification_missing");
    }
  }

  const countNum = parseCount(row.count);
  if (countNum === null) {
    warnings.push("invalid_count");
  }

  return warnings;
}

/**
 * Validate and annotate an array of GOÄ rows from user input.
 * Returns per-row catalogue matches and warning lists.
 *
 * @param {Array<{ ziffer: string, factor: string | number, count: string | number, contextText?: string }>} rows
 * @returns {{ rowResults: Array<{ ziffer: string, match: object, warnings: string[] }>, hasWarnings: boolean }}
 */
export function validateGoaeRows(rows) {
  const rowResults = rows.map((row) => {
    const match = buildCatalogueMatch(row);
    const warnings = buildDeterministicWarnings(row, match);
    return { ziffer: String(row.ziffer ?? "").trim(), match, warnings };
  });

  const hasWarnings = rowResults.some((r) => r.warnings.length > 0);
  return { rowResults, hasWarnings };
}
