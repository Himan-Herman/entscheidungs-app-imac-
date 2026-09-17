/**
 * PDF text-layer extraction (local only).
 *
 * Uses unpdf, which wraps a current pdf.js build: pure JavaScript, no native
 * bindings, no network. Nothing is sent anywhere and no OCR is attempted — a
 * scan without a text layer is refused rather than guessed at.
 *
 * ── One parse, three jobs ───────────────────────────────────────────────────
 * The page's text items carry both their string and their position, so text,
 * page statistics and layout analysis all come from a single getTextContent()
 * pass. An earlier version parsed twice and hit a subtle failure: pdf.js takes
 * ownership of the array it is given and detaches the backing buffer, so the
 * second parse saw an empty document and reported a valid file as corrupt.
 *
 * ── Structure honesty ───────────────────────────────────────────────────────
 * A PDF text layer carries no semantic markup, so this extractor never claims
 * heading or table structure: structureReliable is false and segments are
 * layout-derived blocks.
 *
 * It does, however, check that the content-stream order can be trusted as
 * reading order at all. Two columns, text boxes and wide tables all extract in
 * an order that has nothing to do with how a person reads the page, and a
 * medication table read across instead of down moves a dose to another drug.
 * Those pages are refused with document_structure_unsupported.
 *
 * Item order is never re-sorted. Sorting would replace the document's order
 * with one this code invented, which is precisely the failure being guarded
 * against; the page is either trustworthy as-is or refused.
 */

import { getDocumentProxy } from "unpdf";
import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
  TRANSLATION_LIMITS,
} from "../documentTranslationPolicy.js";
import { analysePageLayout, assertSafePdfContainer } from "./pdfPreflight.js";
import { parseInIsolation } from "./isolatedParser.js";

/**
 * @param {Buffer} buffer
 * @returns {Promise<{
 *   sourceFormat: "pdf",
 *   pageCount: number,
 *   structureReliable: false,
 *   pageCharCounts: number[],
 *   segments: { index: number, kind: string, text: string, page: number }[],
 * }>}
 */
export async function extractPdf(buffer) {
  // Raw-byte checks first, in the host: they are cheap, need no parser, and
  // rejecting an obvious bomb should not cost a worker spawn.
  assertSafePdfContainer(buffer);

  // The actual parse runs in a terminable, memory-bounded worker.
  return parseInIsolation("pdf", buffer);
}

/**
 * The raw parse. Runs INSIDE the worker — see parserWorker.js.
 * Exported separately so the isolation boundary is explicit rather than
 * something a caller could bypass by accident.
 *
 * @param {Buffer} buffer
 */
export async function parsePdfBuffer(buffer) {
  let doc;
  try {
    doc = await getDocumentProxy(new Uint8Array(buffer));
  } catch (err) {
    throw mapPdfError(err);
  }

  const pageCount = doc.numPages;
  if (!Number.isFinite(pageCount) || pageCount < 1) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, { reason: "no_pages" });
  }
  if (pageCount > TRANSLATION_LIMITS.MAX_PAGES) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TOO_LARGE, {
      reason: "page_count",
      pageCount,
    });
  }

  const segments = [];
  const pageCharCounts = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    let items;
    let view;
    try {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      view = page.view;
      items = content.items || [];
    } catch (err) {
      throw mapPdfError(err);
    }

    const positioned = items
      .filter((i) => i && typeof i.str === "string")
      .map((i) => ({
        str: i.str,
        hasEOL: Boolean(i.hasEOL),
        x: Number(i.transform?.[4] ?? 0),
        y: Number(i.transform?.[5] ?? 0),
        width: Number(i.width ?? 0),
        height: Number(i.height ?? 0),
      }));

    const pageBox = {
      width: Number(view?.[2] ?? 595) - Number(view?.[0] ?? 0),
      height: Number(view?.[3] ?? 842) - Number(view?.[1] ?? 0),
    };

    const layout = analysePageLayout(positioned, pageBox);
    if (layout.complex) {
      throw new DocumentTranslationError(TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED, {
        reason: layout.reason,
        page: pageNumber,
        // Metrics only — geometry, never document text.
        ...layout.metrics,
      });
    }

    const pageText = itemsToText(positioned);
    pageCharCounts.push(countMeaningfulChars(pageText));

    for (const block of splitIntoBlocks(pageText)) {
      segments.push({
        index: segments.length,
        // Layout-derived, not semantic. Named so no downstream reader mistakes
        // it for a parsed heading or table row.
        kind: "text_block",
        text: block,
        page: pageNumber,
      });
    }
  }

  return {
    sourceFormat: "pdf",
    pageCount,
    structureReliable: false,
    pageCharCounts,
    segments,
  };
}

/**
 * Rebuild page text from the items, in the order the document supplies them.
 * @param {{ str: string, hasEOL: boolean }[]} items
 */
function itemsToText(items) {
  let out = "";
  for (const item of items) {
    out += item.str;
    if (item.hasEOL) out += "\n";
  }
  return out;
}

/**
 * Split a page into blocks on blank lines.
 *
 * Blank lines are an observable property of the extracted text, not an
 * inference about meaning. Where a page has no blank lines, every line becomes
 * its own block — lines are never merged, because whether a line break is a
 * soft wrap or a real boundary is exactly what a PDF does not tell us.
 *
 * @param {string} pageText
 */
function splitIntoBlocks(pageText) {
  const normalized = pageText.replace(/\r\n?/g, "\n");
  const hasBlankLines = /\n[ \t]*\n/.test(normalized);

  const parts = hasBlankLines ? normalized.split(/\n[ \t]*\n+/) : normalized.split("\n");

  return parts
    .map((p) => p.replace(/[ \t]+\n/g, "\n").trim())
    .filter((p) => p.length > 0);
}

/**
 * Characters that count towards "this page really has text".
 * Whitespace and Unicode replacement characters do not.
 * @param {string} text
 */
function countMeaningfulChars(text) {
  return text.replace(/�/g, "").replace(/\s+/g, "").length;
}

/**
 * Map pdf.js failures onto our stable codes.
 *
 * The original error is never attached: a malformed document controls that
 * message, and it must not reach a response or a log line.
 * @param {unknown} err
 */
function mapPdfError(err) {
  if (err instanceof DocumentTranslationError) return err;

  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";

  if (name === "PasswordException") {
    return new DocumentTranslationError(TRANSLATION_ERRORS.ENCRYPTED);
  }
  // InvalidPDFException, MissingPDFException, UnknownErrorException and
  // anything unforeseen all collapse to "corrupt": fail closed rather than
  // trying to interpret a broken file.
  return new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, { parser: name || "unknown" });
}
