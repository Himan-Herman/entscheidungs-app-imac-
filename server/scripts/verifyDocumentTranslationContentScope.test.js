/**
 * Phase 2A.3 — content scope: what may be processed, and what must be refused.
 *
 * Four boundaries are proven here as behaviour:
 *
 *   1. A multi-part product name cannot be altered — substance, second
 *      substance, manufacturer suffix, release qualifier, device and form all
 *      live inside one opaque token.
 *   2. A written-out dosage is either masked atomically or refuses the document.
 *   3. Only German source documents are processed; anything else fails closed.
 *   4. The patient's own known identifiers are masked — and nobody else's.
 *
 * No model call, no network, no database.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  maskSegments,
  unmaskText,
} from "../services/documentTranslation/masking/criticalTokenMasking.js";
import { validateMaskedOutput } from "../services/documentTranslation/masking/maskedOutputValidation.js";
import {
  analyseUnprotectedDosages,
  assertDosageProtected,
} from "../services/documentTranslation/masking/medicationContextGuard.js";
import { buildPatientIdentifierPatterns } from "../services/documentTranslation/masking/patientIdentifierMasking.js";
import {
  assertLanguageNotContradicted,
  assertSupportedSourceLanguage,
  SUPPORTED_DOCUMENT_SOURCE_LANGUAGES,
} from "../services/documentTranslation/sourceLanguageGate.js";
import { prepareSegmentsForTranslation } from "../services/documentTranslation/translationPreparation.js";
import {
  TRANSLATION_ERRORS,
  TRANSLATION_MODES,
} from "../services/documentTranslation/documentTranslationPolicy.js";

const PATIENT = Object.freeze({
  firstName: "Max",
  lastName: "Mustermann",
  dateOfBirth: new Date(Date.UTC(1980, 7, 12)),
  email: "max.mustermann@example.de",
  phone: "+49 171 1234567",
  insuranceNumber: "A123456789",
  patientNumber: "P-4711",
});

function segmentsOf(lines) {
  return lines.map((text, index) => ({ index, kind: "paragraph", text }));
}

function maskOne(text, options) {
  return maskSegments([{ index: 0, kind: "paragraph", text }], options);
}

/**
 * @returns {"immune"|"rejected"|"accepted"} immune = never reached the model.
 */
function tamper(source, from, to, options) {
  const { segments } = maskOne(source, options);
  const tampered = segments[0].text.replace(from, to);
  if (tampered === segments[0].text) return "immune";
  try {
    validateMaskedOutput({
      maskedSegments: segments,
      outputSegments: [{ index: 0, text: tampered }],
      mode: TRANSLATION_MODES.STRICT,
    });
    return "accepted";
  } catch {
    return "rejected";
  }
}

/* ================================================================== */
/* 1. Multi-part medication names                                     */
/* ================================================================== */

const MULTI_PART = [
  "Insulin glargin 20 IE",
  "Insulin degludec 100 E/ml",
  "L-Thyroxin Henning 75 µg",
  "Amoxicillin/Clavulansäure 875/125 mg",
  "Metformin XR 1000 mg",
  "Ramipril HEXAL 5 mg",
  "Metoprololsuccinat 47,5 mg",
  "Vitamin D3 20.000 IE",
  "NovoRapid FlexPen",
  "Symbicort Turbohaler",
];

test("every multi-part product name masks to a single opaque token", () => {
  for (const source of MULTI_PART) {
    const { segments, tokens } = maskOne(source);
    assert.equal(tokens.length, 1, `${source} -> ${JSON.stringify(tokens)}`);
    assert.match(segments[0].text, /^⟦(?:MEDICATION|PRODUCT)_[A-Z]{4}⟧$/, source);
    assert.equal(tokens[0].original, source);
  }
});

test("multi-part names round trip byte for byte", () => {
  for (const source of MULTI_PART) {
    const { segments, tokenMap } = maskOne(source);
    assert.equal(unmaskText(segments[0].text, tokenMap), source);
  }
});

test("the active substance cannot be swapped", () => {
  const attacks = [
    ["Insulin glargin 20 IE", "glargin", "lispro"],
    ["Insulin degludec 100 E/ml", "degludec", "glargin"],
    ["Metoprololsuccinat 47,5 mg", "Metoprololsuccinat", "Metoprololtartrat"],
    ["Vitamin D3 20.000 IE", "D3", "D2"],
  ];
  for (const [source, from, to] of attacks) {
    assert.equal(tamper(source, from, to), "immune", `${source}: ${from} -> ${to}`);
  }
});

