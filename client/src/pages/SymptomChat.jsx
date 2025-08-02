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
  <div className="symptom-chat-container">
    <h2>Symptom beschreiben</h2>

    {/* Chatverlauf zuerst */}
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
    </div>

    {/* Eingabe + Button darunter */}
    <div className="eingabe-bereich">
      <input
        type="text"
        placeholder="Beschreibe dein Symptom..."
        value={eingabe}
        onChange={(e) => setEingabe(e.target.value)}
      />
      <button onClick={frageSenden}>Frage senden</button>
    </div>
  </div>
)};
