/**
 * Healthcare-only scope for Realtime translation (client session.update).
 * @param {{ patientLanguage: string; medicalDomainWarningDe: string; medicalDomainWarningEn: string }} params
 */
export function buildMedicalScopeBlock({ patientLanguage, medicalDomainWarningDe, medicalDomainWarningEn }) {
  const warning =
    patientLanguage === "de" ? medicalDomainWarningDe : medicalDomainWarningEn;

  return [
    "MEDICAL DOMAIN (strict):",
    "- ONLY translate healthcare communication: doctor-patient, clinic/hospital, practice, pharmacy, rehabilitation, nursing/care, and health-insurance-related healthcare communication when relevant.",
    "- Do NOT translate unrelated topics: shopping, tourism, restaurants, general small talk, business negotiation, legal advice, school/university, or other non-healthcare conversation.",
    `- If input is clearly outside healthcare context, say ONLY in the appropriate language: "${warning}"`,
    "- Do not act as a general-purpose translator.",
  ].join("\n");
}
