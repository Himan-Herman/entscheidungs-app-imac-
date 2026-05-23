import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelStreamTranscribeSession,
  finishStreamTranscribeSession,
  fetchStreamTranscribeStatus,
  startStreamTranscribeSession,
  uploadStreamTranscribeChunk,
} from "../api/interpreterStreamApi.js";
import { isStreamingSttBrowserSupported } from "../config/isStreamingSttEnabled.js";
import { INTERPRETER_STREAM_MAX_DURATION_MS } from "../constants/streaming.js";
import { INTERPRETER_SILENCE_AUTO_STOP_MS } from "../utils/interpreterAudioConstants.js";
import { startInterpreterSilenceMonitor } from "../utils/interpreterSilenceMonitor.js";

const CHUNK_TIMESLICE_MS = 1000;
const POLL_INTERVAL_MS = 900;
/** Drop stream if upload queue backs up (memory guard). */
const MAX_PENDING_CHUNKS = 12;

/**
 * Chunked streaming STT capture (Phase 5.3) — optional; does not replace PTT.
 *
 * @param {{
 *   languageHint?: string;
 *   onStatusMessage?: (msg: string) => void;
 *   onError?: (message: string) => void;
 *   onDraftPreview?: (payload: { text: string; confidence?: string; provisional: boolean }) => void;
 *   onRecordingStart?: () => void;
 *   onSilencePhaseChange?: (phase: 'listening' | 'silence_waiting') => void;
 *   onFinalized?: (payload: { transcript: string; confidence?: string; language?: string }) => void | Promise<void>;
 *   silenceAutoStopMs?: number;
 * }} opts
 */
