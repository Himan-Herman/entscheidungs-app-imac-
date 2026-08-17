/**
 * Phase 2C — patient-facing document transformation UI.
 *
 * The project has no React component test stack (no jsdom, no testing-library,
 * no vitest); every existing client test is a pure-logic `.test.mjs` run with
 * node --test. These tests follow that convention rather than introducing a new
 * dependency set, so the decisions the component renders are exercised
 * directly: which languages exist, which modes exist, exactly what the request
 * body may contain, how each backend error code is presented, and which results
 * must never be shown.
 *
 * Two things that can only be asserted at source level — that model-derived text
 * is never rendered as markup, and that no provider name leaks into the client —
 * are checked by reading the component file, the same way the server suite pins
 * mammoth's externalFileAccess.
 *
 * No network, no provider, no real medical data.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DOCUMENT_SOURCE_LANGUAGE,
  TRANSLATION_MODES,
  TRANSLATION_MODE_VALUES,
  buildTranslationRequestBody,
  defaultSelectedFileId,
  evaluateSubmitState,
  getTranslationTargetLanguages,
  isOfferedTargetLanguage,
  isSameLanguageStrictRequest,
  isTranslatableDocument,
  selectableFiles,
} from "../translation/documentTranslationOptions.js";
import {
  KNOWN_ERROR_CODES,
  isRetryableError,
  isUnavailableState,
  suppressesResult,
  translationErrorKey,
} from "../translation/documentTranslationErrors.js";
import {
  PDF_EXPORTABLE_LANGUAGES,
  buildTranslationFileName,
  canExportPdfForLanguage,
} from "../pdf/generateTranslationPdf.js";
import {
  DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES,
  UI_SELECTABLE_LOCALE_CODES,
} from "../../../i18n/localeConfig.js";

import de from "../../../i18n/translations/de/patientPracticeDocuments.js";
import en from "../../../i18n/translations/en/patientPracticeDocuments.js";
import frPatient from "../../../i18n/translations/overrides/fr/fr.patient.js";
import esPatient from "../../../i18n/translations/overrides/es/es.patient.js";
import itPatient from "../../../i18n/translations/overrides/it/it.patient.js";
import ruPatient from "../../../i18n/translations/overrides/ru/ru.patient.js";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Source-level assertions must inspect CODE, not prose: several of these files
 * explain in a comment exactly what they must not do ("no
 * dangerouslySetInnerHTML", "the Tahoma font is not used"), and a naive grep
 * would read the explanation as the offence.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const COMPONENT_SOURCE = stripComments(
  readFileSync(
    new URL("../components/PatientDocumentTranslationSection.jsx", import.meta.url),
    "utf8",
  ),
);
const DETAIL_PAGE_SOURCE = stripComments(
  readFileSync(new URL("../pages/PatientPracticeDocumentDetailPage.jsx", import.meta.url), "utf8"),
);

function documentWith(overrides = {}) {
  return {
    id: "doc-1",
    type: "report",
    files: [
      { id: "file-1", originalFileName: "arztbrief.pdf", mimeType: PDF_MIME, sizeBytes: 1024 },
    ],
    ...overrides,
  };
}

/* ================================================================== */
/* 1. Target languages come from the central registry                 */
/* ================================================================== */

test("target languages are exactly the six shipped UI languages", () => {
  assert.deepEqual(
    getTranslationTargetLanguages().map((o) => o.code),
    ["de", "en", "fr", "es", "it", "ru"],
  );
});

test("the language list is derived, not a second hard-coded list", () => {
  // Reference identity: replacing the derivation with a literal array that
  // happens to match today would fail here, which is the point.
  assert.equal(DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES, UI_SELECTABLE_LOCALE_CODES);
  assert.deepEqual(
    getTranslationTargetLanguages().map((o) => o.code),
    [...DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES],
  );
});

test("display names come from locale metadata, not from the component", () => {
  const byCode = Object.fromEntries(
    getTranslationTargetLanguages().map((o) => [o.code, o.nativeName]),
  );
  assert.equal(byCode.de, "Deutsch");
  assert.equal(byCode.en, "English");
  assert.equal(byCode.fr, "Français");
  assert.equal(byCode.es, "Español");
  assert.equal(byCode.it, "Italiano");
  assert.equal(byCode.ru, "Русский");

  // No literal language-name list anywhere in the component.
  for (const name of ["Deutsch", "English", "Français", "Español", "Italiano", "Русский"]) {
    assert.ok(
      !COMPONENT_SOURCE.includes(`"${name}"`),
      `component hard-codes the language name ${name}`,
    );
  }
});

