import { useCallback, useEffect, useRef, useState } from "react";
import {
  INTERPRETER_MIN_BLOB_BYTES,
  INTERPRETER_RECORDING_MAX_MS,
  INTERPRETER_RECORDING_MIN_MS,
  INTERPRETER_RECORDING_TIMESLICE_MS,
  INTERPRETER_SILENCE_AUTO_STOP_MS,
  INTERPRETER_SILENCE_MIN_SPEECH_MS,
} from "../utils/interpreterAudioConstants.js";
import { startInterpreterSilenceMonitor } from "../utils/interpreterSilenceMonitor.js";

/**
 * Push-to-talk recorder — microphone only while recording.
 * No localStorage; streams and blobs are released after each clip.
 *
 * Limitations (Phase 2.3): no VAD/noise suppression — only duration/size
 * checks for empty, accidental, or near-silent clips.
 *
 * @param {{
 *   maxMs?: number;
 *   minMs?: number;
 *   timesliceMs?: number;
 *   onRecorded?: (payload: { blob: Blob, mimeType: string, durationMs: number }) => void | Promise<void>;
 *   onMaxDuration?: () => void;
 *   onRecordingStart?: () => void;
 *   onSilencePhaseChange?: (phase: 'listening' | 'silence_waiting') => void;
 *   silenceAutoStopMs?: number;
 * }} options
 */
