/**
 * Detect speech pause during PTT recording — stop after sustained silence.
 */

const DEFAULT_CHECK_INTERVAL_MS = 120;
const DEFAULT_SILENCE_RMS = 0.012;
const DEFAULT_MIN_SPEECH_MS = 500;

/**
 * @param {MediaStream} stream
 * @param {{
 *   silenceMs: number;
 *   onSilence: () => void;
 *   onPhaseChange?: (phase: 'listening' | 'silence_waiting') => void;
 *   minSpeechMs?: number;
 *   silenceRms?: number;
 *   checkIntervalMs?: number;
 * }} options
 * @returns {() => void} stop monitoring and release audio context
 */
export function startInterpreterSilenceMonitor(stream, options) {
  const {
    silenceMs,
    onSilence,
    onPhaseChange,
    minSpeechMs = DEFAULT_MIN_SPEECH_MS,
    silenceRms = DEFAULT_SILENCE_RMS,
    checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS,
  } = options;

  let stopped = false;
  let audioContext = null;
  let intervalId = null;
  let speechStartedAt = 0;
  let silenceStartedAt = 0;
  let heardSpeech = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    try {
      audioContext?.close();
    } catch {
      /* ignore */
    }
    audioContext = null;
  };

  try {
    const Ctx =
      typeof window !== "undefined"
        ? window.AudioContext || window.webkitAudioContext
        : null;
    if (!Ctx) return stop;

    audioContext = new Ctx();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);

    intervalId = setInterval(() => {
      if (stopped) return;
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        sum += data[i] * data[i];
      }
      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();

      if (rms >= silenceRms) {
        if (!heardSpeech) {
          heardSpeech = true;
          speechStartedAt = now;
        }
        if (silenceStartedAt) {
          onPhaseChange?.("listening");
        }
        silenceStartedAt = 0;
        return;
      }

      if (!heardSpeech || now - speechStartedAt < minSpeechMs) {
        return;
      }

      if (!silenceStartedAt) {
        silenceStartedAt = now;
        onPhaseChange?.("silence_waiting");
        return;
      }

      if (now - silenceStartedAt >= silenceMs) {
        stop();
        onSilence();
      }
    }, checkIntervalMs);
  } catch {
    stop();
  }

  return stop;
}
