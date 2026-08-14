/**
 * Neutral locale registry — the single source of truth for MedScoutX.
 *
 * This module is deliberately free of client and server concerns: no React, no
 * Express, no Prisma, no environment access, no I/O. It is plain ESM data plus
 * pure functions so that both runtimes can consume it unchanged.
 *
 * ── Consumers ───────────────────────────────────────────────────────────────
 *   server : imports this file directly (see server/services/i18n/localeMetadata.js,
 *            which is now a re-export facade so existing imports keep working).
 *   client : keeps its own copy at client/src/i18n/localeConfig.js. That copy is
 *            NOT free to drift — verifyLocaleSourceOfTruth.test.js compares it
 *            against this file and fails on any divergence.
 *
 * Why the client does not import this file directly: the frontend is deployed
 * from client/ as the Vercel root directory (client/vercel.json), so a
 * repository-root path is outside the client build context. Making the client
 * import it would require changing the deploy Root Directory setting, which
 * lives outside the repository and cannot be verified here. Until that is
 * changed, the drift test — not the module graph — is what binds the two.
 *
 * Tracked as `i18n_single_source_deployment_constraint` in
 * docs/architecture/DOCUMENT_TRANSLATION_TECHNICAL_DEBT.md, with the exact
 * steps to close it.
 *
 * Adding a language: add it to LOCALE_OPTIONS here, mirror it in the client
 * copy, and only add it to UI_SELECTABLE_LOCALE_CODES once its message bundle
 * is actually complete.
 */

/**
 * Right-to-left UI scripts.
 * Kurdish Kurmancî (ku) uses Latin script and stays LTR.
 */
export const RTL_LANGUAGE_CODES = ["ar", "fa", "ckb", "he", "ur"];

/** Scalable locale registry — add entries here when introducing a new language. */
export const LOCALE_OPTIONS = [
  { code: "de", nativeName: "Deutsch" },
  { code: "en", nativeName: "English" },
  { code: "fr", nativeName: "Français" },
  { code: "es", nativeName: "Español" },
  { code: "it", nativeName: "Italiano" },
  { code: "ru", nativeName: "Русский" },
  { code: "uk", nativeName: "Українська" },
  { code: "tr", nativeName: "Türkçe" },
  { code: "pt", nativeName: "Português" },
  { code: "ar", nativeName: "العربية" },
  { code: "fa", nativeName: "فارسی" },
  { code: "pl", nativeName: "Polski" },
  { code: "ro", nativeName: "Română" },
  { code: "nl", nativeName: "Nederlands" },
  { code: "ckb", nativeName: "کوردی (سۆرانی)" },
  { code: "ku", nativeName: "Kurdî (Kurmancî)" },
  { code: "el", nativeName: "Ελληνικά" },
  { code: "sq", nativeName: "Shqip" },
  { code: "hr", nativeName: "Hrvatski" },
  { code: "bs", nativeName: "Bosanski" },
  { code: "sr", nativeName: "Srpski" },
  { code: "he", nativeName: "עברית" },
  { code: "ur", nativeName: "اردو" },
];

export const SUPPORTED_LANGUAGE_CODES = LOCALE_OPTIONS.map((o) => o.code);

/**
 * The languages the product ships as fully selectable. Every other entry in
 * LOCALE_OPTIONS stays visible in the picker but disabled, so users never land
 * in a half-translated interface.
 *
 * THIS is the list that gates activation. Everything user-facing that offers a
 * language choice derives from it rather than restating it.
 */
export const UI_SELECTABLE_LOCALE_CODES = ["de", "en", "fr", "es", "it", "ru"];

/** Header language picker. */
export const HEADER_SELECTABLE_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

/** Public landing page. */
export const LANDING_SELECTABLE_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

/** Patient workspace. */
export const PATIENT_UI_SELECTABLE_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

/** Practice workspace. */
export const PRACTICE_UI_SELECTABLE_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

/**
 * Pre-Visit intake target languages — deliberately NOT the UI locale set.
 * This is the language a patient's pre-visit summary gets translated INTO for
 * the practice, so it keeps its wide reach (incl. RTL scripts) even though the
 * surrounding UI chrome ships in fewer languages.
 */
export const PRE_VISIT_SELECTABLE_LOCALE_CODES = [
  "de", "en", "fr", "es", "it", "tr", "ru", "uk", "pt",
  "ar", "fa", "ckb", "ku", "el", "ro", "pl",
];

/**
 * Target languages for patient-facing document translation.
 *
 * DERIVED, never hand-maintained: a language activated centrally in
 * UI_SELECTABLE_LOCALE_CODES becomes available here automatically, and one
 * removed there disappears here. Restating the codes would recreate exactly the
 * drift this module exists to prevent.
 *
 * Deliberately NOT PRE_VISIT_SELECTABLE_LOCALE_CODES: a translated medical
 * document is read inside the patient UI, so a target language whose interface
 * chrome does not exist would produce a half-translated result page.
 */
export const DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

/**
 * Full set of locales whose UI is considered complete. Kept as a union so that
 * widening any single surface widens this too.
 */
export const UI_FULLY_SUPPORTED_LOCALE_CODES = [
  ...new Set([
    ...HEADER_SELECTABLE_LOCALE_CODES,
    ...PATIENT_UI_SELECTABLE_LOCALE_CODES,
    ...PRACTICE_UI_SELECTABLE_LOCALE_CODES,
  ]),
];

const SUPPORTED = new Set(SUPPORTED_LANGUAGE_CODES);
const DOCUMENT_TRANSLATION_TARGETS = new Set(DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES);

/** @param {string} code */
export function isRtlLanguage(code) {
  return (
    typeof code === "string" && RTL_LANGUAGE_CODES.includes(code.toLowerCase())
  );
}

/** @param {string} code */
export function isSupportedLanguage(code) {
  return typeof code === "string" && SUPPORTED.has(code.toLowerCase());
}

/**
 * Target-language gate for document translation.
 *
 * Registered-but-disabled languages are rejected here as firmly as unknown
 * ones: being present in LOCALE_OPTIONS means the code exists, not that the
 * product ships it.
 *
 * @param {string} code
 * @returns {string | null} the normalised code, or null if not selectable
 */
export function normalizeDocumentTranslationTarget(code) {
  const c = String(code || "").trim().toLowerCase();
  if (!c) return null;
  return DOCUMENT_TRANSLATION_TARGETS.has(c) ? c : null;
}
