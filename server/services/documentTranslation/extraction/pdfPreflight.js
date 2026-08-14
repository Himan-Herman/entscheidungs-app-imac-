/**
 * PDF byte-level preflight and layout analysis.
 *
 * ── What the preflight is for ───────────────────────────────────────────────
 * The page and character budgets in documentTextExtractionService only apply
 * AFTER pdf.js has parsed the file. A small, hand-built PDF can declare an
 * enormous object graph and burn CPU and memory during that parse, before any
 * of those limits is reachable. The checks below read raw bytes only — no
 * parsing, no allocation proportional to the content — and reject the obvious
 * shapes of that attack up front.
 *
 * These are cheap filters, not a sandbox — and they are no longer the only
 * defence. The parse itself now runs in a terminable, memory-bounded worker
 * (isolatedParser.js), so a file that gets past these checks still cannot take
 * the host process with it. The preflight remains because rejecting an obvious
 * bomb should not cost a thread spawn.
 *
 * ── Layout analysis ─────────────────────────────────────────────────────────
 * A PDF can have a perfect text layer and still extract in the wrong reading
 * order: two columns, text boxes, tables. For a medical letter that is not a
 * cosmetic problem — a medication table read across instead of down changes
 * which dose belongs to which drug. So clearly complex layouts are refused
 * rather than translated in whatever order the content stream happens to use.
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "../documentTranslationPolicy.js";
import { containsClinicalToken } from "../masking/criticalTokenMasking.js";

export const PDF_LIMITS = Object.freeze({
  /** Mirrors the practice-document upload cap. */
  MAX_BYTES: 25 * 1024 * 1024,
  /** Indirect objects. A long clinical letter stays far below this. */
  MAX_OBJECTS: 50_000,
  /** Compressed object streams can hide many objects behind few markers. */
  MAX_OBJECT_STREAMS: 2_000,
  /** Dictionary nesting depth — legitimate PDFs stay in the low tens. */
  MAX_DICT_NESTING: 64,
  /** Wall-clock ceiling for the whole parse-and-extract step. */
  PARSE_TIMEOUT_MS: 20_000,
});

export const LAYOUT_LIMITS = Object.freeze({
  /** Share of items each side needs before a page counts as two-column. */
  COLUMN_MIN_SHARE: 0.25,
  /** Vertical overlap of the two sides, relative to the page's text height. */
  COLUMN_MIN_VERTICAL_OVERLAP: 0.5,
  /** Share of transitions that may jump back up the page. */
  MAX_BACKWARD_JUMP_RATIO: 0.25,
  /** A backward move only counts once it exceeds this many line heights. */
  BACKWARD_JUMP_LINE_FACTOR: 2,
  /** Rows and columns from which a page counts as tabular. */
  TABLE_MIN_ROWS: 3,
  TABLE_MIN_COLUMNS: 3,
  /**
   * Two-column rows carrying clinical data. Lower than TABLE_MIN_ROWS is not
   * needed — the point is a REPEATED structure, not a single labelled line.
   */
  CLINICAL_PAIR_MIN_ROWS: 3,
  /** Horizontal gap that separates two cells rather than two words. */
  TABLE_MIN_COLUMN_GAP: 40,
  /** Items closer than this vertically belong to the same visual row. */
  ROW_TOLERANCE: 3,
});

/**
 * Raw-byte checks. Runs before pdf.js sees the file.
 * @param {Buffer} buffer
 */
export function assertSafePdfContainer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw corrupt("empty_file");
  }
  if (buffer.length > PDF_LIMITS.MAX_BYTES) {
    throw tooLarge("pdf_bytes", { bytes: buffer.length });
  }
  // A PDF header may be preceded by junk, but not by megabytes of it.
  if (buffer.indexOf("%PDF-", 0, "latin1") < 0 || buffer.indexOf("%PDF-", 0, "latin1") > 1024) {
    throw corrupt("missing_pdf_header");
  }

  const text = buffer.toString("latin1");

  const objectCount = countOccurrences(text, /\d+\s+\d+\s+obj\b/g);
  if (objectCount > PDF_LIMITS.MAX_OBJECTS) {
    throw tooLarge("pdf_object_count", { objects: objectCount });
  }

  const objectStreams = countOccurrences(text, /\/ObjStm\b/g);
  if (objectStreams > PDF_LIMITS.MAX_OBJECT_STREAMS) {
    throw tooLarge("pdf_object_streams", { objectStreams });
  }

  const nesting = maxDictionaryNesting(text);
  if (nesting > PDF_LIMITS.MAX_DICT_NESTING) {
    throw tooLarge("pdf_dictionary_nesting", { nesting });
  }

  return { bytes: buffer.length, objectCount, objectStreams, nesting };
}

