import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/SymptomChat.css";
import { getOrganPrompt } from "./prompt/organPrompts";

import VoiceInput from "../components/VoiceInput.jsx";
import { FaPaperPlane } from "react-icons/fa";
import { apiFetch } from "../lib/api";

export default function SymptomChat() {
  const [eingabe, setEingabe] = useState("");
  const [ladeStatus, setLadeStatus] = useState(false);
  const [verlauf, setVerlauf] = useState([]);
  const [threadId, setThreadId] = useState(null);

  const [searchParams] = useSearchParams();
  const organ = searchParams.get("organ");

  const chatEndRef = useRef(null);
  const MAX_CHARS = 150;
  const autoResize = (el) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px"; 
  };
  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };


  useEffect(() => {
    scrollToBottom();
  }, [verlauf]);

  
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

  
  useEffect(() => {
    localStorage.setItem("symptomVerlauf", JSON.stringify(verlauf));
  }, [verlauf]);


  useEffect(() => {
    if (organ && verlauf.length === 0) {
      const prompt = getOrganPrompt(organ);
      const ersteAntwort = { role: "assistant", content: prompt };
      setVerlauf([ersteAntwort]);
    }
  }, [organ, verlauf.length]);

  
  const frageSenden = async (textOverride) => {
    const raw =
     typeof textOverride === "string"
       ? textOverride
       : eingabe; // Fallback auf State
   const aktuelleFrage = (raw || "").trim();
    if (!aktuelleFrage) return;

    const neueFrage = { role: "user", content: aktuelleFrage };
    const neuerVerlauf = [...verlauf, neueFrage];

    
    setVerlauf([...neuerVerlauf, { role: "assistant", content: "🕒" }]);
    setEingabe("");
    setLadeStatus(true);

    try {
      const response = await apiFetch("/api/symptom-thread", {
        method: "POST",
        body: JSON.stringify({
          verlauf: neuerVerlauf,
          threadId,
        }),
      });

      const data = await response.json();

      
      if (data.threadId) {
        setThreadId(data.threadId);
        localStorage.setItem("symptomThreadId", data.threadId);
      }

      
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

 
 // oben einen Ref fürs Textfeld anlegen:
const inputRef = useRef(null);

// ...

const handleVoice = (text) => {
  setEingabe(text || "");
  // nach dem Setzen kurz fokussieren, damit man direkt editiert:
  requestAnimationFrame(() => inputRef.current?.focus());
};



  return (
    <div className="chat-header">
    <h2>Symptom beschreiben</h2>
    <button className="reset-btn" onClick={resetChat}>↻ Neues Gespräch</button>

  
  
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
  ref={inputRef}
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

  
  <div className="eingabe-actions">
  <span className={`char-count ${eingabe.length >= MAX_CHARS ? "limit" : ""}`}>
    {eingabe.length}/{MAX_CHARS}
  </span>

  
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