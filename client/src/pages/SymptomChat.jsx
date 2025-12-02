import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/SymptomChat.css";
import { getOrganPrompt } from "./prompt/organPrompts";
import { getAuthHeaders } from "../api/authHeaders";
import DisclaimerShort from "../components/DisclaimerShort";

export default function SymptomChat() {
  const [eingabe, setEingabe] = useState('');
  const [ladeStatus, setLadeStatus] = useState(false);
  const [verlauf, setVerlauf] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [searchParams] = useSearchParams();
  const organ = searchParams.get("organ");

  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [verlauf]);

  // Verlauf & Thread-ID aus LocalStorage laden
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
       {
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

  // Organ-Prompt nur setzen, wenn kein Verlauf vorhanden
  useEffect(() => {
    if (organ && verlauf.length === 0) {
      const prompt = getOrganPrompt(organ);
      const ersteAntwort = { role: "assistant", content: prompt };
      setVerlauf([ersteAntwort]);
    }
  }, [organ, verlauf.length]);

  const frageSenden = async () => {
    if (!eingabe.trim()) return;

    const aktuelleFrage = eingabe;
    const neueFrage = { role: "user", content: aktuelleFrage };
    const neuerVerlauf = [...verlauf, neueFrage];

    setVerlauf([...neuerVerlauf, { role: "assistant", content: "🕒" }]);
    setEingabe('');
    setLadeStatus(true);

    try {
      const response = await fetch("/api/textsymptom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),          // 🔐 Token kommt hier rein
        },
        body: JSON.stringify({ verlauf: neuerVerlauf, threadId }),
      });
      

      const data = await response.json();

      // Thread-ID speichern (falls Backend sie liefert)
      if (data.threadId) {
        setThreadId(data.threadId);
        localStorage.setItem("symptomThreadId", data.threadId);
      }

      const verlaufOhneLadeanzeige = [...neuerVerlauf];
      verlaufOhneLadeanzeige.push({ role: "assistant", content: data.antwort });
      setVerlauf(verlaufOhneLadeanzeige);

    } catch (error) {
      console.error("Fehler bei der KI-Antwort:", error);
      const verlaufMitFehler = [...neuerVerlauf];
      verlaufMitFehler.push({ role: "assistant", content: "⚠️ Fehler bei der Antwort." });
      setVerlauf(verlaufMitFehler);
    }

    setLadeStatus(false);
  };

  const resetChat = () => {
    setVerlauf([]);
    setThreadId(null);
    localStorage.removeItem("symptomVerlauf");
    localStorage.removeItem("symptomThreadId");
  };

  return (
    <div className="symptom-container">
      <DisclaimerShort />
      <h2>Symptom beschreiben</h2>
      <button className="reset-btn" onClick={resetChat}> 🔄 Neues Gespräch</button>

      <div className="chatverlauf">
        {verlauf.map((nachricht, index) => (
          <div
            key={index}
            className={nachricht.role === "user" ? "nachricht user" : "nachricht assistant"}
          >
            <strong>{nachricht.role === "user" ? "👤 Du:" : "🩺 Meda:"}</strong>
            <p>{nachricht.content}</p>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="eingabe-bereich">
      <input
  type="text"
  placeholder="Beschreibe dein Symptom hier..."
  value={eingabe}
  onChange={(e) => setEingabe(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      frageSenden();
    }
  }}
/>

        <button onClick={frageSenden} disabled={ladeStatus}>Senden</button>
      </div>
    </div>
  );
}
