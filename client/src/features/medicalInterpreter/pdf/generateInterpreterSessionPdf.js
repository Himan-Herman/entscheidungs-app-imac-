/**
 * Medical Interpreter — local PDF export (Phase 1).
 * jsPDF only; session data never leaves the device. Light, print-friendly styling.
 */
import { jsPDF } from "jspdf";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_DRAFT,
  SESSION_STATUS_ENDED,
  TURN_STATUS_BLOCKED,
  TURN_STATUS_DRAFT,
  TURN_STATUS_ERROR,
  TURN_STATUS_TRANSLATED,
  SPEAKER_DOCTOR,
} from "../constants.js";
import {
  formatInterpreterDateOnly,
  formatInterpreterDateTime,
} from "../utils/formatInterpreterDate.js";
import { getLanguageNativeName } from "../utils/sessionDisplayTitle.js";
import { getSessionSummaryStats } from "../utils/sessionSummary.js";
import {
  groupTurnsIntoSections,
  sectionLabelForKind,
} from "../utils/sessionTurnSections.js";
import { getTurnReviewNotes } from "../utils/interpreterTranslationQuality.js";
import { isRtlLanguage } from "../../../i18n/localeConfig.js";
import {
  hasMixedScriptText,
  interpreterTextDirection,
} from "../utils/interpreterLocale.js";

const COL = {
  slate: [15, 23, 42],
  slateMuted: [71, 85, 105],
  teal: [14, 116, 144],
  rule: [226, 232, 240],
  noticeBg: [248, 250, 252],
  noticeBorder: [203, 213, 225],
  turnBg: [252, 252, 253],
};

const FOOTER_RESERVE_MM = 24;
const RTL_SCRIPTS = new Set(["ar", "fa", "ckb", "he", "ur"]);

function hasRtlChars(text) {
  return /[\u0590-\u08FF\u0600-\u06FF]/.test(String(text || ""));
}

function sessionUsesRtlScripts(session) {
  if (isRtlLanguage(session.patientLanguage) || isRtlLanguage(session.doctorLanguage)) {
    return true;
  }
  const codes = new Set(
    [session.patientLanguage, session.doctorLanguage].map((c) =>
      String(c || "").slice(0, 2),
    ),
  );
  for (const c of codes) {
    if (RTL_SCRIPTS.has(c)) return true;
  }
  for (const turn of session.turns || []) {
    if (
      hasRtlChars(turn.originalText) ||
      hasRtlChars(turn.translatedText) ||
      hasRtlChars(turn.simplifiedText)
    ) {
      return true;
    }
  }
  return false;
}

function sanitizePdfText(v) {
  return String(v ?? "")
    .replace(/<[^>]+>/g, " ")
    // eslint-disable-next-line no-control-regex -- strip control chars from user content
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u202A|\u202B|\u202C|\u202D|\u202E|\u2066|\u2069|\u200B|\u200F/g, "")
    .trimEnd();
}

function getPatientDisplayName(session) {
  const profile = session?.profileSnapshot;
  if (!profile) return null;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return name || null;
}

function lineHeightMm(fontSizePt) {
  return fontSizePt * 0.352778 * 1.35;
}

/**
 * @param {import('../types.js').InterpreterSession} session
 * @param {string} sessionTitle
 * @param {object} L — medicalInterpreter messages (pdf + review + …)
 * @returns {{ doc: import('jspdf').jsPDF; filename: string } | null}
 */
