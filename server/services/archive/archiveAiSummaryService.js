/**
 * Organizational archive overview only — no medical/legal deletion decisions.
 */

const ORGANIZATIONAL_DISCLAIMER_DE =
  "Die KI unterstützt nur organisatorisch. Sie entscheidet nicht über medizinische oder rechtliche Löschungspflichten.";
const ORGANIZATIONAL_DISCLAIMER_EN =
  "AI only provides organizational support. It does not decide medical or legal deletion obligations.";

/**
 * @param {{ locale?: string, counts?: Record<string, number> }} input
 */
export async function generateArchiveOrganizationalSummary(input = {}) {
  const locale = String(input.locale || "de").toLowerCase().startsWith("en") ? "en" : "de";
  const counts = input.counts || {};
  const archived = Number(counts.archived) || 0;
  const deleted = Number(counts.deleted) || 0;
  const active = Number(counts.active) || 0;

  const disclaimer =
    locale === "en" ? ORGANIZATIONAL_DISCLAIMER_EN : ORGANIZATIONAL_DISCLAIMER_DE;

  const lines =
    locale === "en"
      ? [
          "Organizational overview (no medical assessment):",
          `- Active items in view: ${active}`,
          `- Archived items: ${archived}`,
          `- Soft-deleted items (hidden from active lists): ${deleted}`,
          "Tip: Use “Show archive” to review archived entries. Soft-deleted items remain traceable in audit logs.",
        ]
      : [
          "Organisatorische Übersicht (keine medizinische Bewertung):",
          `- Aktive Einträge in der Ansicht: ${active}`,
          `- Archivierte Einträge: ${archived}`,
          `- Soft-gelöschte Einträge (aus aktiver Ansicht ausgeblendet): ${deleted}`,
          "Hinweis: „Archiv anzeigen“ nutzen, um archivierte Einträge zu prüfen. Soft-gelöschte Einträge bleiben im Audit nachvollziehbar.",
        ];

  return {
    text: lines.join("\n"),
    disclaimer,
    aiGenerated: true,
  };
}
