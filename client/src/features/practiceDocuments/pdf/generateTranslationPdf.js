/**
 * Client-side PDF export of a transformation result.
 *
 * Built in the browser from the result already on screen, so the transformed
 * medical text is never sent back to the server just to be rendered. Nothing is
 * persisted anywhere.
 *
 * ── Font ────────────────────────────────────────────────────────────────────
 * jsPDF's built-in Helvetica is WinAnsi-encoded and has no Cyrillic glyphs, so
 * it cannot typeset a Russian result — and Russian is one of the six languages
 * MedScoutX ships. Phase 2C therefore had to disable the export for Russian.
 *
 * That gap is now closed with a bundled Unicode font: a renamed subset of
 * DejaVu Sans, whose Bitstream Vera licence explicitly permits embedding,
 * redistribution and modification. Provenance, licence text and the subset
 * ranges are documented in client/public/fonts/README.md.
 *
 * The proprietary previsit-pdf-tahoma.ttf already in the repository was NOT
 * reused: its embedding licence could not be established, and adopting it
 * because it happens to be present would have been assuming one.
 *
 * The font is fetched on demand, only when a patient actually exports, so it
 * never enters the application bundle. One weight is loaded; headings are
 * distinguished by size rather than by shipping a second 250 KB file.
 *
 * ── This module never interprets ────────────────────────────────────────────
 * Every string is drawn as literal text. There is no markdown, no HTML, no link
 * annotation and no remote resource: a transformation result is content to
 * render, never markup to execute.
 */

import { jsPDF } from "jspdf";

/** Served from client/public/fonts. */
const FONT_URL = "fonts/medscoutx-document-sans.ttf";
const FONT_VFS_NAME = "medscoutx-document-sans.ttf";
const FONT_FAMILY = "MedScoutXDocumentSans";

/**
 * All six shipped UI languages export, now that the bundled font covers Latin
 * and Cyrillic. Kept as an explicit list rather than "everything" so that
 * activating a seventh UI language cannot silently start producing PDFs in a
 * script the font does not contain.
 */
export const PDF_EXPORTABLE_LANGUAGES = Object.freeze(["de", "en", "fr", "es", "it", "ru"]);

/** @param {string} targetLanguage */
export function canExportPdfForLanguage(targetLanguage) {
  return PDF_EXPORTABLE_LANGUAGES.includes(targetLanguage);
}

/** Page geometry, in millimetres. */
const LAYOUT = Object.freeze({
  marginX: 18,
  marginTop: 20,
  marginBottom: 20,
  bodySize: 10,
  headingSize: 12,
  titleSize: 16,
  metaSize: 9,
  footnoteSize: 8,
  /** Multiplier from font size (pt) to line height (mm). */
  lineFactor: 0.45,
});

let fontPromise = null;

/**
 * Fetch and register the Unicode font once per session.
 *
 * Cached in a module-level promise: a patient exporting twice should not pull
 * 268 KB twice, and a failed load must not poison later attempts.
 */
async function ensureFont(doc, fetchImpl) {
  if (!fontPromise) {
    fontPromise = (async () => {
      const res = await (fetchImpl ?? fetch)(resolveFontUrl());
      if (!res.ok) throw new Error("pdf_font_load_failed");
      return toBinaryString(await res.arrayBuffer());
    })().catch((err) => {
      fontPromise = null;
      throw err;
    });
  }

  const binary = await fontPromise;
  if (!doc.existsFileInVFS?.(FONT_VFS_NAME)) {
    doc.addFileToVFS(FONT_VFS_NAME, binary);
  }
  doc.addFont(FONT_VFS_NAME, FONT_FAMILY, "normal");
  doc.setFont(FONT_FAMILY, "normal");
}

function resolveFontUrl() {
  const base = String(import.meta.env?.BASE_URL || "/");
  return `${base.endsWith("/") ? base : `${base}/`}${FONT_URL}`;
}

