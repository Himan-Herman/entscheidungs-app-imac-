/**
 * Live translation output guard (client-side).
 * Aligns with server MEDICAL_INTERPRETER / aiSafetyPolicy — translation must not become medical advice.
 */

const FORBIDDEN_PATTERNS = [
  /\bdiagnos(e|is|es|ed|ing)\b/i,
  /\bDIAGNOSE\b/,
  /\btriage\b/i,
  /\burgent(ly)?\b/i,
  /\bemergency\s+(room|care)?\b/i,
  /\bNotaufnahme\b/i,
  /\bsofort (zu|einen|einer|zum|zur) (Notfall|Arzt|Ärztin|Klinik)\b/i,
  /\byou should (take|see|start|go)\b/i,
  /\bich empfehle\b/i,
  /\b(prescribe|verschreiben)\b/i,
  /\bsee (a )?(cardiologist|neurologist|specialist)\b/i,
  /\b(kardiologen|facharzt|neurologen)\b/i,
  /\bmay indicate\b/i,
  /\bcould indicate\b/i,
  /\blikely\s+(diagnosis|disease|condition)\b/i,
  /\bwahrscheinlich(e)?\s+(Diagnose|Erkrankung)\b/i,
  /\bhigh risk\b/i,
  /\bclinical certainty\b/i,
  /\byou (likely|probably) have\b/i,
  /\bSie haben (wahrscheinlich|vermutlich)\b/i,
];

/**
 * @param {string} text
 */
export function isUnsafeTranslationOutput(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return false;
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(normalized));
}
