/**
 * Mandatory checks for the prefilled deletion-confirmation e-mail:
 * - recipient is contact@medscoutx.com,
 * - the subject carries the case number,
 * - the body contains no patient data, diagnoses, document titles or internal
 *   ids — only practice name, case number, owner address and owner name,
 * in every one of the five languages.
 *
 * Run: node --test src/features/lifecycleExit/__tests__/deletionMail.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildDeletionMail } from "../lib/deletionMail.js";
import de from "../../../i18n/translations/de/lifecycleExit.js";
import en from "../../../i18n/translations/en/lifecycleExit.js";
import { frLifecycleExit } from "../../../i18n/translations/overrides/fr/fr.lifecycleExit.js";
import { itLifecycleExit } from "../../../i18n/translations/overrides/it/it.lifecycleExit.js";
import { esLifecycleExit } from "../../../i18n/translations/overrides/es/es.lifecycleExit.js";

const BUNDLES = { de, en, fr: frLifecycleExit, it: itLifecycleExit, es: esLifecycleExit };

const ARGS = {
  supportEmail: "contact@medscoutx.com",
  practiceName: "Praxis Sonnenschein",
  caseNumber: "PD-2026-000123",
  ownerEmail: "owner@example.test",
  ownerName: "Dr. Beispiel",
};

for (const [lang, bundle] of Object.entries(BUNDLES)) {
  test(`${lang}: mailto targets the official address and carries the case number`, () => {
    const mail = buildDeletionMail({ t: bundle.practice, ...ARGS });
    assert.ok(mail.href.startsWith("mailto:contact@medscoutx.com?"), "wrong recipient");
    assert.ok(mail.subject.includes("PD-2026-000123"), "subject lacks case number");
    assert.ok(mail.body.includes("PD-2026-000123"), "body lacks case number");
    assert.ok(mail.body.includes("Praxis Sonnenschein"));
    assert.ok(mail.body.includes("owner@example.test"));
    assert.ok(mail.body.includes("Dr. Beispiel"));
    // No unresolved placeholders reach the mail client.
    assert.ok(!/\{\w+\}/.test(mail.subject), "unresolved placeholder in subject");
    assert.ok(!/\{\w+\}/.test(mail.body), "unresolved placeholder in body");
  });
}

test("the template never asks for patient data, diagnoses or document titles", () => {
  for (const [lang, bundle] of Object.entries(BUNDLES)) {
    const mail = buildDeletionMail({ t: bundle.practice, ...ARGS });
    for (const forbidden of ["Patient:", "Diagnose", "diagnosis", "Dokumenttitel", "user-", "link-"]) {
      assert.ok(!mail.body.includes(forbidden), `${lang} body contains "${forbidden}"`);
    }
  }
});

test("missing optional values degrade to empty strings, never to 'undefined'", () => {
  const mail = buildDeletionMail({
    t: BUNDLES.de.practice,
    supportEmail: "contact@medscoutx.com",
    practiceName: "",
    caseNumber: null,
    ownerEmail: "",
    ownerName: "",
  });
  assert.ok(!mail.subject.includes("undefined"));
  assert.ok(!mail.body.includes("undefined"));
  assert.ok(!mail.body.includes("null"));
});
