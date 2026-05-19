/**
 * Quick MDR-neutral checks for body-map prompts and region hints.
 * Run: node server/scripts/verify-body-map-safety.js
 */
import { buildKoerpersymptomPrompt } from "../../client/src/pages/prompt/koerpersymptomPrompt.js";
import { buildKoerpersymptomSummaryPrompt } from "../../client/src/pages/prompt/koerpersymptomSummaryPrompt.js";
import {
  categorizeBodyRegion,
  getRegionQuestionHints,
} from "../../client/src/features/bodyMap/bodyMapRegionHints.js";
import { splitBodyMapAssistantResponse } from "../../client/src/features/bodyMap/bodyMapSummaryParse.js";
import {
  detectForbiddenMedicalClaims,
  sanitizeAiOutput,
} from "../services/aiSafetySanitizer.js";
import { AI_MODULES } from "../config/aiSafetyPolicy.js";

let failed = 0;

function assert(condition, label) {
  if (!condition) {
    console.error("FAIL:", label);
    failed += 1;
  } else {
    console.log("OK:", label);
  }
}

const chatPrompt = buildKoerpersymptomPrompt({
  organName: "Kopf",
  userTurns: 2,
  locale: "de",
});
assert(chatPrompt.length < 1200, "chat prompt compact");
assert(chatPrompt.includes("FORBIDDEN"), "chat prompt has guardrails");
assert(chatPrompt.includes("nicht angegeben"), "chat prompt missing-value rule");

const summaryPrompt = buildKoerpersymptomSummaryPrompt({
  organName: "Brust",
  locale: "en",
});
assert(summaryPrompt.includes("MEDSCOUTX_BODY_MAP_JSON"), "summary JSON marker");

const hints = getRegionQuestionHints("kopf", "de");
assert(hints.includes("seit wann"), "head hints de");
assert(categorizeBodyRegion("linke Lunge") === "chest", "chest category");

const sample = `Kurze Zusammenfassung.
<<<MEDSCOUTX_BODY_MAP_JSON>>>
{"region":"Kopf","symptomSummary":"Druck","timeline":"3 Tage","associatedFactors":"nicht angegeben","specialties":["Neurologie"],"visitTopics":["Dauer"]}
<<<END_MEDSCOUTX_BODY_MAP_JSON>>>`;
const split = splitBodyMapAssistantResponse(sample);
assert(split.summaryRaw?.region === "Kopf", "JSON parse");
assert(!split.displayText.includes("MEDSCOUTX"), "display strips markers");

const unsafeSample =
  "Sie haben wahrscheinlich eine Entzündung. Gehen Sie sofort in die Notaufnahme.";
assert(
  detectForbiddenMedicalClaims(unsafeSample, AI_MODULES.BODY_MAP).unsafe,
  "unsafe output detected",
);
const safe = sanitizeAiOutput(unsafeSample, {
  module: AI_MODULES.BODY_MAP,
  locale: "de",
});
assert(safe.text !== unsafeSample, "unsafe output sanitized or fallback");

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll body-map safety checks passed.");
