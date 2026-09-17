/**
 * Local document text extraction — dispatcher and plausibility guards.
 *
 * "Some text came out" is not the same as "this document was extracted".
 * A scanned PDF with a stamp and a fax header yields a few dozen characters;
 * translating those and presenting the result as the document would be worse
 * than refusing, because the patient cannot see what is missing.
 *
 * So every extraction has to survive a set of plausibility checks before it is
 * allowed downstream. All of them fail closed with a stable code.
 *
 * Local only: no OCR, no vision model, no network. Nothing here sends document
 * content anywhere.
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
  TRANSLATION_LIMITS,
  requiresReliableStructure,
} from "../documentTranslationPolicy.js";
import { extractPdf } from "./pdfTextExtractor.js";
import { extractDocx } from "./docxTextExtractor.js";

const MIME_PDF = "application/pdf";
const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Formats V1 handles. Everything else — images, legacy .doc, anything unknown —
 * is refused here, before a single byte is parsed.
 */
const EXTRACTORS = Object.freeze({
  [MIME_PDF]: extractPdf,
  [MIME_DOCX]: extractDocx,
});

/**
 * Maximum share of Unicode replacement characters before the text is treated as
 * an encoding failure rather than content. A PDF with broken font encoding
 * produces mostly U+FFFD, which would otherwise sail through the length checks.
 */
const MAX_REPLACEMENT_CHAR_RATIO = 0.02;

/**
 * @param {object} input
 * @param {Buffer} input.buffer
 * @param {string} input.mimeType
 * @param {string} input.documentType  PracticeDocument.type, for structure rules
 * @returns {Promise<{
 *   sourceFormat: string,
 *   pageCount: number | null,
 *   structureReliable: boolean,
 *   totalChars: number,
 *   segments: { index: number, kind: string, text: string, page?: number, cells?: string[] }[],
 * }>}
 */
export async function extractDocumentText(input) {
  const mimeType = String(input?.mimeType || "").toLowerCase();
  const extractor = EXTRACTORS[mimeType];

  if (!extractor) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.UNSUPPORTED_FILE_TYPE, { mimeType });
  }

  const buffer = input?.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.CORRUPT, { reason: "empty_file" });
  }

  const raw = await extractor(buffer);

  assertStructureSufficient(raw, input?.documentType);
  const totalChars = assertExtractionPlausible(raw);

  return {
    sourceFormat: raw.sourceFormat,
    pageCount: raw.pageCount,
    structureReliable: raw.structureReliable,
    totalChars,
    segments: raw.segments,
  };
}

/**
 * Structure-critical types may only proceed on a source that actually carries
 * structure.
 *
 * In practice this means a lab document must be DOCX in V1: a PDF text layer
 * cannot prove that a row's value still belongs to its parameter. Refusing is
 * the point — a mis-associated lab value reads as authoritative.
 *
 * @param {{ structureReliable: boolean }} raw
 * @param {string} documentType
 */
function assertStructureSufficient(raw, documentType) {
  if (!requiresReliableStructure(documentType)) return;
  if (raw.structureReliable) return;

  throw new DocumentTranslationError(TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED, {
    reason: "structure_not_recoverable_from_source",
    documentType,
    sourceFormat: raw.sourceFormat,
  });
}

/**
 * @param {{ segments: any[], pageCharCounts: number[], pageCount: number | null, sourceFormat: string }} raw
 * @returns {number} total character count
 */
function assertExtractionPlausible(raw) {
  const segments = Array.isArray(raw.segments) ? raw.segments : [];

  if (segments.length === 0) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TEXT_UNAVAILABLE, {
      reason: "no_segments",
    });
  }
  if (segments.length > TRANSLATION_LIMITS.MAX_SEGMENTS) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TOO_LARGE, {
      reason: "segment_count",
      segments: segments.length,
    });
  }

  let totalChars = 0;
  let replacementChars = 0;

  for (const seg of segments) {
    const text = typeof seg?.text === "string" ? seg.text : "";

    if (text.length > TRANSLATION_LIMITS.MAX_SEGMENT_CHARS) {
      // One enormous segment means segmentation did not actually happen — the
      // whole document arrived as a single blob. Per-segment invariants could
      // not be checked, so this is refused as unsupported structure rather than
      // processed as one giant unit.
      throw new DocumentTranslationError(TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED, {
        reason: "segment_too_large",
        index: seg?.index,
      });
    }

    totalChars += text.length;
    replacementChars += (text.match(/�/g) || []).length;
  }

  if (totalChars > TRANSLATION_LIMITS.MAX_TOTAL_CHARS) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TOO_LARGE, {
      reason: "total_chars",
      totalChars,
    });
  }

  if (totalChars < TRANSLATION_LIMITS.MIN_TOTAL_CHARS) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TEXT_UNAVAILABLE, {
      reason: "below_minimum_text",
      totalChars,
    });
  }

  if (replacementChars / Math.max(totalChars, 1) > MAX_REPLACEMENT_CHAR_RATIO) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TEXT_UNAVAILABLE, {
      reason: "encoding_unreadable",
    });
  }

  assertPageCoverage(raw);

  return totalChars;
}

/**
 * Page-level checks. Only meaningful for paginated sources; DOCX reports no
 * pages and is skipped rather than given a synthetic single page.
 *
 * @param {{ pageCharCounts: number[], pageCount: number | null }} raw
 */
function assertPageCoverage(raw) {
  const counts = Array.isArray(raw.pageCharCounts) ? raw.pageCharCounts : [];
  if (counts.length === 0) return;

  const pageCount = counts.length;
  const total = counts.reduce((n, c) => n + c, 0);
  const meanPerPage = total / pageCount;

  if (meanPerPage < TRANSLATION_LIMITS.MIN_MEAN_CHARS_PER_PAGE) {
    // Typical of a scan whose only text is a header, a stamp, or a page number.
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TEXT_UNAVAILABLE, {
      reason: "insufficient_text_per_page",
    });
  }

  const populated = counts.filter(
    (c) => c >= TRANSLATION_LIMITS.EMPTY_PAGE_CHAR_THRESHOLD,
  ).length;

  if (populated / pageCount < TRANSLATION_LIMITS.MIN_PAGE_COVERAGE_RATIO) {
    // Text on the cover sheet only: the rest of the document would silently go
    // missing from the translation.
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TEXT_UNAVAILABLE, {
      reason: "insufficient_page_coverage",
      populated,
      pageCount,
    });
  }
}
