/**
 * Lightweight client-side silence heuristic for PTT clips (Phase 5.2).
 * Audio is analyzed in memory only — never persisted.
 */

/**
 * @param {Blob} blob
 * @param {{ minRms?: number }} [opts]
 * @returns {Promise<{ silent: boolean; skipped: boolean }>}
 */
export async function detectLikelySilentBlob(blob, opts = {}) {
  const minRms = opts.minRms ?? 0.006;
  if (!blob?.size || typeof AudioContext === "undefined") {
    return { silent: false, skipped: true };
  }

  /** @type {AudioContext | null} */
  let ctx = null;
  try {
    ctx = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    if (!channel?.length) {
      return { silent: false, skipped: true };
    }
    let sumSq = 0;
    const step = Math.max(1, Math.floor(channel.length / 8000));
    let samples = 0;
    for (let i = 0; i < channel.length; i += step) {
      const v = channel[i];
      sumSq += v * v;
      samples += 1;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, samples));
    return { silent: rms < minRms, skipped: false };
  } catch {
    return { silent: false, skipped: true };
  } finally {
    try {
      await ctx?.close();
    } catch {
      /* ignore */
    }
  }
}
