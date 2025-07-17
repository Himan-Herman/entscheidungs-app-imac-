// src/pages/SymptomChat.jsx
import React, { useState } from "react";
import "../styles/SymptomChat.css";

export default function SymptomChat() {
  const [eingabe, setEingabe] = useState("");
  const [antwort, setAntwort] = useState("");
  const [ladeStatus, setLadeStatus] = useState(false);

  const frageSenden = async () => {
    if (!eingabe.trim()) return;

    setLadeStatus(true);
    setAntwort("Antwort wird geladen...");

    try {
      const res = await fetch("/api/ki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verlauf: [{ role: "user", content: eingabe }] }),
      });

      const data = await res.json();
      setAntwort(data.antwort);
    } catch (error) {
        console.error("Fehler beim Abruf:", error);
        setAntwort("Fehler beim Abrufen der Antwort.");
      }
      

    setLadeStatus(false);
    setEingabe("");
  };

  return (
    <div className="symptomchat-container">
      <h2>Symptom beschreiben</h2>
      <input
        type="text"
        placeholder="z. B. Kopfschmerzen seit gestern"
        value={eingabe}
        onChange={(e) => setEingabe(e.target.value)}
      />
      <button onClick={frageSenden} disabled={ladeStatus}>
        Frage senden
      </button>

      {antwort && (
        <div className="antwort-box">
          <strong>KI-Antwort:</strong>
          <p>{antwort}</p>
        </div>
      )}
    </div>
  );
}
