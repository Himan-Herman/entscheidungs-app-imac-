import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/SymptomChat.css";
import { getOrganPrompt } from "./prompt/organPrompts";
// in SymptomChat.jsx
import VoiceInput from "../components/VoiceInput.jsx";
import { FaPaperPlane } from "react-icons/fa";


export default function SymptomChat() {
  const [eingabe, setEingabe] = useState("");
  const [ladeStatus, setLadeStatus] = useState(false);
  const [verlauf, setVerlauf] = useState([]);
  const [threadId, setThreadId] = useState(null);

  const [searchParams] = useSearchParams();
  const organ = searchParams.get("organ");

  const chatEndRef = useRef(null);
  const MAX_CHARS = 200;
  const autoResize = (el) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px"; // bis ~6 Zeilen
  };
  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Beim Ändern des Verlaufs automatisch nach unten scrollen
  useEffect(() => {
    scrollToBottom();
  }, [verlauf]);

  // Verlauf & Thread-ID aus LocalStorage laden (beim Mount)
  useEffect(() => {
    const gespeicherterVerlauf = localStorage.getItem("symptomVerlauf");
    const gespeicherteThreadId = localStorage.getItem("symptomThreadId");

    if (gespeicherterVerlauf) {
      try {
        const parsed = JSON.parse(gespeicherterVerlauf);
        if (Array.isArray(parsed)) setVerlauf(parsed);
      } catch {
        localStorage.removeItem("symptomVerlauf");
      }
    }

    if (
      gespeicherteThreadId &&
      gespeicherteThreadId !== "null" &&
      gespeicherteThreadId !== "undefined" &&
      gespeicherteThreadId.trim() !== ""
    ) {
      setThreadId(gespeicherteThreadId);
    } else {
      localStorage.removeItem("symptomThreadId");
    }
  }, []);

  // Verlauf speichern
  useEffect(() => {
    localStorage.setItem("symptomVerlauf", JSON.stringify(verlauf));
  }, [verlauf]);

  // Organ-Prompt nur setzen, wenn noch kein Verlauf vorhanden
  useEffect(() => {
    if (organ && verlauf.length === 0) {
      const prompt = getOrganPrompt(organ);
      const ersteAntwort = { role: "assistant", content: prompt };
      setVerlauf([ersteAntwort]);
    }
  }, [organ, verlauf.length]);

  // Frage senden – akzeptiert optionalen Text (z. B. von VoiceInput)
  const frageSenden = async (textOverride) => {
    const aktuelleFrage = (textOverride ?? eingabe).trim();
    if (!aktuelleFrage) return;

    const neueFrage = { role: "user", content: aktuelleFrage };
    const neuerVerlauf = [...verlauf, neueFrage];

    // Platzhalter für "denkt..."
    setVerlauf([...neuerVerlauf, { role: "assistant", content: "🕒" }]);
    setEingabe("");
    setLadeStatus(true);

    try {
      const response = await fetch("/api/symptom-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verlauf: neuerVerlauf, threadId }),
      });

      const data = await response.json();

      // Thread-ID speichern (falls geliefert)
      if (data.threadId) {
        setThreadId(data.threadId);
        localStorage.setItem("symptomThreadId", data.threadId);
      }

      // Ladeanzeige ersetzen durch echte Antwort
      setVerlauf([...neuerVerlauf, { role: "assistant", content: data.antwort }]);
    } catch (error) {
      console.error("Fehler bei der KI-Antwort:", error);
      setVerlauf([...neuerVerlauf, { role: "assistant", content: "⚠️ Fehler bei der Antwort." }]);
    } finally {
      setLadeStatus(false);
    }
  };

  const resetChat = () => {
    setVerlauf([]);
    setThreadId(null);
    localStorage.removeItem("symptomVerlauf");
    localStorage.removeItem("symptomThreadId");
  };

 
  const handleVoice = (text) => {
   
    setEingabe(text);
    
    frageSenden(text);
  };


  return (
    <div className="symptom-chat-container">
      <h2>Symptom beschreiben</h2>
      <button className="reset-btn" onClick={resetChat}>🔄 Neustart</button>
  
      <div className="chatverlauf">
        {verlauf.map((nachricht, index) => (
          <div
            key={index}
            className={nachricht.role === "user" ? "nachricht user" : "nachricht assistant"}
          >
            <strong>{nachricht.role === "user" ? "👤 Du:" : "🩺 Medo:"}</strong>
            <p>{nachricht.content}</p>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
  
      <div className="eingabe-bereich">
  {/* nur das Textfeld */}
  <textarea
    placeholder="Beschreibe dein Symptom hier..."
    value={eingabe}
    maxLength={MAX_CHARS}
    rows={1}
    onChange={(e) => setEingabe(e.target.value)}
    onInput={(e) => autoResize(e.target)}
    onKeyDown={(e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        frageSenden();
      }
    }}
    className="chat-textarea"
  />

  {/* Aktionsleiste: Counter  →  Mic  →  Senden */}
  <div className="eingabe-actions">
  <span className={`char-count ${eingabe.length >= MAX_CHARS ? "limit" : ""}`}>
    {eingabe.length}/{MAX_CHARS}
  </span>

  {/* feste Hülle um VoiceInput */}
  <div className="voice-wrap">
    <VoiceInput onTranscribed={handleVoice} />
  </div>

  <button className="send-btn" onClick={frageSenden} disabled={ladeStatus}>
  <FaPaperPlane />
</button>

</div>

</div>


  
    </div>
  );
}  