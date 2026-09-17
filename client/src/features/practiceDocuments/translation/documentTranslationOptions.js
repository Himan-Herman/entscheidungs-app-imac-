/**
 * Choices, validity and request shape for patient-facing document translation.
 *
 * Kept as plain functions with no React and no network so the rules that matter
 * — which languages exist, which modes exist, what the request may contain —
 * are testable directly. The component renders these decisions; it does not
 * make them.
 *
 * None of this is a security boundary. Every one of these checks exists again,
 * authoritatively, on the server; here they only stop the UI offering something
 * that would be refused.
 */

import { DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES } from "../../../i18n/localeConfig.js";
import { LOCALE_OPTIONS } from "../../../i18n/localeConfig.js";

/**
 * The two modes, with their wire values.
 *
 * The wire values are the server's vocabulary and are never shown to a patient:
 * the UI labels come from i18n, so "strict_translation" stays an implementation
 * detail rather than leaking into the interface.
 */
export const TRANSLATION_MODES = Object.freeze({
  STRICT: "strict_translation",
  PLAIN: "plain_language",
});

export const TRANSLATION_MODE_VALUES = Object.freeze([
  TRANSLATION_MODES.STRICT,
  TRANSLATION_MODES.PLAIN,
]);

/**
 * V1 processes German source documents only — the server's
 * SUPPORTED_DOCUMENT_SOURCE_LANGUAGES. There is deliberately no source-language
 * picker: offering one would suggest a capability that does not exist.
 */
export const DOCUMENT_SOURCE_LANGUAGE = "de";

/**
 * File types the server can extract. Mirrors TRANSLATABLE_MIME_TYPES so the UI
 * can hide a file it already knows would be refused; the server decides.
 */
const SUPPORTED_MIME_TYPES = Object.freeze(
  new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
);

/**
 * Document types offered in V1. Mirrors TRANSLATABLE_DOCUMENT_TYPES.
 * `lab`, `other`, `imaging` and `prescription_info` are excluded server-side.
 */
const OFFERED_DOCUMENT_TYPES = Object.freeze(
  new Set(["report", "discharge", "referral"]),
);

/**
 * Target languages, derived from the central locale registry.
 *
 * Never a literal list in this module: the product ships six UI languages and
 * that set lives in one place. A language activated centrally appears here on
 * its own; the seventeen registered-but-unshipped locales never do.
 *
 * @returns {{ code: string, nativeName: string }[]}
 */
export function getTranslationTargetLanguages() {
  const byCode = new Map(LOCALE_OPTIONS.map((option) => [option.code, option]));
  return DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES.map((code) => ({
    code,
    nativeName: byCode.get(code)?.nativeName ?? code,
  }));
}

/** @param {string} code */
export function isOfferedTargetLanguage(code) {
  return DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES.includes(code);
}

/**
 * Whether the section should appear for this document at all.
 * A UX filter, not an authorisation check.
 *
 * @param {{ type?: string, files?: { mimeType?: string }[] }} document
 */
export function isTranslatableDocument(document) {
  if (!document || !OFFERED_DOCUMENT_TYPES.has(document.type)) return false;
  return selectableFiles(document).length > 0;
}

/**
 * Files a patient may choose from.
 *
 * A PracticeDocument can carry several files, and picking "the first one"
 * silently would transform something the patient did not choose.
 *
 * @param {{ files?: { id: string, mimeType?: string }[] }} document
 */
export function selectableFiles(document) {
  return (document?.files ?? []).filter((file) =>
    SUPPORTED_MIME_TYPES.has(String(file?.mimeType ?? "").toLowerCase()),
  );
}

/**
 * Pre-select a file only when there is exactly one candidate. With several, the
 * patient chooses.
 *
 * @param {{ files?: { id: string, mimeType?: string }[] }} document
 * @returns {string} file id, or "" when the patient must choose
 */
export function defaultSelectedFileId(document) {
  const files = selectableFiles(document);
  return files.length === 1 ? files[0].id : "";
}

/**
 * A faithful translation into the source language is a no-op, and the server
 * answers `translation_not_required`. Saying so before the request is a better
 * experience than a round trip that explains nothing.
 *
 * Plain-language German → German is a genuine transformation and is allowed.
 *
 * @param {string} mode
 * @param {string} targetLanguage
 */
export function isSameLanguageStrictRequest(mode, targetLanguage) {
  return mode === TRANSLATION_MODES.STRICT && targetLanguage === DOCUMENT_SOURCE_LANGUAGE;
}

/**
 * Everything the start control needs to know.
 *
 * @param {object} input
 * @param {object} input.document
 * @param {string} input.fileId
 * @param {string} input.mode
 * @param {string} input.targetLanguage
 * @param {boolean} [input.busy]
 * @returns {{ canSubmit: boolean, reason: string | null }}
 *   `reason` is an i18n key suffix, not a message.
 */
export function evaluateSubmitState(input) {
  const { document, fileId, mode, targetLanguage, busy } = input ?? {};

  if (busy) return { canSubmit: false, reason: "busy" };
  if (!isTranslatableDocument(document)) return { canSubmit: false, reason: "documentNotEligible" };
  if (!fileId || !selectableFiles(document).some((f) => f.id === fileId)) {
    return { canSubmit: false, reason: "fileNotSelected" };
  }
  if (!TRANSLATION_MODE_VALUES.includes(mode)) return { canSubmit: false, reason: "modeNotSelected" };
  if (!isOfferedTargetLanguage(targetLanguage)) {
    return { canSubmit: false, reason: "languageNotSelected" };
  }
  if (isSameLanguageStrictRequest(mode, targetLanguage)) {
    return { canSubmit: false, reason: "sameLanguageStrict" };
  }

  return { canSubmit: true, reason: null };
}

/**
 * Build the request body.
 *
 * Exactly four fields, constructed here rather than spread from component
 * state, so no stray field can reach the endpoint — which rejects unknown keys
 * with a 400 anyway.
 *
 * @param {{ fileId: string, targetLanguage: string, mode: string }} input
 */
export function buildTranslationRequestBody(input) {
  return {
    fileId: input.fileId,
    sourceLanguage: DOCUMENT_SOURCE_LANGUAGE,
    targetLanguage: input.targetLanguage,
    mode: input.mode,
  };
}