export function buildInterpreterSessionPdf(session, sessionTitle, L) {
  const turns = session?.turns ?? [];
  if (!turns.length) return null;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageWidth - 2 * margin;
  let y = margin;

  const bodySize = 10;
  const labelSize = 9.5;
  const titleSize = 15;
  const sectionSize = 11.5;
  const noticeSize = 8.5;

  const contentBottomY = () => pageHeight - margin - FOOTER_RESERVE_MM;

  function needSpace(mm) {
    if (y + mm > contentBottomY()) {
      doc.addPage();
      y = margin;
    }
  }

  function gap(mm) {
    y += mm;
  }

  function textAlignFor(raw, languageCode) {
    if (languageCode && interpreterTextDirection(languageCode) === "rtl") {
      return "right";
    }
    return hasRtlChars(raw) ? "right" : "left";
  }

  function textXFor(align) {
    return align === "right" ? pageWidth - margin : margin;
  }

  function drawWrappedText(raw, width, fontSizePt, options = {}) {
    const text = sanitizePdfText(raw);
    if (!text && !options.allowEmpty) return;
    const align = options.align || textAlignFor(text, options.languageCode);
    const lh = lineHeightMm(fontSizePt);
    const lines = doc.splitTextToSize(text || " ", width);
    for (const line of lines) {
      needSpace(lh + 0.5);
      doc.text(line, textXFor(align), y, { align });
      y += lh;
    }
  }

  function drawMetaRow(label, value) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(labelSize);
    doc.setTextColor(...COL.slateMuted);
    drawWrappedText(label, contentW, labelSize);
    gap(1);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL.slate);
    drawWrappedText(value || "—", contentW, labelSize);
    gap(2);
  }

  function drawNoticeBox() {
    const pad = 4;
    const startY = y;
    const paragraphs = [
      L.pdf.legalParagraph1,
      L.pdf.legalParagraph2,
      L.pdf.legalParagraph3,
      L.safety.verifyTranslation,
    ];
    if (sessionUsesRtlScripts(session)) {
      paragraphs.push(L.pdf.rtlFontNotice);
      paragraphs.push(L.pdf.rtlLimitationDetail);
    }
    if (turns.some((turn) => hasMixedScriptText(turn.originalText) || hasMixedScriptText(turn.translatedText))) {
      paragraphs.push(L.pdf.mixedScriptNotice);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(noticeSize);
    let estH = pad * 2;
    for (const p of paragraphs) {
      estH +=
        doc.splitTextToSize(sanitizePdfText(p), contentW - pad * 2).length *
          lineHeightMm(noticeSize) +
        2;
    }
    needSpace(estH + 2);

    doc.setFillColor(...COL.noticeBg);
    doc.setDrawColor(...COL.noticeBorder);
    doc.setLineWidth(0.3);
    doc.rect(margin, startY, contentW, estH, "FD");

    y = startY + pad;
    doc.setTextColor(...COL.slateMuted);
    for (const p of paragraphs) {
      drawWrappedText(p, contentW - pad * 2, noticeSize);
      gap(2);
    }
    doc.setTextColor(...COL.slate);
    y = startY + estH + 4;
  }

  // —— Header ——
  doc.setTextColor(...COL.teal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  needSpace(lineHeightMm(11));
  doc.text("MedScoutX", margin, y);
  y += lineHeightMm(11) + 2;

  doc.setTextColor(...COL.slate);
  doc.setFontSize(titleSize);
  drawWrappedText(L.pdf.documentTitle, contentW, titleSize);
  gap(2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COL.slateMuted);
  drawWrappedText(L.pdf.documentSubtitle, contentW, 10);
  doc.setTextColor(...COL.slate);
  gap(4);

  doc.setDrawColor(...COL.rule);
  doc.setLineWidth(0.35);
  needSpace(2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  drawNoticeBox();
  gap(4);

  // —— Session metadata ——
  doc.setFont("helvetica", "bold");
  doc.setFontSize(sectionSize);
  doc.setTextColor(...COL.slate);
  drawWrappedText(L.review.metadataHeading, contentW, sectionSize);
  gap(3);

  drawMetaRow(L.pdf.sessionTitleLabel, sessionTitle);
  drawMetaRow(L.review.created, formatInterpreterDateTime(session.createdAt));
  if (session.endedAt) {
    drawMetaRow(L.review.ended, formatInterpreterDateTime(session.endedAt));
  }
  drawMetaRow(
    L.languages.patientLabel,
    getLanguageNativeName(session.patientLanguage),
  );
  drawMetaRow(
    L.languages.doctorLabel,
    getLanguageNativeName(session.doctorLanguage),
  );
  if (session.doctorName?.trim()) {
    drawMetaRow(L.doctorInfo.doctorName, session.doctorName);
  }
  const patientName = getPatientDisplayName(session);
  if (patientName) {
    drawMetaRow(L.pdf.patientNameLabel, patientName);
  }
  if (session.practiceName?.trim()) {
    drawMetaRow(L.doctorInfo.practiceName, session.practiceName);
  }
  if (session.specialty?.trim()) {
    drawMetaRow(L.doctorInfo.specialty, session.specialty);
  }
  if (session.appointmentDateTime?.trim()) {
    drawMetaRow(
      L.doctorInfo.appointmentDate,
      formatInterpreterDateOnly(session.appointmentDateTime),
    );
  }
  const statusText =
    session.status === SESSION_STATUS_ENDED
      ? L.history.statusEnded
      : session.status === SESSION_STATUS_ACTIVE
        ? L.history.statusActive
        : L.history.statusDraft;
  drawMetaRow(L.review.status, statusText);

  const stats = getSessionSummaryStats(session);
  drawMetaRow(
    L.review.summaryTurnsLabel,
    L.review.summaryLine
      .replace("{{turns}}", String(stats.turnCount))
      .replace("{{translated}}", String(stats.translatedCount)),
  );

  gap(6);
  drawWrappedText(L.review.documentationNotice, contentW, noticeSize);
  gap(2);
  drawWrappedText(L.safety.strip, contentW, noticeSize);
  gap(6);

  const sections = groupTurnsIntoSections(turns, session.status);

  // —— Timeline ——
  doc.setFont("helvetica", "bold");
  doc.setFontSize(sectionSize);
  drawWrappedText(L.review.timelineHeading, contentW, sectionSize);
  gap(4);

  let index = 0;
  sections.forEach((section) => {
    needSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(labelSize);
    doc.setTextColor(...COL.teal);
    drawWrappedText(sectionLabelForKind(section.kind, L), contentW, labelSize);
    doc.setTextColor(...COL.slate);
    gap(3);

    section.turns.forEach((turn) => {
    const speakerLabel =
      turn.speaker === SPEAKER_DOCTOR
        ? L.room.turnClinician
        : L.room.turnPatient;
    const turnHeading = L.review.turnNumber.replace("{{n}}", String(index + 1));
    const langNote = `${turn.sourceLanguage} → ${turn.targetLanguage}`;

    const blockStart = y;
    needSpace(12);

    doc.setFillColor(...COL.turnBg);
    doc.setDrawColor(...COL.rule);
    const headerH = lineHeightMm(sectionSize) + lineHeightMm(bodySize) + 8;
    doc.rect(margin, blockStart, contentW, headerH, "F");
    y = blockStart + 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sectionSize);
    drawWrappedText(`${turnHeading} — ${speakerLabel}`, contentW - 4, sectionSize);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    doc.setTextColor(...COL.slateMuted);
    drawWrappedText(langNote, contentW - 4, bodySize);
    doc.setTextColor(...COL.slate);
    y = blockStart + headerH + 3;

    function drawSideBySideTurn(originalLabel, originalText, translatedLabel, translatedText, sourceLang, targetLang, timeLabel) {
      const gap = 4;
      const colW = (contentW - gap) / 2;
      const leftX = margin;
      const rightX = margin + colW + gap;
      const startY = y;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(noticeSize);
      doc.setTextColor(...COL.slateMuted);
      if (timeLabel) {
        needSpace(lineHeightMm(noticeSize));
        doc.text(timeLabel, margin, y);
        y += lineHeightMm(noticeSize) + 1;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(labelSize);
      doc.setTextColor(...COL.slateMuted);
      needSpace(lineHeightMm(labelSize));
      doc.text(originalLabel, leftX, y);
      doc.text(translatedLabel, rightX, y);
      y += lineHeightMm(labelSize) + 1;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodySize);
      doc.setTextColor(...COL.slate);
      const leftLines = doc.splitTextToSize(sanitizePdfText(originalText || "—"), colW);
      const rightLines = doc.splitTextToSize(sanitizePdfText(translatedText || "—"), colW);
      const lineCount = Math.max(leftLines.length, rightLines.length);
      const lh = lineHeightMm(bodySize);

      for (let i = 0; i < lineCount; i += 1) {
        needSpace(lh);
        const rowY = y;
        if (leftLines[i]) {
          doc.text(leftLines[i], leftX, rowY, {
            align: textAlignFor(leftLines[i], sourceLang),
          });
        }
        if (rightLines[i]) {
          doc.text(rightLines[i], rightX, rowY);
        }
        y += lh;
      }

      gap(4);
      doc.setDrawColor(...COL.rule);
      needSpace(1);
      doc.line(margin, y, pageWidth - margin, y);
      y += 2;
    }

    function drawTurnField(label, body, note, languageCode) {
      if (note && !String(label || "").trim() && !String(body || "").trim()) {
        gap(1);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(noticeSize);
        doc.setTextColor(...COL.slateMuted);
        drawWrappedText(note, contentW, noticeSize);
        doc.setTextColor(...COL.slate);
        gap(3);
        return;
      }
      gap(2);
      if (String(label || "").trim()) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(labelSize);
        drawWrappedText(label, contentW, labelSize);
        gap(1);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodySize);
      drawWrappedText(body || "—", contentW, bodySize, {
        align: textAlignFor(body, languageCode),
        languageCode,
      });
      if (note) {
        gap(1);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(noticeSize);
        doc.setTextColor(...COL.slateMuted);
        drawWrappedText(note, contentW, noticeSize);
        doc.setTextColor(...COL.slate);
      }
      gap(3);
    }

    drawWrappedText(langNote, contentW - 4, bodySize);
    doc.setTextColor(...COL.slate);
    y = blockStart + headerH + 3;

    const turnTime = turn.createdAt
      ? formatInterpreterDateTime(turn.createdAt)
      : "";

    if (
      turn.status === TURN_STATUS_TRANSLATED &&
      turn.translatedText?.trim()
    ) {
      drawSideBySideTurn(
        L.review.originalLabel,
        turn.originalText,
        L.review.translatedLabel,
        turn.translatedText,
        turn.sourceLanguage,
        turn.targetLanguage,
        turnTime,
      );
    } else {
      drawTurnField(L.review.originalLabel, turn.originalText, undefined, turn.sourceLanguage);
      if (turnTime) {
        drawTurnField("", turnTime);
      }
    }

    if (turn.status === TURN_STATUS_DRAFT && turn.confidence === "low") {
      drawTurnField("", "", L.transcript.lowConfidenceInput);
    }

    if (turn.status === TURN_STATUS_DRAFT) {
      drawTurnField("", "", L.review.turnDraft);
    } else if (turn.status === TURN_STATUS_BLOCKED) {
      drawTurnField("", "", L.review.turnBlocked);
    } else if (turn.status === TURN_STATUS_ERROR) {
      drawTurnField("", "", L.review.turnError);
    }

    if (turn.simplifiedText?.trim()) {
      drawTurnField(
        L.review.simplifiedLabel,
        turn.simplifiedText,
        L.simplify.note,
        turn.targetLanguage,
      );
    }

    gap(4);
    doc.setDrawColor(...COL.rule);
    doc.setLineWidth(0.2);
    needSpace(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    index += 1;
    });
    gap(2);
  });

  applyInterpreterPdfFooters(doc, L, pageWidth, pageHeight, margin);

  const datePart = new Date(session.createdAt || Date.now())
    .toISOString()
    .slice(0, 10);
  const filename = `${L.pdf.filenamePrefix}-${datePart}.pdf`;

  return { doc, filename };
}

function applyInterpreterPdfFooters(doc, L, pageWidth, pageHeight, margin) {
  const total = doc.internal.getNumberOfPages();
  const lh = lineHeightMm(7.5);

  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const noteY = pageHeight - margin - 2;
    const pageY = noteY - lh - 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COL.slateMuted);
    doc.text(L.pdf.generatedNote, margin, noteY);
    doc.text(
      `${L.pdf.footerPage} ${p} / ${total}`,
      pageWidth - margin,
      pageY,
      { align: "right" },
    );
    doc.setTextColor(...COL.slate);
  }
}

/**
 * @param {import('../types.js').InterpreterSession} session
 * @param {string} sessionTitle
 * @param {object} labels
 * @returns {{ ok: true } | { ok: false, code: 'no_turns' | 'export_failed' }}
 */
export function downloadInterpreterSessionPdf(session, sessionTitle, labels) {
  try {
    const built = buildInterpreterSessionPdf(session, sessionTitle, labels);
    if (!built) {
      return { ok: false, code: "no_turns" };
    }
    built.doc.save(built.filename);
    return { ok: true };
  } catch {
    return { ok: false, code: "export_failed" };
  }
}
