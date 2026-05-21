/**
 * @param {number | null | undefined} resetAtMs
 * @param {'de' | 'en'} language
 */
export function formatMedaResetTime(resetAtMs, language) {
  if (!resetAtMs || !Number.isFinite(resetAtMs)) return null;
  const locale =
    language === "en" ? "en-GB" : language === "fr" ? "fr-FR" : "de-DE";
  return new Date(resetAtMs).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * @param {Record<string, string>} t
 * @param {{ resetAt?: number | null, remaining?: number, limit?: number }} quota
 * @param {'de' | 'en'} language
 */
export function formatMedaRateLimitMessage(t, quota, language) {
  const time = formatMedaResetTime(quota?.resetAt, language);
  if (time && t.rateLimitAt) {
    return t.rateLimitAt.replace("{{time}}", time);
  }
  return t.rateLimit || "";
}
