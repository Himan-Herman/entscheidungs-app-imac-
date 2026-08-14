/**
 * Local document text extraction.
 *
 * Two properties are under test:
 *
 *   1. The formats that genuinely work — PDF with a real text layer, and DOCX —
 *      produce an ordered segment list whose structural labels come from the
 *      parser rather than from guesswork.
 *
 *   2. Everything else is refused with a specific, stable code. In particular a
 *      scan without a text layer must NOT come back as a handful of characters
 *      that would then be translated and presented as the whole document.
 *
 * Local only: no OCR, no vision model, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { extractDocumentText } from "../services/documentTranslation/extraction/documentTextExtractionService.js";
import {
  TRANSLATION_ERRORS,
  TRANSLATION_LIMITS,
} from "../services/documentTranslation/documentTranslationPolicy.js";
import {
  cell,
  corruptPdf,
  docx,
  encryptedPdf,
  legacyDoc,
  listItem,
  para,
  pngImage,
  scannedPdf,
  table,
  textPdf,
} from "./lib/documentTranslationFixtures.js";

const MIME_PDF = "application/pdf";
const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Enough text per page to clear the plausibility floor. */
const BODY = [
  "Sehr geehrte Kollegin, sehr geehrter Kollege,",
  "wir berichten ueber die ambulante Vorstellung der Patientin.",
  "Die Medikation wurde angepasst und gut vertragen.",
  "Eine Kontrolle wurde vereinbart und dokumentiert.",
  "Mit freundlichen kollegialen Gruessen",
];

async function extract(buffer, mimeType, documentType = "report") {
  return extractDocumentText({ buffer, mimeType, documentType });
}

/** @returns {Promise<string>} error code, or "__RESOLVED__" if it wrongly succeeded */
async function codeFor(buffer, mimeType, documentType = "report") {
  try {
    await extract(buffer, mimeType, documentType);
    return "__RESOLVED__";
  } catch (err) {
    return err?.code ?? `__UNEXPECTED__:${err?.message}`;
  }
}

/* ------------------------------------------------------------------ PDF */

test("a single-page text PDF extracts", async () => {
  const result = await extract(await textPdf([BODY]), MIME_PDF);

  assert.equal(result.sourceFormat, "pdf");
  assert.equal(result.pageCount, 1);
  assert.equal(result.structureReliable, false);
  assert.ok(result.segments.length > 0);
  assert.ok(result.totalChars > 100);
});

test("a multi-page text PDF keeps page numbers and segment order", async () => {
  const result = await extract(await textPdf([BODY, BODY, BODY]), MIME_PDF);

  assert.equal(result.pageCount, 3);
  assert.deepEqual(
    result.segments.map((s) => s.index),
    result.segments.map((_, i) => i),
    "segment indices must be a stable 0..n-1 sequence",
  );

  const pages = [...new Set(result.segments.map((s) => s.page))];
  assert.deepEqual(pages, [1, 2, 3], "pages must appear in document order");
});

test("PDF segments never claim semantic structure", async () => {
  // A PDF text layer carries no headings or table rows. Labelling one would be
  // invented structure, so every PDF segment is a layout block.
  const result = await extract(await textPdf([BODY]), MIME_PDF);
  for (const s of result.segments) {
    assert.equal(s.kind, "text_block", `unexpected kind ${s.kind}`);
  }
});

test("PDF content survives extraction verbatim", async () => {
  const result = await extract(
    await textPdf([["Ramipril 5 mg, 1-0-0", "CRP 1,5 mg/dl (0,0-0,5)", ...BODY]]),
    MIME_PDF,
  );
  const all = result.segments.map((s) => s.text).join("\n");
  assert.ok(all.includes("Ramipril 5 mg, 1-0-0"), all);
  assert.ok(all.includes("CRP 1,5 mg/dl (0,0-0,5)"), all);
});

test("a scan without a text layer is refused, not partially processed", async () => {
  assert.equal(await codeFor(await scannedPdf(3), MIME_PDF), TRANSLATION_ERRORS.TEXT_UNAVAILABLE);
});

