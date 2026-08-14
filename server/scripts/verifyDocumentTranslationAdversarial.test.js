/**
 * Adversarial audit of the document translation substrate.
 *
 * Every test here started as an attack that SUCCEEDED against the Phase 2A
 * implementation. They are kept as regression guards so the same gaps cannot
 * quietly reopen.
 *
 * Three families:
 *   1. Content tampering a model could perform while passing every marker check
 *   2. Container attacks against the DOCX and PDF parsers
 *   3. Layouts whose reading order cannot be trusted
 *
 * No model call, no network, no database. Container fixtures are synthetic and
 * declare their sizes rather than containing them, so nothing large or
 * dangerous is ever written or unpacked.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  maskSegments,
  unmaskText,
  findUnmaskedDigits,
} from "../services/documentTranslation/masking/criticalTokenMasking.js";
import { validateMaskedOutput } from "../services/documentTranslation/masking/maskedOutputValidation.js";
import {
  TRANSLATION_ERRORS,
  TRANSLATION_MODES,
} from "../services/documentTranslation/documentTranslationPolicy.js";
import { extractDocumentText } from "../services/documentTranslation/extraction/documentTextExtractionService.js";
import {
  assertSafeDocxContainer,
  ZIP_LIMITS,
} from "../services/documentTranslation/extraction/zipPreflight.js";
import {
  analysePageLayout,
  assertSafePdfContainer,
  PDF_LIMITS,
} from "../services/documentTranslation/extraction/pdfPreflight.js";
import {
  cell,
  docx,
  docxEntryList,
  para,
  pdfWithDeepNesting,
  pdfWithManyObjects,
  syntheticZip,
  tabularPdf,
  table,
  textPdf,
  twoColumnPdf,
} from "./lib/documentTranslationFixtures.js";

const MIME_PDF = "application/pdf";
const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const BODY = [
  "Sehr geehrte Kollegin, sehr geehrter Kollege,",
  "wir berichten ueber die ambulante Vorstellung der Patientin.",
  "Die Medikation wurde angepasst und gut vertragen.",
  "Eine Kontrolle wurde vereinbart und dokumentiert.",
];

/**
 * Try to tamper with `from` in the masked text and see whether validation
 * catches it.
 *
 * @returns {"immune"|"rejected"|"accepted"} immune = the token never reached
 *   the model at all, which is the strongest outcome.
 */
function tamper(source, from, to, mode = TRANSLATION_MODES.STRICT) {
  const { segments } = maskSegments([{ index: 0, kind: "paragraph", text: source }]);
  const masked = segments[0].text;
  const tampered = masked.replace(from, to);

  if (tampered === masked) return "immune";

  try {
    validateMaskedOutput({
      maskedSegments: segments,
      outputSegments: [{ index: 0, text: tampered }],
      mode,
    });
    return "accepted";
  } catch (err) {
    return err?.code === TRANSLATION_ERRORS.INTEGRITY_FAILED ? "rejected" : "accepted";
  }
}

function maskedTextOf(source) {
  return maskSegments([{ index: 0, kind: "paragraph", text: source }]).segments[0].text;
}

async function codeFor(buffer, mimeType, documentType = "report") {
  try {
    await extractDocumentText({ buffer, mimeType, documentType });
    return "__RESOLVED__";
  } catch (err) {
    return err?.code ?? `__UNEXPECTED__:${err?.message}`;
  }
}

/* ================================================================== */
/* 1. Medication tampering                                            */
/* ================================================================== */

test("a drug name cannot be swapped — it never reaches the model", () => {
  // The Phase 2A gap: only "5 mg" was masked, so "Ramipril" -> "Lisinopril"
  // passed every marker check and every digit check.
  const attacks = [
    ["Ramipril 5 mg", "Ramipril", "Lisinopril"],
    ["Ramipril 5 mg", "Ramipril", "Ramiprilol"],
    ["Metoprolol 47,5 mg", "Metoprolol", "Bisoprolol"],
    ["ASS 100 mg 1-0-0", "ASS", "Clopidogrel"],
    ["L-Thyroxin 75 µg", "L-Thyroxin", "Levothyroxin"],
    ["Metformin 1000 mg morgens und abends", "Metformin", "Insulin"],
    ["Pantoprazol 40 mg 1-0-0", "Pantoprazol", "Omeprazol"],
  ];

  for (const [source, from, to] of attacks) {
    assert.equal(tamper(source, from, to), "immune", `${source}: ${from} -> ${to} got through`);
  }
});

