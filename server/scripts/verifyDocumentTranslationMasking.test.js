/**
 * Critical-token masking and integrity validation.
 *
 * The safety claim being tested: a translation model cannot corrupt a dose, a
 * value, a reference range, a schedule, a date or a time — because it never
 * receives them. It receives opaque markers, and the originals are restored
 * locally afterwards.
 *
 * The second claim: any attempt by the model to invent numeric material, drop a
 * marker, duplicate one, move one between segments, or change the segment
 * structure fails the whole result. There is no partial output.
 *
 * Pure functions only — no database, no network, no model.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  maskSegments,
  unmaskText,
  findMarkers,
  findUnmaskedDigits,
  stripMarkers,
} from "../services/documentTranslation/masking/criticalTokenMasking.js";
import {
  validateMaskedOutput,
  assertMaskingComplete,
} from "../services/documentTranslation/masking/maskedOutputValidation.js";
import {
  TRANSLATION_ERRORS,
  TRANSLATION_MODES,
} from "../services/documentTranslation/documentTranslationPolicy.js";

/* --------------------------------------------------------------- fixtures */

/** The values that must survive a translation byte for byte. */
const CRITICAL_FIXTURES = [
  "Ramipril 5 mg",
  "1,5 mg/dl",
  "0,0–0,5 mg/dl",
  "1-0-0",
  "50 %",
  "12.08.2026",
  "14:30",
];

const REPORT = [
  { index: 0, kind: "heading", text: "Laborbefund" },
  { index: 1, kind: "paragraph", text: "Ramipril 5 mg, 1-0-0 über 14 Tage." },
  { index: 2, kind: "table_row", text: "CRP | 1,5 mg/dl | 0,0–0,5 mg/dl" },
  { index: 3, kind: "paragraph", text: "Sättigung 50 %, Kontrolle am 12.08.2026 um 14:30." },
  { index: 4, kind: "paragraph", text: "Kein Hinweis auf einen Infekt." },
];

function seg(index, text, kind = "paragraph") {
  return { index, kind, text };
}

/** Echo the masked text back unchanged — a perfect, if unhelpful, translation. */
function echo(maskedSegments) {
  return maskedSegments.map((s) => ({ index: s.index, text: s.text }));
}

function expectIntegrityFailure(fn, rule) {
  try {
    fn();
    assert.fail(`expected integrity_failed (${rule})`);
  } catch (err) {
    assert.equal(err?.code, TRANSLATION_ERRORS.INTEGRITY_FAILED, `wrong code: ${err?.code}`);
    if (rule) {
      const rules = (err.detail?.violations ?? []).map((v) => v.rule);
      const matched = rules.includes(rule) || err.detail?.rule === rule;
      assert.ok(matched, `expected rule ${rule}, got ${JSON.stringify(rules)} / ${err.detail?.rule}`);
    }
  }
}

/* ------------------------------------------------------ masking coverage */

test("every critical fixture is masked away completely", () => {
  for (const fixture of CRITICAL_FIXTURES) {
    const { segments } = maskSegments([seg(0, fixture)]);
    assert.deepEqual(
      findUnmaskedDigits(segments[0].text),
      [],
      `unmasked digits remain in "${fixture}" -> "${segments[0].text}"`,
    );
  }
});

test("the digit-residue invariant holds for a whole report", () => {
  const { segments } = maskSegments(REPORT);
  assertMaskingComplete(segments);
  for (const s of segments) {
    assert.deepEqual(findUnmaskedDigits(s.text), [], `segment ${s.index}: ${s.text}`);
  }
});

test("critical tokens are masked as atomic units, not as pieces", () => {
  const { tokens } = maskSegments([
    seg(0, "Ramipril 5 mg, 1-0-0"),
    seg(1, "CRP 1,5 mg/dl (0,0–0,5 mg/dl)"),
    seg(2, "Sättigung 50 % am 12.08.2026 um 14:30"),
  ]);

  const byOriginal = new Map(tokens.map((t) => [t.original, t.kind]));

  assert.equal(byOriginal.get("5 mg"), "DOSE");
  assert.equal(byOriginal.get("1-0-0"), "SCHEDULE");
  assert.equal(byOriginal.get("1,5 mg/dl"), "DOSE");
  assert.equal(byOriginal.get("0,0–0,5 mg/dl"), "REFRANGE");
  assert.equal(byOriginal.get("50 %"), "PERCENT");
  assert.equal(byOriginal.get("12.08.2026"), "DATE");
  assert.equal(byOriginal.get("14:30"), "TIME");
});

