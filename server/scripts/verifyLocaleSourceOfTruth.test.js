/**
 * Locale source-of-truth guard.
 *
 * shared/i18n/localeConfig.js is the canonical registry. The server imports it
 * directly; the client keeps a mirrored copy because it is deployed from
 * client/ as the Vercel root directory and cannot reach a repository-root path
 * at build time.
 *
 * A mirrored copy is only safe if something fails loudly when it stops being a
 * mirror. That is this file. It previously would have caught: `he`/`ur` missing
 * server-side, two RTL scripts missing, header locales stuck at ["de","en"],
 * and `ru` absent from the patient/practice UI sets.
 *
 * No database, no network, no environment — pure module comparison.
 */
import test from "node:test";
import assert from "node:assert/strict";

import * as shared from "../../shared/i18n/localeConfig.js";
import * as client from "../../client/src/i18n/localeConfig.js";
import * as serverFacade from "../services/i18n/localeMetadata.js";

/** The languages the product currently ships. Changing this is a product decision. */
const SHIPPED_UI_LANGUAGES = ["de", "en", "fr", "es", "it", "ru"];

/* ------------------------------------------------------ shared ↔ client */

test("client mirrors the shared LOCALE_OPTIONS registry exactly", () => {
  assert.deepEqual(
    client.LOCALE_OPTIONS,
    shared.LOCALE_OPTIONS,
    "client/src/i18n/localeConfig.js drifted from shared/i18n/localeConfig.js — mirror it",
  );
});

test("client mirrors the shared RTL script list", () => {
  assert.deepEqual(client.RTL_LANGUAGE_CODES, shared.RTL_LANGUAGE_CODES);
});

test("client mirrors the shared selectable-locale sets", () => {
  assert.deepEqual(
    client.UI_SELECTABLE_LOCALE_CODES,
    shared.UI_SELECTABLE_LOCALE_CODES,
  );
  assert.deepEqual(
    client.HEADER_SELECTABLE_LOCALE_CODES,
    shared.HEADER_SELECTABLE_LOCALE_CODES,
  );
  assert.deepEqual(
    client.PATIENT_UI_SELECTABLE_LOCALE_CODES,
    shared.PATIENT_UI_SELECTABLE_LOCALE_CODES,
  );
  assert.deepEqual(
    client.PRACTICE_UI_SELECTABLE_LOCALE_CODES,
    shared.PRACTICE_UI_SELECTABLE_LOCALE_CODES,
  );
  assert.deepEqual(
    client.LANDING_SELECTABLE_LOCALE_CODES,
    shared.LANDING_SELECTABLE_LOCALE_CODES,
  );
});

test("client mirrors the shared Pre-Visit target set", () => {
  assert.deepEqual(
    client.PRE_VISIT_SELECTABLE_LOCALE_CODES,
    shared.PRE_VISIT_SELECTABLE_LOCALE_CODES,
  );
});

test("client and shared agree on supported language codes", () => {
  assert.deepEqual(
    client.SUPPORTED_LANGUAGE_CODES,
    shared.SUPPORTED_LANGUAGE_CODES,
  );
});

/* ------------------------------------------------------ shared ↔ server */

test("the server facade re-exports the shared registry, not a copy", () => {
  // Identity, not equality: a re-export yields the same array reference.
  // A hand-maintained copy would be a different object and fail here even if
  // its contents happened to match today.
  assert.equal(serverFacade.LOCALE_OPTIONS, shared.LOCALE_OPTIONS);
  assert.equal(serverFacade.RTL_LANGUAGE_CODES, shared.RTL_LANGUAGE_CODES);
  assert.equal(
    serverFacade.UI_SELECTABLE_LOCALE_CODES,
    shared.UI_SELECTABLE_LOCALE_CODES,
  );
  assert.equal(
    serverFacade.DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES,
    shared.DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES,
  );
});

