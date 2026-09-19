/**
 * Meda Live — live transcription (same language, no translation) and the
 * measurement-only level meter.
 *
 * Run: node --test client/src/features/medaLiveTranslation/realtime/__tests__/transcriptionMode.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  REJECT_REASONS,
  SESSION_MODES,
  decideUtterance,
  resolveSessionMode,
  speakerLabel,
} from "../utteranceGate.js";
import { percentile, summariseSegment } from "../speechLevelMeter.js";

const DE_DE = { mode: SESSION_MODES.TRANSCRIPTION, patientLanguage: "de", practiceLanguage: "de" };

test("mode: the same language on both sides means transcription — for any language", () => {
  for (const l of ["de", "en", "fr", "it", "es", "ru", "tr"]) {
    assert.equal(resolveSessionMode(l, l), SESSION_MODES.TRANSCRIPTION, l);
  }
  assert.equal(resolveSessionMode("de", "en"), SESSION_MODES.INTERPRETATION);
  assert.equal(resolveSessionMode("", ""), SESSION_MODES.INTERPRETATION);
});

test("transcription: the speaker is the selection at speech start, never guessed", () => {
  for (const role of ["patient", "practice"]) {
    const d = decideUtterance({ ...DE_DE, transcript: "Seit gestern habe ich Fieber", boundRole: role });
    assert.equal(d.accept, true);
    assert.equal(d.speakerRole, role);
    assert.equal(d.speakerCertain, true);
    assert.equal(d.sourceLanguage, "de");
    assert.equal(d.targetLanguage, "de", "no translation direction");
  }
  const none = decideUtterance({ ...DE_DE, transcript: "Seit gestern habe ich Fieber", boundRole: null });
  assert.equal(none.accept, true);
  assert.equal(none.speakerRole, null, "no selection → unassigned");
  assert.equal(none.speakerCertain, false);
});

test("transcription: short answers, doses and names stay in the record", () => {
  for (const transcript of ["Ja", "Nein", "Paracetamol 500", "38,5", "Müller", "Im Mai", "Yes"]) {
    const d = decideUtterance({ ...DE_DE, transcript, boundRole: "patient" });
    assert.equal(d.accept, true, transcript);
  }
});

test("transcription: a clearly different language is kept out of the German record", () => {
  for (const transcript of [
    "How long have you had the pain here?",
    "Tengo dolor de cabeza desde hace tres días y también fiebre",
    "Привет как дела",
  ]) {
    const d = decideUtterance({ ...DE_DE, transcript, boundRole: "practice" });
    assert.equal(d.accept, false, transcript);
    assert.equal(d.reason, REJECT_REASONS.FOREIGN_LANGUAGE);
    assert.equal(d.speakerRole, null);
  }
});

test("speaker labels come from session data, with neutral fallbacks", () => {
  const fallbacks = { patient: "Patient/in", practice: "Ärztin / Arzt", unassigned: "Nicht zugeordnet" };
  assert.equal(speakerLabel("patient", { patientName: "Anna Schmidt" }, fallbacks), "Anna Schmidt");
  assert.equal(speakerLabel("practice", { practitionerName: " Dr. Heinrich " }, fallbacks), "Dr. Heinrich");
  assert.equal(speakerLabel("practice", { practitionerName: "" }, fallbacks), "Ärztin / Arzt");
  assert.equal(speakerLabel(null, { patientName: "Anna Schmidt" }, fallbacks), "Nicht zugeordnet");
});

test("level meter: segment level is the upper quartile, noise floor the quiet tenth", () => {
  assert.equal(percentile([], 0.5), null);
  const samples = [];
  for (let t = 0; t < 20_000; t += 50) samples.push({ t, db: -60 }); // room
  for (let t = 10_000; t < 11_000; t += 50) {
    const i = samples.findIndex((s) => s.t === t);
    samples[i] = { t, db: t % 200 === 0 ? -50 : -25 }; // speech with gaps
  }
  const level = summariseSegment(samples, 10_000, 11_000);
  assert.equal(level.speechDb, -25);
  assert.equal(level.noiseFloorDb, -60);
  assert.equal(summariseSegment(samples, 30_000, 31_000), null, "no samples → no measurement");
});
