import { useCallback, useRef, useState } from "react";
import { authFetch } from "../../api/authFetch";

/**
 * Sends a single transcribed line to the backend for translation.
 * Maintains an in-flight lock so the same text is never sent twice concurrently.
 *
 * Phase 6.1: Results are delivered via onResult callback instead of shared state,
 * so the caller can correlate each result back to a specific conversation entry.
 *
 * @typedef {{ translation: string, needsClarification: boolean, reason: string|null, error: string|null }} TranslationResult
 */
export function useTextTranslation() {
  const [loadingCount, setLoadingCount] = useState(0);
  const inFlightRef = useRef(/** @type {Set<string>} */ (new Set()));

  /**
   * @param {string} text
   * @param {string} sourceLanguage
   * @param {string} targetLanguage
   * @param {(result: TranslationResult) => void} [onResult]
   */
  const translate = useCallback(async (text, sourceLanguage, targetLanguage, onResult) => {
    const key = `${sourceLanguage}:${targetLanguage}:${text}`;
    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);
    setLoadingCount((n) => n + 1);

    try {
      const res = await authFetch("/api/meda-live-translation/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sourceLanguage, targetLanguage }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const body = await res.json();
      onResult?.({
        translation: body.translation ?? "",
        needsClarification: body.needsClarification === true,
        reason: body.reason ?? null,
        error: null,
      });
    } catch (err) {
      if (err.message !== "SESSION_EXPIRED") {
        onResult?.({
          translation: "",
          needsClarification: false,
          reason: null,
          error: err.message,
        });
      }
    } finally {
      inFlightRef.current.delete(key);
      setLoadingCount((n) => n - 1);
    }
  }, []);

  const isLoading = loadingCount > 0;

  return { isLoading, translate };
}
