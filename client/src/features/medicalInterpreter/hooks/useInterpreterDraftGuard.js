import { useCallback, useEffect } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Blocks in-app navigation while a draft transcript is pending; optional tab-close warning.
 *
 * @param {boolean} enabled
 * @param {() => void} [onDiscardDraft] — remove draft turn before navigation proceeds
 * @param {() => void} [onNavigationBlocked] — flush draft to storage when leave is blocked
 */
export function useInterpreterDraftGuard(enabled, onDiscardDraft, onNavigationBlocked) {
  const blocker = useBlocker(enabled);

  useEffect(() => {
    if (blocker.state === "blocked") {
      onNavigationBlocked?.();
    }
  }, [blocker.state, onNavigationBlocked]);

  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);

  const cancelLeave = useCallback(() => {
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }, [blocker]);

  const confirmLeave = useCallback(() => {
    onDiscardDraft?.();
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  }, [blocker, onDiscardDraft]);

  return {
    leaveDialogOpen: blocker.state === "blocked",
    cancelLeave,
    confirmLeave,
  };
}
