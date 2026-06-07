/**
 * Billing plausibility report service — G2.
 *
 * Generates a non-binding PDF plausibility report from a saved session.
 *
 * IMPORTANT: The generated report is a plausibility HINT document only.
 * It is NOT a legally binding billing opinion, NOT a reimbursement decision,
 * NOT medical advice, NOT a diagnosis, and NOT a therapy recommendation.
 * Manual review by qualified billing staff is always required.
 *
 * PDF uses pdf-lib with StandardFonts (WinAnsiEncoding / cp1252 — covers DE/FR/IT/ES chars).
 * Supported locales: de, en, fr, it, es. Unknown locales fall back to German.
 *
 * No AI is called. No patient identifiers are included. Purely offline/deterministic.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PrismaClient } from "@prisma/client";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { hasPracticePermission, PERMISSIONS } from "../../utils/practicePermissions.js";
import { GOAE_CATALOGUE_META } from "../../data/goaeCatalogue.js";

const prisma = new PrismaClient();

/** Supported report locales. */
const SUPPORTED_LOCALES = new Set(["de", "en", "fr", "it", "es"]);

/** Normalise a raw locale string to a supported key, defaulting to "de". */
function normaliseLocale(raw) {
  if (!raw) return "de";
  const s = String(raw).slice(0, 8).toLowerCase().trim();
  for (const loc of SUPPORTED_LOCALES) {
    if (s.startsWith(loc)) return loc;
  }
  return "de";
}