export function useInterpreterStreamCapture(opts = {}) {
  const [phase, setPhase] = useState(
    /** @type {'idle'|'connecting'|'streaming'|'finalizing'|'error'} */ ("idle"),
  );
  const [connectionLabel, setConnectionLabel] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewConfidence, setPreviewConfidence] = useState(
    /** @type {string|undefined} */ (undefined),
  );
  const [stagedMessage, setStagedMessage] = useState("");

  const streamIdRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const uploadInFlightRef = useRef(false);
  const pendingChunksRef = useRef(/** @type {Blob[]} */ ([]));
  const pollTimerRef = useRef(null);
  const maxDurationTimerRef = useRef(null);
  const mimeRef = useRef("audio/webm");
  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const optsRef = useRef(opts);
  const stopSilenceMonitorRef = useRef(null);
  /** @type {import('react').MutableRefObject<(() => Promise<{ ok: boolean; transcript?: string }>) | null>} */
  const stopStreamingRef = useRef(null);

  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cleanupMedia = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    pendingChunksRef.current = [];
    stopSilenceMonitorRef.current?.();
    stopSilenceMonitorRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      streamRef.current = null;
    }
  }, []);

  const resetUiIdle = useCallback(() => {
    if (!mountedRef.current) return;
    setPhase("idle");
    setConnectionLabel("");
    setPreviewText("");
    setStagedMessage("");
    setPreviewConfidence(undefined);
  }, []);

  const cancelStream = useCallback(async () => {
    const id = streamIdRef.current;
    cleanupMedia();
    streamIdRef.current = null;
    uploadInFlightRef.current = false;
    if (id) {
      try {
        await cancelStreamTranscribeSession(id);
      } catch {
        /* ignore */
      }
    }
    resetUiIdle();
  }, [cleanupMedia, resetUiIdle]);

  const processUploadQueue = useCallback(async () => {
    if (uploadInFlightRef.current || !streamIdRef.current) return;
    const blob = pendingChunksRef.current.shift();
    if (!blob?.size) {
      if (pendingChunksRef.current.length > 0) {
        void processUploadQueue();
      }
      return;
    }

    uploadInFlightRef.current = true;
    const id = streamIdRef.current;
    try {
      const result = await uploadStreamTranscribeChunk(
        blob,
        id,
        mimeRef.current,
      );
      if (!mountedRef.current || streamIdRef.current !== id) return;
      if (!result.ok) {
        setPhase("error");
        optsRef.current.onError?.(result.message || result.error || "chunk_failed");
        void cancelStream();
        return;
      }
      if (result.stagedMessage) {
        setStagedMessage(result.stagedMessage);
        optsRef.current.onStatusMessage?.(result.stagedMessage);
      }
      if (result.partialTranscript) {
        setPreviewText(result.partialTranscript);
        setPreviewConfidence(result.confidence);
        optsRef.current.onDraftPreview?.({
          text: result.partialTranscript,
          confidence: result.confidence,
          provisional: true,
        });
      }
    } finally {
      uploadInFlightRef.current = false;
      if (
        pendingChunksRef.current.length > 0 &&
        streamIdRef.current === id &&
        mountedRef.current
      ) {
        void processUploadQueue();
      }
    }
  }, [cancelStream]);

  const enqueueChunk = useCallback(
    (blob) => {
      if (!blob?.size || !streamIdRef.current) return;
      if (pendingChunksRef.current.length >= MAX_PENDING_CHUNKS) {
        setPhase("error");
        optsRef.current.onError?.("stream_backpressure");
        void cancelStream();
        return;
      }
      pendingChunksRef.current.push(blob);
      void processUploadQueue();
    },
    [processUploadQueue, cancelStream],
  );

  useEffect(() => {
    return () => {
      void cancelStream();
    };
  }, [cancelStream]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void cancelStream();
      }
    };
    const onPageHide = () => {
      void cancelStream();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [cancelStream]);

  const pollStatus = useCallback(async () => {
    const id = streamIdRef.current;
    if (!id) return;
    const result = await fetchStreamTranscribeStatus(id);
    if (!mountedRef.current || !result.ok) return;
    if (result.stagedMessage) {
      setStagedMessage(result.stagedMessage);
      optsRef.current.onStatusMessage?.(result.stagedMessage);
    }
    if (result.partialTranscript) {
      setPreviewText(result.partialTranscript);
      setPreviewConfidence(result.confidence);
      optsRef.current.onDraftPreview?.({
        text: result.partialTranscript,
        confidence: result.confidence,
        provisional: true,
      });
    }
    setConnectionLabel(result.status === "processing" ? "processing" : "connected");
  }, []);

  const monitorSilence = useCallback((stream) => {
    stopSilenceMonitorRef.current?.();
    stopSilenceMonitorRef.current = startInterpreterSilenceMonitor(stream, {
      silenceMs: optsRef.current.silenceAutoStopMs ?? INTERPRETER_SILENCE_AUTO_STOP_MS,
      minSpeechMs: 220,
      onPhaseChange: (phase) => {
        optsRef.current.onSilencePhaseChange?.(phase);
      },
      onSilence: () => {
        void stopStreamingRef.current?.();
      },
    });
  }, []);

  const startStreaming = useCallback(async () => {
    if (!isStreamingSttBrowserSupported()) {
      optsRef.current.onError?.("unsupported_browser");
      return false;
    }
    if (startingRef.current || (phase !== "idle" && phase !== "error")) {
      return false;
    }
    startingRef.current = true;

    setPhase("connecting");
    setConnectionLabel("connecting");
    setPreviewText("");
    setStagedMessage("");
    setPreviewConfidence(undefined);
    pendingChunksRef.current = [];

    const started = await startStreamTranscribeSession({
      language: optsRef.current.languageHint,
    });
    if (!started.ok || !started.streamId) {
      startingRef.current = false;
      setPhase("error");
      optsRef.current.onError?.(started.message || started.error || "start_failed");
      return false;
    }

    streamIdRef.current = started.streamId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      let mime = "audio/webm";
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mime = "audio/webm;codecs=opus";
        } else if (!MediaRecorder.isTypeSupported("audio/webm")) {
          if (MediaRecorder.isTypeSupported("audio/mp4")) mime = "audio/mp4";
          else if (MediaRecorder.isTypeSupported("audio/ogg")) mime = "audio/ogg";
        }
      }
      mimeRef.current = mime.split(";")[0];

      const recorder = (() => {
        try {
          return new MediaRecorder(stream, { mimeType: mime });
        } catch {
          return new MediaRecorder(stream);
        }
      })();

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) {
          enqueueChunk(e.data);
        }
      };

      recorder.onerror = () => {
        setPhase("error");
        optsRef.current.onError?.("mic_unavailable");
        void cancelStream();
      };

      recorder.start(CHUNK_TIMESLICE_MS);
      monitorSilence(stream);
      setPhase("streaming");
      setConnectionLabel("connected");
      optsRef.current.onStatusMessage?.("streaming");
      optsRef.current.onRecordingStart?.();

      pollTimerRef.current = setInterval(() => {
        void pollStatus();
      }, POLL_INTERVAL_MS);

      maxDurationTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          optsRef.current.onStatusMessage?.("max_duration");
          void stopStreamingRef.current?.();
        }
      }, INTERPRETER_STREAM_MAX_DURATION_MS);

      startingRef.current = false;
      return true;
    } catch (err) {
      startingRef.current = false;
      await cancelStream();
      setPhase("error");
      if (err?.name === "NotAllowedError") {
        optsRef.current.onError?.("mic_denied");
      } else {
        optsRef.current.onError?.("mic_unavailable");
      }
      return false;
    }
  }, [phase, enqueueChunk, monitorSilence, pollStatus, cancelStream]);

  const stopStreaming = useCallback(async () => {
    const id = streamIdRef.current;
    if (!id) {
      return { ok: false };
    }
    if (phase === "connecting") {
      await cancelStream();
      return { ok: false, cancelled: true };
    }
    if (phase !== "streaming") {
      return { ok: false };
    }

    setPhase("finalizing");
    setConnectionLabel("finalizing");
    optsRef.current.onStatusMessage?.("finalizing");

    cleanupMedia();

    const drainDeadline = Date.now() + 8000;
    while (
      uploadInFlightRef.current &&
      mountedRef.current &&
      Date.now() < drainDeadline
    ) {
      await new Promise((r) => {
        setTimeout(r, 50);
      });
    }
    if (pendingChunksRef.current.length > 0) {
      await processUploadQueue();
    }

    const result = await finishStreamTranscribeSession(id, mimeRef.current);
    streamIdRef.current = null;

    if (!mountedRef.current) {
      return { ok: false };
    }

    if (!result.ok) {
      setPhase("error");
      optsRef.current.onError?.(result.message || result.error || "finish_failed");
      return { ok: false, error: result.error };
    }

    const text = String(result.transcript || "").trim();
    setPreviewText(text);
    setPreviewConfidence(result.confidence);
    setPhase("idle");
    setConnectionLabel("");
    setStagedMessage("");

    const finalizedPayload = {
      transcript: text,
      confidence: result.confidence,
      language: result.language,
    };
    await optsRef.current.onFinalized?.(finalizedPayload);

    return { ok: true, ...finalizedPayload };
  }, [phase, cleanupMedia, cancelStream, processUploadQueue]);

  stopStreamingRef.current = stopStreaming;

  const isActive = phase === "connecting" || phase === "streaming" || phase === "finalizing";

  return {
    phase,
    isActive,
    connectionLabel,
    previewText,
    previewConfidence,
    stagedMessage,
    startStreaming,
    stopStreaming,
    cancelStream,
    browserSupported: isStreamingSttBrowserSupported(),
  };
}
