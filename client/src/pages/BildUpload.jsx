// src/pages/BildUpload.jsx
import React, { useState } from "react";
import "../styles/BildUpload.css";

export default function BildUpload() {
  const [bild, setBild] = useState(null);
  const [beschreibung, setBeschreibung] = useState("");

  const handleBildAuswahl = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBild(URL.createObjectURL(file));
    }
  };

  const handleFrageSenden = () => {
    // Später: Verbindung zur KI-Analyse
    alert(`Frage zur Bildbeschreibung: ${beschreibung}`);
  };

  return (
    <div className="bildupload-container">
      <h2>Bild hochladen & analysieren</h2>

      <input type="file" accept="image/*" onChange={handleBildAuswahl} />

      {bild && <img src={bild} alt="Vorschau" className="bild-vorschau" />}

      <textarea
        placeholder="Beschreibe das Bild oder stelle eine Frage dazu..."
        value={beschreibung}
        onChange={(e) => setBeschreibung(e.target.value)}
      ></textarea>

      <button onClick={handleFrageSenden}>An KI senden</button>
    </div>
  );
}