test("a second active substance cannot be removed or added", () => {
  // "Amoxicillin/Clavulansäure" is a different product from "Amoxicillin":
  // dropping the beta-lactamase inhibitor changes what the drug does.
  assert.equal(
    tamper("Amoxicillin/Clavulansäure 875/125 mg", "/Clavulansäure", ""),
    "immune",
  );
  assert.equal(
    tamper("Amoxicillin 875 mg", "Amoxicillin", "Amoxicillin/Clavulansäure"),
    "immune",
  );
});

test("a manufacturer suffix cannot be changed or dropped", () => {
  for (const [from, to] of [["HEXAL", "ratiopharm"], [" HEXAL", ""]]) {
    assert.equal(tamper("Ramipril HEXAL 5 mg", from, to), "immune", `${from} -> ${to}`);
  }
  assert.equal(tamper("L-Thyroxin Henning 75 µg", " Henning", ""), "immune");
});

test("a release qualifier cannot be dropped", () => {
  // Removing "XR" turns a modified-release product into an immediate-release
  // one at the same nominal strength.
  assert.equal(tamper("Metformin XR 1000 mg", " XR", ""), "immune");
});

test("a trade name identified only by its device cannot be changed", () => {
  assert.equal(tamper("NovoRapid FlexPen", "NovoRapid", "NovoMix"), "immune");
  assert.equal(tamper("Symbicort Turbohaler", "Symbicort", "Seretide"), "immune");
});

test("the dosage form cannot be changed", () => {
  assert.equal(tamper("NovoRapid FlexPen", "FlexPen", "SoloStar"), "immune");
  assert.equal(
    tamper("Ramipril HEXAL 5 mg Filmtabletten 1-0-0", "Filmtabletten", "Retardtabletten"),
    "immune",
  );
});

test("name, strength, form and schedule are one atom", () => {
  const source = "Ramipril HEXAL 5 mg Filmtabletten 1-0-0";
  const { tokens } = maskOne(source);
  assert.equal(tokens.length, 1, JSON.stringify(tokens));
  assert.equal(tokens[0].original, source);
});

test("keeping the dose and changing only the drug is impossible", () => {
  // The attack the Phase 2A masking allowed: markers all present, digits all
  // accounted for, different medication.
  assert.equal(tamper("Insulin glargin 20 IE", "Insulin glargin", "Insulin lispro"), "immune");
});

test("ordinary prose is still not swallowed by the medication rule", () => {
  // The counter-test that keeps the widened name pattern honest.
  for (const [source, mustSurvive] of [
    ["Die Einnahme von Ramipril 5 mg erfolgt morgens.", "erfolgt morgens."],
    ["Metformin 1000 mg morgens und abends einnehmen.", "morgens und abends einnehmen."],
    ["Sehr geehrte Kollegin, wir berichten ueber die Vorstellung.", "Sehr geehrte Kollegin"],
    ["Gewicht 80 kg", "Gewicht"],
    ["Temperatur 36,6 °C", "Temperatur"],
    ["CRP 1,5 mg/dl (0,0-0,5 mg/dl)", "("],
  ]) {
    assert.ok(maskOne(source).segments[0].text.includes(mustSurvive), source);
  }
});

/* ================================================================== */
/* 2. Written-out dosages                                             */
/* ================================================================== */

test("recognised written-out dosages are masked atomically", () => {
  const cases = [
    "fünf Milligramm",
    "zehn Milligramm",
    "eine Tablette",
    "zwei Tabletten",
    "eine halbe Tablette",
    "five milligrams",
    "one tablet",
    "two tablets",
    "half a tablet",
  ];
  for (const source of cases) {
    const { segments, tokens } = maskOne(source);
    assert.equal(tokens.length, 1, `${source} -> ${JSON.stringify(tokens)}`);
    assert.equal(tokens[0].kind, "WORDDOSE");
    assert.equal(unmaskText(segments[0].text, tokens[0] && new Map([[tokens[0].marker, tokens[0]]])), source);
  }
});

test("a written-out quantity cannot be changed", () => {
  for (const [source, from, to] of [
    ["fünf Milligramm", "fünf", "fünfzig"],
    ["eine Tablette", "eine", "zwei"],
    ["eine halbe Tablette", "halbe", "ganze"],
    ["one tablet", "one", "three"],
  ]) {
    assert.equal(tamper(source, from, to), "immune", `${source}: ${from} -> ${to}`);
  }
});