test("name, strength and schedule form one inseparable token", () => {
  const { tokens } = maskSegments([
    { index: 0, kind: "paragraph", text: "ASS 100 mg 1-0-0" },
  ]);
  assert.equal(tokens.length, 1, JSON.stringify(tokens));
  assert.equal(tokens[0].kind, "MEDICATION");
  assert.equal(tokens[0].original, "ASS 100 mg 1-0-0");
});

test("a medication line masks to nothing but a marker", () => {
  for (const source of [
    "Ramipril 5 mg",
    "Metoprolol 47,5 mg",
    "ASS 100 mg 1-0-0",
    "L-Thyroxin 75 µg",
  ]) {
    assert.equal(maskedTextOf(source), maskedTextOf(source).trim());
    assert.match(maskedTextOf(source), /^⟦MEDICATION_[A-Z]{4}⟧$/, source);
  }
});

test("medication round trips byte for byte", () => {
  for (const source of [
    "Ramipril 5 mg",
    "Metoprolol 47,5 mg",
    "ASS 100 mg 1-0-0",
    "L-Thyroxin 75 µg",
    "Metformin 1000 mg morgens und abends",
  ]) {
    const { segments, tokenMap } = maskSegments([{ index: 0, kind: "p", text: source }]);
    assert.equal(unmaskText(segments[0].text, tokenMap), source);
  }
});

test("prose around a medication stays translatable", () => {
  // Over-masking would be safe but useless. The sentence must still be language.
  const masked = maskedTextOf("Metformin 1000 mg morgens und abends einnehmen.");
  assert.ok(masked.includes("morgens und abends einnehmen."), masked);
});

test("a bare drug name is protected by the curated list or an INN stem", () => {
  for (const [source, from, to] of [
    ["Der Patient nimmt Ramipril weiter.", "Ramipril", "Enalapril"],
    ["Therapie mit Pantoprazol fortgefuehrt.", "Pantoprazol", "Omeprazol"],
    ["Wir haben Bisoprolol angesetzt.", "Bisoprolol", "Metoprolol"],
    ["Gabe von Amoxicillin erfolgt.", "Amoxicillin", "Ampicillin"],
    ["Unter Atorvastatin stabil.", "Atorvastatin", "Simvastatin"],
  ]) {
    assert.equal(tamper(source, from, to), "immune", `${source}: ${from} -> ${to}`);
  }
});

test("measurement labels are NOT masked, so the text stays readable", () => {
  // The counterpart to the rule above: "Gewicht" and "Temperatur" are not
  // analytes, their values are masked anyway, and masking every label word
  // would leave the patient with an untranslated document.
  for (const source of ["Gewicht 80 kg", "Temperatur 36,6 °C", "Groesse 175 cm"]) {
    const masked = maskedTextOf(source);
    assert.ok(/[A-Za-zÄÖÜäöü]{4,}/.test(masked.replace(/⟦[^⟧]+⟧/g, "")), masked);
  }
});

/* ================================================================== */
/* 2. Abbreviations and analytes                                      */
/* ================================================================== */

test("clinical abbreviations cannot be expanded or swapped", () => {
  const attacks = [
    ["CRP 1,5 mg/dl", "CRP", "C-reaktives Protein"],
    ["HbA1c 6,2 %", "HbA1c", "Langzeitzucker"],
    ["SpO2 97 %", "SpO2", "Sauerstoffsaettigung"],
    ["INR 2,5", "INR", "Gerinnungswert"],
    ["TSH 1,2 mU/l", "TSH", "Schilddruesenwert"],
    ["MRT der LWS", "MRT", "CT"],
    ["EKG unauffaellig", "EKG", "EEG"],
    ["CT Thorax", "CT", "MRT"],
  ];
  for (const [source, from, to] of attacks) {
    assert.equal(tamper(source, from, to), "immune", `${source}: ${from} -> ${to}`);
  }
});

test("alphanumeric abbreviations survive the numeric passes intact", () => {
  // Phase 2A bug: the catch-all NUM pass shredded "HbA1c" into "HbA⟦NUM⟧c",
  // handing the model a broken identifier it could reassemble any way it liked.
  for (const abbrev of ["HbA1c", "SpO2", "fT3", "fT4", "CK-MB", "NT-proBNP"]) {
    const { tokens } = maskSegments([{ index: 0, kind: "p", text: `${abbrev} bestimmt` }]);
    const kinds = tokens.map((t) => `${t.kind}:${t.original}`);
    assert.deepEqual(kinds, [`ABBREV:${abbrev}`], JSON.stringify(kinds));
  }
});

