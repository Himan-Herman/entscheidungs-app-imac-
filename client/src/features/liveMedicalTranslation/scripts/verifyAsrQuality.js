/**
 * Unit checks for ASR quality helpers (run with node).
 * node client/src/features/liveMedicalTranslation/scripts/verifyAsrQuality.js
 */
import {
  isLikelyEmptyOrNoiseTranscript,
  isLikelyHallucinatedTranslation,
  resolveTurnStatus,
  sanitizeUnclearTurn,
} from "../utils/asrQuality.js";
import { getMedaUnclearRepeatPhrase } from "../utils/repeatPhrase.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(isLikelyEmptyOrNoiseTranscript(""), "empty transcript");
assert(isLikelyEmptyOrNoiseTranscript("..."), "punctuation-only transcript");
assert(isLikelyEmptyOrNoiseTranscript("hm"), "filler transcript");

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
    translatedText: getMedaUnclearRepeatPhrase("en"),
    targetLanguage: "en",
  }) === "unclear",
  "meda unclear phrase marks unclear",
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

assert(
  isLikelyHallucinatedTranslation("", "I have cough and phlegm."),
  "empty original with invented symptoms is hallucination",
);

assert(
  isLikelyHallucinatedTranslation("...", "Since yesterday."),
  "noise original with invented duration is hallucination",
);

assert(
  !isLikelyHallucinatedTranslation("Seit gestern.", "Since yesterday."),
  "faithful short translation is not hallucination",
);

assert(
  !isLikelyHallucinatedTranslation("Ich habe Kopfschmerzen.", "I have a headache."),
  "DE medical phrase to EN is not hallucination",
);

assert(
  !isLikelyHallucinatedTranslation("How can I help you?", "Wie kann ich Ihnen helfen?"),
  "EN doctor phrase to DE is not hallucination",
);

const sanitized = sanitizeUnclearTurn({
  originalText: "",
  translatedText: "I have cough and phlegm.",
  targetLanguage: "en",
  repeatPhrase: getMedaUnclearRepeatPhrase("en"),
});

assert(sanitized.status === "unclear", "sanitize marks unclear");
assert(sanitized.originalText === "", "sanitize hides unreliable original");
assert(
  sanitized.translatedText === getMedaUnclearRepeatPhrase("en"),
  "sanitize replaces invented translation with repeat phrase",
);
assert(sanitized.needsRepeatSpeech, "sanitize requests corrective speech");

console.log("verifyAsrQuality: OK");
