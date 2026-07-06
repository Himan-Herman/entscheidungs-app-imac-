const SUPPORTED_PLACE_LANGUAGES = new Set([
  "de",
  "en",
  "fr",
  "es",
  "it",
  "ru",
  "tr",
  "ar",
  "uk",
  "pl",
]);

export function normalizePlacesLanguage(value) {
  const code = String(value || "en").trim().toLowerCase();
  return SUPPORTED_PLACE_LANGUAGES.has(code) ? code : "en";
}
