import React, { useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";

export default function SpeakButton({ text, className = "", ariaLabel = "" }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.common ?? getMessages("en").common;
  }, [language]);

  const handleClick = async () => {
    if (isPlaying) return;

    try {
      setIsPlaying(true);

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("TTS response not OK: " + response.status);
      }

      const data = await response.json();
      const audioBase64 = data.audio;

      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
      };

      audio.play();
    } catch {
      setIsPlaying(false);
    }
  };

  const label = ariaLabel || t.speakReadAloud;

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isPlaying}
      className={`${className} ${isPlaying ? "tts-disabled" : ""}`.trim()}
      aria-label={label}
      aria-busy={isPlaying ? "true" : undefined}
      title={isPlaying ? t.speakPlayingTitle : t.speakListenTitle}
    >
      <Volume2 size={16} aria-hidden="true" />
    </button>
  );
}
