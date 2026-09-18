/**
 * First-visit language follows the visitor's location; a header choice wins.
 *
 * Run: node --test client/src/i18n/__tests__/locationLanguage.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  baseLanguage,
  countryFromTimeZone,
  detectLocationLanguage,
} from "../location/detectLocationLanguage.js";
import { COUNTRY_LANGUAGES } from "../location/countryLanguages.js";
import { TIME_ZONE_COUNTRY } from "../location/timeZoneCountries.js";
import {
  HEADER_SELECTABLE_LOCALE_CODES,
  LOCALE_OPTIONS,
  resolveInitialLanguage,
} from "../localeConfig.js";

const OFFERED = HEADER_SELECTABLE_LOCALE_CODES;

function detect(timeZone, browserLanguages = [], selectableCodes = OFFERED) {
  return detectLocationLanguage({ timeZone, browserLanguages, selectableCodes })
    .language;
}

/* ------------------------------------------------------------ the brief */

test("English-speaking countries get English, whatever the browser says", () => {
  for (const tz of [
    "America/New_York",
    "America/Los_Angeles",
    "Pacific/Honolulu",
    "Europe/London",
    "Australia/Sydney",
    "Australia/Perth",
    "America/Toronto",
    "America/Vancouver",
    "Asia/Kolkata",
    "Asia/Calcutta", // Chrome's spelling of the same zone
    "Pacific/Auckland",
    "Europe/Dublin",
  ]) {
    assert.equal(detect(tz, ["en-US"]), "en", tz);
    assert.equal(detect(tz, ["de-DE"]), "en", `${tz} with a German browser`);
  }
});

test("Scandinavia gets English while its languages are not offered", () => {
  for (const [tz, browser] of [
    ["Europe/Stockholm", "sv-SE"],
    ["Europe/Oslo", "nb-NO"],
    ["Europe/Copenhagen", "da-DK"],
    ["Europe/Helsinki", "fi-FI"],
    ["Atlantic/Reykjavik", "is-IS"],
  ]) {
    assert.equal(detect(tz, [browser]), "en", tz);
  }
});

test("Germany gets German, even with an English or Russian browser", () => {
  assert.equal(detect("Europe/Berlin", ["de-DE"]), "de");
  assert.equal(detect("Europe/Berlin", ["en-US"]), "de");
  assert.equal(detect("Europe/Berlin", ["ru-RU"]), "de");
  assert.equal(detect("Europe/Busingen", ["en-US"]), "de");
  assert.equal(detect("Europe/Vienna", ["en-US"]), "de");
});

test("each offered language is picked in its own countries", () => {
  assert.equal(detect("Europe/Paris", ["en-US"]), "fr");
  assert.equal(detect("Europe/Madrid", ["en-US"]), "es");
  assert.equal(detect("America/Mexico_City", ["en-US"]), "es");
  assert.equal(detect("America/Argentina/Buenos_Aires"), "es");
  assert.equal(detect("America/Buenos_Aires"), "es");
  assert.equal(detect("Europe/Rome", ["en-US"]), "it");
  assert.equal(detect("Europe/Moscow", ["en-US"]), "ru");
});

test("a country's other official language wins only with a matching browser", () => {
  assert.equal(detect("Europe/Zurich", ["en-US"]), "de");
  assert.equal(detect("Europe/Zurich", ["fr-CH"]), "fr");
  assert.equal(detect("Europe/Zurich", ["it-CH", "de-CH"]), "it");
  assert.equal(detect("America/Toronto", ["fr-CA"]), "fr");
  assert.equal(detect("Europe/Brussels", ["en-US"]), "en", "Dutch not offered yet");
  assert.equal(detect("Europe/Brussels", ["fr-BE"]), "fr");
  assert.equal(detect("Europe/Minsk", ["ru-RU"]), "ru");
  assert.equal(detect("Europe/Minsk", ["en-US"]), "en");
});

test("everywhere else falls back to English", () => {
  for (const tz of [
    "Europe/Istanbul",
    "Asia/Tehran",
    "Asia/Baghdad",
    "Asia/Tokyo",
    "America/Sao_Paulo",
    "Europe/Warsaw",
    "Europe/Kyiv",
    "Europe/Kiev",
  ]) {
    assert.equal(detect(tz, ["en-US"]), "en", tz);
  }
});

/* ------------------------------------------------ later activations */

test("a language activated later switches its countries automatically", () => {
  const later = [...OFFERED, "fa", "ckb", "ar", "tr", "sv"];
  assert.equal(detect("Asia/Tehran", ["en-US"], later), "fa");
  assert.equal(detect("Asia/Kabul", ["en-US"], later), "fa");
  assert.equal(detect("Asia/Baghdad", ["en-US"], later), "ar");
  assert.equal(detect("Asia/Baghdad", ["ckb-IQ"], later), "ckb");
  assert.equal(detect("Asia/Riyadh", ["en-US"], later), "ar");
  assert.equal(detect("Africa/Cairo", ["en-US"], later), "ar");
  assert.equal(detect("Europe/Istanbul", ["en-US"], later), "tr");
  assert.equal(detect("Europe/Stockholm", ["en-US"], later), "sv");
  // …and never leaks into a country that does not speak it.
  assert.equal(detect("Europe/Berlin", ["fa-IR"], later), "de");
  assert.equal(detect("America/New_York", ["ar-SA"], later), "en");
});

