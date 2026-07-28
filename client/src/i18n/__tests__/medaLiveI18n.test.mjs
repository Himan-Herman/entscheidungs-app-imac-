/**
 * i18n completeness for the whole Meda Live surface, across all six product
 * languages (de, en, fr, it, es, ru).
 *
 * Important: fr/it/es/ru are NOT namespace directories like de/en — they are
 * override bundles deep-merged over an en+de fallback base. A missing key
 * therefore does not blow up, it silently renders in English. These tests
 * resolve the messages through the REAL merge chain (getMessages), so a silent
 * English fallback is caught.
 *
 * Surfaces covered:
 *   1. medicalInterpreter.realtimePage — the whole /patient|practice/meda-realtime page
 *   2. medicalInterpreter.pdf          — the exported conversation log
 *   3. practiceOverview.cardMedaLive*  — the practice hub tile + info modal
 *   4. patientCardInfo.medaLive*       — the patient hub tile info modal
 *   5. medaRealtimePractice.i18n.js    — practice-only chrome (separate module)
 *   6. medaLiveTranslation.i18n.js     — the /patient/meda-live-translation page
 *
 * Run: node --test client/src/i18n/__tests__/medaLiveI18n.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { getMessages } from "../translations/index.js";
import { UI_SELECTABLE_LOCALE_CODES } from "../localeConfig.js";
import { getPracticeChromeMessages } from "../../features/medaLiveTranslation/realtime/medaRealtimePractice.i18n.js";
import { getMltMessages } from "../../features/medaLiveTranslation/medaLiveTranslation.i18n.js";

const LANGS = ["de", "en", "fr", "it", "es", "ru"];

/**
 * Words that are legitimately spelled the same in the source language and in
 * English, so an equality check against EN is not evidence of a fallback.
 * Keep this list tight — every entry weakens the test.
 */
const SHARED_SPELLINGS = new Set([
  "Meda",
  "Original",
  "Originale",
  "Patient",
  "Paziente",
  "Paciente",
  "Pause",
  "Pausa",
  "Manual",
  "Page",
  "PDF",
  "PDF …",
  "(optional)",
  "optional",
  "medscoutx-interpreter",
  "Meda Live Translation",
  "Meda Live Translation — MedScoutX",
  "practice@example.com",
  "Export", // identical in DE
  "Status", // identical in DE
  "Conversation", // identical in FR
]);

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "function") continue; // formatter helpers, not text
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/**
 * @param {string} label       Human-readable surface name for assertion messages
 * @param {(lang: string) => object} pick  Resolves the sub-tree for one language
 */
function assertTranslated(label, pick) {
  const enFlat = flatten(pick("en"));
  const enKeys = Object.keys(enFlat);
  assert.ok(enKeys.length > 0, `${label}: English source must not be empty`);

  for (const lang of LANGS) {
    if (lang === "en") continue;
    const flat = flatten(pick(lang));

    const missing = enKeys.filter((k) => flat[k] === undefined || flat[k] === "");
    assert.deepEqual(
      missing,
      [],
      `${label}: [${lang}] missing ${missing.length} key(s): ${missing.slice(0, 8).join(", ")}`,
    );

    const fellBack = enKeys.filter(
      (k) =>
        typeof flat[k] === "string" &&
        flat[k] === enFlat[k] &&
        !SHARED_SPELLINGS.has(flat[k].trim()),
    );
    assert.deepEqual(
      fellBack,
      [],
      `${label}: [${lang}] falls back to English for ${fellBack.length} key(s): ${fellBack.slice(0, 8).join(", ")}`,
    );
  }
}

test("realtime page is translated in all six languages", () => {
  assertTranslated(
    "medicalInterpreter.realtimePage",
    (l) => getMessages(l).medicalInterpreter?.realtimePage,
  );
});

test("conversation-log PDF strings are translated in all six languages", () => {
  assertTranslated(
    "medicalInterpreter.pdf",
    (l) => getMessages(l).medicalInterpreter?.pdf,
  );
});

test("practice hub Meda Live tile + info modal are translated", () => {
  assertTranslated("practiceOverview.cardMedaLive*", (l) =>
    Object.fromEntries(
      Object.entries(getMessages(l).practiceOverview || {}).filter(([k]) =>
        k.startsWith("cardMedaLive"),
      ),
    ),
  );
});

test("patient hub Meda Live info modal is translated", () => {
  assertTranslated("patientCardInfo.medaLive*", (l) =>
    Object.fromEntries(
      Object.entries(getMessages(l).patientCardInfo || {}).filter(([k]) =>
        k.startsWith("medaLive"),
      ),
    ),
  );
});

test("practice-only Meda chrome covers every selectable language", () => {
  assertTranslated("medaRealtimePractice", (l) => getPracticeChromeMessages(l));
});

test("Meda Live Translation page covers every selectable language", () => {
  assertTranslated("medaLiveTranslation", (l) => getMltMessages(l));
});

test("practice chrome does not silently fall back for a selectable language", () => {
  // getPracticeChromeMessages() returns the EN object for unknown codes. Assert
  // each selectable language has its OWN entry rather than the shared EN object.
  const en = getPracticeChromeMessages("en");
  for (const lang of UI_SELECTABLE_LOCALE_CODES) {
    if (lang === "en") continue;
    assert.notEqual(
      getPracticeChromeMessages(lang),
      en,
      `practice chrome: [${lang}] has no entry and falls back to the English object`,
    );
  }
});

test("header offers exactly the six supported UI languages", () => {
  assert.deepEqual([...UI_SELECTABLE_LOCALE_CODES].sort(), [...LANGS].sort());
});