test("written-out frequencies are masked", () => {
  for (const source of ["zweimal täglich", "twice daily", "einmal täglich"]) {
    const { tokens } = maskOne(source);
    assert.equal(tokens[0]?.kind, "WORDFREQ", `${source} -> ${JSON.stringify(tokens)}`);
  }
});

test("timing words around a dose stay translatable", () => {
  assert.ok(maskOne("morgens eine Tablette").segments[0].text.startsWith("morgens "));
  assert.ok(maskOne("abends eine halbe Tablette").segments[0].text.startsWith("abends "));
});

test("a dosage unit with an unrecognised quantity refuses the document", () => {
  // The fail-closed half of the rule: recognised -> protected, unrecognised ->
  // refused. Nothing in between.
  for (const source of [
    "dreieinhalb Tabletten",
    "etliche Tropfen",
    "mehrere Kapseln",
  ]) {
    const { segments } = maskOne(source);
    const findings = analyseUnprotectedDosages(segments);
    assert.equal(findings.length, 1, `${source} -> ${segments[0].text}`);
  }
});

test("the dosage guard throws its own code, free of content", () => {
  const { segments } = maskOne("dreieinhalb Tabletten");
  try {
    assertDosageProtected(segments);
    assert.fail("expected refusal");
  } catch (err) {
    assert.equal(err.code, TRANSLATION_ERRORS.DOSAGE_UNVERIFIABLE);
    assert.ok(!/Tabletten/.test(JSON.stringify(err.detail)));
  }
});

test("a fully protected dosage passes the guard", () => {
  const { segments } = maskSegments(
    segmentsOf(["Ramipril 5 mg 1-0-0", "morgens eine Tablette", "zweimal täglich"]),
  );
  assert.deepEqual(assertDosageProtected(segments), { ok: true });
});

/* ================================================================== */
/* 3. Source language                                                 */
/* ================================================================== */

test("V1 supports German source documents only", () => {
  assert.deepEqual([...SUPPORTED_DOCUMENT_SOURCE_LANGUAGES], ["de"]);
  assert.equal(assertSupportedSourceLanguage("de"), "de");
  assert.equal(assertSupportedSourceLanguage("DE"), "de");
  assert.equal(assertSupportedSourceLanguage("de-DE"), "de");
});

test("every other source language is refused", () => {
  // Six UI TARGET languages does not mean six SOURCE languages: the medication
  // triggers, safe words, dosage vocabulary and negation cues are German.
  for (const code of ["en", "fr", "es", "it", "ru", "tr", "xx", "", null, undefined, 42]) {
    assert.throws(
      () => assertSupportedSourceLanguage(code),
      (err) => err.code === TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNSUPPORTED,
      `${code} was accepted as a source language`,
    );
  }
});

test("a German letter is not contradicted", () => {
  const german = segmentsOf([
    "Sehr geehrte Kollegin, sehr geehrter Kollege,",
    "wir berichten ueber die ambulante Vorstellung der Patientin.",
    "Der Verlauf war regelrecht und es wurde eine Kontrolle vereinbart.",
    "Die Medikation wurde nicht veraendert und gut vertragen.",
  ]);
  assert.deepEqual(assertLanguageNotContradicted(german, "de"), { ok: true, checked: true });
});

test("a non-Latin script contradicts a German declaration", () => {
  const russian = segmentsOf([
    "Уважаемые коллеги, мы сообщаем о амбулаторном обследовании пациентки.",
    "Течение было нормальным, назначен контрольный осмотр через месяц.",
  ]);
  assert.throws(
    () => assertLanguageNotContradicted(russian, "de"),
    (err) =>
      err.code === TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNCERTAIN &&
      err.detail?.reason === "script_mismatch",
  );
});

test("another Latin language contradicts a German declaration", () => {
  const english = segmentsOf([
    "Dear colleague, we report on the outpatient presentation of the patient.",
    "The course was uneventful and there was no evidence of complications.",
    "The patient has been advised that a follow-up will be arranged with us.",
  ]);
  assert.throws(
    () => assertLanguageNotContradicted(english, "de"),
    (err) => err.code === TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNCERTAIN,
  );

  const french = segmentsOf([
    "Cher confrère, nous vous adressons les résultats de la consultation.",
    "Le patient est dans une situation stable et nous avons prévu un contrôle.",
    "Les examens sont dans les limites de la normale pour cette patiente.",
  ]);
  assert.throws(
    () => assertLanguageNotContradicted(french, "de"),
    (err) => err.code === TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNCERTAIN,
  );
});

