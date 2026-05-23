/**
 * Client build-time flag for near-realtime translation preview (Phase 5.4).
 * Requires server nearRealtimeTranslationEnabled from /status and streaming STT for UI.
 */
export function isNearRealtimeTranslationClientEnabled() {
  const raw = import.meta.env.VITE_MEDICAL_INTERPRETER_NEAR_REALTIME_TRANSLATION_ENABLED;
  return raw === "true" || raw === "1";
}

/** Minimum stable source length before requesting a preview translate. */
export const NEAR_REALTIME_PREVIEW_MIN_CHARS = 20;

/** Debounce after transcript text stops changing (ms). */
export const NEAR_REALTIME_PREVIEW_DEBOUNCE_MS = 2_500;

/** Max preview source length sent to API (must match server). */
export const NEAR_REALTIME_PREVIEW_MAX_CHARS = 600;
