import { useCallback, useEffect, useRef, useState } from "react";

const SS =
  typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;

/**
 * Web Speech Synthesis output for translated text (en-US).
 *
 * Loop guard: SpeechRecognition is set to de-DE; English TTS output is not
 * recognised as German input, so no feedback loop can form regardless of
 * speaker/microphone setup.
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
    (text) => {
      if (!isSupported || !text) return;
      SS.cancel();
      setSpeechStatus("speaking");
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "en-US";
      utt.rate = 0.95;
      utt.onend = () => setSpeechStatus("idle");
      utt.onerror = () => setSpeechStatus("idle");
      SS.speak(utt);
    },
    [isSupported],
  );

  const autoSpeak = useCallback(
    (text) => {
      if (!isSupported || !enabled || !text) return;
      if (text === lastAutoSpokenRef.current) return;
      lastAutoSpokenRef.current = text;
      _doSpeak(text);
    },
    [isSupported, enabled, _doSpeak],
  );

  const replay = useCallback(
    (text) => {
      if (!isSupported || !text) return;
      _doSpeak(text);
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
