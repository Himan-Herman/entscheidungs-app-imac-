import React, { useState } from "react";
import "../styles/BildUpload.css";

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file); 
      reader.onload = () => resolve(reader.result); 
      reader.onerror = (error) => reject(error);
    });
  }
  

export default function BildUpload() {
  const [bild, setBild] = useState(null);
  const [beschreibung, setBeschreibung] = useState("");
  const [base64Bild, setBase64Bild] = useState("");
  const [antwort, setAntwort] = useState("");
  const [ladezustand, setLadezustand] = useState(false);
  const [verlauf, setVerlauf] = useState([]); 

  const handleBildAuswahl = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setBild(URL.createObjectURL(file));
      const base64 = await convertToBase64(file);
      setBase64Bild(base64);
    }
  };

  const handleFrageSenden = async () => {
    if (!beschreibung.trim()) return;

    setLadezustand(true);

    try {
      const response = await fetch("/api/ki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: beschreibung, base64Bild }),
      });

      const data = await response.json();

      setAntwort(data.antwort);
      setVerlauf((prev) => [...prev, { frage: beschreibung, antwort: data.antwort }]);
      setBeschreibung(""); // nach Senden zurücksetzen
    } catch (error) {
      console.error("Fehler beim Bild-Upload:", error);
      setAntwort("❌ Fehler bei der Analyse. Bitte erneut versuchen.");
    } finally {
      setLadezustand(false);
    }
  };

  return (
    <div className="bildupload-container">
      <h2>Bild hochladen & analysieren</h2>

      <input type="file" accept="image/*" onChange={handleBildAuswahl} />

      {bild && (
        <>
          <img src={bild} alt="Vorschau" className="bild-vorschau-klein" />
          <textarea
            placeholder="Beschreibe das Bild oder stelle eine Frage dazu..."
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
          ></textarea>
        </>
      )}

{verlauf.map((eintrag, index) => (
  <div key={index}>
    <div className="frage-block">
      <strong>👤 Du:</strong> {eintrag.frage}
    </div>
    <div className="antwort-block">
      <strong>🩺 Medo:</strong>{' '}
      <span dangerouslySetInnerHTML={{ __html: eintrag.antwort }} />
    </div>
  </div>
))}


      {ladezustand && <p>⏳ Analyse läuft...</p>}

      <button onClick={handleFrageSenden}>Bild analysieren</button>
    </div>
  );
}