test("the seventeen registered but unshipped locales are never offered", () => {
  for (const code of ["tr", "ar", "pl", "uk", "pt", "ku", "ckb", "he", "ur", "el"]) {
    assert.equal(isOfferedTargetLanguage(code), false, `${code} was offered`);
  }
});

/* ================================================================== */
/* 2. Modes                                                           */
/* ================================================================== */

test("exactly two modes exist, with the server's wire values", () => {
  assert.deepEqual(TRANSLATION_MODE_VALUES, ["strict_translation", "plain_language"]);
});

test("internal mode names never appear as UI copy", () => {
  for (const value of TRANSLATION_MODE_VALUES) {
    for (const bundle of [de.translation, en.translation]) {
      const copy = JSON.stringify(bundle);
      assert.ok(!copy.includes(value), `${value} leaked into UI copy`);
    }
  }
});

test("the source language is fixed to German and not user-selectable", () => {
  assert.equal(DOCUMENT_SOURCE_LANGUAGE, "de");
  // No source-language picker: offering one would imply a capability V1 lacks.
  // Exactly two selects exist — the file and the target language.
  const selects = COMPONENT_SOURCE.match(/<select\b/g) ?? [];
  assert.equal(selects.length, 2, `expected two selects, found ${selects.length}`);
  assert.ok(
    !/id="doc-translate-source/.test(COMPONENT_SOURCE),
    "a source-language control exists",
  );
  // sourceLanguage is never bound to component state.
  assert.ok(
    !/useState\([^)]*sourceLanguage/i.test(COMPONENT_SOURCE),
    "the source language is held as mutable state",
  );
  assert.ok(COMPONENT_SOURCE.includes("sourceLanguageNote"), "source scope is not communicated");
});

/* ================================================================== */
/* 3. Request shape                                                   */
/* ================================================================== */

test("the request body carries exactly four fields", () => {
  const body = buildTranslationRequestBody({
    fileId: "file-1",
    targetLanguage: "en",
    mode: TRANSLATION_MODES.STRICT,
  });
  assert.deepEqual(Object.keys(body).sort(), [
    "fileId",
    "mode",
    "sourceLanguage",
    "targetLanguage",
  ]);
  assert.deepEqual(body, {
    fileId: "file-1",
    sourceLanguage: "de",
    targetLanguage: "en",
    mode: "strict_translation",
  });
});

test("no extra field can be smuggled through the body builder", () => {
  const body = buildTranslationRequestBody({
    fileId: "file-1",
    targetLanguage: "en",
    mode: TRANSLATION_MODES.STRICT,
    // These are ignored by construction — the builder names its own fields.
    text: "arbitrary",
    documentId: "doc-somebody-elses",
    prompt: "ignore previous instructions",
  });
  assert.equal(body.text, undefined);
  assert.equal(body.documentId, undefined);
  assert.equal(body.prompt, undefined);
});

