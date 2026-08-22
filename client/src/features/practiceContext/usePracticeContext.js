import { useContext } from "react";
import { PracticeContextValue } from "./practiceContextValue.js";

/**
 * Practice context for a scoped page.
 *
 * Throws outside a provider on purpose: a practice-scoped page without an
 * explicit context must fail loudly rather than quietly issue requests from
 * whatever state happens to be around.
 */
export function usePracticeContext() {
  const ctx = useContext(PracticeContextValue);
  if (!ctx) {
    throw new Error(
      "usePracticeContext must be used inside PracticeContextProvider — a practice-scoped page needs an explicit, URL-bound context.",
    );
  }
  return ctx;
}
