/**
 * What the consent screen is allowed to claim, in all six languages.
 *
 * After a patient claims an invitation themselves, the link already exists and
 * only the data release is outstanding. The screen must therefore not say a
 * practice "would like to connect" — that describes a request the patient
 * already answered — and it must not say anything has been shared yet, because
 * nothing has. These are resolved through the real merge chain, so a language
 * that silently falls back to another one fails here.
 *
 * Run: node --test client/src/i18n/__tests__/consentRequestTexts.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { getMessages } from "../translations/index.js";

const LANGS = ["de", "en", "fr", "it", "es", "ru"];
const KEYS = ["requestsHeading", "requestsIntro", "requestFrom", "acceptScopesHint"];

const ns = (lang) => getMessages(lang).patientPracticeLinks;

test("every language has all four texts, resolved through the merge chain", () => {
  for (const lang of LANGS) {
    for (const key of KEYS) {
      const v = ns(lang)?.[key];
      assert.ok(v && String(v).trim(), `${lang}: ${key} is missing`);
      assert.equal(typeof v, "string", `${lang}: ${key} is not a string`);
    }
  }
});

test("no language still describes this as an incoming connection request", () => {
  // The exact phrasings that were wrong, per language. Each one asserted a
  // request the patient had in fact already made themselves.
  const stale = {
    de: ["Eingehende Verknüpfungsanfragen", "möchte sich mit Ihrem Konto verbinden"],
    en: ["Incoming connection requests", "would like to connect to your account"],
    fr: ["Demandes de connexion entrantes", "souhaite se connecter à votre compte"],
    it: ["Richieste di collegamento in arrivo", "vuole collegarsi al tuo account"],
    es: ["Solicitudes de conexión entrantes", "desea conectarse a su cuenta"],
    ru: ["Входящие запросы на подключение", "хочет подключиться к вашему аккаунту"],
  };
  for (const lang of LANGS) {
    const joined = KEYS.map((k) => ns(lang)[k]).join(" ");
    for (const phrase of stale[lang]) {
      assert.equal(
        joined.includes(phrase), false,
        `${lang} still says "${phrase}" — the connection already exists at this point`,
      );
    }
  }
});

test("no language still promises a default selection", () => {
  // The hint used to name "(default: profile + messages)". Nothing is
  // preselected any more, so saying so would be false.
  const defaults = {
    de: "Standard: Profil", en: "default: profile", fr: "par défaut : profil",
    it: "predefiniti: profilo", es: "predeterminado: perfil", ru: "по умолчанию: профиль",
  };
  for (const lang of LANGS) {
    assert.equal(
      ns(lang).acceptScopesHint.includes(defaults[lang]), false,
      `${lang}: the hint still names a preselected default`,
    );
  }
});

test("no language claims data has already been shared", () => {
  // "shared"/"released" in the past tense, without a negation, would contradict
  // the backend: a claim writes no consent at all.
  const alreadyShared = {
    de: /(wurden|sind) .{0,20}freigegeben(?!.{0,20}nicht)/i,
    en: /(has|have) been shared(?!.{0,20}(not|nothing))/i,
    fr: /(ont|a) été partagé/i,
    it: /(è|sono) stat[oi] condivis/i,
    es: /(ha|han) sido compartid/i,
    ru: /уже переда/i,
  };
  for (const lang of LANGS) {
    const joined = KEYS.map((k) => ns(lang)[k]).join(" ");
    // German and English deliberately state the NEGATIVE ("nothing has been
    // shared yet"), so the pattern must not fire on those either.
    const NEGATED = /\bkein|\bnicht\b|nothing|no data|\baucun|\bnessun|\balcun|\bningún|\bnon\b|\bne\b|\bне\b|ничего|todavía no|encore/i;
    const bad = alreadyShared[lang].test(joined) && !NEGATED.test(joined);
    assert.equal(bad, false, `${lang} may be claiming data is already shared`);
  }
});

test("the practice placeholder survives in every language", () => {
  for (const lang of LANGS) {
    assert.ok(
      ns(lang).requestFrom.includes("{practice}"),
      `${lang}: requestFrom lost its {practice} placeholder`,
    );
  }
});

test("the four texts are genuinely translated, not silently German", () => {
  const de = ns("de");
  for (const lang of ["fr", "it", "es", "ru"]) {
    const same = KEYS.filter((k) => ns(lang)[k] === de[k]);
    assert.deepEqual(same, [], `${lang} falls back to German for ${same.join(", ")}`);
  }
});
