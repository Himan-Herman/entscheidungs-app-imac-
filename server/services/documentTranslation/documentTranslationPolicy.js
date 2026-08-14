/**
 * Document translation policy — what may be translated, into what, and how.
 *
 * Everything in this file is a deny-by-default decision made BEFORE any model
 * is involved. A model never decides whether a document is eligible: by the
 * time text exists, eligibility has already been settled here.
 *
 * No I/O, no database, no environment access — pure policy so it can be unit
 * tested exhaustively and reasoned about in isolation.
 */

import {
  DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES,
  normalizeDocumentTranslationTarget,
} from "../i18n/localeMetadata.js";

export { DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES, normalizeDocumentTranslationTarget };

/**
 * V1 allowlist of PracticeDocument.type values.
 *
 * Written out explicitly rather than derived from DOCUMENT_TYPES: a document
 * type added to the product later must NOT become translatable by accident.
 * Widening this set is a deliberate edit with its own review.
 *
 * Excluded on purpose:
 *   other              — catch-all. Holds e.g. Meda conversation protocols.
 *                        A bucket is not a provenance statement.
 *   imaging            — the file is typically an image, which V1 does not
 *                        extract at all; allowing the type would only create
 *                        surface without capability.
 *   prescription_info  — highest dosage-corruption risk. Held back until the
 *                        masking chain has operating evidence.
 *   lab                — removed from V1. A lab result's meaning lives in its
 *                        table structure, and a PDF text layer cannot prove a
 *                        value still belongs to its parameter. DOCX lab reports
 *                        are not a relevant mainstream case, and the
 *                        plain-language need is already served by the dedicated
 *                        lab explanation path. Refusing beats risking a value
 *                        under the wrong parameter.
 */
export const TRANSLATABLE_DOCUMENT_TYPES = Object.freeze(
  new Set(["report", "discharge", "referral"]),
);

/**
 * Translation modes.
 *
 * The wire values are spelled out rather than abbreviated: they appear in the
 * request body, in audit records and in error detail, and "strict" alone does
 * not say what it is strict about.
 */
export const TRANSLATION_MODES = Object.freeze({
  /** Mode A — faithful translation at the same technical level. */
  STRICT: "strict_translation",
  /** Mode B — plain-language rendering, no medical reinterpretation. */
  PLAIN: "plain_language",
});

const MODE_VALUES = Object.freeze(new Set(Object.values(TRANSLATION_MODES)));

/**
 * Document types whose meaning depends on preserved tabular structure.
 *
 * For these, extraction must prove it kept row/column order. If it cannot, the
 * document is refused rather than flattened into prose — a lab table read as a
 * paragraph silently re-associates values with the wrong parameters, which is
 * worse than no translation at all.
 *
 * `lab` is currently NOT in the V1 allowlist, so this rule is unreachable
 * today. It is kept deliberately: it is the precondition that has to hold
 * before lab may ever be re-admitted, and deleting it would mean re-deriving
 * the same reasoning later under time pressure.
 */
const STRUCTURE_CRITICAL_TYPES = Object.freeze(new Set(["lab"]));

/**
 * Type/mode combinations handled by a dedicated feature instead of this service.
 *
 * lab + PLAIN is routed away deliberately: a reviewed, released lab result
 * already has a patient-facing explanation path
 * (services/practiceDocument/labPatientExplanationService.js) with its own
 * safety module and reference-range semantics. Two overlapping plain-language
 * lab explanations would be two different answers to the same question.
 */
const MODE_HANDLED_ELSEWHERE = Object.freeze([{ type: "lab", mode: TRANSLATION_MODES.PLAIN }]);

/* --------------------------------------------------------------- limits */

/**
 * Hard processing limits. Exceeding any of them fails closed.
 * These bound both cost and blast radius; they are not tuning knobs.
 */
export const TRANSLATION_LIMITS = Object.freeze({
  /** Pages beyond this are refused rather than truncated. */
  MAX_PAGES: 40,
  /** Total extracted characters across the whole document. */
  MAX_TOTAL_CHARS: 60_000,
  /** A single segment longer than this indicates failed segmentation. */
  MAX_SEGMENT_CHARS: 4_000,
  /** Segment count ceiling — guards pathological splitting. */
  MAX_SEGMENTS: 1_500,
  /** Below this, "extraction succeeded" is not credible for a real document. */
  MIN_TOTAL_CHARS: 40,
  /**
   * Mean characters per page below which a PDF is treated as a scan with
   * incidental text rather than a text-layer document.
   */
  MIN_MEAN_CHARS_PER_PAGE: 120,
  /**
   * Share of pages that must carry meaningful text. A 10-page document with
   * text on page 1 only is a scan with a cover sheet, not an extractable file.
   */
  MIN_PAGE_COVERAGE_RATIO: 0.6,
  /** Characters below which a single page counts as empty. */
  EMPTY_PAGE_CHAR_THRESHOLD: 24,
});

/* ------------------------------------------------------- error contract */

/**
 * Stable error codes. The client maps these to i18n keys; raw parser errors are
 * never surfaced and document content never appears in any of them.
 */
