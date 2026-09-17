import React, { useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { authFetch } from "../api/authFetch";
import { isSymptomVoiceOutputAvailable } from "../api/voiceFeatureAvailability.js";

export default function SpeakButton({ text, className = "", ariaLabel = "" }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.common ?? getMessages("en").common;
  }, [language]);

  /*
   * Whether this deployment has read-aloud switched on.
   *
   * Starts available so nothing flickers away on a fast connection. When it is
   * off the button is not rendered at all — a speaker icon that fails when
   * pressed looks exactly like a defect.
   */
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    let cancelled = false;
    isSymptomVoiceOutputAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const releaseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => () => releaseAudio(), []);

  const handleClick = async () => {
    if (isPlaying) return;

    try {
      setIsPlaying(true);

      // The session travels with the request: the endpoint requires one since
      // the read-aloud path was taken off the shared provider key.
      const response = await authFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("TTS response not OK: " + response.status);
      }

      // The endpoint returns the audio itself, labelled by the server. Nothing
      // is parsed out of a JSON envelope and no provider metadata comes back.
      const blob = await response.blob();
      releaseAudio();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        releaseAudio();
        setIsPlaying(false);
      };

      audio.onerror = () => {
        releaseAudio();
        setIsPlaying(false);
      };

      await audio.play();
    } catch {
      releaseAudio();
      setIsPlaying(false);
    }
  };

  if (!available) return null;

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
