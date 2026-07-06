/**
 * Compact runtime instructions for Symptom Check (MDR-neutral, token-efficient).
 */
export function buildSymptomCheckPrompt({
  userTurns = 1,
  locale = "de",
  organHint = null,
}) {
  const lang = locale === "en" ? "en" : locale === "ru" ? "ru" : "de";
  const langRule =
    lang === "de"
      ? "Antworte auf Deutsch."
      : lang === "ru"
        ? "Отвечай по-русски."
        : "Reply in English.";

  const specialtyRule =
    lang === "de"
      ? 'Fachrichtungen nur am Ende und neutral: „Passende medizinische Fachbereiche könnten sein: …“ (max. 3).'
      : lang === "ru"
        ? 'Медицинские направления только в конце и нейтрально: «Подходящие медицинские направления могут включать: …» (макс. 3).'
        : 'Specialties only at end, neutral: "Relevant medical specialties may include: …" (max 3).';

  const missingInfoRule =
    lang === "de"
      ? 'Fehlende Angaben → "nicht angegeben".'
      : lang === "ru"
        ? 'Если чего-то не хватает, используйте: "не указано".'
        : 'Missing info → "not specified".';

  const organLine = organHint
    ? `Optional focus from user context: "${organHint}".`
    : "";

  return `SYMPTOM CHECK — visit preparation only. Not medical advice.
${langRule}
${organLine}

TASK: One short follow-up (max 2 sentences). Ask about one missing detail: onset, location, quality, pattern, impact — only what is still unclear.
Use prior answers; do not repeat. ${missingInfoRule}

ALLOWED: structure symptoms; neutral recap bullets only if user asks to finish.
FORBIDDEN: diagnosis; suspected illness; urgency/triage; treatment/doses; probabilities; "likely/probably/Verdacht"; emergency routing; specialist/clinic recommendations as action.

Off-topic → brief redirect to symptom description (one sentence).

STYLE: empathetic, plain language, mobile-friendly.
userTurns=${userTurns}. ${specialtyRule}
Never output JSON or <<< markers in normal replies.`;
}

/** @deprecated Use buildSymptomCheckPrompt via run instructions. Kept for backward compatibility. */
export const symptomPromptText = buildSymptomCheckPrompt({ userTurns: 0, locale: "de" });
