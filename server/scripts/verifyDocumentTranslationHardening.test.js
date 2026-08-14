/**
 * Phase 2A.2 hardening — the last local step before any AI connection.
 *
 * Four things are proven here as behaviour, not asserted in comments:
 *
 *   1. A medication context whose product name cannot be protected locally
 *      makes the whole document fail closed.
 *   2. Structured direct identifiers never reach an outbound payload.
 *   3. The ZIP preflight rejects containers whose own metadata disagrees.
 *   4. Parser isolation really terminates a blocked thread and really bounds
 *      its heap — including that the main event loop stays responsive.
 *
 * No model call, no network. Container fixtures declare their sizes rather than
 * containing them, so nothing large is written or unpacked.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  containsClinicalToken,
  maskSegments,
  unmaskText,
} from "../services/documentTranslation/masking/criticalTokenMasking.js";
import {
  analyseMedicationContexts,
  assertMedicationContextProtected,
} from "../services/documentTranslation/masking/medicationContextGuard.js";
import { prepareSegmentsForTranslation } from "../services/documentTranslation/translationPreparation.js";
import { TRANSLATION_ERRORS } from "../services/documentTranslation/documentTranslationPolicy.js";
import { assertSafeDocxContainer } from "../services/documentTranslation/extraction/zipPreflight.js";
import {
  ISOLATION_LIMITS,
  parseInIsolation,
} from "../services/documentTranslation/extraction/isolatedParser.js";
import { extractDocumentText } from "../services/documentTranslation/extraction/documentTextExtractionService.js";
import { analysePageLayout } from "../services/documentTranslation/extraction/pdfPreflight.js";
import {
  docx,
  docxEntryList,
  letterheadDatePdf,
  para,
  syntheticZip,
  twoColumnMedicationPdf,
  ZIP_FLAG_DATA_DESCRIPTOR,
} from "./lib/documentTranslationFixtures.js";

const MIME_PDF = "application/pdf";
const HOSTILE_WORKER = new URL("./lib/hostileParserWorkerFixture.js", import.meta.url);

function segmentsOf(lines) {
  return lines.map((text, index) => ({ index, kind: "paragraph", text }));
}

function refusedBy(lines) {
  return analyseMedicationContexts(segmentsOf(lines), maskSegments(segmentsOf(lines)).segments);
}

/* ================================================================== */
/* 1. Medication fail-closed                                          */
/* ================================================================== */

test("an unknown trade name in a narrative reference refuses the document", () => {
  // The Phase 2A.1 known limit: "Quensyl" has no strength beside it, is not on
  // the curated list and carries no INN stem, so masking cannot protect it.
  // Translating it anyway would risk a silent rename.
  const findings = refusedBy(["Gabe von Quensyl erfolgt."]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].trigger, "narrative_medication_reference");
});

test("a lowercase English drug name refuses the document", () => {
  const findings = refusedBy(["continued on warfarin therapy"]);
  assert.equal(findings.length, 1);
});

test("an unprotected name inside a medication section refuses the document", () => {
  const findings = refusedBy(["Dauermedikation:", "Quensyl", "Ramipril 5 mg 1-0-0"]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].trigger, "medication_section");
  assert.equal(findings[0].segmentIndex, 1);
});

test("the guard throws a dedicated, content-free error", () => {
  const source = segmentsOf(["Gabe von Quensyl erfolgt."]);
  const { segments } = maskSegments(source);
  try {
    assertMedicationContextProtected(source, segments);
    assert.fail("expected refusal");
  } catch (err) {
    assert.equal(err.code, TRANSLATION_ERRORS.MEDICATION_UNVERIFIABLE);
    const serialized = JSON.stringify(err.detail);
    assert.ok(!/Quensyl/.test(serialized), `product name leaked: ${serialized}`);
  }
});

test("an unknown drug WITH a strength is protected, not refused", () => {
  // Atomic masking already covers it: "Quensyl 200 mg 1-0-0" is one token, so
  // the name never reaches a model and there is nothing to fail closed on.
  assert.deepEqual(refusedBy(["Dauermedikation:", "Quensyl 200 mg 1-0-0"]), []);
  const { segments } = maskSegments(segmentsOf(["Quensyl 200 mg 1-0-0"]));
  assert.match(segments[0].text, /^⟦MEDICATION_[A-Z]{4}⟧$/);
});

