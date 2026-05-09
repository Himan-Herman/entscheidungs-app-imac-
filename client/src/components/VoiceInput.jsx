import React, { useState, useRef, useId } from "react";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import { authFetch } from "../api/authFetch";
import { useLanguage } from "../i18n/LanguageContext";

export default function VoiceInput({ onTranscribed, notice, labels, className }) {
  const [isRecording, setIsRecording] = useState(false);
  const [, setStatus] = useState("");
  const [, setAudioURL] = useState(null);
  const { language } = useLanguage();
  const defaults =
    language === "en"
      ? {
          micError: "Microphone unavailable.",
          transcriptionError: "Transcription failed.",
          start: "Start voice input",
          stop: "Stop voice input",
        }
      : {
          micError: "Mikrofon nicht verfügbar.",
          transcriptionError: "Transkription fehlgeschlagen.",
          start: "Spracheingabe starten",
          stop: "Spracheingabe stoppen",
        };
  const copy = { ...defaults, ...labels };

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);
  const mimeRef = useRef("audio/webm");
  const noticeId = useId();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const preferred = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm";

      mimeRef.current = preferred.startsWith("audio/ogg") ? "audio/ogg" : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType: preferred });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setAudioURL(null);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        setAudioURL(URL.createObjectURL(blob));
        await sendToServer(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus("");

      stopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecording();
        }
      }, 60000);
    } catch (err) {
      console.error("Mic-Fehler:", err);
      setStatus(`❌ ${copy.micError}`);
    }
  };

  const stopRecording = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
      setStatus("");
    }
  };

  const sendToServer = async (blob) => {
    try {
      const formData = new FormData();
      const filename = mimeRef.current === "audio/ogg" ? "aufnahme.ogg" : "aufnahme.webm";
      formData.append("audio", blob, filename);

      const res = await authFetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Fehler: ${res.status}`);

      const data = await res.json();
      onTranscribed?.(data.text || "", data.language || "");
    } catch (err) {
      console.error("Transkriptionsfehler:", err);
      setStatus(`❌ ${copy.transcriptionError}`);
    }
  };

  return (
    <div className={className || undefined} style={className ? undefined : { marginTop: "1rem" }}>
      {notice ? (
        <p className="voice-input__notice" id={noticeId}>
          {notice}
        </p>
      ) : null}
      <button
        type="button"
        className="voice-btn"
        onClick={isRecording ? stopRecording : startRecording}
        aria-label={isRecording ? copy.stop : copy.start}
        title={isRecording ? copy.stop : copy.start}
        aria-describedby={notice ? noticeId : undefined}
      >
        {isRecording ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
      </button>
    </div>
  );
}