test("the server no longer under-reports the shipped UI languages", () => {
  // Regression guard for the concrete pre-2A drift.
  for (const code of SHIPPED_UI_LANGUAGES) {
    assert.ok(
      serverFacade.PATIENT_UI_SELECTABLE_LOCALE_CODES.includes(code),
      `${code} missing from server PATIENT_UI_SELECTABLE_LOCALE_CODES`,
    );
    assert.ok(
      serverFacade.UI_FULLY_SUPPORTED_LOCALE_CODES.includes(code),
      `${code} missing from server UI_FULLY_SUPPORTED_LOCALE_CODES`,
    );
  }
  assert.ok(
    serverFacade.HEADER_SELECTABLE_LOCALE_CODES.length > 2,
    "header locales are back down to the stale two-language list",
  );
});

/* ------------------------------------------- document translation targets */

test("translation targets are derived, not a second hand-maintained list", () => {
  // Reference identity proves derivation. If someone replaces the derivation
  // with a literal array that happens to match, this fails — which is the point.
  assert.equal(
    shared.DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES,
    shared.UI_SELECTABLE_LOCALE_CODES,
  );
  assert.equal(
    client.DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES,
    client.UI_SELECTABLE_LOCALE_CODES,
  );
});

test("translation targets are exactly the shipped UI languages", () => {
  assert.deepEqual(
    [...shared.DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES].sort(),
    [...SHIPPED_UI_LANGUAGES].sort(),
  );
});

test("every translation target is a registered locale", () => {
  for (const code of shared.DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES) {
    assert.ok(
      shared.isSupportedLanguage(code),
      `${code} is a translation target but not in LOCALE_OPTIONS`,
    );
  }
});

test("registered-but-disabled languages are rejected as translation targets", () => {
  // The 17 locales that exist in the registry but are not shipped must not be
  // reachable just because their code is known.
  const disabled = shared.SUPPORTED_LANGUAGE_CODES.filter(
    (c) => !shared.DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES.includes(c),
  );
  assert.ok(disabled.length > 0, "fixture assumption: some locales are disabled");
  for (const code of disabled) {
    assert.equal(
      shared.normalizeDocumentTranslationTarget(code),
      null,
      `disabled locale ${code} was accepted as a translation target`,
    );
  }
});

test("normalizeDocumentTranslationTarget is deny-by-default", () => {
  // Padding and case ARE normalised on purpose (asserted in the next test),
  // so they are not listed here — only inputs that must never resolve to a
  // locale. "tr"/"ar" are registered but unshipped: knowing a code must not
  // make it selectable.
  for (const bad of [
    undefined, null, "", "   ", "xx", "de-DE-x-hack", "../../etc/passwd",
    "de;DROP", "de en", "de,en", "tr", "ar", 42, {}, [],
  ]) {
    assert.equal(
      shared.normalizeDocumentTranslationTarget(bad),
      null,
      `unexpected acceptance of ${JSON.stringify(bad)}`,
    );
  }
});

test("normalizeDocumentTranslationTarget normalises case and whitespace", () => {
  assert.equal(shared.normalizeDocumentTranslationTarget("DE"), "de");
  assert.equal(shared.normalizeDocumentTranslationTarget(" ru "), "ru");
  assert.equal(shared.normalizeDocumentTranslationTarget("Fr"), "fr");
});

/* ------------------------------------------------------------ invariants */

test("locale codes are unique and lowercase", () => {
  const codes = shared.SUPPORTED_LANGUAGE_CODES;
  assert.equal(new Set(codes).size, codes.length, "duplicate locale code");
  for (const c of codes) assert.equal(c, c.toLowerCase());
});

test("every RTL code is a registered locale", () => {
  for (const c of shared.RTL_LANGUAGE_CODES) {
    assert.ok(shared.isSupportedLanguage(c), `RTL code ${c} is not registered`);
  }
});

test("every Pre-Visit target is a registered locale", () => {
  for (const c of shared.PRE_VISIT_SELECTABLE_LOCALE_CODES) {
    assert.ok(shared.isSupportedLanguage(c), `Pre-Visit target ${c} is not registered`);
  }
});
