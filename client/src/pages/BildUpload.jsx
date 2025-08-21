import React, { useState, useRef, useEffect } from "react";
import "../styles/BildUpload.css";

// LocalStorage Keys
const LS_VERLAUF_KEY = "bildChatVerlauf";
const LS_BILD_KEY = "letztesBild";
const LS_THREAD_KEY = "bildThreadId"; 


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
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
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
  const [bild, setBild] = useState(null);              // für <img src=…> (Data-URL oder ObjectURL)
  const [beschreibung, setBeschreibung] = useState("");
  const [base64Bild, setBase64Bild] = useState("");    // fürs Backend
  const [, setAntwort] = useState("");
  const [ladezustand, setLadezustand] = useState(false);
  const [verlauf, setVerlauf] = useState([]);

  const letztesBild = useRef("");       // merkt sich das letzte gesendete Bild
  const chatEndRef = useRef(null);      // Scroll-Anker fürs Auto-Scroll
  const clearVerlauf = () => {
    setVerlauf([]);
    try {
      localStorage.setItem(LS_VERLAUF_KEY, JSON.stringify([]));
    } catch (e) {
      console.warn("[BildUpload] Konnte Verlauf nicht leeren:", e);
    }
  };
  
  // 🔄 LocalStorage beim Start laden
  useEffect(() => {
    try {
      const gespeicherterVerlauf = localStorage.getItem(LS_VERLAUF_KEY);
      const gespeichertesBild = localStorage.getItem(LS_BILD_KEY);

      if (gespeicherterVerlauf) setVerlauf(JSON.parse(gespeicherterVerlauf));
      if (gespeichertesBild) {
        setBild(gespeichertesBild);     // Data-URL direkt als Vorschau
        setBase64Bild(gespeichertesBild);
        letztesBild.current = gespeichertesBild;
      }
    } catch (e) {
      console.warn("[BildUpload] Konnte LocalStorage nicht lesen:", e);
    }
  }, []);

  // 📌 Verlauf in LocalStorage speichern, wenn er sich ändert
  useEffect(() => {
    try {
      localStorage.setItem(LS_VERLAUF_KEY, JSON.stringify(verlauf));
    } catch (e) {
      console.warn("[BildUpload] Konnte Verlauf nicht speichern:", e);
    }
  }, [verlauf]);

  // ⬇️ Auto-Scroll ans Ende bei neuer Nachricht
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [verlauf]);

  const handleBildAuswahl = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vorschau per ObjectURL
    const objectURL = URL.createObjectURL(file);
    setBild(objectURL);

    // In Base64 verkleinern für Backend + persistieren
    const base64 = await resizeImageToBase64(file);
    setBase64Bild(base64);
    letztesBild.current = base64;
    try {
      localStorage.setItem(LS_BILD_KEY, base64);
    } catch (err) {
      console.warn("[BildUpload] Konnte Bild nicht speichern:", err);
    }

    // Memory leak vermeiden: ObjectURL später aufräumen
    return () => URL.revokeObjectURL(objectURL);
  };

  const handleFrageSenden = async () => {
    if (!beschreibung.trim()) return;
    if (!base64Bild) {
      setAntwort("❗ Bitte lade ein Bild hoch, bevor du analysierst.");
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
          threadId: localStorage.getItem(LS_THREAD_KEY) || null,
        }),
      });

      const data = await response.json();
      if (data.threadId) localStorage.setItem(LS_THREAD_KEY, data.threadId);


      const antwortText = data.antwort || data.fehler || "Keine Antwort erhalten.";
      setAntwort(antwortText);
      setVerlauf((prev) => [...prev, { frage: beschreibung, antwort: antwortText }]);
      setBeschreibung("");
    } catch (error) {
      console.error("Fehler beim Bild-Upload:", error);
      const fehler = "❌ Fehler bei der Analyse. Bitte erneut versuchen.";
      setAntwort(fehler);
      setVerlauf((prev) => [...prev, { frage: beschreibung, antwort: fehler }]);
    } finally {
      setLadezustand(false);
    }
  };

  // 🔁 Neu starten – Verlauf & Bild löschen
  const handleNeuStart = () => {
    setVerlauf([]);
    setBild(null);
    setBase64Bild("");
    setBeschreibung("");
    try {
      localStorage.removeItem(LS_VERLAUF_KEY);
      localStorage.removeItem(LS_BILD_KEY);
    } catch (e) {
      console.warn("[BildUpload] Konnte LocalStorage nicht lesen:", e);
    }
  };

  return (
    <div className="bildupload-container">
    <h2>Bild hochladen & analysieren</h2>
  
    {/* Neu starten Button */}
    <button onClick={handleNeuStart} className="neu-start-btn">
      🔄 Neu starten
    </button>
    <button onClick={clearVerlauf} className="secondary-btn">
    🧹Verlauf löschen
    </button>
  
    <div className="bild-upload-bereich">
      <input type="file" accept="image/*" onChange={handleBildAuswahl} />
      {bild && <img src={bild} alt="Vorschau" className="bild-vorschau-klein" />}
    </div>
  

      {/* Verlauf */}
      <div className="chatverlauf" style={{ maxHeight: 300, overflowY: "auto" }}>
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
        <div ref={chatEndRef} />
      </div>

      {ladezustand && <p>⏳ Analyse läuft...</p>}

      {/* Eingabezeile */}
      {base64Bild && (
        <div className="eingabe-bereich">
          <textarea
            placeholder="Beschreibe das Bild oder stelle eine Frage dazu..."
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); // verhindert neuen Zeilenumbruch
                handleFrageSenden();
              }
            }}
          />
          <button onClick={handleFrageSenden}>Senden</button>
        </div>
      )}
    </div>
  );
}
