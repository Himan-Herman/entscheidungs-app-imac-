/**
 * Billing-3 — deterministic GOÄ rule-engine verification (no DB, no framework).
 * Runs the PURE evaluateGoaeItems against a mock catalogue lookup and asserts
 * every rule + data-safety + i18n coverage. Run:  node server/scripts/verifyGoaeRuleEngine.js
 */
import assert from "node:assert/strict";
import { evaluateGoaeItems, RULE_SEVERITY } from "../services/billingPlausibility/goaeRuleEngineService.js";
import { getMessages } from "../../client/src/i18n/translations/index.js";

let failures = 0;
const ck = (cond, msg) => {
  if (!cond) {
    failures += 1;
    console.log("  ✗ " + msg);
  }
};

// Mock catalogue lookup (no DB).
const lookup = (code) => {
  const map = {
    "1": { points: 80, completenessStatus: "verified" },
    "2": { points: null, completenessStatus: "needs-review" },
    "3p": { points: 150, completenessStatus: "points-uncertain" },
  };
  return map[code] || null;
};

function findingsFor(items, base = { available: true, completeness: "verified" }) {
  return evaluateGoaeItems({ items, lookup, catalogueBase: base });
}
const ruleIds = (res) => res.findings.map((f) => f.ruleId);

// ── Catalogue-base hints ──────────────────────────────────────────────────────
ck(ruleIds(findingsFor([], { available: false })).includes("catalogue_base_missing"), "no active base → catalogue_base_missing");
ck(ruleIds(findingsFor([], { available: true, completeness: "initial-internal-subset" })).includes("catalogue_base_initial"), "initial base → catalogue_base_initial");
ck(!ruleIds(findingsFor([], { available: true, completeness: "verified" })).length, "verified base + no items → no findings");
console.log("  ✓ catalogue-base hints (missing / initial / verified)");

// ── Code existence ────────────────────────────────────────────────────────────
ck(ruleIds(findingsFor([{ code: "1", factor: "2,0", quantity: "1" }])).length === 0, "valid item (code found, factor 2.0, qty 1) → no findings");
ck(ruleIds(findingsFor([{ code: "99", factor: "1,0", quantity: "1" }])).includes("code_not_found"), "unknown code → code_not_found");
ck(ruleIds(findingsFor([{ code: "", factor: "1,0", quantity: "1" }])).includes("code_missing"), "empty code → code_missing");
console.log("  ✓ code existence (valid / not found / missing)");

// ── Points + completeness ───────────────────────────────────────────────────
{
  const r = ruleIds(findingsFor([{ code: "2", factor: "1,0", quantity: "1" }]));
  ck(r.includes("points_missing"), "points null → points_missing");
  ck(r.includes("entry_needs_review"), "needs-review entry → entry_needs_review");
}
ck(ruleIds(findingsFor([{ code: "3p", factor: "1,0", quantity: "1" }])).includes("entry_points_uncertain"), "points-uncertain → entry_points_uncertain");
console.log("  ✓ points missing / needs-review / points-uncertain");

// ── Factor band ───────────────────────────────────────────────────────────────
ck(ruleIds(findingsFor([{ code: "1", factor: "2,5", quantity: "1" }])).includes("factor_above_threshold"), "factor 2.5 → factor_above_threshold (warning)");
ck(ruleIds(findingsFor([{ code: "1", factor: "4,0", quantity: "1" }])).includes("factor_above_max"), "factor 4.0 → factor_above_max (review)");
ck(ruleIds(findingsFor([{ code: "1", factor: "0,5", quantity: "1" }])).includes("factor_below_min"), "factor 0.5 → factor_below_min (info)");
ck(ruleIds(findingsFor([{ code: "1", factor: "abc", quantity: "1" }])).includes("factor_invalid"), "factor 'abc' → factor_invalid");
{
  const sev = findingsFor([{ code: "1", factor: "4,0", quantity: "1" }]).findings.find((f) => f.ruleId === "factor_above_max").severity;
  ck(sev === RULE_SEVERITY.REVIEW, "factor_above_max severity = review_required");
}
console.log("  ✓ factor band (below-min / threshold / above-max / invalid)");

// ── Quantity ──────────────────────────────────────────────────────────────────
for (const q of ["", "0", "-1", "1.5", "abc"]) {
  ck(ruleIds(findingsFor([{ code: "1", factor: "1,0", quantity: q }])).includes("quantity_invalid"), `quantity "${q}" → quantity_invalid`);
}
ck(!ruleIds(findingsFor([{ code: "1", factor: "1,0", quantity: "3" }])).includes("quantity_invalid"), "quantity 3 → valid");
console.log("  ✓ quantity empty/zero/negative/decimal/non-numeric invalid; positive int valid");

// ── Output shape + data-safety ──────────────────────────────────────────────
{
  const res = findingsFor([{ code: "1", factor: "2,0", quantity: "1", note: "secret patient note", patientName: "X" }]);
  const json = JSON.stringify(res);
  ck(!/secret patient note|patientName|X\b/.test(json), "note/patient fields never echoed in output");
  ck(res.normalizedItems.every((n) => Object.keys(n).sort().join(",") === "code,factor,index,quantity"), "normalizedItems expose only index/code/factor/quantity");
  ck(res.findings.every((f) => ["index","code","ruleId","severity","messageKey","metadata"].every((k) => k in f)), "findings have structured shape");
  ck(["itemCount","findingCount","bySeverity"].every((k) => k in res.summary), "summary shape");
}
console.log("  ✓ structured output; no note/patient free-text echoed");

// ── i18n coverage: every messageKey + severity exists in de + en ────────────
{
  const allKeys = new Set();
  const big = findingsFor(
    [
      { code: "", factor: "abc", quantity: "" },
      { code: "99", factor: "0,5", quantity: "-1" },
      { code: "2", factor: "2,5", quantity: "1" },
      { code: "3p", factor: "4,0", quantity: "1" },
    ],
    { available: false },
  );
  big.findings.forEach((f) => allKeys.add(f.messageKey));
  for (const lang of ["de", "en"]) {
    const ns = getMessages(lang).practiceBillingPlausibility;
    for (const k of allKeys) ck(typeof ns?.[k] === "string" && ns[k].length > 0, `${lang}.${k} present`);
    for (const s of ["severityInfo", "severityWarning", "severityReviewRequired"]) ck(typeof ns?.[s] === "string", `${lang}.${s} present`);
  }
  // FR/ES/IT fallback (no crash, non-empty)
  for (const lang of ["fr", "es", "it"]) {
    const ns = getMessages(lang).practiceBillingPlausibility;
    for (const k of allKeys) ck(typeof ns?.[k] === "string" && ns[k].length > 0, `${lang} fallback ${k}`);
  }
  console.log(`  ✓ i18n: ${allKeys.size} messageKeys + 3 severities in de/en; fr/es/it fallback`);
}

if (failures === 0) {
  console.log("\nverifyGoaeRuleEngine OK — all rule + data-safety + i18n assertions passed.");
} else {
  console.log(`\nverifyGoaeRuleEngine FAILED — ${failures} assertion(s).`);
  process.exitCode = 1;
}