/** ArrayBuffer -> binary string, in chunks so a large font cannot blow the stack. */
function toBinaryString(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let out = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

/**
 * Build a safe download file name.
 *
 * The original file name is practice-supplied text: it is stripped of
 * diacritics, reduced to a conservative ASCII slug, and length-bounded. Path
 * separators, dots, control characters and markup cannot survive. No internal
 * identifier is ever used, including as a fallback.
 *
 * @param {{ originalFileName?: string, targetLanguage: string, mode: string }} input
 * @param {{ suffix?: string }} [labels]
 */
export function buildTranslationFileName(input, labels = {}) {
  const stem = asciiSlug(
    String(input.originalFileName ?? "").replace(/\.[A-Za-z0-9]{1,8}$/, ""),
    60,
  );
  const suffix = asciiSlug(String(labels.suffix ?? "uebersetzung"), 30);
  const language = String(input.targetLanguage ?? "")
    .replace(/[^a-z]/gi, "")
    .slice(0, 5)
    .toLowerCase();

  return `${stem || "dokument"}_${suffix || "export"}_${language || "xx"}.pdf`;
}

/** @param {string} value @param {number} maxLength */
function asciiSlug(value, maxLength) {
  return value
    .normalize("NFKD")
    // Strip combining marks so "Müller" becomes "muller", not "m_ller".
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[Ѐ-ӿ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLength)
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

/**
 * Render the transformation to a PDF and hand it to the browser.
 *
 * @param {object} input
 * @param {{ id: string, kind: string, text: string }[]} input.segments
 * @param {string} input.originalFileName
 * @param {string} input.sourceLanguage
 * @param {string} input.targetLanguage
 * @param {string} input.mode
 * @param {string} [input.generatedAt] ISO timestamp from the server
 * @param {object} input.labels pre-resolved i18n strings — this module does no
 *   translation of its own, so the caller stays the single source of wording
 * @param {Function} [input.fetchImpl] injection seam for tests
 * @param {boolean} [input.save] set false to build without triggering a download
 * @returns {Promise<{ fileName: string, doc: import("jspdf").jsPDF }>}
 */
export async function generateTranslationPdf(input) {
  if (!canExportPdfForLanguage(input.targetLanguage)) {
    throw new Error("pdf_language_not_supported");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Strip the metadata jsPDF would otherwise fill in. A PDF leaving the app
  // must carry no identifier: not the document, the file, the patient, the
  // practice, the provider or the prompt version.
  doc.setProperties({
    title: String(input.labels.documentTitle ?? ""),
    subject: "",
    author: "",
    keywords: "",
    creator: "",
  });

  await ensureFont(doc, input.fetchImpl);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const textWidth = pageWidth - LAYOUT.marginX * 2;
  let y = LAYOUT.marginTop;

  const ensureSpace = (needed) => {
    if (y + needed <= pageHeight - LAYOUT.marginBottom) return;
    doc.addPage();
    // A new page starts with the default font; re-assert ours.
    doc.setFont(FONT_FAMILY, "normal");
    y = LAYOUT.marginTop;
  };

  const write = (text, { size = LAYOUT.bodySize, gap = 4, colour = [15, 23, 42] } = {}) => {
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(size);
    doc.setTextColor(...colour);
    const lineHeight = size * LAYOUT.lineFactor;
    // splitTextToSize measures against the embedded font, so a long German
    // compound or a Cyrillic run wraps inside the margins rather than
    // overflowing the page.
    for (const line of doc.splitTextToSize(String(text ?? ""), textWidth)) {
      ensureSpace(lineHeight);
      doc.text(line, LAYOUT.marginX, y);
      y += lineHeight;
    }
    y += gap;
  };

  // ── Header ───────────────────────────────────────────────────────────────
  write(input.labels.documentTitle, { size: LAYOUT.titleSize, gap: 3 });

  // The AI marking sits above the content, so the body cannot be read without
  // having seen it.
  write(input.labels.aiNotice, { size: LAYOUT.bodySize, gap: 5, colour: [180, 83, 9] });

  const meta = [
    `${input.labels.originalFileLabel}: ${input.originalFileName}`,
    `${input.labels.modeLabel}: ${input.labels.modeName}`,
    `${input.labels.sourceLanguageLabel}: ${input.labels.sourceLanguageName}`,
    `${input.labels.targetLanguageLabel}: ${input.labels.targetLanguageName}`,
  ];
  if (input.generatedAt) {
    meta.push(`${input.labels.generatedAtLabel}: ${formatTimestamp(input.generatedAt)}`);
  }
  write(meta.join("\n"), { size: LAYOUT.metaSize, colour: [71, 85, 105], gap: 4 });

  doc.setDrawColor(203, 213, 225);
  ensureSpace(6);
  doc.line(LAYOUT.marginX, y, pageWidth - LAYOUT.marginX, y);
  y += 6;

  // ── Content, in the order the server returned it ─────────────────────────
  for (const segment of input.segments ?? []) {
    const text = String(segment?.text ?? "");
    if (!text.trim()) continue;
    const heading = segment?.kind === "heading";
    write(text, {
      size: heading ? LAYOUT.headingSize : LAYOUT.bodySize,
      gap: heading ? 3 : 4,
    });
  }

  // ── Footer note ──────────────────────────────────────────────────────────
  ensureSpace(14);
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(LAYOUT.marginX, y, pageWidth - LAYOUT.marginX, y);
  y += 6;
  write(input.labels.originalAuthoritative, {
    size: LAYOUT.footnoteSize,
    colour: [100, 116, 139],
    gap: 0,
  });

  const fileName = buildTranslationFileName(
    {
      originalFileName: input.originalFileName,
      targetLanguage: input.targetLanguage,
      mode: input.mode,
    },
    { suffix: input.labels.fileNameSuffix },
  );

  if (input.save !== false) doc.save(fileName);
  return { fileName, doc };
}

/** Test seam — the font cache is module state and would leak between cases. */
export function resetPdfFontCache() {
  fontPromise = null;
}

/** @param {string} iso */
function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  // Fixed, unambiguous rendering: an exported medical document may be read in
  // any locale, and a locale-dependent date invites misreading.
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
