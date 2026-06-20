import enLanding from "./en/landing.js";
import deLanding from "./de/landing.js";
import { getMessages } from "./index.js";

const ARRAY_KEYS = new Set([
  "forWhom",
  "howSteps",
  "patientPoints",
  "practicePoints",
  "spotlightList",
  "moduleMapItems",
  "journeyChartBars",
  "journeyChartDonut",
  "journeyChartTags",
  "journeyFeatureCloud",
]);

/**
 * Landing copy with fallback: selected locale → English → German.
 */
export function resolveLanding(lang) {
  const primary = getMessages(lang).landing;
  return mergeLandingFallback(primary, enLanding, deLanding);
}

function mergeLandingFallback(primary, en, de) {
  const keys = new Set([
    ...Object.keys(en),
    ...Object.keys(de),
    ...(primary ? Object.keys(primary) : []),
  ]);
  const out = {};
  for (const k of keys) {
    if (ARRAY_KEYS.has(k)) {
      const pe = primary?.[k];
      const ee = en[k];
      const dd = de[k];
      const len = Math.max(
        Array.isArray(pe) ? pe.length : 0,
        Array.isArray(ee) ? ee.length : 0,
        Array.isArray(dd) ? dd.length : 0,
      );
      out[k] = [];
      for (let i = 0; i < len; i++) {
        out[k].push(pe?.[i] ?? ee?.[i] ?? dd?.[i] ?? "");
      }
    } else {
      out[k] = primary?.[k] ?? en[k] ?? de[k];
    }
  }
  return out;
}
