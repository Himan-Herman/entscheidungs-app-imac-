import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/SymptomChat.css";
import { getOrganPrompt } from "./prompt/organPrompts";

export default function SymptomChat() {
  const [eingabe, setEingabe] = useState('');
  const [ladeStatus, setLadeStatus] = useState(false);
  const [verlauf, setVerlauf] = useState([]);
  const [searchParams] = useSearchParams();
  const organ = searchParams.get("organ");

  // ✅ Ref für Scrollbereich
  const chatEndRef = useRef(null);

  // ✅ Scroll-Funktion
  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // ✅ Immer scrollen, wenn Verlauf sich ändert
  useEffect(() => {
    scrollToBottom();
  }, [verlauf]);

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
    setVerlauf([
  ...neuerVerlauf,
  { role: "assistant", content: "🕒 Antwort wird geladen..." } // ⏳ Ladeanzeige
]);

    setEingabe('');
    setLadeStatus(true);

    try {
      const response = await fetch("/api/textsymptom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verlauf: neuerVerlauf }), // ✅ Verlauf wird übergeben
      });

      const data = await response.json();
      // Entferne die letzte (Lade-)Nachricht und ersetze durch echte Antwort
const verlaufOhneLadeanzeige = [...neuerVerlauf]; // nur echte Nachrichten
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

  return (
    <div className="symptom-chat-container">
      <h2>Symptom beschreiben</h2>

      {/* Chatverlauf */}
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
        {/* ✅ Scroll-Ziel */}
        <div ref={chatEndRef} />
      </div>

      {/* Eingabefeld */}
      <div className="eingabe-bereich">
        <input
          type="text"
          placeholder="Beschreibe dein Symptom..."
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
        />
        <button onClick={frageSenden}>Senden</button>
      </div>
    </div>
  );
}