test("a reference range is one token, not two numbers and a unit", () => {
  const { tokens } = maskSegments([seg(0, "Referenz 0,0–0,5 mg/dl")]);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].kind, "REFRANGE");
  assert.equal(tokens[0].original, "0,0–0,5 mg/dl");
});

test("an ISO date is a date, not a three-part schedule", () => {
  const { tokens } = maskSegments([seg(0, "Aufnahme 2026-08-12")]);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].kind, "DATE");
  assert.equal(tokens[0].original, "2026-08-12");
});

test("ICD-style codes are masked", () => {
  const { tokens } = maskSegments([seg(0, "Diagnose E11.9 und I10")]);
  const kinds = tokens.map((t) => t.kind);
  assert.ok(kinds.every((k) => k === "CODE"), JSON.stringify(tokens));
  assert.deepEqual(tokens.map((t) => t.original), ["E11.9", "I10"]);
});

test("markers are unique across the whole document", () => {
  const { segments, tokens } = maskSegments(REPORT);
  const all = segments.flatMap((s) => findMarkers(s.text));
  assert.equal(new Set(all).size, all.length, "duplicate marker emitted");
  assert.equal(all.length, tokens.length);
});

test("marker-like text in the source cannot collide with a real marker", () => {
  // A hostile or merely odd document containing the bracket characters must not
  // be able to introduce a marker the validator would then trust.
  const injected = "Wert ⟦DOSE_AAAB⟧ steht hier, 5 mg";
  const { segments, tokenMap } = maskSegments([seg(0, injected)]);

  // Every marker present is one we minted and can resolve.
  for (const marker of findMarkers(segments[0].text)) {
    assert.ok(tokenMap.has(marker), `unresolvable marker survived: ${marker}`);
  }
  // The smuggled sequence is no longer marker-shaped: its delimiters were
  // themselves masked, so it cannot impersonate a marker we minted.
  const resolvable = findMarkers(segments[0].text).filter((m) => tokenMap.has(m));
  assert.equal(resolvable.length, findMarkers(segments[0].text).length);
  assert.ok(!segments[0].text.includes("⟦DOSE_AAAB⟧ steht"));
  // Masking stays lossless — the document is restored exactly as written.
  assert.equal(unmaskText(segments[0].text, tokenMap), injected);
});

test("markers contain no digits, so no pass can mask inside one", () => {
  // Regression guard: with a numeric ordinal, the catch-all NUM pass masked the
  // digits inside markers emitted by earlier passes and broke the round trip.
  const { segments } = maskSegments(REPORT);
  for (const marker of segments.flatMap((s) => findMarkers(s.text))) {
    assert.ok(!/\d/.test(marker), `marker contains a digit: ${marker}`);
  }
});

/* ------------------------------------------------------------ round trip */

test("unmasking restores the original text exactly", () => {
  const { segments, tokenMap } = maskSegments(REPORT);
  segments.forEach((s, i) => {
    assert.equal(unmaskText(s.text, tokenMap), REPORT[i].text, `segment ${i} not restored`);
  });
});

test("round trip preserves every critical fixture byte for byte", () => {
  for (const fixture of CRITICAL_FIXTURES) {
    const { segments, tokenMap } = maskSegments([seg(0, fixture)]);
    assert.equal(unmaskText(segments[0].text, tokenMap), fixture);
  }
});

test("a translated sentence keeps its original values after unmasking", () => {
  const source = [seg(0, "Ramipril 5 mg, 1-0-0, Kontrolle am 12.08.2026.")];
  const { segments, tokenMap } = maskSegments(source);

  // Stand-in for a model response: language changed, markers untouched.
  const translated = segments[0].text
    .replace("Ramipril", "Ramipril")
    .replace(", Kontrolle am ", ", follow-up on ")
    .replace(".", ".");

  validateMaskedOutput({
    maskedSegments: segments,
    outputSegments: [{ index: 0, text: translated }],
    mode: TRANSLATION_MODES.STRICT,
  });

  const restored = unmaskText(translated, tokenMap);
  assert.ok(restored.includes("5 mg"), restored);
  assert.ok(restored.includes("1-0-0"), restored);
  assert.ok(restored.includes("12.08.2026"), restored);
  assert.ok(!restored.includes("50 mg"), restored);
});

