/**
 * Message translation policy — what may be translated, into what, and how.
 *
 * Deny-by-default decisions made BEFORE any model is involved. No I/O, no
 * database, no environment access, so it can be tested exhaustively on its own.
 *
 * ── Why this is not the document translation policy ─────────────────────────
 * A practice document is a finished artefact of known type, extracted and
 * segmented before anything is decided about it. A chat message is short free
 * text written moments ago by a patient or a member of a practice. The document
 * policy's central question — is this document TYPE eligible — has no analogue
 * here, and its answer set (report, discharge, referral) would be meaningless.
 * What the two share is the safety machinery, and that is what is reused: the
 * masking chain, the output validation, and the shape of the provider gate.
 */

import { MESSAGE_TRANSLATION_TARGET_LOCALE_CODES } from "../../../shared/i18n/localeConfig.js";

export { MESSAGE_TRANSLATION_TARGET_LOCALE_CODES };

/**
 * The two ways one message may be rendered.
 *
 * `normal`  — as faithful a translation as the language allows.
 * `simple`  — the same information in plainer words.
 *
 * They are separate modes, never a chain. `simple` is produced from the
 * ORIGINAL, not from a `normal` result: rewriting a translation would be two
 * generative steps over the same clinical sentence, and each one is a chance
 * for it to drift.
 *
 * What `simple` is NOT: a summary, an explanation, an interpretation, or advice.
 * It may say the same thing more plainly. It may not say more, less, or
 * something else.
 */
export const MESSAGE_TRANSLATION_MODES = Object.freeze({
  NORMAL: "normal",
  SIMPLE: "simple",
});

const MODES = new Set(Object.values(MESSAGE_TRANSLATION_MODES));

/** Longest message body this feature will send. Mirrors the messaging limit. */
export const MAX_TRANSLATABLE_BODY_LEN = 8000;

export const MESSAGE_TRANSLATION_ERRORS = Object.freeze({
  MESSAGE_NOT_FOUND: "message_not_found",
  MESSAGE_WITHDRAWN: "message_withdrawn",
  MESSAGE_EMPTY: "message_empty",
  MESSAGE_TOO_LONG: "message_too_long",
  UNSUPPORTED_TARGET_LANGUAGE: "unsupported_target_language",
  UNSUPPORTED_MODE: "unsupported_mode",
  FEATURE_DISABLED: "message_translation_disabled",
  PROVIDER_NOT_CONFIGURED: "message_translation_provider_not_configured",
  PROVIDER_FAILED: "message_translation_provider_failed",
  OUTPUT_REJECTED: "message_translation_output_rejected",
  /**
   * The plainer rendering could not be produced safely. Distinct from a
   * rejected translation so the interface can say what actually happened —
   * the original is intact, only the alternative rendering is unavailable.
   */
  SIMPLE_UNSAFE: "message_simplification_unsafe",
});

export class MessageTranslationError extends Error {
  /**
   * @param {string} code one of MESSAGE_TRANSLATION_ERRORS
   * @param {object} [details] operational metadata — never message content
   */
  constructor(code, details = {}) {
    super(code);
    this.name = "MessageTranslationError";
    this.code = code;
    this.details = details;
  }
}

const TARGETS = new Set(MESSAGE_TRANSLATION_TARGET_LOCALE_CODES);

/**
 * Normalizes a requested target language, or refuses it.
 *
 * The set is derived centrally, so a language activated for the product becomes
 * available here and one withdrawn disappears. Anything outside it is refused
 * rather than approximated: translating into a language the surrounding
 * interface does not speak produces a screen the reader cannot use.
 *
 * @param {unknown} requested
 * @returns {string}
 */
export function assertSupportedTargetLanguage(requested) {
  const code = String(requested ?? "").trim().toLowerCase();
  if (!TARGETS.has(code)) {
    throw new MessageTranslationError(
      MESSAGE_TRANSLATION_ERRORS.UNSUPPORTED_TARGET_LANGUAGE,
      { requested: code || null, supported: [...TARGETS] },
    );
  }
  return code;
}

/**
 * Normalizes a requested mode, or refuses it.
 *
 * Deny-by-default: an unknown mode is refused rather than falling back to a
 * sensible one. A caller asking for a rendering this feature does not have
 * should be told so, not quietly given a different one.
 *
 * @param {unknown} requested
 */
export function assertSupportedMode(requested) {
  const mode = String(requested ?? MESSAGE_TRANSLATION_MODES.NORMAL).trim();
  if (!MODES.has(mode)) {
    throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.UNSUPPORTED_MODE, { mode });
  }
  return mode;
}

/**
 * Is this message translatable at all?
 *
 * A withdrawn message is refused here rather than further down. Its body is
 * empty by then, so a length check alone would refuse it — but for the wrong
 * reason, and a caller reading the error would learn nothing about why.
 *
 * @param {{ body?: string, withdrawnAt?: Date | null }} message
 */
export function assertTranslatableMessage(message) {
  if (!message) throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.MESSAGE_NOT_FOUND);
  if (message.withdrawnAt) {
    throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.MESSAGE_WITHDRAWN);
  }
  const body = String(message.body ?? "");
  if (!body.trim()) throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.MESSAGE_EMPTY);
  if (body.length > MAX_TRANSLATABLE_BODY_LEN) {
    throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.MESSAGE_TOO_LONG, {
      length: body.length,
      max: MAX_TRANSLATABLE_BODY_LEN,
    });
  }
  return body;
}
