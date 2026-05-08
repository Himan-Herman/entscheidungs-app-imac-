import {
  OUTPUT_VIOLATION_PATTERNS,
  fallbackQuestionForLanguage,
} from "./adaptivePromptRules.js";

function countViolations(text) {
  if (!text) return 0;
  const s = String(text);
  let n = 0;
  for (const re of OUTPUT_VIOLATION_PATTERNS) {
    if (re.test(s)) n += 1;
  }
  return n;
}

function stripRiskySentences(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const parts = raw.split(/(?<=[.!?])\s+/);
  const kept = [];
  for (const p of parts) {
    let bad = false;
    for (const re of OUTPUT_VIOLATION_PATTERNS) {
      if (re.test(p)) {
        bad = true;
        break;
      }
    }
    if (!bad) kept.push(p);
  }
  return kept.join(" ").trim();
}

/**
 * Sanitize model output; may use deterministic fallback strings (no PHI in params).
 */
export function sanitizeAdaptiveModelOutput({
  patientLanguage,
  isComplete,
  nextQuestion,
  compiledAnswer,
  existingCategoryAnswer,
  currentPatientReply,
}) {
  const violations =
    countViolations(nextQuestion) + countViolations(compiledAnswer);
  let nq = String(nextQuestion || "").trim();
  let ca = String(compiledAnswer || "").trim();
  let usedFallbackQuestion = false;
  let strippedCompiled = false;

  if (!isComplete && nq) {
    const vq = countViolations(nq);
    if (vq > 0) {
      nq = fallbackQuestionForLanguage(patientLanguage);
      usedFallbackQuestion = true;
    }
  }

  if (ca) {
    const vc = countViolations(ca);
    if (vc > 0) {
      const stripped = stripRiskySentences(ca);
      if (stripped.length >= 12) {
        ca = stripped;
        strippedCompiled = true;
      } else {
        ca = trimmer(
          [existingCategoryAnswer, currentPatientReply].filter(Boolean).join(" \n"),
          4000,
        );
        strippedCompiled = true;
      }
    }
  }

  return {
    nextQuestion: nq,
    compiledAnswer: ca,
    meta: {
      violationHints: violations,
      usedFallbackQuestion,
      strippedCompiled,
    },
  };
}

function trimmer(s, max) {
  const t = String(s || "").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
