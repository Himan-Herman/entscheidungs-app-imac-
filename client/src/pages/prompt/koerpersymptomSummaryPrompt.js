/**
 * Final structured summary for body-map flow (MDR-neutral).
 */
export function buildKoerpersymptomSummaryPrompt({ organName, locale = "de" }) {
  const region =
    typeof organName === "string" && organName.trim()
      ? organName.trim()
      : "marked body region";
  const lang = locale === "en" ? "en" : "de";

  const rules =
    lang === "de"
      ? `Sprache: Deutsch.
Keine Diagnose, Dringlichkeit, Therapie, Wahrscheinlichkeiten.
Fachrichtungen nur: „Passende medizinische Fachbereiche könnten sein: …“ (max. 3).
Fehlende Angaben: „nicht angegeben“.`
      : `Language: English.
No diagnosis, urgency, treatment, or probabilities.
Specialties only: "Relevant medical specialties may include: …" (max 3).
Missing fields: "not specified".`;

  return `BODY MAP — final summary for region "${region}".
${rules}

OUTPUT FORMAT (strict):
1) Max 6 short bullet lines for the patient (readable recap).
2) Then exactly this block (valid JSON):
<<<MEDSCOUTX_BODY_MAP_JSON>>>
{"region":"${region}","symptomSummary":"...","timeline":"...","associatedFactors":"...","specialties":["..."],"visitTopics":["..."]}
<<<END_MEDSCOUTX_BODY_MAP_JSON>>>

Only facts the patient stated. No invented details.`;
}
