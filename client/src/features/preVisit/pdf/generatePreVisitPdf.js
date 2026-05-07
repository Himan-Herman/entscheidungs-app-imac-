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

function defaultLabels(uiLanguage) {
  const en = uiLanguage === "en";
  return {
    legalNotice: en
      ? "This document is based solely on the patient’s statements. It does not contain a diagnosis, treatment recommendation or urgency assessment."
      : "Dieses Dokument basiert ausschließlich auf Angaben des Patienten. Es enthält keine Diagnose, keine Therapieempfehlung und keine Dringlichkeitseinschätzung.",
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

/**
 * Client-side Pre-Visit PDF. No network calls.
 *
 * @param {object} params
 * @param {object} params.session — medscoutx_previsit_session shape
 * @param {'de'|'en'} params.uiLanguage — app UI language for labels
 * @param {object} [params.labels] — optional overrides (merged with defaults)
 */
export function generatePreVisitPdf({ session, uiLanguage, labels: labelOverrides = {} }) {
  if (!session?.answers) {
    return;
  }

  const L = { ...defaultLabels(uiLanguage), ...labelOverrides };
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

  const bodySize = 10.5;
  const headingSize = 13;
  const subHeadingSize = 11;
  const lineHeight = (size) => size * 0.41;

  function needSpace(mm) {
    if (y + mm > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function writeWrapped(text, size, style = "normal") {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lh = lineHeight(size);
    const lines = doc.splitTextToSize(String(text), contentW);
    for (let i = 0; i < lines.length; i++) {
      needSpace(lh + 0.5);
      doc.text(lines[i], margin, y);
      y += lh;
    }
  }

  function gap(mm = 4) {
    y += mm;
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // — Legal note
  writeWrapped(L.legalNotice, bodySize, "italic");
  gap(6);

  // — Meta
  writeWrapped(
    `${L.patientLanguageLabel}: ${languageDisplay(patientLang, uiLanguage)}`,
    bodySize,
    "normal"
  );
  gap(2);
  writeWrapped(
    `${L.doctorLanguageLabel}: ${languageDisplay(doctorLang, uiLanguage)}`,
    bodySize,
    "normal"
  );
  gap(2);
  writeWrapped(
    `${L.documentCreatedLabel}: ${formatCreated(uiLanguage)}`,
    bodySize,
    "normal"
  );
  gap(8);

  // — Part 1
  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingSize);
  needSpace(lineHeight(headingSize) + 4);
  doc.text(L.part1Heading, margin, y);
  y += lineHeight(headingSize) + 4;
  doc.setFont("helvetica", "normal");

  for (const key of STRUCTURED_SECTION_ORDER) {
    let raw;
    if (useAiStructured) {
      raw = session.aiDoctorVersion[key] ?? "";
    } else {
      raw = answers[key] ?? "";
    }
    const empty = !String(raw).trim();
    const value = empty ? L.empty : raw;
    const title = structuredFieldTitle(key, uiLanguage);
    writeWrapped(`${title}:`, subHeadingSize, "bold");
    gap(1);
    writeWrapped(value, bodySize, "normal");
    gap(5);
  }

  if (useAiStructured && session.aiSafetyNotice?.trim()) {
    gap(3);
    writeWrapped(session.aiSafetyNotice.trim(), bodySize, "italic");
    gap(4);
  }

  gap(4);

  // — Part 2
  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingSize);
  needSpace(lineHeight(headingSize) + 4);
  doc.text(L.part2Heading, margin, y);
  y += lineHeight(headingSize) + 4;
  doc.setFont("helvetica", "normal");

  for (const step of PRE_VISIT_QUESTION_STEPS) {
    const raw = answers[step.key] ?? "";
    const empty = !String(raw).trim();
    const value = empty ? L.empty : raw;
    const title = pickLocalized(step.title, patientLang);
    writeWrapped(`${title}:`, subHeadingSize, "bold");
    gap(1);
    writeWrapped(value, bodySize, "normal");
    gap(5);
  }

  doc.save(L.pdfFilename);
}
