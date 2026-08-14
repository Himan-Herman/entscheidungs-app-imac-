/**
 * Source-side negation detection.
 *
 * Scope check as much as a behaviour check: this stage runs on the SOURCE text
 * only and produces metadata. It performs no translation, makes no model call,
 * and sends nothing anywhere.
 *
 * The tests are split into what the detector genuinely handles and what it
 * provably does not. The second group exists so the limits stay visible instead
 * of being discovered later in production — no claim of completeness is made.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  POLARITY,
  annotateSegmentsWithPolarity,
  detectPolarity,
  selectPolaritySensitiveSegments,
} from "../services/documentTranslation/negation/negationDetection.js";

function polarityOf(text) {
  return detectPolarity(text).polarity;
}

/* ------------------------------------------------------ reliable detection */

test("German clinical negation phrases are detected", () => {
  const negated = [
    "Kein Hinweis auf einen Infekt.",
    "Kein Anhalt für eine Fraktur.",
    "Kein Nachweis von Metastasen.",
    "Keine Anzeichen einer Entzündung.",
    "Erreger nicht nachweisbar.",
    "Der Befund ist unauffällig.",
    "Die Patientin ist frei von Beschwerden.",
    "Eine Blutung wurde ausgeschlossen.",
    "Negativ für Troponin.",
    "Ohne Hinweis auf eine Raumforderung.",
  ];
  for (const text of negated) {
    assert.equal(polarityOf(text), POLARITY.NEGATED, `not detected: ${text}`);
  }
});

test("English clinical negation phrases are detected", () => {
  const negated = [
    "No evidence of infection.",
    "No signs of fracture.",
    "Pathogen not detected.",
    "The findings are unremarkable.",
    "Negative for troponin.",
    "Malignancy was ruled out.",
    "Without evidence of haemorrhage.",
  ];
  for (const text of negated) {
    assert.equal(polarityOf(text), POLARITY.NEGATED, `not detected: ${text}`);
  }
});

test("plain affirmative findings are not marked negated", () => {
  const affirmed = [
    "Die Wunde heilt regulär.",
    "Ramipril 5 mg, 1-0-0.",
    "CRP 1,5 mg/dl bei einem Referenzbereich von 0,0-0,5 mg/dl.",
    "Kontrolle am 12.08.2026 um 14:30.",
    "The patient reports improvement.",
    "",
    "   ",
  ];
  for (const text of affirmed) {
    assert.equal(polarityOf(text), POLARITY.AFFIRMED, `false positive: ${text}`);
  }
});

test("pseudo-negations do not count as negation", () => {
  // "nicht nur" is an intensifier, not a clinical negation.
  assert.equal(polarityOf("Nicht nur die Leberwerte waren erhöht."), POLARITY.AFFIRMED);
  assert.equal(polarityOf("Not only the liver values were elevated."), POLARITY.AFFIRMED);
});

test("double negation is not read as a negated finding", () => {
  // "nicht auszuschließen" means the finding STANDS as a possibility. Reading
  // it as a negation would invert the clinical meaning.
  const cases = [
    "Eine Fraktur ist nicht auszuschließen.",
    "Eine Blutung ist nicht ausgeschlossen.",
    "Eine Embolie kann nicht ausgeschlossen werden.",
    "Malignancy cannot be excluded.",
    "A fracture cannot be ruled out.",
  ];
  for (const text of cases) {
    const result = detectPolarity(text);
    assert.equal(result.polarity, POLARITY.AFFIRMED, `wrongly negated: ${text}`);
    assert.equal(result.doubleNegation, true, `double negation not flagged: ${text}`);
  }
});

test("a longer cue is not counted twice by its own substring", () => {
  // "kein Hinweis auf" must not also register a bare "kein".
  const result = detectPolarity("Kein Hinweis auf einen Infekt.");
  assert.equal(result.cues.length, 1, JSON.stringify(result.cues));
});

test("multiple distinct negations in one segment are all recorded", () => {
  const result = detectPolarity("Kein Fieber, kein Husten.");
  assert.equal(result.polarity, POLARITY.NEGATED);
  assert.equal(result.cues.length, 2, JSON.stringify(result.cues));
});

