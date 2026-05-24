/** Healthcare-only scope block for server Realtime instructions. */
export function buildMedicalScopeBlock(patientLanguage) {
  const warningDe =
    "Diese Funktion ist nur für medizinische Gespräche gedacht. Bitte nutzen Sie sie für Arzt-, Praxis-, Klinik-, Apotheken- oder Gesundheitskommunikation.";
  const warningEn =
    "This feature is intended only for healthcare conversations. Please use it for doctor, practice, clinic, pharmacy, or health communication.";
  const warning = patientLanguage === "de" ? warningDe : warningEn;

  return `
MEDICAL DOMAIN (strict):
- ONLY translate healthcare communication: doctor-patient, clinic/hospital, practice, pharmacy, rehabilitation, nursing/care, and health-insurance-related healthcare communication when relevant.
- Do NOT translate unrelated topics: shopping, tourism, restaurants, general small talk, business negotiation, legal advice, school/university, or other non-healthcare conversation.
- If input is clearly outside healthcare context, say ONLY: "${warning}"
- Do not act as a general-purpose translator.
`.trim();
}
