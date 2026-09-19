/**
 * Meda Live — strict session language lock (classifyUtteranceLanguage).
 *
 * Two promises that pull in opposite directions:
 *  1. Only the session's languages count. A third language never becomes a
 *     translation, a speaker or a language of the conversation.
 *  2. Nothing medically relevant is dropped because it is short: answers,
 *     doses, drug names, names and numbers are kept, even when a word happens
 *     to exist in another language too.
 *
 * Run: node --test client/src/features/medaLiveTranslation/realtime/__tests__/sessionLanguageLock.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyUtteranceLanguage as classify } from "../realtimeLanguages.js";

const DE_EN = ["de", "en"];

test("short answers are attributed to the right session language", () => {
  for (const [text, lang] of [
    ["Ja", "de"], ["Nein", "de"], ["Nein.", "de"], ["links", "de"], ["Rechts", "de"], ["Nie", "de"],
    ["Yes", "en"], ["No", "en"], ["No.", "en"], ["Left", "en"], ["Never", "en"],
  ]) {
    const r = classify(text, DE_EN);
    assert.equal(r.verdict, "allowed", text);
    assert.equal(r.language, lang, text);
  }
});

test("doses, drug names, names and numbers are kept, never rejected", () => {
  for (const text of [
    "Paracetamol 500", "Ibuprofen", "400 mg", "zweimal täglich 400 mg", "38,5", "38.5",
    "Müller", "Frau Schmidt", "Dr. Heinrich", "Okay", "Hmm", "Metformin 1000",
  ]) {
    const r = classify(text, DE_EN);
    assert.notEqual(r.verdict, "foreign", text);
    assert.equal(r.verdict === "allowed" || r.verdict === "inconclusive", true, text);
  }
});

test("German words that also exist in another language are not a third language", () => {
  // mai = Italian "never" / Romanian fingerprint; da = Romanian/Croatian "yes";
  // ne = Croatian/Czech "no"; hier = French "yesterday".
  for (const text of ["Im Mai", "Seit Mai", "Anfang Mai, vielleicht Juni", "Da oben", "Da", "Ne", "Ne, nicht so", "Hier"]) {
    assert.notEqual(classify(text, DE_EN).verdict, "foreign", text);
  }
});

test("a short foreign politeness word is left to the interpreter, not rejected here", () => {
  // Kept as inconclusive: the model hears the audio; if it refuses, the
  // client drops the segment again (see utteranceGate / isInterpreterRefusal).
  for (const text of ["Merci", "Grazie mille", "Gracias"]) {
    assert.equal(classify(text, DE_EN).verdict, "inconclusive", text);
  }
});

test("clear third-language speech is rejected", () => {
  for (const text of [
    "Tengo dolor de cabeza desde hace tres días y también fiebre",
    "Çünkü bu gün çok ağrı var ve bir de ateş",
    "Ja, tengo dolor de cabeza desde hace tres días",
    "Привет как дела",
    "머리가 아파요",
    "ألم في الرأس",
  ]) {
    const r = classify(text, DE_EN);
    assert.equal(r.verdict, "foreign", text);
    assert.equal(r.language, null, "a rejected segment has no language");
  }
});

test("never returns a language outside the session", () => {
  const samples = [
    "Ja", "No", "Tengo dolor de cabeza", "Ich habe Schmerzen", "How long?", "Merci beaucoup",
    "Paracetamol 500", "Grazie", "Evet", "Oui, depuis hier",
  ];
  for (const pair of [["de", "en"], ["fr", "en"], ["de", "tr"], ["it", "de"], ["de"]]) {
    for (const text of samples) {
      const r = classify(text, pair);
      if (r.language !== null) assert.ok(pair.includes(r.language), `${pair}: ${text} → ${r.language}`);
    }
  }
});

test("generic: other pairs and scripts", () => {
  assert.equal(classify("J'ai mal depuis trois jours", ["fr", "en"]).language, "fr");
  assert.equal(classify("Oui", ["fr", "en"]).language, "fr");
  assert.equal(classify("Болит голова", ["ru", "de"]).language, "ru");
  assert.equal(classify("Ich habe Kopfschmerzen seit gestern", ["ru", "de"]).language, "de");
  // Latin drug name in a Cyrillic/Latin pair: no script evidence → kept.
  assert.equal(classify("Ibuprofen 400", ["ru", "de"]).verdict, "inconclusive");
  // Arabic in a DE/EN session is foreign, in a DE/AR session it is allowed.
  assert.equal(classify("ألم في الرأس", ["de", "ar"]).language, "ar");
});

test("one allowed language (same-language transcription)", () => {
  assert.equal(classify("Ja", ["de"]).language, "de");
  assert.equal(classify("Paracetamol 500", ["de"]).verdict, "inconclusive");
  assert.equal(classify("How long have you had the pain here?", ["de"]).verdict, "foreign");
  assert.equal(classify("", ["de"]).verdict, "empty");
  assert.equal(classify("Ja", []).verdict, "empty");
});
