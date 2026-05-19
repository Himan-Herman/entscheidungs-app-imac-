/**
 * MDR-neutral checks for Symptom Check prompts.
 * Run: node server/scripts/verify-symptom-check-safety.js
 */
import { buildSymptomCheckPrompt } from "../../client/src/pages/prompt/textsymptomPrompt.js";
import { buildSymptomCheckSummaryPrompt } from "../../client/src/pages/prompt/symptomCheckSummaryPrompt.js";
import { splitSymptomAssistantResponse } from "../../client/src/features/symptomCheck/symptomSummaryParse.js";
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

const chatPrompt = buildSymptomCheckPrompt({ userTurns: 2, locale: "de" });
assert(chatPrompt.length < 1100, "chat prompt compact");
assert(chatPrompt.includes("FORBIDDEN"), "chat guardrails present");

const summaryPrompt = buildSymptomCheckSummaryPrompt({ locale: "en" });
assert(summaryPrompt.includes("MEDSCOUTX_SYMPTOM_CHECK_JSON"), "summary JSON marker");

const sample = `Short recap.
<<<MEDSCOUTX_SYMPTOM_CHECK_JSON>>>
{"mainComplaints":"Back pain","location":"lower back","timeline":"3 days","associatedFactors":"not specified","symptomSummary":"Pain when bending","specialties":["General practice"],"visitTopics":["Duration"]}
<<<END_MEDSCOUTX_SYMPTOM_CHECK_JSON>>>`;
const split = splitSymptomAssistantResponse(sample);
assert(split.summaryRaw?.mainComplaints === "Back pain", "JSON parse");
assert(!split.displayText.includes("MEDSCOUTX"), "display strips markers");

const unsafe =
  "Sie haben wahrscheinlich eine Entzündung. Gehen Sie dringend in die Notaufnahme.";
assert(
  detectForbiddenMedicalClaims(unsafe, AI_MODULES.SYMPTOM_CHECK).unsafe,
  "unsafe output detected",
);
const safe = sanitizeAiOutput(unsafe, {
  module: AI_MODULES.SYMPTOM_CHECK,
  locale: "de",
});
assert(safe.text !== unsafe, "sanitized or fallback");

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll symptom-check safety checks passed.");
