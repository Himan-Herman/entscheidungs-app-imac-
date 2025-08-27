import React, { useState, useRef, useEffect } from "react";
import "../styles/BildUpload.css";

// LocalStorage Keys
const LS_VERLAUF_KEY = "bildChatVerlauf";
const LS_BILD_KEY = "letztesBild";
const LS_THREAD_KEY = "bildThreadId";

// ✅ Bild verkleinern (max 512px) und in Base64 umwandeln
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
  const [bild, setBild] = useState(null);          // Vorschau (ObjectURL oder Data-URL)
  const [beschreibung, setBeschreibung] = useState("");
  const [base64Bild, setBase64Bild] = useState(""); // fürs Backend
  const [, setAntwort] = useState("");
  const [ladezustand, setLadezustand] = useState(false);
  const [verlauf, setVerlauf] = useState([]);

  // Datei-Inputs (Galerie/Kamera mobil)
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Chat/Scroll
  const letztesBild = useRef("");
  const chatEndRef = useRef(null);

  // Webcam (Desktop)
  const [showCam, setShowCam] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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
        setBild(gespeichertesBild); // Data-URL direkt als Vorschau
        setBase64Bild(gespeichertesBild);
        letztesBild.current = gespeichertesBild;
      }
    } catch (e) {
      console.warn("[BildUpload] Konnte LocalStorage nicht lesen:", e);
    }
  }, []);

  // 📌 Verlauf in LocalStorage spiegeln
  useEffect(() => {
    try {
      localStorage.setItem(LS_VERLAUF_KEY, JSON.stringify(verlauf));
    } catch (e) {
      console.warn("[BildUpload] Konnte Verlauf nicht speichern:", e);
    }
  }, [verlauf]);

  // ⬇️ Auto-Scroll ans Ende bei neuer Nachricht
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [verlauf]);

  // ❌ Webcam-Stream bei Unmount stoppen
  useEffect(() => {
    return () => {
      try {
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  // ----- Webcam-Funktionen (Desktop) -----
  const startWebcam = async () => {
    try {
      // ggf. alten Stream stoppen
      try { streamRef.current?.getTracks()?.forEach(t => t.stop()); } catch {}
  
      // 1) Erstmal einfache Constraints (Desktop/Safari mögen das lieber)
      let constraints = { video: true };
  
      // 2) Wenn Mobilgerät: Rückkamera wünschen (ohne "exact", sonst kann es fehlschlagen)
      if (/Mobi|Android/i.test(navigator.userAgent)) {
        constraints = { video: { facingMode: "environment" } };
      }
  
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
  
      // Overlay öffnen, damit das <video> sicher im DOM ist
      setShowCam(true);
  
      // Warten bis <video> im DOM ist
      requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (!video) return;
  
        video.srcObject = stream;
        // Safari/iOS brauchen das für Autoplay
        video.muted = true;
        video.setAttribute("muted", "");
        video.playsInline = true;
        video.setAttribute("playsinline", "");
  
        // Auf Metadaten warten, dann play()
        video.onloadedmetadata = async () => {
          try {
            await video.play();
          } catch (err) {
            console.warn("video.play() blockiert:", err);
          }
        };
      });
    } catch (e) {
      alert("Kamera-Zugriff verweigert oder nicht verfügbar.");
      console.error(e);
    }
  };
  

  const stopWebcam = () => {
    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
    setShowCam(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const file = new File([blob], "snapshot.jpg", { type: "image/jpeg" });
        await handleBildAuswahl({ target: { files: [file] } }); // nutzt deine bestehende Logik
        stopWebcam();
      },
      "image/jpeg",
      0.9
    );
  };
  // ---------------------------------------

  // Datei gewählt (Galerie / Kamera / Webcam-Snapshot)
  const handleBildAuswahl = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vorschau per ObjectURL
    const objectURL = URL.createObjectURL(file);
    setBild(objectURL);

    // In Base64 verkleinern + persistieren
    const base64 = await resizeImageToBase64(file);
    setBase64Bild(base64);
    letztesBild.current = base64;
    try {
      localStorage.setItem(LS_BILD_KEY, base64);
    } catch (err) {
      console.warn("[BildUpload] Konnte Bild nicht speichern:", err);
    }

    // ObjectURL später freigeben
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
  const resetChat = () => {
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

      {/* Aktionen */}
      <button className="btn btn--sm" onClick={resetChat}>
  <span className="icon">↻</span> Neues Gespräch
</button>
      <button className="btn btn--sm btn--danger" onClick={clearVerlauf}>
  <span className="icon">🧹</span> Verlauf löschen
</button>
      {/* Upload-Bereich */}
      {/* Sidebar rechts mit Upload-Buttons */}
<div className="upload-sidebar">
  {/* Versteckte Inputs */}
  <input
    ref={galleryInputRef}
    type="file"
    accept="image/*"
    onChange={handleBildAuswahl}
    style={{ display: "none" }}
  />
  <input
    ref={cameraInputRef}
    type="file"
    accept="image/*"
    capture="environment"
    onChange={handleBildAuswahl}
    style={{ display: "none" }}
  />

  {/* Buttons */}
  <button
    type="button"
    className="btn btn--primary-2"
    onClick={() => galleryInputRef.current?.click()}
  >
    🖼️ Galerie
  </button>

  <button
    type="button"
    className="btn btn--primary-2"
    onClick={() => cameraInputRef.current?.click()}
    title="Öffnet auf Mobilgeräten direkt die Kamera"
  >
    📷  Kamera
  </button>

  <button
    type="button"
    className="btn btn--primary-2"
    onClick={startWebcam}
    title="Webcam im Browser (Desktop)"
  >
    🎥  Webcam
  </button>



        {/* Vorschau */}
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
                e.preventDefault();
                handleFrageSenden();
              }
            }}
          />
          <button onClick={handleFrageSenden}>Senden</button>
        </div>
      )}

      {/* Webcam-Overlay */}
      {showCam && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "1rem",
              borderRadius: "12px",
              textAlign: "center",
              maxWidth: "90vw",
            }}
          >
            <video
              ref={videoRef}
              style={{ maxWidth: "80vw", maxHeight: "60vh", borderRadius: "8px" }}
              playsInline
              muted
            />
            <div
              style={{
                marginTop: "0.75rem",
                display: "flex",
                gap: "0.5rem",
                justifyContent: "center",
              }}
            >
              <button className="primary-btn" onClick={capturePhoto}>
                📸 Foto aufnehmen
              </button>
              <button className="secondary-btn" onClick={stopWebcam}>
                ❌ Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