test("a scan with only a stamp on page one is refused", async () => {
  // The dangerous case: extraction "succeeds" with a few characters, and the
  // remaining pages would silently vanish from the translation.
  const pages = [["Eingang 12.08.2026"], [], [], [], []];
  assert.equal(await codeFor(await textPdf(pages), MIME_PDF), TRANSLATION_ERRORS.TEXT_UNAVAILABLE);
});

test("text on the cover sheet only fails the page-coverage floor", async () => {
  const pages = [BODY, BODY, [], [], [], []];
  assert.equal(await codeFor(await textPdf(pages), MIME_PDF), TRANSLATION_ERRORS.TEXT_UNAVAILABLE);
});

test("a fully empty PDF is refused", async () => {
  assert.equal(await codeFor(await scannedPdf(1), MIME_PDF), TRANSLATION_ERRORS.TEXT_UNAVAILABLE);
});

test("a corrupt PDF is refused as corrupt", async () => {
  assert.equal(await codeFor(corruptPdf(), MIME_PDF), TRANSLATION_ERRORS.CORRUPT);
});

test("a password-protected PDF is refused as encrypted", async () => {
  assert.equal(await codeFor(encryptedPdf(), MIME_PDF), TRANSLATION_ERRORS.ENCRYPTED);
});

test("an empty buffer is refused", async () => {
  assert.equal(await codeFor(Buffer.alloc(0), MIME_PDF), TRANSLATION_ERRORS.CORRUPT);
});

test("a PDF beyond the page limit is refused before extraction", async () => {
  const pages = Array.from({ length: TRANSLATION_LIMITS.MAX_PAGES + 1 }, () => BODY);
  assert.equal(await codeFor(await textPdf(pages), MIME_PDF), TRANSLATION_ERRORS.TOO_LARGE);
});

/* ----------------------------------------------------------------- DOCX */

test("a DOCX with paragraphs extracts with parser-derived kinds", async () => {
  const buf = await docx(para("Arztbrief", "Heading1") + para("Ramipril 5 mg, 1-0-0") + para(BODY[1]));
  const result = await extract(buf, MIME_DOCX);

  assert.equal(result.sourceFormat, "docx");
  assert.equal(result.pageCount, null);
  assert.equal(result.structureReliable, true);
  assert.deepEqual(
    result.segments.map((s) => s.kind),
    ["heading", "paragraph", "paragraph"],
  );
  assert.equal(result.segments[0].text, "Arztbrief");
  assert.equal(result.segments[1].text, "Ramipril 5 mg, 1-0-0");
});

test("a DOCX list produces list_item segments", async () => {
  const buf = await docx(
    para("Empfehlungen") + listItem("Erster Punkt") + listItem("Zweiter Punkt") + para(BODY[2]),
  );
  const result = await extract(buf, MIME_DOCX);

  assert.deepEqual(
    result.segments.map((s) => s.kind),
    ["paragraph", "list_item", "list_item", "paragraph"],
  );
  assert.equal(result.segments[1].text, "Erster Punkt");
});

test("a DOCX table keeps its rows and column association", async () => {
  const buf = await docx(
    para(BODY[0]) +
      table([
        cell("Parameter") + cell("Wert") + cell("Referenz"),
        cell("CRP") + cell("1,5 mg/dl") + cell("0,0-0,5 mg/dl"),
      ]),
  );
  const result = await extract(buf, MIME_DOCX);

  const rows = result.segments.filter((s) => s.kind === "table_row");
  assert.equal(rows.length, 2);
  // The cells stay separate, so a value cannot drift to another column.
  assert.deepEqual(rows[0].cells, ["Parameter", "Wert", "Referenz"]);
  assert.deepEqual(rows[1].cells, ["CRP", "1,5 mg/dl", "0,0-0,5 mg/dl"]);
  assert.equal(rows[1].text, "CRP | 1,5 mg/dl | 0,0-0,5 mg/dl");
});

test("table cells are not also emitted as loose paragraphs", async () => {
  const buf = await docx(para(BODY[0]) + table([cell("CRP") + cell("1,5 mg/dl")]));
  const result = await extract(buf, MIME_DOCX);

  const texts = result.segments.map((s) => s.text);
  assert.ok(!texts.includes("CRP"), `cell leaked as paragraph: ${JSON.stringify(texts)}`);
});

