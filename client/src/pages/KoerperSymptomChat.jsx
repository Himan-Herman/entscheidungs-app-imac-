// src/pages/KoerperSymptomChat.jsx

import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/KoerperSymptomChat.css";

export default function KoerperSymptomChat() {
  const [eingabe, setEingabe] = useState('');
  const [verlauf, setVerlauf] = useState([]);
  const [ladeStatus, setLadeStatus] = useState(false);
  const [searchParams] = useSearchParams();
  const organ = searchParams.get("organ");

  useEffect(() => {
    if (organ) {
      const ersteFrage = {
        role: "assistant",
        content: `Du hast "${organ}" als betroffene Region gewählt. Kannst du bitte beschreiben, was genau du dort spürst?`,
      };
      setVerlauf([ersteFrage]);
    }
  }, [organ]);

  const frageSenden = async () => {
    if (!eingabe.trim()) return;

    const neueFrage = { role: "user", content: eingabe };
    const neuerVerlauf = [...verlauf, neueFrage];
    setVerlauf(neuerVerlauf);
    setEingabe('');
    setLadeStatus(true);

    try {
      const response = await fetch("/api/koerpersymptom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verlauf: neuerVerlauf }),
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
    <h2>Körpersymptom beschreiben</h2>

    {/* Verlauf oben */}
    <div className="chatverlauf">
      {verlauf.map((nachricht, index) => (
        <div
          key={index}
          className={`chat-bubble ${nachricht.role === "user" ? "user" : "assistant"}`}
        >
          <strong>
            {nachricht.role === "user" ? "👤 Du:" : "🩺 Medo:"}
          </strong>
          <p>{nachricht.content}</p>
        </div>
      ))}
    </div>

    {/* Eingabe unten */}
    <div className="eingabe-bereich">
      <input
        type="text"
        placeholder="Beschreibe dein Symptom hier..."
        value={eingabe}
        onChange={(e) => setEingabe(e.target.value)}
      />
      <button onClick={frageSenden}>Frage senden</button>
    </div>
  </div>
)};
