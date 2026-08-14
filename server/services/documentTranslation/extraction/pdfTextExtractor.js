/**
 * PDF text-layer extraction (local only).
 *
 * Uses unpdf, which wraps a current pdf.js build: pure JavaScript, no native
 * bindings, no network. Nothing is sent anywhere and no OCR is attempted — a
 * scan without a text layer is refused rather than guessed at.
 *
 * ── Structure honesty ───────────────────────────────────────────────────────
 * A PDF text layer carries no semantic markup. There is no reliable way to tell
 * a heading from a bold line, or a table row from a line that happens to have
 * gaps. So this extractor never claims semantic structure: it reports
 * structureReliable=false and emits layout-derived blocks only.
 *
 * That has a deliberate consequence: document types whose meaning depends on
 * table structure (lab) cannot be sourced from PDF in V1 and are refused by the
 * extraction service. Reading a lab table as prose silently re-associates values
 * with the wrong parameters, which is worse than declining.
 */

import { extractText, getDocumentProxy } from "unpdf";
import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
  TRANSLATION_LIMITS,
} from "../documentTranslationPolicy.js";

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
  // pdf.js takes ownership of the array it is handed and detaches the backing
  // ArrayBuffer, so a second call on the same array sees an empty document and
  // reports it as corrupt. Each call therefore gets its own copy.
  const bytesFor = () => new Uint8Array(buffer);

  let pageCount;
  try {
    const proxy = await getDocumentProxy(bytesFor());
    pageCount = proxy.numPages;
  } catch (err) {
    throw mapPdfError(err);
  }

  // Refuse oversized documents before extracting anything: the page count is
  // known from the catalogue, so there is no reason to parse 500 pages first.
  if (!Number.isFinite(pageCount) || pageCount < 1) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, { reason: "no_pages" });
  }
  if (pageCount > TRANSLATION_LIMITS.MAX_PAGES) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TOO_LARGE, {
      reason: "page_count",
      pageCount,
    });
  }

  let pages;
  try {
    const result = await extractText(bytesFor(), { mergePages: false });
    pages = Array.isArray(result?.text) ? result.text : [];
  } catch (err) {
    throw mapPdfError(err);
  }

  const segments = [];
  const pageCharCounts = [];

  pages.forEach((raw, pageIdx) => {
    const pageText = typeof raw === "string" ? raw : "";
    pageCharCounts.push(countMeaningfulChars(pageText));

    for (const block of splitIntoBlocks(pageText)) {
      segments.push({
        index: segments.length,
        // Layout-derived, not semantic. Named so no downstream reader mistakes
        // it for a parsed heading or table row.
        kind: "text_block",
        text: block,
        page: pageIdx + 1,
      });
    }
  });

  return {
    sourceFormat: "pdf",
    pageCount,
    structureReliable: false,
    pageCharCounts,
    segments,
  };
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
  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";

  if (name === "PasswordException") {
    return new DocumentTranslationError(TRANSLATION_ERRORS.ENCRYPTED);
  }
  // InvalidPDFException, MissingPDFException, UnknownErrorException and
  // anything unforeseen all collapse to "corrupt": fail closed rather than
  // trying to interpret a broken file.
  return new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, { parser: name || "unknown" });
}
