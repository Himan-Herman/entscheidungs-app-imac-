/**
 * Phase 2D — the exported PDF itself.
 *
 * "A PDF was produced" is not a result worth asserting. What matters is what is
 * inside it, so these tests build real PDFs with jsPDF and then read them back:
 * the drawn text is reconstructed from the page content stream through the
 * font's own /ToUnicode map, which is the same path a PDF reader takes.
 *
 * That reconstruction is what makes the Unicode claim checkable. A character
 * the embedded font cannot typeset does not survive to /ToUnicode — it becomes
 * glyph 0, the empty box. So round-tripping a Cyrillic sentence and getting the
 * same characters back is direct evidence that nothing was lost, rather than a
 * claim that a file exists.
 *
 * jsPDF runs headless here; no browser, no network, no medical data.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PDF_EXPORTABLE_LANGUAGES,
  buildTranslationFileName,
  canExportPdfForLanguage,
  generateTranslationPdf,
  resetPdfFontCache,
} from "../pdf/generateTranslationPdf.js";

const FONT_PATH = new URL("../../../../public/fonts/medscoutx-document-sans.ttf", import.meta.url);
const FONT_BYTES = readFileSync(FONT_PATH);

/** Stands in for the browser fetch that loads the bundled font. */
function fontFetch(recorder) {
  return async (url) => {
    recorder?.push(String(url));
    return {
      ok: true,
      arrayBuffer: async () =>
        FONT_BYTES.buffer.slice(
          FONT_BYTES.byteOffset,
          FONT_BYTES.byteOffset + FONT_BYTES.byteLength,
        ),
    };
  };
}

const LABELS = Object.freeze({
  documentTitle: "Übersetzung eines Praxisdokuments",
  aiNotice: "Diese Fassung wurde automatisch erstellt.",
  originalFileLabel: "Originaldatei",
  modeLabel: "Modus",
  modeName: "Wortgetreue Übersetzung",
  sourceLanguageLabel: "Ausgangssprache",
  sourceLanguageName: "Deutsch",
  targetLanguageLabel: "Zielsprache",
  targetLanguageName: "Русский",
  generatedAtLabel: "Erstellt am",
  originalAuthoritative: "Das Originaldokument bleibt maßgeblich.",
  fileNameSuffix: "uebersetzung",
});

/** Every label the header and footer draw, for accounting purposes. */
const LABELS_TEXT = Object.values(LABELS).join(" ");

/** @param {string} haystack @param {string} needle */
function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/** @param {{text: string, kind?: string}[]} texts */
function segments(texts) {
  return texts.map((entry, index) => ({
    id: `s${index}`,
    kind: entry.kind ?? "paragraph",
    text: entry.text,
  }));
}

async function build(overrides = {}) {
  const { doc, fileName } = await generateTranslationPdf({
    segments: segments([{ text: "Platzhalter" }]),
    originalFileName: "befund.pdf",
    sourceLanguage: "de",
    targetLanguage: "ru",
    mode: "strict_translation",
    labels: LABELS,
    save: false,
    fetchImpl: fontFetch(),
    ...overrides,
  });
  return { doc, fileName, raw: Buffer.from(doc.output("arraybuffer")).toString("latin1") };
}

/* ================================================================== */
/* Reading a produced PDF back                                        */
/* ================================================================== */

/**
 * Build glyph-code -> character from the /ToUnicode CMap jsPDF writes for the
 * embedded subset. Only the characters actually drawn appear in it.
 */
function toUnicodeMap(raw) {
  const map = new Map();
  for (const block of raw.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const [, code, value] of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      map.set(parseInt(code, 16), String.fromCodePoint(parseInt(value, 16)));
    }
  }
  return map;
}

/**
 * Reconstruct every string drawn on every page, in drawing order, together with
 * the point size it was drawn at — the size matters because a line is only
 * within the margin relative to the size it was actually typeset in.
 *
 * @returns {{ text: string, size: number }[]}
 */
