import { PRE_VISIT_LANGUAGE_OPTIONS } from "../features/preVisit/constants/languages.js";

/**
 * Language name for UI lists (patient/doctor Pre-Visit language codes).
 * Uses Intl.DisplayNames with UI locale chain [uiLang, en, de], then English labels from constants.
 */
export function formatLanguageDisplayName(uiLanguageCode, languageId) {
  const primary = String(uiLanguageCode || "en").toLowerCase();
  const code = String(languageId || "").trim();
  if (!code) return "—";
  try {
    const dn = new Intl.DisplayNames([primary, "en", "de"], {
      type: "language",
    });
    const tag = code.split("-")[0];
    const name = dn.of(tag);
    if (name) return name;
  } catch {
    /* Intl unsupported or invalid tag */
  }
  const row = PRE_VISIT_LANGUAGE_OPTIONS.find((r) => r.id === code);
  return row?.labelEn ?? code;
}

export function formatUiDate(isoOrDate, uiLanguageCode) {
  try {
    const d =
      isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(
      [String(uiLanguageCode || "en").toLowerCase(), "en", "de"],
      { dateStyle: "medium" },
    ).format(d);
  } catch {
    return "—";
  }
}

export function formatUiDateTime(isoOrDate, uiLanguageCode) {
  try {
    const d =
      isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(
      [String(uiLanguageCode || "en").toLowerCase(), "en", "de"],
      { dateStyle: "medium", timeStyle: "short" },
    ).format(d);
  } catch {
    return "—";
  }
}
