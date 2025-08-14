// src/pages/BildanalyseThread.jsx
import React, { useEffect, useRef, useState } from "react";
import "../styles/BildUpload.css"; // nutzt deine vorhandenen Styles

// 🔧 Bild verkleinern (max 512px) und als Base64 (Data-URL) ausgeben
async function resizeImageToBase64(file, maxSize = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement("canvas");
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

export default function BildanalyseThread() {
  const [bild, setBild] = useState(null);            // Vorschau-URL
  const [base64Bild, setBase64Bild] = useState("");  // Data-URL fürs Backend
  const [beschreibung, setBeschreibung] = useState("");
  const [ladezustand, setLadezustand] = useState(false);
  const [verlauf, setVerlauf] = useState([]);        // [{frage, antwort}]
  const [, setAntwort] = useState("");               // falls du separat anzeigen willst

  const letztesBild = useRef("");                    // merkt letztes gesendetes Bild
  const LS_BILD_THREAD = "bildThreadId";

  // ▶️ Beim ersten Mount: Thread erzeugen (falls keiner existiert)
  useEffect(() => {
    const init = async () => {
      const existing = localStorage.getItem(LS_BILD_THREAD);
      if (!existing) {
        try {
          const r = await fetch("/api/bildanalyse-thread/start", { method: "POST" });
          const d = await r.json();
          if (d.threadId) localStorage.setItem(LS_BILD_THREAD, d.threadId);
        } catch (e) {
          console.error("[Thread Start] Fehler:", e);
        }
      }
    };
    init();
  }, []);

  const handleBildAuswahl = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBild(URL.createObjectURL(file));
    const base64 = await resizeImageToBase64(file);
    setBase64Bild(base64);
  };

  const handleFrageSenden = async () => {
    if (!beschreibung.trim()) return;
    if (!base64Bild) {
      setAntwort("❗ Bitte lade ein Bild hoch, bevor du analysierst.");
      return;
    }
    setLadezustand(true);

    try {
      const threadId = localStorage.getItem(LS_BILD_THREAD);

      const response = await fetch("/api/bildanalyse-thread/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          prompt: beschreibung,
          base64Bild
        }),
      });

      const data = await response.json();
      if (data.fehler) {
        setAntwort("❌ Fehler bei der Analyse.");
      } else {
        setAntwort(data.antwort);
        setVerlauf((prev) => [
          ...prev,
          { frage: beschreibung, antwort: data.antwort },
        ]);
        setBeschreibung("");
        letztesBild.current = base64Bild; // fürs Frontend-Merken (Server vermeidet Doppelbeschreibung ohnehin)
      }
    } catch (error) {
      console.error("Fehler beim Bild-Thread:", error);
      setAntwort("❌ Fehler bei der Analyse. Bitte erneut versuchen.");
    } finally {
      setLadezustand(false);
    }
  };

  return (
    <div className="bildupload-container">
      <h2>MedScout – Bildanalyse (Thread)</h2>

      {/* Bild-Upload & Vorschau */}
      <div className="bild-upload-bereich">
        <input type="file" accept="image/*" onChange={handleBildAuswahl} />
        {bild && <img src={bild} alt="Vorschau" className="bild-vorschau-klein" />}
      </div>

      {/* Chatverlauf */}
      <div className="chatverlauf">
        {verlauf.map((eintrag, i) => (
          <div key={i}>
            <div className="frage-block"><strong>👤 Du:</strong> {eintrag.frage}</div>
            <div className="antwort-block">
              <strong>🩺 Medo:</strong>{" "}
              <span dangerouslySetInnerHTML={{ __html: eintrag.antwort }} />
            </div>
          </div>
        ))}
      </div>

      {ladezustand && <p>⏳ Analyse läuft...</p>}

      {/* Eingabezeile */}
      {bild && (
        <div className="eingabe-bereich">
          <textarea
            placeholder="Beschreibe das Bild oder stelle eine Frage dazu..."
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
          />
          <button onClick={handleFrageSenden}>Senden</button>
        </div>
      )}
    </div>
  );
}
