import { useCallback, useEffect, useRef, useState } from "react";
import { translateNearRealtimePreview } from "../api/interpreterNearRealtimeApi.js";
import {
  NEAR_REALTIME_PREVIEW_DEBOUNCE_MS,
  NEAR_REALTIME_PREVIEW_MAX_CHARS,
  NEAR_REALTIME_PREVIEW_MIN_CHARS,
} from "../config/isNearRealtimeTranslationEnabled.js";

/**
 * Debounced preview translation for stable streaming transcript chunks (Phase 5.4).
 * Does not persist turns or send conversation history.
 *
 * @param {{
 *   enabled: boolean;
 *   sourceText: string;
 *   sourceLanguage?: string;
 *   targetLanguage?: string;
 *   speaker: 'patient'|'doctor';
 *   isSourceStable?: boolean;
 *   onStatusMessage?: (msg: string) => void;
 *   onError?: (code: string) => void;
 * }} opts
 */
export function useInterpreterNearRealtimePreview(opts) {
  const {
    enabled,
    sourceText,
    sourceLanguage,
    targetLanguage,
    speaker,
    isSourceStable = true,
    onStatusMessage,
    onError,
  } = opts;

  const [previewText, setPreviewText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [terminologyWarning, setTerminologyWarning] = useState(false);
  const [unclearSource, setUnclearSource] = useState(false);
  const [sourceFingerprint, setSourceFingerprint] = useState("");

  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const lastRequestedRef = useRef("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const discardPreview = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    lastRequestedRef.current = "";
    if (mountedRef.current) {
      setPreviewText("");
      setIsLoading(false);
      setUncertain(false);
      setTerminologyWarning(false);
      setUnclearSource(false);
      setSourceFingerprint("");
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      discardPreview();
      return undefined;
    }

    const trimmed = sourceText.trim();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!trimmed || trimmed.length < NEAR_REALTIME_PREVIEW_MIN_CHARS) {
      discardPreview();
      return undefined;
    }

    if (!isSourceStable) {
      return undefined;
    }

    if (!sourceLanguage || !targetLanguage || sourceLanguage === targetLanguage) {
      return undefined;
    }

    const chunk =
      trimmed.length > NEAR_REALTIME_PREVIEW_MAX_CHARS
        ? trimmed.slice(0, NEAR_REALTIME_PREVIEW_MAX_CHARS)
        : trimmed;

    if (chunk === lastRequestedRef.current) {
      return undefined;
    }

    debounceRef.current = setTimeout(() => {
      if (chunk === lastRequestedRef.current) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      if (mountedRef.current) {
        setIsLoading(true);
        onStatusMessage?.("translating");
      }

      void translateNearRealtimePreview(
        {
          text: chunk,
          sourceLanguage,
          targetLanguage,
          speaker,
        },
        { signal },
      ).then((result) => {
        if (!mountedRef.current || signal.aborted) return;

        setIsLoading(false);

        if (!result.ok) {
          if (result.error === "cancelled") return;
          onError?.(result.error || "translation_failed");
          return;
        }

        lastRequestedRef.current = chunk;
        setPreviewText(result.translatedText);
        setSourceFingerprint(chunk);
        setUncertain(result.uncertain === true);
        setTerminologyWarning(result.terminologyWarning === true);
        setUnclearSource(result.unclearSource === true);
        onStatusMessage?.("ready");
      });
    }, NEAR_REALTIME_PREVIEW_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [
    enabled,
    sourceText,
    sourceLanguage,
    targetLanguage,
    speaker,
    isSourceStable,
    discardPreview,
    onStatusMessage,
    onError,
  ]);

  const isStale =
    Boolean(previewText) &&
    Boolean(sourceFingerprint) &&
    sourceText.trim().slice(0, NEAR_REALTIME_PREVIEW_MAX_CHARS) !== sourceFingerprint;

  return {
    previewTranslation: previewText,
    isLoading,
    uncertain,
    terminologyWarning,
    unclearSource,
    isStale,
    discardPreview,
  };
}
