/**
 * Unit checks for ASR quality helpers (run with node).
 * node client/src/features/liveMedicalTranslation/scripts/verifyAsrQuality.js
 */
import {
  isLikelyEmptyOrNoiseTranscript,
  resolveTurnStatus,
} from "../utils/asrQuality.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(isLikelyEmptyOrNoiseTranscript(""), "empty transcript");
assert(isLikelyEmptyOrNoiseTranscript("..."), "punctuation-only transcript");

assert(
  resolveTurnStatus({
    originalText: "Ich habe Kopfschmerzen.",
    translatedText: "I have a headache.",
    targetLanguage: "en",
  }) === "translated",
  "clear translation stays translated",
);

assert(
  resolveTurnStatus({
    originalText: "",
    translatedText: "I have a headache.",
    targetLanguage: "en",
  }) === "unclear",
  "missing original marks unclear",
);

assert(
  resolveTurnStatus({
    originalText: "Hello",
    translatedText: "The previous statement was unclear. Please repeat.",
    targetLanguage: "en",
  }) === "unclear",
  "unclear phrase marks unclear",
);

assert(
  resolveTurnStatus({
    originalText: "Hello",
    translatedText: "Hi",
    targetLanguage: "en",
    overlapDetected: true,
  }) === "unclear",
  "overlap marks unclear",
);

console.log("verifyAsrQuality: OK");
