/**
 * Block session titles that imply diagnosis, triage, treatment, urgency, or routing.
 * Communication-only naming (Phase 2.5).
 */

const UNSAFE_TITLE_PATTERNS = [
  /\bdiagnos(e|is|ed|ing)\b/i,
  /\bDIAGNOSE\b/,
  /\bverdacht\b/i,
  /\bsuspected\b/i,
  /\bnotfall\b/i,
  /\bemergency\b/i,
  /\burgent\b/i,
  /\btriage\b/i,
  /\bmigrän/i,
  /\bcancer\b/i,
  /\bkrebs\b/i,
  /\bbrustschmerz/i,
  /\bchest pain\b/i,
  /\b(empfohlen|recommend).*(kardiolog|specialist|facharzt)/i,
  /\b(see|visit)\s+(a\s+)?(cardiologist|specialist)/i,
  /\bbehandlung\s+empfohlen/i,
  /\btreatment\s+recommended\b/i,
  /\bmedikament(en)?\s+empfehl/i,
  /\bprescri(be|ption)\b/i,
];

/**
 * @param {string} title
 */
export function isUnsafeSessionTitle(title) {
  const s = String(title || "").trim();
  if (!s) return false;
  return UNSAFE_TITLE_PATTERNS.some((re) => re.test(s));
}

/**
 * @param {string} title
 * @returns {string}
 */
export function sanitizeSessionTitleForStorage(title) {
  const s = String(title || "").trim().slice(0, 200);
  if (!s || isUnsafeSessionTitle(s)) return "";
  return s;
}
