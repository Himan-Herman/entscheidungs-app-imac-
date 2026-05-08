/**
 * jsPDF default fonts cover Latin/Western European. Cyrillic, Arabic, Persian,
 * Sorani, etc. may not render correctly until a Unicode font or HTML→PDF path is added.
 */
import { jsPDF } from "jspdf";
import {
  PRE_VISIT_QUESTION_STEPS,
  pickLocalized,
} from "../constants/questionFlow.js";
import {
  STRUCTURED_DOCTOR_LABELS,
  STRUCTURED_SECTION_ORDER,
} from "../constants/structuredDoctorLabels.js";
import { isAiDoctorVersionFresh } from "../constants/preVisitSession.js";
import { getMessages } from "../../../i18n/translations/index.js";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";

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
const RTL_LANGS = new Set(["ar", "fa", "ku", "he", "ur"]);

function isRtlLanguage(lang) {
  const s = String(lang || "").toLowerCase();
  if (s.startsWith("ckb")) return true;
  return RTL_LANGS.has(s.slice(0, 2));
}

function hasRtlChars(text) {
  return /[\u0590-\u08FF]/.test(String(text || ""));
}

function sanitizePdfText(v) {
  const text = String(v ?? "");
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u202A|\u202B|\u202C|\u202D|\u202E/g, "")
    .trimEnd();
}

function legacyDefaultLabels(isEnglishUi) {
  const en = isEnglishUi;
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
    previousReportsHeading: en
      ? "Previous related reports (summary)"
      : "Frühere zugeordnete Berichte (Zusammenfassung)",
    newlyMentionedLabel: en ? "Newly mentioned" : "Neu erwähnt",
    stillMentionedLabel: en ? "Still mentioned" : "Weiterhin erwähnt",
    noLongerMentionedLabel: en
      ? "No longer mentioned"
      : "Nicht mehr erwähnt",
    unclearLabel: en ? "Unclear" : "Unklar",
    patientAddedNewInformationLabel: en
      ? "Patient added new information"
      : "Neue Patienteninformation / Ergänzung",
    patientDidNotMentionPreviouslyLabel: en
      ? "Previously reported information not mentioned in this session"
      : "Früher berichtete Angaben in dieser Session nicht erwähnt",
    longitudinalSectionHeading: en ? "Case / timeline (optional)" : "Fall / Verlauf (optional)",
    longitudinalSectionNote: en
      ? "Included only because you opted in below. Patient statements only; no diagnosis or medical evaluation."
      : "Wurde nur aufgrund Ihrer Auswahl eingefügt. Nur Patientenangaben; keine Diagnose oder medizinische Bewertung.",
    longitudinalCaseTitlePdfLabel: en ? "Case title" : "Falltitel",
    continuityRecurringSymptomsLabel: en
      ? "Repeatedly mentioned symptoms or concerns"
      : "Mehrfach genannte Symptome oder Beschwerden",
    continuityRecurringMedicationsLabel: en
      ? "Repeatedly mentioned medications"
      : "Mehrfach genannte Medikamente",
    continuityRecurringQuestionsLabel: en
      ? "Repeated patient questions"
      : "Mehrfach gestellte Patientenfragen",
    continuityRecurringConcernsLabel: en
      ? "Repeated concerns"
      : "Mehrfach genannte Sorgen",
    longitudinalSessionsOverviewHeading: en
      ? "Earlier preparations (overview)"
      : "Frühere Vorbereitungen (Überblick)",
    longitudinalRelatedReportsHeading: en
      ? "Session comparison (patient wording)"
      : "Vergleich der Vorbereitungen (Patientenformulierung)",
    longitudinalContinuitySubheading: en
      ? "Continuity summary (patient statements only)"
      : "Kontinuitätszusammenfassung (nur Patientenangaben)",
    followUpHeading: en ? "Documented follow-up questions" : "Dokumentierte Rückfragen",
    followUpSenderPractice: en ? "Practice" : "Praxis",
    followUpSenderPatient: en ? "Patient" : "Patient",
    followUpSenderSystem: en ? "System" : "System",
    patientLanguageLabel: en
      ? "Language of patient statements"
      : "Sprache der Patientenantworten",
    doctorLanguageLabel: en
      ? "Language of doctor version"
      : "Sprache der Arztversion",
    patientLabel: en ? "Patient" : "Patient",
    contactLabel: en ? "Contact" : "Kontakt",
    patientNameLabel: en ? "Name" : "Name",
    patientEmailLabel: en ? "Email" : "E-Mail",
    patientDateOfBirthLabel: en ? "Date of birth" : "Geburtsdatum",
    patientGenderOrSalutationLabel: en
      ? "Gender / salutation"
      : "Geschlecht / Anrede",
    patientPhoneLabel: en ? "Phone" : "Telefon",
    practiceLabel: en ? "Practice" : "Praxis",
    targetLabel: en ? "Target" : "Ziel",
    doctorLabel: en ? "Doctor" : "Ärztin/Arzt",
    specialtyLabel: en ? "Specialty" : "Fachrichtung",
    documentCreatedLabel: en ? "Created" : "Erstellt",
    empty: en ? "not specified" : "nicht angegeben",
    pdfFilename: en
      ? "medscoutx-pre-visit.pdf"
      : "medscoutx-arztgespraech.pdf",
    pdfBrandPracticeLine: en ? "Practice document" : "Praxisdokument",
  };
}