/* --------------------------------------------------------- happy validation */

test("an unchanged echo validates in both modes", () => {
  const { segments } = maskSegments(REPORT);
  for (const mode of [TRANSLATION_MODES.STRICT, TRANSLATION_MODES.PLAIN]) {
    const result = validateMaskedOutput({
      maskedSegments: segments,
      outputSegments: echo(segments),
      mode,
    });
    assert.deepEqual(result, { ok: true });
  }
});

test("surrounding language may change freely", () => {
  const { segments } = maskSegments([seg(0, "Ramipril 5 mg täglich")]);
  const out = [{ index: 0, text: segments[0].text.replace("täglich", "once daily") }];
  assert.deepEqual(
    validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    { ok: true },
  );
});

/* ------------------------------------------------------- integrity failures */

test("a missing marker fails the whole result", () => {
  const { segments } = maskSegments(REPORT);
  const out = echo(segments);
  const marker = findMarkers(segments[1].text)[0];
  out[1] = { index: 1, text: out[1].text.replace(marker, "") };

  expectIntegrityFailure(
    () => validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    "marker_missing",
  );
});

test("a duplicated marker fails", () => {
  const { segments } = maskSegments(REPORT);
  const out = echo(segments);
  const marker = findMarkers(segments[1].text)[0];
  out[1] = { index: 1, text: `${out[1].text} ${marker}` };

  expectIntegrityFailure(
    () => validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    "marker_duplicated",
  );
});

test("an invented marker fails", () => {
  const { segments } = maskSegments(REPORT);
  const out = echo(segments);
  out[1] = { index: 1, text: `${out[1].text} ⟦DOSE_ZZZZ⟧` };

  expectIntegrityFailure(
    () => validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    "marker_unknown",
  );
});

test("a marker moved into another segment fails", () => {
  const { segments } = maskSegments(REPORT);
  const out = echo(segments);
  const marker = findMarkers(segments[1].text)[0];
  out[1] = { index: 1, text: out[1].text.replace(marker, "") };
  out[3] = { index: 3, text: `${out[3].text} ${marker}` };

  expectIntegrityFailure(() =>
    validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
  );
});

test("an invented number fails — the 5 mg to 50 mg case", () => {
  const { segments } = maskSegments([seg(0, "Ramipril 5 mg")]);
  // A model that emits a literal dose instead of the marker it was given.
  const out = [{ index: 0, text: "Ramipril 50 mg" }];

  expectIntegrityFailure(
    () => validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    "invented_numeric_value",
  );
});

test("an invented number alongside a correct marker still fails", () => {
  const { segments } = maskSegments([seg(0, "Ramipril 5 mg")]);
  const out = [{ index: 0, text: `${segments[0].text} (maximal 10 mg pro Tag)` }];

  expectIntegrityFailure(
    () => validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    "invented_numeric_value",
  );
});

test("an invented dosage line fails", () => {
  const { segments } = maskSegments([seg(0, "Ramipril 5 mg, 1-0-0")]);
  const out = [{ index: 0, text: `${segments[0].text}, zusätzlich 2-0-2` }];

  expectIntegrityFailure(
    () => validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    "invented_numeric_value",
  );
});

test("a dropped segment fails", () => {
  const { segments } = maskSegments(REPORT);
  const out = echo(segments).slice(0, -1);

  expectIntegrityFailure(
    () => validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    "segment_count_mismatch",
  );
});

test("an added segment fails", () => {
  const { segments } = maskSegments(REPORT);
  const out = [...echo(segments), { index: 99, text: "Zusätzlicher Hinweis." }];

  expectIntegrityFailure(
    () => validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    "segment_count_mismatch",
  );
});

test("reordered segments fail", () => {
  const { segments } = maskSegments(REPORT);
  const out = echo(segments);
  [out[1], out[2]] = [out[2], out[1]];

  expectIntegrityFailure(
    () => validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    "segment_index_mismatch",
  );
});

