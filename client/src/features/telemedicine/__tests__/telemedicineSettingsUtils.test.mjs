/**
 * Tests for Task-2 display fixes:
 *  - provider type dropdown shows readable, translated labels (not raw values)
 *  - practice selector shows the name, never the raw database id
 * Run: node --test client/src/features/telemedicine/__tests__/telemedicineSettingsUtils.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { PROVIDER_TYPES, providerLabelKey } from "../telemedicineSettingsUtils.js";
import { practiceDisplayName } from "../../../api/practiceDisplayName.js";
import { getMessages } from "../../../i18n/translations/index.js";

const LANGS = ["en", "de", "it", "fr", "es"];

test("PROVIDER_TYPES lists the known technical values", () => {
  assert.deepEqual(PROVIDER_TYPES, [
    "sandbox",
    "external_link",
    "jitsi",
    "daily",
    "twilio",
    "whereby",
    "zoom",
    "google_meet",
  ]);
});

test("providerLabelKey maps value → i18n key", () => {
  assert.equal(providerLabelKey("google_meet"), "provider_google_meet");
  assert.equal(providerLabelKey("external_link"), "provider_external_link");
});

test("every provider has a readable label (≠ raw value) in all 5 languages", () => {
  for (const lang of LANGS) {
    const t = getMessages(lang).practiceTelemedicine || {};
    for (const value of PROVIDER_TYPES) {
      const label = t[providerLabelKey(value)];
      assert.ok(label, `provider label missing: ${lang}/${value}`);
      assert.notEqual(
        label,
        value,
        `provider label should be readable, not the raw value (${lang}/${value})`,
      );
    }
  }
});

test("practiceDisplayName prefers the name and never falls through to the id when a name exists", () => {
  assert.equal(
    practiceDisplayName({ practiceName: "Medscout Klinik", id: "cmpbso0pr0001ph21" }),
    "Medscout Klinik",
  );
  assert.equal(practiceDisplayName({ name: "Legacy Name", id: "x1" }), "Legacy Name");
  // practiceName wins over name
  assert.equal(
    practiceDisplayName({ practiceName: "Primary", name: "Secondary", id: "x1" }),
    "Primary",
  );
  // id only as last resort
  assert.equal(practiceDisplayName({ id: "cmpbso0pr0001ph21" }), "cmpbso0pr0001ph21");
  assert.equal(practiceDisplayName(null), "");
  assert.equal(practiceDisplayName({}), "");
});
