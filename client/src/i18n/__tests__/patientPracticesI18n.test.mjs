/**
 * Five-language completeness for the patient provenance and sharing UI.
 *
 * fr/it/es are override bundles deep-merged over an en+de base, so a missing
 * key does not fail — it silently falls back to English. A German-speaking
 * patient reading a French page would then see English sentences about who may
 * read their medical documents. These tests check the real merged bundles, not
 * the override files.
 *
 * Run: node --test src/i18n/__tests__/patientPracticesI18n.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import de from "../translations/de/patientPractices.js";
import deShare from "../translations/de/documentSharing.js";
import en from "../translations/en/patientPractices.js";
import enShare from "../translations/en/documentSharing.js";
import { frPatientPractices, frDocumentSharing } from "../translations/overrides/fr/fr.patientPractices.js";
import { itPatientPractices, itDocumentSharing } from "../translations/overrides/it/it.patientPractices.js";
import { esPatientPractices, esDocumentSharing } from "../translations/overrides/es/es.patientPractices.js";

const BUNDLES = {
  de: { patientPractices: de, documentSharing: deShare },
  en: { patientPractices: en, documentSharing: enShare },
  fr: { patientPractices: frPatientPractices, documentSharing: frDocumentSharing },
  it: { patientPractices: itPatientPractices, documentSharing: itDocumentSharing },
  es: { patientPractices: esPatientPractices, documentSharing: esDocumentSharing },
};

const LANGS = Object.keys(BUNDLES);

/** Flattens to dotted paths so a missing nested key is caught, not just a missing branch. */
function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, path));
    else out[path] = v;
  }
  return out;
}

const flat = Object.fromEntries(
  LANGS.map((l) => [l, { ...flatten(BUNDLES[l].patientPractices, "patientPractices"), ...flatten(BUNDLES[l].documentSharing, "documentSharing") }]),
);

test("every language defines exactly the German key set", () => {
  const expected = Object.keys(flat.de).sort();
  for (const lang of LANGS) {
    const actual = Object.keys(flat[lang]).sort();
    const missing = expected.filter((k) => !actual.includes(k));
    const extra = actual.filter((k) => !expected.includes(k));
    assert.deepEqual(missing, [], `${lang}: missing keys — these would silently fall back to English`);
    assert.deepEqual(extra, [], `${lang}: unknown keys`);
  }
});

test("no value is empty or a leftover placeholder", () => {
  for (const lang of LANGS) {
    for (const [key, value] of Object.entries(flat[lang])) {
      assert.equal(typeof value, "string", `${lang}.${key} is not a string`);
      assert.ok(value.trim().length > 0, `${lang}.${key} is empty`);
      assert.ok(!/^TODO|^TBD|^\?\?\?/.test(value), `${lang}.${key} is a placeholder`);
    }
  }
});

test("fr, it and es are genuinely translated, not copied from German or English", () => {
  // A handful of load-bearing sentences must differ from both base languages.
  const probes = [
    "patientPractices.heading",
    "patientPractices.ownData.title",
    "patientPractices.practices.title",
    "patientPractices.provenance.own",
    "patientPractices.provenance.contextUnavailable",
    "patientPractices.provenance.archived",
    "patientPractices.provenance.archivedWith",
    "patientPractices.practices.archivedTitle",
    "documentSharing.sharedData.title",
    "documentSharing.share.action",
    "documentSharing.share.readOnlyNotice",
    "documentSharing.revoke.action",
    "documentSharing.revoke.notice",
    "documentSharing.status.active",
    "documentSharing.practiceView.sharedByPatient",
  ];
  for (const lang of ["fr", "it", "es"]) {
    for (const key of probes) {
      assert.notEqual(flat[lang][key], flat.de[key], `${lang}.${key} is still German`);
      assert.notEqual(flat[lang][key], flat.en[key], `${lang}.${key} is still English`);
    }
  }
});

test("placeholders survive translation in every language", () => {
  const withPlaceholders = {
    "patientPractices.provenance.contextWith": ["{practice}"],
    "patientPractices.provenance.archivedWith": ["{practice}"],
    "patientPractices.provenance.archivedOn": ["{date}"],
    "patientPractices.counts.entries": ["{count}"],
    "documentSharing.share.ariaLabel": ["{document}", "{practice}"],
    "documentSharing.revoke.ariaLabel": ["{document}", "{practice}"],
    "documentSharing.practiceView.origin": ["{practice}"],
  };
  for (const lang of LANGS) {
    for (const [key, tokens] of Object.entries(withPlaceholders)) {
      for (const token of tokens) {
        assert.ok(
          flat[lang][key].includes(token),
          `${lang}.${key} lost ${token} — the practice or document name would vanish`,
        );
      }
    }
  }
});

test("the required vocabulary exists in all five languages", () => {
  const required = [
    "patientPractices.ownData.title",            // Meine eigenen Daten
    "patientPractices.practices.title",          // Meine Praxen
    "documentSharing.sharedData.title",          // Geteilte Daten
    "documentSharing.fields.sourcePractice",     // Herkunftspraxis
    "documentSharing.fields.targetPractice",     // Zielpraxis
    "documentSharing.share.action",              // Mit einer Praxis teilen
    "documentSharing.share.selectPractice",      // Praxis auswählen
    "documentSharing.share.readOnly",            // Lesezugriff
    "documentSharing.share.confirm",             // Freigeben
    "documentSharing.revoke.action",             // Freigabe widerrufen
    "documentSharing.status.active",             // Aktiv
    "documentSharing.status.revoked",            // Widerrufen
    "documentSharing.status.expired",            // Abgelaufen
    "documentSharing.practiceView.sharedByPatient", // Vom Patienten freigegeben
    "patientPractices.provenance.own",           // Ihre eigenen Daten
    "patientPractices.provenance.context",       // Praxisbezug
    "patientPractices.provenance.contextUnavailable", // Praxisbezug nicht verfügbar
    "patientPractices.provenance.archived",       // Ehemaliger Praxisbezug
    "patientPractices.provenance.archivedWith",   // Ehemalige Praxis: {practice}
    "patientPractices.provenance.archivedOn",     // Archiviert am {date}
    "patientPractices.practices.archivedTitle",   // Ehemalige Praxen
    "documentSharing.share.noOtherPractice",     // keine andere aktive Praxis
    "documentSharing.share.alreadyShared",       // bereits geteilt
    "documentSharing.share.success",             // Freigabe erfolgreich
    "documentSharing.revoke.success",            // Widerruf erfolgreich
  ];
  for (const lang of LANGS) {
    for (const key of required) {
      assert.ok(flat[lang][key], `${lang} is missing ${key}`);
    }
  }
});

test("every server error code the client can receive has a message everywhere", () => {
  const codes = [
    "document_not_found", "link_not_found", "link_not_active",
    "document_already_available_to_practice", "share_already_active",
    "grant_not_found", "unsupported_field", "forbidden", "server_error",
  ];
  for (const lang of LANGS) {
    for (const code of codes) {
      const msg = flat[lang][`documentSharing.errors.${code}`];
      assert.ok(msg, `${lang}: no message for ${code}`);
      assert.ok(!msg.includes("_"), `${lang}.${code} shows the raw code: ${msg}`);
    }
  }
});

test("the revocation notice never promises more than it can deliver", () => {
  // Withdrawing access cannot recall copies already taken out of the system.
  for (const lang of LANGS) {
    const external = flat[lang]["documentSharing.revoke.externalCopies"];
    assert.ok(external && external.length > 20, `${lang}: the honest limitation is missing`);
  }
});