test("a renumbered segment fails", () => {
  const { segments } = maskSegments(REPORT);
  const out = echo(segments);
  out[2] = { index: 42, text: out[2].text };

  expectIntegrityFailure(
    () => validateMaskedOutput({ maskedSegments: segments, outputSegments: out, mode: TRANSLATION_MODES.STRICT }),
    "segment_index_mismatch",
  );
});

/* ------------------------------------------------------------ mode nuance */

test("strict mode rejects reordered markers within a segment", () => {
  const { segments } = maskSegments([seg(0, "CRP 1,5 mg/dl, Referenz 0,0–0,5 mg/dl")]);
  const [a, b] = findMarkers(segments[0].text);
  const swapped = segments[0].text.replace(a, "@@A@@").replace(b, a).replace("@@A@@", b);

  expectIntegrityFailure(
    () =>
      validateMaskedOutput({
        maskedSegments: segments,
        outputSegments: [{ index: 0, text: swapped }],
        mode: TRANSLATION_MODES.STRICT,
      }),
    "marker_order_changed",
  );
});

test("plain mode allows reordering but still requires completeness", () => {
  const { segments } = maskSegments([seg(0, "CRP 1,5 mg/dl, Referenz 0,0–0,5 mg/dl")]);
  const [a, b] = findMarkers(segments[0].text);
  const swapped = segments[0].text.replace(a, "@@A@@").replace(b, a).replace("@@A@@", b);

  assert.deepEqual(
    validateMaskedOutput({
      maskedSegments: segments,
      outputSegments: [{ index: 0, text: swapped }],
      mode: TRANSLATION_MODES.PLAIN,
    }),
    { ok: true },
  );

  // ...but dropping one is still fatal in plain mode.
  expectIntegrityFailure(
    () =>
      validateMaskedOutput({
        maskedSegments: segments,
        outputSegments: [{ index: 0, text: segments[0].text.replace(a, "") }],
        mode: TRANSLATION_MODES.PLAIN,
      }),
    "marker_missing",
  );
});

test("plain mode may split a segment into several sentences", () => {
  const { segments } = maskSegments([
    seg(0, "Die Einnahme von Ramipril 5 mg erfolgt morgens, 1-0-0, für 14 Tage."),
  ]);
  const markers = findMarkers(segments[0].text);
  const simplified = {
    index: 0,
    text: `Sie nehmen Ramipril ${markers[0]}. Das bedeutet: ${markers[1]}. Nehmen Sie es ${markers[2]} lang.`,
  };

  assert.deepEqual(
    validateMaskedOutput({
      maskedSegments: segments,
      outputSegments: [simplified],
      mode: TRANSLATION_MODES.PLAIN,
    }),
    { ok: true },
  );
});

/* ------------------------------------------------- self-check on masking */

test("assertMaskingComplete catches a gap in our own masking", () => {
  // Simulates a token pattern failing to cover something numeric.
  assert.throws(
    () => assertMaskingComplete([{ index: 0, text: "Rest 7 blieb stehen" }]),
    (err) =>
      err?.code === TRANSLATION_ERRORS.INTEGRITY_FAILED &&
      err.detail?.rule === "masking_incomplete",
  );
});

test("integrity errors carry no document content", () => {
  const { segments } = maskSegments([seg(0, "Ramipril 5 mg, Patientin Erika Mustermann")]);
  try {
    validateMaskedOutput({
      maskedSegments: segments,
      outputSegments: [{ index: 0, text: "Ramipril 50 mg, patient Erika Mustermann" }],
      mode: TRANSLATION_MODES.STRICT,
    });
    assert.fail("expected failure");
  } catch (err) {
    const serialized = JSON.stringify(err.detail);
    assert.ok(!serialized.includes("Erika"), "patient name leaked into integrity error");
    assert.ok(!serialized.includes("Ramipril"), "content leaked into integrity error");
  }
});

test("stripMarkers leaves no marker behind", () => {
  const { segments } = maskSegments(REPORT);
  for (const s of segments) {
    assert.equal(findMarkers(stripMarkers(s.text)).length, 0);
  }
});