test("a mixed-language document is refused", () => {
  // The protections are not written for the other half of it.
  const mixed = segmentsOf([
    "Dear colleague, we report on the outpatient presentation of the patient.",
    "The course was uneventful and there was no evidence of complications.",
    "Уважаемые коллеги, мы сообщаем о результатах обследования пациентки.",
  ]);
  assert.throws(
    () => assertLanguageNotContradicted(mixed, "de"),
    (err) => err.code === TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNCERTAIN,
  );
});

test("a document too short to judge yields no verdict either way", () => {
  const short = segmentsOf(["Befund."]);
  assert.deepEqual(assertLanguageNotContradicted(short, "de"), { ok: true, checked: false });
});

/* ================================================================== */
/* 4. Patient identifiers                                             */
/* ================================================================== */

test("known patient identifiers are masked", () => {
  const expectations = [
    ["Patient: Max Mustermann", "PATIENTNAME"],
    ["MUSTERMANN, Max", "PATIENTNAME"],
    ["Max  Mustermann", "PATIENTNAME"],
    ["Herr Mustermann stellte sich vor.", "PATIENTLAST"],
    ["geboren am 12.08.1980", "PATIENTDOB"],
    ["Kontakt: max.mustermann@example.de", "PATIENTEMAIL"],
    ["Telefon +49 171 1234567", "PATIENTPHONE"],
    ["Versichertennummer A123456789", "PATIENTINSURANCE"],
    ["Patientennummer P-4711", "PATIENTNUMBER"],
  ];
  for (const [source, kind] of expectations) {
    const { tokens } = maskOne(source, { patientIdentity: PATIENT });
    assert.ok(
      tokens.some((t) => t.kind === kind),
      `${source} -> ${JSON.stringify(tokens.map((t) => t.kind))}`,
    );
  }
});

test("patient identifiers round trip byte for byte", () => {
  const lines = [
    "Patient: Max Mustermann",
    "MUSTERMANN, Max",
    "Max  Mustermann",
    "geboren am 12.08.1980",
    "Kontakt: max.mustermann@example.de",
    "Versichertennummer A123456789",
  ];
  const { segments, tokenMap } = maskSegments(segmentsOf(lines), { patientIdentity: PATIENT });
  segments.forEach((s, i) => {
    assert.equal(unmaskText(s.text, tokenMap), lines[i], `segment ${i} not restored`);
  });
});

test("a restored patient name is never spelled differently", () => {
  const source = "Patient: Max Mustermann";
  const { segments, tokenMap } = maskOne(source, { patientIdentity: PATIENT });
  // Stand in for a model that translated the surrounding word only.
  const translated = segments[0].text.replace("Patient:", "Patient:");
  const restored = unmaskText(translated, tokenMap);
  assert.equal(restored, source);
  assert.ok(restored.includes("Max Mustermann"));
});

test("the patient's name cannot be altered — it never reaches the model", () => {
  for (const [source, from, to] of [
    ["Patient: Max Mustermann", "Max Mustermann", "Moritz Mustermann"],
    ["Herr Mustermann war hier.", "Mustermann", "Musterman"],
  ]) {
    assert.equal(
      tamper(source, from, to, { patientIdentity: PATIENT }),
      "immune",
      `${source}: ${from} -> ${to}`,
    );
  }
});

test("OTHER people in the letter are not masked", () => {
  // The rule is "values the database asserts about THIS patient", not "anything
  // that looks like a person". A treating physician, a relative and a contact
  // must survive untouched.
  for (const source of [
    "Behandelnde Aerztin: Dr. Anna Schmidt",
    "Ueberweisung an Dr. Max Schmidt",
    "Angehoerige: Erika Beispiel",
    "Rueckfragen an Frau Dr. Meier.",
  ]) {
    const { segments, tokens } = maskOne(source, { patientIdentity: PATIENT });
    assert.equal(
      tokens.filter((t) => t.kind.startsWith("PATIENT")).length,
      0,
      `${source} -> ${segments[0].text}`,
    );
  }
});

test("a shared given name belonging to somebody else is left alone", () => {
  // "Dr. Max Schmidt" shares the patient's given name. Masking it would be
  // treating another person's name as the patient's.
  const { segments } = maskOne("Ueberweisung an Dr. Max Schmidt", {
    patientIdentity: PATIENT,
  });
  assert.ok(segments[0].text.includes("Max Schmidt"), segments[0].text);
});

