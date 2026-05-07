import { deepMerge } from "../deepMerge.js";
import en from "./en/index.js";
import de from "./de/index.js";
import frOverrides from "./overrides/fr.js";
import esOverrides from "./overrides/es.js";
import itOverrides from "./overrides/it.js";
import ptOverrides from "./overrides/pt.js";
import ruOverrides from "./overrides/ru.js";
import trOverrides from "./overrides/tr.js";
import ukOverrides from "./overrides/uk.js";
import arOverrides from "./overrides/ar.js";
import faOverrides from "./overrides/fa.js";
import plOverrides from "./overrides/pl.js";
import roOverrides from "./overrides/ro.js";
import nlOverrides from "./overrides/nl.js";
import ckbOverrides from "./overrides/ckb.js";
import kuOverrides from "./overrides/ku.js";

const bundles = {
  en,
  de,
  fr: deepMerge(en, frOverrides),
  es: deepMerge(en, esOverrides),
  it: deepMerge(en, itOverrides),
  pt: deepMerge(en, ptOverrides),
  ru: deepMerge(en, ruOverrides),
  tr: deepMerge(en, trOverrides),
  uk: deepMerge(en, ukOverrides),
  ar: deepMerge(en, arOverrides),
  fa: deepMerge(en, faOverrides),
  pl: deepMerge(en, plOverrides),
  ro: deepMerge(en, roOverrides),
  nl: deepMerge(en, nlOverrides),
  ckb: deepMerge(en, ckbOverrides),
  ku: deepMerge(en, kuOverrides),
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
