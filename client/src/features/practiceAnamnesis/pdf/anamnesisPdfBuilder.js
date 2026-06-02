/**
 * Client-side PDF builder for practice anamnesis submissions.
 * Uses the same jsPDF pattern as preVisit/pdf/generatePreVisitPdf.js.
 *
 * Does NOT perform AI analysis, diagnosis, therapy recommendation, or triage.
 * Only renders the patient's own submitted data plus practice metadata.
 */
import { jsPDF } from "jspdf";

// ── Clinical palette (matches preVisit) ──────────────────────────────────────
const COL = {
  slate:      [15,  23,  42],
  slateMuted: [71,  85,  105],
  teal:       [14,  116, 144],
  rule:       [226, 232, 240],
  boxBg:      [248, 250, 252],
  boxBorder:  [226, 232, 240],
  warnText:   [120, 53,  15],
  warnBg:     [255, 251, 235],
};

const FOOTER_RESERVE_MM = 24;

// ── Labels embedded in the PDF document (not the UI) ─────────────────────────
const LABELS = {
  de: {
    brand:                    "MedScoutX",
    docTitle:                 "Praxis-Anamnese",
    docSubtitle:              "Vorbereitung Arztgespräch",
    legalNotice:              "Dieses Dokument basiert ausschließlich auf den Angaben des Patienten. Es enthält keine Diagnose, keine Therapieempfehlung und keine Dringlichkeitseinschätzung.",
    patientDataHeading:       "Patientendaten",
    consentHeading:           "Einwilligung & Datenschutz",
    consentBody:              "Der Patient hat der Verarbeitung seiner Daten für die Vorbereitung des Arzttermins schriftlich zugestimmt. Die Originalangaben bleiben stets erhalten.",
    answersHeading:           "Angaben des Patienten",
    originalLabel:            "Original",
    translationLabel:         "Übersetzung",
    translationDisclaimer:    "Automatische Übersetzung — Originalangaben sind maßgeblich.",
    uncertainSuffix:          " (Übersetzung unsicher)",
    translationStatusLabel:   "Übersetzungsstatus",
    translationCompleted:     "Übersetzt",
    translationFailed:        "Fehlgeschlagen",
    translationPending:       "Ausstehend",
    translationSkipped:       "Nicht nötig (gleiche Sprache)",
    translationUnavailable:   "KI nicht konfiguriert",
    submissionId:             "Formular-ID",
    submittedAt:              "Eingereicht am",
    consentGrantedAt:         "Einwilligung erteilt",
    consentVersion:           "Einwilligungsversion",
    patientLanguage:          "Sprache des Patienten",
    targetLanguage:           "Praxissprache",
    templateTitle:            "Vorlage",
    fieldName:                "Name",
    fieldDob:                 "Geburtsdatum",
    fieldEmail:               "E-Mail",
    fieldPhone:               "Telefon",
    fieldInsurance:           "Versicherung",
    fieldInsuranceNumber:     "Versicherungsnummer",
    insuranceGkv:             "GKV (gesetzlich)",
    insurancePkv:             "PKV (privat)",
    insuranceSelfPay:         "Selbstzahler",
    insuranceOther:           "Sonstige",
    notSpecified:             "nicht angegeben",
    yesLabel:                 "Ja",
    noLabel:                  "Nein",
    page:                     "Seite",
    footerNote:               "Lokal erstellt mit MedScoutX Anamnese",
  },
  en: {
    brand:                    "MedScoutX",
    docTitle:                 "Practice Anamnesis",
    docSubtitle:              "Pre-Appointment Questionnaire",
    legalNotice:              "This document is based solely on the patient's own statements. It does not contain a diagnosis, treatment recommendation, or urgency assessment.",
    patientDataHeading:       "Patient data",
    consentHeading:           "Consent & Privacy",
    consentBody:              "The patient has given written consent to the processing of their data for pre-appointment preparation. Original answers are always retained.",
    answersHeading:           "Patient answers",
    originalLabel:            "Original",
    translationLabel:         "Translation",
    translationDisclaimer:    "Automatic translation — original statements are authoritative.",
    uncertainSuffix:          " (uncertain translation)",
    translationStatusLabel:   "Translation status",
    translationCompleted:     "Translated",
    translationFailed:        "Failed",
    translationPending:       "Pending",
    translationSkipped:       "Not needed (same language)",
    translationUnavailable:   "AI not configured",
    submissionId:             "Form ID",
    submittedAt:              "Submitted",
    consentGrantedAt:         "Consent granted",
    consentVersion:           "Consent version",
    patientLanguage:          "Patient language",
    targetLanguage:           "Practice language",
    templateTitle:            "Template",
    fieldName:                "Name",
    fieldDob:                 "Date of birth",
    fieldEmail:               "Email",
    fieldPhone:               "Phone",
    fieldInsurance:           "Insurance",
    fieldInsuranceNumber:     "Insurance number",
    insuranceGkv:             "Statutory (GKV)",
    insurancePkv:             "Private (PKV)",
    insuranceSelfPay:         "Self-pay",
    insuranceOther:           "Other",
    notSpecified:             "not specified",
    yesLabel:                 "Yes",
    noLabel:                  "No",
    page:                     "Page",
    footerNote:               "Generated locally by MedScoutX Anamnesis",
  },
  fr: {
    brand:                    "MedScoutX",
    docTitle:                 "Anamnèse médicale",
    docSubtitle:              "Préparation à la consultation",
    legalNotice:              "Ce document est basé uniquement sur les déclarations du patient. Il ne contient aucun diagnostic, recommandation thérapeutique ni évaluation d'urgence.",
    patientDataHeading:       "Données du patient",
    consentHeading:           "Consentement et confidentialité",
    consentBody:              "Le patient a donné son consentement écrit au traitement de ses données pour préparer le rendez-vous. Les réponses originales sont toujours conservées.",
    answersHeading:           "Réponses du patient",
    originalLabel:            "Original",
    translationLabel:         "Traduction",
    translationDisclaimer:    "Traduction automatique — les déclarations originales font foi.",
    uncertainSuffix:          " (traduction incertaine)",
    translationStatusLabel:   "Statut de traduction",
    translationCompleted:     "Traduit",
    translationFailed:        "Échec",
    translationPending:       "En attente",
    translationSkipped:       "Non nécessaire (même langue)",
    translationUnavailable:   "IA non configurée",
    submissionId:             "ID du formulaire",
    submittedAt:              "Soumis le",
    consentGrantedAt:         "Consentement accordé le",
    consentVersion:           "Version du consentement",
    patientLanguage:          "Langue du patient",
    targetLanguage:           "Langue du cabinet",
    templateTitle:            "Modèle",
    fieldName:                "Nom",
    fieldDob:                 "Date de naissance",
    fieldEmail:               "E-mail",
    fieldPhone:               "Téléphone",
    fieldInsurance:           "Assurance",
    fieldInsuranceNumber:     "Numéro d'assurance",
    insuranceGkv:             "Publique (GKV)",
    insurancePkv:             "Privée (PKV)",
    insuranceSelfPay:         "Particulier",
    insuranceOther:           "Autre",
    notSpecified:             "non renseigné",
    yesLabel:                 "Oui",
    noLabel:                  "Non",
    page:                     "Page",
    footerNote:               "Créé localement avec MedScoutX Anamnèse",
  },
  it: {
    brand:                    "MedScoutX",
    docTitle:                 "Anamnesi medica",
    docSubtitle:              "Preparazione alla visita",
    legalNotice:              "Questo documento è basato esclusivamente sulle dichiarazioni del paziente. Non contiene diagnosi, raccomandazioni terapeutiche o valutazioni di urgenza.",
    patientDataHeading:       "Dati del paziente",
    consentHeading:           "Consenso e privacy",
    consentBody:              "Il paziente ha acconsentito per iscritto al trattamento dei propri dati per la preparazione all'appuntamento. Le risposte originali vengono sempre conservate.",
    answersHeading:           "Risposte del paziente",
    originalLabel:            "Originale",
    translationLabel:         "Traduzione",
    translationDisclaimer:    "Traduzione automatica — le dichiarazioni originali sono vincolanti.",
    uncertainSuffix:          " (traduzione incerta)",
    translationStatusLabel:   "Stato traduzione",
    translationCompleted:     "Tradotto",
    translationFailed:        "Fallita",
    translationPending:       "In attesa",
    translationSkipped:       "Non necessaria (stessa lingua)",
    translationUnavailable:   "IA non configurata",
    submissionId:             "ID modulo",
    submittedAt:              "Inviato il",
    consentGrantedAt:         "Consenso accordato il",
    consentVersion:           "Versione del consenso",
    patientLanguage:          "Lingua del paziente",
    targetLanguage:           "Lingua dello studio",
    templateTitle:            "Modello",
    fieldName:                "Nome",
    fieldDob:                 "Data di nascita",
    fieldEmail:               "E-mail",
    fieldPhone:               "Telefono",
    fieldInsurance:           "Assicurazione",
    fieldInsuranceNumber:     "Numero assicurazione",
    insuranceGkv:             "Pubblica (GKV)",
    insurancePkv:             "Privata (PKV)",
    insuranceSelfPay:         "Privato pagante",
    insuranceOther:           "Altro",
    notSpecified:             "non specificato",
    yesLabel:                 "Sì",
    noLabel:                  "No",
    page:                     "Pagina",
    footerNote:               "Creato localmente con MedScoutX Anamnesi",
  },
  es: {
    brand:                    "MedScoutX",
    docTitle:                 "Anamnesis médica",
    docSubtitle:              "Preparación para la consulta",
    legalNotice:              "Este documento se basa únicamente en las declaraciones del paciente. No contiene diagnóstico, recomendación terapéutica ni evaluación de urgencia.",
    patientDataHeading:       "Datos del paciente",
    consentHeading:           "Consentimiento y privacidad",
    consentBody:              "El paciente ha dado su consentimiento por escrito para el tratamiento de sus datos con fines de preparación de la cita. Las respuestas originales siempre se conservan.",
    answersHeading:           "Respuestas del paciente",
    originalLabel:            "Original",
    translationLabel:         "Traducción",
    translationDisclaimer:    "Traducción automática — las declaraciones originales son vinculantes.",
    uncertainSuffix:          " (traducción incierta)",
    translationStatusLabel:   "Estado de traducción",
    translationCompleted:     "Traducido",
    translationFailed:        "Fallida",
    translationPending:       "Pendiente",
    translationSkipped:       "No necesaria (mismo idioma)",
    translationUnavailable:   "IA no configurada",
    submissionId:             "ID del formulario",
    submittedAt:              "Enviado el",
    consentGrantedAt:         "Consentimiento otorgado el",
    consentVersion:           "Versión del consentimiento",
    patientLanguage:          "Idioma del paciente",
    targetLanguage:           "Idioma del consultorio",
    templateTitle:            "Plantilla",
    fieldName:                "Nombre",
    fieldDob:                 "Fecha de nacimiento",
    fieldEmail:               "Correo electrónico",
    fieldPhone:               "Teléfono",
    fieldInsurance:           "Seguro",
    fieldInsuranceNumber:     "Número de seguro",
    insuranceGkv:             "Público (GKV)",
    insurancePkv:             "Privado (PKV)",
    insuranceSelfPay:         "Particular",
    insuranceOther:           "Otro",
    notSpecified:             "no especificado",
    yesLabel:                 "Sí",
    noLabel:                  "No",
    page:                     "Página",
    footerNote:               "Generado localmente con MedScoutX Anamnesis",
  },
};

