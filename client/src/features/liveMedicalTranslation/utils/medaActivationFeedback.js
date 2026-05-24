/** @typedef {"medscoutx.liveTranslation.activationSoundMuted"} ActivationSoundStorageKey */

const ACTIVATION_SOUND_STORAGE_KEY = "medscoutx.liveTranslation.activationSoundMuted";

let audioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  return audioContext;
}

/** @returns {boolean} */
export function isActivationSoundMuted() {
  try {
    return localStorage.getItem(ACTIVATION_SOUND_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** @param {boolean} muted */
export function setActivationSoundMuted(muted) {
  try {
    if (muted) {
      localStorage.setItem(ACTIVATION_SOUND_STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(ACTIVATION_SOUND_STORAGE_KEY);
    }
  } catch {
    /* optional preference — ignore */
  }
}

/**
 * Soft, premium readiness tone — medical-device feel, low volume.
 * Fails silently if audio is blocked or unavailable.
 */
export function playMedaActivationChime() {
  if (isActivationSoundMuted()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.032, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    master.connect(ctx.destination);

    const tone = (frequency, startOffset, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.85, now + startOffset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    tone(587.33, 0, 0.14);
    tone(440, 0.16, 0.2);
  } catch {
    /* optional feedback — ignore */
  }
}
