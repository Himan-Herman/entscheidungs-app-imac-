/**
 * Unit checks for strict two-language containment (run with node).
 * node client/src/features/liveMedicalTranslation/scripts/verifyLanguageContainment.js
 */
import {
  isLanguageInSelectedPair,
  isLikelyWrongLanguageOutput,
  sanitizeWrongLanguageTurn,
} from "../utils/languageContainment.js";
import { getWrongLanguagePhrase } from "../utils/wrongLanguagePhrase.js";
import {
  resolveSpeakerFromDetectedLanguage,
} from "../utils/languageBasedRouting.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(isLanguageInSelectedPair("fa", "fa", "de"), "fa in fa/de pair");
assert(isLanguageInSelectedPair("de", "fa", "de"), "de in fa/de pair");
assert(!isLanguageInSelectedPair("en", "fa", "de"), "en outside fa/de pair");
assert(!isLanguageInSelectedPair("fr", "fa", "de"), "fr outside fa/de pair");

const outsidePair = resolveSpeakerFromDetectedLanguage("en", "fa", "de", "patient");
assert(outsidePair.reason === "outside_pair" && outsidePair.uncertain, "en -> outside_pair");

const faPatient = resolveSpeakerFromDetectedLanguage("fa", "fa", "de", "doctor");
assert(faPatient.speaker === "patient" && !faPatient.uncertain, "fa -> patient for fa/de");

const deDoctor = resolveSpeakerFromDetectedLanguage("de", "fa", "de", "patient");
assert(deDoctor.speaker === "doctor" && !deDoctor.uncertain, "de -> doctor for fa/de");

assert(
  !isLikelyWrongLanguageOutput("من درد دارم", "fa", "de"),
  "Farsi output not flagged as English",
);
assert(
  isLikelyWrongLanguageOutput("I have a headache since yesterday", "fa", "de"),
  "English hallucination flagged for fa/de",
);

const dePhrase = getWrongLanguagePhrase("de");
const faPhrase = getWrongLanguagePhrase("fa");
assert(dePhrase.includes("ausgewählten Gesprächssprachen"), "German wrong-language phrase");
assert(faPhrase.length > 10, "Farsi wrong-language phrase present");

const sanitized = sanitizeWrongLanguageTurn({
  originalText: "Hello how are you",
  translatedText: "I have a headache",
  patientLanguage: "fa",
  doctorLanguage: "de",
  targetLanguage: "fa",
  detectedLanguage: "en",
  repeatPhrase: faPhrase,
});
assert(sanitized.isWrongLanguage && sanitized.status === "wrongLanguage", "English input sanitized");
assert(sanitized.translatedText === faPhrase, "wrong-language uses target phrase");

const okTurn = sanitizeWrongLanguageTurn({
  originalText: "Ich habe Kopfschmerzen",
  translatedText: "من درد سر دارم",
  patientLanguage: "fa",
  doctorLanguage: "de",
  targetLanguage: "fa",
  detectedLanguage: "de",
  repeatPhrase: faPhrase,
});
assert(!okTurn.isWrongLanguage, "German->Farsi not blocked");

console.log("verifyLanguageContainment: OK");
