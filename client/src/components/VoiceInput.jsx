import React, { useState, useRef } from "react";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";

export default function VoiceInput({ onTranscribed }) {
  const [isRecording, setIsRecording] = useState(false);
  const [, setStatus] = useState("");
  const [, setAudioURL] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);
  const mimeRef = useRef("audio/webm"); 


  // --- Aufnahme starten ---
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
        // Blob bauen
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        setAudioURL(URL.createObjectURL(blob));
        // direkt senden
        await sendToServer(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus(" ");

      // Auto-Stop nach 60s (dein Limit)
      stopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          stopRecording(); 
        }
      }, 60_000);
    } catch (err) {
      console.error("Mic-Fehler:", err);
      setStatus("❌ Mikrofon nicht verfügbar.");
    }
  };

  // --- Aufnahme stoppen  ---
  const stopRecording = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
      setStatus("");
    }
  };

  // --- Upload + Transkription ---
  const sendToServer = async (blob) => {
    try {
      const formData = new FormData();
      const filename = mimeRef.current === "audio/ogg" ? "aufnahme.ogg" : "aufnahme.webm";
      formData.append("audio", blob, filename);
      

      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Fehler: ${res.status}`);
      const data = await res.json();

      setStatus("");
      if (data?.text && onTranscribed) onTranscribed(data.text, data.language || "");
    } catch (err) {
      console.error("Transkriptionsfehler:", err);
      setStatus("❌ Transkription fehlgeschlagen");
    }
  };

  return (
    <div style={{ marginTop: "1rem" }}>
     <button
  type="button"
  className="mic-button"
  onClick={isRecording ? stopRecording : startRecording}
>
  {isRecording ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
</button>
    </div>
  );
}