function getL(lang) {
  const code = String(lang || "de").toLowerCase().slice(0, 2);
  return LABELS[code] || LABELS.en;
}

function sanitize(v) {
  return String(v ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[‪-‮]/g, "")
    .trimEnd();
}

function lineH(pt) {
  return pt * 0.352778 * 1.35;
}

function formatDateLocale(val, lang) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleString([String(lang).toLowerCase(), "de", "en"], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(val);
  }
}

function formatDateOnlyLocale(val, lang) {
  if (!val) return null;
  try {
    // dateOfBirth is typically "YYYY-MM-DD" — parse as local date to avoid TZ shift
    const parts = String(val).split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString([String(lang).toLowerCase(), "de", "en"], { dateStyle: "medium" });
    }
    const d = new Date(val);
    return d.toLocaleDateString([String(lang).toLowerCase(), "de", "en"], { dateStyle: "medium" });
  } catch {
    return String(val);
  }
}

function insuranceTypeLabel(type, L) {
  if (type === "gkv") return L.insuranceGkv;
  if (type === "pkv") return L.insurancePkv;
  if (type === "self_pay") return L.insuranceSelfPay;
  if (type === "other") return L.insuranceOther;
  return type ? String(type) : null;
}

function translationStatusLabel(status, L) {
  if (status === "completed")  return L.translationCompleted;
  if (status === "failed")     return L.translationFailed;
  if (status === "pending")    return L.translationPending;
  if (status === "skipped")    return L.translationSkipped;
  if (status === "unavailable") return L.translationUnavailable;
  return status ? String(status) : null;
}

