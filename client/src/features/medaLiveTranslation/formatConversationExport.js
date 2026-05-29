/**
 * Formats a Meda Live Translation conversation as plain text for
 * clipboard copy or .txt file download.
 *
 * Pure function — no React, no side effects.
 * No medical interpretation is added; only the existing conversation
 * data is formatted.
 *
 * @param {{
 *   conversation: import('./MedaLiveTranslationPage').ConvEntry[],
 *   patientLangName: string,
 *   practiceLangName: string,
 *   t: object,
 * }} params
 * @returns {string}
 */
export function formatConversationExport({ conversation, patientLangName, practiceLangName, t }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString([], { dateStyle: "long" });
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const sep = "=".repeat(44);

  const header = [
    t.exportTitle,
    sep,
    `${t.exportPatientLanguageLabel}: ${patientLangName}`,
    `${t.exportPracticeLanguageLabel}: ${practiceLangName}`,
    `${dateStr}, ${timeStr}`,
    "",
    t.exportDisclaimer,
    sep,
  ].join("\n");

  const entries = conversation.map((entry) => {
    const speakerLabel =
      entry.speakerRole === "patient" ? t.patientRoleLabel : t.practiceRoleLabel;
    const lines = [
      `[${entry.timestamp}] ${speakerLabel}`,
      `${t.exportOriginalLabel}: ${entry.sourceText}`,
    ];
    if (entry.status === "translated" && entry.translatedText) {
      lines.push(`${t.exportTranslationLabel}: ${entry.translatedText}`);
    } else if (entry.status === "unclear") {
      lines.push(`${t.exportStatusLabel}: ${t.unclearEntryLabel}`);
    } else if (entry.status === "error") {
      lines.push(`${t.exportStatusLabel}: ${t.failedEntryLabel}`);
    } else if (entry.status === "pending") {
      lines.push(`${t.exportStatusLabel}: ${t.translationLoading}`);
    }
    return lines.join("\n");
  });

  return [header, ...entries].join("\n\n");
}