test("laboratory analyte names cannot be swapped", () => {
  for (const [source, from, to] of [
    ["Kalium 4,2 mmol/l", "Kalium", "Natrium"],
    ["Kreatinin 0,9 mg/dl", "Kreatinin", "Harnstoff"],
    ["Ferritin 120 ng/ml", "Ferritin", "Transferrin"],
  ]) {
    assert.equal(tamper(source, from, to), "immune", `${source}: ${from} -> ${to}`);
  }
});

test("classification codes cannot be altered", () => {
  for (const [source, from, to] of [
    ["ICD-10: I10", "I10", "I11"],
    ["Diagnose E11.9", "E11.9", "E10.9"],
    ["OPS 5-820.00 durchgefuehrt", "5-820.00", "5-821.00"],
    ["ICD-10 Kodierung", "ICD-10", "ICD-11"],
  ]) {
    assert.equal(tamper(source, from, to), "immune", `${source}: ${from} -> ${to}`);
  }
});

test("an OPS code is not mistaken for a reference range", () => {
  const { tokens } = maskSegments([{ index: 0, kind: "p", text: "Eingriff 5-820.00" }]);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].kind, "OPS");
  assert.equal(tokens[0].original, "5-820.00");
});

test("the digit-residue invariant survives the new token kinds", () => {
  const lines = [
    "Ramipril 5 mg, 1-0-0",
    "CRP 1,5 mg/dl (0,0–0,5 mg/dl)",
    "HbA1c 6,2 %",
    "SpO2 97 %",
    "ICD-10: I10, OPS 5-820.00",
    "Kontrolle am 12.08.2026 um 14:30",
  ];
  const { segments } = maskSegments(
    lines.map((text, index) => ({ index, kind: "paragraph", text })),
  );
  for (const s of segments) {
    assert.deepEqual(findUnmaskedDigits(s.text), [], `${s.index}: ${s.text}`);
  }
});

/* ================================================================== */
/* 3. DOCX container attacks                                          */
/* ================================================================== */

test("a declared zip bomb is refused before decompression", () => {
  // 300 KB on disk declaring 2 GB expanded. The declared sizes are what a
  // preflight can see, and they are enough to refuse.
  const bomb = syntheticZip(
    docxEntryList([
      { name: "word/media/image1.png", compressedSize: 300_000, uncompressedSize: 2_000_000_000 },
    ]),
  );
  assert.throws(
    () => assertSafeDocxContainer(bomb),
    (err) => err.code === TRANSLATION_ERRORS.TOO_LARGE,
  );
});

test("an extreme compression ratio is refused", () => {
  const bomb = syntheticZip(
    docxEntryList([
      { name: "word/theme/theme1.xml", compressedSize: 1_000, uncompressedSize: 30_000_000 },
    ]),
  );
  assert.throws(
    () => assertSafeDocxContainer(bomb),
    (err) =>
      err.code === TRANSLATION_ERRORS.TOO_LARGE &&
      /ratio|entry_size/.test(String(err.detail?.reason)),
  );
});

test("too many zip entries are refused", () => {
  const many = Array.from({ length: ZIP_LIMITS.MAX_ENTRIES + 20 }, (_unused, i) => ({
    name: `word/media/image${i}.png`,
    compressedSize: 10,
    uncompressedSize: 20,
  }));
  assert.throws(
    () => assertSafeDocxContainer(syntheticZip(docxEntryList(many))),
    (err) =>
      err.code === TRANSLATION_ERRORS.TOO_LARGE && err.detail?.reason === "zip_entry_count",
  );
});

test("cumulative uncompressed size is capped across entries", () => {
  // No single entry breaches the per-entry cap; together they do.
  const chunks = Array.from({ length: 8 }, (_unused, i) => ({
    name: `word/media/i${i}.png`,
    compressedSize: 1_000_000,
    uncompressedSize: 20_000_000,
  }));
  assert.throws(
    () => assertSafeDocxContainer(syntheticZip(docxEntryList(chunks))),
    (err) => err.code === TRANSLATION_ERRORS.TOO_LARGE,
  );
});

test("a macro-enabled container is refused", () => {
  const withMacro = syntheticZip(
    docxEntryList([{ name: "word/vbaProject.bin", compressedSize: 500, uncompressedSize: 2_000 }]),
  );
  assert.throws(
    () => assertSafeDocxContainer(withMacro),
    (err) =>
      err.code === TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED &&
      err.detail?.reason === "macro_project",
  );
});

test("an embedded OLE object is refused", () => {
  const withOle = syntheticZip(
    docxEntryList([
      { name: "word/embeddings/oleObject1.bin", compressedSize: 500, uncompressedSize: 2_000 },
    ]),
  );
  assert.throws(
    () => assertSafeDocxContainer(withOle),
    (err) => err.code === TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED,
  );
});

