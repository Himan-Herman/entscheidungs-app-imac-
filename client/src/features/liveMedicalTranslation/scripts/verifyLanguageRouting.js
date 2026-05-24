/**
 * Unit checks for language-based routing (run with node).
 * node client/src/features/liveMedicalTranslation/scripts/verifyLanguageRouting.js
 */
import {
  buildDirectionLabel,
  detectedLanguageMatches,
  isLanguageRoutingEnabled,
  resolveSpeakerFromDetectedLanguage,
} from "../utils/languageBasedRouting.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(isLanguageRoutingEnabled("fa", "de"), "fa/de routing enabled");
assert(!isLanguageRoutingEnabled("de", "de"), "same language routing disabled");
assert(detectedLanguageMatches("fa", "fa"), "fa exact match");
assert(detectedLanguageMatches("fa-IR", "fa"), "fa region match");
assert(detectedLanguageMatches("de", "de"), "de exact match");
assert(detectedLanguageMatches("de-DE", "de"), "de region match");
assert(!detectedLanguageMatches("de", "fa"), "de does not match fa");

const faPatient = resolveSpeakerFromDetectedLanguage("fa", "fa", "de", "doctor");
assert(faPatient.speaker === "patient" && !faPatient.uncertain, "fa -> patient");

const deDoctor = resolveSpeakerFromDetectedLanguage("de", "fa", "de", "patient");
assert(deDoctor.speaker === "doctor" && !deDoctor.uncertain, "de -> doctor");

const uncertain = resolveSpeakerFromDetectedLanguage(null, "fa", "de", "patient");
assert(uncertain.uncertain && uncertain.speaker === "patient", "missing language keeps current side");

const outsidePair = resolveSpeakerFromDetectedLanguage("en", "fa", "de", "patient");
assert(outsidePair.reason === "outside_pair" && outsidePair.uncertain, "en outside fa/de pair");

const sameLang = resolveSpeakerFromDetectedLanguage("de", "de", "de", "patient");
assert(!sameLang.routingEnabled && !sameLang.uncertain, "same language does not warn");

assert(
  buildDirectionLabel({
    activeSpeaker: "patient",
    patientLanguageLabel: "Farsi",
    doctorLanguageLabel: "Deutsch",
    patientRoleLabel: "Patient",
    doctorRoleLabel: "Arzt/Praxis",
  }) === "Patient/Farsi → Arzt/Praxis/Deutsch",
  "patient direction label",
);

console.log("verifyLanguageRouting: OK");
