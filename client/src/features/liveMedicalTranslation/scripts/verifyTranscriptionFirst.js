/**
 * Transcription-first and language-lock regression checks.
 * node client/src/features/liveMedicalTranslation/scripts/verifyTranscriptionFirst.js
 */
import { canProceedToTranslation, isStableTranscriptReady } from "../utils/transcriptionFirst.js";
import { isTargetLanguageInPair } from "../utils/languageContainment.js";
import { getMedaUnclearRepeatPhrase } from "../utils/repeatPhrase.js";
import { getWrongLanguagePhrase } from "../utils/wrongLanguagePhrase.js";
import { isSemanticTranslationDrift } from "../utils/translationSemanticCheck.js";
import { resolveTurnStatus } from "../utils/asrQuality.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(
  !canProceedToTranslation({ transcript: "", inputState: "pending" }),
  "no translation without transcript",
);
assert(
  !canProceedToTranslation({ transcript: "hello", inputState: "pending" }),
  "no translation before ASR completed",
);
assert(
  canProceedToTranslation({ transcript: "Ich habe Kopfschmerzen.", inputState: "ready" }),
  "translation allowed with stable transcript",
);
assert(
  !canProceedToTranslation({ transcript: "hm", inputState: "ready" }),
  "noise transcript blocked",
);
assert(
  isStableTranscriptReady("Seit gestern.", "ready"),
  "short valid transcript allowed",
);

assert(
  isTargetLanguageInPair("de", "fa", "de"),
  "DE target allowed in fa-de pair",
);
assert(
  !isTargetLanguageInPair("en", "fa", "de"),
  "EN target blocked in fa-de pair",
);

assert(
  getMedaUnclearRepeatPhrase("de").includes("akustisch"),
  "DE unclear phrase mentions acoustic uncertainty",
);
assert(
  getWrongLanguagePhrase("de").includes("ausgewählten Gesprächssprachen"),
  "DE wrong-language phrase uses pair-only message",
);

assert(
  isSemanticTranslationDrift("Ich habe keine Allergien.", "I have allergies."),
  "negation must not become positive allergy",
);
assert(
  !isSemanticTranslationDrift("Ich habe keine Allergien.", "I have no allergies."),
  "faithful negation preserved",
);
assert(
  isSemanticTranslationDrift("I think maybe I have pain.", "I definitely have pain."),
  "uncertainty must not inflate to certainty",
);

assert(
  resolveTurnStatus({
    originalText: "",
    translatedText: "I have cough since yesterday.",
    targetLanguage: "en",
  }) === "unclear",
  "no invented sentence without original",
);

console.log("verifyTranscriptionFirst: OK");
