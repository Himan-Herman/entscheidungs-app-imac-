/** Must match server LIVE_TRANSLATION_TRANSCRIPTION_MODEL default. */
export const LIVE_TRANSLATION_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

/** ISO codes accepted by OpenAI Realtime input transcription. */
export const OPENAI_TRANSCRIPTION_LANGUAGE_CODES = new Set([
  "af", "ar", "az", "be", "bg", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es", "et", "fa",
  "fi", "fr", "gl", "he", "hi", "hr", "hu", "hy", "id", "is", "it", "iw", "ja", "kk", "kn", "ko",
  "lt", "lv", "mi", "mk", "mr", "ms", "ne", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sl", "sr",
  "sv", "sw", "ta", "th", "tl", "tr", "uk", "ur", "vi", "zh",
]);

/** @param {string | undefined | null} code */
export function resolveOpenAiTranscriptionLanguage(code) {
  if (typeof code !== "string") return null;
  const normalized = code.trim().toLowerCase();
  return OPENAI_TRANSCRIPTION_LANGUAGE_CODES.has(normalized) ? normalized : null;
}