test("path traversal in an entry name is refused", () => {
  for (const name of ["../../etc/passwd", "/absolute/path.xml", "word\\document.xml"]) {
    assert.throws(
      () => assertSafeDocxContainer(syntheticZip(docxEntryList([
        { name, compressedSize: 10, uncompressedSize: 20 },
      ]))),
      (err) => err.code === TRANSLATION_ERRORS.CORRUPT,
      `${name} was accepted`,
    );
  }
});

test("a zip without word/document.xml is not a DOCX", () => {
  const notDocx = syntheticZip([
    { name: "readme.txt", compressedSize: 10, uncompressedSize: 20 },
  ]);
  assert.throws(
    () => assertSafeDocxContainer(notDocx),
    (err) => err.code === TRANSLATION_ERRORS.CORRUPT && err.detail?.reason === "not_a_docx",
  );
});

test("a legitimate DOCX passes the preflight", async () => {
  const buf = await docx(para("Arztbrief", "Heading1") + para(BODY[0]) + para(BODY[1]));
  const result = assertSafeDocxContainer(buf);
  assert.ok(result.entryCount > 0);
  assert.ok(result.names.includes("word/document.xml"));
});

test("the preflight is wired into the extraction path", async () => {
  const bomb = syntheticZip(
    docxEntryList([
      { name: "word/media/x.png", compressedSize: 100, uncompressedSize: 900_000_000 },
    ]),
  );
  assert.equal(await codeFor(bomb, MIME_DOCX), TRANSLATION_ERRORS.TOO_LARGE);
});

