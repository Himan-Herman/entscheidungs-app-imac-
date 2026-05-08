import { jsPDF } from "jspdf";
import { PRE_VISIT_LANGUAGE_OPTIONS } from "../constants/languages.js";
import {
  PRE_VISIT_QUESTION_STEPS,
  pickLocalized,
} from "../constants/questionFlow.js";
import {
  STRUCTURED_DOCTOR_LABELS,
  STRUCTURED_SECTION_ORDER,
} from "../constants/structuredDoctorLabels.js";
import { isAiDoctorVersionFresh } from "../constants/preVisitSession.js";

/** Clinical palette — printer-friendly, calm */
const COL = {
  slate: [15, 23, 42],
  slateMuted: [71, 85, 105],
  teal: [14, 116, 144],
  rule: [226, 232, 240],
  boxBg: [248, 250, 252],
  boxBorder: [226, 232, 240],
};

/** Reserve bottom space so body never overlaps footer */
const FOOTER_RESERVE_MM = 26;

function defaultLabels(uiLanguage) {
  const en = uiLanguage === "en";
  return {
    legalNotice: en
      ? "This document is based solely on the patient’s statements. It does not contain a diagnosis, treatment recommendation or urgency assessment."
      : "Dieses Dokument basiert ausschließlich auf Angaben des Patienten. Es enthält keine Diagnose, keine Therapieempfehlung und keine Dringlichkeitseinschätzung.",
    pdfDocumentTitle: en
      ? "Pre-visit preparation document"
      : "Dokument zur Arztgespräch-Vorbereitung",
    footerGeneratedNote: en
      ? "Generated locally by MedScoutX Pre-Visit"
      : "Lokal erstellt mit MedScoutX Pre-Visit",
    footerPageLabel: en ? "Page" : "Seite",
    part1Heading: en
      ? "Structured doctor version"
      : "Strukturierte Arztversion",
    part2Heading: en
      ? "Original patient statements"
      : "Originalangaben des Patienten",
    patientLanguageLabel: en
      ? "Language of patient statements"
      : "Sprache der Patientenantworten",
    doctorLanguageLabel: en
      ? "Language of doctor version"
      : "Sprache der Arztversion",
    documentCreatedLabel: en ? "Created" : "Erstellt",
    empty: en ? "not specified" : "nicht angegeben",
    pdfFilename: en
      ? "medscoutx-pre-visit.pdf"
      : "medscoutx-arztgespraech.pdf",
  };
}

function languageDisplay(code, uiLanguage) {
  const row = PRE_VISIT_LANGUAGE_OPTIONS.find((r) => r.id === code);
  if (!row) return code || "—";
  return uiLanguage === "en" ? row.labelEn : row.labelDe;
}

function formatCreated(uiLanguage) {
  const d = new Date();
  return d.toLocaleString(uiLanguage === "en" ? "en-GB" : "de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function structuredFieldTitle(key, uiLanguage) {
  const rec = STRUCTURED_DOCTOR_LABELS[key];
  if (!rec) return key;
  return uiLanguage === "en" ? rec.en : rec.de;
}

function lineHeightMm(fontSizePt) {
  return fontSizePt * 0.352778 * 1.35;
}

/**
 * Draw footers on every page (page numbers + brand + local-generation note).
 */
function applyFooters(doc, L, _uiLanguage, pageWidth, pageHeight, margin) {
  const total = doc.internal.getNumberOfPages();
  const lh = lineHeightMm(7.5);

  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const noteY = pageHeight - margin - 3;
    const brandY = noteY - lh - 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COL.slateMuted);

    doc.text("MedScoutX", margin, brandY);

    const pageStr = `${L.footerPageLabel} ${p} / ${total}`;
    doc.text(pageStr, pageWidth - margin, brandY, { align: "right" });

    doc.setFontSize(7);
    doc.text(L.footerGeneratedNote, margin, noteY);

    doc.setTextColor(...COL.slate);
  }
}

/**
 * @returns {{ doc: import("jspdf").jsPDF; pdfFilename: string } | null}
 */
