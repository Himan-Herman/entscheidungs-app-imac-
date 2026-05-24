/** Client-side feature flag — tile hidden when not explicitly enabled. */
export function isLiveMedicalTranslationEnabled() {
  const raw = import.meta.env.VITE_LIVE_MEDICAL_TRANSLATION_ENABLED;
  return raw === "true" || raw === "1";
}
