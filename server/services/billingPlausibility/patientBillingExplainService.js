/**
 * Patient-facing "Rechnung verstehen" (billing explain) — STATELESS service.
 *
 * IMPORTANT:
 *  - Reuses the deterministic GOÄ catalogue/warning engine (goaeCatalogueService).
 *  - No database, no storage, no upload, no OCR, no AI.
 *  - No patient identifiers, never accepts or uses a practiceId.
 *  - Never logs invoice content.
 *  - Output is a plain-language explanation HINT only: not legal advice, not a final
 *    invoice review, not a statement that an invoice is correct or incorrect, not a
 *    diagnosis, therapy, urgency, or medical assessment.
 *
 * All warning codes returned here mirror the engine codes 1:1 and are resolved to
 * i18n strings (warn_*) in the frontend — this service returns codes, never UI text.
 */

import { validateGoaeRows } from "./goaeCatalogueService.js";

/** Conservative input limits — keep the stateless request small and safe. */
export const PATIENT_BILLING_EXPLAIN_LIMITS = {
  MAX_TEXT_LENGTH: 5000,
  MAX_ROWS: 30,
  MAX_ZIFFER_LEN: 12,
  MAX_NOTE_LENGTH: 600,
};

/** Decimal token like "2,3", "1.0", "21,45". */
const DECIMAL_RE = /\d+[.,]\d{1,2}/g;

/**
 * Heuristic signals that the user may have pasted personal/clinical data that does not
 * belong here. Kept narrow (explicit keywords + ICD-10 codes) to avoid flagging ordinary
 * service dates. Returns a boolean notice only — no data is stored or logged.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function detectPossiblePersonalData(text) {
  if (!text) return false;
  const s = String(text);
  // Explicit personal/clinical keywords (DE/EN/FR/ES/IT).
  const keywordRe =
    /\b(geboren|geb\.|geburtsdatum|diagnose|diagnosen|patient(?:in)?|versichert|born|diagnosis|date of birth|né[e]?\s+le|diagnostic|nacid[oa]|diagnóstico|nat[oa]\s+il|diagnosi)\b/i;
  if (keywordRe.test(s)) return true;
  // ICD-10 code pattern, e.g. "E11", "I10.9" — strong signal of a diagnosis.
  const icdRe = /\b[A-TV-Z]\d{2}(?:\.\d{1,2})?\b/;
  if (icdRe.test(s)) return true;
  return false;
}

/**
 * Best-effort, line-based extraction of billing rows from pasted invoice text.
 * Deterministic (no AI). Each non-empty line is scanned for a leading GOÄ ziffer and
 * decimal tokens (factor / amount). Absent fields stay empty and are treated leniently.
 *
 * @param {string} text
 * @returns {Array<{ ziffer: string, factor: string, count: string, amount: string }>}
 */
export function parseInvoiceText(text) {
  const rows = [];
  const lines = String(text ?? "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const zifferMatch = trimmed.match(/^([0-9]{1,4}[a-zA-Z]?)\b/);
    if (!zifferMatch) continue;
    const ziffer = zifferMatch[1].slice(0, PATIENT_BILLING_EXPLAIN_LIMITS.MAX_ZIFFER_LEN);

    const decimals = trimmed.match(DECIMAL_RE) || [];
    let factor = "";
    let amount = "";
    for (const d of decimals) {
      const val = parseFloat(d.replace(",", "."));
      if (!factor && val > 0 && val <= 5) factor = d;
      else if (!amount && val > 5) amount = d;
    }
    rows.push({ ziffer, factor, count: "1", amount });
    if (rows.length >= PATIENT_BILLING_EXPLAIN_LIMITS.MAX_ROWS) break;
  }
  return rows;
}

/** Normalise a single structured row from the request into the engine row shape. */
function normaliseRow(raw) {
  const ziffer = String(raw?.ziffer ?? "").trim().slice(0, PATIENT_BILLING_EXPLAIN_LIMITS.MAX_ZIFFER_LEN);
  const factor = String(raw?.factor ?? "").trim().slice(0, 16);
  const count = String(raw?.count ?? "").trim().slice(0, 8);
  const amount = String(raw?.amount ?? "").trim().slice(0, 24);
  // The patient "note" maps to the engine's contextText (used for the justification check).
  const note = String(raw?.note ?? "").trim().slice(0, PATIENT_BILLING_EXPLAIN_LIMITS.MAX_NOTE_LENGTH);
  return { ziffer, factor, count, amount, note };
}

/**
 * Build the patient-facing explanation result from manual structured rows OR pasted text.
 *
 * @param {{ rows?: Array<object>, text?: string }} input
 * @returns {{ ok: true, source: 'fields'|'text', items: Array<object>, hasWarnings: boolean,
 *            noFindings: boolean, personalDataNotice: boolean }
 *          | { ok: false, error: 'empty'|'too_long'|'too_many_rows' }}
 */
export function explainEntries(input = {}) {
  const text = typeof input.text === "string" ? input.text : "";
  const rawRows = Array.isArray(input.rows) ? input.rows : [];

  if (text.length > PATIENT_BILLING_EXPLAIN_LIMITS.MAX_TEXT_LENGTH) {
    return { ok: false, error: "too_long" };
  }

  // Decide source: structured fields take precedence; otherwise parse pasted text.
  let source;
  let normalised;
  let lenient = false;

  const filledRows = rawRows
    .map(normaliseRow)
    .filter((r) => r.ziffer || r.factor || r.count || r.amount || r.note);

  if (filledRows.length > 0) {
    source = "fields";
    normalised = filledRows;
  } else if (text.trim()) {
    source = "text";
    lenient = true;
    normalised = parseInvoiceText(text).map((r) => ({ ...r, note: "" }));
  } else {
    return { ok: false, error: "empty" };
  }

  if (normalised.length === 0) {
    // Text was provided but no recognisable billing rows were found.
    return { ok: false, error: "empty" };
  }
  if (normalised.length > PATIENT_BILLING_EXPLAIN_LIMITS.MAX_ROWS) {
    return { ok: false, error: "too_many_rows" };
  }

  // Reuse the deterministic engine. It expects { ziffer, factor, count, contextText }.
  const engineRows = normalised.map((r) => ({
    ziffer: r.ziffer,
    factor: r.factor,
    count: r.count,
    contextText: r.note || "",
  }));
  const { rowResults } = validateGoaeRows(engineRows);

  const items = rowResults.map((res, idx) => {
    const src = normalised[idx];
    let warnings = res.warnings.slice();
    if (lenient) {
      // In text mode absent factor/count is expected, not an error — suppress that noise.
      warnings = warnings.filter((w) => w !== "invalid_factor" && w !== "invalid_count");
    }
    const m = res.match || {};
    return {
      ziffer: res.ziffer,
      found: Boolean(m.found),
      title: m.found ? m.title ?? null : null,
      points: m.found ? m.points ?? null : null,
      completenessStatus: m.found ? m.completenessStatus ?? null : null,
      sourceLineOrReference: m.found ? m.sourceLineOrReference ?? null : null,
      factor: src.factor || null,
      count: src.count || null,
      amount: src.amount || null,
      warnings,
    };
  });

  const hasWarnings = items.some((it) => it.warnings.length > 0);

  return {
    ok: true,
    source,
    items,
    hasWarnings,
    noFindings: !hasWarnings,
    personalDataNotice: detectPossiblePersonalData(text),
  };
}