function formatAnswerValue(type, value, L) {
  if (value === null || value === undefined || value === "") return L.notSpecified;
  if (type === "yes_no") return value ? L.yesLabel : L.noLabel;
  if (Array.isArray(value)) return value.join(", ");
  return sanitize(String(value));
}

// ── Core document builder ─────────────────────────────────────────────────────

/**
 * Builds a jsPDF document from normalized anamnesis data.
 *
 * @param {object} data
 * @param {string}  data.uiLanguage         - Language for PDF labels (de/en/fr/it/es)
 * @param {string}  data.submissionId
 * @param {string|Date} data.submittedAt
 * @param {string|Date|null} data.consentGrantedAt
 * @param {string|null} data.consentVersion
 * @param {string}  data.patientLanguage
 * @param {string|null} data.targetLanguage - Practice/doctor language
 * @param {string|null} data.translationStatus
 * @param {string}  data.templateTitle
 * @param {object}  data.practice           - { name, address, city, postalCode, phone, email }
 * @param {object}  data.patientInfo        - { firstName, lastName, dateOfBirth, email, phone, insuranceType, insuranceName, insuranceNumber }
 * @param {Array}   data.sections           - [{ label, items: [{ questionLabel, type, value, translatedText, translationUncertain }] }]
 */
function buildAnamnesisPdfDocument(data) {
  const L = getL(data.uiLanguage);
  const lang = data.uiLanguage;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin     = 18;
  const contentW   = pageWidth - 2 * margin;
  let y = margin;

  const SIZE_BRAND   = 11;
  const SIZE_TITLE   = 15;
  const SIZE_SECTION = 12;
  const SIZE_LABEL   = 10;
  const SIZE_BODY    = 10;
  const SIZE_META    = 9;
  const SIZE_SMALL   = 8.5;

  const bottomY = () => pageHeight - margin - FOOTER_RESERVE_MM;

  function needSpace(mm) {
    if (y + mm > bottomY()) {
      doc.addPage();
      y = margin;
    }
  }

  function gap(mm) {
    needSpace(mm);
    y += mm;
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

  function drawWrappedText(raw, width, sizePt, options = {}) {
    const text = sanitize(raw);
    const lh = lineH(sizePt);
    const lines = doc.splitTextToSize(text, width);
    for (const line of lines) {
      needSpace(lh + 0.5);
      doc.text(line, options.x ?? margin, y);
      y += lh;
    }
  }

  function drawMetaRow(labelStr, valueStr) {
    const lh = lineH(SIZE_META);
    needSpace(lh + 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(SIZE_META);
    doc.setTextColor(...COL.slateMuted);
    doc.text(sanitize(labelStr) + ": ", margin, y);
    const labelW = doc.getTextWidth(sanitize(labelStr) + ": ");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL.slate);
    const remaining = contentW - labelW;
    const valueLines = doc.splitTextToSize(sanitize(valueStr), remaining);
    doc.text(valueLines[0] || "", margin + labelW, y);
    y += lh;
    for (let i = 1; i < valueLines.length; i++) {
      needSpace(lh + 0.5);
      doc.text(valueLines[i], margin + labelW, y);
      y += lh;
    }
  }

  function drawQA(questionLabel, original, translatedText, uncertain, type) {
    // Question label
    const lhLabel = lineH(SIZE_LABEL);
    const lhBody  = lineH(SIZE_BODY);
    needSpace(lhLabel + lhBody + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(SIZE_LABEL);
    doc.setTextColor(...COL.slate);
    drawWrappedText(questionLabel, contentW, SIZE_LABEL);
    gap(1.5);

    const hasTranslation = translatedText && translatedText !== original;

    if (hasTranslation) {
      // Show translated answer prominently, original smaller below
      doc.setFont("helvetica", "normal");
      doc.setFontSize(SIZE_BODY);
      doc.setTextColor(...COL.slate);
      const trDisplay = uncertain
        ? translatedText + L.uncertainSuffix
        : translatedText;
      drawWrappedText(trDisplay, contentW, SIZE_BODY);

      // Original in muted italic
      gap(1.5);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(SIZE_SMALL);
      doc.setTextColor(...COL.slateMuted);
      drawWrappedText(`${L.originalLabel}: ${original}`, contentW, SIZE_SMALL);
    } else {
      // Only original
      doc.setFont("helvetica", "normal");
      doc.setFontSize(SIZE_BODY);
      const isEmpty = !original || original === L.notSpecified;
      doc.setTextColor(...(isEmpty ? COL.slateMuted : COL.slate));
      if (isEmpty) doc.setFont("helvetica", "italic");
      drawWrappedText(isEmpty ? L.notSpecified : original, contentW, SIZE_BODY);
    }
    gap(5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL.slate);
  }

  // ── 1. Document header ──────────────────────────────────────────────────────
  const practiceName = data.practice?.name;

  doc.setTextColor(...COL.teal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(SIZE_BRAND);
  needSpace(lineH(SIZE_BRAND) + 1);
  doc.text(practiceName ? L.brand : L.brand, margin, y);
  y += lineH(SIZE_BRAND) + 1;

  if (practiceName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COL.slate);
    drawWrappedText(practiceName, contentW, 11);

    const contactBits = [
      data.practice.address,
      data.practice.city && data.practice.postalCode
        ? `${data.practice.postalCode} ${data.practice.city}`
        : (data.practice.city || null),
      data.practice.phone,
      data.practice.email,
    ].filter(Boolean);
    if (contactBits.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(SIZE_SMALL);
      doc.setTextColor(...COL.slateMuted);
      drawWrappedText(contactBits.join(" · "), contentW, SIZE_SMALL);
    }
    gap(2);
  }

  doc.setTextColor(...COL.slate);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(SIZE_TITLE);
  needSpace(lineH(SIZE_TITLE) + 2);
  doc.text(L.docTitle, margin, y);
  y += lineH(SIZE_TITLE) + 1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(SIZE_META);
  doc.setTextColor(...COL.slateMuted);
  drawWrappedText(L.docSubtitle, contentW, SIZE_META);
  y += 1;

  // Template title
  if (data.templateTitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(SIZE_META);
    doc.setTextColor(...COL.slateMuted);
    drawWrappedText(`${L.templateTitle}: ${data.templateTitle}`, contentW, SIZE_META);
  }

  doc.setTextColor(...COL.slate);
  gap(2);
  drawRule();

  // ── 2. Legal disclaimer ──────────────────────────────────────────────────────
  needSpace(28);
  const warnBoxH = 20;
  doc.setFillColor(...COL.warnBg);
  doc.setDrawColor(253, 230, 138);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentW, warnBoxH, 2, 2, "FD");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(SIZE_SMALL);
  doc.setTextColor(...COL.warnText);
  const warnLines = doc.splitTextToSize(L.legalNotice, contentW - 8);
  let wy = y + 6;
  for (const wl of warnLines) {
    doc.text(wl, margin + 4, wy);
    wy += lineH(SIZE_SMALL);
  }
  y += warnBoxH + 5;
  doc.setTextColor(...COL.slate);

  // ── 3. Metadata ──────────────────────────────────────────────────────────────
  drawRule();

  const submittedStr = formatDateLocale(data.submittedAt, lang);
  if (submittedStr) drawMetaRow(L.submittedAt, submittedStr);

  if (data.patientLanguage) drawMetaRow(L.patientLanguage, data.patientLanguage.toUpperCase());
  if (data.targetLanguage)  drawMetaRow(L.targetLanguage,  data.targetLanguage.toUpperCase());

  if (data.translationStatus) {
    const tLabel = translationStatusLabel(data.translationStatus, L);
    if (tLabel) drawMetaRow(L.translationStatusLabel, tLabel);
  }

  if (data.submissionId) {
    drawMetaRow(L.submissionId, data.submissionId);
  }

  gap(2);

  // ── 4. Patient data box ──────────────────────────────────────────────────────
  drawRule();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(SIZE_SECTION);
  doc.setTextColor(...COL.teal);
  needSpace(lineH(SIZE_SECTION) + 2);
  doc.text(L.patientDataHeading, margin, y);
  y += lineH(SIZE_SECTION) + 3;
  doc.setTextColor(...COL.slate);

  const p = data.patientInfo || {};
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ") || null;
  drawMetaRow(L.fieldName, fullName || L.notSpecified);
  if (p.dateOfBirth) drawMetaRow(L.fieldDob, formatDateOnlyLocale(p.dateOfBirth, lang));
  if (p.email)       drawMetaRow(L.fieldEmail, p.email);
  if (p.phone)       drawMetaRow(L.fieldPhone, p.phone);

  const insType = insuranceTypeLabel(p.insuranceType, L);
  const insName = p.insuranceName;
  if (insType || insName) {
    const insDisplay = [insType, insName].filter(Boolean).join(" — ");
    drawMetaRow(L.fieldInsurance, insDisplay || L.notSpecified);
  }
  if (p.insuranceNumber) drawMetaRow(L.fieldInsuranceNumber, p.insuranceNumber);

  gap(2);

  // ── 5. Consent box ───────────────────────────────────────────────────────────
  drawRule();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(SIZE_SECTION);
  doc.setTextColor(...COL.teal);
  needSpace(lineH(SIZE_SECTION) + 2);
  doc.text(L.consentHeading, margin, y);
  y += lineH(SIZE_SECTION) + 2;
  doc.setTextColor(...COL.slate);

  const consentStr = formatDateLocale(data.consentGrantedAt, lang);
  if (consentStr) drawMetaRow(L.consentGrantedAt, consentStr);
  if (data.consentVersion) drawMetaRow(L.consentVersion, data.consentVersion);

  gap(2);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(SIZE_SMALL);
  doc.setTextColor(...COL.slateMuted);
  drawWrappedText(L.consentBody, contentW, SIZE_SMALL);
  gap(2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COL.slate);

  // ── 6. Translation disclaimer (if applicable) ────────────────────────────────
  const hasTranslation = data.translationStatus === "completed";
  if (hasTranslation) {
    drawRule();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(SIZE_SECTION);
    doc.setTextColor(...COL.teal);
    needSpace(lineH(SIZE_SECTION) + 2);
    doc.text(L.translationLabel, margin, y);
    y += lineH(SIZE_SECTION) + 2;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(SIZE_SMALL);
    doc.setTextColor(...COL.slateMuted);
    drawWrappedText(L.translationDisclaimer, contentW, SIZE_SMALL);
    gap(2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL.slate);
  }

  // ── 7. Answers by section ────────────────────────────────────────────────────
  drawRule();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(SIZE_SECTION + 1);
  doc.setTextColor(...COL.teal);
  needSpace(lineH(SIZE_SECTION + 1) + 3);
  doc.text(L.answersHeading, margin, y);
  y += lineH(SIZE_SECTION + 1) + 4;
  doc.setTextColor(...COL.slate);

  for (const section of (data.sections || [])) {
    // Section heading
    drawRule();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(SIZE_SECTION);
    doc.setTextColor(...COL.slate);
    needSpace(lineH(SIZE_SECTION) + 3);
    doc.text(sanitize(section.label), margin, y);
    y += lineH(SIZE_SECTION) + 3;

    for (const item of (section.items || [])) {
      const originalText = formatAnswerValue(item.type, item.value, L);
      const translatedText = hasTranslation && item.translatedText
        ? sanitize(item.translatedText)
        : null;
      drawQA(
        sanitize(item.questionLabel),
        originalText,
        translatedText,
        Boolean(item.translationUncertain),
        item.type,
      );
    }
  }

  // ── 8. Footers on every page ─────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  const submittedFooter = formatDateLocale(data.submittedAt, lang) || "";
  const idFooter = data.submissionId ? ` · ${L.submissionId}: ${data.submissionId}` : "";

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const noteY  = pageHeight - margin - 3;
    const brandY = noteY - lineH(7.5) - 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COL.slateMuted);

    doc.text(L.brand, margin, brandY);
    doc.text(`${L.page} ${p} / ${totalPages}`, pageWidth - margin, brandY, { align: "right" });

    doc.setFontSize(7);
    doc.text(L.footerNote, margin, noteY);
    doc.text(submittedFooter + idFooter, pageWidth - margin, noteY, { align: "right" });

    doc.setTextColor(...COL.slate);
  }

  return doc;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates and downloads the anamnesis PDF.
 * Returns true on success, false on error.
 *
 * @param {object} data  - Normalized anamnesis data (see buildAnamnesisPdfDocument)
 * @param {string} filename
 */
