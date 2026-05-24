/**
 * Short in-memory cue after each finished spoken translation.
 * No persistence, no uploaded audio, no localStorage.
 */

const TURN_SIGNAL_DURATION_MS = 120;
const TURN_SIGNAL_GAIN = 0.045;
const TURN_SIGNAL_START_HZ = 1046;
const TURN_SIGNAL_END_HZ = 1318;
let sharedTurnSignalContext = null;

async function getTurnSignalContext() {
  if (typeof window === "undefined") return null;

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;

  if (!sharedTurnSignalContext || sharedTurnSignalContext.state === "closed") {
    sharedTurnSignalContext = new AudioCtor();
  }

  if (sharedTurnSignalContext.state === "suspended") {
    await sharedTurnSignalContext.resume();
  }

  return sharedTurnSignalContext;
}

export async function playInterpreterTurnSignal() {
  try {
    const context = await getTurnSignalContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(TURN_SIGNAL_START_HZ, context.currentTime);
    oscillator.frequency.linearRampToValueAtTime(
      TURN_SIGNAL_END_HZ,
      context.currentTime + TURN_SIGNAL_DURATION_MS / 1000,
    );

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      TURN_SIGNAL_GAIN,
      context.currentTime + 0.012,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + TURN_SIGNAL_DURATION_MS / 1000,
    );

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + TURN_SIGNAL_DURATION_MS / 1000);

    await new Promise((resolve) => {
      oscillator.onended = resolve;
    });
  } catch {
    /* ignore short cue failures */
  }
}
