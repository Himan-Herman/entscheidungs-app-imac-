import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reading a message aloud, on the device.
 *
 * ── Why nothing leaves the browser ──────────────────────────────────────────
 * The text is already on the reader's screen: they are authorized to see it,
 * and it has already been through whatever authorization put it there. Speaking
 * it locally means it does not have to travel anywhere a second time, there is
 * no provider to approve, no recording to retain, and no audio to cache. That
 * is a smaller feature than a cloud voice, and a much smaller promise to keep.
 *
 * The cost is honest: the available voices are whatever the device has. The
 * interface therefore offers "read aloud" and never a particular voice.
 *
 * ── One utterance at a time ─────────────────────────────────────────────────
 * The engine is global to the page, so this tracks a single "what is speaking"
 * rather than a flag per message. Starting a second message stops the first,
 * which is both what the browser does and what a listener expects.
 */
export function useMessageSpeech() {
  const [speaking, setSpeaking] = useState({ messageId: null, source: null });
  const utteranceRef = useRef(null);

  const supported =
    typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  const stop = useCallback(() => {
    if (!supported) return;
    // The handlers are detached first: cancel() fires `onend`, and letting it
    // run would race with whatever is starting next.
    const utterance = utteranceRef.current;
    utteranceRef.current = null;
    if (utterance) {
      utterance.onend = null;
      utterance.onerror = null;
    }
    window.speechSynthesis.cancel();
    setSpeaking({ messageId: null, source: null });
  }, [supported]);

  /**
   * Leaving the page — or switching practice, which unmounts this — stops the
   * voice. A message being read aloud after the reader has moved to another
   * conversation would be that conversation's content spoken over this one.
   */
  useEffect(() => stop, [stop]);

  const speak = useCallback(
    ({ messageId, source, text, lang }) => {
      if (!supported || !text) return;
      stop();

      const utterance = new SpeechSynthesisUtterance(text);
      // Stated when it is known, left alone when it is not: telling the engine
      // a language the text is not in produces a confident mispronunciation.
      if (lang) utterance.lang = lang;
      utterance.onend = () => {
        utteranceRef.current = null;
        setSpeaking({ messageId: null, source: null });
      };
      utterance.onerror = () => {
        utteranceRef.current = null;
        setSpeaking({ messageId: null, source: null });
      };

      utteranceRef.current = utterance;
      setSpeaking({ messageId, source });
      window.speechSynthesis.speak(utterance);
    },
    [stop, supported],
  );

  return { supported, speaking, speak, stop };
}