test("mammoth external file access stays disabled", () => {
  // mammoth reads external image targets from the local filesystem when
  // externalFileAccess is truthy (lib/docx/files.js). Enabling it would turn a
  // crafted document into a local-file-read primitive.
  const source = readFileSync(
    new URL(
      "../services/documentTranslation/extraction/docxTextExtractor.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(
    !/externalFileAccess\s*:\s*(true|1)/.test(source),
    "externalFileAccess must never be enabled",
  );
});

/* ================================================================== */
/* 4. PDF container attacks                                           */
/* ================================================================== */

test("a small PDF declaring a huge object graph is refused", () => {
  const bomb = pdfWithManyObjects(PDF_LIMITS.MAX_OBJECTS + 500);
  assert.throws(
    () => assertSafePdfContainer(bomb),
    (err) =>
      err.code === TRANSLATION_ERRORS.TOO_LARGE && err.detail?.reason === "pdf_object_count",
  );
});

test("deeply nested dictionaries are refused", () => {
  assert.throws(
    () => assertSafePdfContainer(pdfWithDeepNesting(PDF_LIMITS.MAX_DICT_NESTING + 20)),
    (err) =>
      err.code === TRANSLATION_ERRORS.TOO_LARGE &&
      err.detail?.reason === "pdf_dictionary_nesting",
  );
});

test("a file without a PDF header is refused before parsing", () => {
  assert.throws(
    () => assertSafePdfContainer(Buffer.from("just some bytes".repeat(100))),
    (err) => err.code === TRANSLATION_ERRORS.CORRUPT,
  );
});

test("a legitimate PDF passes the preflight", async () => {
  const buf = await textPdf([BODY]);
  const stats = assertSafePdfContainer(buf);
  assert.ok(stats.objectCount > 0);
  assert.ok(stats.nesting < PDF_LIMITS.MAX_DICT_NESTING);
});

test("the PDF preflight is wired into the extraction path", async () => {
  assert.equal(
    await codeFor(pdfWithManyObjects(PDF_LIMITS.MAX_OBJECTS + 500), MIME_PDF),
    TRANSLATION_ERRORS.TOO_LARGE,
  );
});

/* ================================================================== */
/* 5. PDF reading order                                               */
/* ================================================================== */

test("a two-column PDF is refused rather than translated in stream order", async () => {
  // A PDF can have a perfect text layer and still extract in an order nobody
  // reads it in. For a clinical letter that reorders content silently.
  const code = await codeFor(await twoColumnPdf(), MIME_PDF);
  assert.equal(code, TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED);
});

test("a wide tabular PDF is refused", async () => {
  // Note: this fixture is caught by the column detector rather than the table
  // detector — a four-column grid also splits cleanly at the page midpoint.
  // Both are correct refusals; the table rule is covered directly below.
  assert.equal(
    await codeFor(await tabularPdf(), MIME_PDF),
    TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED,
  );
});

test("the table rule fires on a grid that no gutter separates", () => {
  // A header spanning the page defeats the column detector, so this exercises
  // detectTabularLayout on its own rather than relying on the column rule.
  const items = [
    { str: "Uebersicht der Messwerte im Verlauf", x: 60, y: 800, width: 470, height: 11 },
  ];
  for (let row = 0; row < 5; row += 1) {
    const y = 760 - row * 22;
    [60, 200, 340, 470].forEach((x) => {
      items.push({ str: `R${row}`, x, y, width: 30, height: 11 });
    });
  }

  const result = analysePageLayout(items, { width: 595, height: 842 });
  assert.equal(result.complex, true);
  assert.equal(result.reason, "tabular_layout");
  assert.ok(result.metrics.tabularRows >= 3, JSON.stringify(result.metrics));
});

test("the two-column refusal names the column rule", async () => {
  try {
    await extractDocumentText({
      buffer: await twoColumnPdf(),
      mimeType: MIME_PDF,
      documentType: "report",
    });
    assert.fail("expected refusal");
  } catch (err) {
    assert.equal(err.detail?.reason, "multi_column_layout");
    assert.equal(err.detail?.gutterCrossingItems, 0);
  }
});

test("layout metrics carry geometry only, never document text", () => {
  const items = Array.from({ length: 20 }, (_unused, i) => ({
    str: "Ramipril 5 mg Patientin Erika Mustermann",
    x: i % 2 === 0 ? 60 : 340,
    y: 700 - Math.floor(i / 2) * 20,
    width: 100,
    height: 11,
  }));
  const result = analysePageLayout(items, { width: 595, height: 842 });
  const serialized = JSON.stringify(result.metrics);
  assert.ok(!/Ramipril|Erika|Mustermann/.test(serialized), serialized);
});

test("an ordinary single-flow letter is still accepted", async () => {
  // The counter-test that keeps the layout rules from rejecting everything.
  const result = await extractDocumentText({
    buffer: await textPdf([BODY, BODY]),
    mimeType: MIME_PDF,
    documentType: "report",
  });
  assert.ok(result.segments.length > 0);
  assert.equal(result.pageCount, 2);
});

test("a letter with a short right-aligned date block is not called two-column", async () => {
  // Guard against the obvious false positive: a letterhead is not a column.
  const pages = [[
    "Praxis Dr. Muster                         12.08.2026",
    ...BODY,
    ...BODY,
  ]];
  const result = await extractDocumentText({
    buffer: await textPdf(pages),
    mimeType: MIME_PDF,
    documentType: "report",
  });
  assert.ok(result.segments.length > 0);
});

/* ================================================================== */
/* 6. Structural integrity of the DOCX path                           */
/* ================================================================== */

test("a DOCX table still keeps column association", async () => {
  const buf = await docx(
    para(BODY[0]) +
      table([cell("Medikament") + cell("Dosis"), cell("Ramipril") + cell("5 mg")]),
  );
  const result = await extractDocumentText({
    buffer: buf,
    mimeType: MIME_DOCX,
    documentType: "report",
  });
  const rows = result.segments.filter((s) => s.kind === "table_row");
  assert.deepEqual(rows[1].cells, ["Ramipril", "5 mg"]);
});

/* ================================================================== */
/* 7. Documented limits                                               */
/* ================================================================== */

test("KNOWN LIMIT: a rare bare drug name is not protected", () => {
  // No drug lexicon is used, so a substance that is neither on the curated list
  // nor carries an INN stem, written without a strength, cannot be recognised.
  // Stated rather than engineered around.
  assert.equal(tamper("Gabe von Quensyl erfolgt.", "Quensyl", "Resochin"), "accepted");
});

test("KNOWN LIMIT: a lowercase drug name without a strength is not protected", () => {
  assert.equal(tamper("continued on warfarin therapy", "warfarin", "heparin"), "accepted");
});

test("KNOWN LIMIT: multi-word substance names are captured only up to the first word", () => {
  const { tokens } = maskSegments([
    { index: 0, kind: "p", text: "Insulin glargin 20 IE" },
  ]);
  // "glargin 20 IE" is the medication token; "Insulin" is caught separately by
  // the curated name list rather than being part of the same atom.
  assert.ok(tokens.length >= 1);
  assert.ok(tokens.some((t) => t.original.includes("20 IE")));
});

test("KNOWN LIMIT: an abbreviation outside the curated list is not protected", () => {
  assert.equal(tamper("PAVK bekannt", "PAVK", "KHK"), "accepted");
});

test("KNOWN LIMIT: quantities written as words are not maskable", () => {
  assert.equal(
    tamper("fuenf Milligramm taeglich", "fuenf", "fuenfzig"),
    "accepted",
  );
});