export const TRANSLATION_ERRORS = Object.freeze({
  FEATURE_DISABLED: "feature_disabled",
  DOCUMENT_NOT_FOUND: "document_not_found",
  DOCUMENT_UNAVAILABLE: "document_unavailable",
  LINK_NOT_ACTIVE: "link_not_active",
  FILE_NOT_FOUND: "file_not_found",
  TYPE_NOT_TRANSLATABLE: "document_type_not_translatable",
  MODE_HANDLED_ELSEWHERE: "mode_handled_elsewhere",
  INVALID_MODE: "validation_invalid_mode",
  INVALID_LOCALE: "validation_invalid_locale",
  TEXT_UNAVAILABLE: "document_text_unavailable",
  ENCRYPTED: "document_encrypted",
  CORRUPT: "document_corrupt",
  TOO_LARGE: "document_too_large",
  STRUCTURE_UNSUPPORTED: "document_structure_unsupported",
  UNSUPPORTED_FILE_TYPE: "document_file_type_unsupported",
  INTEGRITY_FAILED: "integrity_failed",
  /**
   * A medication context contains a product name that local masking cannot
   * protect. Refusing beats translating it and risking a silent rename.
   */
  MEDICATION_UNVERIFIABLE: "document_medication_unverifiable",
  /**
   * A written-out dosage was recognised but could not be protected atomically.
   * Separate from MEDICATION_UNVERIFIABLE because the cause and the message to
   * the reader differ.
   */
  DOSAGE_UNVERIFIABLE: "document_dosage_unverifiable",
  /** The document's source language is not one V1 can safely process. */
  SOURCE_LANGUAGE_UNSUPPORTED: "document_source_language_unsupported",
  /** The declared source language is contradicted by the document itself. */
  SOURCE_LANGUAGE_UNCERTAIN: "document_source_language_uncertain",

  /* ---- provider-facing (phase 2B) ---------------------------------- */

  /** Requested target language is not one the product ships. */
  TARGET_LANGUAGE_UNSUPPORTED: "translation_target_language_unsupported",
  /** Requested mode is not a known mode. */
  MODE_INVALID: "translation_mode_invalid",
  /**
   * No translation-specific provider configuration is present. This is the
   * fail-closed state: without it, not a single character of document content
   * may leave the server. It is deliberately NOT satisfied by a generic
   * OPENAI_API_KEY being available for other features.
   */
  PROVIDER_NOT_CONFIGURED: "document_translation_provider_not_configured",
  /** The configured provider could not be reached or returned a transport error. */
  PROVIDER_UNAVAILABLE: "document_translation_provider_unavailable",
  /** The provider rate-limited us, or our own limits were exceeded. */
  RATE_LIMITED: "document_translation_rate_limited",
  /** The provider did not answer within the deadline, or the client went away. */
  TIMEOUT: "document_translation_timeout",
  /** The provider's response did not satisfy the required output schema. */
  INVALID_RESPONSE: "document_translation_invalid_response",
});

/**
 * Error carrying a stable code. Never wraps a parser error object, so nothing
 * from a malformed document can leak into a response or a log line.
 */
export class DocumentTranslationError extends Error {
  /**
   * @param {string} code one of TRANSLATION_ERRORS
   * @param {Record<string, unknown>} [detail] metadata only — never document text
   */
  constructor(code, detail = {}) {
    super(code);
    this.name = "DocumentTranslationError";
    this.code = code;
    this.detail = detail;
  }
}

/* --------------------------------------------------------------- checks */

/** @param {string} type */
export function isTranslatableDocumentType(type) {
  return typeof type === "string" && TRANSLATABLE_DOCUMENT_TYPES.has(type);
}

/** @param {string} type */
export function requiresReliableStructure(type) {
  return typeof type === "string" && STRUCTURE_CRITICAL_TYPES.has(type);
}

/**
 * @param {unknown} mode
 * @returns {string | null} normalised mode, or null if not a known mode
 */
export function normalizeTranslationMode(mode) {
  const m = String(mode ?? "").trim().toLowerCase();
  return MODE_VALUES.has(m) ? m : null;
}

/**
 * Full policy decision for a (type, mode, targetLanguage) triple.
 *
 * Throws DocumentTranslationError rather than returning a boolean so that no
 * caller can accidentally continue on a falsy result.
 *
 * @param {{ type: string, mode: unknown, targetLanguage: unknown }} input
 * @returns {{ type: string, mode: string, targetLanguage: string }}
 */
export function assertTranslationRequestAllowed(input) {
  const type = String(input?.type ?? "");
  if (!isTranslatableDocumentType(type)) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TYPE_NOT_TRANSLATABLE, { type });
  }

  const mode = normalizeTranslationMode(input?.mode);
  if (!mode) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.INVALID_MODE);
  }

  const handledElsewhere = MODE_HANDLED_ELSEWHERE.some(
    (r) => r.type === type && r.mode === mode,
  );
  if (handledElsewhere) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.MODE_HANDLED_ELSEWHERE, {
      type,
      mode,
    });
  }

  const targetLanguage = normalizeDocumentTranslationTarget(input?.targetLanguage);
  if (!targetLanguage) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.INVALID_LOCALE);
  }

  return { type, mode, targetLanguage };
}
