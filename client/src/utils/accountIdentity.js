/**
 * Local, dependency-free helpers for the header account avatar.
 *
 * Goal: turn a patient or practice display name into short, readable initials
 * for the avatar — normalizing accents/diacritics to Latin/English-style
 * characters where possible, with a robust deterministic fallback for
 * non-Latin scripts. No external API, no network, fully predictable.
 *
 * The full display name is always shown verbatim (accents preserved) in the
 * dropdown; only the avatar initials are normalized.
 */

/**
 * Honorific / title tokens that should not contribute an initial when other
 * name parts exist — e.g. "Praxis Dr. Müller Schmidt Kaya" → "PMSK" (no "D").
 * Compared lowercase, after punctuation has been stripped.
 */
const TITLE_TOKENS = new Set([
  "dr",
  "prof",
  "med",
  "dipl",
  "phd",
  "mr",
  "mrs",
  "ms",
  "mme",
  "mlle",
  "sr",
  "sra",
  "dra",
  "herr",
  "frau",
]);

/**
 * Decompose accents/diacritics and strip combining marks so accented Latin
 * letters collapse to their base form ("José" → "Jose", "Müller" → "Muller").
 * Non-Latin scripts (Arabic, CJK, Cyrillic, …) are left untouched here and
 * filtered out later by the A–Z guard.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeForInitials(value) {
  const str = typeof value === "string" ? value : value == null ? "" : String(value);
  return str
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .replace(/ß/g, "ss") // ß
    .replace(/ø/gi, "o") // ø
    .replace(/æ/gi, "ae") // æ
    .replace(/œ/gi, "oe") // œ
    .replace(/đ/gi, "d") // đ
    .replace(/ł/gi, "l"); // ł
}

/**
 * Compute avatar initials from a name.
 *
 * - Splits on whitespace and common separators.
 * - Drops honorific titles when other name parts remain.
 * - Multi-word → first Latin letter of each part (up to `maxChars`).
 * - Single word → first two Latin letters, unless `perWord` is set (then one).
 * - Non-Latin / empty → returns the (optional) `fallback`, else "".
 *
 * @param {unknown} rawName
 * @param {{ maxChars?: number, fallback?: string, perWord?: boolean }} [options]
 * @returns {string} Uppercase initials, or fallback/"" when none can be derived.
 */
export function computeInitials(rawName, options = {}) {
  const maxChars = Number.isFinite(options.maxChars) ? options.maxChars : 2;
  const fallback = typeof options.fallback === "string" ? options.fallback : "";
  const perWord = options.perWord === true;

  const normalized = normalizeForInitials(rawName);
  const tokens = normalized.split(/[\s.,_/\\|·•@&()-]+/).filter(Boolean);

  // Keep only tokens that still contain a Latin letter after normalization.
  let latinTokens = tokens.filter((t) => /[A-Za-z]/.test(t));

  // Prefer non-title tokens, but never drop everything.
  const nonTitle = latinTokens.filter(
    (t) => !TITLE_TOKENS.has(t.replace(/[^A-Za-z]/g, "").toLowerCase()),
  );
  if (nonTitle.length > 0) latinTokens = nonTitle;

  let letters = "";
  if (latinTokens.length === 1 && !perWord) {
    // Legacy single-token form: first two letters ("Düsseldorf" → "DU").
    letters = latinTokens[0].replace(/[^A-Za-z]/g, "").slice(0, Math.min(2, maxChars));
  } else if (latinTokens.length >= 1) {
    // One initial per word ("Himan" → "H", "Müller Schmidt" → "MS").
    letters = latinTokens
      .map((t) => (t.match(/[A-Za-z]/) || [""])[0])
      .join("")
      .slice(0, maxChars);
  }

  const initials = letters.toUpperCase();
  if (initials) return initials;

  return fallback.toUpperCase().slice(0, Math.max(1, maxChars));
}

/**
 * Format raw initials with dots only between letters (no trailing dot):
 * "HK" → "H.K", "H" → "H".
 * @param {string} letters
 */
export function formatDottedInitials(letters) {
  const clean = String(letters || "").replace(/[^A-Za-z]/g, "");
  if (!clean) return "";
  return clean.split("").join(".");
}

/**
 * Build the patient display name from the patient-settings payload.
 * Prefers an explicit displayName, then "First Last", then the email local part.
 *
 * @param {{ firstName?: string, lastName?: string, email?: string }} user
 * @param {{ displayName?: string }} [profile]
 * @returns {string}
 */
export function resolvePatientName(user = {}, profile = {}) {
  const displayName = (profile?.displayName || "").trim();
  if (displayName) return displayName;

  const full = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  if (full) return full;

  const email = (user?.email || "").trim();
  if (email) return email.split("@")[0];

  return "";
}

/**
 * Dotted initials for a patient — first + last initial.
 * "Himan Khorshidi" → "H.K.", single name "Himan" → "H.".
 * Falls back to `fallback` (e.g. role letter) when no Latin letters exist.
 */
export function patientInitials(user = {}, profile = {}, fallback = "") {
  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  const source = fullName || resolvePatientName(user, profile);
  const letters = computeInitials(source, { maxChars: 2, perWord: true });
  return formatDottedInitials(letters) || fallback;
}

/**
 * Dotted initials for a practice — first letter of up to three meaningful
 * name parts, titles ignored. "Praxis Müller Schmidt" → "P.M.S.",
 * "Praxis Dr. Müller Schmidt Kaya" → "P.M.S.". Stays premium and readable.
 */
export function practiceInitials(practiceName, fallback = "") {
  const letters = computeInitials(practiceName, { maxChars: 3, perWord: true });
  return formatDottedInitials(letters) || fallback;
}