/**
 * @typedef {object} TextItem
 * @property {string} str
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * Decide whether a page's layout is simple enough that content-stream order can
 * be trusted as reading order.
 *
 * @param {TextItem[]} items
 * @param {{ width: number, height: number }} page
 * @returns {{ complex: boolean, reason: string | null, metrics: Record<string, number> }}
 */
export function analysePageLayout(items, page) {
  const real = (items || []).filter((i) => i && typeof i.str === "string" && i.str.trim());
  const metrics = { items: real.length };

  if (real.length < 8) {
    // Too little text to judge — the plausibility floors elsewhere handle it.
    return { complex: false, reason: null, metrics };
  }

  const columns = detectColumns(real, page);
  Object.assign(metrics, columns.metrics);
  if (columns.detected) {
    return { complex: true, reason: "multi_column_layout", metrics };
  }

  const jumps = detectReadingOrderJumps(real);
  Object.assign(metrics, jumps.metrics);
  if (jumps.detected) {
    return { complex: true, reason: "unstable_reading_order", metrics };
  }

  const table = detectTabularLayout(real);
  Object.assign(metrics, table.metrics);
  if (table.detected) {
    return { complex: true, reason: "tabular_layout", metrics };
  }

  const clinicalPairs = detectTwoColumnClinicalRows(real);
  Object.assign(metrics, clinicalPairs.metrics);
  if (clinicalPairs.detected) {
    return { complex: true, reason: "two_column_clinical_data", metrics };
  }

  return { complex: false, reason: null, metrics };
}

/* ------------------------------------------------------------- detectors */

/**
 * Two-column detection.
 *
 * Requires all three of: a meaningful share of items on each side, a clear
 * gutter that no item crosses, and substantial vertical overlap between the
 * sides. A letterhead with an address block on the right fails the gutter or
 * the overlap condition and is therefore not treated as two columns.
 */
function detectColumns(items, page) {
  const mid = page.width / 2;
  const left = items.filter((i) => i.x + i.width <= mid);
  const right = items.filter((i) => i.x >= mid);
  const crossing = items.length - left.length - right.length;

  const metrics = {
    leftItems: left.length,
    rightItems: right.length,
    gutterCrossingItems: crossing,
  };

  if (crossing > 0) return { detected: false, metrics };

  const minShare = Math.ceil(items.length * LAYOUT_LIMITS.COLUMN_MIN_SHARE);
  if (left.length < minShare || right.length < minShare) return { detected: false, metrics };

  const leftSpan = verticalSpan(left);
  const rightSpan = verticalSpan(right);
  const overlap =
    Math.min(leftSpan.max, rightSpan.max) - Math.max(leftSpan.min, rightSpan.min);
  const textHeight = Math.max(leftSpan.max, rightSpan.max) - Math.min(leftSpan.min, rightSpan.min);

  metrics.columnVerticalOverlapRatio =
    textHeight > 0 ? Number((overlap / textHeight).toFixed(2)) : 0;

  return {
    detected:
      textHeight > 0 && overlap / textHeight >= LAYOUT_LIMITS.COLUMN_MIN_VERTICAL_OVERLAP,
    metrics,
  };
}

/**
 * How often the extraction order moves back UP the page by more than a couple
 * of lines. A single flow of prose moves monotonically downwards; frequent
 * upward jumps mean the content stream does not follow the visual order.
 */
function detectReadingOrderJumps(items) {
  const lineHeight = medianLineHeight(items);
  const threshold = lineHeight * LAYOUT_LIMITS.BACKWARD_JUMP_LINE_FACTOR;

  let jumps = 0;
  for (let i = 1; i < items.length; i += 1) {
    // PDF y grows upwards, so a LARGER y later means a move back up the page.
    if (items[i].y - items[i - 1].y > threshold) jumps += 1;
  }

  const ratio = jumps / (items.length - 1);
  return {
    detected: ratio > LAYOUT_LIMITS.MAX_BACKWARD_JUMP_RATIO,
    metrics: { backwardJumps: jumps, backwardJumpRatio: Number(ratio.toFixed(2)) },
  };
}

