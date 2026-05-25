import enLiveMedicalTranslation from "../../../i18n/translations/en/liveMedicalTranslation.js";

/**
 * Guaranteed message tree for live translation UI (prevents white screen on missing i18n keys).
 * @param {import("../../../i18n/translations/index.js").getMessages extends (...args: any) => infer R ? R : never} messages
 */
export function resolveLiveTranslationMessages(messages) {
  return (
    messages?.liveMedicalTranslation ||
    enLiveMedicalTranslation
  );
}

/**
 * @param {string | undefined} template
 * @param {Record<string, string>} vars
 */
export function formatMessageTemplate(template, vars = {}) {
  let out = String(template ?? "");
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(`{${key}}`, String(value ?? ""));
  }
  return out;
}