test("no patient patterns are built without an identity", () => {
  assert.deepEqual(buildPatientIdentifierPatterns(null), []);
  assert.deepEqual(buildPatientIdentifierPatterns({}), []);
  // A one-character name is not distinctive enough to mask.
  assert.deepEqual(buildPatientIdentifierPatterns({ firstName: "M", lastName: "" }), []);
});

test("patient marker kinds are parsable", () => {
  for (const { kind } of buildPatientIdentifierPatterns(PATIENT)) {
    assert.match(kind, /^[A-Z]+$/, kind);
  }
});

/* ================================================================== */
/* 5. Canonical pipeline                                              */
/* ================================================================== */

const GERMAN_LETTER = [
  "Sehr geehrte Kollegin, sehr geehrter Kollege,",
  "wir berichten ueber die ambulante Vorstellung von Max Mustermann.",
  "Der Verlauf war regelrecht und es wurde eine Kontrolle vereinbart.",
  "Ramipril 5 mg, 1-0-0",
  "Kein Hinweis auf einen Infekt.",
];

test("the pipeline produces a payload with masked text and polarity only", () => {
  const { outbound, sourceLanguage, stats, tokenMap } = prepareSegmentsForTranslation({
    segments: segmentsOf(GERMAN_LETTER),
    sourceLanguage: "de",
    patientIdentity: PATIENT,
  });

  assert.equal(sourceLanguage, "de");
  assert.equal(outbound.length, GERMAN_LETTER.length);
  assert.deepEqual(Object.keys(outbound[0]).sort(), ["index", "kind", "polarity", "text"]);
  assert.equal(outbound[4].polarity, "negated");
  assert.ok(stats.patientIdentifierTokens > 0);

  const payload = JSON.stringify(outbound);
  assert.ok(!payload.includes("Mustermann"), "patient name reached the payload");
  assert.ok(!payload.includes("Ramipril"), "medication reached the payload");
  assert.ok(tokenMap.size > 0);
});

test("the pipeline enforces the source-language gate first", () => {
  for (const code of ["en", "ru", undefined]) {
    assert.throws(
      () =>
        prepareSegmentsForTranslation({
          segments: segmentsOf(GERMAN_LETTER),
          sourceLanguage: code,
        }),
      (err) => err.code === TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNSUPPORTED,
    );
  }
});

test("the pipeline refuses a document whose language contradicts the declaration", () => {
  assert.throws(
    () =>
      prepareSegmentsForTranslation({
        segments: segmentsOf([
          "Dear colleague, we report on the outpatient presentation of the patient.",
          "The course was uneventful and there was no evidence of complications.",
          "The patient has been advised that a follow-up will be arranged with us.",
        ]),
        sourceLanguage: "de",
      }),
    (err) => err.code === TRANSLATION_ERRORS.SOURCE_LANGUAGE_UNCERTAIN,
  );
});

test("the pipeline refuses unprotectable medication and dosage", () => {
  assert.throws(
    () =>
      prepareSegmentsForTranslation({
        segments: segmentsOf([...GERMAN_LETTER, "Gabe von Quensyl erfolgt."]),
        sourceLanguage: "de",
      }),
    (err) => err.code === TRANSLATION_ERRORS.MEDICATION_UNVERIFIABLE,
  );

  assert.throws(
    () =>
      prepareSegmentsForTranslation({
        // No medication trigger in this line, so the dosage guard is the one
        // that fires rather than the medication guard.
        segments: segmentsOf([...GERMAN_LETTER, "Dosierung: dreieinhalb Tabletten"]),
        sourceLanguage: "de",
      }),
    (err) => err.code === TRANSLATION_ERRORS.DOSAGE_UNVERIFIABLE,
  );
});

test("the pipeline validates segment structure", () => {
  assert.throws(
    () => prepareSegmentsForTranslation({ segments: [], sourceLanguage: "de" }),
    (err) => err.code === TRANSLATION_ERRORS.TEXT_UNAVAILABLE,
  );
  assert.throws(
    () =>
      prepareSegmentsForTranslation({
        segments: [{ index: 5, kind: "paragraph", text: "Verschobener Index." }],
        sourceLanguage: "de",
      }),
    (err) =>
      err.code === TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED &&
      err.detail?.reason === "segment_index_not_sequential",
  );
});

test("polarity is read before masking replaces the wording", () => {
  // Running it after masking would analyse markers instead of language.
  const { outbound } = prepareSegmentsForTranslation({
    segments: segmentsOf(["Kein Hinweis auf einen Infekt bei diesem Patienten heute."]),
    sourceLanguage: "de",
  });
  assert.equal(outbound[0].polarity, "negated");
});
