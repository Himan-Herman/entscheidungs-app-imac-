/**
 * Verification script for lab patient explanation service.
 *
 * Tests:
 *   1. Feature flag guard (disabled by default)
 *   2. Safety patterns — forbidden output is blocked
 *   3. sanitizeAiOutput — phrases are replaced, output remains safe
 *   4. Safe fallback text itself passes safety scanner
 *   5. Real OpenAI call with sample entries (requires OPENAI_API_KEY + feature flag)
 *
 * Run (basic):
 *   node scripts/verifyLabPatientExplanation.js
 *
 * Run (full with OpenAI):
 *   ENABLE_LAB_PATIENT_EXPLANATION=true OPENAI_API_KEY=sk-... node scripts/verifyLabPatientExplanation.js
 */

import { AI_MODULES, getSafeFallback } from "../config/aiSafetyPolicy.js";
import { shouldRegenerateUnsafeOutput, sanitizeAiOutput } from "../services/aiSafetySanitizer.js";
import { isLabPatientExplanationEnabled } from "../config/featureFlags.js";

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}
function fail(label, detail) {
  console.error(`  ✗ ${label}${detail ? `: ${detail}` : ""}`);
  failed++;
}
function assert(condition, label, detail) {
  if (condition) ok(label);
  else fail(label, detail);
}

// ─── Test 1: Feature flag ────────────────────────────────────────────────────
console.log("\n[1] Feature flag");
if (process.env.ENABLE_LAB_PATIENT_EXPLANATION === "true") {
  assert(isLabPatientExplanationEnabled() === true, "flag returns true when env is set");
} else {
  assert(isLabPatientExplanationEnabled() === false, "flag defaults to false");
  console.log("    → Set ENABLE_LAB_PATIENT_EXPLANATION=true to run OpenAI test");
}

// ─── Test 2: Safety patterns ─────────────────────────────────────────────────
console.log("\n[2] Safety patterns (LAB_PATIENT_EXPLANATION module)");

// These contain patterns that trigger full regeneration (scanner blocks AFTER phrase replacement)
const MUST_BLOCK_SAMPLES = [
  "Dieser Wert deutet auf Diabetes hin.",
  "Sie haben wahrscheinlich eine Anämie.",
  "Bitte gehen Sie sofort zum Arzt.",
  "This is an emergency — see a doctor immediately.",
  "High risk for cardiovascular disease.",
  "Sie sollten sofort einen Kardiologen aufsuchen.",
  "Ihr Ergebnis ist lebensgefährlich.",
  "Krebs kann nicht ausgeschlossen werden.",
];
// These are sanitized by phrase replacement (result is safe, text changes)
const MUST_SANITIZE_SAMPLES = [
  "Das könnte auf eine Herzerkrankung hinweisen.",
];

const ALLOWED_SAMPLES = [
  "Hämoglobin ist ein Protein in den roten Blutkörperchen, das Sauerstoff transportiert. Ihr Wert liegt unterhalb des Referenzbereichs. Bitte sprechen Sie mit Ihrem Arzt über dieses Ergebnis.",
  "Leukozyten sind weiße Blutkörperchen, die das Immunsystem unterstützen. Ihr Wert liegt innerhalb des Referenzbereichs. Bitte sprechen Sie mit Ihrem Arzt über dieses Ergebnis.",
  "Der TSH-Wert misst die Aktivität der Schilddrüse. Kein Referenzbereich angegeben. Bitte sprechen Sie mit Ihrem Arzt über dieses Ergebnis.",
  "Hemoglobin is a protein in red blood cells that carries oxygen. Your value is above the reference range. Please speak with your doctor about this result.",
];

for (const sample of MUST_BLOCK_SAMPLES) {
  const blocked = shouldRegenerateUnsafeOutput(sample, AI_MODULES.LAB_PATIENT_EXPLANATION);
  assert(blocked, `blocks (regenerate): "${sample.slice(0, 60)}"`);
}

for (const sample of MUST_SANITIZE_SAMPLES) {
  const result = sanitizeAiOutput(sample, { locale: "de", module: AI_MODULES.LAB_PATIENT_EXPLANATION });
  const outputSafe = !shouldRegenerateUnsafeOutput(result.text, AI_MODULES.LAB_PATIENT_EXPLANATION);
  const textChanged = result.text !== sample;
  assert(outputSafe && textChanged, `sanitizes (phrase replaced): "${sample.slice(0, 60)}"`);
}

for (const sample of ALLOWED_SAMPLES) {
  const blocked = shouldRegenerateUnsafeOutput(sample, AI_MODULES.LAB_PATIENT_EXPLANATION);
  assert(!blocked, `allows: "${sample.slice(0, 60)}"`);
}

// ─── Test 3: sanitizeAiOutput — output always safe ───────────────────────────
console.log("\n[3] sanitizeAiOutput (phrases replaced, output remains safe)");

