import React, { useState, useRef } from "react";
import "../styles/BildUpload.css";

// ✅ Bild verkleinern (max 512x512 px) und in Base64 umwandeln
async function resizeImageToBase64(file, maxSize = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL("image/jpeg", 0.8);
        resolve(base64);
      };

      img.onerror = reject;
      img.src = e.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BildUpload() {
  const [bild, setBild] = useState(null);
  const [beschreibung, setBeschreibung] = useState("");
  const [base64Bild, setBase64Bild] = useState("");
  const [antwort, setAntwort] = useState("");
  const [ladezustand, setLadezustand] = useState(false);
  const [verlauf, setVerlauf] = useState([]);

  const letztesBild = useRef(""); // 👈 merkt sich das letzte gesendete Bild

  const handleBildAuswahl = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setBild(URL.createObjectURL(file));
      const base64 = await resizeImageToBase64(file);
      setBase64Bild(base64);
    }
  };

  const handleFrageSenden = async () => {
    if (!beschreibung.trim()) return;

    if (!base64Bild) {
      setAntwort("❗ Bitte lade ein Bild hoch, bevor du analysierst.");
      setLadezustand(false);
      return;
    }

    setLadezustand(true);

    try {
      const response = await fetch("/api/symptom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: beschreibung,
          base64Bild: base64Bild,
        }),
      });

      const data = await response.json();

      setAntwort(data.antwort);
      setVerlauf((prev) => [
        ...prev,
        { frage: beschreibung, antwort: data.antwort },
      ]);
      setBeschreibung(""); // Eingabe leeren
      letztesBild.current = base64Bild; // 🔁 aktuelles Bild merken
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
      <img src={bild} alt="Vorschau" className="bild-vorschau-klein" />
    )}

    {/* Verlauf zuerst */}
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

    {ladezustand && <p>⏳ Analyse läuft...</p>}

    {/* Eingabefeld + Button ganz unten */}
    {bild && (
      <>
        <textarea
          placeholder="Beschreibe das Bild oder stelle eine Frage dazu..."
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
        ></textarea>

        <button onClick={handleFrageSenden}>Senden</button>
      </>
    )}
  </div>
)};