test("every registry language is reachable from at least one country", () => {
  const listed = new Set(Object.values(COUNTRY_LANGUAGES).flat());
  const unreachable = LOCALE_OPTIONS.map((o) => o.code).filter(
    (code) => !listed.has(code),
  );
  assert.deepEqual(
    unreachable,
    [],
    "activating these would not switch any country — add them to countryLanguages.js",
  );
});

/* ---------------------------------------------------------- fallbacks */

test("without a usable zone the browser language decides, else English", () => {
  assert.equal(detect("UTC", ["de-DE"]), "de");
  assert.equal(detect("Etc/UTC", ["fr-FR"]), "fr");
  assert.equal(detect(null, ["it-IT"]), "it");
  assert.equal(detect(undefined, ["ja-JP", "es-ES"]), "es");
  assert.equal(detect("Not/AZone", ["ja-JP"]), "en");
  assert.equal(detect("UTC", []), "en");
  assert.equal(detect("UTC", ["tr-TR"]), "en", "tr is in the registry but not offered");
});

test("source says where the language came from", () => {
  const run = (timeZone, browserLanguages) =>
    detectLocationLanguage({ timeZone, browserLanguages, selectableCodes: OFFERED })
      .source;
  assert.equal(run("Europe/Berlin", ["en-US"]), "location");
  assert.equal(run("UTC", ["de-DE"]), "browser");
  assert.equal(run("UTC", ["ja-JP"]), "default");
});

test("browser tags are normalised", () => {
  assert.equal(baseLanguage("de-AT"), "de");
  assert.equal(baseLanguage("pt_BR"), "pt");
  assert.equal(baseLanguage("iw"), "he");
  assert.equal(baseLanguage("no-NO"), "nb");
  assert.equal(baseLanguage("ckb-IQ"), "ckb");
  assert.equal(baseLanguage(""), "");
  assert.equal(baseLanguage("*"), "");
});

/* --------------------------------------------------------- data shape */

test("every time zone the runtime knows maps to a country", () => {
  const missing = Intl.supportedValuesOf("timeZone").filter(
    (tz) => !/^(Etc\/|UTC$)/.test(tz) && countryFromTimeZone(tz) == null,
  );
  assert.deepEqual(missing, []);
});

test("the two tables cover the same countries", () => {
  const zoneCountries = new Set(Object.values(TIME_ZONE_COUNTRY));
  const languageCountries = new Set(Object.keys(COUNTRY_LANGUAGES));
  assert.deepEqual(
    [...zoneCountries].filter((c) => !languageCountries.has(c)),
    [],
    "countries with a zone but no language row",
  );
  assert.deepEqual(
    [...languageCountries].filter((c) => !zoneCountries.has(c)),
    [],
    "language rows no zone can reach",
  );
});

test("language codes are plain BCP-47 base languages", () => {
  for (const [country, codes] of Object.entries(COUNTRY_LANGUAGES)) {
    assert.ok(codes.length > 0, country);
    for (const code of codes) assert.match(code, /^[a-z]{2,3}$/, country);
    assert.equal(new Set(codes).size, codes.length, `${country} repeats a code`);
  }
});

test("zone lookups cannot hit Object.prototype", () => {
  assert.equal(countryFromTimeZone("constructor"), null);
  assert.equal(countryFromTimeZone("__proto__"), null);
});

/* ------------------------------------------------- startup resolution */

const BERLIN_EN = {
  timeZone: "Europe/Berlin",
  navigatorLanguage: "en-US",
  navigatorLanguages: ["en-US", "en"],
};

test("a header choice beats the location, wherever the user is", () => {
  assert.deepEqual(
    resolveInitialLanguage({ ...BERLIN_EN, stored: "en", storedSource: "manual" }),
    { language: "en", source: "manual" },
  );
  assert.deepEqual(
    resolveInitialLanguage({
      timeZone: "America/New_York",
      navigatorLanguage: "en-US",
      navigatorLanguages: ["en-US"],
      stored: "de",
      storedSource: "manual",
    }),
    { language: "de", source: "manual" },
  );
});

test("nothing stored -> location", () => {
  assert.deepEqual(
    resolveInitialLanguage({ ...BERLIN_EN, stored: null, storedSource: null }),
    { language: "de", source: "location" },
  );
});

test("an old automatic value is re-detected, an old header choice is kept", () => {
  // The old code stored the browser language on its own: "en" for an en-US
  // browser. That was never a choice, so Berlin now shows German.
  assert.equal(
    resolveInitialLanguage({ ...BERLIN_EN, stored: "en", storedSource: null }).language,
    "de",
  );
  // "ru" with an en-US browser can only have come from the header picker.
  assert.deepEqual(
    resolveInitialLanguage({ ...BERLIN_EN, stored: "ru", storedSource: null }),
    { language: "ru", source: "manual" },
  );
});

test("a stored language the header no longer offers is ignored", () => {
  assert.equal(
    resolveInitialLanguage({ ...BERLIN_EN, stored: "tr", storedSource: "manual" }).language,
    "de",
  );
  assert.equal(
    resolveInitialLanguage({ ...BERLIN_EN, stored: "xx", storedSource: "manual" }).language,
    "de",
  );
});
