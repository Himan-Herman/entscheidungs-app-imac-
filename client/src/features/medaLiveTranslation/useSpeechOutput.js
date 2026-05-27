import { useCallback, useEffect, useRef, useState } from "react";

const SS =
  typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;

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

  const lastAutoSpokenRef = useRef("");

  const _doSpeak = useCallback(
    (text, lang = "en-US") => {
      if (!isSupported || !text) return;
      SS.cancel();
      setSpeechStatus("speaking");
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang;
      utt.rate = 0.95;
      utt.onend = () => setSpeechStatus("idle");
      utt.onerror = () => setSpeechStatus("idle");
      SS.speak(utt);
    },
    [isSupported],
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
  };
}
