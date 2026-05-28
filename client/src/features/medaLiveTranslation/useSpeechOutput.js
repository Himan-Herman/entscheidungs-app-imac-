import { useCallback, useEffect, useRef, useState } from "react";

const SS =
  typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;

/**
 * Preferred voice names per locale prefix, ordered by priority.
 * Only local (non-network) voices are used to avoid silent failures with
 * remote voices that may not have finished loading.
 */
const VOICE_PREFERENCES = {
  "en": ["Samantha", "Karen", "Moira", "Fiona", "Daniel", "Google US English", "Google UK English Female", "Microsoft Zira", "Microsoft David"],
  "de": ["Anna", "Petra", "Markus", "Google Deutsch", "Microsoft Hedda", "Microsoft Stefan"],
};

/**
 * Selects the best available local voice for a BCP-47 lang tag (e.g. "en-US").
 * Returns undefined if no suitable local voice is found — callers must still speak
 * without setting utt.voice (browser default).
 */
function pickVoice(lang) {
  if (!SS) return undefined;
  const voices = SS.getVoices();
  if (voices.length === 0) return undefined;

  const prefix = lang.split("-")[0].toLowerCase();
  const preferred = VOICE_PREFERENCES[prefix] ?? [];

  // Only consider local voices to avoid remote/network voices failing silently
  const localeVoices = voices.filter(
    (v) => v.localService && v.lang.toLowerCase().startsWith(prefix)
  );
  if (localeVoices.length === 0) return undefined;

  for (const name of preferred) {
    const match = localeVoices.find((v) => v.name === name);
    if (match) return match;
  }

  return localeVoices[0];
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

  // Updates voiceRef and schedules a state update for the display label.
  // Kept separate from _doSpeak so that setState never blocks the speak call.
  const _refreshVoice = useCallback((lang) => {
    if (!isSupported) return;
    const v = pickVoice(lang);
    voiceRef.current = v;
    // Decouple state update from TTS path to avoid any re-render side-effects
    queueMicrotask(() => setSelectedVoiceName(v?.name ?? null));
  }, [isSupported]);

  // Re-pick voice when the browser finishes loading voices asynchronously (Chrome)
  useEffect(() => {
    if (!isSupported) return;
    const handle = () => {
      if (lastLangRef.current) _refreshVoice(lastLangRef.current);
    };
    SS.addEventListener("voiceschanged", handle);
    return () => SS.removeEventListener("voiceschanged", handle);
  }, [isSupported, _refreshVoice]);

  const _doSpeak = useCallback(
    (text, lang = "en-US") => {
      if (!isSupported || !text) return;

      // Refresh voice ref when language changes — purely ref/microtask, does not
      // block or re-create this callback.
      if (lang !== lastLangRef.current) {
        lastLangRef.current = lang;
        _refreshVoice(lang);
      }

      SS.cancel();
      setSpeechStatus("speaking");

      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang;

      // Only apply a voice when it is a confirmed local voice whose locale matches.
      // Remote/network voices can fail silently — let the browser pick in that case.
      const voice = voiceRef.current;
      if (
        voice &&
        voice.localService &&
        voice.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase())
      ) {
        utt.voice = voice;
      }

      utt.rate = 0.95;
      utt.pitch = 1.0;
      utt.volume = 1;
      utt.onend = () => setSpeechStatus("idle");
      utt.onerror = () => setSpeechStatus("idle");
      SS.speak(utt);
    },
    [isSupported, _refreshVoice],
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
