/**
 * Neutral reference PDF for secure link flow — no diagnosis, symptoms, or clinical narrative.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function buildNeutralSecureDocumentPdf({
  practiceName,
  sessionId,
  expiresAt,
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 780;
  const margin = 50;
  const line = (text, size, fn, yy) => {
    page.drawText(text, {
      x: margin,
      y: yy,
      size,
      font: fn,
      color: rgb(0.12, 0.16, 0.22),
    });
    return yy - size * 1.45;
  };

  y = line("MedScoutX — Vorbereitung / Preparation", 14, bold, y);
  y -= 6;
  y = line(
    "Keine Diagnose, keine medizinischen Details in diesem Dokument.",
    10,
    font,
    y,
  );
  y = line(
    "No diagnosis or clinical details in this document.",
    10,
    font,
    y,
  );
  y -= 10;
  y = line(`Praxis / Practice: ${practiceName || "—"}`, 11, bold, y);
  y = line(`Referenz-ID / Reference: ${sessionId}`, 11, font, y);
  y = line(
    `Gültig bis / Valid until: ${expiresAt.toISOString()}`,
    10,
    font,
    y,
  );
  y -= 8;
  y = line(
    "Inhalte nur über geschützte MedScoutX-Zugänge — wenn von Ihnen freigegeben.",
    10,
    font,
    y,
  );

  return pdf.save();
}