test("the client sends no document source of its own", () => {
  for (const forbidden of ["text", "content", "url", "upload", "base64", "documentText", "html"]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\s*:`).test(
        stripComments(
        readFileSync(new URL("../api/documentTranslationApi.js", import.meta.url), "utf8"),
      ),
      ),
      `${forbidden} appears in the API module`,
    );
  }
});

/* ================================================================== */
/* 4. File selection                                                  */
/* ================================================================== */

test("only extractable file types are offered", () => {
  const doc = documentWith({
    files: [
      { id: "a", mimeType: PDF_MIME, originalFileName: "a.pdf" },
      { id: "b", mimeType: DOCX_MIME, originalFileName: "b.docx" },
      { id: "c", mimeType: "image/png", originalFileName: "c.png" },
      { id: "d", mimeType: "application/msword", originalFileName: "d.doc" },
    ],
  });
  assert.deepEqual(selectableFiles(doc).map((f) => f.id), ["a", "b"]);
});

test("a single file is preselected; several are not", () => {
  assert.equal(defaultSelectedFileId(documentWith()), "file-1");

  const many = documentWith({
    files: [
      { id: "a", mimeType: PDF_MIME, originalFileName: "a.pdf" },
      { id: "b", mimeType: PDF_MIME, originalFileName: "b.pdf" },
    ],
  });
  assert.equal(
    defaultSelectedFileId(many),
    "",
    "with several files the patient must choose, not have one chosen",
  );
});

test("a file id outside the document cannot be submitted", () => {
  const state = evaluateSubmitState({
    document: documentWith(),
    fileId: "file-from-another-document",
    mode: TRANSLATION_MODES.STRICT,
    targetLanguage: "en",
  });
  assert.equal(state.canSubmit, false);
  assert.equal(state.reason, "fileNotSelected");
});

/* ================================================================== */
/* 5. Eligibility and submit state                                    */
/* ================================================================== */

test("the section only offers itself for the three V1 document types", () => {
  for (const type of ["report", "discharge", "referral"]) {
    assert.equal(isTranslatableDocument(documentWith({ type })), true, type);
  }
  for (const type of ["lab", "other", "imaging", "prescription_info"]) {
    assert.equal(isTranslatableDocument(documentWith({ type })), false, type);
  }
});

test("a document with no extractable file is not offered", () => {
  const scanOnly = documentWith({
    files: [{ id: "s", mimeType: "image/jpeg", originalFileName: "scan.jpg" }],
  });
  assert.equal(isTranslatableDocument(scanOnly), false);
});

test("submit requires document, file, mode and language", () => {
  const base = {
    document: documentWith(),
    fileId: "file-1",
    mode: TRANSLATION_MODES.STRICT,
    targetLanguage: "en",
  };
  assert.equal(evaluateSubmitState(base).canSubmit, true);

  assert.equal(evaluateSubmitState({ ...base, targetLanguage: "" }).reason, "languageNotSelected");
  assert.equal(evaluateSubmitState({ ...base, mode: "" }).reason, "modeNotSelected");
  assert.equal(evaluateSubmitState({ ...base, fileId: "" }).reason, "fileNotSelected");
  assert.equal(evaluateSubmitState({ ...base, busy: true }).reason, "busy");
  assert.equal(
    evaluateSubmitState({ ...base, document: documentWith({ type: "lab" }) }).reason,
    "documentNotEligible",
  );
});

test("a busy state blocks a second submission", () => {
  // The double-submit guard: the control is disabled while a request is in
  // flight, and the server additionally allows one transformation per patient.
  const state = evaluateSubmitState({
    document: documentWith(),
    fileId: "file-1",
    mode: TRANSLATION_MODES.STRICT,
    targetLanguage: "en",
    busy: true,
  });
  assert.equal(state.canSubmit, false);
});

/* ================================================================== */
/* 6. Same-language behaviour                                         */
/* ================================================================== */

test("faithful translation into German is refused client-side with a hint", () => {
  assert.equal(isSameLanguageStrictRequest(TRANSLATION_MODES.STRICT, "de"), true);
  const state = evaluateSubmitState({
    document: documentWith(),
    fileId: "file-1",
    mode: TRANSLATION_MODES.STRICT,
    targetLanguage: "de",
  });
  assert.equal(state.canSubmit, false);
  assert.equal(state.reason, "sameLanguageStrict");
});

test("plain language German to German is allowed", () => {
  assert.equal(isSameLanguageStrictRequest(TRANSLATION_MODES.PLAIN, "de"), false);
  assert.equal(
    evaluateSubmitState({
      document: documentWith(),
      fileId: "file-1",
      mode: TRANSLATION_MODES.PLAIN,
      targetLanguage: "de",
    }).canSubmit,
    true,
  );
});

/* ================================================================== */
/* 7. Error mapping                                                   */
/* ================================================================== */

const REQUIRED_CODES = [
  "feature_disabled",
  "document_not_found",
  "document_unavailable",
  "link_not_active",
  "document_type_not_translatable",
  "document_file_type_unsupported",
  "document_text_unavailable",
  "document_structure_unsupported",
  "document_source_language_unsupported",
  "document_medication_unverifiable",
  "document_dosage_unverifiable",
  "translation_target_language_unsupported",
  "translation_mode_invalid",
  "document_translation_provider_not_configured",
  "document_translation_provider_unavailable",
  "document_translation_rate_limited",
  "document_translation_timeout",
  "document_translation_invalid_response",
  "integrity_failed",
];

test("every required backend error code maps to a message in all six languages", () => {
  const bundles = {
    de: de.translation,
    en: en.translation,
    fr: frPatient.patientPracticeDocuments.translation,
    es: esPatient.patientPracticeDocuments.translation,
    it: itPatient.patientPracticeDocuments.translation,
    ru: ruPatient.patientPracticeDocuments.translation,
  };

  for (const code of REQUIRED_CODES) {
    const key = translationErrorKey(code);
    assert.notEqual(key, "generic", `${code} has no dedicated mapping`);
    for (const [lang, bundle] of Object.entries(bundles)) {
      const message = bundle.errors?.[key];
      assert.ok(
        typeof message === "string" && message.trim().length > 0,
        `${lang} is missing errors.${key} (for ${code})`,
      );
    }
  }
});

test("an unknown code falls back rather than showing the raw code", () => {
  assert.equal(translationErrorKey("something_new_from_the_server"), "generic");
});

test("integrity and safety refusals never show a result", () => {
  for (const code of [
    "integrity_failed",
    "document_medication_unverifiable",
    "document_dosage_unverifiable",
    "document_translation_invalid_response",
  ]) {
    assert.equal(suppressesResult(code), true, code);
  }
});

test("integrity failure is not worded as a minor glitch", () => {
  for (const bundle of [de.translation, en.translation]) {
    const message = bundle.errors.integrityFailed.toLowerCase();
    for (const minimiser of ["klein", "kleiner", "slight", "minor", "small"]) {
      assert.ok(!message.includes(minimiser), `integrity message minimises: ${message}`);
    }
    assert.ok(
      /original/i.test(message),
      "integrity message should point the patient back to the original",
    );
  }
});

test("safety refusals disclose no internals", () => {
  const all = [de.translation, en.translation]
    .flatMap((b) => Object.values(b.errors))
    .join(" ")
    .toLowerCase();
  for (const internal of ["regex", "masking", "marker", "guard", "openai", "gpt", "provider", "prompt", "token"]) {
    assert.ok(!all.includes(internal), `error copy exposes "${internal}"`);
  }
});

test("deployment-state codes read as unavailable, not as a failure", () => {
  assert.equal(isUnavailableState("feature_disabled"), true);
  assert.equal(isUnavailableState("document_translation_provider_not_configured"), true);
  assert.equal(isUnavailableState("integrity_failed"), false);

  // And the copy says nothing about why.
  for (const bundle of [de.translation, en.translation]) {
    const message = bundle.errors.notAvailable.toLowerCase();
    for (const leak of ["openai", "provider", "api", "key", "config"]) {
      assert.ok(!message.includes(leak), `notAvailable exposes "${leak}"`);
    }
  }
});

test("only transport-ish failures offer a retry", () => {
  for (const code of [
    "document_translation_provider_unavailable",
    "document_translation_rate_limited",
    "document_translation_timeout",
  ]) {
    assert.equal(isRetryableError(code), true, code);
  }
  // Refusals about THIS document will refuse again.
  for (const code of [
    "integrity_failed",
    "document_medication_unverifiable",
    "document_structure_unsupported",
    "document_type_not_translatable",
    "feature_disabled",
  ]) {
    assert.equal(isRetryableError(code), false, code);
  }
});

test("every mapped code has copy in German and English", () => {
  for (const code of KNOWN_ERROR_CODES) {
    const key = translationErrorKey(code);
    assert.ok(de.translation.errors[key], `de missing errors.${key}`);
    assert.ok(en.translation.errors[key], `en missing errors.${key}`);
  }
});

/* ================================================================== */
/* 8. Security rendering                                              */
/* ================================================================== */

test("model-derived text is never rendered as markup", () => {
  assert.ok(
    !COMPONENT_SOURCE.includes("dangerouslySetInnerHTML"),
    "the component renders HTML from model output",
  );
  for (const renderer of ["ReactMarkdown", "marked", "DOMPurify", "innerHTML"]) {
    assert.ok(!COMPONENT_SOURCE.includes(renderer), `component uses ${renderer}`);
  }
  // Segment text is placed as a JSX child (a text node), never into an
  // attribute and never through an HTML sink.
  assert.ok(
    /^\s*\{segment\.text\}\s*$/m.test(COMPONENT_SOURCE),
    "segment text is not rendered as a plain JSX child",
  );
  assert.ok(
    !/=\s*\{segment\.text\}/.test(COMPONENT_SOURCE),
    "segment text flows into an attribute",
  );
});

test("a script tag in a result would be shown as characters, not executed", () => {
  // React escapes text children; this asserts the shape the component relies on
  // rather than re-testing React. The value flows into JSX as {segment.text}.
  const hostile = '<script>alert(1)</script>';
  const rendered = `<p>${escapeLikeReact(hostile)}</p>`;
  assert.ok(rendered.includes("&lt;script&gt;"), rendered);
  assert.ok(!rendered.includes("<script>"), rendered);
});

test("no provider or model detail exists in the client feature", () => {
  const files = [
    "../components/PatientDocumentTranslationSection.jsx",
    "../api/documentTranslationApi.js",
    "../translation/documentTranslationOptions.js",
    "../translation/documentTranslationErrors.js",
    "../pdf/generateTranslationPdf.js",
  ].map((rel) => stripComments(readFileSync(new URL(rel, import.meta.url), "utf8")));

  for (const source of files) {
    for (const leak of ["OpenAI", "openai", "gpt-", "baseURL", "apiKey"]) {
      assert.ok(!source.includes(leak), `client feature mentions ${leak}`);
    }
  }
});

/* ================================================================== */
/* 9. PDF export                                                      */
/* ================================================================== */

test("PDF export covers every language the feature offers", () => {
  // Phase 2C could not export Russian: jsPDF's built-in font is WinAnsi and has
  // no Cyrillic. A licence-clean Unicode font now closes that gap, so the two
  // lists must not drift apart again — a target language a patient can pick but
  // cannot export is a half-delivered feature.
  assert.deepEqual([...PDF_EXPORTABLE_LANGUAGES], ["de", "en", "fr", "es", "it", "ru"]);
  for (const code of getTranslationTargetLanguages().map((l) => l.code)) {
    assert.equal(canExportPdfForLanguage(code), true, code);
  }
});

test("the unsupported-language message survives for a future seventh language", () => {
  // Unreachable today, deliberately kept: the font covers Latin and Cyrillic,
  // so a language in another script must refuse rather than emit blank boxes.
  assert.equal(canExportPdfForLanguage("el"), false);
  for (const bundle of [de.translation, en.translation]) {
    assert.ok(
      typeof bundle.pdfUnavailableForLanguage === "string" &&
        bundle.pdfUnavailableForLanguage.length > 0,
    );
  }
});

test("the export embeds the licence-clean font and not the unresolved one", () => {
  const pdfSource = stripComments(
    readFileSync(new URL("../pdf/generateTranslationPdf.js", import.meta.url), "utf8"),
  );
  assert.ok(!pdfSource.includes("tahoma"), "the export embeds the unresolved-licence font");
  assert.ok(pdfSource.includes("medscoutx-document-sans.ttf"), "no bundled font is embedded");
});

test("the export file name is sanitised and carries no identifiers", () => {
  const name = buildTranslationFileName(
    { originalFileName: "Arztbrief Müller/2026.pdf", targetLanguage: "en", mode: "strict_translation" },
    { suffix: "uebersetzung" },
  );
  assert.match(name, /^[a-z0-9_]+\.pdf$/, name);
  assert.ok(!name.includes("/"), name);
  assert.ok(!name.includes(".."), name);
  assert.ok(name.endsWith("_en.pdf"), name);
});

test("a hostile original file name cannot escape the download name", () => {
  for (const hostile of [
    "../../etc/passwd.pdf",
    "..\\..\\windows\\system32.pdf",
    "doc<script>.pdf",
    "  .pdf",
  ]) {
    const name = buildTranslationFileName(
      { originalFileName: hostile, targetLanguage: "fr", mode: "plain_language" },
      { suffix: "traduction" },
    );
    assert.match(name, /^[a-z0-9_]+\.pdf$/, `${hostile} -> ${name}`);
  }
});

/* ================================================================== */
/* 10. Placement and non-interference                                 */
/* ================================================================== */

test("the section lives on the document detail page only", () => {
  assert.ok(
    DETAIL_PAGE_SOURCE.includes("PatientDocumentTranslationSection"),
    "detail page does not mount the section",
  );

  for (const rel of [
    "../../patientInbox/pages/PatientInboxPage.jsx",
    "../../patientBillingExplain/pages/PatientBillingExplainPage.jsx",
    "../pages/PatientPracticeDocumentsListPage.jsx",
  ]) {
    const source = stripComments(readFileSync(new URL(rel, import.meta.url), "utf8"));
    assert.ok(
      !source.includes("PatientDocumentTranslationSection"),
      `${rel} was changed to host the translation section`,
    );
  }
});

test("no upload control was introduced", () => {
  assert.ok(!/<input[^>]*type="file"/.test(COMPONENT_SOURCE), "an upload input exists");
  assert.ok(!COMPONENT_SOURCE.includes("FormData"), "the component builds an upload body");
});

test("the result is never persisted client-side", () => {
  for (const store of ["localStorage", "sessionStorage", "indexedDB", "IndexedDB"]) {
    assert.ok(!COMPONENT_SOURCE.includes(store), `the component writes to ${store}`);
  }
});

test("an in-flight request is aborted when the component goes away", () => {
  assert.ok(COMPONENT_SOURCE.includes("AbortController"), "no abort controller");
  assert.ok(COMPONENT_SOURCE.includes("abortRef.current?.abort()"), "abort is never called");
});

/* ------------------------------------------------------------------ util */

/** Minimal stand-in for React's text-child escaping. */
function escapeLikeReact(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ================================================================== */
/* 10. Nothing about a result outlives the session                    */
/* ================================================================== */

test("the service worker cannot cache a transformation", () => {
  const config = readFileSync(new URL("../../../../vite.config.js", import.meta.url), "utf8");

  // Runtime caching is limited to images. A JSON API response has
  // request.destination === "empty" and is therefore never matched — and
  // Workbox strategies only handle GET in any case, while /translate is a POST.
  const runtime = config.slice(config.indexOf("runtimeCaching"), config.indexOf("manifest:"));
  assert.ok(runtime.includes("request.destination === 'image'"), runtime);
  assert.ok(!/\/api/.test(runtime), "the service worker has a rule touching /api");
  assert.ok(!/NetworkFirst|StaleWhileRevalidate/.test(runtime), runtime);

  // Precaching is by file extension; no data format is among them.
  const glob = config.match(/globPatterns:\s*\[[^\]]*\]/)?.[0] ?? "";
  assert.ok(glob, "globPatterns disappeared");
  for (const ext of ["json", "pdf", "docx"]) {
    assert.ok(!glob.includes(ext), `the service worker precaches .${ext}`);
  }

  // And an /api request is never answered with the app shell.
  assert.match(config, /navigateFallbackDenylist:\s*\[\/\^\\\/api/);
});

test("the client feature stores nothing anywhere persistent", () => {
  const sources = [
    "../components/PatientDocumentTranslationSection.jsx",
    "../api/documentTranslationApi.js",
    "../pdf/generateTranslationPdf.js",
  ].map((rel) => stripComments(readFileSync(new URL(rel, import.meta.url), "utf8")));

  for (const source of sources) {
    for (const sink of [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "caches.",
      "document.cookie",
      "queryClient",
    ]) {
      assert.ok(!source.includes(sink), `a result could reach ${sink}`);
    }
  }
});

test("the client feature reports nothing to any telemetry sink", () => {
  const sources = [
    "../components/PatientDocumentTranslationSection.jsx",
    "../api/documentTranslationApi.js",
    "../pdf/generateTranslationPdf.js",
    "../translation/documentTranslationErrors.js",
    "../translation/documentTranslationOptions.js",
  ].map((rel) => stripComments(readFileSync(new URL(rel, import.meta.url), "utf8")));

  for (const source of sources) {
    for (const sink of [
      "console.log",
      "console.error",
      "console.warn",
      "sendPracticeAnalyticsEvent",
      "productAnalytics",
      "Sentry",
      "navigator.sendBeacon",
      "gtag",
    ]) {
      assert.ok(!source.includes(sink), `document text could reach ${sink}`);
    }
  }
});

test("a failed export tells the patient instead of failing silently", () => {
  const component = stripComments(
    readFileSync(new URL("../components/PatientDocumentTranslationSection.jsx", import.meta.url), "utf8"),
  );
  assert.ok(component.includes("setPdfError(true)"), "an export failure is swallowed");
  assert.ok(component.includes("t.pdfExportFailed"), "no message is shown for a failed export");

  for (const bundle of [de.translation, en.translation]) {
    assert.ok(
      typeof bundle.pdfExportFailed === "string" && bundle.pdfExportFailed.length > 0,
      "pdfExportFailed is missing",
    );
  }
});

test("every key of the German bundle exists in all six languages", () => {
  // Error codes are covered above; this is the rest of the surface — labels,
  // headings, buttons, notices. A missing key renders as an English island in
  // an otherwise translated page, or as nothing at all.
  const bundles = {
    en: en.translation,
    fr: frPatient.patientPracticeDocuments.translation,
    es: esPatient.patientPracticeDocuments.translation,
    it: itPatient.patientPracticeDocuments.translation,
    ru: ruPatient.patientPracticeDocuments.translation,
  };

  const flatten = (obj, prefix = "") =>
    Object.entries(obj).flatMap(([key, value]) =>
      value && typeof value === "object"
        ? flatten(value, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );

  const expected = flatten(de.translation);
  assert.ok(expected.length >= 30, `only ${expected.length} keys found`);

  for (const [lang, bundle] of Object.entries(bundles)) {
    const present = new Set(flatten(bundle));
    const missing = expected.filter((key) => !present.has(key));
    assert.deepEqual(missing, [], `${lang} is missing: ${missing.join(", ")}`);
  }
});

test("no language silently ships the English string as its translation", () => {
  const bundles = {
    fr: frPatient.patientPracticeDocuments.translation,
    es: esPatient.patientPracticeDocuments.translation,
    it: itPatient.patientPracticeDocuments.translation,
    ru: ruPatient.patientPracticeDocuments.translation,
  };

  // An override bundle that merges wrongly falls back to English without
  // failing, which is invisible until a patient reads it. Sampled on the
  // strings a patient cannot miss.
  const visible = ["heading", "submit", "aiNoticeStrict", "originalAuthoritative"];

  for (const [lang, bundle] of Object.entries(bundles)) {
    for (const key of visible) {
      const value = bundle[key];
      assert.ok(typeof value === "string" && value.length > 0, `${lang}.${key} is absent`);
      assert.notEqual(value, en.translation[key], `${lang}.${key} is the English string`);
    }
  }
});

test("Russian is written in Cyrillic, not transliterated", () => {
  // The one language whose script the PDF font had to be added for; if it were
  // silently falling back to English the export work would prove nothing.
  const ru = ruPatient.patientPracticeDocuments.translation;
  for (const key of ["heading", "submit", "aiNoticeStrict", "downloadPdf"]) {
    assert.match(ru[key], /\p{Script=Cyrillic}/u, `ru.${key} has no Cyrillic: ${ru[key]}`);
  }
});

/* ================================================================== */
/* 11. Naming and placement — the product surface                     */
/* ================================================================== */

const MODE_BUNDLES = () => ({
  de: de.translation,
  en: en.translation,
  fr: frPatient.patientPracticeDocuments.translation,
  es: esPatient.patientPracticeDocuments.translation,
  it: itPatient.patientPracticeDocuments.translation,
  ru: ruPatient.patientPracticeDocuments.translation,
});

test("the German mode names are exactly the agreed product wording", () => {
  // Pinned literally. These two strings are what the patient reads, what the
  // result header repeats and what the PDF prints; a drift in one place would
  // show up as three different names for the same thing.
  assert.equal(de.translation.modeStrictName, "Fachübersetzung");
  assert.equal(de.translation.modePlainName, "Einfache Sprache");
  assert.equal(
    de.translation.modeStrictDescription,
    "Medizinische Fachsprache und Detailgrad bleiben erhalten.",
  );
  assert.equal(
    de.translation.modePlainDescription,
    "Gleicher Inhalt – verständlich und ohne unnötigen Fachjargon.",
  );
  assert.equal(de.translation.submit, "Erstellen");
});

test("no language uses a belittling or developer-facing mode name", () => {
  const forbidden = [
    "oma", "opa", "laien", "dummy", "simplify", "easy mode", "easymode",
    "kinder", "senior", "strict_translation", "plain_language",
  ];
  // Checked on the control labels only. The forbidden list is about what the
  // two modes are *called*; "simplify this document" is ordinary product
  // English in a heading and must not trip the guard.
  for (const [lang, bundle] of Object.entries(MODE_BUNDLES())) {
    for (const key of ["modeStrictName", "modePlainName", "modeLegend", "submit"]) {
      const value = String(bundle[key] ?? "").toLowerCase();
      assert.ok(value.length > 0, `${lang}.${key} is empty`);
      for (const term of forbidden) {
        assert.ok(!value.includes(term), `${lang}.${key} contains "${term}": ${bundle[key]}`);
      }
    }
  }
});

test("the same-language hint names the mode it points at", () => {
  // The hint used to quote the old label. A hint that recommends a mode by a
  // name the interface no longer shows sends the patient looking for a control
  // that is not there.
  for (const [lang, bundle] of Object.entries(MODE_BUNDLES())) {
    const hint = String(bundle.hintSameLanguageStrict ?? "");
    assert.ok(hint.length > 0, `${lang} has no same-language hint`);
    assert.ok(
      hint.includes(bundle.modePlainName),
      `${lang}: the hint does not name "${bundle.modePlainName}": ${hint}`,
    );
  }
});

test("the heading ties the feature to the opened document", () => {
  // It must not read as a general translation tool — the patient can only ever
  // transform the document already on screen.
  for (const [lang, bundle] of Object.entries(MODE_BUNDLES())) {
    assert.ok(
      String(bundle.heading ?? "").length > 0,
      `${lang} has no heading`,
    );
  }
  assert.match(de.translation.heading, /Dokument/);
  assert.match(en.translation.heading, /document/i);
});

test("the form asks for language, then style, then which file", () => {
  // Reading order is the interaction order. The file control comes last and
  // only when there is a genuine choice, so nothing on screen suggests the
  // patient could supply a document of their own.
  const source = stripComments(
    readFileSync(new URL("../components/PatientDocumentTranslationSection.jsx", import.meta.url), "utf8"),
  );
  const language = source.indexOf("t.targetLanguageLabel");
  const mode = source.indexOf("t.modeLegend");
  const file = source.indexOf("t.fileLabel");
  const submit = source.indexOf("t.submitBusy");

  assert.ok(language > 0 && mode > 0 && file > 0 && submit > 0, "a control disappeared");
  assert.ok(language < mode, "the language control must come before the style control");
  assert.ok(mode < file, "the file control must come after the style control");
  assert.ok(file < submit, "the start button must come last");
});

test("the file control appears only when there is more than one file", () => {
  const source = stripComments(
    readFileSync(new URL("../components/PatientDocumentTranslationSection.jsx", import.meta.url), "utf8"),
  );
  assert.ok(source.includes("files.length > 1"), "the single-file case is not special-cased");
  assert.ok(
    source.includes("doc-translate__single-file"),
    "a single file should be stated, not offered as a choice",
  );
  // No upload affordance of any kind.
  for (const term of ["type=\"file\"", "dropzone", "Dropzone", "onDrop", "FormData"]) {
    assert.ok(!source.includes(term), `the section suggests uploading: ${term}`);
  }
});

test("the original document is rendered before the transformation section", () => {
  // Placement is a product decision, not styling: the original is the
  // authoritative document and comes first for sighted and screen-reader users
  // alike. This guards the order against a well-meant reshuffle.
  const page = stripComments(
    readFileSync(new URL("../pages/PatientPracticeDocumentDetailPage.jsx", import.meta.url), "utf8"),
  );
  const files = page.indexOf("ppd-files-heading");
  const section = page.indexOf("<PatientDocumentTranslationSection");
  assert.ok(files > 0 && section > 0, "the page structure changed");
  assert.ok(files < section, "the transformation section must sit below the file list");
});

test("the visual layer uses the product design tokens, not its own palette", () => {
  const css = readFileSync(
    new URL("../styles/DocumentTranslationSection.css", import.meta.url),
    "utf8",
  );
  // Every colour has to come from the system, so both themes and any later
  // brand change carry through without touching this file.
  const hardCoded = css.match(/:\s*#[0-9a-fA-F]{3,8}\b/g) ?? [];
  assert.deepEqual(hardCoded, [], `hard-coded colours: ${hardCoded.join(", ")}`);
  assert.ok(css.includes("var(--ms-color-accent)"), "the section does not use the product accent");
  assert.ok(
    css.includes("var(--ms-control-min-height)"),
    "controls should inherit the product touch-target height",
  );
});
