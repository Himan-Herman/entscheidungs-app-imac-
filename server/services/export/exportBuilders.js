import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PDF_DISCLAIMER_DE, PDF_DISCLAIMER_EN } from "./exportConstants.js";

/**
 * @param {unknown} v
 */
function escCsv(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {{ title: string, subtitle?: string, columns: string[], rows: string[][] }} dataset
 */
export function buildExportCsv(dataset) {
  const lines = [];
  lines.push(escCsv(dataset.title));
  if (dataset.subtitle) lines.push(escCsv(dataset.subtitle));
  lines.push("");
  lines.push(dataset.columns.map(escCsv).join(","));
  for (const row of dataset.rows) {
    lines.push(row.map(escCsv).join(","));
  }
  return Buffer.from(lines.join("\n"), "utf-8");
}

/**
 * @param {{ title: string, subtitle?: string, locale?: string, source?: string, columns: string[], rows: string[][] }} dataset
 */
export async function buildExportPdf(dataset) {
  const locale = String(dataset.locale || "de").toLowerCase().startsWith("en") ? "en" : "de";
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const maxWidth = pageWidth - margin * 2;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawLine = (text, size, fn) => {
    const lines = wrapText(text, fn, size, maxWidth);
    for (const line of lines) {
      if (y < margin + size * 2) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: fn,
        color: rgb(0.12, 0.16, 0.22),
      });
      y -= size * 1.35;
    }
  };

  drawLine("MedScoutX — Export", 14, bold);
  drawLine(dataset.title, 12, bold);
  if (dataset.subtitle) drawLine(dataset.subtitle, 10, font);
  drawLine(
    `${locale === "en" ? "Created" : "Erstellt"}: ${new Date().toISOString()}`,
    9,
    font,
  );
  if (dataset.source) {
    drawLine(`${locale === "en" ? "Source" : "Quelle"}: ${dataset.source}`, 9, font);
  }
  y -= 8;
  drawLine(locale === "en" ? PDF_DISCLAIMER_EN : PDF_DISCLAIMER_DE, 9, font);
  y -= 12;

  const colCount = dataset.columns.length;
  const colWidth = maxWidth / Math.max(colCount, 1);

  drawLine(dataset.columns.join(" | "), 9, bold);
  y -= 4;
  for (const row of dataset.rows.slice(0, 120)) {
    const line = row.map((c, i) => padCol(String(c ?? "—"), colWidth)).join("");
    drawLine(line.slice(0, 200), 8, font);
  }

  return pdf.save();
}

/**
 * @param {string} text
 * @param {import('pdf-lib').PDFFont} font
 * @param {number} size
 * @param {number} maxWidth
 */
function wrapText(text, font, size, maxWidth) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function padCol(text, width) {
  const t = text.slice(0, Math.floor(width / 6));
  return t.padEnd(Math.floor(width / 6), " ");
}