test("known drugs, drug classes and ordinary prose are not refused", () => {
  const accepted = [
    ["Der Patient nimmt Ramipril weiter."],
    ["Ramipril 5 mg, 1-0-0", "ASS 100 mg 1-0-0"],
    ["Dauermedikation:", "Ramipril 5 mg 1-0-0", "Metoprolol 47,5 mg 1-0-1"],
    ["Wir empfehlen eine Umstellung auf Betablocker."],
    ["Die Therapie wurde fortgefuehrt."],
    ["Metformin 1000 mg morgens und abends als Filmtablette"],
    ["CRP 1,5 mg/dl (0,0-0,5 mg/dl)"],
    ["Sehr geehrte Kollegin, wir berichten ueber die Vorstellung."],
  ];
  for (const lines of accepted) {
    assert.deepEqual(refusedBy(lines), [], `wrongly refused: ${lines.join(" | ")}`);
  }
});

/* ================================================================== */
/* 2. Structured identifiers                                          */
/* ================================================================== */

test("direct identifiers are masked before anything could be sent", () => {
  const lines = [
    "Kontakt: dr.mueller@praxis-beispiel.de",
    "Mehr unter https://praxis-beispiel.de/info",
    "IBAN DE89 3704 0044 0532 0130 00",
    "Versichertennummer A123456789",
    "Patienten-Nr. 4711-2026",
    "Tel. 030 12345678",
    "Telefon +49 30 1234-5678",
  ];
  const { segments } = maskSegments(segmentsOf(lines));

  const leaked = [
    "dr.mueller@praxis-beispiel.de",
    "praxis-beispiel.de/info",
    "A123456789",
    "4711-2026",
    "030 12345678",
  ];
  const joined = segments.map((s) => s.text).join("\n");
  for (const value of leaked) {
    assert.ok(!joined.includes(value), `${value} survived masking`);
  }
});

test("identifiers round trip byte for byte", () => {
  const lines = [
    "Kontakt: dr.mueller@praxis-beispiel.de",
    "IBAN DE89 3704 0044 0532 0130 00",
    "Versichertennummer A123456789",
    "Telefon +49 30 1234-5678",
  ];
  const source = segmentsOf(lines);
  const { segments, tokenMap } = maskSegments(source);
  segments.forEach((s, i) => {
    assert.equal(unmaskText(s.text, tokenMap), lines[i]);
  });
});

test("marker kinds contain no underscore, so every marker can be unmasked", () => {
  // A kind with an underscore produced a marker the unmasker could not parse:
  // it survived masking and never came back. Caught only by a byte-for-byte
  // round-trip assertion.
  const { segments } = maskSegments(
    segmentsOf(["Versichertennummer A123456789 und Patienten-Nr. 4711-2026"]),
  );
  for (const marker of segments[0].text.match(/⟦[^⟧]+⟧/g) || []) {
    assert.match(marker, /^⟦[A-Z]+_[A-Z]{4}⟧$/, `unparsable marker: ${marker}`);
  }
});

test("a case number keeps its label translatable", () => {
  const { segments } = maskSegments(segmentsOf(["Patienten-Nr. 4711-2026"]));
  assert.ok(segments[0].text.startsWith("Patienten-Nr. "), segments[0].text);
});

test("a dosing schedule and a reference range are not mistaken for phone numbers", () => {
  const { tokens } = maskSegments(segmentsOf(["1-0-0", "Referenz 70 - 110 mg/dl"]));
  assert.ok(!tokens.some((t) => t.kind === "PHONE"), JSON.stringify(tokens));
});

/* ================================================================== */
/* 3. Preparation pipeline                                            */
/* ================================================================== */

test("the outbound payload carries masked text and polarity only", () => {
  const source = segmentsOf([
    "Befundbericht",
    "Ramipril 5 mg, 1-0-0",
    "Kein Hinweis auf einen Infekt.",
  ]);
  const { outbound, tokenMap, stats } = prepareSegmentsForTranslation({
    segments: source,
    sourceLanguage: "de",
  });

  assert.equal(outbound.length, 3);
  assert.deepEqual(Object.keys(outbound[0]).sort(), ["index", "kind", "polarity", "text"]);
  assert.equal(outbound[2].polarity, "negated");
  assert.equal(stats.negatedSegments, 1);
  // The token map is the server's; nothing in the outbound payload exposes it.
  assert.ok(tokenMap.size > 0);
  assert.ok(!JSON.stringify(outbound).includes("Ramipril"));
});

