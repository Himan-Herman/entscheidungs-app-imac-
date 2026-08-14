/**
 * Client-side PDF export of a transformation result.
 *
 * Built in the browser from the result already on screen, so the transformed
 * medical text is never sent back to the server just to be rendered. Nothing is
 * persisted anywhere.
 *
 * ── Font and language coverage: an honest limitation ────────────────────────
 * jsPDF's built-in Helvetica is WinAnsi-encoded. It renders German, English,
 * French, Spanish and Italian correctly — including ä ö ü ß é è ç ñ à ò ù — but
 * it has no Cyrillic glyphs, so a Russian result would come out as garbage.
 *
 * The repository contains exactly one Unicode font with Cyrillic coverage,
 * previsit-pdf-tahoma.ttf. Tahoma is a proprietary Microsoft typeface and
 * whether its licence permits embedding and redistribution here could not be
 * established; that is tracked as `document_translation_pdf_font_licensing`.
 * Adopting it for a new feature on the strength of "it is already in the repo"
 * would be assuming a licence, so it is not used, and no font was downloaded.
 *
 * The consequence is stated rather than hidden: PDF export is offered for the
 * five Latin-script target languages and is unavailable for Russian until a
 * clearly redistributable Unicode font is chosen. The UI disables the control
 * and says so; it does not produce a broken file.
 */

import { jsPDF } from "jspdf";

/**
 * Target languages the built-in font can typeset correctly.
 * Anything requiring a non-Latin script is excluded.
 */
export const PDF_EXPORTABLE_LANGUAGES = Object.freeze(["de", "en", "fr", "es", "it"]);

/** @param {string} targetLanguage */
export function canExportPdfForLanguage(targetLanguage) {
  return PDF_EXPORTABLE_LANGUAGES.includes(targetLanguage);
}

/**
 * Build a safe download file name.
 *
 * The original file name is patient- and practice-supplied text: it is
 * transliterated to a conservative ASCII slug, stripped of path characters, and
 * length-bounded. No internal identifier is ever part of it.
 *
 * @param {{ originalFileName?: string, targetLanguage: string, mode: string }} input
 * @param {{ suffix?: string }} [labels]
 */
export function buildTranslationFileName(input, labels = {}) {
  const stem = String(input.originalFileName ?? "dokument")
    .replace(/\.[A-Za-z0-9]{1,8}$/, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .toLowerCase();

  const suffix = String(labels.suffix ?? "uebersetzung")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .slice(0, 30)
    .toLowerCase();

  const language = String(input.targetLanguage ?? "")
    .replace(/[^a-z]/gi, "")
    .slice(0, 5)
    .toLowerCase();

  return `${stem || "dokument"}_${suffix || "export"}_${language || "xx"}.pdf`;
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
 * @param {object} input.labels  pre-resolved i18n strings; this module does no
 *   translation of its own so the caller stays the single source of wording
 * @returns {{ fileName: string }}
 */
export function generateTranslationPdf(input) {
  if (!canExportPdfForLanguage(input.targetLanguage)) {
    throw new Error("pdf_font_unavailable_for_language");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 18;
  const marginTop = 20;
  const marginBottom = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const textWidth = pageWidth - marginX * 2;

  let y = marginTop;

  const ensureSpace = (needed) => {
    if (y + needed <= pageHeight - marginBottom) return;
    doc.addPage();
    y = marginTop;
  };

  const write = (text, { size = 10, style = "normal", gap = 4, colour = [15, 23, 42] } = {}) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...colour);
    const lines = doc.splitTextToSize(String(text ?? ""), textWidth);
    for (const line of lines) {
      ensureSpace(size * 0.45);
      doc.text(line, marginX, y);
      y += size * 0.45;
    }
    y += gap;
  };

  // ── Header ───────────────────────────────────────────────────────────────
  write(input.labels.documentTitle, { size: 16, style: "bold", gap: 3 });

  // The AI marking sits directly under the title, before the content, so it is
  // never possible to read the body without having seen it.
  write(input.labels.aiNotice, { size: 10, style: "bold", gap: 5, colour: [180, 83, 9] });

  const meta = [
    `${input.labels.originalFileLabel}: ${input.originalFileName}`,
    `${input.labels.modeLabel}: ${input.labels.modeName}`,
    `${input.labels.sourceLanguageLabel}: ${input.labels.sourceLanguageName}`,
    `${input.labels.targetLanguageLabel}: ${input.labels.targetLanguageName}`,
  ];
  if (input.generatedAt) {
    meta.push(`${input.labels.generatedAtLabel}: ${formatTimestamp(input.generatedAt)}`);
  }
  write(meta.join("\n"), { size: 9, colour: [71, 85, 105], gap: 4 });

  doc.setDrawColor(203, 213, 225);
  ensureSpace(6);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  // ── Content, in the order the server returned it ─────────────────────────
  for (const segment of input.segments ?? []) {
    const text = String(segment?.text ?? "");
    if (!text.trim()) continue;
    const heading = segment?.kind === "heading";
    write(text, { size: heading ? 12 : 10, style: heading ? "bold" : "normal", gap: heading ? 3 : 4 });
  }

  // ── Footer note ──────────────────────────────────────────────────────────
  ensureSpace(14);
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;
  write(input.labels.originalAuthoritative, { size: 8, colour: [100, 116, 139], gap: 0 });

  const fileName = buildTranslationFileName(
    {
      originalFileName: input.originalFileName,
      targetLanguage: input.targetLanguage,
      mode: input.mode,
    },
    { suffix: input.labels.fileNameSuffix },
  );

  doc.save(fileName);
  return { fileName };
}

/** @param {string} iso */
function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  // Fixed, unambiguous rendering: the PDF may be read in any locale, and a
  // locale-dependent date in an exported medical document invites misreading.
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