const PHRASE_TESTS = [
  { input: "Das klingt nach einer Eisenmangelanämie.", changesText: false },
  { input: "Das deutet auf eine schwere Erkrankung hin.", changesText: true },
];

for (const { input, changesText } of PHRASE_TESTS) {
  const result = sanitizeAiOutput(input, {
    locale: "de",
    module: AI_MODULES.LAB_PATIENT_EXPLANATION,
  });
  const outputSafe = !shouldRegenerateUnsafeOutput(result.text, AI_MODULES.LAB_PATIENT_EXPLANATION);
  assert(outputSafe, `output safe after sanitize: "${input.slice(0, 50)}"`);
  if (changesText) {
    assert(result.text !== input, `text was modified: "${input.slice(0, 50)}"`);
  }
}

// ─── Test 4: Fallback text is itself safe ────────────────────────────────────
console.log("\n[4] Safe fallback text passes safety check");

for (const locale of ["de", "en"]) {
  const fallback = getSafeFallback(AI_MODULES.LAB_PATIENT_EXPLANATION, locale);
  const blocked = shouldRegenerateUnsafeOutput(fallback, AI_MODULES.LAB_PATIENT_EXPLANATION);
  assert(!blocked, `fallback (${locale}) passes safety scanner`);
}

// ─── Test 5: Real OpenAI call ────────────────────────────────────────────────
if (!process.env.OPENAI_API_KEY || !isLabPatientExplanationEnabled()) {
  console.log("\n[5] Real OpenAI call — SKIP (set ENABLE_LAB_PATIENT_EXPLANATION=true and OPENAI_API_KEY)");
} else {
  console.log("\n[5] Real OpenAI call with sample lab entries");

  const SAMPLE_ENTRIES = [
    { label: "Hämoglobin", valueText: "11.2", unit: "g/dL", referenceRangeText: "12.0–16.0" },
    { label: "Leukozyten", valueText: "6.8", unit: "10³/µL", referenceRangeText: "4.0–10.0" },
    { label: "TSH", valueText: "5.9", unit: "mIU/L", referenceRangeText: "0.4–4.0" },
    { label: "Glukose", valueText: "95", unit: "mg/dL", referenceRangeText: "70–100" },
    { label: "Kreatinin", valueText: "1.1", unit: "mg/dL", referenceRangeText: null },
  ];

  try {
    const { openai } = await import("../openaiClient.js");

    const SYSTEM = `You are a patient information assistant. Explain what each lab parameter measures and whether value is within/outside reference range. Return ONLY a JSON object with key "explanations" containing an array. Each element: { "label": string, "explanation": string, "inRange": true | false | null }. No diagnosis, no urgency, no treatment advice. End each explanation with "Bitte sprechen Sie mit Ihrem Arzt über dieses Ergebnis."`;

    const lines = SAMPLE_ENTRIES.map(
      (e, i) =>
        `${i + 1}. ${e.label}: ${e.valueText}${e.unit ? " " + e.unit : ""}${e.referenceRangeText ? " | Referenzbereich: " + e.referenceRangeText : ""}`,
    ).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Language: German (Deutsch)\n\nLab entries:\n${lines}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "";
    const parsed = JSON.parse(raw);
    const explanations = Array.isArray(parsed?.explanations) ? parsed.explanations : parsed;

    assert(Array.isArray(explanations), "response is an array");
    assert(explanations.length === SAMPLE_ENTRIES.length, `length matches (${explanations.length}/${SAMPLE_ENTRIES.length})`);

    let allSafe = true;
    for (const [i, item] of explanations.entries()) {
      if (shouldRegenerateUnsafeOutput(item.explanation, AI_MODULES.LAB_PATIENT_EXPLANATION)) {
        fail(`entry[${i}] "${item.label}" safety check`, item.explanation.slice(0, 100));
        allSafe = false;
      }
    }
    if (allSafe) ok("all entries pass safety scanner");

    const hb = explanations.find((e) => e.label?.includes("Hämoglobin"));
    assert(hb?.inRange === false, "Hämoglobin 11.2 (ref 12.0–16.0) → inRange: false");

    const leuk = explanations.find((e) => e.label?.includes("Leukozyten"));
    assert(leuk?.inRange === true, "Leukozyten 6.8 (ref 4.0–10.0) → inRange: true");

    const tsh = explanations.find((e) => e.label?.includes("TSH"));
    assert(tsh?.inRange === false, "TSH 5.9 (ref 0.4–4.0) → inRange: false");

    const krea = explanations.find((e) => e.label?.includes("Kreatinin"));
    assert(krea?.inRange === null, "Kreatinin (no ref range) → inRange: null");

    if (hb?.explanation) {
      console.log(`\n  Sample output (Hämoglobin):\n  "${hb.explanation.slice(0, 200)}"`);
    }
  } catch (err) {
    fail("OpenAI call", err.message);
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`  Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) process.exit(1);
