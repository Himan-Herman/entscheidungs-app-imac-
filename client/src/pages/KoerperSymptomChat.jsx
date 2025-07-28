// src/pages/KoerperSymptomChat.jsx

import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";


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
    <div className="koerpersymptom-container">
      <h2>Körpersymptom beschreiben</h2>

      <div className="eingabe-box">
        <input
          type="text"
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          placeholder="Beschreibe dein Symptom hier..."
        />
        <button onClick={frageSenden} disabled={ladeStatus}>Frage senden</button>
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
