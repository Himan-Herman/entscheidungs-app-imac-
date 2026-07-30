/** Locale-aware, timezone-explicit timestamp for written lifecycle receipts. */
const INTL_LOCALE = { de: "de-DE", en: "en-GB", fr: "fr-FR", it: "it-IT", es: "es-ES" };

export function formatLifecycleTimestamp(date, locale) {
  const intl = INTL_LOCALE[String(locale || "de").slice(0, 2)] || "de-DE";
  try {
    const formatted = new Intl.DateTimeFormat(intl, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Berlin",
    }).format(date);
    return `${formatted} (Europe/Berlin)`;
  } catch {
    return date.toISOString();
  }
}
