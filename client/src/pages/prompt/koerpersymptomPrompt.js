import { getRegionQuestionHints } from "../../features/bodyMap/bodyMapRegionHints.js";

/**
 * Compact instructions for body-map chat (visit preparation, MDR-neutral).
 */
export function buildKoerpersymptomPrompt({
  organName,
  userTurns,
  locale = "de",
}) {
  const region =
    typeof organName === "string" && organName.trim()
      ? organName.trim()
      : "marked body region";
  const lang = locale === "en" ? "en" : "de";
  const hints = getRegionQuestionHints(region, lang);

  const langRule =
    lang === "de"
      ? "Antworte auf Deutsch."
      : "Reply in English.";

  const specialtyRule =
    lang === "de"
      ? 'Fachrichtungen nur am Ende und neutral: „Passende medizinische Fachbereiche könnten sein: …“ (max. 3).'
      : 'Specialties only at the end, neutral: "Relevant medical specialties may include: …" (max 3).';

  return `BODY MAP — visit preparation only. Region: "${region}".
${langRule}

TASK: One short follow-up (max 2 sentences). Pick one open point from: ${hints}
Use prior answers; do not repeat answered questions. Missing info → "nicht angegeben" / "not specified".

ALLOWED: structure symptoms; neutral wording; brief bullet recap if user seems done.
FORBIDDEN: diagnosis; suspected illness; urgency/triage; treatment/doses; probabilities; "likely/probably/Verdacht".

Off-topic → redirect to notes for "${region}"; other complaints → Symptom Check (no urgency language).

STYLE: empathetic, plain language, mobile-friendly.
userTurns=${userTurns}. ${specialtyRule}
Never output JSON or <<< markers in normal replies.`;
}