/**
 * Tabular detection: several visual rows that each contain several items
 * separated by wide horizontal gaps.
 *
 * Two-column tables are tolerated — "Ramipril | 5 mg" survives linearisation
 * with its meaning intact. Three or more columns do not, which is where a dose
 * can end up under the wrong drug.
 */
function detectTabularLayout(items) {
  const rows = groupIntoRows(items);

  let tabularRows = 0;
  for (const row of rows.values()) {
    if (row.length < LAYOUT_LIMITS.TABLE_MIN_COLUMNS) continue;
    const sorted = [...row].sort((a, b) => a.x - b.x);

    let wideGaps = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);
      if (gap >= LAYOUT_LIMITS.TABLE_MIN_COLUMN_GAP) wideGaps += 1;
    }
    if (wideGaps >= LAYOUT_LIMITS.TABLE_MIN_COLUMNS) tabularRows += 1;
  }

  return {
    detected: tabularRows >= LAYOUT_LIMITS.TABLE_MIN_ROWS,
    metrics: { tabularRows },
  };
}

/**
 * Two-column rows that carry clinical data.
 *
 * The general table rule needs three columns, because a two-column pair usually
 * survives linearisation with its meaning intact. That reasoning does not hold
 * for a medication or results block: "Ramipril 5 mg | 1-0-0" repeated down the
 * page linearises into a stream where a schedule can end up beside the wrong
 * drug, and nothing in the resulting text shows that it happened.
 *
 * So a REPEATED two-column structure whose cells contain medications, doses,
 * schedules, reference ranges or lab abbreviations is refused. A letterhead
 * with a right-aligned date is not: DATE and TIME are not clinical tokens, so
 * a single such row carries no clinical content and the repetition floor is
 * never reached either.
 */
function detectTwoColumnClinicalRows(items) {
  const rows = groupIntoRows(items);
  let clinicalPairRows = 0;

  for (const row of rows.values()) {
    if (row.length !== 2) continue;

    const sorted = [...row].sort((a, b) => a.x - b.x);
    const gap = sorted[1].x - (sorted[0].x + sorted[0].width);
    if (gap < LAYOUT_LIMITS.TABLE_MIN_COLUMN_GAP) continue;

    const anyClinical = sorted.some((item) => containsClinicalToken(item.str));
    if (anyClinical) clinicalPairRows += 1;
  }

  return {
    detected: clinicalPairRows >= LAYOUT_LIMITS.CLINICAL_PAIR_MIN_ROWS,
    metrics: { clinicalPairRows },
  };
}

/* ------------------------------------------------------------- internals */

/**
 * Group items into visual rows by rounded y position.
 * @param {TextItem[]} items
 */
function groupIntoRows(items) {
  const rows = new Map();
  for (const item of items) {
    const key = Math.round(item.y / LAYOUT_LIMITS.ROW_TOLERANCE);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(item);
  }
  return rows;
}

function verticalSpan(items) {
  let min = Infinity;
  let max = -Infinity;
  for (const i of items) {
    if (i.y < min) min = i.y;
    if (i.y > max) max = i.y;
  }
  return { min, max };
}

function medianLineHeight(items) {
  const heights = items.map((i) => i.height).filter((h) => h > 0).sort((a, b) => a - b);
  if (heights.length === 0) return 12;
  return heights[Math.floor(heights.length / 2)] || 12;
}

function countOccurrences(text, re) {
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(text) !== null) count += 1;
  return count;
}

/**
 * Maximum nesting depth of `<<` / `>>` dictionary delimiters.
 * Scans once; string literals are not interpreted, which can only ever
 * over-estimate depth and therefore fails in the safe direction.
 */
function maxDictionaryNesting(text) {
  let depth = 0;
  let max = 0;
  for (let i = 0; i < text.length - 1; i += 1) {
    if (text[i] === "<" && text[i + 1] === "<") {
      depth += 1;
      if (depth > max) max = depth;
      i += 1;
    } else if (text[i] === ">" && text[i + 1] === ">") {
      if (depth > 0) depth -= 1;
      i += 1;
    }
  }
  return max;
}

function corrupt(reason) {
  return new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, { reason });
}

function tooLarge(reason, detail = {}) {
  return new DocumentTranslationError(TRANSLATION_ERRORS.TOO_LARGE, { reason, ...detail });
}
