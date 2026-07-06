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
import logo6Url from '../../../assets/img/medscout-logo.png';
import { REALTIME_LANGUAGE_MAP } from './realtimeLanguages.js';

// Clinical palette — matches generatePreVisitPdf.js
const COL = {
  slate:          [15,  23,  42],
  slateMuted:     [71,  85, 105],
  teal:           [14, 116, 144],
  rule:           [226, 232, 240],
  boxBg:          [248, 250, 252],
  boxBorder:      [226, 232, 240],
  patientBg:      [240, 253, 255],
  patientBorder:  [186, 230, 253],
  practiceBg:     [248, 250, 252],
  practiceBorder: [203, 213, 225],
  patientAccent:  [14,  116, 144],
  practiceAccent: [71,   85, 105],
  cardTitle:      [14,  116, 144],
};

const MARGIN        = 18;
const FOOTER_RESERVE = 24;

// Logo bounding box — image is scaled to fit inside this box while preserving aspect ratio.
// scale = min(LOGO_BOX_W / natW, LOGO_BOX_H / natH)  →  no stretch, no squash.
const LOGO_BOX_W = 42;   // mm — maximum logo width
const LOGO_BOX_H = 18;   // mm — maximum logo height

// ── Helpers ──────────────────────────────────────────────────────────────────

function lh(pt) {
  return pt * 0.352778 * 1.45;
}

