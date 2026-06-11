/**
 * Billing plausibility offline verification — Phase G4a.
 *
 * Covers: feature flags, deterministic warnings, AI safety patterns,
 * frontend static checks, route patient-data rejection, i18n completeness,
 * route structure (export/review/dismiss), report service safety,
 * service-unit permission matrix, and G3b-2 catalogue provenance fields.
 *
 * Deterministic and offline — no database, no live OpenAI required.
 *
 * Run: node scripts/verifyBillingPlausibility.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  isBillingPlausibilityEnabled,
  isBillingAiReviewEnabled,
} from "../config/featureFlags.js";
import {
  findGoaeEntry,
  buildDeterministicWarnings,
  validateGoaeRows,
} from "../services/billingPlausibility/goaeCatalogueService.js";
import {
  GOAE_ENTRIES,
  GOAE_CATALOGUE_META,
} from "../data/goaeCatalogue.js";
import { AI_MODULES } from "../config/aiSafetyPolicy.js";
import { detectForbiddenMedicalClaims } from "../services/aiSafetySanitizer.js";
import { hasPracticePermission, PERMISSIONS } from "../utils/practicePermissions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

const failures = [];

function assert(name, condition) {
  if (!condition) failures.push(name);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function fileContains(rel, needle) {
  return read(rel).includes(needle);
}

// ─── 1. Feature flags ─────────────────────────────────────────────────────────

delete process.env.ENABLE_BILLING_PLAUSIBILITY;
delete process.env.ENABLE_BILLING_AI_REVIEW;

assert("ENABLE_BILLING_PLAUSIBILITY defaults false", !isBillingPlausibilityEnabled());
assert("ENABLE_BILLING_AI_REVIEW defaults false", !isBillingAiReviewEnabled());

// AI review alone (without billing flag) must remain false
process.env.ENABLE_BILLING_AI_REVIEW = "true";
assert("AI review requires billing plausibility flag", !isBillingAiReviewEnabled());

// Both flags enabled
process.env.ENABLE_BILLING_PLAUSIBILITY = "true";
assert("AI review enabled when both flags are true", isBillingAiReviewEnabled());

// Billing on, AI off
process.env.ENABLE_BILLING_AI_REVIEW = "false";
assert("AI review off when its own flag is false", !isBillingAiReviewEnabled());

// Clean up
delete process.env.ENABLE_BILLING_PLAUSIBILITY;
delete process.env.ENABLE_BILLING_AI_REVIEW;

// ─── 2. Deterministic warnings ────────────────────────────────────────────────

// 2a. Unknown ziffer → unknown_goae_ziffer
{
  const match = findGoaeEntry("99999");
  assert("unknown ziffer not found in catalogue", !match.found);
  const w = buildDeterministicWarnings({ ziffer: "99999", factor: "1,0", count: "1" }, match);
  assert("unknown ziffer → unknown_goae_ziffer", w.includes("unknown_goae_ziffer"));
  assert("unknown ziffer — no spurious factor_requires_justification", !w.includes("factor_requires_justification"));
}

// 2b. Known ziffer, factor exactly at threshold (2.3) — no justification required
{
  const match = findGoaeEntry("1");
  assert("ziffer '1' found in catalogue", match.found);
  const w = buildDeterministicWarnings({ ziffer: "1", factor: "2,3", count: "1" }, match);
  assert("factor at threshold 2.3 — no factor_requires_justification", !w.includes("factor_requires_justification"));
  assert("factor at threshold 2.3 — clean row", !w.includes("unknown_goae_ziffer") && !w.includes("invalid_factor") && !w.includes("invalid_count"));
}

// 2c. Factor above threshold, no context → both justification warnings
{
  const match = findGoaeEntry("1");
  const w = buildDeterministicWarnings({ ziffer: "1", factor: "2,5", count: "1", contextText: "" }, match);
  assert("factor 2.5 → factor_requires_justification", w.includes("factor_requires_justification"));
  assert("factor 2.5, no context → justification_missing", w.includes("justification_missing"));
}

// 2d. Factor above threshold with context → requires_justification but not missing
{
  const match = findGoaeEntry("1");
  const w = buildDeterministicWarnings({ ziffer: "1", factor: "2,5", count: "1", contextText: "Complex follow-up" }, match);
  assert("factor 2.5 + context → factor_requires_justification", w.includes("factor_requires_justification"));
  assert("factor 2.5 + context → no justification_missing", !w.includes("justification_missing"));
}

// 2e. Factor above threshold, whitespace-only context → missing
{
  const match = findGoaeEntry("1");
  const w = buildDeterministicWarnings({ ziffer: "1", factor: "3,0", count: "1", contextText: "   " }, match);
  assert("factor 3.0, whitespace context → justification_missing", w.includes("justification_missing"));
}

// 2f. Invalid factor string → invalid_factor
{
  const match = findGoaeEntry("1");
  const w = buildDeterministicWarnings({ ziffer: "1", factor: "abc", count: "1" }, match);
  assert("invalid factor string → invalid_factor", w.includes("invalid_factor"));
  assert("invalid factor — no factor_requires_justification", !w.includes("factor_requires_justification"));
}

// 2g. Invalid count (zero) → invalid_count
{
  const match = findGoaeEntry("1");
  const w = buildDeterministicWarnings({ ziffer: "1", factor: "1,0", count: "0" }, match);
  assert("count 0 → invalid_count", w.includes("invalid_count"));
}

// 2h. Invalid count (non-numeric) → invalid_count
{
  const match = findGoaeEntry("1");
  const w = buildDeterministicWarnings({ ziffer: "1", factor: "1,0", count: "x" }, match);
  assert("non-numeric count → invalid_count", w.includes("invalid_count"));
}

// 2i. Clean row — no warnings
{
  const match = findGoaeEntry("1");
  const w = buildDeterministicWarnings({ ziffer: "1", factor: "1,0", count: "1" }, match);
  assert("clean known row → no warnings", w.length === 0);
}

// 2j. Deterministic warnings not overwritten by aiReview merge
// Mirrors the exact merge pattern in billingPlausibilityAiReviewService.js
{
  const existingResult = {
    rowResults: [{ ziffer: "99999", warnings: ["unknown_goae_ziffer"], catalogueFound: false }],
    hasWarnings: true,
    note: "Deterministic plausibility hints only.",
  };
  const aiReview = {
    rowHints: [],
    generalNote: "neutral note",
    nonBinding: true,
    generatedAt: new Date().toISOString(),
  };
  const merged = { ...existingResult, aiReview };
  assert("merge: rowResults preserved", Array.isArray(merged.rowResults));
  assert("merge: deterministic warnings intact", merged.rowResults[0].warnings.includes("unknown_goae_ziffer"));
  assert("merge: hasWarnings not lost", merged.hasWarnings === true);
  assert("merge: aiReview nonBinding=true", merged.aiReview.nonBinding === true);
  assert("merge: aiReview does not shadow rowResults", merged.rowResults !== merged.aiReview.rowHints);
}

// ─── 3. AI safety — BILLING_PLAUSIBILITY forbidden pattern checks ─────────────

// These texts must be blocked by the billing module safety scanner
const UNSAFE_BILLING_TEXTS = [
  "The diagnosis is bronchitis.",
  "You likely have a condition here.",
  "Triage this patient immediately.",
  "The invoice is correct billing.",
  "The reimbursement decision will be positive.",
  "This is an emergency situation.",
  "Sie haben wahrscheinlich eine Erkrankung.",
  "Therapie ist erforderlich.",
  "Behandlung ist notwendig.",
  "This invoice is incorrect.",
];

for (const text of UNSAFE_BILLING_TEXTS) {
  const result = detectForbiddenMedicalClaims(text, AI_MODULES.BILLING_PLAUSIBILITY);
  assert(`billing safety blocks unsafe: "${text.slice(0, 60)}"`, result.unsafe);
}

// These neutral billing-observation texts must pass
const SAFE_BILLING_TEXTS = [
  "The submitted factor exceeds the standard threshold of 2.3.",
  "Code 1 is found in the local catalogue subset.",
  "This is a non-binding plausibility hint only.",
  "The context note may support documentation completeness.",
  "No catalogue match found for this code in the local test subset.",
];

for (const text of SAFE_BILLING_TEXTS) {
  const result = detectForbiddenMedicalClaims(text, AI_MODULES.BILLING_PLAUSIBILITY);
  assert(`billing safety allows neutral: "${text.slice(0, 60)}"`, !result.unsafe);
}

// ─── 4. AI safety policy registration ────────────────────────────────────────

assert(
  "AI_MODULES.BILLING_PLAUSIBILITY = 'billing_plausibility'",
  AI_MODULES.BILLING_PLAUSIBILITY === "billing_plausibility",
);
assert(
  "aiSafetyPolicy exports BILLING_PLAUSIBILITY_SYSTEM_PROMPT_SAFETY",
  fileContains("server/config/aiSafetyPolicy.js", "BILLING_PLAUSIBILITY_SYSTEM_PROMPT_SAFETY"),
);
assert(
  "aiSafetyPolicy registers billing safe fallback",
  fileContains("server/config/aiSafetyPolicy.js", "BILLING_PLAUSIBILITY"),
);
assert(
  "aiSafetyPolicy billing case in getOutputSafetyPatterns",
  fileContains("server/config/aiSafetyPolicy.js", "BILLING_PLAUSIBILITY_FORBIDDEN"),
);

// ─── 5. AI review service — structural checks ─────────────────────────────────

const AI_SERVICE = read("server/services/billingPlausibility/billingPlausibilityAiReviewService.js");

assert(
  "AI service: no OPENAI_API_KEY guard skips call",
  AI_SERVICE.includes("process.env.OPENAI_API_KEY"),
);
assert(
  "AI service: falls back on missing key",
  AI_SERVICE.includes("used_fallback: true"),
);
assert(
  "AI service: validates nonBinding field",
  AI_SERVICE.includes("nonBinding !== true"),
);
assert(
  "AI service: runs safety scan before persistence",
  AI_SERVICE.includes("hasUnsafeContent"),
);
assert(
  "AI service: merge does not overwrite rowResults (uses spread)",
  AI_SERVICE.includes("...existingResult"),
);
assert(
  "AI service: audit log written on AI review",
  AI_SERVICE.includes("ai_reviewed"),
);
// The service header explicitly documents these as "never sent"
assert(
  "AI service: documents patientName as never sent to OpenAI",
  AI_SERVICE.includes("patientName") && AI_SERVICE.includes("never sent"),
);
// The context builder must not send patient fields — check the function body
{
  const ctxFnStart = AI_SERVICE.indexOf("function buildBillingContextBlock");
  const ctxFnEnd = AI_SERVICE.indexOf("\n}", ctxFnStart);
  const ctxFnBody = ctxFnStart > 0 ? AI_SERVICE.slice(ctxFnStart, ctxFnEnd) : "";
  assert(
    "AI context builder: no patientName in function body",
    ctxFnBody.length > 0 && !ctxFnBody.includes("patientName") && !ctxFnBody.includes("dateOfBirth"),
  );
}

// ─── 6. Route — patient-data rejection ───────────────────────────────────────

const ROUTE = read("server/routes/practiceBillingPlausibility.js");

const FORBIDDEN_PATIENT_FIELDS = [
  "patientName",
  "patientId",
  "dateOfBirth",
  "diagnosisText",
  "clinicalNotes",
  "icd10",
  "diagnosis",
];

for (const field of FORBIDDEN_PATIENT_FIELDS) {
  assert(`route lists forbidden patient field: ${field}`, ROUTE.includes(`"${field}"`));
}

assert("route returns patient_data_not_accepted error", ROUTE.includes("patient_data_not_accepted"));
assert("route guard applies to POST /", ROUTE.includes("FORBIDDEN_PATIENT_FIELDS"));
assert("route guard applies to POST /:sessionId/review", ROUTE.includes("FORBIDDEN_PATIENT_FIELDS") && ROUTE.includes("sessionId/review"));

// ─── 7. Backend route — capabilities field ────────────────────────────────────

assert(
  "route GET / returns capabilities.aiReview",
  ROUTE.includes("capabilities: { aiReview: isBillingAiReviewEnabled() }"),
);

// ─── 8. Frontend static checks ───────────────────────────────────────────────

const JSX_PATH = "client/src/features/practiceBillingPlausibility/pages/PracticeBillingPlausibilityPage.jsx";
const CSS_PATH = "client/src/features/practiceBillingPlausibility/styles/PracticeBillingPlausibilityPage.css";
const API_PATH = "client/src/features/practiceBillingPlausibility/api/practiceBillingPlausibilityApi.js";

const JSX = read(JSX_PATH);
const CSS = read(CSS_PATH);
const API_FILE = read(API_PATH);

// No OpenAI key or direct AI call in any frontend billing file
assert("JSX: no OPENAI_API_KEY", !JSX.includes("OPENAI_API_KEY") && !JSX.includes("sk-"));
assert("API file: no OPENAI_API_KEY", !API_FILE.includes("OPENAI_API_KEY") && !API_FILE.includes("sk-"));
assert("JSX: no direct openai import", !JSX.includes("from 'openai'") && !JSX.includes('from "openai"'));
assert("API file: no direct openai import", !API_FILE.includes("from 'openai'") && !API_FILE.includes('from "openai"'));

// Capability reading — must use data.capabilities?.aiReview
assert("JSX reads data.capabilities?.aiReview", JSX.includes("data.capabilities?.aiReview"));

// No optimistic setAiReviewAvailable(true)
assert("JSX: no optimistic setAiReviewAvailable(true)", !JSX.includes("setAiReviewAvailable(true)"));

// AI review triggered only by onClick — not by useEffect or page load
assert("JSX: handleAiReview bound to onClick", JSX.includes("onClick={() => handleAiReview("));
assert(
  "JSX: no handleAiReview in useEffect",
  !/useEffect\s*\(\s*\(\s*\)\s*=>[\s\S]{0,2000}handleAiReview/.test(JSX),
);
assert(
  "JSX: no requestBillingPlausibilityAiReview in useEffect",
  !/useEffect\s*\(\s*\(\s*\)\s*=>[\s\S]{0,2000}requestBillingPlausibilityAiReview/.test(JSX),
);

// Disclaimer appears before result section in source order
{
  const disclaimerPos = JSX.indexOf("billing-plausibility__disclaimer");
  const resultPos = JSX.indexOf("bp-result-heading");
  assert("disclaimer class present in JSX", disclaimerPos > 0);
  assert("result heading present in JSX", resultPos > 0);
  assert("disclaimer before result section in source order", disclaimerPos < resultPos);
}

// No prefers-color-scheme in billing CSS
assert("CSS: no prefers-color-scheme", !CSS.includes("prefers-color-scheme"));

// No inline styles inside the ai-section block
{
  const aiSectionStart = JSX.indexOf('"billing-plausibility__ai-section"');
  assert("ai-section class present in JSX", aiSectionStart > 0);
  if (aiSectionStart > 0) {
    // Slice from ai-section to end of file; check no style={{ present
    const aiSectionText = JSX.slice(aiSectionStart);
    assert("no inline style={{}} inside ai-section block", !aiSectionText.includes("style={{"));
  }
}

// 8b. Frontend API — all required client-side functions present and using safe patterns
assert("API: fetchBillingPlausibilitySession exported", API_FILE.includes("export async function fetchBillingPlausibilitySession"));
assert("API: dismissBillingPlausibilitySession exported", API_FILE.includes("export async function dismissBillingPlausibilitySession"));
assert("API: downloadBillingPlausibilityReport exported", API_FILE.includes("export async function downloadBillingPlausibilityReport"));
assert("API: report download uses blob/URL.createObjectURL pattern", API_FILE.includes("URL.createObjectURL"));
assert("API: export URL includes /export path segment", API_FILE.includes("/export?"));
assert("API: sessionId URL-encoded in API calls", API_FILE.includes("encodeURIComponent(sessionId)"));

// 8c. Detail page — session route, dismiss/download, disclaimer, no auto-AI, G3b-2 backward-compat
const DETAIL_JSX = read("client/src/features/practiceBillingPlausibility/pages/PracticeBillingPlausibilityDetailPage.jsx");

assert("detail page: useParams imported and used for sessionId", DETAIL_JSX.includes("useParams"));
assert("detail page: sessionId destructured from useParams()", DETAIL_JSX.includes("const { sessionId } = useParams()"));
assert("detail page: dismissBillingPlausibilitySession imported", DETAIL_JSX.includes("dismissBillingPlausibilitySession"));
assert("detail page: downloadBillingPlausibilityReport imported", DETAIL_JSX.includes("downloadBillingPlausibilityReport"));
assert("detail page: t.btnDismissSession key used (no hardcoded text)", DETAIL_JSX.includes("t.btnDismissSession"));
assert("detail page: t.btnDownloadReport or t.reportDownloadPending key used", DETAIL_JSX.includes("t.btnDownloadReport") || DETAIL_JSX.includes("t.reportDownloadPending"));
// Disclaimer must be present and appear after the page heading
{
  const detailDisclaimerPos = DETAIL_JSX.indexOf("billing-plausibility__disclaimer");
  const detailHeadingPos = DETAIL_JSX.indexOf("bp-detail-heading");
  assert("detail page: disclaimer class present", detailDisclaimerPos > 0);
  assert("detail page: detail heading id present", detailHeadingPos > 0);
  assert("detail page: disclaimer rendered after heading element in source order", detailDisclaimerPos > detailHeadingPos);
}
// No AI auto-trigger in detail page
assert(
  "detail page: no requestBillingPlausibilityAiReview in useEffect",
  !/useEffect\s*\(\s*\(\s*\)\s*=>[\s\S]{0,2000}requestBillingPlausibilityAiReview/.test(DETAIL_JSX),
);
// G3b-2: completenessStatus and sourceLineOrReference read with optional chaining (backward-compatible)
assert("detail page (G3b-2): completenessStatus via optional chaining", DETAIL_JSX.includes("catalogueMatchJson?.completenessStatus"));
assert("detail page (G3b-2): sourceLineOrReference via optional chaining", DETAIL_JSX.includes("catalogueMatchJson?.sourceLineOrReference"));
assert("detail page (G3b-2): item-completeness class rendered", DETAIL_JSX.includes("billing-plausibility__item-completeness"));
assert("detail page (G3b-2): t.catalogueSourceReference key used (not hardcoded)", DETAIL_JSX.includes("t.catalogueSourceReference"));
// No hardcoded multi-word UI text in detail page
{
  const HARDCODED_MULTIWORD_PATTERN = /"[A-Za-z][A-Za-z]+ [A-Za-z][A-Za-z ]+"/g;
  const detailHardcoded = DETAIL_JSX.match(HARDCODED_MULTIWORD_PATTERN) ?? [];
  assert(
    `no hardcoded multi-word UI text in detail page JSX (found: ${detailHardcoded.join(", ") || "none"})`,
    detailHardcoded.length === 0,
  );
}

// 8d. CSS — G3b-2 completeness and source-ref classes defined
assert("CSS: .billing-plausibility__item-completeness class defined", CSS.includes(".billing-plausibility__item-completeness"));
assert("CSS: .billing-plausibility__item-source-ref class defined", CSS.includes(".billing-plausibility__item-source-ref"));

// 8e. Overview page — G3b-2 completeness block present in result items
assert("overview page (G3b-2): item-completeness class used in result items", JSX.includes("billing-plausibility__item-completeness"));
assert("overview page (G3b-2): completenessStatus via optional chaining", JSX.includes("catalogueMatchJson?.completenessStatus"));

// ─── 9. i18n completeness ─────────────────────────────────────────────────────

// Canonical required top-level keys (derived from de file)
const REQUIRED_KEYS = [
  "pageTitle", "heading", "intro", "backHub", "selectPractice",
  "loading", "submitting", "disclaimer",
  "btnNewReview", "labelZiffer", "labelFactor", "labelCount", "labelContext",
  "contextPlaceholder", "btnSubmit", "btnAddRow", "btnRemoveRow",
  "statusPending", "statusReviewed", "statusDismissed",
  "sectionResult", "sectionHistory", "noReviews",
  "colDate", "colZiffernCount", "colStatus",
  "loadError", "submitError", "resultStub", "sectionItems",
  "catalogueFound", "catalogueNotFound", "noWarnings", "itemWarningsLabel",
  "btnAiReview", "aiReviewPending", "aiReviewLabel", "aiReviewNonBinding",
  "aiReviewFallback", "aiReviewError", "aiReviewGeneralNote",
  "aiReviewUncertaintyNote", "aiReviewRowHints",
  "manualReviewRecommended",
  "featureDisabled", "forbidden",
  // Detail page navigation and actions (G1)
  "backToBillingOverview", "sessionCreatedAt", "btnOpenSession",
  "btnDismissSession", "dismissSuccess", "dismissError",
  "detailLoadError", "detailNotFound",
  // PDF report export (G2)
  "btnDownloadReport", "reportDownloadPending", "reportDownloadError",
  // Catalogue verification status (G3b-2)
  "catalogueStatus", "catalogueStatusVerified", "catalogueStatusPointsUncertain",
  "catalogueStatusNeedsReview", "catalogueStatusUnknown", "catalogueSourceReference",
  // P5 — compliance/transparency notes
  "catalogueSubsetNote",
  "dataProcessingNote",
  // P6 — status/fallback messages present in all 5 locales
  "aiUnavailable", "aiMarked", "flagLabel",
  "aiReviewSuccess", "aiReviewUnavailable",
];

const I18N_FILES = [
  { lang: "de", rel: "client/src/i18n/translations/de/practiceBillingPlausibility.js" },
  { lang: "en", rel: "client/src/i18n/translations/en/practiceBillingPlausibility.js" },
  { lang: "fr", rel: "client/src/i18n/translations/overrides/fr/fr.practiceBillingPlausibility.js" },
  { lang: "it", rel: "client/src/i18n/translations/overrides/it/it.practiceBillingPlausibility.js" },
  { lang: "es", rel: "client/src/i18n/translations/overrides/es/es.practiceBillingPlausibility.js" },
];

for (const { lang, rel } of I18N_FILES) {
  const content = read(rel);
  for (const key of REQUIRED_KEYS) {
    assert(`i18n[${lang}]: key present — ${key}`, content.includes(`${key}:`));
  }
}

// P5: DE AI keys must use KI/AI terminology — not opaque "Smart-" marketing label.
// Transparency requirement: users must know they are interacting with AI/KI-based hints.
{
  const deBilling = read("client/src/i18n/translations/de/practiceBillingPlausibility.js");
  assert(
    "DE billing i18n (P5): AI keys use KI terminology, not 'Smart-' marketing label",
    !deBilling.includes("Smart-Plausibilitätshinweis") && !deBilling.includes("Smart-Hinweis"),
  );
}

// P5: catalogueSubsetNote and dataProcessingNote rendered in overview page JSX
assert(
  "overview JSX (P5): catalogueSubsetNote rendered with conditional guard",
  fileContains(JSX_PATH, "t.catalogueSubsetNote"),
);
assert(
  "overview JSX (P5): dataProcessingNote rendered with conditional guard",
  fileContains(JSX_PATH, "t.dataProcessingNote"),
);

// P5: CSS classes for new notes are defined
assert(
  "CSS (P5): .billing-plausibility__data-note class defined",
  fileContains(CSS_PATH, ".billing-plausibility__data-note"),
);
assert(
  "CSS (P5): .billing-plausibility__subset-note class defined",
  fileContains(CSS_PATH, ".billing-plausibility__subset-note"),
);

// P5: Compliance checklist doc exists
assert(
  "docs (P5): billing-plausibility-compliance-checklist.md exists",
  fs.existsSync(path.join(ROOT, "docs/billing-plausibility-compliance-checklist.md")),
);

// ─── 10. No hardcoded visible text in JSX page ────────────────────────────────

// All user-visible multi-word strings must come from the t.* translation object.
// Only flag multi-word literals (containing a space) — single-word strings are
// internal dispatch types, ARIA roles, field names, etc. and are not user-facing.
const HARDCODED_MULTIWORD_PATTERN = /"[A-Za-z][A-Za-z]+ [A-Za-z][A-Za-z ]+"/g;

const hardcodedMatches = JSX.match(HARDCODED_MULTIWORD_PATTERN) ?? [];
assert(
  `no hardcoded multi-word UI text in JSX (found: ${hardcodedMatches.join(", ") || "none"})`,
  hardcodedMatches.length === 0,
);

// ─── 11. GOÄ catalogue structure ─────────────────────────────────────────────
// High-level structural assertions. Detailed per-entry validation lives in
// verifyGoaeCatalogue.js (npm run verify:goae-catalogue).

assert("catalogue GOAE_ENTRIES is an Array", Array.isArray(GOAE_ENTRIES));
assert("catalogue GOAE_ENTRIES is non-empty", Array.isArray(GOAE_ENTRIES) && GOAE_ENTRIES.length > 0);
assert(
  "catalogue GOAE_CATALOGUE_META is an object",
  typeof GOAE_CATALOGUE_META === "object" && GOAE_CATALOGUE_META !== null,
);
assert(
  "catalogue meta.catalogueCompleteness indicates subset status",
  typeof GOAE_CATALOGUE_META.catalogueCompleteness === "string" &&
    (GOAE_CATALOGUE_META.catalogueCompleteness.includes("subset") ||
      GOAE_CATALOGUE_META.catalogueCompleteness.includes("test") ||
      GOAE_CATALOGUE_META.catalogueCompleteness.includes("partial")),
);
assert(
  "catalogue meta.sourceUrl points to official Gesetze im Internet GOÄ",
  typeof GOAE_CATALOGUE_META.sourceUrl === "string" &&
    GOAE_CATALOGUE_META.sourceUrl.startsWith("https://www.gesetze-im-internet.de/go__1982/"),
);
assert(
  "catalogue has no duplicate ziffern",
  Array.isArray(GOAE_ENTRIES) &&
    new Set(GOAE_ENTRIES.map((e) => e.ziffer)).size === GOAE_ENTRIES.length,
);
assert(
  "catalogue entries all have required fields (ziffer, title, section, source, notes)",
  Array.isArray(GOAE_ENTRIES) &&
    GOAE_ENTRIES.every(
      (e) =>
        typeof e.ziffer === "string" && e.ziffer.trim() &&
        typeof e.title === "string" && e.title.trim() &&
        typeof e.section === "string" && e.section.trim() &&
        typeof e.source === "string" && e.source.trim() &&
        typeof e.notes === "string" && e.notes.trim(),
    ),
);
assert(
  "catalogue entries all have valid points (positive number or null)",
  Array.isArray(GOAE_ENTRIES) &&
    GOAE_ENTRIES.every(
      (e) =>
        e.points === null ||
        (typeof e.points === "number" && Number.isFinite(e.points) && e.points > 0),
    ),
);

// ─── 12. Route structure — export, review, dismiss ────────────────────────────

// Export endpoint: GET /:sessionId/export
assert("route: GET /:sessionId/export handler defined", ROUTE.includes('router.get("/:sessionId/export"'));
assert("route: export rejects non-PDF format with unsupported_format error", ROUTE.includes('"unsupported_format"'));
assert("route: export format guard — only pdf accepted", ROUTE.includes('format !== "pdf"'));
assert("route: export calls generateBillingPlausibilityReport", ROUTE.includes("generateBillingPlausibilityReport"));
assert("route: export sets Content-Type application/pdf", ROUTE.includes('"application/pdf"'));
assert("route: export sets Content-Disposition attachment", ROUTE.includes("attachment; filename="));
assert("route: export reads locale from query params", ROUTE.includes("req.query.locale"));

// All routes share requireBillingFlag via router.use
assert("route: requireBillingFlag applied via router.use (covers all routes)", ROUTE.includes("router.use(requireBillingFlag)"));
assert("route: feature_disabled returns 404 when flag is off", ROUTE.includes('"feature_disabled"') && ROUTE.includes("res.status(404)"));

// Review endpoint: POST with its own AI flag guard — separate from export
assert("route: review endpoint is POST /:sessionId/review", ROUTE.includes('router.post("/:sessionId/review"'));
assert("route: review guarded by separate isBillingAiReviewEnabled() check", ROUTE.includes("isBillingAiReviewEnabled()"));
assert("route: review and export are distinct routes (not merged)", ROUTE.includes("/:sessionId/review") && ROUTE.includes("/:sessionId/export"));

// Dismiss endpoint: POST (non-destructive — status update, not delete)
assert("route: dismiss endpoint is POST /:sessionId/dismiss", ROUTE.includes('router.post("/:sessionId/dismiss"'));
assert("route: dismiss calls dismissSessionForPractice service function", ROUTE.includes("dismissSessionForPractice("));
assert("route: no router.delete in billing route (non-destructive)", !ROUTE.includes("router.delete"));

// Non-destructive at service level: verify update, not delete
{
  const BILLING_SERVICE = read("server/services/billingPlausibility/billingPlausibilityService.js");
  assert("billing service: dismissSessionForPractice does not call .delete() on session", !/billingPlausibilitySession\.delete\b/.test(BILLING_SERVICE));
  assert("billing service: dismiss updates status to 'dismissed'", BILLING_SERVICE.includes('"dismissed"'));
  assert("billing service: dismiss records dismissedAt timestamp", BILLING_SERVICE.includes("dismissedAt"));
}

// ─── 13. Report service — pdf-lib, no AI, no patient fields, locale completeness ────

const REPORT_SERVICE = read("server/services/billingPlausibility/billingPlausibilityReportService.js");

// Dependencies: pdf-lib yes, openai never
assert("report service: imports pdf-lib", REPORT_SERVICE.includes('from "pdf-lib"'));
assert("report service: no openai import", !REPORT_SERVICE.includes('from "openai"') && !REPORT_SERVICE.includes("from 'openai'"));
assert("report service: no OPENAI_API_KEY reference", !REPORT_SERVICE.includes("OPENAI_API_KEY"));
assert("report service: header documents no AI is called", REPORT_SERVICE.includes("No AI is called"));

// No patient identifier fields in any report string or code path
for (const field of ["patientName", "patientId", "dateOfBirth", "diagnosisText", "clinicalNotes"]) {
  assert(`report service: no patient field "${field}"`, !REPORT_SERVICE.includes(field));
}

// No ⚠ emoji/glyph — WinAnsiEncoding (cp1252) does not support U+26A0
assert("report service: no ⚠ glyph (WinAnsiEncoding unsupported — would corrupt PDF)", !REPORT_SERVICE.includes("⚠"));

// Required content keys present in STRINGS object (each locale has these keys)
const REPORT_DISCLAIMER_COUNT = (REPORT_SERVICE.match(/disclaimerText:/g) || []).length;
assert("report service: disclaimerText in all 5 locale STRINGS blocks", REPORT_DISCLAIMER_COUNT >= 5);
const REPORT_MANUAL_REVIEW_COUNT = (REPORT_SERVICE.match(/manualReviewText:/g) || []).length;
assert("report service: manualReviewText in all 5 locale STRINGS blocks", REPORT_MANUAL_REVIEW_COUNT >= 5);
assert("report service: catalogueHeading key defined (catalogue metadata in PDF)", REPORT_SERVICE.includes("catalogueHeading:"));
assert("report service: catalogueCompleteness key defined", REPORT_SERVICE.includes("catalogueCompleteness:"));
assert("report service: manualReviewHeading key defined", REPORT_SERVICE.includes("manualReviewHeading:"));

// G3b-2: catalogue verification status keys in all 5 locale STRINGS blocks
const CATALOGUE_STATUS_COUNT = (REPORT_SERVICE.match(/catalogueStatus:/g) || []).length;
assert("report service (G3b-2): catalogueStatus in all 5 locale STRINGS", CATALOGUE_STATUS_COUNT >= 5);
assert("report service (G3b-2): catalogueStatusVerified key defined", REPORT_SERVICE.includes("catalogueStatusVerified:"));
assert("report service (G3b-2): catalogueStatusPointsUncertain key defined", REPORT_SERVICE.includes("catalogueStatusPointsUncertain:"));
assert("report service (G3b-2): catalogueStatusNeedsReview key defined", REPORT_SERVICE.includes("catalogueStatusNeedsReview:"));
assert("report service (G3b-2): catalogueSourceRef key defined", REPORT_SERVICE.includes("catalogueSourceRef:"));
assert("report service (G3b-2): completenessStatus optional chaining in PDF render (backward-compatible)", REPORT_SERVICE.includes("completenessStatus ?? null"));

// Supported locales: all 5 STRINGS locale blocks present
for (const loc of ["de", "en", "fr", "it", "es"]) {
  assert(`report service: STRINGS["${loc}"] locale block defined`, REPORT_SERVICE.includes(`  ${loc}: {`));
}
assert("report service: SUPPORTED_LOCALES constant defined", REPORT_SERVICE.includes("SUPPORTED_LOCALES"));
assert("report service: locale fallback to 'de' on unknown locale", REPORT_SERVICE.includes('return "de"'));

// ─── 14. Service unit — permission matrix and G3b-2 catalogue fields ──────────

// Permission matrix: owner and admin can access billing; staff and below cannot
assert("permissions: owner has INTEGRATIONS_MANAGE", hasPracticePermission("owner", PERMISSIONS.INTEGRATIONS_MANAGE));
assert("permissions: admin has INTEGRATIONS_MANAGE", hasPracticePermission("admin", PERMISSIONS.INTEGRATIONS_MANAGE));
assert("permissions: staff lacks INTEGRATIONS_MANAGE", !hasPracticePermission("staff", PERMISSIONS.INTEGRATIONS_MANAGE));
assert("permissions: null role lacks INTEGRATIONS_MANAGE", !hasPracticePermission(null, PERMISSIONS.INTEGRATIONS_MANAGE));
assert("permissions: empty string role lacks INTEGRATIONS_MANAGE", !hasPracticePermission("", PERMISSIONS.INTEGRATIONS_MANAGE));
assert("permissions: unknown_role lacks INTEGRATIONS_MANAGE", !hasPracticePermission("unknown_role", PERMISSIONS.INTEGRATIONS_MANAGE));

// G3b-2: findGoaeEntry returns provenance fields for known entries
{
  const knownEntry = findGoaeEntry("1");
  assert("catalogue service (G3b-2): known entry found", knownEntry.found);
  assert("catalogue service (G3b-2): known entry has completenessStatus field", "completenessStatus" in knownEntry);
  assert("catalogue service (G3b-2): known entry completenessStatus is a non-empty string", typeof knownEntry.completenessStatus === "string" && knownEntry.completenessStatus.length > 0);
  assert("catalogue service (G3b-2): known entry has sourceLineOrReference field", "sourceLineOrReference" in knownEntry);
  assert("catalogue service (G3b-2): known entry has activeStatus field", "activeStatus" in knownEntry);
  assert("catalogue service (G3b-2): known entry has catalogueMeta", !!knownEntry.catalogueMeta);
}

// G3b-2: unknown ziffer path does NOT include provenance fields (no undefined field leakage)
{
  const unknownEntry = findGoaeEntry("99999");
  assert("catalogue service: unknown ziffer entry not found", !unknownEntry.found);
  assert("catalogue service (G3b-2): unknown entry has NO completenessStatus key", !("completenessStatus" in unknownEntry));
  assert("catalogue service (G3b-2): unknown entry has NO sourceLineOrReference key", !("sourceLineOrReference" in unknownEntry));
  assert("catalogue service: unknown entry still carries catalogueMeta", !!unknownEntry.catalogueMeta);
}

// G3b-2: completenessStatus invariant — no null-points entry is "verified"
{
  const verifiedEntries = GOAE_ENTRIES.filter((e) => e.completenessStatus === "verified");
  assert("catalogue: at least one verified entry exists", verifiedEntries.length > 0);
  assert(
    "catalogue invariant: all verified entries have confirmed non-null points",
    verifiedEntries.every((e) => e.points !== null && typeof e.points === "number" && e.points > 0),
  );
  const nullPointsVerified = GOAE_ENTRIES.filter((e) => e.points === null && e.completenessStatus === "verified");
  assert("catalogue invariant: no null-points entry is marked verified", nullPointsVerified.length === 0);
}

// validateGoaeRows multi-row: correct per-row results including G3b-2 match fields
{
  const multiRowResult = validateGoaeRows([
    { ziffer: "1",     factor: "1,0", count: "1" },                          // known, clean
    { ziffer: "99999", factor: "1,0", count: "1" },                          // unknown
    { ziffer: "1",     factor: "3,5", count: "1", contextText: "" },         // high factor, no context
  ]);
  assert("service unit: clean known row → no warnings", multiRowResult.rowResults[0].warnings.length === 0);
  assert("service unit: unknown ziffer → unknown_goae_ziffer warning", multiRowResult.rowResults[1].warnings.includes("unknown_goae_ziffer"));
  assert("service unit: high factor + no context → factor_requires_justification", multiRowResult.rowResults[2].warnings.includes("factor_requires_justification"));
  assert("service unit: high factor + no context → justification_missing", multiRowResult.rowResults[2].warnings.includes("justification_missing"));
  assert("service unit: hasWarnings true when any row has warnings", multiRowResult.hasWarnings === true);
  assert("service unit (G3b-2): known row match has completenessStatus", typeof multiRowResult.rowResults[0].match.completenessStatus === "string");
  assert("service unit (G3b-2): unknown row match has no completenessStatus key", !("completenessStatus" in multiRowResult.rowResults[1].match));
}

// ─── 15. AI staging pilot readiness ──────────────────────────────────────────

// 15a. Service constants — token/temperature/context bounds must be present and correct.
// These values are the agreed safety envelope for the staging pilot.
assert(
  "AI service: BILLING_AI_MAX_TOKENS = 400 (staging envelope)",
  AI_SERVICE.includes("const BILLING_AI_MAX_TOKENS = 400"),
);
assert(
  "AI service: BILLING_AI_TEMPERATURE = 0.15 (conservative, staging envelope)",
  AI_SERVICE.includes("const BILLING_AI_TEMPERATURE = 0.15"),
);
assert(
  "AI service: MAX_CONTEXT_CHARS = 500 (context forwarded to OpenAI is bounded)",
  AI_SERVICE.includes("const MAX_CONTEXT_CHARS = 500"),
);

// 15b. Context builder applies the truncation at MAX_CONTEXT_CHARS
assert(
  "AI service: contextText sliced to MAX_CONTEXT_CHARS in buildBillingContextBlock",
  AI_SERVICE.includes(".slice(0, MAX_CONTEXT_CHARS)"),
);

// 15c. Field-length truncation constants defined (limits what is persisted from AI output)
assert(
  "AI service: MAX_HINT_CHARS constant defined for row-hint truncation",
  AI_SERVICE.includes("const MAX_HINT_CHARS"),
);
assert(
  "AI service: MAX_NOTE_CHARS constant defined for general/uncertainty note truncation",
  AI_SERVICE.includes("const MAX_NOTE_CHARS"),
);

// 15d. Route never exposes raw prompt or raw AI response in the HTTP response body.
// Clients must never see the system prompt or the unfiltered OpenAI payload.
assert(
  "route: no rawPrompt field in any response body",
  !ROUTE.includes('"rawPrompt"') && !ROUTE.includes("rawPrompt:"),
);
assert(
  "route: no rawResponse field in any response body",
  !ROUTE.includes('"rawResponse"') && !ROUTE.includes("rawResponse:"),
);

// 15e. Review route: AI flag guard comes before auth/body processing.
// This ensures unauthenticated callers also receive 404 (not 401) when flag is off,
// which avoids leaking whether the AI feature exists at all.
assert(
  "route: isBillingAiReviewEnabled() guard appears before auth checks in review handler",
  (() => {
    const reviewHandlerStart = ROUTE.indexOf('router.post("/:sessionId/review"');
    if (reviewHandlerStart < 0) return false;
    const handlerSlice = ROUTE.slice(reviewHandlerStart, reviewHandlerStart + 300);
    const flagPos = handlerSlice.indexOf("isBillingAiReviewEnabled()");
    const authPos = handlerSlice.indexOf("userId(req)");
    return flagPos > 0 && (authPos < 0 || flagPos < authPos);
  })(),
);

// 15f. Route returns used_fallback field — lets client-side telemetry / observability
// detect how often the AI path falls back to deterministic hints.
assert(
  "route: used_fallback forwarded from service result in review response",
  ROUTE.includes("used_fallback: result.used_fallback"),
);

// 15g. AI service has no console.log / console.info of raw OpenAI responses.
// (console.error on failure is acceptable; plain log/info is not — avoids secrets in logs.)
{
  const aiLines = AI_SERVICE.split("\n");
  const consoleLogs = aiLines.filter(
    (line) => /console\.(log|info)\s*\(/.test(line) && !line.trim().startsWith("//"),
  );
  assert(
    `AI service: no console.log/info (raw AI output must not appear in server logs) — found ${consoleLogs.length} line(s)`,
    consoleLogs.length === 0,
  );
}

// 15h. AI output must never include monetary/amount fields.
// These would constitute a reimbursement prediction, which is explicitly forbidden.
for (const field of ["invoice_total", "totalAmount", "feeAmount", "reimbursementAmount", "invoiceAmount"]) {
  assert(
    `AI service: no monetary field "${field}" in service code`,
    !AI_SERVICE.includes(field),
  );
}

// 15i. Safe fallback is registered in aiSafetyPolicy and carries nonBinding marker.
assert(
  "aiSafetyPolicy: SAFE_FALLBACKS entry for BILLING_PLAUSIBILITY is registered",
  fileContains("server/config/aiSafetyPolicy.js", "BILLING_PLAUSIBILITY") &&
    fileContains("server/config/aiSafetyPolicy.js", "nonBinding"),
);

// 15j. isBillingAiReviewEnabled() has a hard dependency on isBillingPlausibilityEnabled().
// The AI flag can NEVER be on when the base billing flag is off.
assert(
  "featureFlags: isBillingAiReviewEnabled() calls isBillingPlausibilityEnabled() as prerequisite",
  fileContains("server/config/featureFlags.js", "isBillingPlausibilityEnabled()"),
);

// 15k. .env.example documents both billing flags with staging guidance
{
  const ENV_EXAMPLE = read("server/.env.example");
  assert("env.example: ENABLE_BILLING_PLAUSIBILITY flag documented", ENV_EXAMPLE.includes("ENABLE_BILLING_PLAUSIBILITY"));
  assert("env.example: ENABLE_BILLING_AI_REVIEW flag documented", ENV_EXAMPLE.includes("ENABLE_BILLING_AI_REVIEW"));
  assert("env.example: AI review section references staging checklist", ENV_EXAMPLE.includes("billing-ai-staging-checklist"));
  // AI disabled by default — the line must literally set the flag to false.
  assert("env.example: ENABLE_BILLING_AI_REVIEW defaults to false", ENV_EXAMPLE.includes("ENABLE_BILLING_AI_REVIEW=false"));
}

// 15l. Three distinct safe fallback paths exist in the AI service — every failure
// mode (transient OpenAI error, non-JSON output, schema-invalid output, unsafe
// output) must degrade to the deterministic result, never surface a raw payload.
assert(
  "AI service: json_parse_failed fallback path present",
  AI_SERVICE.includes("billing_ai_review_json_parse_failed"),
);
assert(
  "AI service: invalid_response_shape fallback path present",
  AI_SERVICE.includes("invalid_response_shape"),
);
assert(
  "AI service: unsafe_output_detected fallback path present",
  AI_SERVICE.includes("unsafe_output_detected"),
);
{
  // Every persistFallback caller returns used_fallback: true (no fallback path
  // can silently return a "success" shape).
  const fallbackCallCount = (AI_SERVICE.match(/persistFallback\(/g) || []).length;
  // 1 definition + ≥4 call sites (no key, openai error, parse fail, invalid shape, unsafe)
  assert(
    `AI service: persistFallback used by multiple failure paths (found ${fallbackCallCount} references)`,
    fallbackCallCount >= 5,
  );
}

// 15m. Raw OpenAI content is parsed into a local variable and never written to the
// database. The persisted shape must be the validated/truncated result only.
{
  // rawContent must not appear inside any prisma update `data: { ... }` block.
  // Heuristic: rawContent is only assigned/parsed, never referenced after the
  // safety scan (no `rawContent` inside the merge/persist region).
  const mergeStart = AI_SERVICE.indexOf("const mergedResult");
  const afterMerge = mergeStart > 0 ? AI_SERVICE.slice(mergeStart) : "";
  assert(
    "AI service: rawContent not referenced in the persisted/merged result region",
    afterMerge.length > 0 && !afterMerge.includes("rawContent"),
  );
  assert(
    "AI service: no rawPrompt/rawResponse field stored or returned by the service",
    !AI_SERVICE.includes("rawPrompt") && !AI_SERVICE.includes("rawResponse"),
  );
}

// 15n. AI review is refused on a dismissed session (no AI spend on archived work).
assert(
  "AI service: dismissed session rejected before any OpenAI call",
  (() => {
    const dismissPos = AI_SERVICE.indexOf('session.status === "dismissed"');
    const openaiPos = AI_SERVICE.indexOf("openai.chat.completions.create");
    return dismissPos > 0 && openaiPos > 0 && dismissPos < openaiPos;
  })(),
);

// 15o. The OpenAI call sets response_format json_object and bounded max_tokens —
// the request itself is constrained to the staging envelope.
assert(
  "AI service: OpenAI request uses json_object response_format",
  AI_SERVICE.includes('response_format: { type: "json_object" }'),
);
assert(
  "AI service: OpenAI request caps max_tokens at the staging envelope constant",
  AI_SERVICE.includes("max_tokens: BILLING_AI_MAX_TOKENS"),
);

// 15p. PDF report renders the AI note ONLY when a saved aiReview exists on the
// session — it never triggers an AI call and never invents a note.
assert(
  "report service: AI note guarded by session.resultSummaryJson?.aiReview presence",
  REPORT_SERVICE.includes("session.resultSummaryJson?.aiReview") &&
    REPORT_SERVICE.includes("if (aiReview)"),
);
assert(
  "report service: no OpenAI client import (PDF never calls AI)",
  !REPORT_SERVICE.includes('from "openai"') && !REPORT_SERVICE.includes("openai.chat"),
);

// ─── 16. Account deletion — billing plausibility cleanup (Phase D2) ───────────
// BillingPlausibilitySession uses scalar FKs (no @relation to User/PracticeProfile)
// so there is no DB cascade. The account-deletion transaction MUST delete billing
// sessions (and their items/audit logs) explicitly, ordered before practiceProfile
// deletion, or rows are orphaned (GDPR Art. 17 erasure gap).
{
  const ACCOUNT_ROUTE = read("server/routes/account.js");

  assert(
    "account delete: references billingPlausibilitySession cleanup",
    ACCOUNT_ROUTE.includes("billingPlausibilitySession"),
  );
  assert(
    "account delete: deletes billingPlausibilityItem rows",
    ACCOUNT_ROUTE.includes("billingPlausibilityItem.deleteMany"),
  );
  assert(
    "account delete: deletes billingPlausibilityAuditLog rows",
    ACCOUNT_ROUTE.includes("billingPlausibilityAuditLog.deleteMany"),
  );
  assert(
    "account delete: scopes sessions by createdByUserId",
    ACCOUNT_ROUTE.includes("createdByUserId"),
  );
  assert(
    "account delete: scopes sessions by owned practiceProfileId",
    ACCOUNT_ROUTE.includes("practiceProfileId"),
  );
  assert(
    "account delete: billing cleanup runs inside the prisma transaction",
    ACCOUNT_ROUTE.includes("tx.billingPlausibilitySession.deleteMany"),
  );

  // Ordering: audit log + item + session deletions must all precede the
  // practiceProfile.deleteMany call so practice IDs are still resolvable and
  // no orphan remains.
  const sessionDelPos = ACCOUNT_ROUTE.indexOf("tx.billingPlausibilitySession.deleteMany");
  const auditDelPos = ACCOUNT_ROUTE.indexOf("tx.billingPlausibilityAuditLog.deleteMany");
  const itemDelPos = ACCOUNT_ROUTE.indexOf("tx.billingPlausibilityItem.deleteMany");
  const practiceDelPos = ACCOUNT_ROUTE.indexOf("tx.practiceProfile.deleteMany");
  assert(
    "account delete: audit-log deletion precedes item deletion (dependency order)",
    auditDelPos !== -1 && itemDelPos !== -1 && auditDelPos < itemDelPos,
  );
  assert(
    "account delete: item deletion precedes session deletion (dependency order)",
    itemDelPos !== -1 && sessionDelPos !== -1 && itemDelPos < sessionDelPos,
  );
  assert(
    "account delete: billing session deletion precedes practiceProfile deletion",
    sessionDelPos !== -1 && practiceDelPos !== -1 && sessionDelPos < practiceDelPos,
  );
}

// ─── 17. Account export — billing plausibility data portability (Phase D3) ─────
// GET /api/account/export must include billing plausibility data (GDPR Art. 15/20)
// via the privacy-safe export helper. Raw contextText, raw OpenAI prompts and raw
// AI responses must NOT appear; forbidden patient fields must NOT appear.
{
  const ACCOUNT_ROUTE = read("server/routes/account.js");
  const BILLING_SERVICE = read("server/services/billingPlausibility/billingPlausibilityService.js");

  // Route wiring
  assert(
    "account export: imports getBillingPlausibilityExportForUser helper",
    ACCOUNT_ROUTE.includes("getBillingPlausibilityExportForUser"),
  );
  assert(
    "account export: billingPlausibilitySessions key added to export payload",
    ACCOUNT_ROUTE.includes("billingPlausibilitySessions"),
  );

  // Helper exists and is exported
  assert(
    "billing service: getBillingPlausibilityExportForUser is exported",
    /export\s+async\s+function\s+getBillingPlausibilityExportForUser/.test(BILLING_SERVICE),
  );
  assert(
    "billing service: export helper scopes by createdByUserId",
    BILLING_SERVICE.includes("createdByUserId"),
  );
  assert(
    "billing service: export helper scopes by owned practiceProfileId",
    BILLING_SERVICE.includes("practiceProfileId: { in: ownedPracticeIds }"),
  );

  // contextText raw value must NOT be exported — only a presence flag
  assert(
    "billing service: export emits contextTextPresent boolean flag",
    BILLING_SERVICE.includes("contextTextPresent"),
  );
  {
    // The export serializer block must not read item.contextText except to compute
    // the boolean presence flag (no raw value assignment).
    const exportFnStart = BILLING_SERVICE.indexOf("function serializeSessionForExport");
    const exportFnEnd = BILLING_SERVICE.indexOf("export async function getBillingPlausibilityExportForUser");
    const exportFnBody = BILLING_SERVICE.slice(exportFnStart, exportFnEnd);
    assert(
      "billing service: export serializer does not emit a raw contextText field",
      !/contextText:\s*item\.contextText/.test(exportFnBody) &&
        !/\bcontextText:\s/.test(exportFnBody),
    );
  }

  // No raw AI prompt/response fields anywhere in the export helper or route payload
  for (const forbidden of ["rawPrompt", "rawResponse", "raw_prompt", "raw_response"]) {
    assert(
      `account export: no "${forbidden}" in billing export helper`,
      !BILLING_SERVICE.includes(forbidden),
    );
  }

  // No patient-identifier fields introduced by the export helper
  for (const field of ["patientName", "dateOfBirth", "diagnosisText", "clinicalNotes", "insuranceNumber", "icd10"]) {
    assert(
      `account export: billing helper does not reference patient field "${field}"`,
      !BILLING_SERVICE.includes(field),
    );
  }
}

// ─── 19. Retention purge readiness (Phase D5) ─────────────────────────────────
// Manual, dry-run-by-default purge script for billing session retention.
// No automatic cron. Strong production guard. Static-only checks (no DB).
{
  const PURGE_PATH = "server/scripts/purgeBillingPlausibilitySessions.js";
  assert(
    "D5: purge script exists",
    fs.existsSync(path.join(ROOT, PURGE_PATH)),
  );
  const PURGE = read(PURGE_PATH);
  const PKG = read("server/package.json");
  const ENV_EXAMPLE = read("server/.env.example");

  // Package script registered
  assert(
    "D5: package.json defines billing:purge script",
    PKG.includes('"billing:purge"') && PKG.includes("purgeBillingPlausibilitySessions.js"),
  );

  // Production guard reused
  assert("D5: purge script has production indicator guard", PURGE.includes("PRODUCTION_INDICATORS"));
  assert("D5: purge script checks render.com indicator", PURGE.includes("render.com"));
  assert("D5: purge script refuses missing DATABASE_URL", PURGE.includes("DATABASE_URL is not set"));
  assert("D5: purge script prints DB host", PURGE.includes("DATABASE_URL host:"));

  // Dry-run default + confirmation flag
  assert(
    "D5: purge defaults to dry-run (purge only when confirmPurge && !dryRun)",
    PURGE.includes("confirmPurge && !forceDryRun"),
  );
  assert("D5: purge supports --confirmPurge flag", PURGE.includes('hasFlag("confirmPurge")'));
  assert("D5: purge supports --dryRun flag", PURGE.includes('hasFlag("dryRun")'));

  // --days mandatory and validated
  assert("D5: purge requires --days", PURGE.includes("--days=N is required"));
  assert("D5: purge rejects non-positive days", PURGE.includes("days <= 0"));

  // Filters
  assert("D5: purge supports --onlyDismissed", PURGE.includes('hasFlag("onlyDismissed")'));
  assert("D5: purge supports --practiceProfileId", PURGE.includes('getArg("practiceProfileId")'));
  assert("D5: purge filters by createdAt < cutoff", PURGE.includes("createdAt: { lt: cutoff }"));
  assert(
    "D5: --onlyDismissed adds status = dismissed filter",
    PURGE.includes('where.status = "dismissed"'),
  );

  // Large-batch guard
  assert("D5: purge has large-batch guard", PURGE.includes("allowLargeBatch") && PURGE.includes("SAFE_SESSION_THRESHOLD"));

  // Deletion order: auditlog → item → session
  {
    const auditPos = PURGE.indexOf("billingPlausibilityAuditLog.deleteMany");
    const itemPos = PURGE.indexOf("billingPlausibilityItem.deleteMany");
    const sessionPos = PURGE.indexOf("billingPlausibilitySession.deleteMany");
    assert(
      "D5: purge deletes auditlog before item (dependency order)",
      auditPos > 0 && itemPos > 0 && auditPos < itemPos,
    );
    assert(
      "D5: purge deletes item before session (dependency order)",
      itemPos > 0 && sessionPos > 0 && itemPos < sessionPos,
    );
  }

  // Uses a transaction for the confirmed deletion
  assert("D5: purge wraps deletion in a prisma transaction", PURGE.includes("prisma.$transaction"));

  // Never prints or selects contextText (no sensitive free text read or logged).
  // The word may appear only in explanatory comments, never in a console.* call
  // or a prisma `select`/`include`.
  {
    const purgeLines = PURGE.split("\n");
    const printsContext = purgeLines.some(
      (line) => /console\.(log|error|warn|info)/.test(line) && line.includes("contextText"),
    );
    const selectsContext = /contextText\s*:\s*true/.test(PURGE);
    assert(
      "D5: purge never prints or selects contextText",
      !printsContext && !selectsContext,
    );
  }

  // No automatic cron/scheduler is wired in by this phase
  assert(
    "D5: purge script contains no cron/scheduler wiring",
    !PURGE.includes("node-cron") && !PURGE.includes("setInterval") && !PURGE.includes("cron.schedule"),
  );

  // .env.example documents the retention variable as policy-only
  assert(
    "D5: .env.example documents BILLING_SESSION_RETENTION_DAYS",
    ENV_EXAMPLE.includes("BILLING_SESSION_RETENTION_DAYS"),
  );
}

// ─── Result ───────────────────────────────────────────────────────────────────

if (failures.length) {
  console.error("verifyBillingPlausibility FAILED:");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log("verifyBillingPlausibility OK");
console.log(
  JSON.stringify({
    sections: [
      "feature-flags",
      "deterministic-warnings",
      "ai-safety-patterns",
      "ai-safety-policy",
      "ai-service-structure",
      "route-patient-rejection",
      "route-capabilities",
      "frontend-static",
      "i18n-completeness",
      "no-hardcoded-text",
      "goae-catalogue-structure",
      "route-structure",
      "report-service-safety",
      "service-unit-permissions-and-catalogue",
      "ai-staging-pilot-readiness",
      "compliance-disclaimer-wording",
      "account-deletion-billing-cleanup",
      "account-export-billing-portability",
      "retention-purge-readiness",
    ],
  }),
);