function buildPreVisitPdfDocument(session, uiLanguage, labels = {}) {
  if (!session?.answers) {
    return null;
  }

  const L = { ...defaultLabels(uiLanguage), ...labels };
  const answers = session.answers;
  const patientLang = session.patientLanguage || "de";
  const doctorLang = session.doctorLanguage || patientLang;
  const useAiStructured =
    isAiDoctorVersionFresh(session) && session.aiDoctorVersion;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageWidth - 2 * margin;
  let y = margin;

  const bodySize = 10;
  const metaSize = 9;
  const docTitleSize = 15;
  const brandSize = 11;
  const sectionSize = 12;
  const labelSize = 10;

  const contentBottomY = () => pageHeight - margin - FOOTER_RESERVE_MM;

  function needSpace(mm) {
    if (y + mm > contentBottomY()) {
      doc.addPage();
      y = margin;
    }
  }

  function drawRule() {
    needSpace(2);
    doc.setDrawColor(...COL.rule);
    doc.setLineWidth(0.35);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
  }

  /** First page only: brand (text; logo TODO), title, date, rule */
  function drawDocumentHeader() {
    // TODO: optional embedded logo — add jsPDF.addImage when asset pipeline for PDF is stable
    doc.setTextColor(...COL.teal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(brandSize);
    needSpace(lineHeightMm(brandSize) + 1);
    doc.text("MedScoutX", margin, y);
    y += lineHeightMm(brandSize) + 2;

    doc.setTextColor(...COL.slate);
    doc.setFontSize(docTitleSize);
    const titleLines = doc.splitTextToSize(L.pdfDocumentTitle, contentW);
    for (const line of titleLines) {
      needSpace(lineHeightMm(docTitleSize));
      doc.text(line, margin, y);
      y += lineHeightMm(docTitleSize);
    }
    y += 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(metaSize);
    doc.setTextColor(...COL.slateMuted);
    const genLine = `${L.documentCreatedLabel}: ${formatCreated(uiLanguage)}`;
    needSpace(lineHeightMm(metaSize));
    doc.text(genLine, margin, y);
    y += lineHeightMm(metaSize) + 2;
    doc.setTextColor(...COL.slate);

    drawRule();
    gap(4);
  }

  function gap(mm = 4) {
    y += mm;
    if (y > contentBottomY()) {
      doc.addPage();
      y = margin;
    }
  }

  /**
   * Disclaimer strip — same legal text, boxed for emphasis.
   */
  function drawDisclaimerStrip() {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(bodySize);
    const lh = lineHeightMm(bodySize);
    const pad = 4;
    const innerW = contentW - pad * 2;
    const lines = doc.splitTextToSize(L.legalNotice, innerW);
    const boxH = lines.length * lh + pad * 2;

    needSpace(boxH + 6);
    const boxTop = y;

    doc.setFillColor(...COL.boxBg);
    doc.setDrawColor(...COL.boxBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, boxTop, contentW, boxH, 1.5, 1.5, "FD");

    doc.setTextColor(...COL.slate);
    let textY = boxTop + pad + lh * 0.92;
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], margin + pad, textY);
      textY += lh;
    }

    y = boxTop + boxH + 6;
    doc.setFont("helvetica", "normal");
  }

  /**
   * Metadata after disclaimer — same three facts as before (patient lang, doctor lang, created).
   */
  function drawMetadata() {
    const pad = 4;
    const innerW = contentW - pad * 2;
    const lh = lineHeightMm(metaSize);

    const metaLines = [
      `${L.patientLanguageLabel}: ${languageDisplay(patientLang, uiLanguage)}`,
      `${L.doctorLanguageLabel}: ${languageDisplay(doctorLang, uiLanguage)}`,
      `${L.documentCreatedLabel}: ${formatCreated(uiLanguage)}`,
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(metaSize);
    const bodyLineArrays = metaLines.map((row) =>
      doc.splitTextToSize(row, innerW)
    );
    const bodyLineCount = bodyLineArrays.reduce((n, arr) => n + arr.length, 0);
    const boxH = bodyLineCount * lh + pad * 2;

    needSpace(boxH + 8);
    const boxTop = y;

    doc.setFillColor(...COL.boxBg);
    doc.setDrawColor(...COL.boxBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, boxTop, contentW, boxH, 1.5, 1.5, "FD");

    doc.setTextColor(...COL.slate);
    let textY = boxTop + pad + lh * 0.92;

    for (const arr of bodyLineArrays) {
      for (const ln of arr) {
        doc.text(ln, margin + pad, textY);
        textY += lh;
      }
    }

    y = boxTop + boxH + 8;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
  }

  function writeWrapped(text, sizePt, style = "normal") {
    doc.setFont("helvetica", style);
    doc.setFontSize(sizePt);
    doc.setTextColor(...COL.slate);
    const lh = lineHeightMm(sizePt);
    const lines = doc.splitTextToSize(String(text), contentW);
    for (let i = 0; i < lines.length; i++) {
      needSpace(lh + 0.8);
      doc.text(lines[i], margin, y);
      y += lh;
    }
  }

  function writeSectionHeading(text) {
    gap(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(sectionSize);
    doc.setTextColor(...COL.teal);
    const lh = lineHeightMm(sectionSize);
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      needSpace(lh + 1);
      doc.text(line, margin, y);
      y += lh;
    }
    doc.setTextColor(...COL.slate);
    doc.setDrawColor(...COL.teal);
    doc.setLineWidth(0.45);
    needSpace(3);
    doc.line(margin, y, margin + Math.min(contentW, 42), y);
    y += 5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "normal");
  }

  function writeFieldBlock(labelText, bodyText, emptyPlaceholder) {
    const empty = !String(bodyText).trim();
    const value = empty ? emptyPlaceholder : bodyText;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(labelSize);
    doc.setTextColor(...COL.slate);
    const lhLabel = lineHeightMm(labelSize);
    const labelLines = doc.splitTextToSize(String(labelText), contentW);
    for (const ln of labelLines) {
      needSpace(lhLabel + 0.5);
      doc.text(ln, margin, y);
      y += lhLabel;
    }

    gap(2);

    doc.setFont("helvetica", empty ? "italic" : "normal");
    doc.setFontSize(bodySize);
    doc.setTextColor(...(empty ? COL.slateMuted : COL.slate));
    const lhBody = lineHeightMm(bodySize);
    const bodyLines = doc.splitTextToSize(String(value), contentW);
    for (const ln of bodyLines) {
      needSpace(lhBody + 0.6);
      doc.text(ln, margin, y);
      y += lhBody;
    }
    doc.setTextColor(...COL.slate);
    gap(6);
    doc.setFont("helvetica", "normal");
  }

  // ——— Build body (order unchanged from product spec) ———
  drawDocumentHeader();
  drawDisclaimerStrip();
  drawMetadata();

  writeSectionHeading(L.part1Heading);

  for (const key of STRUCTURED_SECTION_ORDER) {
    let raw;
    if (useAiStructured) {
      raw = session.aiDoctorVersion[key] ?? "";
    } else {
      raw = answers[key] ?? "";
    }
    const title = structuredFieldTitle(key, uiLanguage);
    writeFieldBlock(`${title}`, raw, L.empty);
  }

  if (useAiStructured && session.aiSafetyNotice?.trim()) {
    gap(4);
    doc.setFillColor(...COL.boxBg);
    doc.setDrawColor(...COL.boxBorder);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(bodySize);
    const lh = lineHeightMm(bodySize);
    const pad = 4;
    const innerW = contentW - pad * 2;
    const notice = session.aiSafetyNotice.trim();
    const lines = doc.splitTextToSize(notice, innerW);
    const boxH = lines.length * lh + pad * 2;
    needSpace(boxH + 4);
    const boxTop = y;
    doc.roundedRect(margin, boxTop, contentW, boxH, 1.5, 1.5, "FD");
    doc.setTextColor(...COL.slateMuted);
    let textY = boxTop + pad + lh * 0.92;
    for (const ln of lines) {
      doc.text(ln, margin + pad, textY);
      textY += lh;
    }
    y = boxTop + boxH + 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL.slate);
  }

  gap(4);
  writeSectionHeading(L.part2Heading);

  for (const step of PRE_VISIT_QUESTION_STEPS) {
    const raw = answers[step.key] ?? "";
    const title = pickLocalized(step.title, patientLang);
    writeFieldBlock(`${title}`, raw, L.empty);
  }

  applyFooters(doc, L, uiLanguage, pageWidth, pageHeight, margin);

  return { doc, pdfFilename: L.pdfFilename };
}

