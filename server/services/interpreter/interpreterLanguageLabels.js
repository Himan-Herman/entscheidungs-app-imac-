const LANGUAGE_LABELS = {
  ar: "Arabic",
  bs: "Bosnian",
  ckb: "Kurdish (Sorani)",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  fa: "Persian (Farsi)",
  fr: "French",
  hr: "Croatian",
  it: "Italian",
  ku: "Kurdish",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  sq: "Albanian",
  sr: "Serbian",
  tr: "Turkish",
  uk: "Ukrainian",
};

/**
 * @param {string} code
 */
export function describeInterpreterLanguage(code) {
  const normalized = String(code || "").trim().toLowerCase().split("-")[0];
  return LANGUAGE_LABELS[normalized] || normalized || "the requested language";
}
