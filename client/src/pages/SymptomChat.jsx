import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/SymptomChat.css";
import { getOrganPrompt } from "./prompt/organPrompts";

export default function SymptomChat() {
    const [eingabe, setEingabe] = useState('');

  const [ladeStatus, setLadeStatus] = useState(false);
  const [verlauf, setVerlauf] = useState([]);
  const [searchParams] = useSearchParams();
  const organ = searchParams.get("organ");

  useEffect(() => {
    if (organ) {
      const prompt = getOrganPrompt(organ);
      const ersteAntwort = { role: "assistant", content: prompt };
      setVerlauf([ersteAntwort]);
    }
  }, [organ]); 

  const frageSenden = async () => {
    if (!eingabe.trim()) return;
  
    const aktuelleFrage = eingabe;
    const neueFrage = { role: "user", content: aktuelleFrage };
    const neuerVerlauf = [...verlauf, neueFrage];
    setVerlauf(neuerVerlauf);
    setEingabe('');
    setLadeStatus(true);
  
    try {
      const response = await fetch("/api/textsymptom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: aktuelleFrage }), 
        });
  
      const data = await response.json();
  
      setVerlauf([...neuerVerlauf, { role: "assistant", content: data.antwort }]);
    } catch (error) {
      console.error("Fehler bei der KI-Antwort:", error);
      setVerlauf([...neuerVerlauf, { role: "assistant", content: "⚠️ Fehler bei der Antwort." }]);
    }
  
    setLadeStatus(false);
  };
  
  
  return (
    <div className="symptomchat-container">
      <h2>Symptom beschreiben</h2>

      <div className="eingabe-box">
      <input
  type="text"
  value={eingabe}
  onChange={(e) => setEingabe(e.target.value)}
  placeholder="Beschreibe dein Symptom..."
/>


        <button onClick={frageSenden} disabled={ladeStatus}>
          Frage senden
        </button>
      </div>

      <div className="chatverlauf">
        {verlauf.map((eintrag, index) => (
          <div
            key={index}
            className={`chat-bubble ${eintrag.role === "user" ? "user" : "assistant"}`}
          >
            <strong>{eintrag.role === "user" ? "👤 Du:" : "🩺 Medo:"}</strong>
            <div dangerouslySetInnerHTML={{ __html: eintrag.content }} />
          </div>
        ))}

        {ladeStatus && (
          <div className="lade-spinner">
            <div className="spinner"></div>
            <p>Moment …</p>
          </div>
        )}
      </div>
    </div>
  );
}