/**
 * Client-side Pre-Visit PDF. No network calls.
 *
 * @param {object} params
 * @param {object} params.session — medscoutx_previsit_session shape
 * @param {'de'|'en'} params.uiLanguage — app UI language for labels
 * @param {object} [params.labels] — optional overrides (merged with defaults)
 * @returns {boolean} true if the PDF was built and download triggered
 */
export function generatePreVisitPdf({
  session,
  uiLanguage,
  labels: labelOverrides = {},
}) {
  try {
    const built = buildPreVisitPdfDocument(session, uiLanguage, labelOverrides);
    if (!built) return false;
    built.doc.save(built.pdfFilename);
    return true;
  } catch (err) {
    console.error("[generatePreVisitPdf]", err);
    return false;
  }
}

/**
 * Same layout as download PDF — blob for optional email upload (no automatic send).
 * @returns {Blob | null}
 */
export function buildPreVisitPdfBlob({
  session,
  uiLanguage,
  labels: labelOverrides = {},
}) {
  try {
    const built = buildPreVisitPdfDocument(session, uiLanguage, labelOverrides);
    if (!built) return null;
    return built.doc.output("blob");
  } catch (err) {
    console.error("[buildPreVisitPdfBlob]", err);
    return null;
  }
}

export function getPreVisitPdfFilename(uiLanguage, labels = {}) {
  const L = { ...defaultLabels(uiLanguage), ...labels };
  return L.pdfFilename;
}
