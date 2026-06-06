/**
 * Organizational export structure suggestions only — no medical assessment.
 */

const DISCLAIMER_DE =
  "Die KI unterstützt nur bei Struktur und Formulierung des Exports. Sie bewertet keine medizinischen Inhalte.";
const DISCLAIMER_EN =
  "AI only supports export structure and wording. It does not assess medical content.";

/**
 * @param {{ locale?: string, type?: string, format?: string, rowCount?: number }} input
 */
export async function generateExportAiOrganize(input = {}) {
  const locale = String(input.locale || "de").toLowerCase().startsWith("en") ? "en" : "de";
  const de = locale === "de";
  const rows = Number(input.rowCount) || 0;
  const type = String(input.type || "export");
  const format = String(input.format || "pdf");

  const sections =
    de
      ? [
          "Organisatorische Struktur (keine medizinische Bewertung):",
          `• Exporttyp: ${type}`,
          `• Format: ${format.toUpperCase()}`,
          `• Einträge in Export: ${rows}`,
          "• Abschnitte: Titel, Erstellungsdatum, Quelle, tabellarische Metadaten",
          "• Prüfen: Sind alle erwarteten organisatorischen Felder enthalten?",
        ]
      : [
          "Organizational structure (no medical assessment):",
          `• Export type: ${type}`,
          `• Format: ${format.toUpperCase()}`,
          `• Rows in export: ${rows}`,
          "• Sections: title, created date, source, tabular metadata",
          "• Review: Are all expected organizational fields included?",
        ];

  return {
    label: de ? "Automatischer Vorschlag – bitte prüfen" : "AI suggestion – please review",
    disclaimer: de ? DISCLAIMER_DE : DISCLAIMER_EN,
    text: sections.join("\n"),
    aiGenerated: true,
  };
}
