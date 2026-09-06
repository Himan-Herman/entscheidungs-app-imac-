/**
 * i18n completeness for the patient-onboarding flow across all six product
 * languages.
 *
 * fr/it/es/ru are NOT namespace directories like de/en — they are override
 * bundles deep-merged over an en→de fallback base. A missing key therefore does
 * not throw, it silently renders in another language, which is exactly the bug
 * this project has already shipped once. These tests resolve through the REAL
 * merge chain (getMessages), so a silent fallthrough is caught.
 *
 * Run: node --test client/src/i18n/__tests__/patientOnboardingI18n.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { getMessages } from "../translations/index.js";
import deOnboarding from "../translations/de/patientOnboarding.js";

const LANGS = ["de", "en", "fr", "it", "es", "ru"];

/** Every leaf path in a message tree. */
function leaves(obj, prefix = "") {
  return Object.entries(obj || {}).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? leaves(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}
const at = (obj, path) => path.split(".").reduce((a, k) => a?.[k], obj);

const REFERENCE = leaves(deOnboarding).sort();

test("the German namespace is the reference and is non-trivial", () => {
  assert.ok(REFERENCE.length > 100, `expected a full namespace, got ${REFERENCE.length} keys`);
});

for (const lang of LANGS) {
  test(`${lang}: every key resolves through the real merge chain`, () => {
    const ns = getMessages(lang)?.patientOnboarding;
    assert.ok(ns, `${lang} has no patientOnboarding namespace at all`);

    const missing = REFERENCE.filter((k) => {
      const v = at(ns, k);
      return v === undefined || v === null || String(v).trim() === "";
    });
    assert.deepEqual(missing, [], `${lang} is missing ${missing.length} key(s)`);
  });

  test(`${lang}: every value is a string, never a leftover object`, () => {
    const ns = getMessages(lang).patientOnboarding;
    const wrong = REFERENCE.filter((k) => typeof at(ns, k) !== "string");
    assert.deepEqual(wrong, [], `${lang} has non-string values`);
  });
}

test("fr, it, es and ru are genuinely translated, not silently German", () => {
  // The known failure mode: an override bundle that was never wired, so every
  // string falls through. A handful of coincidental matches (a placeholder, a
  // word that is the same in two languages) is normal; wholesale identity is not.
  for (const lang of ["fr", "it", "es", "ru"]) {
    const ns = getMessages(lang).patientOnboarding;
    const identical = REFERENCE.filter((k) => at(ns, k) === at(deOnboarding, k));
    assert.ok(
      identical.length <= 5,
      `${lang} matches German on ${identical.length}/${REFERENCE.length} keys — the override is probably not wired`,
    );
  }
});

test("the placeholders a translator must keep are present in every language", () => {
  // If {count} or {practice} is dropped, the sentence renders with a hole in it.
  const withPlaceholders = [
    ["practice.duplicate.many", "{count}"],
    ["patient.success.body", "{practice}"],
  ];
  for (const lang of LANGS) {
    const ns = getMessages(lang).patientOnboarding;
    for (const [path, token] of withPlaceholders) {
      assert.ok(
        String(at(ns, path)).includes(token),
        `${lang}: ${path} lost its ${token} placeholder`,
      );
    }
  }
});

test("no user-facing string leaks a technical error code", () => {
  // The server's codes are for branching, never for reading. A translation that
  // pasted one in would put `invalid_or_expired_invitation` on a patient's screen.
  const codeLike = /\b[a-z]+(_[a-z]+){2,}\b/;
  for (const lang of LANGS) {
    const ns = getMessages(lang).patientOnboarding;
    const offenders = REFERENCE.filter((k) => codeLike.test(String(at(ns, k))));
    assert.deepEqual(offenders, [], `${lang} exposes a raw error code to the user`);
  }
});

test("the practice and patient halves are both present in every language", () => {
  for (const lang of LANGS) {
    const ns = getMessages(lang).patientOnboarding;
    assert.ok(ns.practice?.title, `${lang} is missing the practice half`);
    assert.ok(ns.patient?.title, `${lang} is missing the patient half`);
    // The four invitation states the practice must be able to read.
    for (const state of ["pending", "expired", "redeemed", "revoked", "superseded"]) {
      assert.ok(ns.practice.invitationStatus?.[state], `${lang}: invitationStatus.${state}`);
    }
  }
});
