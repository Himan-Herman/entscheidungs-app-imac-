import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Blocks tab close while a draft transcript is pending; optional in-app leave prompt.
 * Does not use useBlocker — that hook requires createBrowserRouter / RouterProvider.
 *
 * @param {boolean} enabled
 * @param {() => void} [onDiscardDraft] — remove draft turn before navigation proceeds
 * @param {() => void} [onNavigationBlocked] — flush draft to storage when leave is blocked
 */
export function useInterpreterDraftGuard(enabled, onDiscardDraft, onNavigationBlocked) {
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const pendingActionRef = useRef(null);

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
    setLeaveDialogOpen(false);
    pendingActionRef.current = null;
  }, []);

  const confirmLeave = useCallback(() => {
    onDiscardDraft?.();
    setLeaveDialogOpen(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, [onDiscardDraft]);

  /** Show leave dialog before in-app navigation (e.g. back link). */
  const requestLeave = useCallback(
    (proceed) => {
      if (!enabled) {
        proceed?.();
        return;
      }
      onNavigationBlocked?.();
      pendingActionRef.current = proceed ?? null;
      setLeaveDialogOpen(true);
    },
    [enabled, onNavigationBlocked],
  );

  return {
    leaveDialogOpen,
    cancelLeave,
    confirmLeave,
    requestLeave,
  };
}