export function generateAnamnesisPdf(data, filename) {
  try {
    const doc = buildAnamnesisPdfDocument(data);
    const name = filename || `anamnesis-${(data.submissionId || "export").slice(0, 12)}.pdf`;
    doc.save(name);
    return true;
  } catch (err) {
    console.error("[anamnesisPdf] generation failed:", err?.message || err);
    return false;
  }
}

/**
 * Normalizes an answered submission (from the practice detail page) into PdfData.
 *
 * @param {object} submission  - Prisma submission object (must include practiceProfile)
 * @param {string} uiLanguage  - Practice UI language
 */
export function normalizePracticeSubmission(submission, uiLanguage) {
  const answers       = Array.isArray(submission.answersJson) ? submission.answersJson : [];
  const trAnswers     = Array.isArray(submission.translatedAnswersJson) ? submission.translatedAnswersJson : [];
  const trMap         = new Map(trAnswers.map((a) => [a.questionId, a]));
  const pInfo         = submission.patientInfoJson || {};
  const profile       = submission.practiceProfile || {};

  // Group answers into sections
  const sectionOrder = [];
  const sectionMap = new Map();
  for (const a of answers) {
    const key   = a.sectionId || "__top";
    const label = a.sectionLabel || key;
    if (!sectionMap.has(key)) {
      sectionMap.set(key, { label, items: [] });
      sectionOrder.push(key);
    }
    const tr = trMap.get(a.questionId);
    sectionMap.get(key).items.push({
      questionId:          a.questionId,
      questionLabel:       a.questionLabel || "",
      type:                a.type,
      value:               a.value,
      translatedText:      tr?.translatedText ?? null,
      translationUncertain: Boolean(tr?.translationUncertain),
    });
  }

  return {
    uiLanguage,
    submissionId:       submission.id,
    submittedAt:        submission.submittedAt,
    consentGrantedAt:   submission.consentGrantedAt,
    consentVersion:     submission.consentVersion,
    patientLanguage:    submission.patientLanguage,
    targetLanguage:     submission.doctorLanguage || submission.translationTargetLanguage,
    translationStatus:  submission.translationStatus,
    templateTitle:      submission.link?.label || null,
    practice: {
      name:        profile.displayNameForPatients || profile.practiceName || null,
      address:     profile.address || null,
      city:        profile.city || null,
      postalCode:  profile.postalCode || null,
      phone:       profile.phone || null,
      email:       profile.email || null,
    },
    patientInfo:        pInfo,
    sections:           sectionOrder.map((k) => sectionMap.get(k)),
  };
}