function defaultLabels(uiLanguage) {
  const M = getMessages(uiLanguage);
  const pdf = M.preVisit?.pdf;
  if (pdf && typeof pdf === "object" && pdf.pdfDocumentTitle) {
    return pdf;
  }
  const code = String(uiLanguage || "").toLowerCase();
  return legacyDefaultLabels(code.startsWith("de"));
}

function languageDisplay(code, uiLanguage) {
  return formatLanguageDisplayName(uiLanguage, code);
}

function formatCreated(uiLanguage) {
  const d = new Date();
  return d.toLocaleString(
    [String(uiLanguage || "en").toLowerCase(), "en", "de"],
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

function structuredFieldTitle(key, uiLanguage) {
  const M = getMessages(uiLanguage);
  const fromBundle = M.preVisit?.document?.structuredRowLabels?.[key];
  if (fromBundle) return fromBundle;
  const rec = STRUCTURED_DOCTOR_LABELS[key];
  if (!rec) return key;
  return String(uiLanguage || "").toLowerCase().startsWith("de")
    ? rec.de
    : rec.en;
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
  const timeline = session?.caseTimeline;
  const longitudinal = session?.longitudinalCase;
  const followUpHistory = session?.followUpHistory;
  const relatedReportsInLongitudinal =
    longitudinal?.pdfInclude?.relatedReportsSummary === true;
  const answers = session.answers;
  const patientLang = session.patientLanguage || "de";
  const doctorLang = session.doctorLanguage || patientLang;
  const defaultRtl = isRtlLanguage(patientLang);
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

  function textAlignFor(raw, fallbackRtl = defaultRtl) {
    const rtl = fallbackRtl || hasRtlChars(raw);
    return rtl ? "right" : "left";
  }

  function textXFor(align) {
    return align === "right" ? pageWidth - margin : margin;
  }

  function drawWrappedText(raw, width, fontSizePt, options = {}) {
    const text = sanitizePdfText(raw);
    const align = textAlignFor(text, options.forceRtl);
    const lh = lineHeightMm(fontSizePt);
    const lines = doc.splitTextToSize(text, width);
    for (const line of lines) {
      needSpace(lh + 0.6);
      doc.text(line, textXFor(align), y, { align });
      y += lh;
    }
  }

  function drawLabelAndBody(label, body, emptyPlaceholder, forceRtl = false) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(labelSize);
    doc.setTextColor(...COL.slate);
    drawWrappedText(label, contentW, labelSize, { forceRtl });

    gap(2);

    const empty = !String(body || "").trim();
    doc.setFont("helvetica", empty ? "italic" : "normal");
    doc.setFontSize(bodySize);
    doc.setTextColor(...(empty ? COL.slateMuted : COL.slate));
    drawWrappedText(empty ? emptyPlaceholder : body, contentW, bodySize, {
      forceRtl,
    });
    doc.setTextColor(...COL.slate);
    gap(6);
  }

  /** First page only: brand (text; logo TODO), title, date, rule */
  function drawDocumentHeader() {
    const practiceContext =
      session?.practiceContext && typeof session.practiceContext === "object"
        ? session.practiceContext
        : null;
    const hasPracticeContext = !!practiceContext?.practiceName;
    const logoDataCandidate = String(
      practiceContext?.logoDataUrl || practiceContext?.logoUrl || ""
    ).trim();
    const canRenderLogo = logoDataCandidate.startsWith("data:image/");

    if (canRenderLogo) {
      try {
        needSpace(18);
        doc.addImage(logoDataCandidate, "PNG", margin, y - 1.5, 18, 18);
      } catch {
        // Logo is optional; ignore decode issues.
      }
    }

    doc.setTextColor(...COL.teal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(brandSize);
    needSpace(lineHeightMm(brandSize) + 1);
    doc.text(
      hasPracticeContext ? L.pdfBrandPracticeLine : "MedScoutX",
      margin,
      y,
    );
    y += lineHeightMm(brandSize) + 2;

    if (hasPracticeContext) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      drawWrappedText(practiceContext.practiceName, contentW, 10.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.8);
      const infoBits = [
        practiceContext.targetName ? String(practiceContext.targetName) : "",
        practiceContext.doctorName ? String(practiceContext.doctorName) : "",
        practiceContext.specialty ? String(practiceContext.specialty) : "",
        practiceContext.phone ? String(practiceContext.phone) : "",
        practiceContext.website ? String(practiceContext.website) : "",
      ].filter(Boolean);
      if (infoBits.length > 0) {
        drawWrappedText(infoBits.join(" · "), contentW, 8.8);
      }
      gap(2);
    }

    doc.setTextColor(...COL.slate);
    doc.setFontSize(docTitleSize);
    drawWrappedText(L.pdfDocumentTitle, contentW, docTitleSize);
    y += 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(metaSize);
    doc.setTextColor(...COL.slateMuted);
    const genLine = `${L.documentCreatedLabel}: ${formatCreated(uiLanguage)}`;
    needSpace(lineHeightMm(metaSize));
    drawWrappedText(genLine, contentW, metaSize);
    y += 2;
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
      doc.text(lines[i], margin + pad, textY, {
        align: textAlignFor(lines[i], defaultRtl),
      });
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

    const patientMeta =
      session?.patientIdentity && typeof session.patientIdentity === "object"
        ? session.patientIdentity
        : {};
    const patientName = String(patientMeta.patientName || "").trim();
    const patientSalutation = String(
      patientMeta.patientGenderOrSalutation || ""
    ).trim();
    const patientDob = String(patientMeta.patientDateOfBirth || "").trim();
    const patientEmail = String(patientMeta.patientEmail || "").trim();
    const patientPhone = String(patientMeta.patientPhone || "").trim();
    const contactParts = [patientEmail, patientPhone].filter(Boolean);
    const practiceContext =
      session?.practiceContext && typeof session.practiceContext === "object"
        ? session.practiceContext
        : null;

    const metaLines = [];
    if (patientName || patientSalutation) {
      const patientValue = [patientName, patientSalutation]
        .filter(Boolean)
        .join(" — ");
      metaLines.push(`${L.patientLabel}: ${patientValue}`);
    }
    if (patientDob) {
      metaLines.push(`${L.patientDateOfBirthLabel}: ${patientDob}`);
    }
    if (contactParts.length > 0) {
      metaLines.push(`${L.contactLabel}: ${contactParts.join(" · ")}`);
    }
    if (practiceContext?.practiceName) {
      metaLines.push(`${L.practiceLabel}: ${practiceContext.practiceName}`);
    }
    if (practiceContext?.targetName) {
      metaLines.push(`${L.targetLabel}: ${practiceContext.targetName}`);
    }
    if (practiceContext?.doctorName) {
      metaLines.push(`${L.doctorLabel}: ${practiceContext.doctorName}`);
    }
    if (practiceContext?.specialty) {
      metaLines.push(`${L.specialtyLabel}: ${practiceContext.specialty}`);
    }
    metaLines.push(
      `${L.patientLanguageLabel}: ${languageDisplay(patientLang, uiLanguage)}`
    );
    metaLines.push(
      `${L.doctorLanguageLabel}: ${languageDisplay(doctorLang, uiLanguage)}`
    );
    metaLines.push(`${L.documentCreatedLabel}: ${formatCreated(uiLanguage)}`);

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

  function writeSectionHeading(text) {
    gap(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(sectionSize);
    doc.setTextColor(...COL.teal);
    drawWrappedText(text, contentW, sectionSize, { forceRtl: defaultRtl });
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
    drawLabelAndBody(labelText, bodyText, emptyPlaceholder, defaultRtl);
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

  if (
    timeline?.includeInPdf &&
    timeline?.summary &&
    !relatedReportsInLongitudinal
  ) {
    gap(4);
    writeSectionHeading(L.previousReportsHeading);
    const summary = timeline.summary;
    const lines = [
      [L.newlyMentionedLabel, summary.newlyMentioned],
      [L.stillMentionedLabel, summary.stillMentioned],
      [L.noLongerMentionedLabel, summary.noLongerMentioned],
      [L.unclearLabel, summary.unclear],
      [L.patientAddedNewInformationLabel, summary.patientAddedNewInformation],
      [
        L.patientDidNotMentionPreviouslyLabel,
        summary.patientDidNotMentionPreviouslyReportedInformation,
      ],
    ];
    for (const [label, list] of lines) {
      const items = Array.isArray(list)
        ? list.map((x) => String(x || "").trim()).filter(Boolean)
        : [];
      if (!items.length) continue;
      writeFieldBlock(label, items.map((x) => `- ${x}`).join("\n"), L.empty);
    }
  }

  const pdfInc = longitudinal?.pdfInclude;
  const wantsLongitudinalBlock =
    longitudinal &&
    pdfInc &&
    (pdfInc.caseTitle ||
      pdfInc.continuitySummary ||
      pdfInc.sessionsOverview ||
      pdfInc.relatedReportsSummary);
  if (wantsLongitudinalBlock) {
    gap(4);
    writeSectionHeading(L.longitudinalSectionHeading);
    gap(3);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(metaSize);
    doc.setTextColor(...COL.slateMuted);
    const hintLines = doc.splitTextToSize(L.longitudinalSectionNote, contentW);
    const hintLh = lineHeightMm(metaSize);
    for (const ln of hintLines) {
      needSpace(hintLh + 1);
      doc.text(ln, margin, y);
      y += hintLh;
    }
    doc.setTextColor(...COL.slate);
    doc.setFont("helvetica", "normal");
    gap(4);

    if (pdfInc.caseTitle && String(longitudinal.caseTitle || "").trim()) {
      writeFieldBlock(
        L.longitudinalCaseTitlePdfLabel,
        String(longitudinal.caseTitle).trim(),
        L.empty
      );
    }
    if (pdfInc.continuitySummary && longitudinal.continuitySummary) {
      gap(3);
      writeSectionHeading(L.longitudinalContinuitySubheading);
      const cs = longitudinal.continuitySummary;
      const continuityBlocks = [
        [L.continuityRecurringSymptomsLabel, cs.recurringSymptoms],
        [L.continuityRecurringMedicationsLabel, cs.recurringMedications],
        [L.continuityRecurringQuestionsLabel, cs.recurringPatientQuestions],
        [L.continuityRecurringConcernsLabel, cs.recurringConcerns],
      ];
      for (const [label, list] of continuityBlocks) {
        const items = Array.isArray(list)
          ? list.map((x) => String(x || "").trim()).filter(Boolean)
          : [];
        if (!items.length) continue;
        writeFieldBlock(
          label,
          items.map((x) => `- ${x}`).join("\n"),
          L.empty
        );
      }
    }
    if (
      pdfInc.sessionsOverview &&
      Array.isArray(longitudinal.sessionsOverviewLines) &&
      longitudinal.sessionsOverviewLines.length > 0
    ) {
      const bodyLines = longitudinal.sessionsOverviewLines
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .map((line) => `- ${line}`)
        .join("\n");
      writeFieldBlock(
        L.longitudinalSessionsOverviewHeading,
        bodyLines,
        L.empty
      );
    }
    if (
      pdfInc.relatedReportsSummary &&
      timeline?.summary &&
      typeof timeline.summary === "object"
    ) {
      writeSectionHeading(L.longitudinalRelatedReportsHeading);
      const summary = timeline.summary;
      const lines = [
        [L.newlyMentionedLabel, summary.newlyMentioned],
        [L.stillMentionedLabel, summary.stillMentioned],
        [L.noLongerMentionedLabel, summary.noLongerMentioned],
        [L.unclearLabel, summary.unclear],
        [L.patientAddedNewInformationLabel, summary.patientAddedNewInformation],
        [
          L.patientDidNotMentionPreviouslyLabel,
          summary.patientDidNotMentionPreviouslyReportedInformation,
        ],
      ];
      for (const [label, list] of lines) {
        const items = Array.isArray(list)
          ? list.map((x) => String(x || "").trim()).filter(Boolean)
          : [];
        if (!items.length) continue;
        writeFieldBlock(label, items.map((x) => `- ${x}`).join("\n"), L.empty);
      }
    }
  }

  if (
    followUpHistory?.includeInPdf &&
    Array.isArray(followUpHistory.messages) &&
    followUpHistory.messages.length > 0
  ) {
    writeSectionHeading(L.followUpHeading);
    const rows = followUpHistory.messages.slice(0, 200);
    for (const msg of rows) {
      const senderType = String(msg?.senderType || "system");
      let sender = L.followUpSenderSystem;
      if (senderType === "practice") sender = L.followUpSenderPractice;
      else if (senderType === "patient") sender = L.followUpSenderPatient;
      const tsRaw = msg?.createdAt;
      let ts = "";
      try {
        ts = tsRaw
          ? new Date(tsRaw).toLocaleString(
              [String(uiLanguage || "en").toLowerCase(), "en", "de"],
              { dateStyle: "medium", timeStyle: "short" },
            )
          : "";
      } catch {
        ts = "";
      }
      const label = ts ? `${sender} (${ts})` : sender;
      writeFieldBlock(label, String(msg?.body || "").trim(), L.empty);
    }
  }

  applyFooters(doc, L, uiLanguage, pageWidth, pageHeight, margin);

  return { doc, pdfFilename: L.pdfFilename };
}

/**
 * Client-side Pre-Visit PDF. No network calls.
 *
 * @param {object} params
 * @param {object} params.session — medscoutx_previsit_session shape
 * @param {string} params.uiLanguage — app UI locale for labels (ISO-style code)
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
