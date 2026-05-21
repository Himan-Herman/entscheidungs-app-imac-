import { isRtlLanguage } from "../../../i18n/localeConfig.js";

/** Matches Arabic, Hebrew, Syriac, Thaana, NKo, and related RTL scripts in user content. */
const RTL_CHAR_RE = /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Basic Latin / extended Latin letters. */
const LATIN_CHAR_RE = /[A-Za-z\u00C0-\u024F]/;

/**
 * @param {string} code
 */
export function normalizeLanguageCode(code) {
  return String(code || "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
}

/**
 * Text direction for conversation content (per language, not UI chrome).
 * @param {string} languageCode
 * @returns {'rtl'|'ltr'}
 */
export function interpreterTextDirection(languageCode) {
  return isRtlLanguage(normalizeLanguageCode(languageCode)) ? "rtl" : "ltr";
}

/**
 * @param {string} text
 */
export function hasRtlCharactersInText(text) {
  return RTL_CHAR_RE.test(String(text || ""));
}

/**
 * Mixed Latin + RTL script in one string (common in bilingual clinics).
 * @param {string} text
 */
export function hasMixedScriptText(text) {
  const s = String(text || "");
  if (!s.trim()) return false;
  return hasRtlCharactersInText(s) && LATIN_CHAR_RE.test(s);
}

/**
 * BCP-47 `lang` attribute for a turn field.
 * @param {string} languageCode
 */
export function interpreterLangAttribute(languageCode) {
  const code = normalizeLanguageCode(languageCode);
  return code || undefined;
}

/**
 * Session uses at least one RTL conversation language.
 * @param {{ patientLanguage?: string, doctorLanguage?: string }} session
 */
export function sessionHasRtlLanguage(session) {
  if (!session) return false;
  return (
    isRtlLanguage(session.patientLanguage) ||
    isRtlLanguage(session.doctorLanguage)
  );
}

/**
 * @param {{ patientLanguage?: string, doctorLanguage?: string }} session
 */
export function sessionIsMixedDirection(session) {
  if (!session) return false;
  const p = interpreterTextDirection(session.patientLanguage);
  const d = interpreterTextDirection(session.doctorLanguage);
  return p !== d;
}
