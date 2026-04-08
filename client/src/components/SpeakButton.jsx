import React, { useState, useRef } from "react";
import { Volume2 } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

export default function SpeakButton({ text, className = "", ariaLabel = "" }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const { language } = useLanguage();
  const fallbackAriaLabel = language === "en" ? "Read answer aloud" : "Antwort vorlesen";
  const idleTitle = language === "en" ? "Listen to answer" : "Antwort anhören";
  const busyTitle = language === "en" ? "Audio is playing..." : "Audio läuft...";

  const handleClick = async () => {
    // Wenn bereits am Abspielen → blockieren
    if (isPlaying) return;

    try {
      setIsPlaying(true); // 🔒 Button sperren

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Fehlerhafte Antwort: " + response.status);
      }

      const data = await response.json();
      const audioBase64 = data.audio;

      // Base64 → spielbares Audio
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audioRef.current = audio;

      // 🔓 Button erst wieder freigeben wenn Audio fertig ist
      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        console.error("Audio konnte nicht abgespielt werden.");
        setIsPlaying(false);
      };

      audio.play();
    } catch (err) {
      console.error("TTS Fehler:", err);
      setIsPlaying(false); // Sicherheitshalber wieder freigeben
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPlaying}     // ← verhindert erneuten Klick
      className={`${className} ${isPlaying ? "tts-disabled" : ""}`}
      aria-label={ariaLabel || fallbackAriaLabel}
      title={isPlaying ? busyTitle : idleTitle}
    >
      <Volume2 size={16} aria-hidden="true" />
    </button>
  );
}