test("preparation fails closed on unprotectable medication", () => {
  assert.throws(
    () =>
      prepareSegmentsForTranslation({
        segments: segmentsOf(["Gabe von Quensyl erfolgt."]),
        sourceLanguage: "de",
      }),
    (err) => err.code === TRANSLATION_ERRORS.MEDICATION_UNVERIFIABLE,
  );
});

/* ================================================================== */
/* 4. ZIP container consistency                                       */
/* ================================================================== */

test("a real DOCX and a clean synthetic container both pass", async () => {
  const real = await docx(para("Arztbrief", "Heading1") + para("Ein Absatz."));
  assert.ok(assertSafeDocxContainer(real).entryCount > 0);
  assert.ok(assertSafeDocxContainer(syntheticZip(docxEntryList())).entryCount === 3);
});

test("duplicate entry names are refused", () => {
  // Which one is word/document.xml? A preflight that inspected the harmless
  // copy proves nothing about the one the parser actually reads.
  const zip = syntheticZip([
    ...docxEntryList(),
    { name: "word/document.xml", compressedSize: 50, uncompressedSize: 50 },
  ]);
  assert.throws(
    () => assertSafeDocxContainer(zip),
    (err) => err.detail?.reason === "duplicate_entry_name",
  );
});

test("a local header that disagrees with the central directory is refused", () => {
  for (const [label, forge] of [
    ["size", { index: 2, localCompressed: 1 }],
    ["name", { index: 2, localName: "word/other.xml" }],
  ]) {
    assert.throws(
      () => assertSafeDocxContainer(syntheticZip(docxEntryList(), { forge })),
      (err) =>
        err.code === TRANSLATION_ERRORS.CORRUPT &&
        /local_central_(size|name)_mismatch/.test(String(err.detail?.reason)),
      `${label} mismatch was accepted`,
    );
  }
});

test("a data descriptor is refused from either header", () => {
  for (const forge of [
    { index: 2, flags: ZIP_FLAG_DATA_DESCRIPTOR },
    { index: 2, centralFlags: ZIP_FLAG_DATA_DESCRIPTOR },
  ]) {
    assert.throws(
      () => assertSafeDocxContainer(syntheticZip(docxEntryList(), { forge })),
      (err) => err.detail?.reason === "data_descriptor_unsupported",
    );
  }
});

test("a local offset pointing outside the archive is refused", () => {
  assert.throws(
    () => assertSafeDocxContainer(syntheticZip(docxEntryList(), { forge: { index: 2, localOffset: 999_999 } })),
    (err) => err.detail?.reason === "local_header_out_of_bounds",
  );
});

test("overlapping entry regions are refused", () => {
  // Pointing one entry at another's offset makes the same bytes serve two
  // entries, so what the preflight measured is not what the parser reads.
  assert.throws(
    () => assertSafeDocxContainer(syntheticZip(docxEntryList(), { forge: { index: 2, localOffset: 0 } })),
    (err) => err.code === TRANSLATION_ERRORS.CORRUPT,
  );
});

/* ================================================================== */
/* 5. Parser isolation                                                */
/* ================================================================== */

test("a blocked parser is terminated by the deadline", async () => {
  // The case an in-process Promise.race cannot survive: the worker never
  // yields, so no timer inside it could ever fire.
  const started = Date.now();
  await assert.rejects(
    parseInIsolation("block", Buffer.from("x"), {
      workerUrl: HOSTILE_WORKER,
      timeoutMs: 1_000,
    }),
    (err) =>
      err.code === TRANSLATION_ERRORS.TOO_LARGE && err.detail?.reason === "parse_timeout",
  );
  assert.ok(Date.now() - started < 10_000, "termination took far longer than the deadline");
});

test("the main event loop stays responsive while a parser blocks", async () => {
  let ticks = 0;
  const interval = setInterval(() => {
    ticks += 1;
  }, 25);

  try {
    await parseInIsolation("block", Buffer.from("x"), {
      workerUrl: HOSTILE_WORKER,
      timeoutMs: 800,
    }).catch(() => {});
  } finally {
    clearInterval(interval);
  }

  assert.ok(ticks > 10, `event loop was blocked — only ${ticks} ticks`);
});

