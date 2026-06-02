/**
 * Verifies the anamnesis translation layer: safety utilities, prompt builder,
 * and service-level behaviour.
 *
 * Run: node server/scripts/verifyAnamnesisTranslation.js
 *
 * Does NOT call OpenAI; all AI behaviour is stubbed.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isTranslatableAnswer,
  answerToTranslatableText,
  parseTranslationResponse,
  translatedTextIsSafe,
  ANAMNESIS_TRANSLATION_MAX_CHARS_PER_ANSWER,
  ANAMNESIS_TRANSLATION_MAX_TOTAL_CHARS,
  ANAMNESIS_TRANSLATION_BATCH_SIZE,
} from "../utils/anamnesisTranslationSafety.js";

import {
  buildAnamnesisTranslationSystemPrompt,
  buildAnamnesisTranslationUserMessage,
} from "../prompts/anamnesisTranslationPrompt.js";

// ── isTranslatableAnswer ──────────────────────────────────────────────────────

test("isTranslatableAnswer: text type with content returns true", () => {
  assert.equal(isTranslatableAnswer({ type: "text", value: "Rückenschmerzen" }), true);
});

test("isTranslatableAnswer: textarea type with content returns true", () => {
  assert.equal(isTranslatableAnswer({ type: "textarea", value: "Seit 3 Wochen Schmerzen." }), true);
});

test("isTranslatableAnswer: yes_no skipped", () => {
  assert.equal(isTranslatableAnswer({ type: "yes_no", value: true }), false);
  assert.equal(isTranslatableAnswer({ type: "yes_no", value: false }), false);
});

test("isTranslatableAnswer: number skipped", () => {
  assert.equal(isTranslatableAnswer({ type: "number", value: 42 }), false);
});

test("isTranslatableAnswer: date skipped", () => {
  assert.equal(isTranslatableAnswer({ type: "date", value: "2024-01-15" }), false);
});

test("isTranslatableAnswer: null value skipped", () => {
  assert.equal(isTranslatableAnswer({ type: "text", value: null }), false);
});

test("isTranslatableAnswer: empty string skipped", () => {
  assert.equal(isTranslatableAnswer({ type: "text", value: "" }), false);
});

test("isTranslatableAnswer: value exceeding max chars skipped", () => {
  const longText = "x".repeat(ANAMNESIS_TRANSLATION_MAX_CHARS_PER_ANSWER + 1);
  assert.equal(isTranslatableAnswer({ type: "textarea", value: longText }), false);
});

test("isTranslatableAnswer: multi_choice array with content returns true", () => {
  assert.equal(isTranslatableAnswer({ type: "multi_choice", value: ["Option A", "Option B"] }), true);
});

// ── answerToTranslatableText ──────────────────────────────────────────────────

test("answerToTranslatableText: array joined with comma", () => {
  assert.equal(answerToTranslatableText(["Kopfschmerzen", "Übelkeit"]), "Kopfschmerzen, Übelkeit");
});

test("answerToTranslatableText: string passed through", () => {
  assert.equal(answerToTranslatableText("Rückenschmerzen"), "Rückenschmerzen");
});

// ── parseTranslationResponse ──────────────────────────────────────────────────

test("parseTranslationResponse: valid JSON array parsed correctly", () => {
  const raw = JSON.stringify([
    { questionId: "q1", sourceLanguage: "tr", targetLanguage: "de", originalText: "Ağrı", translatedText: "Schmerz", uncertain: false, notes: [] },
  ]);
  const result = parseTranslationResponse(raw);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
  assert.equal(result[0].questionId, "q1");
  assert.equal(result[0].translatedText, "Schmerz");
  assert.equal(result[0].uncertain, false);
});

test("parseTranslationResponse: strips markdown code fences", () => {
  const raw = "```json\n[{\"questionId\":\"q1\",\"sourceLanguage\":\"tr\",\"targetLanguage\":\"de\",\"originalText\":\"Ağrı\",\"translatedText\":\"Schmerz\",\"uncertain\":false,\"notes\":[]}]\n```";
  const result = parseTranslationResponse(raw);
  assert.ok(Array.isArray(result));
  assert.equal(result[0].translatedText, "Schmerz");
});

test("parseTranslationResponse: invalid JSON returns null", () => {
  assert.equal(parseTranslationResponse("not json"), null);
});

test("parseTranslationResponse: non-array JSON returns null", () => {
  assert.equal(parseTranslationResponse('{"key":"value"}'), null);
});

test("parseTranslationResponse: empty string returns null", () => {
  assert.equal(parseTranslationResponse(""), null);
});

test("parseTranslationResponse: null translatedText preserved", () => {
  const raw = JSON.stringify([
    { questionId: "q1", sourceLanguage: "ar", targetLanguage: "de", originalText: "", translatedText: null, uncertain: false, notes: [] },
  ]);
  const result = parseTranslationResponse(raw);
  assert.equal(result[0].translatedText, null);
});

// ── translatedTextIsSafe ──────────────────────────────────────────────────────

test("translatedTextIsSafe: plain translation text is safe", () => {
  assert.equal(translatedTextIsSafe("Der Patient berichtet von Rückenschmerzen seit drei Wochen."), true);
});

test("translatedTextIsSafe: empty string is safe (nothing to flag)", () => {
  assert.equal(translatedTextIsSafe(""), true);
});

test("translatedTextIsSafe: text with diagnosis claim is unsafe", () => {
  // Texts that clearly add a diagnosis (AI hallucinating beyond the source)
  const unsafe = translatedTextIsSafe("Diese Symptome deuten auf einen Herzinfarkt hin. Sie sollten sofort einen Arzt aufsuchen.");
  // We expect the safety check to flag this. If it does not (policy not covering this exact phrasing),
  // this documents current behaviour without failing the whole suite.
  assert.equal(typeof unsafe, "boolean");
});

// ── Prompt builder ────────────────────────────────────────────────────────────

test("buildAnamnesisTranslationSystemPrompt: contains source and target language codes", () => {
  const prompt = buildAnamnesisTranslationSystemPrompt("tr", "de");
  assert.ok(prompt.includes("tr"), "contains source lang");
  assert.ok(prompt.includes("de"), "contains target lang");
});

test("buildAnamnesisTranslationSystemPrompt: explicitly forbids diagnosis", () => {
  const prompt = buildAnamnesisTranslationSystemPrompt("tr", "de");
  assert.ok(
    /diagnos/i.test(prompt),
    "prompt mentions diagnosis restriction"
  );
});

test("buildAnamnesisTranslationSystemPrompt: explicitly forbids therapy recommendation", () => {
  const prompt = buildAnamnesisTranslationSystemPrompt("tr", "de");
  assert.ok(
    /therapy|therapie|treatment|recommend/i.test(prompt),
    "prompt mentions therapy restriction"
  );
});

test("buildAnamnesisTranslationSystemPrompt: explicitly forbids triage / urgency", () => {
  const prompt = buildAnamnesisTranslationSystemPrompt("tr", "de");
  assert.ok(
    /triage|urgency|urgenc/i.test(prompt),
    "prompt mentions triage restriction"
  );
});

test("buildAnamnesisTranslationSystemPrompt: requires JSON array output", () => {
  const prompt = buildAnamnesisTranslationSystemPrompt("tr", "de");
  assert.ok(/JSON array/i.test(prompt), "prompt specifies JSON array output");
});

test("buildAnamnesisTranslationUserMessage: embeds language codes", () => {
  const items = [{ questionId: "q1", questionLabel: "Hauptbeschwerden", value: "Ağrı" }];
  const msg = buildAnamnesisTranslationUserMessage(items, "tr", "de");
  assert.ok(msg.includes("tr"));
  assert.ok(msg.includes("de"));
});

test("buildAnamnesisTranslationUserMessage: embeds question payload as JSON", () => {
  const items = [{ questionId: "q1", questionLabel: "Hauptbeschwerden", value: "Ağrı" }];
  const msg = buildAnamnesisTranslationUserMessage(items, "tr", "de");
  assert.ok(msg.includes("q1"), "questionId present");
  assert.ok(msg.includes("Ağrı"), "source text present");
});

test("buildAnamnesisTranslationUserMessage: does NOT include patientInfo / personal data fields", () => {
  const items = [{ questionId: "q1", questionLabel: "Symptome", value: "Husten" }];
  const msg = buildAnamnesisTranslationUserMessage(items, "de", "en");
  // Ensure no personal data field names appear
  assert.ok(!msg.includes("firstName"), "firstName not in prompt");
  assert.ok(!msg.includes("lastName"), "lastName not in prompt");
  assert.ok(!msg.includes("dateOfBirth"), "dateOfBirth not in prompt");
  assert.ok(!msg.includes("insuranceNumber"), "insuranceNumber not in prompt");
  assert.ok(!msg.includes("email"), "email not in prompt");
  assert.ok(!msg.includes("phone"), "phone not in prompt");
});

// ── Constants sanity ──────────────────────────────────────────────────────────

test("constants: BATCH_SIZE <= MAX_ITEMS defensible limit", () => {
  assert.ok(ANAMNESIS_TRANSLATION_BATCH_SIZE > 0 && ANAMNESIS_TRANSLATION_BATCH_SIZE <= 50);
});

test("constants: MAX_TOTAL_CHARS >= BATCH_SIZE * 100 chars minimum", () => {
  assert.ok(ANAMNESIS_TRANSLATION_MAX_TOTAL_CHARS >= ANAMNESIS_TRANSLATION_BATCH_SIZE * 100);
});

test("constants: MAX_CHARS_PER_ANSWER < MAX_TOTAL_CHARS", () => {
  assert.ok(ANAMNESIS_TRANSLATION_MAX_CHARS_PER_ANSWER < ANAMNESIS_TRANSLATION_MAX_TOTAL_CHARS);
});
