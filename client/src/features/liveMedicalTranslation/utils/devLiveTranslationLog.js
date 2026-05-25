/**
 * Development-only diagnostics — no patient content logged.
 */
export function devLiveTranslationLog(scope, meta = {}) {
  if (!import.meta.env.DEV) return;
  const safe = { ...meta };
  delete safe.transcript;
  delete safe.originalText;
  delete safe.translatedText;
  delete safe.text;
  console.info("[live-translation-dev]", scope, safe);
}
