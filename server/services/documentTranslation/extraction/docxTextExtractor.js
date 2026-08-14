/**
 * DOCX text extraction (local only).
 *
 * Uses mammoth, but NOT its text or HTML output. Both flatten a table into a
 * linear stream — "Parameter, Wert, CRP, 1,5 mg/dl" — which destroys the
 * column association that gives a lab row its meaning.
 *
 * Instead this walks mammoth's own parsed document model via transformDocument.
 * Every structural label below comes from that model, never from a guess:
 *
 *   heading     paragraph.styleName matching Word's "heading N"
 *   list_item   paragraph.numbering present
 *   paragraph   everything else
 *   table_row   table > tableRow, with cells kept as separate strings
 *
 * Merged cells (colSpan/rowSpan > 1) make column association ambiguous, so a
 * table containing them is refused rather than linearised.
 */

import mammoth from "mammoth";
import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "../documentTranslationPolicy.js";
import { assertSafeDocxContainer } from "./zipPreflight.js";

/** Joins table cells into a single translatable line while keeping the split. */
export const TABLE_CELL_SEPARATOR = " | ";

/**
 * @param {Buffer} buffer
 * @returns {Promise<{
 *   sourceFormat: "docx",
 *   pageCount: null,
 *   structureReliable: true,
 *   pageCharCounts: number[],
 *   segments: { index: number, kind: string, text: string, cells?: string[] }[],
 * }>}
 */
export async function extractDocx(buffer) {
  // Container checks BEFORE decompression: a 25 MB upload cap says nothing
  // about what the archive expands to, and the character budgets downstream
  // only apply to text that already exists.
  assertSafeDocxContainer(buffer);

  let model = null;

  try {
    await mammoth.convertToHtml(
      { buffer },
      {
        // externalFileAccess is deliberately NOT set. Mammoth's Files helper
        // reads external image targets from the local filesystem when that
        // option is truthy (lib/docx/files.js), which would turn a crafted
        // document into a local-file-read primitive. Leaving it unset makes
        // every external read reject. Pinned by test — do not add it here.
        transformDocument: (doc) => {
          model = doc;
          return doc;
        },
      },
    );
  } catch (err) {
    throw mapDocxError(err);
  }

  if (!model || typeof model !== "object") {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, { reason: "no_model" });
  }

  const segments = [];
  walk(model, segments);

  return {
    sourceFormat: "docx",
    pageCount: null,
    structureReliable: true,
    // DOCX has no page concept before rendering; page-coverage guards do not
    // apply and are deliberately not faked with a single synthetic page.
    pageCharCounts: [],
    segments,
  };
}

/**
 * Depth-first walk in document order. Order is the model's order — nothing is
 * sorted or reordered, so segment indices mirror the document exactly.
 *
 * @param {any} node
 * @param {{ index: number, kind: string, text: string, cells?: string[] }[]} out
 * @param {boolean} insideTable
 */
function walk(node, out, insideTable = false) {
  if (!node || typeof node !== "object") return;

  switch (node.type) {
    case "table": {
      for (const row of node.children || []) {
        if (row?.type !== "tableRow") continue;
        emitTableRow(row, out);
      }
      return;
    }

    case "paragraph": {
      // Paragraphs inside table cells are emitted as part of their row, not
      // separately — otherwise every cell would also appear as loose prose.
      if (insideTable) return;
      const text = collectText(node).trim();
      if (!text) return;
      out.push({ index: out.length, kind: paragraphKind(node), text });
      return;
    }

    default: {
      for (const child of node.children || []) walk(child, out, insideTable);
    }
  }
}

/**
 * @param {any} row
 * @param {{ index: number, kind: string, text: string, cells?: string[] }[]} out
 */
function emitTableRow(row, out) {
  const cells = [];

  for (const cell of row.children || []) {
    if (cell?.type !== "tableCell") continue;

    const colSpan = Number(cell.colSpan ?? 1);
    const rowSpan = Number(cell.rowSpan ?? 1);
    if (colSpan > 1 || rowSpan > 1) {
      // A merged cell means a value can no longer be tied to exactly one
      // column. For a lab table that is a wrong-value-under-wrong-parameter
      // risk, so the whole document is declined.
      throw new DocumentTranslationError(TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED, {
        reason: "merged_table_cell",
      });
    }

    cells.push(collectText(cell).replace(/\s+/g, " ").trim());
  }

  if (cells.length === 0) return;
  if (cells.every((c) => c.length === 0)) return;

  out.push({
    index: out.length,
    kind: "table_row",
    text: cells.join(TABLE_CELL_SEPARATOR),
    cells,
  });
}

/**
 * Heading vs list item vs plain paragraph — all three read off the model.
 * @param {any} node
 */
function paragraphKind(node) {
  const styleName = String(node.styleName || "").toLowerCase();
  const styleId = String(node.styleId || "").toLowerCase();

  if (/^heading\s*\d/.test(styleName) || /^heading\d/.test(styleId)) return "heading";
  if (node.numbering) return "list_item";
  return "paragraph";
}

/**
 * Concatenate text nodes. Line breaks inside a run become spaces so a segment
 * stays a single line; segment boundaries come from the model, not from wrapping.
 * @param {any} node
 */
function collectText(node) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "text") return String(node.value ?? "");
  if (node.type === "break") return " ";
  if (node.type === "tab") return " ";

  let out = "";
  for (const child of node.children || []) out += collectText(child);
  return out;
}

/** @param {unknown} err */
function mapDocxError(err) {
  if (err instanceof DocumentTranslationError) return err;

  const message = err instanceof Error ? err.message : "";
  // mammoth surfaces a non-zip payload as a JSZip "end of central directory"
  // error. That is the ".doc renamed to .docx" and "truncated upload" case.
  if (/central directory|zip file|corrupted zip/i.test(message)) {
    return new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, { reason: "not_a_docx" });
  }
  return new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, { reason: "docx_parse_failed" });
}
