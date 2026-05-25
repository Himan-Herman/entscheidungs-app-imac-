/**
 * Rolling context monitor checks.
 * node client/src/features/liveMedicalTranslation/scripts/verifyConversationContextMonitor.js
 */
import { evaluateConversationContext } from "../utils/conversationContextMonitor.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const medicalTurns = Array.from({ length: 6 }, (_, i) => ({
  status: "translated",
  originalText: `I have pain in my chest since day ${i + 1}`,
}));

const shoppingTurns = [
  ...medicalTurns.slice(0, 2),
  { status: "translated", originalText: "Let's go shopping at the mall tomorrow" },
  { status: "translated", originalText: "I need a restaurant reservation tonight" },
  { status: "translated", originalText: "What hotel should we book for vacation" },
  { status: "translated", originalText: "Buy shoes on sale at the store" },
];

const early = evaluateConversationContext(medicalTurns.slice(0, 2), 30_000);
assert(!early.softWarning && !early.pauseTranslation, "no warning with few turns");

const soft = evaluateConversationContext(shoppingTurns, 3 * 60 * 1000);
assert(soft.softWarning || soft.pauseTranslation, "mostly non-medical triggers warning");

const paused = evaluateConversationContext(shoppingTurns, 3 * 60 * 1000, false);
assert(paused.pauseTranslation, "sustained non-medical pauses translation");

const continued = evaluateConversationContext(shoppingTurns, 3 * 60 * 1000, true);
assert(!continued.pauseTranslation, "user continue clears pause");

console.log("verifyConversationContextMonitor: OK");
