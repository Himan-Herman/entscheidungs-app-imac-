/**
 * First-visit UI language from the visitor's location.
 *
 * Location = the device's time zone (Intl), mapped to a country on the device.
 * No IP lookup, no geolocation prompt, no third party, nothing stored or sent:
 * the zone and the derived country never leave this function.
 *
 * Rule, in order:
 *   1. Country known, and the browser is set to one of that country's
 *      languages which the header offers -> that language
 *      (French browser in Canada/Switzerland -> fr).
 *   2. Country known, and the header offers the country's main language
 *      -> that language (Germany -> de, Italy -> it, Mexico -> es).
 *   3. Country known, but its language is not offered (yet) -> English
 *      (USA, UK, India, Scandinavia, Türkiye, Iran, ...).
 *   4. No country (UTC, privacy mode, old browser) -> the first browser
 *      language the header offers, else English.
 *
 * `selectableCodes` is passed in rather than imported so that activating a
 * language in the header (UI_SELECTABLE_LOCALE_CODES) is the only switch: the
 * countries of a newly offered language pick it up with no change here.
 */
import { COUNTRY_LANGUAGES } from "./countryLanguages.js";
import { TIME_ZONE_COUNTRY } from "./timeZoneCountries.js";

export const FALLBACK_LANGUAGE = "en";

/** Deprecated ISO 639 codes some browsers still report. */
const LEGACY_LANGUAGE_CODES = Object.freeze({
  iw: "he",
  in: "id",
  ji: "yi",
  no: "nb",
  tl: "fil",
  mo: "ro",
});

/** "de-AT" -> "de", "iw" -> "he"; anything unusable -> "". */
export function baseLanguage(tag) {
  const base = String(tag || "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
  if (!/^[a-z]{2,3}$/.test(base)) return "";
  return LEGACY_LANGUAGE_CODES[base] ?? base;
}

/** @returns {string|null} ISO country code, or null when the zone has none. */
export function countryFromTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone.length === 0) return null;
  // hasOwnProperty, not Object.hasOwn: older iOS WebViews lack the latter.
  return Object.prototype.hasOwnProperty.call(TIME_ZONE_COUNTRY, timeZone)
    ? TIME_ZONE_COUNTRY[timeZone]
    : null;
}

/**
 * @param {object} input
 * @param {string|null|undefined} input.timeZone IANA zone, e.g. from
 *   Intl.DateTimeFormat().resolvedOptions().timeZone
 * @param {readonly string[]|undefined} input.browserLanguages navigator.languages
 * @param {readonly string[]} input.selectableCodes languages the header offers
 * @returns {{ language: string, source: "location"|"browser"|"default" }}
 */
export function detectLocationLanguage({
  timeZone,
  browserLanguages = [],
  selectableCodes,
}) {
  const offered = new Set(selectableCodes);
  const fallback = offered.has(FALLBACK_LANGUAGE)
    ? FALLBACK_LANGUAGE
    : selectableCodes[0];
  const browser = (Array.isArray(browserLanguages) ? browserLanguages : [])
    .map(baseLanguage)
    .filter(Boolean);

  const country = countryFromTimeZone(timeZone);
  const countryLanguages = country ? COUNTRY_LANGUAGES[country] : null;

  if (countryLanguages?.length) {
    const fromBrowser = browser.find(
      (code) => countryLanguages.includes(code) && offered.has(code),
    );
    if (fromBrowser) return { language: fromBrowser, source: "location" };

    const main = countryLanguages[0];
    if (offered.has(main)) return { language: main, source: "location" };

    return { language: fallback, source: "location" };
  }

  const fromBrowser = browser.find((code) => offered.has(code));
  if (fromBrowser) return { language: fromBrowser, source: "browser" };

  return { language: fallback, source: "default" };
}
