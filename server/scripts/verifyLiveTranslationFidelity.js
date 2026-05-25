/**
 * Regression check: fidelity prompt must contain required translation examples.
 * Run: node server/scripts/verifyLiveTranslationFidelity.js
 */
import { buildFidelityRulesBlock } from "../services/liveTranslation/liveTranslationFidelity.js";

const REQUIRED_SNIPPETS = [
  "Ich habe Kopfschmerzen.",
  "I have a headache.",
  "Ich habe keine Allergien.",
  "I have no allergies.",
  "Seit gestern.",
  "Since yesterday.",
  "Do you have a fever?",
  "Haben Sie Fieber?",
  "How can I help you?",
  "Wie kann ich Ihnen helfen?",
  "Wie lange haben Sie diese Beschwerden schon?",
];

const deBlock = buildFidelityRulesBlock("de");
const enBlock = buildFidelityRulesBlock("en");
const combined = `${deBlock}\n${enBlock}`;

const missing = REQUIRED_SNIPPETS.filter((snippet) => !combined.includes(snippet));

if (missing.length > 0) {
  console.error("verifyLiveTranslationFidelity: missing examples:");
  for (const m of missing) {
    console.error(`  - ${m}`);
  }
  process.exit(1);
}

console.log("verifyLiveTranslationFidelity: OK — all regression examples present in fidelity block.");
