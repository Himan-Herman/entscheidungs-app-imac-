/**
 * Local-only PDF export for Meda Realtime conversation.
 * No network calls except loading the logo asset from the same origin.
 * No server storage. No patient data leaves the browser.
 *
 * jsPDF default fonts cover Latin / Western-European only.
 * Arabic, Persian, Cyrillic etc. may render as boxes — same limitation as
 * the rest of the project's PDF layer (see generatePreVisitPdf.js).
 */
import { jsPDF } from 'jspdf';
import logo6Url from '../../../assets/img/medscout-logo6.png';
import { REALTIME_LANGUAGE_MAP } from './realtimeLanguages.js';

// Clinical palette — matches generatePreVisitPdf.js
const COL = {
  slate:          [15,  23,  42],
  slateMuted:     [71,  85, 105],
  teal:           [14, 116, 144],
  rule:           [226, 232, 240],
  boxBg:          [248, 250, 252],
  boxBorder:      [226, 232, 240],
  patientAccent:  [14,  116, 144],  // teal — patient turns
  practiceAccent: [71,   85, 105],  // slate — practice turns
};

const MARGIN           = 18;
const FOOTER_RESERVE   = 20;
const LOGO_W           = 38;
const LOGO_H           = 12;

// ── Helpers ──────────────────────────────────────────────────────────────────

function lh(pt) {
  return pt * 0.352778 * 1.42;
}

