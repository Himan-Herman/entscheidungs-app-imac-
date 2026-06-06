/**
 * Organizational filter/search suggestions only — no medical ranking.
 */

const DISCLAIMER_DE =
  "Die KI unterstützt nur bei organisatorischer Suche und Filterung. Sie bewertet keine medizinischen Inhalte.";
const DISCLAIMER_EN =
  "AI only supports organizational search and filtering. It does not assess medical content.";

/**
 * @param {string} q
 * @param {'de' | 'en'} locale
 */
function normalizeQuery(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Tolerant keyword match (typos / partial words) — organizational terms only.
 * @param {string} haystack normalized
 * @param {string[]} needles normalized
 */
function fuzzyIncludes(haystack, needles) {
  for (const needle of needles) {
    if (!needle) continue;
    if (haystack.includes(needle)) return true;
    if (needle.length >= 5 && haystack.includes(needle.slice(0, needle.length - 1))) {
      return true;
    }
  }
  return false;
}

/**
 * @param {string} q
 * @param {'de' | 'en'} locale
 */
function suggestFiltersFromQuery(q, locale) {
  const n = normalizeQuery(q);
  /** @type {Record<string, boolean | string>} */
  const suggested = {};
  /** @type {Record<string, string[]>} */
  const groups = {
    messages: [],
    documents: [],
    medication: [],
    dataRequests: [],
    profile: [],
    status: [],
  };

  const de = locale === "de";

  if (
    fuzzyIncludes(n, [
      "ungelesen",
      "ungelesene",
      "ungelesen",
      "neu",
      "unread",
      "new message",
      "nachricht",
    ])
  ) {
    suggested.hasUnreadMessages = true;
    const note = de
      ? "„Ungelesen/neu“ → Filter für ungelesene Nachrichten"
      : "“Unread/new” → filter for unread messages";
    groups.messages.push(note);
  }

  if (fuzzyIncludes(n, ["dokument", "dokumnt", "befund", "document", "documents"])) {
    suggested.hasDocuments = true;
    const note = de
      ? "„Dokument“ → Patient:innen mit freigegebenen Dokumenten"
      : "“Document” → patients with shared documents";
    groups.documents.push(note);
  }

  if (fuzzyIncludes(n, ["medikation", "medikament", "medication", "medication plan", "plan"])) {
    suggested.hasMedicationPlan = true;
    const note = de
      ? "„Medikation“ → veröffentlichter Medikationsplan vorhanden"
      : "“Medication” → published medication plan present";
    groups.medication.push(note);
  }

  if (
    fuzzyIncludes(n, [
      "offen",
      "anfrage",
      "losch",
      "loesch",
      "data request",
      "open request",
      "deletion",
    ])
  ) {
    suggested.hasOpenDataRequest = true;
    const note = de
      ? "„Offen/Anfrage“ → offene Datenanfrage"
      : "“Open/request” → open data request";
    groups.dataRequests.push(note);
  }

  if (fuzzyIncludes(n, ["profil", "freigabe", "profile", "shared profile", "sharing"])) {
    suggested.profileShared = true;
    const note = de
      ? "„Profil/Freigabe“ → Profilfreigabe aktiv"
      : "“Profile/share” → profile access granted";
    groups.profile.push(note);
  }

  if (fuzzyIncludes(n, ["archiv", "archived"])) {
    suggested.status = "archived";
    groups.status.push(de ? "„Archiv“ → Status archiviert" : "“Archive” → archived status");
  }

  if (fuzzyIncludes(n, ["widerruf", "revoked"])) {
    suggested.status = "revoked";
    groups.status.push(de ? "„Widerrufen“ → Status widerrufen" : "“Revoked” → revoked status");
  }

  if (fuzzyIncludes(n, ["eingeladen", "invited"])) {
    suggested.status = "invited";
    groups.status.push(de ? "„Eingeladen“ → Status eingeladen" : "“Invited” → invited status");
  }

  if (fuzzyIncludes(n, ["aktiv", "active"])) {
    suggested.status = "active";
    groups.status.push(de ? "„Aktiv“ → Status aktiv" : "“Active” → active status");
  }

  const notes = [
    ...groups.messages,
    ...groups.documents,
    ...groups.medication,
    ...groups.dataRequests,
    ...groups.profile,
    ...groups.status,
  ];

  return { suggested, notes, groups };
}

/**
 * @param {{ locale?: string, q?: string, activeFilters?: Record<string, unknown> }} input
 */
export async function generatePracticePatientSearchAiSuggestion(input = {}) {
  const locale = String(input.locale || "de").toLowerCase().startsWith("en") ? "en" : "de";
  const q = String(input.q || "").trim();
  const { suggested, notes } = suggestFiltersFromQuery(q, locale);

  const disclaimer = locale === "en" ? DISCLAIMER_EN : DISCLAIMER_DE;
  const label = locale === "en" ? "AI suggestion – please review" : "Automatischer Vorschlag – bitte prüfen";

  if (!q && !notes.length) {
    return {
      label,
      disclaimer,
      suggested: {},
      summary:
        locale === "en"
          ? "Enter a search term or use the filters. AI can suggest organizational filters based on keywords."
          : "Geben Sie einen Suchbegriff ein oder nutzen Sie die Filter. Die KI kann organisatorische Filter anhand von Stichwörtern vorschlagen.",
      aiGenerated: true,
    };
  }

  const groupLines = (title, items) =>
    items.length ? [`${title}:`, ...items.map((line) => `  • ${line}`)] : [];

  const summaryLines =
    locale === "en"
      ? [
          "Organizational suggestions (no medical assessment):",
          ...groupLines("Messages", groups.messages),
          ...groupLines("Documents", groups.documents),
          ...groupLines("Medication", groups.medication),
          ...groupLines("Data requests", groups.dataRequests),
          ...groupLines("Profile sharing", groups.profile),
          ...groupLines("Status", groups.status),
          notes.length === 0
            ? "No automatic filter mapping for this term — try name, email, link ID, or status filters."
            : "",
        ].filter(Boolean)
      : [
          "Organisatorische Vorschläge (keine medizinische Bewertung):",
          ...groupLines("Nachrichten", groups.messages),
          ...groupLines("Dokumente", groups.documents),
          ...groupLines("Medikation", groups.medication),
          ...groupLines("Datenanfragen", groups.dataRequests),
          ...groupLines("Profilfreigabe", groups.profile),
          ...groupLines("Status", groups.status),
          notes.length === 0
            ? "Keine automatische Filter-Zuordnung — Name, E-Mail, Link-ID oder Statusfilter nutzen."
            : "",
        ].filter(Boolean);

  return {
    label,
    disclaimer,
    suggested,
    summary: summaryLines.join("\n"),
    aiGenerated: true,
  };
}
