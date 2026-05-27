import { useCallback, useRef, useState } from "react";

/**
 * @typedef {"idle" | "active" | "error" | "stopped"} MicStatus
 */

/**
 * Microphone access + audio level meter.
 * Mic is only requested on start().
 * Race-condition guard: if stop()/unmount fires while getUserMedia() is
 * pending, the resolved stream is immediately stopped and discarded.
 */
export function useMicrophoneLevel() {
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState(/** @type {MicStatus} */ ("idle"));

  const streamRef  = useRef(/** @type {MediaStream|null} */ (null));
  const contextRef = useRef(/** @type {AudioContext|null} */ (null));
  const analyserRef = useRef(/** @type {AnalyserNode|null} */ (null));
  const rafRef     = useRef(/** @type {number|null} */ (null));
  const abortRef   = useRef(false); // flipped to true by stop() to cancel in-flight start()

  const stop = useCallback(() => {
    abortRef.current = true;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (contextRef.current) {
      void contextRef.current.close();
      contextRef.current = null;
    }
    analyserRef.current = null;
    setLevel(0);
    setStatus("stopped");
  }, []);

  const start = useCallback(async () => {
    abortRef.current = false; // reset for this run
    setStatus("idle");
    setLevel(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      // stop()/unmount fired while permission dialog was open → discard stream
      if (abortRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      const ctx = new AudioContext();
      contextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(buffer);
        const sum = buffer.reduce((a, b) => a + b, 0);
        const avg = sum / buffer.length;
        // Scale 0–255 average to 0–100, amplified so quiet speech is visible
        setLevel(Math.min(100, Math.round((avg / 255) * 100 * 2.5)));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      setStatus("active");
    } catch {
      setStatus("error");
    }
  }, []);

  return { level, status, start, stop };
}
