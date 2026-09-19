/**
 * Meda Live — per-utterance gate of the client-gated response flow.
 *
 * Run: node --test client/src/features/medaLiveTranslation/realtime/__tests__/utteranceGate.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  REJECT_REASONS,
  decideUtterance,
  isInterpreterRefusal,
  redactEventForDebug,
} from "../utteranceGate.js";

const DE_EN = { patientLanguage: "de", practiceLanguage: "en" };

test("empty or whitespace transcript is rejected silently", () => {
  for (const transcript of ["", "   ", null, undefined]) {
    const d = decideUtterance({ ...DE_EN, transcript });
    assert.equal(d.accept, false);
    assert.equal(d.reason, REJECT_REASONS.EMPTY);
  }
});

test("a clearly third language is rejected — auto and manual mode alike", () => {
  const spanish = "Tengo dolor de cabeza desde hace tres días y también fiebre";
  const turkish = "Çünkü bu gün çok ağrı var ve bir de ateş";
  const korean = "머리가 아파요 삼일 동안";
  for (const transcript of [spanish, turkish, korean]) {
    for (const manualMode of [false, true]) {
      const d = decideUtterance({ ...DE_EN, transcript, manualMode, boundRole: "patient" });
      assert.equal(d.accept, false, `${manualMode ? "manual" : "auto"}: ${transcript}`);
      assert.equal(d.reason, REJECT_REASONS.FOREIGN_LANGUAGE);
      assert.equal(d.speakerRole, null, "a rejected segment is never attributed");
    }
  }
});

test("auto mode: the recognised session language decides speaker and direction", () => {
  const p = decideUtterance({ ...DE_EN, transcript: "Ich habe seit drei Tagen starke Kopfschmerzen" });
  assert.deepEqual(
    { accept: p.accept, speakerRole: p.speakerRole, source: p.sourceLanguage, target: p.targetLanguage, certain: p.speakerCertain },
    { accept: true, speakerRole: "patient", source: "de", target: "en", certain: true },
  );
  const d = decideUtterance({ ...DE_EN, transcript: "How long have you had the pain?" });
  assert.deepEqual(
    { speakerRole: d.speakerRole, targetRole: d.targetRole, source: d.sourceLanguage, target: d.targetLanguage },
    { speakerRole: "practice", targetRole: "patient", source: "en", target: "de" },
  );
});

test("manual mode: the speaker bound at speech start wins over the text", () => {
  // Practice speaks the patient's language (German) — manual says practice.
  const d = decideUtterance({ ...DE_EN, transcript: "Ich untersuche Sie jetzt", manualMode: true, boundRole: "practice" });
  assert.equal(d.accept, true);
  assert.equal(d.speakerRole, "practice");
  assert.equal(d.sourceLanguage, "en");
  assert.equal(d.targetLanguage, "de");
  assert.equal(d.speakerCertain, true);
});

test("short answers, doses and names are kept — without a guessed speaker", () => {
  for (const transcript of ["Ja", "Nein", "Paracetamol 500", "Okay", "Müller", "zweimal täglich", "38,5"]) {
    const d = decideUtterance({ ...DE_EN, transcript });
    assert.equal(d.accept, true, transcript);
    if (!d.speakerCertain) {
      assert.equal(d.speakerRole, null, `${transcript}: no attribution on a guess`);
      assert.equal(d.sourceLanguage, null);
    }
  }
});

test("works for any language pair, not only German", () => {
  const frEn = { patientLanguage: "fr", practiceLanguage: "en" };
  assert.equal(decideUtterance({ ...frEn, transcript: "J'ai mal depuis trois jours, avec une douleur très forte" }).speakerRole, "patient");
  const foreign = decideUtterance({ ...frEn, transcript: "Ich habe seit drei Tagen starke Kopfschmerzen und auch Fieber" });
  assert.equal(foreign.accept, false);
  assert.equal(foreign.reason, REJECT_REASONS.FOREIGN_LANGUAGE);
});

test("interpreter refusal is recognised in the languages the model uses", () => {
  assert.equal(isInterpreterRefusal("Bitte wiederholen Sie die Aussage klar in einer der ausgewählten Gesprächssprachen."), true);
  assert.equal(isInterpreterRefusal("Please repeat the statement clearly in one of the selected conversation languages."), true);
  assert.equal(isInterpreterRefusal("I take ibuprofen 400 twice a day."), false);
  assert.equal(isInterpreterRefusal(""), false);
});

test("debug redaction: input transcripts become a length, everything else is untouched", () => {
  const input = { type: "conversation.item.input_audio_transcription.completed", item_id: "i1", transcript: "geheim" };
  const out = redactEventForDebug(input);
  assert.equal(out.transcript, "‹6 chars›");
  assert.equal(out.item_id, "i1");
  assert.equal(input.transcript, "geheim", "original event not mutated");
  const delta = redactEventForDebug({ type: "conversation.item.input_audio_transcription.delta", delta: "abc" });
  assert.equal(delta.delta, "‹3 chars›");
  const response = { type: "response.audio_transcript.done", transcript: "Hello" };
  assert.equal(redactEventForDebug(response), response);
});