/* ---------------------------------------------------------- segment model */

test("annotation preserves segment order and does not mutate the input", () => {
  const segments = [
    { index: 0, kind: "heading", text: "Befund" },
    { index: 1, kind: "paragraph", text: "Kein Hinweis auf einen Infekt." },
    { index: 2, kind: "paragraph", text: "Ramipril 5 mg." },
  ];
  const frozen = JSON.stringify(segments);

  const annotated = annotateSegmentsWithPolarity(segments);

  assert.equal(JSON.stringify(segments), frozen, "input was mutated");
  assert.deepEqual(annotated.map((s) => s.index), [0, 1, 2]);
  assert.deepEqual(annotated.map((s) => s.kind), ["heading", "paragraph", "paragraph"]);
  assert.deepEqual(annotated.map((s) => s.text), segments.map((s) => s.text));
  assert.deepEqual(
    annotated.map((s) => s.polarity),
    [POLARITY.AFFIRMED, POLARITY.NEGATED, POLARITY.AFFIRMED],
  );
});

test("polarity-sensitive segments are selectable for later scrutiny", () => {
  const annotated = annotateSegmentsWithPolarity([
    { index: 0, kind: "paragraph", text: "Ramipril 5 mg." },
    { index: 1, kind: "paragraph", text: "Kein Hinweis auf einen Infekt." },
    { index: 2, kind: "paragraph", text: "Eine Fraktur ist nicht auszuschließen." },
  ]);

  const sensitive = selectPolaritySensitiveSegments(annotated);
  assert.deepEqual(sensitive.map((s) => s.index), [1, 2]);
});

test("annotation is total — every segment gets a polarity", () => {
  const annotated = annotateSegmentsWithPolarity([
    { index: 0, kind: "paragraph", text: "" },
    { index: 1, kind: "table_row", text: "CRP | 1,5 mg/dl" },
  ]);
  for (const s of annotated) {
    assert.ok(Object.values(POLARITY).includes(s.polarity));
    assert.ok(Array.isArray(s.negationCues));
    assert.equal(typeof s.doubleNegation, "boolean");
  }
});

/* --------------------------------------------------- documented limitations */

test("KNOWN LIMIT: morphological negation is not detected", () => {
  // Compound negation carried by a suffix rather than a cue word. Recorded as a
  // test so the gap is explicit rather than assumed away. If a future change
  // starts detecting these, this test fails and the documentation gets updated.
  assert.equal(polarityOf("Der Patient ist beschwerdefrei."), POLARITY.AFFIRMED);
  assert.equal(polarityOf("Der Verlauf war symptomlos."), POLARITY.AFFIRMED);
});

test("KNOWN LIMIT: polarity marks the segment, not the individual finding", () => {
  // One cue negates the whole segment, even though only part of it is negated.
  // The cautious direction, but not precise.
  const mixed = "Kein Hinweis auf einen Infekt, jedoch deutliche Anämie.";
  assert.equal(polarityOf(mixed), POLARITY.NEGATED);
});

test("KNOWN LIMIT: only German and English cues are covered", () => {
  // A French source document is not analysed; it is simply not marked.
  assert.equal(polarityOf("Aucun signe d'infection."), POLARITY.AFFIRMED);
  assert.equal(polarityOf("Нет признаков инфекции."), POLARITY.AFFIRMED);
});

/* ------------------------------------------------------------------ scope */

test("detection is deterministic and side-effect free", () => {
  const text = "Kein Hinweis auf einen Infekt. Eine Fraktur ist nicht auszuschließen.";
  const first = detectPolarity(text);
  for (let i = 0; i < 5; i += 1) {
    assert.deepEqual(detectPolarity(text), first, "result changed between runs");
  }
});

test("regex state does not leak between calls", () => {
  // Global regexes carry lastIndex; a shared one that is not reset silently
  // skips matches on every second call.
  for (let i = 0; i < 10; i += 1) {
    assert.equal(polarityOf("Kein Hinweis auf einen Infekt."), POLARITY.NEGATED, `run ${i}`);
  }
});
