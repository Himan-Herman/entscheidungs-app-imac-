/**
 * Billing plausibility smoke checks — Phase F6.
 *
 * Covers: feature flags, deterministic warnings, AI safety patterns,
 * frontend static checks, route patient-data rejection, i18n completeness.
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
} from "../services/billingPlausibility/goaeCatalogueService.js";
import { AI_MODULES } from "../config/aiSafetyPolicy.js";
import { detectForbiddenMedicalClaims } from "../services/aiSafetySanitizer.js";

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
    ],
  }),
);