function sanitize(v) {
  return String(v ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
}

function orNA(v) {
  const s = sanitize(v);
  return s || 'nicht angegeben';
}

function formatDate(isoOrDateOrNull) {
  const d = isoOrDateOrNull ? new Date(isoOrDateOrNull) : new Date();
  return d.toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' });
}

function formatTime(isoOrNull) {
  if (!isoOrNull) return '';
  const d = new Date(isoOrNull);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

async function loadLogoDataUrl(url) {
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader       = new FileReader();
      reader.onloadend   = () => resolve(reader.result);
      reader.onerror     = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── PDF builder ───────────────────────────────────────────────────────────────

/**
 * Build and trigger download of the conversation PDF.
 * All processing is local — no data is sent anywhere.
 *
 * @param {{
 *   turns:            import('./useRealtimeSession.js').Turn[],
 *   patientInfo:      { name?: string, dateOfBirth?: string, gender?: string, insuranceStatus?: string },
 *   practiceInfo:     { practiceName?: string, doctorName?: string, department?: string, location?: string },
 *   languages:        { patientLanguage: string, practiceLanguage: string },
 *   sessionStartedAt: string|null,
 * }} params
 */
export async function exportRealtimeConversationPdf({
  turns,
  patientInfo   = {},
  practiceInfo  = {},
  languages     = {},
  sessionStartedAt = null,
}) {
  const logoDataUrl = await loadLogoDataUrl(logo6Url);

  const doc      = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW    = doc.internal.pageSize.getWidth();
  const pageH    = doc.internal.pageSize.getHeight();
  const contentW = pageW - 2 * MARGIN;
  let y          = MARGIN;

  const patientLangLabel  = REALTIME_LANGUAGE_MAP[languages.patientLanguage]  ?? languages.patientLanguage  ?? '—';
  const practiceLangLabel = REALTIME_LANGUAGE_MAP[languages.practiceLanguage] ?? languages.practiceLanguage ?? '—';

  const contentBottom = () => pageH - MARGIN - FOOTER_RESERVE;

  function needSpace(mm) {
    if (y + mm > contentBottom()) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function gap(mm = 4) {
    y += mm;
    if (y > contentBottom()) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function drawRule(color = COL.rule, width = 0.3) {
    needSpace(2);
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 4;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
  }

  // Multi-line text block — respects page breaks
  function textBlock(text, width, fontSize, color = COL.slate, font = 'normal', indentX = 0) {
    const lines  = doc.splitTextToSize(sanitize(text), width);
    const lineH  = lh(fontSize);
    doc.setFont('helvetica', font);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    for (const ln of lines) {
      needSpace(lineH + 0.5);
      doc.text(ln, MARGIN + indentX, y);
      y += lineH;
    }
  }

  // Box: pre-calculate height, draw background then text (no spanning)
  function metaBox(rows) {
    const fontSize = 9;
    const lineH    = lh(fontSize);
    const pad      = 4;
    const innerW   = contentW - pad * 2;

    // Calculate total line count
    let lineCount = 0;
    for (const row of rows) {
      if (row === null) { lineCount += 0.5; continue; }
      const [label, value] = row;
      lineCount += doc.splitTextToSize(`${label}: ${value}`, innerW).length;
    }
    const boxH = lineCount * lineH + pad * 2;

    needSpace(boxH + 6);
    const boxTop = y;

    doc.setFillColor(...COL.boxBg);
    doc.setDrawColor(...COL.boxBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(MARGIN, boxTop, contentW, boxH, 1.5, 1.5, 'FD');

    let textY = boxTop + pad + lineH * 0.92;
    doc.setFontSize(fontSize);

    for (const row of rows) {
      if (row === null) { textY += lineH * 0.5; continue; }
      const [label, value] = row;
      const fullLine = `${label}: ${value}`;
      const lines    = doc.splitTextToSize(fullLine, innerW);
      for (const ln of lines) {
        const ci = ln.indexOf(':');
        if (ci > 0 && ci < 35) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COL.slate);
          const labelPart = ln.slice(0, ci + 1);
          doc.text(labelPart, MARGIN + pad, textY);
          const labelW = doc.getTextWidth(labelPart);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COL.slateMuted);
          doc.text(ln.slice(ci + 1), MARGIN + pad + labelW, textY);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COL.slateMuted);
          doc.text(ln, MARGIN + pad, textY);
        }
        textY += lineH;
      }
    }
    y = boxTop + boxH + 6;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
  }

  function sectionHeading(text) {
    gap(6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COL.teal);
    needSpace(lh(12) + 4);
    doc.text(text, MARGIN, y);
    y += lh(12) + 1;
    doc.setDrawColor(...COL.teal);
    doc.setLineWidth(0.45);
    doc.line(MARGIN, y, MARGIN + Math.min(contentW, 50), y);
    y += 5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COL.slate);
  }

  // ── Page 1: Header ──────────────────────────────────────────────────────────

  // Logo
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', MARGIN, y, LOGO_W, LOGO_H);
    } catch {
      // Logo rendering failed — continue without it
    }
  }

  // Title to the right of logo
  const titleX = MARGIN + LOGO_W + 6;
  const titleW = contentW - LOGO_W - 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COL.teal);
  doc.text('Meda Live Translation', titleX, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...COL.slate);
  doc.text('Gesprächsprotokoll', titleX, y + 4 + lh(13) + 0.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COL.slateMuted);
  const subtitleLines = doc.splitTextToSize('Medizinische Sprachvermittlung – Original und Übersetzung', titleW);
  let subY = y + 4 + lh(13) + lh(10.5) + 2;
  for (const ln of subtitleLines) { doc.text(ln, titleX, subY); subY += lh(8.5); }

  doc.setFontSize(8);
  doc.text(`Datum: ${formatDate(sessionStartedAt)}`, titleX, subY + 1.5);

  y = Math.max(y + LOGO_H + 5, subY + lh(8) + 5);

  // Disclaimer strip
  const disclaimer    = 'Dieses Dokument enthält eine sprachliche Gesprächsdokumentation. Es ersetzt keine ärztliche Diagnose, Therapieempfehlung oder medizinische Bewertung.';
  const dPad          = 3.5;
  const dInnerW       = contentW - dPad * 2;
  const dLines        = doc.splitTextToSize(disclaimer, dInnerW);
  const dLineH        = lh(8.5);
  const dBoxH         = dLines.length * dLineH + dPad * 2;
  needSpace(dBoxH + 5);
  const dTop = y;
  doc.setFillColor(...COL.boxBg);
  doc.setDrawColor(...COL.boxBorder);
  doc.setLineWidth(0.25);
  doc.roundedRect(MARGIN, dTop, contentW, dBoxH, 1, 1, 'FD');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...COL.slateMuted);
  let dY = dTop + dPad + dLineH * 0.92;
  for (const ln of dLines) { doc.text(ln, MARGIN + dPad, dY); dY += dLineH; }
  y = dTop + dBoxH + 6;

  drawRule();

  // ── Metadata box ────────────────────────────────────────────────────────────

  metaBox([
    ['Patient',              orNA(patientInfo.name)],
    ['Geburtsdatum',         orNA(patientInfo.dateOfBirth)],
    ['Geschlecht',           orNA(patientInfo.gender)],
    ['Versicherungsstatus',  orNA(patientInfo.insuranceStatus)],
    null,
    ['Praxis / Einrichtung', orNA(practiceInfo.practiceName)],
    ['Ärztin / Arzt',        orNA(practiceInfo.doctorName)],
    ['Fachbereich',          orNA(practiceInfo.department)],
    ['Ort',                  orNA(practiceInfo.location)],
    null,
    ['Patientensprache',     patientLangLabel],
    ['Praxissprache',        practiceLangLabel],
  ]);

  // ── Conversation turns ──────────────────────────────────────────────────────

  sectionHeading('Gesprächsverlauf');

  const doneTurns = turns.filter(t => t.isDone && (t.originalText || t.translatedText));

  if (doneTurns.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...COL.slateMuted);
    needSpace(lh(9.5) + 2);
    doc.text('Kein Gesprächsverlauf aufgezeichnet.', MARGIN, y);
    y += lh(9.5) + 4;
  }

  for (const turn of doneTurns) {
    const isPatient     = turn.speakerRole === 'patient';
    const accentColor   = isPatient ? COL.patientAccent : COL.practiceAccent;
    const roleLabel     = isPatient ? 'Patient' : 'Praxis / Arzt';
    const transLabel    = isPatient ? 'Übersetzung für Praxis' : 'Übersetzung für Patient';
    const srcLabel      = REALTIME_LANGUAGE_MAP[turn.sourceLanguage] ?? turn.sourceLanguage ?? '—';
    const tgtLabel      = REALTIME_LANGUAGE_MAP[turn.targetLanguage] ?? turn.targetLanguage ?? '—';
    const timeStr       = formatTime(turn.timestamp);
    const origText      = sanitize(turn.originalText   ?? '');
    const transText     = sanitize(turn.translatedText ?? '');

    // Ensure at least 40mm of space before starting a new turn
    needSpace(40);

    // Colored top rule
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.9);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 4;
    doc.setLineWidth(0.2);

    // Role + Zeit
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...accentColor);
    needSpace(lh(10) + 1);
    doc.text(roleLabel, MARGIN, y);
    if (timeStr) {
      const roleW = doc.getTextWidth(roleLabel);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COL.slateMuted);
      doc.text(`Zeit: ${timeStr}`, MARGIN + roleW + 4, y);
    }
    y += lh(10) + 2;

    // Originalsprache
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COL.slateMuted);
    needSpace(lh(8.5) + 0.5);
    doc.text(`Originalsprache: ${srcLabel}`, MARGIN, y);
    y += lh(8.5) + 1.5;

    // "Original:" label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COL.slate);
    needSpace(lh(9));
    doc.text('Original:', MARGIN, y);
    y += lh(9) + 1;

    // Original text (indented)
    textBlock(origText || '—', contentW - 6, 9.5, COL.slate, 'normal', 4);

    gap(3);

    // Translation label row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COL.teal);
    needSpace(lh(9));
    doc.text(transLabel, MARGIN, y);
    y += lh(9) + 0.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COL.slateMuted);
    needSpace(lh(8.5) + 0.5);
    doc.text(`Übersetzungssprache: ${tgtLabel}`, MARGIN, y);
    y += lh(8.5) + 1.5;

    // Translation text (indented)
    textBlock(transText || '—', contentW - 6, 9.5, COL.slate, 'normal', 4);

    gap(8);
  }

  // ── Footers on every page ──────────────────────────────────────────────────

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const fy1 = pageH - MARGIN - 8;
    const fy2 = pageH - MARGIN - 3;

    doc.setDrawColor(...COL.rule);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, fy1 - 2, pageW - MARGIN, fy1 - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COL.slateMuted);
    doc.text('MedScoutX · Lokaler Export', MARGIN, fy1);
    doc.text(`Seite ${p} / ${totalPages}`, pageW - MARGIN, fy1, { align: 'right' });

    doc.setFontSize(6.5);
    doc.text('Nur zur Gesprächsdokumentation der Sprachvermittlung.', MARGIN, fy2);
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`meda-gespraechsprotokoll-${dateStr}.pdf`);
}
