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
    return new Intl.DateTimeFormat(getIntlLocaleChain(uiLanguageCode), {
      dateStyle: "medium",
    }).format(d);
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
      getIntlLocaleChain(uiLanguageCode),
      { dateStyle: "medium", timeStyle: "short" },
    ).format(d);
  } catch {
    return "—";
  }
}

/**
 * BCP-47 chain for Intl APIs: selected → en → de.
 * @param {string} uiLanguageCode
 */
export function getIntlLocaleChain(uiLanguageCode) {
  const primary = String(uiLanguageCode || "en").toLowerCase();
  return [primary, "en", "de"];
}

/**
 * Relative time (e.g. "2 days ago") — organizational UI only.
 * @param {string | Date} isoOrDate
 * @param {string} uiLanguageCode
 */
export function formatUiRelativeTime(isoOrDate, uiLanguageCode) {
  try {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "—";
    const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(getIntlLocaleChain(uiLanguageCode), {
      numeric: "auto",
    });
    const abs = Math.abs(diffSec);
    if (abs < 60) return rtf.format(diffSec, "second");
    const diffMin = Math.round(diffSec / 60);
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
    const diffHr = Math.round(diffMin / 60);
    if (Math.abs(diffHr) < 48) return rtf.format(diffHr, "hour");
    const diffDay = Math.round(diffHr / 24);
    return rtf.format(diffDay, "day");
  } catch {
    return "—";
  }
}