function extractPdfRuns(raw) {
  const map = toUnicodeMap(raw);
  const runs = [];
  let size = 0;
  // Font-size operators and text-showing operators, read in file order so each
  // run is attributed to the Tf that preceded it.
  for (const match of raw.matchAll(/\/F\d+\s+([\d.]+)\s+Tf|<([0-9a-fA-F]{4,})>\s*Tj/g)) {
    if (match[1] !== undefined) {
      size = Number(match[1]);
      continue;
    }
    const hex = match[2];
    let text = "";
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      // Unmapped codes should not occur; if they ever do, they must be visible.
      text += map.has(code) ? map.get(code) : "�";
    }
    runs.push({ text, size });
  }
  return runs;
}

/** @param {string} raw */
function extractPdfText(raw) {
  return extractPdfRuns(raw).map((run) => run.text);
}

/** Whitespace carries no meaning across a line break; content does. */
function compact(value) {
  return value.replace(/\s+/g, "");
}

/* ================================================================== */
/* 1. Unicode — the reason the font exists                            */
/* ================================================================== */

const LANGUAGE_SAMPLES = Object.freeze({
  de: "Befund: Blutzuckerwerte im Normbereich, keine Auffälligkeiten. Größe 1,78 m.",
  en: "Findings: blood glucose within the normal range, no abnormalities.",
  fr: "Résultat : glycémie dans les normes, aucune anomalie décelée à l'examen.",
  es: "Hallazgo: glucemia dentro del intervalo normal, sin alteraciones. ¿Preguntas?",
  it: "Referto: glicemia nella norma, nessuna alterazione riscontrata all'esame.",
  ru: "Заключение: уровень глюкозы в пределах нормы, отклонений не выявлено. Ёж.",
});

for (const [code, sample] of Object.entries(LANGUAGE_SAMPLES)) {
  test(`${code}: the exported PDF contains the text unchanged, character for character`, async () => {
    const { raw } = await build({
      targetLanguage: code,
      segments: segments([{ text: sample }]),
    });

    const drawn = extractPdfText(raw).join("\n");

    // The decisive assertion: the sample survives as an unbroken sequence.
    // jsPDF's real failure mode for an uncoverable character is to drop it
    // silently (see the negative control below), so a set-membership check
    // would be too weak — this catches dropping, substitution and reordering.
    assert.ok(
      compact(drawn).includes(compact(sample)),
      `${code}: the text did not survive intact.\n  wanted: ${compact(sample)}\n  got:    ${compact(drawn)}`,
    );

    // Named per character, so a failure says which one was lost.
    for (const char of new Set(compact(sample))) {
      assert.ok(
        drawn.includes(char),
        `${code}: "${char}" (U+${char
          .codePointAt(0)
          .toString(16)
          .padStart(4, "0")
          .toUpperCase()}) is missing from the PDF`,
      );
    }

    // "?" is only evidence of substitution when there are more of them than the
    // text asked for — Spanish legitimately writes "¿Preguntas?".
    assert.equal(
      count(drawn, "?") - count(LABELS_TEXT, "?"),
      count(sample, "?"),
      `${code}: a character was substituted with "?"`,
    );
  });
}

test("negative control: a character outside the font is dropped, and the test notices", async () => {
  // Pins jsPDF's actual behaviour. It does not draw a "?" or an empty box for a
  // character the embedded font lacks — it omits it entirely, which is the
  // quietest possible way to lose part of a medical document. The suite above
  // therefore compares sequences, not glyph placeholders.
  const outside = "漢字 und Latein"; // CJK is deliberately not in the subset
  const { raw } = await build({ segments: segments([{ text: outside }]) });
  const drawn = extractPdfText(raw).join("\n");

  assert.ok(drawn.includes("und Latein"), "the Latin part should still be drawn");
  assert.ok(!drawn.includes("漢"), "assumption changed: jsPDF now draws uncovered characters");
  assert.ok(
    !compact(drawn).includes(compact(outside)),
    "the sequence check must fail for text the font cannot cover",
  );
});

test("Cyrillic survives together with Latin in one line", async () => {
  // The realistic case: a Russian result still carries German drug names and
  // Latin units. One font must cover both, or the line breaks apart.
  const mixed = "Метформин (Metformin) 850 mg — приём 2 × täglich, HbA1c 7,2 %.";
  const { raw } = await build({ segments: segments([{ text: mixed }]) });
  const drawn = extractPdfText(raw).join("");

  for (const char of new Set(mixed.replace(/\s/g, ""))) {
    assert.ok(drawn.includes(char), `"${char}" is missing`);
  }
  assert.ok(!drawn.includes("�"), drawn);
});

