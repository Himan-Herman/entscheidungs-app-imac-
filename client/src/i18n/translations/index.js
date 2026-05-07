import { deepMerge } from "../deepMerge.js";
import en from "./en/index.js";
import de from "./de/index.js";
import frOverrides from "./overrides/fr.js";
import esOverrides from "./overrides/es.js";
import itOverrides from "./overrides/it.js";

const bundles = {
  en,
  de,
  fr: deepMerge(en, frOverrides),
  es: deepMerge(en, esOverrides),
  it: deepMerge(en, itOverrides),
};

/**
 * Full message tree for a locale. Unknown codes fall back to English.
 */
export function getMessages(lang) {
  const code =
    typeof lang === "string" ? lang.toLowerCase() : "en";
  return bundles[code] ?? en;
}

export { bundles };