/** Sanitise a string for PDF output — strip control characters. */
function safe(v) {
  if (v == null) return "—";
  return String(v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim() || "—";
}

// ─── Localised strings used in the PDF ────────────────────────────────────────

const STRINGS = {
  de: {
    title: "MedScoutX — Plausibilitätsbericht",
    subtitle: "GOÄ/PKV — Automatisierter Plausibilitätshinweis",
    generatedAt: "Erstellt am",
    sessionDate: "Prüfungsdatum",
    sessionStatus: "Status",
    sourceType: "Eingabequelle",
    disclaimerVersion: "Hinweisversion",
    disclaimerHeading: "[!]RECHTLICHER HINWEIS",
    disclaimerText:
      "Dieser Bericht enthält ausschliesslich automatisierte Plausibilitätshinweise. " +
      "Er ist kein rechtsverbindliches Abrechnungsgutachten, keine Erstattungsentscheidung, " +
      "kein medizinischer Rat, keine Diagnose und keine Therapieempfehlung. " +
      "Er ersetzt keine menschliche Prüfung durch qualifiziertes Abrechnungspersonal.",
    catalogueHeading: "GOÄ-KATALOG-METADATEN",
    catalogueSource: "Quelle",
    catalogueUrl: "URL",
    catalogueAnlage: "Anlage",
    catalogueDate: "Stand",
    catalogueCompleteness: "Vollständigkeit",
    catalogueCompletenessValue: "Testteilmenge — kein vollständiger Katalog",
    itemsHeading: "GEPRÜFTE ZIFFERN",
    colZiffer: "Ziffer",
    colFactor: "Faktor",
    colCount: "Anz.",
    colCatalogue: "Katalog",
    colWarnings: "Hinweise",
    catalogueFound: "Gefunden",
    catalogueNotFound: "Nicht gefunden",
    noWarnings: "Keine",
    summaryHeading: "HINWEISZUSAMMENFASSUNG",
    summaryLine: (warnCount, zifferCount) =>
      `${warnCount} Hinweis(e) für ${zifferCount} Ziffer(n) gefunden.`,
    aiHeading: "KI-GESTÜTZTER HINWEIS — NICHT RECHTSVERBINDLICH",
    aiNonBinding:
      "Dieser KI-Hinweis ist nicht rechtsverbindlich, keine Diagnose und keine Erstattungsentscheidung.",
    aiGeneralNote: "Allgemeiner Hinweis",
    aiUncertainty: "Unsicherheitshinweis",
    aiRowHints: "Zifferhinweise",
    aiFallback: "KI-Hinweis nicht verfügbar — deterministische Prüfergebnisse oben sind gültig.",
    manualReviewHeading: "EMPFEHLUNG",
    manualReviewText:
      "Manuelle Prüfung durch qualifiziertes Abrechnungspersonal wird empfohlen.",
    statusPending: "Ausstehend",
    statusReviewed: "Geprüft",
    statusDismissed: "Abgelegt",
    statusDraft: "Entwurf",
    sourceManual: "Manuelle Eingabe",
    // G3b-2: catalogue verification status labels
    catalogueStatus: "Katalogstatus",
    catalogueStatusVerified: "Verifiziert (Punktzahl bestätigt)",
    catalogueStatusPointsUncertain: "Punkte nicht verifiziert — manuelle Prüfung",
    catalogueStatusNeedsReview: "Benötigt Prüfung — manuelle Verifikation",
    catalogueSourceRef: "Quellenangabe",
  },
  en: {
    title: "MedScoutX — Plausibility Report",
    subtitle: "GOÄ/PKV — Automated Plausibility Hint",
    generatedAt: "Generated at",
    sessionDate: "Review date",
    sessionStatus: "Status",
    sourceType: "Input source",
    disclaimerVersion: "Disclaimer version",
    disclaimerHeading: "[!]LEGAL NOTICE",
    disclaimerText:
      "This report contains automated plausibility hints only. " +
      "It is not a legally binding billing opinion, not a reimbursement decision, " +
      "not medical advice, not a diagnosis, and not a therapy recommendation. " +
      "It does not replace review by qualified billing staff.",
    catalogueHeading: "GOÄ CATALOGUE METADATA",
    catalogueSource: "Source",
    catalogueUrl: "URL",
    catalogueAnlage: "Annex",
    catalogueDate: "Access date",
    catalogueCompleteness: "Completeness",
    catalogueCompletenessValue: "Test subset only — not a complete catalogue",
    itemsHeading: "REVIEWED CODES",
    colZiffer: "Code",
    colFactor: "Factor",
    colCount: "Qty",
    colCatalogue: "Catalogue",
    colWarnings: "Hints",
    catalogueFound: "Found",
    catalogueNotFound: "Not found",
    noWarnings: "None",
    summaryHeading: "HINT SUMMARY",
    summaryLine: (warnCount, zifferCount) =>
      `${warnCount} hint(s) found across ${zifferCount} code(s).`,
    aiHeading: "AI-ASSISTED NOTE — NON-BINDING",
    aiNonBinding:
      "This AI note is not legally binding, not a diagnosis, and not a reimbursement decision.",
    aiGeneralNote: "General note",
    aiUncertainty: "Uncertainty note",
    aiRowHints: "Code-level hints",
    aiFallback: "AI hint unavailable — deterministic review results above remain valid.",
    manualReviewHeading: "RECOMMENDATION",
    manualReviewText: "Manual review by qualified billing staff is recommended.",
    statusPending: "Pending",
    statusReviewed: "Reviewed",
    statusDismissed: "Dismissed",
    statusDraft: "Draft",
    sourceManual: "Manual input",
    // G3b-2: catalogue verification status labels
    catalogueStatus: "Catalogue status",
    catalogueStatusVerified: "Verified (points confirmed)",
    catalogueStatusPointsUncertain: "Points not verified — manual check",
    catalogueStatusNeedsReview: "Needs review — manual verification",
    catalogueSourceRef: "Source reference",
  },
  fr: {
    title: "MedScoutX — Rapport de plausibilité",
    subtitle: "GOÄ/PKV — Indication automatisée de plausibilité",
    generatedAt: "Généré le",
    sessionDate: "Date du contrôle",
    sessionStatus: "Statut",
    sourceType: "Source de saisie",
    disclaimerVersion: "Version de la notice",
    disclaimerHeading: "[!]AVERTISSEMENT JURIDIQUE",
    disclaimerText:
      "Ce rapport contient uniquement des indications automatisées de plausibilité. " +
      "Il ne constitue ni un avis de facturation juridiquement contraignant, ni une décision " +
      "de remboursement, ni un conseil médical, ni un diagnostic, ni une recommandation thérapeutique. " +
      "Il ne remplace pas le contrôle par un personnel de facturation qualifié.",
    catalogueHeading: "MÉTADONNÉES DU CATALOGUE GOÄ",
    catalogueSource: "Source",
    catalogueUrl: "URL",
    catalogueAnlage: "Annexe",
    catalogueDate: "Date d'accès",
    catalogueCompleteness: "Exhaustivité",
    catalogueCompletenessValue: "Sous-ensemble de test uniquement — catalogue non complet",
    itemsHeading: "CODES VÉRIFIÉS",
    colZiffer: "Code",
    colFactor: "Facteur",
    colCount: "Qté",
    colCatalogue: "Catalogue",
    colWarnings: "Indications",
    catalogueFound: "Trouvé",
    catalogueNotFound: "Non trouvé",
    noWarnings: "Aucune",
    summaryHeading: "RÉSUMÉ DES INDICATIONS",
    summaryLine: (warnCount, zifferCount) =>
      `${warnCount} indication(s) pour ${zifferCount} code(s).`,
    aiHeading: "NOTE ASSISTÉE PAR IA — NON CONTRAIGNANTE",
    aiNonBinding:
      "Cette note IA n'est pas juridiquement contraignante, ni un diagnostic, ni une décision de remboursement.",
    aiGeneralNote: "Note générale",
    aiUncertainty: "Note d'incertitude",
    aiRowHints: "Indications par code",
    aiFallback: "Indication IA indisponible — les résultats déterministes ci-dessus restent valides.",
    manualReviewHeading: "RECOMMANDATION",
    manualReviewText:
      "Une vérification manuelle par un personnel de facturation qualifié est recommandée.",
    statusPending: "En attente",
    statusReviewed: "Vérifié",
    statusDismissed: "Classé",
    statusDraft: "Brouillon",
    sourceManual: "Saisie manuelle",
    // G3b-2: catalogue verification status labels
    catalogueStatus: "Statut du catalogue",
    catalogueStatusVerified: "Vérifié (points confirmés)",
    catalogueStatusPointsUncertain: "Points non vérifiés — vérification manuelle",
    catalogueStatusNeedsReview: "Vérification nécessaire — contrôle manuel",
    catalogueSourceRef: "Référence source",
  },
  it: {
    title: "MedScoutX — Rapporto di plausibilità",
    subtitle: "GOÄ/PKV — Indicazione automatizzata di plausibilità",
    generatedAt: "Generato il",
    sessionDate: "Data della verifica",
    sessionStatus: "Stato",
    sourceType: "Fonte di inserimento",
    disclaimerVersion: "Versione avviso",
    disclaimerHeading: "[!]AVVISO LEGALE",
    disclaimerText:
      "Questo rapporto contiene esclusivamente indicazioni automatizzate di plausibilità. " +
      "Non costituisce un parere di fatturazione giuridicamente vincolante, né una decisione " +
      "di rimborso, né un consiglio medico, né una diagnosi, né una raccomandazione terapeutica. " +
      "Non sostituisce il controllo da parte di personale di fatturazione qualificato.",
    catalogueHeading: "METADATI DEL CATALOGO GOÄ",
    catalogueSource: "Fonte",
    catalogueUrl: "URL",
    catalogueAnlage: "Allegato",
    catalogueDate: "Data di accesso",
    catalogueCompleteness: "Completezza",
    catalogueCompletenessValue: "Solo sottoinsieme di test — catalogo non completo",
    itemsHeading: "CODICI VERIFICATI",
    colZiffer: "Codice",
    colFactor: "Fattore",
    colCount: "Qtà",
    colCatalogue: "Catalogo",
    colWarnings: "Indicazioni",
    catalogueFound: "Trovato",
    catalogueNotFound: "Non trovato",
    noWarnings: "Nessuna",
    summaryHeading: "RIEPILOGO INDICAZIONI",
    summaryLine: (warnCount, zifferCount) =>
      `${warnCount} indicazione/i per ${zifferCount} codice/i.`,
    aiHeading: "NOTA ASSISTITA DA IA — NON VINCOLANTE",
    aiNonBinding:
      "Questa nota IA non è giuridicamente vincolante, né una diagnosi, né una decisione di rimborso.",
    aiGeneralNote: "Nota generale",
    aiUncertainty: "Nota di incertezza",
    aiRowHints: "Indicazioni per codice",
    aiFallback:
      "Indicazione IA non disponibile — i risultati deterministici sopra restano validi.",
    manualReviewHeading: "RACCOMANDAZIONE",
    manualReviewText:
      "Si raccomanda la revisione manuale da parte di personale di fatturazione qualificato.",
    statusPending: "In attesa",
    statusReviewed: "Verificato",
    statusDismissed: "Archiviato",
    statusDraft: "Bozza",
    sourceManual: "Inserimento manuale",
    // G3b-2: catalogue verification status labels
    catalogueStatus: "Stato del catalogo",
    catalogueStatusVerified: "Verificato (punti confermati)",
    catalogueStatusPointsUncertain: "Punti non verificati — verifica manuale",
    catalogueStatusNeedsReview: "Revisione necessaria — verifica manuale",
    catalogueSourceRef: "Riferimento fonte",
  },
  es: {
    title: "MedScoutX — Informe de plausibilidad",
    subtitle: "GOÄ/PKV — Indicación automatizada de plausibilidad",
    generatedAt: "Generado el",
    sessionDate: "Fecha de revisión",
    sessionStatus: "Estado",
    sourceType: "Fuente de entrada",
    disclaimerVersion: "Versión del aviso",
    disclaimerHeading: "[!]AVISO LEGAL",
    disclaimerText:
      "Este informe contiene únicamente indicaciones automatizadas de plausibilidad. " +
      "No constituye un dictamen de facturación jurídicamente vinculante, ni una decisión " +
      "de reembolso, ni un consejo médico, ni un diagnóstico, ni una recomendación terapéutica. " +
      "No sustituye la revisión por parte de personal de facturación cualificado.",
    catalogueHeading: "METADATOS DEL CATÁLOGO GOÄ",
    catalogueSource: "Fuente",
    catalogueUrl: "URL",
    catalogueAnlage: "Anexo",
    catalogueDate: "Fecha de acceso",
    catalogueCompleteness: "Exhaustividad",
    catalogueCompletenessValue: "Solo subconjunto de prueba — catálogo no completo",
    itemsHeading: "CÓDIGOS VERIFICADOS",
    colZiffer: "Código",
    colFactor: "Factor",
    colCount: "Cant.",
    colCatalogue: "Catálogo",
    colWarnings: "Indicaciones",
    catalogueFound: "Encontrado",
    catalogueNotFound: "No encontrado",
    noWarnings: "Ninguna",
    summaryHeading: "RESUMEN DE INDICACIONES",
    summaryLine: (warnCount, zifferCount) =>
      `${warnCount} indicación(es) en ${zifferCount} código(s).`,
    aiHeading: "NOTA ASISTIDA POR IA — NO VINCULANTE",
    aiNonBinding:
      "Esta nota IA no es jurídicamente vinculante, ni un diagnóstico, ni una decisión de reembolso.",
    aiGeneralNote: "Nota general",
    aiUncertainty: "Nota de incertidumbre",
    aiRowHints: "Indicaciones por código",
    aiFallback:
      "Indicación IA no disponible — los resultados deterministas anteriores siguen siendo válidos.",
    manualReviewHeading: "RECOMENDACIÓN",
    manualReviewText:
      "Se recomienda la revisión manual por parte de personal de facturación cualificado.",
    statusPending: "Pendiente",
    statusReviewed: "Revisado",
    statusDismissed: "Archivado",
    statusDraft: "Borrador",
    sourceManual: "Entrada manual",
    // G3b-2: catalogue verification status labels
    catalogueStatus: "Estado del catálogo",
    catalogueStatusVerified: "Verificado (puntos confirmados)",
    catalogueStatusPointsUncertain: "Puntos no verificados — revisión manual",
    catalogueStatusNeedsReview: "Requiere revisión — verificación manual",
    catalogueSourceRef: "Referencia fuente",
  },
};

/** Warning code → localised label mapping. */
const WARNING_LABELS = {
  de: {
    unknown_goae_ziffer: "Ziffer im Testkatalog nicht gefunden — manuelle Verifikation erforderlich",
    factor_requires_justification: "Faktor über 2,3 — schriftliche Begründung gemäß § 5 GOÄ prüfen",
    justification_missing: "Hoher Faktor ohne Begründungstext — Dokumentation empfohlen",
    invalid_factor: "Ungültiger Faktorwert",
    invalid_count: "Ungültige Anzahl",
  },
  en: {
    unknown_goae_ziffer: "Code not found in test catalogue — manual verification required",
    factor_requires_justification: "Factor above 2.3 — written justification may be required (§ 5 GOÄ)",
    justification_missing: "High factor without justification text — documentation recommended",
    invalid_factor: "Invalid factor value",
    invalid_count: "Invalid count value",
  },
  fr: {
    unknown_goae_ziffer: "Code absent du catalogue de test — vérification manuelle requise",
    factor_requires_justification: "Facteur supérieur à 2,3 — justification écrite possible (§ 5 GOÄ)",
    justification_missing: "Facteur élevé sans texte de justification — documentation recommandée",
    invalid_factor: "Valeur de facteur invalide",
    invalid_count: "Valeur de nombre invalide",
  },
  it: {
    unknown_goae_ziffer: "Codice non trovato nel catalogo di test — verifica manuale necessaria",
    factor_requires_justification: "Fattore > 2,3 — giustificazione scritta richiesta (§ 5 GOÄ)",
    justification_missing: "Fattore elevato senza testo di giustificazione — documentazione consigliata",
    invalid_factor: "Valore del fattore non valido",
    invalid_count: "Valore della quantità non valido",
  },
  es: {
    unknown_goae_ziffer: "Código no encontrado en catálogo de prueba — verificación manual requerida",
    factor_requires_justification: "Factor > 2,3 — puede requerirse justificación escrita (§ 5 GOÄ)",
    justification_missing: "Factor elevado sin texto de justificación — documentación recomendada",
    invalid_factor: "Valor de factor inválido",
    invalid_count: "Valor de cantidad inválido",
  },
};

function localeStatusLabel(s, locale) {
  const L = STRINGS[locale];
  const map = {
    pending: L.statusPending,
    reviewed: L.statusReviewed,
    dismissed: L.statusDismissed,
    draft: L.statusDraft,
  };
  return map[String(s || "").toLowerCase()] || safe(s);
}

function localeSourceLabel(s, locale) {
  if (!s || s === "manual") return STRINGS[locale].sourceManual;
  return safe(s);
}

function warningLabel(code, locale) {
  return WARNING_LABELS[locale]?.[code] || code;
}

// ─── pdf-lib helpers ────────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const MAX_W = PAGE_W - MARGIN * 2;
const DARK = rgb(0.08, 0.1, 0.15);
const MUTED = rgb(0.35, 0.4, 0.45);
const WARN = rgb(0.55, 0.28, 0.0);
const RULE = rgb(0.82, 0.84, 0.86);

function wrapText(text, font, size, maxWidth) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    try {
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    } catch {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/**
 * Build a PDF plausibility report buffer.
 *
 * @internal — exported for offline verification scripts only; not part of the public API.
 *
 * @param {object} opts
 * @param {object} opts.session — full session row from Prisma (incl. items)
 * @param {object[]} opts.items — full item rows from Prisma (incl. contextText)
 * @param {string} opts.locale — normalised locale key
 * @returns {Promise<Buffer>}
 */
export async function buildReportPdf({ session, items, locale }) {
  const normLocale = normaliseLocale(locale);
  const L = STRINGS[normLocale];
  const W = WARNING_LABELS[normLocale] || WARNING_LABELS.de;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function ensureSpace(needed) {
    if (y < MARGIN + needed) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function drawText(text, size, fn, color = DARK) {
    const lines = wrapText(text, fn, size, MAX_W);
    for (const line of lines) {
      ensureSpace(size * 1.5);
      page.drawText(line, { x: MARGIN, y, size, font: fn, color });
      y -= size * 1.4;
    }
  }

  function drawSmall(label, value, fn = font) {
    drawText(`${label}: ${value}`, 9, fn, MUTED);
  }

  function drawRule() {
    ensureSpace(8);
    page.drawLine({
      start: { x: MARGIN, y: y + 2 },
      end: { x: PAGE_W - MARGIN, y: y + 2 },
      thickness: 0.5,
      color: RULE,
    });
    y -= 6;
  }

  function drawSectionHeading(text) {
    y -= 10;
    drawRule();
    drawText(text, 10, bold, DARK);
    y -= 2;
  }

  const now = new Date().toISOString();
  const sessionDate = session.createdAt
    ? new Date(session.createdAt).toISOString()
    : "—";

  // ── Title block ───────────────────────────────────────────────────────────
  drawText(L.title, 15, bold);
  drawText(L.subtitle, 10, font, MUTED);
  y -= 6;
  drawSmall(L.generatedAt, now);
  drawSmall(L.sessionDate, sessionDate);
  drawSmall(L.sessionStatus, localeStatusLabel(session.status, normLocale));
  if (session.sourceType) {
    drawSmall(L.sourceType, localeSourceLabel(session.sourceType, normLocale));
  }
  if (session.disclaimerVersion) {
    drawSmall(L.disclaimerVersion, safe(session.disclaimerVersion));
  }

  // ── Disclaimer block ──────────────────────────────────────────────────────
  drawSectionHeading(L.disclaimerHeading);
  drawText(L.disclaimerText, 9, font, WARN);

  // ── Catalogue metadata ────────────────────────────────────────────────────
  drawSectionHeading(L.catalogueHeading);
  drawSmall(L.catalogueSource, safe(GOAE_CATALOGUE_META.sourceName));
  drawSmall(L.catalogueUrl, safe(GOAE_CATALOGUE_META.sourceUrl));
  if (GOAE_CATALOGUE_META.anlageUrl) {
    drawSmall(L.catalogueAnlage, safe(GOAE_CATALOGUE_META.anlageUrl));
  }
  if (GOAE_CATALOGUE_META.accessDate) {
    drawSmall(L.catalogueDate, safe(GOAE_CATALOGUE_META.accessDate));
  }
  drawSmall(L.catalogueCompleteness, L.catalogueCompletenessValue);

  // ── Items ─────────────────────────────────────────────────────────────────
  drawSectionHeading(L.itemsHeading);

  // Column header
  const COL = {
    ziffer: MARGIN,
    factor: MARGIN + 60,
    count: MARGIN + 110,
    catalogue: MARGIN + 150,
    warnings: MARGIN + 230,
  };

  ensureSpace(16);
  const colHeader = (text, x) =>
    page.drawText(text, { x, y, size: 9, font: bold, color: MUTED });
  colHeader(L.colZiffer, COL.ziffer);
  colHeader(L.colFactor, COL.factor);
  colHeader(L.colCount, COL.count);
  colHeader(L.colCatalogue, COL.catalogue);
  colHeader(L.colWarnings, COL.warnings);
  y -= 9 * 1.4;
  drawRule();

  let totalWarnings = 0;
  let zifferWithWarnings = 0;

  for (const item of items) {
    const catalogueFound = item.catalogueMatchJson?.found;
    const warnings = Array.isArray(item.warningsJson) ? item.warningsJson : [];
    const warnText =
      warnings.length === 0
        ? L.noWarnings
        : warnings.map((c) => warningLabel(c, normLocale)).join("; ");

    totalWarnings += warnings.length;
    if (warnings.length > 0) zifferWithWarnings += 1;

    ensureSpace(14);
    const drawCol = (text, x, fn = font, col = DARK) =>
      page.drawText(String(text ?? "—").slice(0, 28), { x, y, size: 8, font: fn, color: col });

    drawCol(safe(item.ziffer), COL.ziffer, bold);
    drawCol(safe(item.factor), COL.factor);
    drawCol(safe(item.count), COL.count);
    drawCol(
      catalogueFound ? L.catalogueFound : L.catalogueNotFound,
      COL.catalogue,
      font,
      catalogueFound ? rgb(0.08, 0.5, 0.2) : MUTED,
    );
    y -= 8 * 1.4;

    // Warning lines (each on its own row, indented under the warnings column)
    if (warnings.length > 0) {
      for (const code of warnings) {
        const label = warningLabel(code, normLocale);
        const wrapped = wrapText(label, font, 7.5, MAX_W - (COL.warnings - MARGIN));
        for (const wLine of wrapped) {
          ensureSpace(10);
          page.drawText(wLine, { x: COL.warnings, y, size: 7.5, font, color: WARN });
          y -= 7.5 * 1.35;
        }
      }
    }

    // Context text if present (practice note — max 120 chars displayed)
    if (item.contextText && String(item.contextText).trim()) {
      const ctx = String(item.contextText).trim().slice(0, 120);
      ensureSpace(10);
      page.drawText(`[${ctx}]`, { x: MARGIN, y, size: 7, font, color: MUTED });
      y -= 7 * 1.35;
    }

    // G3b-2: catalogue verification status (only for found entries; skipped for old sessions)
    if (catalogueFound) {
      const cs = item.catalogueMatchJson?.completenessStatus ?? null;
      if (cs) {
        const csLabelMap = {
          "verified": L.catalogueStatusVerified,
          "points-uncertain": L.catalogueStatusPointsUncertain,
          "needs-review": L.catalogueStatusNeedsReview,
        };
        const csLabel = csLabelMap[cs] || safe(cs);
        const csLine = `${L.catalogueStatus}: ${csLabel}`;
        const wrapped = wrapText(csLine, font, 7, MAX_W);
        for (const wLine of wrapped) {
          ensureSpace(10);
          page.drawText(wLine, { x: MARGIN, y, size: 7, font, color: MUTED });
          y -= 7 * 1.35;
        }
      }
      // Source reference if available
      const srcRef = item.catalogueMatchJson?.sourceLineOrReference ?? null;
      if (srcRef) {
        ensureSpace(10);
        page.drawText(`${L.catalogueSourceRef}: ${safe(srcRef)}`, {
          x: MARGIN, y, size: 7, font, color: MUTED,
        });
        y -= 7 * 1.35;
      }
    }

    y -= 2;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  drawSectionHeading(L.summaryHeading);
  drawText(L.summaryLine(totalWarnings, zifferWithWarnings), 9, font);

  // ── AI review — only if saved ─────────────────────────────────────────────
  const aiReview = session.resultSummaryJson?.aiReview ?? null;
  if (aiReview) {
    drawSectionHeading(L.aiHeading);
    drawText(L.aiNonBinding, 9, font, WARN);

    if (aiReview.fallback) {
      y -= 4;
      drawText(L.aiFallback, 9, font, MUTED);
    }

    if (aiReview.generalNote) {
      y -= 4;
      drawText(`${L.aiGeneralNote}: ${safe(aiReview.generalNote)}`, 9, font);
    }

    if (aiReview.uncertaintyNote) {
      drawText(`${L.aiUncertainty}: ${safe(aiReview.uncertaintyNote)}`, 9, font, MUTED);
    }

    if (Array.isArray(aiReview.rowHints) && aiReview.rowHints.length > 0) {
      y -= 4;
      drawText(L.aiRowHints, 9, bold);
      for (const rh of aiReview.rowHints) {
        drawText(`${safe(rh.ziffer)}: ${safe(rh.hint)}`, 8, font, MUTED);
      }
    }
  }

  // ── Manual review recommendation ──────────────────────────────────────────
  drawSectionHeading(L.manualReviewHeading);
  drawText(L.manualReviewText, 9, bold, DARK);

  return Buffer.from(await pdf.save());
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a plausibility report PDF for a saved session.
 *
 * @param {string} practiceId
 * @param {string} sessionId
 * @param {{ userId: string, locale?: string }} opts
 * @returns {Promise<{ ok: true, buffer: Buffer, filename: string } | { ok: false, error: string }>}
 */
export async function generateBillingPlausibilityReport(practiceId, sessionId, opts = {}) {
  const locale = normaliseLocale(opts.locale);

  const access = await getPracticeAccess(opts.userId, practiceId);
  if (!access) return { ok: false, error: "practice_not_found" };
  if (!hasPracticePermission(access.role, PERMISSIONS.INTEGRATIONS_MANAGE)) {
    return { ok: false, error: "forbidden" };
  }

  const session = await prisma.billingPlausibilitySession.findFirst({
    where: { id: sessionId, practiceProfileId: practiceId },
  });
  if (!session) return { ok: false, error: "session_not_found" };

  const items = await prisma.billingPlausibilityItem.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  const buffer = await buildReportPdf({ session, items, locale });

  const safeId = sessionId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 32);
  const filename = `plausibilitaetsbericht-${safeId}.pdf`;

  return { ok: true, buffer, filename };
}