test("the font is really embedded, not merely requested", async () => {
  const { raw } = await build();
  // FontFile2 is the embedded TrueType program. Without it a reader would
  // substitute a local font, and Cyrillic would be at the mercy of the machine.
  assert.ok(raw.includes("FontFile2"), "no font program is embedded in the PDF");
  assert.ok(raw.includes("MedScoutXDocumentSans"), "the embedded font is not the bundled one");
  assert.ok(raw.includes("/Identity-H"), "the font is not addressed through a Unicode encoding");
});

test("the bundled font is fetched once per session, not once per export", async () => {
  resetPdfFontCache();
  const calls = [];
  const opts = { fetchImpl: fontFetch(calls), save: false };
  await build(opts);
  await build(opts);
  assert.equal(calls.length, 1, `font fetched ${calls.length} times`);
  assert.match(calls[0], /fonts\/medscoutx-document-sans\.ttf$/);
});

test("a failed font load fails the export instead of producing an unreadable PDF", async () => {
  resetPdfFontCache();
  await assert.rejects(
    build({ fetchImpl: async () => ({ ok: false }) }),
    /pdf_font_load_failed/,
  );

  // The failure must not poison the cache: a later export has to work again.
  resetPdfFontCache();
  const { raw } = await build();
  assert.ok(raw.includes("FontFile2"));
});

test("a language outside the font's scripts is refused, not silently emptied", async () => {
  assert.equal(canExportPdfForLanguage("el"), false);
  await assert.rejects(build({ targetLanguage: "el" }), /pdf_language_not_supported/);
});

test("every offered export language is in the exportable list", () => {
  assert.deepEqual([...PDF_EXPORTABLE_LANGUAGES], ["de", "en", "fr", "es", "it", "ru"]);
});

/* ================================================================== */
/* 2. Layout                                                          */
/* ================================================================== */

test("a long document flows onto further pages instead of running off the first", async () => {
  const many = Array.from({ length: 60 }, (_, i) => ({
    kind: i % 10 === 0 ? "heading" : "paragraph",
    text:
      `Abschnitt ${i}: ` +
      "Der Patient berichtet über wiederkehrende Beschwerden im Verlauf der letzten Wochen. ".repeat(4),
  }));
  const { doc } = await build({ segments: segments(many) });
  assert.ok(doc.getNumberOfPages() > 1, "everything was crammed onto one page");
});

test("no line is drawn past the right margin", async () => {
  const { doc, raw } = await build({
    segments: segments([
      // A German compound with no break opportunity, next to a Cyrillic run.
      { text: "Rechtsherzkatheteruntersuchungsbefundbesprechungstermin" },
      { text: "Электрокардиографическое исследование ".repeat(6) },
    ]),
  });

  const usableWidth = doc.internal.pageSize.getWidth() - 18 * 2;
  const runs = extractPdfRuns(raw);
  assert.ok(runs.length > 0);

  for (const { text, size } of runs) {
    // Measured at the size the run was actually drawn at, with the embedded
    // font. Measuring everything at one size would let the 16pt title overflow
    // unnoticed, which is precisely the line most likely to be long.
    doc.setFontSize(size);
    const width = doc.getTextWidth(text);
    assert.ok(
      width <= usableWidth + 0.5,
      `line overflows the margin at ${size}pt (${width.toFixed(1)}mm > ${usableWidth}mm): ${text}`,
    );
  }
});

test("the overflow measurement is sensitive enough to catch a real overflow", async () => {
  // Guards the test above: if getTextWidth silently returned a constant, or
  // measured the wrong font, the margin assertion would pass on anything.
  const { doc } = await build();
  doc.setFontSize(10);
  const usableWidth = doc.internal.pageSize.getWidth() - 18 * 2;
  assert.ok(
    doc.getTextWidth("Электрокардиография ".repeat(20)) > usableWidth,
    "an obviously over-wide string measured as fitting",
  );
  assert.ok(doc.getTextWidth("kurz") < usableWidth);
});

