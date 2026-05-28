import { useCallback, useEffect, useRef, useState } from "react";

const SS =
  typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;

/**
 * Preferred voice names per locale prefix, ordered by priority.
 * These are well-known, natural-sounding system voices across macOS/Windows/iOS.
 */
const VOICE_PREFERENCES = {
  "en": ["Samantha", "Karen", "Moira", "Fiona", "Daniel", "Google US English", "Google UK English Female", "Microsoft Zira", "Microsoft David"],
  "de": ["Anna", "Petra", "Markus", "Google Deutsch", "Microsoft Hedda", "Microsoft Stefan"],
};

/**
 * Selects the best available voice for a given BCP-47 lang tag (e.g. "en-US", "de-DE").
 * Priority: (1) preferred names (local first), (2) any local voice matching the locale,
 * (3) any voice matching the locale, (4) undefined (browser default).
 */
function pickVoice(lang) {
  if (!SS) return undefined;
  const voices = SS.getVoices();
  if (voices.length === 0) return undefined;

  const prefix = lang.split("-")[0].toLowerCase();
  const preferred = VOICE_PREFERENCES[prefix] ?? [];

  const localeVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(prefix)
  );
  if (localeVoices.length === 0) return undefined;

  for (const name of preferred) {
    const local = localeVoices.find((v) => v.localService && v.name === name);
    if (local) return local;
  }
  for (const name of preferred) {
    const any = localeVoices.find((v) => v.name === name);
    if (any) return any;
  }

  const localFallback = localeVoices.find((v) => v.localService);
  return localFallback ?? localeVoices[0];
}

/**
 * Web Speech Synthesis output for translated text.
 * Caller passes the BCP-47 lang tag (e.g. "en-US", "de-DE") per utterance.
 *
 * Loop guard: SpeechRecognition lang and TTS lang differ (e.g. de-DE mic /
 * en-US speaker, or en-US mic / de-DE speaker). The recognizer does not
 * process its own speaker language, so no feedback loop can form.
 *
 * Duplicate guard: autoSpeak() is a no-op when the text equals the last
 * auto-spoken text in the current session. Call resetSession() on session
 * start to allow the same phrase to be spoken again in a new recording.
 */
export function useSpeechOutput() {
  const isSupported =
    SS !== null && typeof SpeechSynthesisUtterance !== "undefined";

  const [enabled, setEnabled] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("idle");
  const [selectedVoiceName, setSelectedVoiceName] = useState(/** @type {string|null} */ (null));

  const lastAutoSpokenRef = useRef("");
  const voiceRef = useRef(/** @type {SpeechSynthesisVoice|undefined} */ (undefined));
  const lastLangRef = useRef("");

  const updateVoice = useCallback((lang) => {
    if (!isSupported) return;
    const v = pickVoice(lang);
    voiceRef.current = v;
    setSelectedVoiceName(v?.name ?? null);
  }, [isSupported]);

  // Re-pick voice when voices load asynchronously (common in Chrome)
  useEffect(() => {
    if (!isSupported) return;
    const handle = () => {
      if (lastLangRef.current) updateVoice(lastLangRef.current);
    };
    SS.addEventListener("voiceschanged", handle);
    return () => SS.removeEventListener("voiceschanged", handle);
  }, [isSupported, updateVoice]);

  const _doSpeak = useCallback(
    (text, lang = "en-US") => {
      if (!isSupported || !text) return;

      if (lang !== lastLangRef.current) {
        lastLangRef.current = lang;
        updateVoice(lang);
      }

      SS.cancel();
      setSpeechStatus("speaking");

      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang;
      if (voiceRef.current) utt.voice = voiceRef.current;
      utt.rate = 0.95;
      utt.pitch = 1.0;
      utt.volume = 1;
      utt.onend = () => setSpeechStatus("idle");
      utt.onerror = () => setSpeechStatus("idle");
      SS.speak(utt);
    },
    [isSupported, updateVoice],
  );

  const autoSpeak = useCallback(
    (text, lang = "en-US") => {
      if (!isSupported || !enabled || !text) return;
      if (text === lastAutoSpokenRef.current) return;
      lastAutoSpokenRef.current = text;
      _doSpeak(text, lang);
    },
    [isSupported, enabled, _doSpeak],
  );

  const replay = useCallback(
    (text, lang = "en-US") => {
      if (!isSupported || !text) return;
      _doSpeak(text, lang);
    },
    [isSupported, _doSpeak],
  );

  const stopSpeech = useCallback(() => {
    if (!isSupported) return;
    SS.cancel();
    setSpeechStatus("stopped");
  }, [isSupported]);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      if (prev && isSupported) SS.cancel();
      return !prev;
    });
  }, [isSupported]);

  const resetSession = useCallback(() => {
    lastAutoSpokenRef.current = "";
    if (isSupported) {
      SS.cancel();
      setSpeechStatus("idle");
    }
  }, [isSupported]);

  useEffect(
    () => () => {
      if (isSupported) SS.cancel();
    },
    [isSupported],
  );

  return {
    isSupported,
    enabled,
    toggleEnabled,
    autoSpeak,
    replay,
    stopSpeech,
    resetSession,
    speechStatus,
    selectedVoiceName,
  };
}