function sanitize(v) {
  return String(v ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
}

function orNA(v, fallback = 'Not provided') {
  const s = sanitize(v);
  return s || fallback;
}

function formatDate(isoOrDateOrNull, locale = 'de-DE') {
  const d = isoOrDateOrNull ? new Date(isoOrDateOrNull) : new Date();
  try {
    return d.toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return d.toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' });
  }
}

function formatTime(isoOrNull, locale = 'de-DE') {
  if (!isoOrNull) return '';
  const d = new Date(isoOrNull);
  try {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
}

function formatLanguageLabel(code, locale = 'en') {
  if (!code) return '—';
  if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
    try {
      const display = new Intl.DisplayNames([locale], { type: 'language' });
      const label = display.of(code);
      if (label) return `${String(label).charAt(0).toUpperCase()}${String(label).slice(1)}`;
    } catch {
      // fall back to static labels below
    }
  }
  return REALTIME_LANGUAGE_MAP[code] ?? code;
}

/**
 * Filesystem-safe slug. Lowercases, expands German umlauts, strips remaining
 * diacritics, then collapses everything non-alphanumeric to single hyphens.
 * Returns '' for empty/blank input so it can be dropped from the filename.
 */
function slugifyForFile(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip remaining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/**
 * Builds the PDF filename, e.g.
 *   medscoutx-meda-2026-06-10-1744-hautarzt-dr-heinrich.pdf
 * Falls back to medscoutx-meda-<date>-<time>.pdf when practice/doctor are missing.
 */
function buildPdfFileName(isoOrNull, practiceInfo, prefix = 'medscoutx-interpreter') {
  const d   = isoOrNull ? new Date(isoOrNull) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const partySlug = slugifyForFile(
    [practiceInfo?.department, practiceInfo?.doctorName].filter(Boolean).join(' '),
  );
  return [prefix, date, time, partySlug].filter(Boolean).join('-') + '.pdf';
}

function localizeGender(value, setupTx = {}, fallback) {
  const raw = sanitize(value);
  if (!raw) return fallback;
  switch (raw) {
    case 'weiblich':
      return setupTx.genderFemale || raw;
    case 'männlich':
      return setupTx.genderMale || raw;
    case 'divers':
      return setupTx.genderDiverse || raw;
    default:
      return raw;
  }
}

function localizeInsuranceStatus(value, setupTx = {}, fallback) {
  const raw = sanitize(value);
  if (!raw) return fallback;
  switch (raw) {
    case 'gesetzlich':
      return setupTx.insuranceStatutory || raw;
    case 'privat':
      return setupTx.insurancePrivate || raw;
    case 'Selbstzahler':
      return setupTx.insuranceSelfPay || raw;
    default:
      return raw;
  }
}

/**
 * Loads the logo via a browser Image element (no fetch / no CORS dependency).
 * Draws it to an off-screen canvas to obtain a dataURL and the true pixel dimensions.
 * Returns { dataUrl, natW, natH } or { dataUrl: null, natW: 0, natH: 0 } on failure.
 */
async function loadLogoData(url) {
  return new Promise((resolve) => {
    const img        = new Image();
    img.crossOrigin  = 'anonymous';
    img.onload = () => {
      try {
        const canvas  = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/png'), natW: img.naturalWidth, natH: img.naturalHeight });
      } catch {
        // Canvas tainted or unavailable — fall back to src URL directly
        resolve({ dataUrl: url, natW: img.naturalWidth, natH: img.naturalHeight });
      }
    };
    img.onerror = () => resolve({ dataUrl: null, natW: 0, natH: 0 });
    img.src = url;
  });
}

/**
 * Computes proportional logo dimensions that fit inside the bounding box.
 * Preserves aspect ratio exactly — no stretching, no squashing.
 * @param {number} natW   natural pixel width
 * @param {number} natH   natural pixel height
 * @param {number} maxW   max draw width in mm
 * @param {number} maxH   max draw height in mm
 * @returns {{ w: number, h: number }} draw dimensions in mm
 */
function fitLogoInBox(natW, natH, maxW, maxH) {
  if (!natW || !natH) return { w: maxH, h: maxH };  // safe fallback for unknown dims
  const scale = Math.min(maxW / natW, maxH / natH);
  return { w: natW * scale, h: natH * scale };
}

// ── PDF builder ───────────────────────────────────────────────────────────────

/**
 * Build the conversation PDF.
 * All processing is local — no data is sent anywhere.
 *
 * By default the PDF is downloaded via doc.save(). When `options.returnBlob` is
 * true, the PDF is NOT downloaded and the function returns the PDF Blob instead
 * (used by the secure PDF-QR flow). The existing single-argument call is
 * unchanged and keeps downloading exactly as before.
 *
 * @param {{
 *   turns:            import('./useRealtimeSession.js').Turn[],
 *   patientInfo:      { name?: string, dateOfBirth?: string, gender?: string, insuranceStatus?: string },
 *   practiceInfo:     { practiceName?: string, doctorName?: string, department?: string, location?: string },
 *   languages:        { patientLanguage: string, practiceLanguage: string },
 *   sessionStartedAt: string|null,
 *   messages?:        Record<string, any>,
 *   locale?:          string,
 * }} params
 * @param {{ returnBlob?: boolean }} [options]
 * @returns {Promise<Blob|void>} a Blob when options.returnBlob is true, otherwise void
 */
export async function exportRealtimeConversationPdf({
  turns,
  patientInfo   = {},
  practiceInfo  = {},
  languages     = {},
  sessionStartedAt = null,
  messages = {},
  locale = 'de-DE',
}, options = {}) {
  const { dataUrl: logoDataUrl, natW: logoNatW, natH: logoNatH } = await loadLogoData(logo6Url);
  const { w: logoW, h: logoH } = fitLogoInBox(logoNatW, logoNatH, LOGO_BOX_W, LOGO_BOX_H);

  const doc      = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW    = doc.internal.pageSize.getWidth();
  const pageH    = doc.internal.pageSize.getHeight();
  const contentW = pageW - 2 * MARGIN;
  let y          = MARGIN;

  const setupTx = messages?.realtimePage?.setup ?? messages?.setup ?? {};
  const conversationTx = messages?.realtimePage?.conversation ?? messages?.conversation ?? {};
  const historyTx = messages?.realtimePage?.history ?? messages?.history ?? {};
  const sessionBarTx = messages?.realtimePage?.sessionBar ?? messages?.sessionBar ?? {};
  const reviewTx = messages?.review ?? {};
  const pdfTx = messages?.pdf ?? {};
  const endBoxTx = messages?.realtimePage?.endBox ?? messages?.endBox ?? {};

  const pdfText = {
    documentTitle: pdfTx.documentTitle ?? 'Medical Interpreter / doctor visit translation',
    documentSubtitle: pdfTx.documentSubtitle ?? 'Conversation documentation',
    headerRecordTitle: reviewTx.heading ?? 'Conversation documentation',
    startedLabel: reviewTx.created ?? 'Started',
    disclaimer: [
      pdfTx.legalParagraph1,
      pdfTx.legalParagraph2,
      pdfTx.legalParagraph3,
    ].filter(Boolean).join(' '),
    generatedNote:
      pdfTx.generatedNote ??
      'Generated by MedScoutX · communication support only · automatic transcription/translation may contain errors · verify important information with your healthcare professional',
    footerNote:
      pdfTx.legalParagraph1 ??
      'Communication support only. This is not a diagnosis or treatment recommendation.',
    footerPage: pdfTx.footerPage ?? 'Page',
    filenamePrefix: pdfTx.filenamePrefix ?? 'medscoutx-interpreter',
    patientBoxTitle:
      conversationTx.rolePatient ?? sessionBarTx.patientLabel ?? pdfTx.patientNameLabel ?? 'Patient',
    practiceBoxTitle:
      setupTx.practiceNameLabel ?? sessionBarTx.practiceLabel ?? 'Practice / facility',
    sessionBoxTitle: reviewTx.metadataHeading ?? 'Session details',
    fullNameLabel: setupTx.fullNameLabel ?? pdfTx.patientNameLabel ?? 'Full name',
    dateOfBirthLabel: setupTx.dateOfBirthLabel ?? pdfTx.patientDateOfBirthLabel ?? 'Date of birth',
    genderLabel: setupTx.genderLabel ?? 'Gender',
    insuranceStatusLabel: setupTx.insuranceStatusLabel ?? 'Insurance status',
    insuranceNameLabel: setupTx.insuranceNameLabel ?? 'Health insurer / insurance',
    insuranceNumberLabel: setupTx.insuranceNumberLabel ?? 'Insurance number',
    emailLabel: setupTx.emailLabel ?? pdfTx.patientEmailLabel ?? 'Email',
    phoneLabel: setupTx.phoneLabel ?? pdfTx.patientPhoneLabel ?? 'Phone',
    streetLabel: setupTx.streetLabel ?? 'Street and house number',
    postalCodeLabel: setupTx.postalCodeLabel ?? 'Postal code',
    cityLabel: setupTx.cityLabel ?? 'City',
    countryLabel: setupTx.countryLabel ?? 'Country',
    relationLabel: setupTx.relationLabel ?? 'Relation to the person',
    practiceNameLabel: setupTx.practiceNameLabel ?? 'Practice / facility',
    doctorNameLabel: setupTx.doctorNameLabel ?? 'Doctor / clinician',
    specialtyLabel: setupTx.specialtyLabel ?? 'Specialty',
    practiceEmailLabel: setupTx.practiceEmailLabel ?? 'Practice email',
    practicePhoneLabel: setupTx.practicePhoneLabel ?? 'Practice phone',
    practiceStreetLabel: setupTx.practiceStreetLabel ?? 'Street and house number',
    practicePostalCodeLabel: setupTx.practicePostalCodeLabel ?? 'Postal code',
    practiceCityLabel: setupTx.practiceCityLabel ?? 'City',
    practiceCountryLabel: setupTx.countryLabel ?? 'Country',
    patientLanguageLabel: historyTx.patientLanguage ?? 'Patient language',
    practiceLanguageLabel: historyTx.practiceLanguage ?? 'Practice language',
    conversationHeading: conversationTx.aria ?? 'Conversation history',
    noTurns: historyTx.noStoredTurns ?? pdfTx.exportNoTurns ?? 'No conversation history stored.',
    rolePatient: conversationTx.rolePatient ?? sessionBarTx.patientLabel ?? 'Patient',
    rolePractice: conversationTx.rolePractice ?? sessionBarTx.practiceLabel ?? 'Practice / doctor',
    unclear: historyTx.unclear ?? 'Unclear',
    sourceLanguageLabel: conversationTx.sourceLanguageLabel ?? 'Original language',
    originalLabel: historyTx.originalLabel ?? reviewTx.originalLabel ?? 'Original',
    editedBadge: historyTx.editedBadge ?? 'Original text corrected manually',
    translationForPractice:
      conversationTx.translationForPractice ?? 'Translation for practice',
    translationForPatient:
      conversationTx.translationForPatient ?? 'Translation for patient',
    translationLabel: conversationTx.translationGeneric ?? reviewTx.translatedLabel ?? 'Translation',
    notProvided: endBoxTx.notProvided ?? 'Not provided',
  };

  const patientLangLabel = formatLanguageLabel(languages.patientLanguage, locale);
  const practiceLangLabel = formatLanguageLabel(languages.practiceLanguage, locale);

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

  function drawRule(color = COL.rule, width = 0.25) {
    needSpace(2);
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 5;
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

  /**
   * Labeled info card — renders a titled box with bold/muted label:value rows.
   * Title appears in small colored text at the top of the card.
   */
  function labeledInfoBox(title, rows) {
    const titleFontSize   = 7.5;
    const contentFontSize = 9;
    const titleLineH      = lh(titleFontSize);
    const rowLineH        = lh(contentFontSize);
    const titlePadV       = 2.5;
    const contentPadH     = 5;
    const contentPadV     = 3.5;
    const innerW          = contentW - contentPadH * 2;
    const titleAreaH      = titleLineH + titlePadV * 2;

    // Pre-calculate row height
    let lineCount = 0;
    for (const row of rows) {
      if (row === null) { lineCount += 0.6; continue; }
      const [label, value] = row;
      lineCount += doc.splitTextToSize(`${label}: ${value}`, innerW).length;
    }
    const contentAreaH = lineCount * rowLineH + contentPadV * 2;
    const boxH         = titleAreaH + contentAreaH;

    needSpace(boxH + 7);
    const boxTop = y;

    // Outer rounded rect — single pass, no overpainting corners
    doc.setFillColor(...COL.boxBg);
    doc.setDrawColor(...COL.boxBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(MARGIN, boxTop, contentW, boxH, 2, 2, 'FD');

    // Title separator line (below title area, above content rows)
    doc.setDrawColor(...COL.boxBorder);
    doc.setLineWidth(0.25);
    doc.line(MARGIN + 1, boxTop + titleAreaH, MARGIN + contentW - 1, boxTop + titleAreaH);

    // Title text — teal bold, no separate background (avoids corner artefacts)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(titleFontSize);
    doc.setTextColor(...COL.cardTitle);
    doc.text(title.toUpperCase(), MARGIN + contentPadH, boxTop + titlePadV + titleLineH * 0.88);

    // Rows
    let textY = boxTop + titleAreaH + contentPadV + rowLineH * 0.9;
    doc.setFontSize(contentFontSize);

    for (const row of rows) {
      if (row === null) { textY += rowLineH * 0.6; continue; }
      const [label, value] = row;
      const fullLine = `${label}: ${value}`;
      const lines    = doc.splitTextToSize(fullLine, innerW);
      for (const ln of lines) {
        const ci = ln.indexOf(':');
        if (ci > 0 && ci < 40) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COL.slate);
          const labelPart = ln.slice(0, ci + 1);
          doc.text(labelPart, MARGIN + contentPadH, textY);
          const labelW = doc.getTextWidth(labelPart);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COL.slateMuted);
          doc.text(ln.slice(ci + 1), MARGIN + contentPadH + labelW, textY);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COL.slateMuted);
          doc.text(ln, MARGIN + contentPadH, textY);
        }
        textY += rowLineH;
      }
    }

    y = boxTop + boxH + 7;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
  }

  function sectionHeading(text) {
    gap(7);
    needSpace(lh(12) + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COL.teal);
    doc.text(text, MARGIN, y);
    y += lh(12) + 1.5;
    doc.setDrawColor(...COL.teal);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, MARGIN + Math.min(contentW, 55), y);
    y += 6;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COL.slate);
  }

  // ── Page 1: Header ──────────────────────────────────────────────────────────

  // Thin teal accent bar at very top
  doc.setFillColor(...COL.teal);
  doc.rect(0, 0, pageW, 1.8, 'F');
  y = MARGIN + 2;

  // Logo — proportionally scaled, no distortion
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', MARGIN, y, logoW, logoH);
    } catch {
      // Logo rendering failed — continue without it
    }
  }

  // Title block to the right of logo
  const titleX = MARGIN + logoW + 7;
  const titleW = contentW - logoW - 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...COL.teal);
  doc.text(pdfText.documentTitle, titleX, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COL.slate);
  doc.text(pdfText.headerRecordTitle, titleX, y + 5 + lh(15) + 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COL.slateMuted);
  const subtitleLines = doc.splitTextToSize(pdfText.documentSubtitle, titleW);
  let subY = y + 5 + lh(15) + lh(11) + 2.5;
  for (const ln of subtitleLines) { doc.text(ln, titleX, subY); subY += lh(8.5); }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COL.slateMuted);
  doc.text(`${pdfText.startedLabel}: ${formatDate(sessionStartedAt, locale)}`, titleX, subY + 1.5);

  y = Math.max(y + logoH + 6, subY + lh(8) + 6);

  // Disclaimer strip
  const disclaimer = pdfText.disclaimer;
  const dPad       = 4;
  const dInnerW    = contentW - dPad * 2;
  const dLines     = doc.splitTextToSize(disclaimer, dInnerW);
  const dLineH     = lh(8.5);
  const dBoxH      = dLines.length * dLineH + dPad * 2;
  needSpace(dBoxH + 6);
  const dTop = y;
  doc.setFillColor(...COL.boxBg);
  doc.setDrawColor(...COL.boxBorder);
  doc.setLineWidth(0.25);
  doc.roundedRect(MARGIN, dTop, contentW, dBoxH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...COL.slateMuted);
  let dY = dTop + dPad + dLineH * 0.92;
  for (const ln of dLines) { doc.text(ln, MARGIN + dPad, dY); dY += dLineH; }
  y = dTop + dBoxH + 7;

  drawRule();

  // ── Patient info box ────────────────────────────────────────────────────────

  const patientRelRow = sanitize(patientInfo.relationship)
    ? [[pdfText.relationLabel, sanitize(patientInfo.relationship)]]
    : [];

  labeledInfoBox(pdfText.patientBoxTitle, [
    [pdfText.fullNameLabel,        orNA(patientInfo.name, pdfText.notProvided)],
    [pdfText.dateOfBirthLabel,     orNA(patientInfo.dateOfBirth, pdfText.notProvided)],
    [pdfText.genderLabel,          localizeGender(patientInfo.gender, setupTx, pdfText.notProvided)],
    [pdfText.insuranceStatusLabel, localizeInsuranceStatus(patientInfo.insuranceStatus, setupTx, pdfText.notProvided)],
    [pdfText.insuranceNameLabel,   orNA(patientInfo.insuranceName, pdfText.notProvided)],
    [pdfText.insuranceNumberLabel, orNA(patientInfo.insuranceNumber, pdfText.notProvided)],
    [pdfText.emailLabel,           orNA(patientInfo.email, pdfText.notProvided)],
    [pdfText.phoneLabel,           orNA(patientInfo.phone, pdfText.notProvided)],
    [pdfText.streetLabel,          orNA(patientInfo.street, pdfText.notProvided)],
    [pdfText.postalCodeLabel,      orNA(patientInfo.postalCode, pdfText.notProvided)],
    [pdfText.cityLabel,            orNA(patientInfo.city, pdfText.notProvided)],
    [pdfText.countryLabel,         orNA(patientInfo.country, pdfText.notProvided)],
    ...patientRelRow,
  ]);

  // ── Practice info box ────────────────────────────────────────────────────────

  labeledInfoBox(pdfText.practiceBoxTitle, [
    [pdfText.practiceNameLabel,   orNA(practiceInfo.practiceName, pdfText.notProvided)],
    [pdfText.doctorNameLabel,     orNA(practiceInfo.doctorName, pdfText.notProvided)],
    [pdfText.specialtyLabel,      orNA(practiceInfo.department, pdfText.notProvided)],
    [pdfText.practiceEmailLabel,  orNA(practiceInfo.email, pdfText.notProvided)],
    [pdfText.practicePhoneLabel,  orNA(practiceInfo.phone, pdfText.notProvided)],
    [pdfText.practiceStreetLabel, orNA(practiceInfo.street, pdfText.notProvided)],
    [pdfText.practicePostalCodeLabel, orNA(practiceInfo.postalCode, pdfText.notProvided)],
    [pdfText.practiceCityLabel,   orNA(practiceInfo.city, pdfText.notProvided)],
    [pdfText.practiceCountryLabel, orNA(practiceInfo.country, pdfText.notProvided)],
  ]);

  // ── Session / languages box ─────────────────────────────────────────────────

  labeledInfoBox(pdfText.sessionBoxTitle, [
    [pdfText.patientLanguageLabel, patientLangLabel],
    [pdfText.practiceLanguageLabel, practiceLangLabel],
    [pdfText.startedLabel, formatDate(sessionStartedAt, locale)],
  ]);

  // ── Conversation turns ──────────────────────────────────────────────────────

  sectionHeading(pdfText.conversationHeading);

  const doneTurns = turns.filter(t => t.isDone && (t.originalText || t.translatedText));

  if (doneTurns.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...COL.slateMuted);
    needSpace(lh(9.5) + 2);
    doc.text(pdfText.noTurns, MARGIN, y);
    y += lh(9.5) + 4;
  }

  for (const turn of doneTurns) {
    const isPatient   = turn.speakerRole === 'patient';
    const accentColor = isPatient ? COL.patientAccent : COL.practiceAccent;
    const turnBg      = isPatient ? COL.patientBg     : COL.practiceBg;
    const turnBorder  = isPatient ? COL.patientBorder  : COL.practiceBorder;
    const roleLabel   = isPatient ? pdfText.rolePatient : pdfText.rolePractice;
    const transLabel  = isPatient ? pdfText.translationForPractice : pdfText.translationForPatient;
    const srcLabel    = formatLanguageLabel(turn.sourceLanguage, locale);
    const tgtLabel    = formatLanguageLabel(turn.targetLanguage, locale);
    const timeStr     = formatTime(turn.timestamp, locale);
    const origText    = sanitize(turn.originalText   ?? '');
    const transText   = sanitize(turn.translatedText ?? '');

    // Ensure enough space before starting a new turn
    needSpace(48);

    // Left accent bar + colored top rule for turn separation
    doc.setFillColor(...accentColor);
    doc.rect(MARGIN, y, 3, 0.8, 'F');
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.7);
    doc.line(MARGIN + 4, y + 0.4, pageW - MARGIN, y + 0.4);
    y += 5;
    doc.setLineWidth(0.2);

    // Role header background band
    const roleBandH = lh(10) + 5;
    doc.setFillColor(...turnBg);
    doc.setDrawColor(...turnBorder);
    doc.setLineWidth(0.15);
    doc.rect(MARGIN, y - 1, contentW, roleBandH, 'FD');

    // Unclear banner
    if (turn.isUnclear) {
      const unclearLines = doc.splitTextToSize(pdfText.unclear, contentW - 4);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(146, 64, 14);
      for (const ln of unclearLines) {
        needSpace(lh(8));
        doc.text(ln, MARGIN + 3, y);
        y += lh(8);
      }
      y += 1.5;
    }

    // Role label + Zeit
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...accentColor);
    needSpace(lh(10.5) + 2);
    doc.text(roleLabel, MARGIN + 4, y);
    if (timeStr) {
      const roleW = doc.getTextWidth(roleLabel);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COL.slateMuted);
      doc.text(`  ·  ${timeStr}`, MARGIN + 4 + roleW, y);
    }
    y += lh(10.5) + 4;

    // Originalsprache
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COL.slateMuted);
    needSpace(lh(8.5) + 0.5);
    doc.text(`${pdfText.sourceLanguageLabel}: ${srcLabel}`, MARGIN + 4, y);
    y += lh(8.5) + 3;

    // "Original:" section label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COL.slate);
    needSpace(lh(9));
    doc.text(`${pdfText.originalLabel}:`, MARGIN + 4, y);
    y += lh(9) + 1.5;

    // Original text (indented)
    textBlock(origText || '—', contentW - 10, 9.5, COL.slate, 'normal', 6);

    // Edited badge
    if (turn.originalEdited) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(146, 64, 14);
      needSpace(lh(7.5) + 1);
      doc.text(`[${pdfText.editedBadge}]`, MARGIN + 6, y);
      y += lh(7.5) + 1.5;
    }

    gap(4);

    // Thin divider between original and translation
    doc.setDrawColor(...COL.rule);
    doc.setLineWidth(0.2);
    doc.line(MARGIN + 6, y, pageW - MARGIN - 6, y);
    y += 4;

    // Translation section label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COL.teal);
    needSpace(lh(9));
    doc.text(transLabel, MARGIN + 4, y);
    y += lh(9) + 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COL.slateMuted);
    needSpace(lh(8.5) + 0.5);
    doc.text(`${pdfText.translationLabel}: ${tgtLabel}`, MARGIN + 4, y);
    y += lh(8.5) + 1.5;

    // Translation text (indented)
    textBlock(transText || '—', contentW - 10, 9.5, COL.slate, 'normal', 6);

    gap(10);
  }

  // ── Footers on every page ──────────────────────────────────────────────────

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Thin accent bar at very top of every page (after page 1)
    if (p > 1) {
      doc.setFillColor(...COL.teal);
      doc.rect(0, 0, pageW, 1.8, 'F');
    }

    const fy1 = pageH - MARGIN - 9;
    const fy2 = pageH - MARGIN - 4;

    doc.setDrawColor(...COL.rule);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, fy1 - 3, pageW - MARGIN, fy1 - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COL.slateMuted);
    doc.text(`MedScoutX · ${pdfText.documentTitle}`, MARGIN, fy1);
    doc.text(`${pdfText.footerPage} ${p} / ${totalPages}`, pageW - MARGIN, fy1, { align: 'right' });

    doc.setFontSize(6.5);
    doc.text(pdfText.footerNote, MARGIN, fy2);
  }

  // ── Save / return ─────────────────────────────────────────────────────────────

  // Secure PDF-QR flow: return the Blob without triggering a local download.
  if (options.returnBlob === true) {
    return doc.output('blob');
  }

  // Default behaviour (unchanged): trigger the local browser download.
  doc.save(buildPdfFileName(sessionStartedAt, practiceInfo, pdfText.filenamePrefix));
}
