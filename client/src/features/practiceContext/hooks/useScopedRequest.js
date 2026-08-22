import { useCallback, useEffect, useRef } from "react";

/**
 * Runs a request belonging to ONE practice context and guarantees its result can
 * never be applied in a different one.
 *
 * WHY THIS EXISTS
 * ---------------
 * MedScoutX has no query library: pages fetch with authFetch into local state.
 * There is no cache to key and no built-in cancellation, but the race is real:
 *
 *   1. a slow request starts in the GP context,
 *   2. the patient switches to cardiology,
 *   3. the GP response arrives and calls setState.
 *
 * Two independent barriers stop that:
 *   - the AbortController aborts the in-flight request on switch/unmount,
 *   - the generation check discards any response that still arrives, because
 *     aborting is best-effort and a response may already sit in the microtask
 *     queue.
 *
 * The second barrier is the one that must hold; the first only saves bandwidth.
 *
 * @param {string} linkId the context this hook instance belongs to
 */
export function useScopedRequest(linkId) {
  const generationRef = useRef(0);
  const contextRef = useRef(linkId);
  const controllersRef = useRef(new Set());

  const invalidate = useCallback(() => {
    generationRef.current += 1;
    for (const c of controllersRef.current) {
      try {
        c.abort();
      } catch {
        /* aborting an already-settled request is not an error */
      }
    }
    controllersRef.current.clear();
  }, []);

  useEffect(() => {
    contextRef.current = linkId;
    return invalidate;
  }, [linkId, invalidate]);

  /**
   * @template T
   * @param {(opts: { signal: AbortSignal, linkId: string }) => Promise<T>} work
   * @param {(value: T) => void} apply called ONLY if the context still matches
   */
  const run = useCallback(async (work, apply) => {
    const startedIn = contextRef.current;
    const startedAt = generationRef.current;
    const controller = new AbortController();
    controllersRef.current.add(controller);

    try {
      const value = await work({ signal: controller.signal, linkId: startedIn });

      const stillCurrent =
        generationRef.current === startedAt && contextRef.current === startedIn;
      if (!stillCurrent) return { applied: false, reason: "context_changed" };

      apply(value);
      return { applied: true };
    } catch (err) {
      if (controller.signal.aborted) return { applied: false, reason: "aborted" };
      if (generationRef.current !== startedAt) {
        return { applied: false, reason: "context_changed" };
      }
      throw err;
    } finally {
      controllersRef.current.delete(controller);
    }
  }, []);

  return { run, invalidate };
}
