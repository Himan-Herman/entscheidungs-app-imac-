import {
  isLikelyNonHealthcareContent,
  MEDICAL_SCOPE_MIN_MS,
  MEDICAL_SCOPE_MIN_TURNS,
} from "./medicalScopePolicy.js";

/** Rolling window: last N completed turns. */
export const CONTEXT_WINDOW_TURNS = 8;

/** Minimum completed turns before soft warning. */
export const CONTEXT_MIN_TURNS_FOR_WARNING = 5;

/** Share of non-healthcare turns in window to show soft warning. */
export const SOFT_WARNING_RATIO = 0.4;

/** Share of non-healthcare turns to pause translation (not mic). */
export const PAUSE_TRANSLATION_RATIO = 0.55;

/**
 * @param {Array<{ originalText?: string; status?: string }>} turns
 * @param {number} elapsedMs
 * @param {boolean} [userConfirmedContinue]
 */
export function evaluateConversationContext(turns, elapsedMs, userConfirmedContinue = false) {
  if (userConfirmedContinue) {
    return { softWarning: false, pauseTranslation: false, nonHealthcareRatio: 0 };
  }

  const completed = turns.filter(
    (t) => t.status === "translated" || t.status === "corrected",
  );

  const minTurnsReached =
    completed.length >= CONTEXT_MIN_TURNS_FOR_WARNING ||
    completed.length >= MEDICAL_SCOPE_MIN_TURNS ||
    elapsedMs >= MEDICAL_SCOPE_MIN_MS;

  if (!minTurnsReached) {
    return { softWarning: false, pauseTranslation: false, nonHealthcareRatio: 0 };
  }

  const recent = completed.slice(-CONTEXT_WINDOW_TURNS);
  if (recent.length < 4) {
    return { softWarning: false, pauseTranslation: false, nonHealthcareRatio: 0 };
  }

  const nonHealthcare = recent.filter((t) =>
    isLikelyNonHealthcareContent(t.originalText || ""),
  ).length;
  const ratio = nonHealthcare / recent.length;

  return {
    softWarning: ratio >= SOFT_WARNING_RATIO && ratio < PAUSE_TRANSLATION_RATIO,
    pauseTranslation: ratio >= PAUSE_TRANSLATION_RATIO,
    nonHealthcareRatio: ratio,
  };
}