test("a merged table cell is refused rather than linearised", async () => {
  // A merged cell makes column association ambiguous. For a lab table that
  // means a value could be shown under the wrong parameter.
  const buf = await docx(
    para(BODY[0]) +
      table([cell("Zusammengefasst", 2), cell("CRP") + cell("1,5 mg/dl")]),
  );
  assert.equal(await codeFor(buf, MIME_DOCX), TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED);
});

test("a DOCX with no readable text is refused", async () => {
  assert.equal(await codeFor(await docx(para("")), MIME_DOCX), TRANSLATION_ERRORS.TEXT_UNAVAILABLE);
});

test("a non-zip payload sent as DOCX is refused as corrupt", async () => {
  assert.equal(await codeFor(legacyDoc(), MIME_DOCX), TRANSLATION_ERRORS.CORRUPT);
});

test("DOCX segment order follows document order", async () => {
  const buf = await docx(
    para("Eins", "Heading1") + para("Zwei") + listItem("Drei") + table([cell("Vier") + cell("Fuenf")]) + para(BODY[0]),
  );
  const result = await extract(buf, MIME_DOCX);

  assert.deepEqual(
    result.segments.map((s) => s.index),
    result.segments.map((_, i) => i),
  );
  assert.deepEqual(
    result.segments.map((s) => s.text),
    ["Eins", "Zwei", "Drei", "Vier | Fuenf", BODY[0]],
  );
});

/* --------------------------------------------------- unsupported formats */

test("legacy .doc is not supported", async () => {
  assert.equal(
    await codeFor(legacyDoc(), "application/msword"),
    TRANSLATION_ERRORS.UNSUPPORTED_FILE_TYPE,
  );
});

test("image formats are not supported", async () => {
  for (const mime of ["image/png", "image/jpeg", "image/webp", "image/tiff"]) {
    assert.equal(
      await codeFor(pngImage(), mime),
      TRANSLATION_ERRORS.UNSUPPORTED_FILE_TYPE,
      `${mime} was not refused`,
    );
  }
});

test("unknown or absent mime types are refused", async () => {
  for (const mime of ["", "text/plain", "application/octet-stream", "application/zip", null]) {
    assert.equal(
      await codeFor(pngImage(), mime),
      TRANSLATION_ERRORS.UNSUPPORTED_FILE_TYPE,
      `${mime} was not refused`,
    );
  }
});

/* -------------------------------------------------- structure-critical types */

test("a lab document cannot be sourced from a PDF text layer", async () => {
  // A PDF cannot prove a row's value still belongs to its parameter, so a lab
  // document is declined rather than read as prose.
  assert.equal(
    await codeFor(await textPdf([BODY]), MIME_PDF, "lab"),
    TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED,
  );
});

test("a lab document from DOCX with a clean table is accepted", async () => {
  const buf = await docx(
    para(BODY[0]) +
      table([cell("Parameter") + cell("Wert"), cell("CRP") + cell("1,5 mg/dl")]),
  );
  const result = await extract(buf, MIME_DOCX, "lab");
  assert.equal(result.structureReliable, true);
  assert.equal(result.segments.filter((s) => s.kind === "table_row").length, 2);
});

test("non-structure-critical types are unaffected by the structure rule", async () => {
  for (const type of ["report", "discharge", "referral"]) {
    const result = await extract(await textPdf([BODY]), MIME_PDF, type);
    assert.ok(result.segments.length > 0, `${type} should extract from PDF`);
  }
});

/* ------------------------------------------------------------ no leakage */

test("extraction errors carry no document content", async () => {
  const cases = [
    [corruptPdf(), MIME_PDF],
    [encryptedPdf(), MIME_PDF],
    [await scannedPdf(2), MIME_PDF],
    [legacyDoc(), MIME_DOCX],
  ];
  for (const [buffer, mime] of cases) {
    try {
      await extract(buffer, mime);
      assert.fail("expected rejection");
    } catch (err) {
      const serialized = JSON.stringify(err?.detail ?? {});
      assert.ok(serialized.length < 400, `error detail suspiciously large: ${serialized}`);
      assert.ok(!/Ramipril|Patient|Sehr geehrte/i.test(serialized), serialized);
    }
  }
});