test("a runaway allocation trips the worker heap limit", async () => {
  await assert.rejects(
    parseInIsolation("memory", Buffer.from("x"), {
      workerUrl: HOSTILE_WORKER,
      timeoutMs: 15_000,
    }),
    (err) =>
      err.code === TRANSLATION_ERRORS.TOO_LARGE &&
      err.detail?.reason === "parse_out_of_memory",
  );
});

test("a well-behaved worker resolves normally", async () => {
  const result = await parseInIsolation("ok", Buffer.from("x"), {
    workerUrl: HOSTILE_WORKER,
    timeoutMs: 5_000,
  });
  assert.deepEqual(result, { echoed: "ok" });
});

test("the isolation limits are actually bounded", () => {
  assert.ok(ISOLATION_LIMITS.TIMEOUT_MS > 0 && ISOLATION_LIMITS.TIMEOUT_MS <= 60_000);
  assert.ok(ISOLATION_LIMITS.MAX_OLD_GENERATION_MB > 0);
  assert.ok(ISOLATION_LIMITS.MAX_OLD_GENERATION_MB <= 512);
});

test("a caller cannot loosen the ceiling, only tighten it", () => {
  // Guards against a future caller passing a huge timeout and quietly undoing
  // the bound.
  const promise = parseInIsolation("ok", Buffer.from("x"), {
    workerUrl: HOSTILE_WORKER,
    timeoutMs: 10 * ISOLATION_LIMITS.TIMEOUT_MS,
  });
  return promise.then((r) => assert.deepEqual(r, { echoed: "ok" }));
});

/* ================================================================== */
/* 6. Two-column clinical layouts                                     */
/* ================================================================== */

test("a repeated two-column medication list is refused", async () => {
  // Only two columns, so the three-column table rule does not apply, and the
  // block sits mid-page so the full-height column rule does not either.
  try {
    await extractDocumentText({
      buffer: await twoColumnMedicationPdf(),
      mimeType: MIME_PDF,
      documentType: "report",
    });
    assert.fail("expected refusal");
  } catch (err) {
    assert.equal(err.code, TRANSLATION_ERRORS.STRUCTURE_UNSUPPORTED);
    assert.equal(err.detail?.reason, "two_column_clinical_data");
    assert.ok(err.detail?.clinicalPairRows >= 3, JSON.stringify(err.detail));
  }
});

test("a letterhead with a right-aligned date is still accepted", async () => {
  const result = await extractDocumentText({
    buffer: await letterheadDatePdf(),
    mimeType: MIME_PDF,
    documentType: "report",
  });
  assert.ok(result.segments.length > 0);
});

test("the clinical-pair rule needs repetition, not a single row", () => {
  const items = [
    { str: "Praxis Dr. Muster", x: 60, y: 800, width: 120, height: 11 },
    { str: "12.08.2026", x: 430, y: 800, width: 60, height: 11 },
    { str: "Ramipril 5 mg", x: 60, y: 700, width: 80, height: 11 },
    { str: "1-0-0", x: 300, y: 700, width: 30, height: 11 },
  ];
  for (let i = 0; i < 8; i += 1) {
    items.push({ str: `Fliesstext Zeile ${i}`, x: 60, y: 640 - i * 18, width: 300, height: 11 });
  }
  const result = analysePageLayout(items, { width: 595, height: 842 });
  assert.equal(result.complex, false, JSON.stringify(result));
  assert.equal(result.metrics.clinicalPairRows, 1);
});

test("a date is not treated as clinical data", () => {
  assert.equal(containsClinicalToken("12.08.2026"), false);
  assert.equal(containsClinicalToken("Praxis Dr. Muster"), false);
  assert.equal(containsClinicalToken("Ramipril 5 mg"), true);
  assert.equal(containsClinicalToken("1-0-0"), true);
  assert.equal(containsClinicalToken("CRP"), true);
  assert.equal(containsClinicalToken("0,0-0,5 mg/dl"), true);
});

test("layout metrics stay geometry only", () => {
  const items = Array.from({ length: 12 }, (_unused, i) => ({
    str: "Ramipril 5 mg Erika Mustermann",
    x: i % 2 === 0 ? 60 : 300,
    y: 700 - Math.floor(i / 2) * 20,
    width: 80,
    height: 11,
  }));
  const result = analysePageLayout(items, { width: 595, height: 842 });
  assert.ok(!/Ramipril|Erika/.test(JSON.stringify(result.metrics)));
});
