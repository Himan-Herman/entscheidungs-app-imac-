/**
 * Patient-owned medication summary → PDF (jsPDF).
 *
 * Device-local data only: renders the patient's own medication entries
 * (localStorage) into a clean, printer-friendly document. Contains only the
 * patient's own statements — no diagnosis, no dosage/therapy recommendation,
 * no interaction check. Nothing is stored server-side by this module.
 *
 * jsPDF default fonts cover Latin/Western European scripts.
 */
import { jsPDF } from "jspdf";

/** Clinical palette — printer-friendly, calm (shared with other MedScoutX PDFs). */
const COL = {
  slate: [15, 23, 42],
  slateMuted: [71, 85, 105],
  teal: [14, 116, 144],
  rule: [226, 232, 240],
  boxBg: [248, 250, 252],
  boxBorder: [226, 232, 240],
};

const FOOTER_RESERVE_MM = 24;

function sanitize(v) {
  return String(v ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/‪|‫|‬|‭|‮/g, "")
    .trimEnd();
}

function fmtDate(iso, lang) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(
      [String(lang || "de").toLowerCase(), "de", "en"],
      { day: "2-digit", month: "2-digit", year: "numeric" },
    );
  } catch {
    return String(iso);
  }
}

function fmtDateTime(date, lang) {
  try {
    return date.toLocaleString(
      [String(lang || "de").toLowerCase(), "de", "en"],
      { dateStyle: "medium", timeStyle: "short" },
    );
  } catch {
    return date.toISOString();
  }
}

export function getOwnMedicationPdfFilename(lang) {
  return String(lang || "").toLowerCase().startsWith("en")
    ? "medscoutx-my-medications.pdf"
    : "medscoutx-meine-medikamente.pdf";
}

/**
 * Compact plain-text summary of the medication list.
 * Used for the QR code payload and can seed an email body.
 */
export function buildOwnMedicationText({ entries, t, patientName, generatedAt, lang }) {
  const L = t || {};
  const lines = [];
  lines.push(L.documentTitle || "My current medications");
  if (patientName) lines.push(`${L.nameLabel || "Name"}: ${patientName}`);
  if (generatedAt) {
    lines.push(
      (L.generatedAt || "Summarized on {date}").replace(
        "{date}",
        fmtDateTime(generatedAt, lang),
      ),
    );
  }
  lines.push("");
  (entries || []).forEach((e, i) => {
    const parts = [`${i + 1}. ${e.name || L.planTitleFallback || "Medication"}`];
    if (e.dosage) parts.push(`${L.fieldDosage || "Dosage"}: ${e.dosage}`);
    if (e.schedule) parts.push(`${L.fieldSchedule || "Schedule"}: ${e.schedule}`);
    const period = [e.startDate, e.endDate].filter(Boolean).length
      ? `${fmtDate(e.startDate, lang) || "…"} – ${fmtDate(e.endDate, lang) || (L.ongoing || "ongoing")}`
      : "";
    if (period) parts.push(period);
    if (e.instructions) parts.push(`${L.fieldInstructions || "Notes"}: ${e.instructions}`);
    if (e.createdAt) {
      parts.push(
        `${L.addedLabel || "Added"}: ${fmtDateTime(new Date(e.createdAt), lang)}`,
      );
    }
    lines.push(parts.join(" · "));
  });
  lines.push("");
  lines.push(L.disclaimer || "Patient statements only. No diagnosis or treatment recommendation.");
  return lines.join("\n");
}

function applyFooter(doc, L, pageWidth, pageHeight, margin) {
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...COL.rule);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - margin - 8, pageWidth - margin, pageHeight - margin - 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COL.slateMuted);
    doc.text(
      L.footerBrand || "Locally created with MedScoutX",
      margin,
      pageHeight - margin - 3,
    );
    const pageLabel = `${L.footerPage || "Page"} ${p}/${total}`;
    doc.text(pageLabel, pageWidth - margin, pageHeight - margin - 3, { align: "right" });
  }
}

/**
 * Build a jsPDF document for the medication summary.
 */