test("a single word with no break opportunity is broken rather than clipped", async () => {
  // German clinical writing produces compounds with no space for 200 characters.
  // If wrapping only broke at spaces, such a word would simply run off the page.
  const word = "Elektroenzephalographiebefundbesprechung".repeat(6);
  const { doc, raw } = await build({ segments: segments([{ text: word }]) });
  const runs = extractPdfRuns(raw).filter((run) => run.text.includes("Elektro"));

  assert.ok(runs.length > 1, "the compound was not broken across lines");
  const usableWidth = doc.internal.pageSize.getWidth() - 18 * 2;
  for (const { text, size } of runs) {
    doc.setFontSize(size);
    assert.ok(doc.getTextWidth(text) <= usableWidth + 0.5, text);
  }
  // Broken for layout only — no character was thrown away.
  assert.ok(runs.map((run) => run.text).join("").includes(word), "the compound lost characters");
});

test("later pages keep the Unicode font rather than falling back to Helvetica", async () => {
  const many = Array.from({ length: 80 }, () => ({
    text: "Заключение по результатам обследования пациента за отчётный период. ".repeat(3),
  }));
  const { doc, raw } = await build({ segments: segments(many) });
  assert.ok(doc.getNumberOfPages() > 1);

  const drawn = extractPdfText(raw);
  assert.ok(drawn.length > 20);
  assert.ok(!drawn.join("").includes("�"), "a page lost the embedded font");
});

test("empty and whitespace-only segments are skipped, not drawn as blank blocks", async () => {
  const { raw } = await build({
    segments: segments([{ text: "Erste Zeile" }, { text: "   " }, { text: "" }, { text: "Letzte Zeile" }]),
  });
  const drawn = extractPdfText(raw);
  assert.ok(drawn.some((line) => line.includes("Erste Zeile")));
  assert.ok(drawn.some((line) => line.includes("Letzte Zeile")));
  assert.ok(!drawn.some((line) => line.trim() === ""), "an empty segment produced an empty line");
});

/* ================================================================== */
/* 3. The PDF interprets nothing                                      */
/* ================================================================== */

test("markup in a result is drawn as characters, never as structure", async () => {
  const hostile = [
    '<script>alert("x")</script>',
    "javascript:alert(1)",
    '<iframe src="https://example.invalid"></iframe>',
    "**fett** _kursiv_ # Überschrift",
    "[Klick mich](https://example.invalid/steal)",
    "https://example.invalid/plain-url",
  ];
  const { raw } = await build({ segments: segments(hostile.map((text) => ({ text }))) });
  const drawn = extractPdfText(raw).join("\n");

  // The characters are all still there — nothing was stripped or transformed.
  for (const line of hostile) {
    for (const char of new Set(line.replace(/\s/g, ""))) {
      assert.ok(drawn.includes(char), `"${char}" was dropped from "${line}"`);
    }
  }
  assert.ok(drawn.includes("**fett**"), "markdown was interpreted instead of shown");
  assert.ok(drawn.includes("[Klick mich]"), "a markdown link was interpreted");

  // And none of it became something a reader would act on.
  for (const dangerous of ["/Annots", "/URI", "/Launch", "/JavaScript", "/EmbeddedFile", "/AA "]) {
    assert.ok(!raw.includes(dangerous), `the PDF carries ${dangerous}`);
  }
  // /JS is the JavaScript action key; matched with its delimiter so it cannot
  // collide with an unrelated token.
  assert.ok(!/\/JS[\s/(<]/.test(raw), "the PDF carries a JavaScript action");
});

test("a URL in the text does not become a clickable link", async () => {
  const { raw } = await build({
    segments: segments([{ text: "Mehr unter https://example.invalid/pfad" }]),
  });
  assert.ok(!raw.includes("/Annots"), "an annotation was created");
  assert.ok(!raw.includes("/URI"), "a URI action was created");
});

test("the only OpenAction is a page view, not an action that runs", async () => {
  const { raw } = await build();
  const match = raw.match(/\/OpenAction\s*(\[[^\]]*\]|<<[\s\S]*?>>)/);
  // jsPDF always writes one; it must stay a destination array.
  assert.ok(match, "no OpenAction found — the assumption under test changed");
  assert.ok(match[1].startsWith("["), `OpenAction is not a destination: ${match[1]}`);
});

