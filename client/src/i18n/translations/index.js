import { deepMerge } from "../deepMerge.js";
import { mergeFallbackMessages } from "../mergeFallbackMessages.js";
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
import elOverrides from "./overrides/el.js";
import sqOverrides from "./overrides/sq.js";
import hrOverrides from "./overrides/hr.js";
import bsOverrides from "./overrides/bs.js";
import srOverrides from "./overrides/sr.js";

/**
 * Message fallback: keys prefer English, then German for keys missing from English
 * (selected UI language still wins via per-locale overrides).
 */
const messagesFallbackBase = deepMerge(de, en);

const bundles = {
  en,
  de,
  fr: deepMerge(messagesFallbackBase, frOverrides),
  es: deepMerge(messagesFallbackBase, esOverrides),
  it: deepMerge(messagesFallbackBase, itOverrides),
  pt: deepMerge(messagesFallbackBase, ptOverrides),
  ru: deepMerge(messagesFallbackBase, ruOverrides),
  tr: deepMerge(messagesFallbackBase, trOverrides),
  uk: deepMerge(messagesFallbackBase, ukOverrides),
  ar: deepMerge(messagesFallbackBase, arOverrides),
  fa: deepMerge(messagesFallbackBase, faOverrides),
  pl: deepMerge(messagesFallbackBase, plOverrides),
  ro: deepMerge(messagesFallbackBase, roOverrides),
  nl: deepMerge(messagesFallbackBase, nlOverrides),
  ckb: deepMerge(messagesFallbackBase, ckbOverrides),
  ku: deepMerge(messagesFallbackBase, kuOverrides),
  el: deepMerge(messagesFallbackBase, elOverrides),
  sq: deepMerge(messagesFallbackBase, sqOverrides),
  hr: deepMerge(messagesFallbackBase, hrOverrides),
  bs: deepMerge(messagesFallbackBase, bsOverrides),
  sr: deepMerge(messagesFallbackBase, srOverrides),
};

/**
 * Full message tree for a locale.
 * Fallback per key: selected language → English → German.
 */
export function getMessages(lang) {
  const code =
    typeof lang === "string" ? lang.toLowerCase() : "en";
  const primary = bundles[code] ?? messagesFallbackBase;
  return mergeFallbackMessages(primary, bundles.en, bundles.de);
}

export { bundles };
