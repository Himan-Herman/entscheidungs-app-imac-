/**
 * Meda introduction copy keyed by patient language (Step 1 — DE/EN primary; FR/ES/IT placeholders).
 * @param {string} patientLanguageCode
 * @param {{ medaIntro: Record<string, string> }} t
 */
export function getMedaIntroText(patientLanguageCode, t) {
  const code = (patientLanguageCode || "de").toLowerCase();
  const intro = t.medaIntro || {};
  return intro[code] || intro.en || intro.de || "";
}
