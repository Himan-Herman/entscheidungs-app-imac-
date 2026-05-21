/**
 * Combine abort signals for fetch (user cancel + timeout).
 * @param {AbortSignal|undefined|null} userSignal
 * @param {number} timeoutMs
 * @returns {{ signal: AbortSignal, cleanup: () => void }}
 */
export function createRequestAbortSignal(userSignal, timeoutMs) {
  const controller = new AbortController();

  const onUserAbort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort();
    } else {
      userSignal.addEventListener("abort", onUserAbort, { once: true });
    }
  }

  let timeoutId = null;
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  const cleanup = () => {
    if (timeoutId != null) clearTimeout(timeoutId);
    if (userSignal) {
      userSignal.removeEventListener("abort", onUserAbort);
    }
  };

  return { signal: controller.signal, cleanup };
}

/** @deprecated Use createRequestAbortSignal */
export const createTranscribeAbortSignal = createRequestAbortSignal;
