/**
 * Client flag for streaming / near-realtime TTS (Phase 5.5).
 * Also requires server streamingTtsEnabled and ttsEnabled from /status.
 */
export function isStreamingTtsClientEnabled() {
  const raw = import.meta.env.VITE_MEDICAL_INTERPRETER_STREAMING_TTS_ENABLED;
  return raw === "true" || raw === "1";
}

/** In-memory cache entry cap for TTS blobs (page lifecycle only). */
export const STREAMING_TTS_CACHE_MAX_ENTRIES = 8;

/** Min ms between identical speak API requests. */
export const STREAMING_TTS_MIN_REPEAT_MS = 4000;
