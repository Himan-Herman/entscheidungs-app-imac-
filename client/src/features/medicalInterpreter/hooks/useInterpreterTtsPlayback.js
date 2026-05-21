import { useCallback, useEffect, useRef, useState } from "react";
import { speakText } from "../api/interpreterApi.js";
import { speakStreamText } from "../api/interpreterStreamSpeakApi.js";
import {
  STREAMING_TTS_CACHE_MAX_ENTRIES,
  STREAMING_TTS_MIN_REPEAT_MS,
} from "../config/isStreamingTtsEnabled.js";

/** @typedef {'translation' | 'simplified' | 'preview'} SpeakTarget */

/**
 * @param {string} language
 * @param {string} text
 */
function cacheKey(language, text) {
  return `${language}::${text}`;
}

/**
 * In-memory TTS playback — no persistence. Revokes object URLs on stop/unmount.
 * Optional stream endpoint + LRU blob cache for cost control (Phase 5.5).
 *
 * @param {{ streamSpeakEnabled?: boolean }} [opts]
 */
export function useInterpreterTtsPlayback(opts = {}) {
  const streamSpeakEnabled = opts.streamSpeakEnabled === true;

  /** @type {'idle' | 'loading' | 'playing'} */
  const [phase, setPhase] = useState("idle");
  /** @type {SpeakTarget | null} */
  const [activeTarget, setActiveTarget] = useState(null);
  const [lastErrorCode, setLastErrorCode] = useState(
    /** @type {string | null} */ (null),
  );

  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const abortRef = useRef(null);
  const playInFlightRef = useRef(false);
  /** @type {Map<string, Blob>} */
  const blobCacheRef = useRef(new Map());
  const lastFetchRef = useRef({ key: "", at: 0 });
  /** @type {import('react').MutableRefObject<{ text: string, language: string, target: SpeakTarget, useStream: boolean } | null>} */
  const lastPlayParamsRef = useRef(null);

  const evictCacheIfNeeded = useCallback(() => {
    const cache = blobCacheRef.current;
    while (cache.size > STREAMING_TTS_CACHE_MAX_ENTRIES) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    playInFlightRef.current = false;

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPhase("idle");
    setActiveTarget(null);
  }, []);

  const stopAllPlayback = stopPlayback;

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") stopPlayback();
    };
    const onPageHide = () => stopPlayback();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [stopPlayback]);

  useEffect(() => {
    const cache = blobCacheRef.current;
    return () => {
      cache.clear();
    };
  }, []);

  const playBlob = useCallback(
    async (blob, target, signal) => {
      if (typeof Audio === "undefined") {
        return { ok: false, code: "speak_unsupported" };
      }

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const el = new Audio(url);
      audioRef.current = el;

      const onEnded = () => stopPlayback();
      el.addEventListener("ended", onEnded, { once: true });
      el.addEventListener("error", onEnded, { once: true });

      await el.play();
      if (signal.aborted) {
        stopPlayback();
        return { ok: false };
      }

      setPhase("playing");
      setActiveTarget(target);
      return { ok: true };
    },
    [stopPlayback],
  );

  const fetchSpeechBlob = useCallback(
    async (text, language, useStream, signal) => {
      const key = cacheKey(language, text);
      const cached = blobCacheRef.current.get(key);
      if (cached) {
        return { ok: true, blob: cached, fromCache: true };
      }

      const now = Date.now();
      if (
        lastFetchRef.current.key === key &&
        now - lastFetchRef.current.at < STREAMING_TTS_MIN_REPEAT_MS
      ) {
        return { ok: false, code: "rate_limited" };
      }

      const fetcher =
        useStream && streamSpeakEnabled ? speakStreamText : speakText;

      const result = await fetcher(
        { text, language, voicePreference: "neutral" },
        { signal },
      );

      if (!result.ok || !result.blob) {
        return result;
      }

      lastFetchRef.current = { key, at: now };
      blobCacheRef.current.set(key, result.blob);
      evictCacheIfNeeded();
      return { ok: true, blob: result.blob, fromCache: false };
    },
    [streamSpeakEnabled, evictCacheIfNeeded],
  );

  /**
   * @param {{
   *   text: string;
   *   language: string;
   *   target: SpeakTarget;
   *   useStreamEndpoint?: boolean;
   * }} params
   */
  const playText = useCallback(
    async ({ text, language, target, useStreamEndpoint = false }) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) return { ok: false };

      if (typeof Audio === "undefined") {
        return { ok: false, code: "speak_unsupported" };
      }

      if (phase === "playing" && activeTarget === target) {
        stopPlayback();
        return { ok: true };
      }

      if (playInFlightRef.current) {
        return { ok: false, code: "busy" };
      }

      const useStream = useStreamEndpoint && streamSpeakEnabled && target === "preview";

      stopPlayback();
      playInFlightRef.current = true;
      setPhase("loading");
      setActiveTarget(target);
      setLastErrorCode(null);

      lastPlayParamsRef.current = {
        text: trimmed,
        language,
        target,
        useStream,
      };

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const speech = await fetchSpeechBlob(
          trimmed,
          language,
          useStream,
          ac.signal,
        );

        if (ac.signal.aborted) {
          return { ok: false };
        }

        if (!speech.ok || !speech.blob) {
          stopPlayback();
          const code = speech.code || "speak_failed";
          setLastErrorCode(code);
          return { ok: false, code, message: speech.message };
        }

        const played = await playBlob(speech.blob, target, ac.signal);
        if (!played.ok) {
          setLastErrorCode(played.code || "speak_failed");
          return played;
        }

        return { ok: true };
      } catch {
        stopPlayback();
        setLastErrorCode("speak_failed");
        return { ok: false, code: "speak_failed" };
      } finally {
        playInFlightRef.current = false;
      }
    },
    [
      phase,
      activeTarget,
      stopPlayback,
      streamSpeakEnabled,
      fetchSpeechBlob,
      playBlob,
    ],
  );

  const retryPlayback = useCallback(async () => {
    const last = lastPlayParamsRef.current;
    if (!last) return { ok: false };
    return playText(last);
  }, [playText]);

  return {
    phase,
    activeTarget,
    playText,
    stopPlayback,
    stopAllPlayback,
    retryPlayback,
    lastErrorCode,
    isLoading: phase === "loading",
    isPlaying: phase === "playing",
  };
}
