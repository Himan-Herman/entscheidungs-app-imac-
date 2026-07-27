/**
 * i18n completeness for the practice team page, across all five product
 * languages.
 *
 * Important: fr/it/es are NOT namespace directories like de/en — they are
 * override bundles deep-merged over an en+de fallback base. A missing key
 * therefore does not blow up, it silently renders in English. These tests
 * resolve the messages through the REAL merge chain (getMessages) and compare
 * against the source override bundles, so a silent English fallback is caught.
 *
 * Run: node --test client/src/i18n/__tests__/practiceTeamI18n.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { getMessages } from "../translations/index.js";
import de from "../translations/de/practiceTeam.js";
import en from "../translations/en/practiceTeam.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const LANGS = ["de", "en", "fr", "it", "es"];

const pageSource = readFileSync(
  join(root, "features", "practiceTeam", "pages", "PracticeTeamPage.jsx"),
  "utf8",
);

/** Every practiceTeam key the page actually reads. */
function usedKeys() {
  const keys = new Set(
    [...pageSource.matchAll(/\bt\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]),
  );
  // Group headings are read via t[g.labelKey].
  for (const m of pageSource.matchAll(/labelKey:\s*"([A-Za-z0-9_]+)"/g)) keys.add(m[1]);
  // Success messages are read via t[`clinicalSuccess_${action}`].
  if (pageSource.includes("clinicalSuccess_${action}")) {
    for (const a of ["request", "approve", "reject", "revoke"]) keys.add(`clinicalSuccess_${a}`);
  }
  // `errors` is a nested object, checked separately.
  keys.delete("errors");
  return [...keys];
}

/** Keys defined directly in a language's own practiceTeam source. */
function ownKeys(lang) {
  if (lang === "de" || lang === "en") {
    const src = readFileSync(join(root, "i18n", "translations", lang, "practiceTeam.js"), "utf8");
    return new Set([...src.matchAll(/^ {2}([A-Za-z_][A-Za-z0-9_]*):/gm)].map((m) => m[1]));
  }
  const src = readFileSync(
    join(root, "i18n", "translations", "overrides", lang, `${lang}.practice.modules.js`),
    "utf8",
  );
  const start = src.indexOf("practiceTeam: {");
  assert.notEqual(start, -1, `${lang}: practiceTeam block missing`);
  let depth = 0;
  let end = start;
  for (let i = src.indexOf("{", start); i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = src.slice(start, end);
  return new Set([...block.matchAll(/^ {4}([A-Za-z_][A-Za-z0-9_]*):/gm)].map((m) => m[1]));
}

const USED = usedKeys();

test("the page reads a non-trivial number of keys", () => {
  assert.ok(USED.length > 60, `expected the full page surface, got ${USED.length}`);
});

test("every used key resolves in all five languages", () => {
  for (const lang of LANGS) {
    const bundle = getMessages(lang).practiceTeam;
    assert.ok(bundle, `${lang}: practiceTeam namespace missing`);
    for (const key of USED) {
      const value = bundle[key];
      assert.ok(
        typeof value === "string" && value.trim().length > 0,
        `${lang}: key "${key}" is missing or empty`,
      );
    }
  }
});

test("no language silently falls back to English for this namespace", () => {
  for (const lang of ["fr", "it", "es"]) {
    const own = ownKeys(lang);
    const missing = USED.filter((k) => !own.has(k));
    assert.deepEqual(
      missing, [],
      `${lang} does not define ${missing.length} key(s) and would render them in English`,
    );
  }
});

test("all error codes are translated in every language", () => {
  const codes = Object.keys(de.errors);
  assert.ok(codes.length >= 10, "control: the German bundle defines error codes");
  for (const lang of LANGS) {
    const errors = getMessages(lang).practiceTeam?.errors ?? {};
    for (const code of codes) {
      assert.ok(
        typeof errors[code] === "string" && errors[code].trim().length > 0,
        `${lang}: error "${code}" missing`,
      );
    }
  }
});

test("interpolation placeholders match across all five languages", () => {
  const placeholders = (s) => [...String(s).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const key of USED) {
    const reference = placeholders(de[key] ?? en[key] ?? "");
    for (const lang of LANGS) {
      const value = getMessages(lang).practiceTeam[key];
      assert.deepEqual(
        placeholders(value), reference,
        `${lang}: "${key}" placeholders differ from the German reference`,
      );
    }
  }
});

test("the misleading approval wording is gone in every language", () => {
  const banned = ["Bestätigt", "Confirmed", "Confirmé", "Confermato", "Confirmado"];
  for (const lang of LANGS) {
    const value = getMessages(lang).practiceTeam.clinicalStatusActive;
    assert.ok(
      !banned.includes(value),
      `${lang}: "${value}" reads as an external verification`,
    );
    assert.ok(
      /praxisintern|by practice|au sein de|internamente|por el centro/i.test(value),
      `${lang}: "${value}" must name the practice as the approver`,
    );
  }
});

test("no language claims a professional or state-issued qualification", () => {
  // Language-specific: French "approbation" simply means "approval" and is the
  // correct word here, whereas German "Approbation" is the medical licence.
  const forbidden = {
    de: ["verifizierter arzt", "verifizierte ärztin", "staatlich bestätigt", "approbiert", "approbation"],
    en: ["verified doctor", "licensed physician", "state-certified", "board-certified"],
    fr: ["médecin vérifié", "certifié par l’état", "certifie par l'etat"],
    it: ["medico verificato", "certificato dallo stato", "abilitazione statale"],
    es: ["médico verificado", "certificado por el estado", "colegiado verificado"],
  };
  for (const lang of LANGS) {
    const haystack = JSON.stringify(getMessages(lang).practiceTeam).toLowerCase();
    for (const term of forbidden[lang]) {
      assert.ok(!haystack.includes(term), `${lang} must not contain "${term}"`);
    }
  }
});

test("the four clinical states stay distinguishable in every language", () => {
  for (const lang of LANGS) {
    const b = getMessages(lang).practiceTeam;
    const states = [
      b.clinicalStatusPending,
      b.clinicalStatusActive,
      b.clinicalStatusRejected,
      b.clinicalStatusRevoked,
      b.clinicalRoleNone,
    ];
    assert.equal(new Set(states).size, states.length, `${lang}: states collide`);
  }
});

test("accessible names carry the person's name in every language", () => {
  for (const lang of LANGS) {
    const b = getMessages(lang).practiceTeam;
    const rendered = [
      b.clinicalAriaRequest,
      b.clinicalAriaApprove,
      b.clinicalAriaReject,
      b.clinicalAriaRevoke,
    ].map((s) => {
      assert.ok(s.includes("{name}"), `${lang}: missing {name} placeholder`);
      return s.replace("{name}", "Maria Mustermann");
    });
    assert.equal(new Set(rendered).size, 4, `${lang}: duplicate accessible names`);
  }
});

test("the Italian bundle no longer contains Spanish leftovers", () => {
  const it = getMessages("it").practiceTeam;
  assert.equal(it.colStatus, "Stato", "colStatus was Spanish 'Estado'");
  assert.ok(!/acci[oó]n/i.test(it.saveError), "saveError contained Spanish 'acción'");
  assert.ok(!/\botros\b/i.test(it.membersEmpty), "membersEmpty contained Spanish 'otros'");
});