/* ================================================================== */
/* 4. The PDF carries no identifiers                                  */
/* ================================================================== */

test("no internal identifier reaches the file", async () => {
  const { raw, fileName } = await build({
    // Values that exist in the calling context but must never be written out.
    originalFileName: "befund.pdf",
    segments: segments([{ text: "Заключение" }]),
  });

  const secrets = [
    "clx9patient00000000000000", // patientUserId
    "clx9document0000000000000", // documentId
    "clx9file00000000000000000", // fileId
    "clx9practice000000000000", // practiceId
    "practice-documents/2026/07/abc123.pdf", // storage key
    "strict-v1", // prompt version
    "gpt-", // model family
  ];
  for (const secret of secrets) {
    assert.ok(!raw.includes(secret), `the PDF contains ${secret}`);
    assert.ok(!fileName.includes(secret), `the file name contains ${secret}`);
  }

  // The document properties jsPDF would otherwise populate are blank.
  for (const key of ["/Author", "/Subject", "/Keywords", "/Creator"]) {
    const value = raw.match(new RegExp(`${key}\\s*\\(([^)]*)\\)`));
    assert.ok(!value || value[1] === "", `${key} is populated: ${value?.[1]}`);
  }
});

test("the AI marking is in the file, above the content", async () => {
  const { raw } = await build({ segments: segments([{ text: "Заключение" }]) });
  const drawn = extractPdfText(raw);
  const notice = drawn.findIndex((line) => line.includes("automatisch"));
  const body = drawn.findIndex((line) => line.includes("Заключение"));
  assert.ok(notice >= 0, "the AI notice is missing from the PDF");
  assert.ok(body > notice, "the content is drawn before the AI notice");
});

test("the note that the original stays authoritative is in the file", async () => {
  const { raw } = await build();
  const drawn = extractPdfText(raw).join("\n");
  assert.ok(drawn.includes("Originaldokument"), drawn);
});

/* ================================================================== */
/* 5. File name                                                       */
/* ================================================================== */

test("a hostile original file name cannot shape the download name", async () => {
  const hostile = [
    "../../../etc/passwd.pdf",
    "..\\..\\Windows\\System32\\config.pdf",
    "befund .pdf",
    "befund\n\r.pdf",
    'befund";rm -rf /.pdf',
    "befund<script>alert(1)</script>.pdf",
    "CON.pdf",
    "  ...  .pdf",
    "‮fdp.exe.pdf", // right-to-left override
    "Ω".repeat(400) + ".pdf",
    "Заключение.pdf",
  ];

  for (const name of hostile) {
    const built = buildTranslationFileName(
      { originalFileName: name, targetLanguage: "ru", mode: "strict_translation" },
      { suffix: "uebersetzung" },
    );
    assert.match(built, /^[a-z0-9_]+\.pdf$/, `${JSON.stringify(name)} -> ${built}`);
    assert.ok(built.length <= 110, `${built.length} characters`);
    assert.ok(!built.includes(".."), built);
    // Exactly one extension, and it is the one we chose.
    assert.equal(built.split(".").length, 2, built);
  }
});

test("a name with nothing usable left still produces a valid file name", async () => {
  for (const name of ["", "   ", "///", "Заключение.pdf", " "]) {
    const built = buildTranslationFileName(
      { originalFileName: name, targetLanguage: "ru", mode: "plain_language" },
      { suffix: "uebersetzung" },
    );
    assert.match(built, /^dokument_uebersetzung_ru\.pdf$/, `${JSON.stringify(name)} -> ${built}`);
  }
});

test("diacritics are transliterated rather than deleted", () => {
  const built = buildTranslationFileName(
    { originalFileName: "Müller Größe Bericht.pdf", targetLanguage: "fr", mode: "strict_translation" },
    { suffix: "traduction" },
  );
  assert.equal(built, "muller_grosse_bericht_traduction_fr.pdf");
});

test("the produced file name matches the language actually exported", async () => {
  const { fileName } = await build({ targetLanguage: "ru", originalFileName: "Arztbrief.pdf" });
  assert.equal(fileName, "arztbrief_uebersetzung_ru.pdf");
});
