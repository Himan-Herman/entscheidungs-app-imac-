import { LOCALE_OPTIONS } from "../../../i18n/localeConfig.js";
import { buildAutoSessionTitle } from "./sessionAutoTitle.js";

/**
 * @param {import('../types.js').InterpreterSession} session
 * @param {object} t
 * @param {string} [uiLanguage]
 */
export function getSessionDisplayTitle(session, t, uiLanguage = "de") {
  const title = session.conversationTitle?.trim();
  if (title) return title;
  return buildAutoSessionTitle(session, t, uiLanguage);
}

/**
 * @param {string} code
 */
export function getLanguageNativeName(code) {
  const match = LOCALE_OPTIONS.find((o) => o.code === code);
  return match?.nativeName ?? code;
}
