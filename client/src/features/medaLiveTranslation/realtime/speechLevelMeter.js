/**
 * Local microphone level meter — MEASUREMENT ONLY.
 *
 * Reads the SAME MediaStream that goes to the provider — no second capture, no
 * extra model, no network. It keeps only a rolling list of loudness numbers
 * (dBFS every ~50 ms, last 60 s); no audio samples are retained and nothing
 * leaves the device. It is not a voiceprint: loudness says how far away a voice
 * is, not whose voice it is.
 *
 * Nothing is rejected on these numbers. A quietly speaking patient must not
 * disappear from the medical record, and one shared microphone cannot reliably
 * tell a quiet participant from a voice in the background. The per-segment
 * level only appears in the debug events, to calibrate a possible later rule
 * with real recordings.
 *
 * Fails open: without WebAudio (or while the context is suspended) every query
 * returns null.
 */

const MIN_DB = -100;

/** @param {number[]} values @param {number} q 0..1 */
export function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Pure summary of a sample history, exported for tests.
 *
 * @param {{ t: number, db: number }[]} samples
 * @param {number} startMs
 * @param {number} endMs
 * @param {number} [noiseWindowMs]
 * @returns {{ speechDb: number, noiseFloorDb: number|null } | null}
 */
export function summariseSegment(samples, startMs, endMs, noiseWindowMs = 15_000) {
  const inSegment = samples.filter((s) => s.t >= startMs && s.t <= endMs).map((s) => s.db);
  if (inSegment.length < 3) return null;
  // Speech energy: the upper quartile. Syllables keep speech near its level for
  // well over a quarter of a segment, so p75 tracks the voice — while up to a
  // quarter of stray samples (the tail of the previous speaker, a door) cannot
  // move it. p90 could be dominated by a handful of leaked frames.
  const speechDb = percentile(inSegment, 0.75);
  // Room noise: the quiet end of the recent past, speech included — pauses
  // dominate a conversation's quietest tenth.
  const recent = samples.filter((s) => s.t >= endMs - noiseWindowMs && s.t <= endMs).map((s) => s.db);
  const noiseFloorDb = recent.length >= 20 ? percentile(recent, 0.1) : null;
  return { speechDb, noiseFloorDb };
}

/**
 * @param {MediaStream} stream
 * @param {{ sampleIntervalMs?: number, historyMs?: number, now?: () => number }} [options]
 */
export function createSpeechLevelMeter(stream, options = {}) {
  const sampleIntervalMs = options.sampleIntervalMs ?? 50;
  const historyMs = options.historyMs ?? 60_000;
  const now = options.now ?? (() => performance.now());

  /** @type {{ t: number, db: number }[]} */
  const samples = [];
  let ctx = null;
  let timer = null;

  try {
    const Ctor = typeof window !== 'undefined'
      ? (window.AudioContext || window.webkitAudioContext)
      : null;
    if (Ctor && stream && stream.getAudioTracks().length > 0) {
      ctx = new Ctor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      // Analysis only: the analyser is never connected to the speakers.
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      // Started from the "start conversation" click, so resuming is allowed.
      ctx.resume?.().catch(() => {});

      timer = setInterval(() => {
        if (!ctx || ctx.state !== 'running') return;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const db = Math.max(MIN_DB, 20 * Math.log10(rms + 1e-12));
        const t = now();
        samples.push({ t, db });
        const cutoff = t - historyMs;
        while (samples.length && samples[0].t < cutoff) samples.shift();
      }, sampleIntervalMs);
    }
  } catch {
    // No WebAudio or a blocked context: simply no measurement.
    ctx = null;
  }

  return {
    /** @returns {{ speechDb: number, noiseFloorDb: number|null } | null} */
    segmentLevel(startMs, endMs) {
      if (!ctx) return null;
      return summariseSegment(samples, startMs, endMs);
    },
    get active() {
      return Boolean(ctx);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      samples.length = 0;
      if (ctx) {
        ctx.close?.().catch(() => {});
        ctx = null;
      }
    },
  };
}
