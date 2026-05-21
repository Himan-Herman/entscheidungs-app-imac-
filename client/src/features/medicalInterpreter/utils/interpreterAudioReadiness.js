/**
 * International readiness notes (Phase 2.6).
 * Re-exports text-direction helpers for audio/TTS callers.
 */

export {
  interpreterLangAttribute,
  interpreterTextDirection,
  sessionHasRtlLanguage,
  sessionIsMixedDirection,
} from "./interpreterLocale.js";