/**
 * Normalizes data from AnamnesisPublicPage (patient context, all in local state).
 *
 * @param {object} opts
 * @param {string}  opts.submissionId
 * @param {object}  opts.patientInfo   - { firstName, lastName, dateOfBirth, email, phone, insuranceType, insuranceName, insuranceNumber }
 * @param {Array}   opts.answersJson   - built by buildAnswersJson()
 * @param {object}  opts.practice      - linkData.practice
 * @param {string}  opts.templateTitle
 * @param {string}  opts.lang          - patient language (used as both uiLanguage and patientLanguage)
 */
export function normalizePatientSubmission({ submissionId, patientInfo, answersJson, practice, templateTitle, lang }) {
  const answers = Array.isArray(answersJson) ? answersJson : [];

  const sectionOrder = [];
  const sectionMap   = new Map();
  for (const a of answers) {
    const key   = a.sectionId || "__top";
    const label = a.sectionLabel || key;
    if (!sectionMap.has(key)) {
      sectionMap.set(key, { label, items: [] });
      sectionOrder.push(key);
    }
    sectionMap.get(key).items.push({
      questionId:           a.questionId,
      questionLabel:        a.questionLabel || "",
      type:                 a.type,
      value:                a.value,
      translatedText:       null,
      translationUncertain: false,
    });
  }

  return {
    uiLanguage:        lang,
    submissionId:      submissionId || "",
    submittedAt:       new Date(),
    consentGrantedAt:  new Date(),
    consentVersion:    null,
    patientLanguage:   lang,
    targetLanguage:    practice?.preferredDoctorLanguage || null,
    translationStatus: null,
    templateTitle:     templateTitle || null,
    practice: {
      name:       practice?.displayNameForPatients || practice?.practiceName || null,
      address:    practice?.address || null,
      city:       practice?.city || null,
      postalCode: practice?.postalCode || null,
      phone:      practice?.phone || null,
      email:      practice?.email || null,
    },
    patientInfo,
    sections: sectionOrder.map((k) => sectionMap.get(k)),
  };
}
