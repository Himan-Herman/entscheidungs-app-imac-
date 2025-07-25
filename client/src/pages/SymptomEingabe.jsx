import React, { useState } from "react";
import "../styles/SymptomEingabe.css";

export default function SymptomEingabe() {
  const [symptom, setSymptom] = useState("");
  const [ladezustand, setLadezustand] = useState(false);
  const [verlauf, setVerlauf] = useState([]);

  const handleSenden = async () => {
    if (!symptom.trim()) {
        alert("Bitte gib ein Symptom ein.");
        return;
      }
    setLadezustand(true);
    

    try {
        const response = await fetch("/api/textsymptom", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: symptom }), 
          });
          
      const data = await response.json();

      setVerlauf((prev) => [
        ...prev,
        { frage: symptom, antwort: data.antwort },
      ]);
      setSymptom("");
    } catch (error) {
      console.error("Fehler bei der Symptomanalyse:", error);
      setVerlauf((prev) => [
        ...prev,
        {
          frage: symptom,
          antwort: "❌ Fehler bei der Analyse. Bitte erneut versuchen.",
        },
      ]);
    } finally {
      setLadezustand(false);
    }
  };

  return (
    <div className="symptom-container">
      <h2>Symptom beschreiben</h2>

      <textarea
        placeholder="Beschreibe dein Symptom so genau wie möglich..."
        value={symptom}
        onChange={(e) => setSymptom(e.target.value)}
      ></textarea>

      <button onClick={handleSenden}>Analyse starten</button>

      {ladezustand && <p>⏳ Analyse läuft...</p>}

      {verlauf.map((eintrag, index) => (
        <div key={index}>
          <div className="frage-block">
            <strong>👤 Du:</strong> {eintrag.frage}
          </div>
          <div className="antwort-block">
            <strong>🩺 Medo:</strong>{" "}
            <span dangerouslySetInnerHTML={{ __html: eintrag.antwort }} />
          </div>
        </div>
      ))}
    </div>
  );
}
