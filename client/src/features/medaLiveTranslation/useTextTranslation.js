import { useCallback, useRef, useState } from "react";
import { authFetch } from "../../api/authFetch";

/**
 * Sends a single transcribed line to the backend for translation.
 * Maintains an in-flight lock so the same text is never sent twice concurrently.
 * Handles the Phase 5.1 extended response: { translation, needsClarification, reason }.
 */
export function useTextTranslation() {
  const [translations, setTranslations] = useState(/** @type {string[]} */ ([]));
  const [loadingCount, setLoadingCount] = useState(0);
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [needsClarification, setNeedsClarification] = useState(false);

  const inFlightRef = useRef(/** @type {Set<string>} */ (new Set()));

  const translate = useCallback(async (text, sourceLanguage, targetLanguage) => {
    const key = `${sourceLanguage}:${targetLanguage}:${text}`;
    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);
    setLoadingCount((n) => n + 1);
    setError(null);

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
      const { translation, needsClarification: nc } = body;

      if (nc === true) {
        setNeedsClarification(true);
      } else {
        setNeedsClarification(false);
        if (translation) {
          setTranslations((prev) => [...prev, translation]);
        }
      }
    } catch (err) {
      if (err.message !== "SESSION_EXPIRED") {
        setError(err.message);
      }
    } finally {
      inFlightRef.current.delete(key);
      setLoadingCount((n) => n - 1);
    }
  }, []);

  const clear = useCallback(() => {
    setTranslations([]);
    setError(null);
    setNeedsClarification(false);
  }, []);

  const isLoading = loadingCount > 0;

  return { translations, isLoading, error, needsClarification, translate, clear };
}
