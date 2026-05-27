import { useCallback, useEffect, useRef, useState } from "react";

const LANG_MAP = {
  de: "de-DE",
  en: "en-US",
  es: "es-ES",
  it: "it-IT",
  fr: "fr-FR",
};

const SR = (typeof window !== "undefined")
  ? (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
  : null;

/**
 * Local browser transcription via SpeechRecognition.
 * No server, no API costs.
 * isSupported is false on Firefox — caller shows a fallback message.
 */
export function useLocalTranscription() {
  const isSupported = SR !== null;

  const [lines, setLines] = useState(/** @type {string[]} */ ([]));
  const recRef    = useRef(/** @type {InstanceType<typeof SR>|null} */ (null));
  const activeRef = useRef(false);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
    }
  }, []);

  const start = useCallback((language) => {
    if (!SR) return;

    // stop any previous instance first
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
    }

    activeRef.current = true;
    setLines([]);

    const rec = new SR();
    rec.lang = LANG_MAP[language] ?? "de-DE";
    rec.continuous = true;
    rec.interimResults = false;
    recRef.current = rec;

    rec.onresult = (e) => {
      const newLines = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          if (text) newLines.push(text);
        }
      }
      if (newLines.length > 0) {
        setLines((prev) => [...prev, ...newLines]);
      }
    };

    rec.onerror = (e) => {
      // "no-speech" is normal silence — not a real error
      if (e.error === "no-speech") return;
      activeRef.current = false;
    };

    rec.onend = () => {
      // If still active and this is the current instance, restart
      if (activeRef.current && recRef.current === rec) {
        try { rec.start(); } catch { /* browser may throw if already started */ }
      }
    };

    try { rec.start(); } catch { /* ignore start errors */ }
  }, []);

  const clear = useCallback(() => setLines([]), []);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return { isSupported, lines, start, stop, clear };
}
