/**
 * Organizational practice dashboard summary only — no medical prioritization.
 */

const DISCLAIMER_DE =
  "Die KI fasst nur organisatorische Dashboard-Informationen zusammen und gibt keine medizinische Bewertung.";
const DISCLAIMER_EN =
  "AI only summarizes organizational dashboard information and does not provide medical assessment.";

const NOT_PROVIDED_DE = "nicht angegeben";
const NOT_PROVIDED_EN = "not provided";

/**
 * @param {number | null | undefined} value
 * @param {'de' | 'en'} locale
 */
function fmtCount(value, locale) {
  if (value == null || Number.isNaN(Number(value))) {
    return locale === "en" ? NOT_PROVIDED_EN : NOT_PROVIDED_DE;
  }
  return String(Number(value));
}

/**
 * @param {{ locale?: string, metrics?: Record<string, unknown>, visibility?: Record<string, boolean> }} input
 */
export async function generatePracticeDashboardAiSummary(input = {}) {
  const locale = String(input.locale || "de").toLowerCase().startsWith("en") ? "en" : "de";
  const metrics = input.metrics || {};
  const visibility = input.visibility || {};
  const np = locale === "en" ? NOT_PROVIDED_EN : NOT_PROVIDED_DE;

  const sections = [];
  const checklist = [];

  if (visibility.inbox !== false) {
    const n = fmtCount(metrics.unreadInboxItems, locale);
    sections.push(
      locale === "en"
        ? `Inbox: ${n} unread organizational item(s).`
        : `Postfach: ${n} ungelesene organisatorische Einträge.`,
    );
    if (Number(metrics.unreadInboxItems) > 0) {
      checklist.push(
        locale === "en" ? "Review unread inbox items." : "Ungelesene Postfach-Einträge prüfen.",
      );
    }
  }

  if (visibility.messages !== false) {
    const n = fmtCount(metrics.openMessages, locale);
    sections.push(
      locale === "en"
        ? `Messages: ${n} open patient message(s) (organizational).`
        : `Nachrichten: ${n} offene Patientennachricht(en) (organisatorisch).`,
    );
    if (Number(metrics.openMessages) > 0) {
      checklist.push(
        locale === "en" ? "Review open message threads." : "Offene Nachrichten-Threads prüfen.",
      );
    }
  }

  if (visibility.dataRequests !== false) {
    const n = fmtCount(metrics.openDataRequests, locale);
    sections.push(
      locale === "en"
        ? `Data requests: ${n} open request(s).`
        : `Datenanfragen: ${n} offene Anfrage(n).`,
    );
    if (Number(metrics.openDataRequests) > 0) {
      checklist.push(
        locale === "en" ? "Process open data requests." : "Offene Datenanfragen bearbeiten.",
      );
    }
  }

  if (visibility.patients !== false) {
    sections.push(
      locale === "en"
        ? `Patients: ${fmtCount(metrics.activePatientLinks, locale)} active care relationship(s).`
        : `Patient:innen: ${fmtCount(metrics.activePatientLinks, locale)} aktive Beziehung(en).`,
    );
  }

  if (visibility.documents !== false) {
    sections.push(
      locale === "en"
        ? `Documents: ${fmtCount(metrics.newDocumentShares, locale)} new share(s) in the last ${14} days.`
        : `Dokumente: ${fmtCount(metrics.newDocumentShares, locale)} neue Freigabe(n) in den letzten ${14} Tagen.`,
    );
  }

  if (visibility.medication !== false) {
    sections.push(
      locale === "en"
        ? `Medication plans: ${fmtCount(metrics.publishedMedicationPlans, locale)} published in the last ${30} days.`
        : `Medikationspläne: ${fmtCount(metrics.publishedMedicationPlans, locale)} veröffentlicht in den letzten ${30} Tagen.`,
    );
  }

  if (!sections.length) {
    sections.push(
      locale === "en"
        ? "No organizational dashboard metrics available for your role."
        : "Für Ihre Rolle sind keine organisatorischen Dashboard-Kennzahlen verfügbar.",
    );
  }

  const grouped =
    locale === "en"
      ? [
          "By type:",
          `- Inbox & messages: inbox ${fmtCount(metrics.unreadInboxItems, locale)}, messages ${fmtCount(metrics.openMessages, locale)}`,
          `- Patients & requests: active ${fmtCount(metrics.activePatientLinks, locale)}, data requests ${fmtCount(metrics.openDataRequests, locale)}`,
          `- Documents & medication: shares ${fmtCount(metrics.newDocumentShares, locale)}, plans ${fmtCount(metrics.publishedMedicationPlans, locale)}`,
        ]
      : [
          "Nach Bereich:",
          `- Postfach & Nachrichten: Postfach ${fmtCount(metrics.unreadInboxItems, locale)}, Nachrichten ${fmtCount(metrics.openMessages, locale)}`,
          `- Patient:innen & Anfragen: aktiv ${fmtCount(metrics.activePatientLinks, locale)}, Datenanfragen ${fmtCount(metrics.openDataRequests, locale)}`,
          `- Dokumente & Medikation: Freigaben ${fmtCount(metrics.newDocumentShares, locale)}, Pläne ${fmtCount(metrics.publishedMedicationPlans, locale)}`,
        ];

  const checklistText =
    checklist.length > 0
      ? checklist.map((c) => `• ${c}`).join("\n")
      : locale === "en"
        ? `• ${np}`
        : `• ${np}`;

  const text = [
    ...(locale === "en"
      ? ["Organizational day overview (no medical assessment):"]
      : ["Organisatorische Tagesübersicht (keine medizinische Bewertung):"]),
    ...sections.map((s) => `- ${s}`),
    "",
    ...grouped,
    "",
    locale === "en" ? "Open organizational checklist:" : "Offene organisatorische Checkliste:",
    checklistText,
  ].join("\n");

  return {
    text,
    disclaimer: locale === "en" ? DISCLAIMER_EN : DISCLAIMER_DE,
    aiGenerated: true,
  };
}
