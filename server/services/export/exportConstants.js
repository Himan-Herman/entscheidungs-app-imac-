export const EXPORT_FORMATS = new Set(["pdf", "csv"]);

export const PATIENT_EXPORT_TYPES = new Set([
  "medication_plans",
  "practice_documents_list",
  "profile_sharing",
  "activity",
  "data_requests",
]);

export const PRACTICE_EXPORT_TYPES = new Set([
  "patient_summary",
  "medication_plan",
  "documents_list",
  "activity",
  "data_requests",
]);

export const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

export const PDF_DISCLAIMER_DE =
  "Dieser Export enthält von Patient:in oder Praxis bereitgestellte Informationen. MedScoutX erstellt keine Diagnose, Therapieempfehlung oder medizinische Bewertung.";

export const PDF_DISCLAIMER_EN =
  "This export contains information provided by the patient or practice. MedScoutX does not create diagnoses, treatment recommendations, or medical assessments.";
