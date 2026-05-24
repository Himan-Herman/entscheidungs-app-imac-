import {
  isConsultationOpener,
  isLikelyNonHealthcareContent,
  isModelScopeRefusal,
  shouldEvaluateMedicalScope,
  shouldRetryScopeRefusal,
  shouldShowScopeWarning,
} from "../utils/medicalScopePolicy.js";

const failures = [];

function assert(name, condition) {
  if (!condition) failures.push(name);
}

assert(
  "consultation opener EN",
  isConsultationOpener("How can I help you?"),
);
assert(
  "consultation opener DE",
  isConsultationOpener("Wie kann ich Ihnen helfen?"),
);
assert(
  "symptoms phrase",
  isConsultationOpener("Please describe your symptoms."),
);
assert(
  "early scope not evaluated",
  !shouldEvaluateMedicalScope(2, 30_000),
);
assert(
  "scope after turns",
  shouldEvaluateMedicalScope(6, 30_000),
);
assert(
  "scope after 2 min",
  shouldEvaluateMedicalScope(2, 2 * 60 * 1000),
);
assert(
  "refusal detected",
  isModelScopeRefusal(
    "This feature is intended only for healthcare conversations.",
  ),
);
assert(
  "retry early refusal",
  shouldRetryScopeRefusal(
    1,
    10_000,
    false,
    "How can I help you?",
    "This feature is intended only for healthcare conversations.",
  ),
);
assert(
  "no warning early unrelated",
  !shouldShowScopeWarning(
    [{ originalText: "I want to buy shoes", status: "translated" }],
    30_000,
  ),
);
assert(
  "non-healthcare detected",
  isLikelyNonHealthcareContent("Let's go shopping at the mall tomorrow"),
);
assert(
  "healthcare not flagged",
  !isLikelyNonHealthcareContent("I have pain in my chest since yesterday"),
);

assert(
  "warning after threshold unrelated",
  shouldShowScopeWarning(
    [
      { originalText: "Let's go shopping at the mall", status: "translated" },
      { originalText: "I need a restaurant reservation", status: "translated" },
      { originalText: "What hotel should we book", status: "translated" },
      { originalText: "The flight leaves tomorrow", status: "translated" },
      { originalText: "Buy shoes on sale", status: "translated" },
      { originalText: "Tourism package deal", status: "translated" },
    ],
    3 * 60 * 1000,
  ),
);

if (failures.length) {
  console.error("verifyMedicalScopePolicy FAILED:", failures);
  process.exit(1);
}

console.log("verifyMedicalScopePolicy OK");