export function useInterpreterRecorder({
  maxMs = INTERPRETER_RECORDING_MAX_MS,
  minMs = INTERPRETER_RECORDING_MIN_MS,
  timesliceMs = INTERPRETER_RECORDING_TIMESLICE_MS,
  onRecorded,
  onMaxDuration,
  onRecordingStart,
  onSilencePhaseChange,
  silenceAutoStopMs = INTERPRETER_SILENCE_AUTO_STOP_MS,
} = {}) {
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  /** @type {'mic_denied'|'mic_unavailable'|'too_short'|null} */
  const [recorderError, setRecorderError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeRef = useRef("audio/webm");
  const startTimeRef = useRef(0);
  const stopTimerRef = useRef(null);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  const onMaxDurationRef = useRef(onMaxDuration);
  const onRecordingStartRef = useRef(onRecordingStart);
  const onSilencePhaseChangeRef = useRef(onSilencePhaseChange);
  const stopSilenceMonitorRef = useRef(null);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);
  useEffect(() => {
    onMaxDurationRef.current = onMaxDuration;
  }, [onMaxDuration]);
  useEffect(() => {
    onRecordingStartRef.current = onRecordingStart;
  }, [onRecordingStart]);
  useEffect(() => {
    onSilencePhaseChangeRef.current = onSilencePhaseChange;
  }, [onSilencePhaseChange]);

  const markStreamStale = useCallback((stream) => {
    if (streamRef.current === stream) {
      streamRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* track may already be stopped */
        }
      });
      streamRef.current = null;
    }
  }, []);

  const ensureStream = useCallback(async () => {
    const usableTracks =
      streamRef.current?.getAudioTracks?.().filter(
        (track) => track.readyState === "live" && track.muted !== true,
      ) || [];
    if (streamRef.current && usableTracks.length > 0) {
      return streamRef.current;
    }

    if (streamRef.current) {
      cleanupStream();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const handleStreamStale = () => {
      markStreamStale(stream);
    };

    stream.addEventListener?.("inactive", handleStreamStale, { once: true });
    stream.getAudioTracks().forEach((track) => {
      track.addEventListener?.("ended", handleStreamStale, { once: true });
    });

    streamRef.current = stream;
    return stream;
  }, [cleanupStream, markStreamStale]);

  const stopSilenceMonitor = useCallback(() => {
    stopSilenceMonitorRef.current?.();
    stopSilenceMonitorRef.current = null;
  }, []);

  const disposeActiveRecording = useCallback((options = {}) => {
    const preserveStream = options.preserveStream === true;
    stopSilenceMonitor();
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.onstop = null;
        recorder.onerror = null;
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stoppingRef.current = false;
    setIsStopping(false);
    setIsRecording(false);
    setIsPreparing(false);
    if (!preserveStream) {
      cleanupStream();
    }
  }, [cleanupStream, stopSilenceMonitor]);

  const resetRecorderState = useCallback(() => {
    disposeActiveRecording({ preserveStream: true });
    startingRef.current = false;
  }, [disposeActiveRecording]);

  const clearRecorderError = useCallback(() => {
    setRecorderError(null);
  }, []);

  const cancelRecording = useCallback(() => {
    disposeActiveRecording({ preserveStream: false });
    startingRef.current = false;
  }, [disposeActiveRecording]);

  const stopRecording = useCallback(() => {
    if (stoppingRef.current || isStopping) return;
    if (!mediaRecorderRef.current && !isRecording && !isPreparing) {
      return;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      stoppingRef.current = true;
      setIsStopping(true);
      try {
        recorder.stop();
      } catch {
        stoppingRef.current = false;
        resetRecorderState();
      }
    } else {
      resetRecorderState();
    }
  }, [isRecording, isPreparing, isStopping, resetRecorderState]);

  const startRecording = useCallback(async () => {
    if (
      startingRef.current ||
      stoppingRef.current ||
      isPreparing ||
      isRecording ||
      isStopping
    ) {
      return false;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      return false;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecorderError("mic_unavailable");
      return false;
    }

    startingRef.current = true;
    setRecorderError(null);
    setIsPreparing(true);

    disposeActiveRecording({ preserveStream: true });

    try {
      const stream = await ensureStream();

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
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stoppingRef.current = false;
        stopSilenceMonitor();
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        setIsRecording(false);
        setIsPreparing(false);

        const durationMs = Math.max(0, Date.now() - startTimeRef.current);
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        chunksRef.current = [];
        mediaRecorderRef.current = null;

        if (durationMs < minMs || blob.size < INTERPRETER_MIN_BLOB_BYTES) {
          setRecorderError("too_short");
          return;
        }

        void onRecordedRef.current?.({
          blob,
          mimeType: mimeRef.current,
          durationMs,
        });
      };

      recorder.onerror = () => {
        stoppingRef.current = false;
        resetRecorderState();
        setRecorderError("mic_unavailable");
      };

      startTimeRef.current = Date.now();
      try {
        recorder.start(timesliceMs);
      } catch {
        resetRecorderState();
        setRecorderError("mic_unavailable");
        return false;
      }

      setIsPreparing(false);
      setIsRecording(true);
      onRecordingStartRef.current?.();
      onSilencePhaseChangeRef.current?.("listening");

      if (silenceAutoStopMs > 0 && streamRef.current) {
        stopSilenceMonitor();
        stopSilenceMonitorRef.current = startInterpreterSilenceMonitor(
          streamRef.current,
          {
            silenceMs: silenceAutoStopMs,
            minSpeechMs: INTERPRETER_SILENCE_MIN_SPEECH_MS,
            onPhaseChange: (phase) => {
              onSilencePhaseChangeRef.current?.(phase);
            },
            onSilence: () => {
              if (mediaRecorderRef.current?.state === "recording") {
                stopRecording();
              }
            },
          },
        );
      }

      stopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          onMaxDurationRef.current?.();
          stopRecording();
        }
      }, maxMs);

      return true;
    } catch (err) {
      resetRecorderState();
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setRecorderError("mic_denied");
      } else {
        setRecorderError("mic_unavailable");
      }
      return false;
    } finally {
      startingRef.current = false;
    }
  }, [
    ensureStream,
    disposeActiveRecording,
    isPreparing,
    isRecording,
    isStopping,
    maxMs,
    minMs,
    resetRecorderState,
    stopRecording,
    timesliceMs,
    silenceAutoStopMs,
    stopSilenceMonitor,
  ]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelRecording();
      }
    };
    const onPageHide = () => cancelRecording();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      cancelRecording();
    };
  }, [cancelRecording]);

  return {
    isPreparing,
    isRecording,
    isStopping,
    isBusy:
      isPreparing || isRecording || isStopping || startingRef.current,
    recorderError,
    clearRecorderError,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
