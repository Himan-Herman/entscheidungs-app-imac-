import { deepMerge } from "../../../i18n/deepMerge.js";
import enLiveMedicalTranslation from "../../../i18n/translations/en/liveMedicalTranslation.js";

/**
 * Guaranteed complete message tree — partial locale bundles cannot omit nested keys.
 * @param {Record<string, unknown> | null | undefined} messages
 */
export function resolveLiveTranslationMessages(messages) {
  const primary = messages?.liveMedicalTranslation;
  if (!primary || typeof primary !== "object") {
    return enLiveMedicalTranslation;
  }
  return deepMerge(enLiveMedicalTranslation, primary);
}

/**
 * @param {string | undefined} template
 * @param {Record<string, string>} vars
 */
export function formatMessageTemplate(template, vars = {}) {
  if (!template || typeof template !== "string") return "";
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, String(value ?? ""));
  }
  return out;
}
