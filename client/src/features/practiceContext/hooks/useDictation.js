import { useCallback, useEffect, useRef, useState } from "react";
import { DICTATION_STATES, dictationFailure, isCapturing } from "../lib/dictationState.js";
import { MAX_DICTATION_SECONDS } from "../lib/dictationLimits.js";

/**
 * Recording a short dictation, and nothing more.
 *
 * ── The microphone is only ever live on purpose ─────────────────────────────
 * `getUserMedia` is called from `start()` and from nowhere else, so the
 * permission prompt appears when someone presses a button and never when a page
 * loads. When recording ends — by stopping, by the time limit, by an error, by
 * navigating away — every track is stopped explicitly. A browser's recording
 * indicator staying on after someone left the page is the kind of thing that
 * makes people distrust an app permanently, and it is entirely avoidable.
 *
 * ── The result is a draft ───────────────────────────────────────────────────
 * This hook hands back a string. It does not send anything, and the component
 * that owns the composer decides where the string goes.
 */
export function useDictation({ onTranscript, transcribe, t }) {
  const [state, setState] = useState(DICTATION_STATES.IDLE);
  const [error, setError] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);
  const abandonedRef = useRef(false);

  /** Releases the microphone. Safe to call at any time, including twice. */
  const release = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* a recorder that is already gone needs no stopping */
      }
    }
    const stream = streamRef.current;
    streamRef.current = null;
    for (const track of stream?.getTracks() ?? []) track.stop();
  }, []);

  /**
   * Leaving the page, or switching to another practice, ends the recording.
   *
   * The component is keyed by link id, so a context switch unmounts it — which
   * makes this the same code path as navigating away, and both have to leave
   * the microphone off.
   */
  useEffect(() => {
    // Reset on mount as well as set on unmount. A remount is a fresh start —
    // React re-runs effects in development, and the page itself is remounted
    // by key when the practice changes — and a flag left true from the previous
    // life would make the next recording release the microphone the instant it
    // was granted.
    abandonedRef.current = false;
    return () => {
      abandonedRef.current = true;
      release();
    };
  }, [release]);

  const fail = useCallback(
    (failure) => {
      release();
      const described = dictationFailure(failure, t);
      setError(described);
      setState(DICTATION_STATES.ERROR);
    },
    [release, t],
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      // The recorder's stop event is what produces the audio; the tracks are
      // released there, once there is something to release them for.
      recorder.stop();
      setState(DICTATION_STATES.PROCESSING);
      return;
    }
    release();
    setState(DICTATION_STATES.IDLE);
  }, [release]);

  const start = useCallback(async () => {
    if (isCapturing(state)) return;
    setError(null);
    setState(DICTATION_STATES.REQUESTING);

    let stream;
    try {
      // The permission prompt happens here, inside a click handler, and never
      // anywhere else.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      fail(err);
      return;
    }
    if (abandonedRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    streamRef.current = stream;

    const mimeType = pickMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
      fail(err);
      return;
    }
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      const chunks = chunksRef.current;
      chunksRef.current = [];
      // The microphone goes off the moment the recording ends, not when the
      // transcript comes back.
      release();

      if (abandonedRef.current) return;
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      if (blob.size === 0) {
        setState(DICTATION_STATES.IDLE);
        return;
      }

      setState(DICTATION_STATES.PROCESSING);
      try {
        const text = await transcribe(blob);
        // A result that arrives after the reader left this conversation is
        // dropped rather than applied. The caller's scoped-request machinery
        // makes the same decision; this is the local half of it.
        if (abandonedRef.current) return;
        if (text) onTranscript(text);
        setState(DICTATION_STATES.IDLE);
      } catch (err) {
        if (abandonedRef.current) return;
        fail(err);
      }
    };

    recorder.start();
    setState(DICTATION_STATES.RECORDING);

    // A hard stop, so a forgotten recording cannot run on. The limit is the
    // server's, restated here only so the browser does not produce audio the
    // server would then refuse.
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, MAX_DICTATION_SECONDS * 1000);
  }, [fail, onTranscript, release, state, transcribe]);

  return { state, error, start, stop, isCapturing: isCapturing(state) };
}

/**
 * The best container this browser records.
 *
 * Chromium and Firefox produce WebM/Opus; Safari produces MP4. Returning
 * undefined lets the browser choose, which is what older Safari needs.
 */
function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const candidate of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(candidate)) return candidate;
  }
  return undefined;
}

/** Whether this browser can record at all. */
export function dictationSupported() {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}