export function buildOwnMedicationPdfDoc({ entries, t, patientName, generatedAt, lang }) {
  const L = t || {};
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin - FOOTER_RESERVE_MM) {
      doc.addPage();
      y = margin;
    }
  };

  // Header brand line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COL.teal);
  doc.text("MedScoutX", margin, y);
  y += 7;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...COL.slate);
  const titleLines = doc.splitTextToSize(
    sanitize(L.documentTitle || "My current medications"),
    contentWidth,
  );
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 2;

  // Meta line (name + generated at)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COL.slateMuted);
  const meta = [];
  if (patientName) meta.push(`${L.nameLabel || "Name"}: ${patientName}`);
  if (generatedAt) {
    meta.push(
      (L.generatedAt || "Summarized on {date}").replace(
        "{date}",
        fmtDateTime(generatedAt, lang),
      ),
    );
  }
  meta.push(
    (L.countLabel || "{count} medication(s)").replace(
      "{count}",
      String((entries || []).length),
    ),
  );
  meta.forEach((line) => {
    const wrapped = doc.splitTextToSize(sanitize(line), contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
  });
  y += 3;

  doc.setDrawColor(...COL.rule);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // Medication cards
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...COL.slateMuted);
    doc.text(sanitize(L.emptyText || "No medications entered."), margin, y);
    y += 8;
  }

  list.forEach((e, idx) => {
    const rows = [];
    if (e.dosage) rows.push([L.fieldDosage || "Dosage", e.dosage]);
    if (e.schedule) rows.push([L.fieldSchedule || "Schedule", e.schedule]);
    const period = [e.startDate, e.endDate].filter(Boolean).length
      ? `${fmtDate(e.startDate, lang) || "…"} – ${fmtDate(e.endDate, lang) || (L.ongoing || "ongoing")}`
      : "";
    if (period) rows.push([L.periodLabel || "Period", period]);
    if (e.instructions) rows.push([L.fieldInstructions || "Notes", e.instructions]);

    const addedText = e.createdAt
      ? `${L.addedLabel || "Added"} · ${fmtDateTime(new Date(e.createdAt), lang)}`
      : "";

    // Pre-measure the card height for pagination.
    doc.setFontSize(10);
    let bodyHeight = 0;
    const measured = rows.map(([label, value]) => {
      const wrapped = doc.splitTextToSize(sanitize(value), contentWidth - 40);
      bodyHeight += Math.max(wrapped.length * 5, 5) + 1.5;
      return { label, wrapped };
    });
    const cardHeight = 12 + (addedText ? 5 : 0) + bodyHeight + 6;
    ensureSpace(cardHeight);

    const cardTop = y;
    // Card body drawn first as a light box.
    doc.setFillColor(...COL.boxBg);
    doc.setDrawColor(...COL.boxBorder);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, cardTop, contentWidth, cardHeight, 2, 2, "FD");

    let cy = cardTop + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COL.slate);
    const nameLines = doc.splitTextToSize(
      sanitize(`${idx + 1}. ${e.name || L.planTitleFallback || "Medication"}`),
      contentWidth - 12,
    );
    doc.text(nameLines, margin + 6, cy);
    cy += nameLines.length * 6 + 1;

    if (addedText) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...COL.slateMuted);
      doc.text(sanitize(addedText), margin + 6, cy);
      cy += 5;
    }

    measured.forEach(({ label, wrapped }) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...COL.teal);
      doc.text(`${label}`, margin + 6, cy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...COL.slate);
      doc.text(wrapped, margin + 40, cy);
      cy += Math.max(wrapped.length * 5, 5) + 1.5;
    });

    y = cardTop + cardHeight + 5;
  });

  // Disclaimer box
  ensureSpace(20);
  y += 2;
  doc.setFillColor(...COL.boxBg);
  doc.setDrawColor(...COL.boxBorder);
  doc.setLineWidth(0.2);
  const disclaimer = sanitize(
    L.disclaimer ||
      "Patient statements only. No diagnosis or treatment recommendation.",
  );
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  const dLines = doc.splitTextToSize(disclaimer, contentWidth - 8);
  const dBoxH = dLines.length * 4.5 + 6;
  doc.roundedRect(margin, y, contentWidth, dBoxH, 2, 2, "FD");
  doc.setTextColor(...COL.slateMuted);
  doc.text(dLines, margin + 4, y + 5);
  y += dBoxH;

  applyFooter(doc, L, pageWidth, pageHeight, margin);
  return doc;
}

export function buildOwnMedicationPdfBlob(args) {
  try {
    const doc = buildOwnMedicationPdfDoc(args);
    return doc.output("blob");
  } catch {
    return null;
  }
}

export function downloadOwnMedicationPdf(args) {
  const doc = buildOwnMedicationPdfDoc(args);
  doc.save(getOwnMedicationPdfFilename(args?.lang));
}
