/**
 * Five-language completeness for the exit/closure/deletion-request UI.
 *
 * fr/it/es are override bundles deep-merged over an en+de base, so a missing
 * key does not fail — it silently falls back to English. A warning about an
 * irreversible account deletion must never appear half-translated, so every
 * key of the lifecycleExit namespace must exist in all five languages, no
 * value may be empty, and the confirmation phrase must be localized.
 *
 * Run: node --test src/i18n/__tests__/lifecycleExitI18n.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import de from "../translations/de/lifecycleExit.js";
import en from "../translations/en/lifecycleExit.js";
import { frLifecycleExit } from "../translations/overrides/fr/fr.lifecycleExit.js";
import { itLifecycleExit } from "../translations/overrides/it/it.lifecycleExit.js";
import { esLifecycleExit } from "../translations/overrides/es/es.lifecycleExit.js";

const BUNDLES = { de, en, fr: frLifecycleExit, it: itLifecycleExit, es: esLifecycleExit };
const LANGS = Object.keys(BUNDLES);

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, path));
    else out[path] = v;
  }
  return out;
}

const flat = Object.fromEntries(LANGS.map((l) => [l, flatten(BUNDLES[l])]));
const deKeys = Object.keys(flat.de).sort();

test("every language carries every key of the German master", () => {
  for (const lang of LANGS) {
    const missing = deKeys.filter((k) => !(k in flat[lang]));
    assert.deepEqual(missing, [], `${lang} is missing: ${missing.join(", ")}`);
  }
});

test("no language carries stray keys absent from the German master", () => {
  for (const lang of LANGS) {
    const stray = Object.keys(flat[lang]).filter((k) => !deKeys.includes(k));
    assert.deepEqual(stray, [], `${lang} has stray keys: ${stray.join(", ")}`);
  }
});

test("no value is empty and list keys stay arrays of equal length", () => {
  for (const lang of LANGS) {
    for (const [k, v] of Object.entries(flat[lang])) {
      if (Array.isArray(v)) {
        assert.equal(v.length, flat.de[k].length, `${lang}:${k} array length differs`);
        for (const item of v) assert.ok(String(item).trim(), `${lang}:${k} has empty item`);
      } else {
        assert.ok(String(v).trim(), `${lang}:${k} is empty`);
      }
    }
  }
});

test("the confirmation phrase is localized — never the English fallback in fr/it/es", () => {
  const phrases = Object.fromEntries(LANGS.map((l) => [l, flat[l]["patient.phraseExpected"]]));
  assert.equal(phrases.de, "MEIN KONTO ENDGÜLTIG LÖSCHEN");
  const unique = new Set(Object.values(phrases));
  assert.equal(unique.size, LANGS.length, "confirmation phrases must differ per language");
});

test("fr/it/es texts are not verbatim English (fallback leak check on long keys)", () => {
  const LONG_KEYS = [
    "patient.dangerIntro", "patient.dialogWarning", "patient.checkboxLabel",
    "practice.sectionIntro", "practice.deleteWarning", "practice.mailBody",
    "practice.statusBanner.deletion_requested",
  ];
  for (const lang of ["fr", "it", "es"]) {
    for (const k of LONG_KEYS) {
      assert.notEqual(flat[lang][k], flat.en[k], `${lang}:${k} equals the English text`);
      assert.notEqual(flat[lang][k], flat.de[k], `${lang}:${k} equals the German text`);
    }
  }
});

test("mail templates keep their placeholders in every language", () => {
  for (const lang of LANGS) {
    for (const ph of ["{requestId}"]) {
      assert.ok(flat[lang]["practice.mailSubject"].includes(ph), `${lang} mailSubject lacks ${ph}`);
    }
    for (const ph of ["{practiceName}", "{requestId}", "{ownerEmail}", "{ownerName}"]) {
      assert.ok(flat[lang]["practice.mailBody"].includes(ph), `${lang} mailBody lacks ${ph}`);
    }
    assert.ok(flat[lang]["patient.successBody"].includes("{caseNumber}"), `${lang} successBody lacks {caseNumber}`);
    assert.ok(flat[lang]["practice.afterRequestBody"].includes("{caseNumber}"), `${lang} afterRequestBody lacks {caseNumber}`);
    assert.ok(flat[lang]["practice.emailConfirmHint"].includes("{supportEmail}"), `${lang} emailConfirmHint lacks {supportEmail}`);
  }
});

test("all server error codes are mapped in every language", () => {
  const CODES = [
    "practice_lifecycle_transition_invalid", "practice_owner_required",
    "practice_already_suspended", "practice_already_closed",
    "reactivation_already_requested", "deletion_already_requested",
    "confirmation_required", "unsupported_field", "email_delivery_pending",
    "practice_deletion_locked", "generic",
  ];
  for (const lang of LANGS) {
    for (const code of CODES) {
      assert.ok(flat[lang][`practice.errors.${code}`], `${lang} lacks error mapping ${code}`);
    }
  }
});
