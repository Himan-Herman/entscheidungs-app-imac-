/**
 * Final structured summary for Symptom Check (MDR-neutral).
 */
export function buildSymptomCheckSummaryPrompt({ locale = "de" }) {
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

  return `SYMPTOM CHECK — final summary for doctor visit preparation.
${rules}

OUTPUT FORMAT (strict):
1) Max 6 short bullet lines for the patient (readable recap).
2) Then exactly this block (valid JSON):
<<<MEDSCOUTX_SYMPTOM_CHECK_JSON>>>
{"mainComplaints":"...","location":"...","timeline":"...","associatedFactors":"...","symptomSummary":"...","specialties":["..."],"visitTopics":["..."]}
<<<END_MEDSCOUTX_SYMPTOM_CHECK_JSON>>>

Only facts the patient stated. No invented details.`;
}
