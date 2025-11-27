import React, { useState, useRef, useEffect,useLayoutEffect } from "react";
import "../styles/BildUpload.css";

import VoiceInput from "../components/VoiceInput.jsx";
import { FaPaperPlane } from "react-icons/fa";
import { getAuthHeaders } from "../api/authHeaders";



const LS_VERLAUF_KEY = "bildChatVerlauf";
const LS_BILD_KEY = "letztesBild";
const LS_THREAD_KEY = "bildThreadId";


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
  const [bild, setBild] = useState(null);         
  const [beschreibung, setBeschreibung] = useState("");
  const [base64Bild, setBase64Bild] = useState("");
  const [, setAntwort] = useState("");
  const [ladezustand, setLadezustand] = useState(false);
  const [verlauf, setVerlauf] = useState([]);

  
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  
  const letztesBild = useRef("");
  const chatEndRef = useRef(null);

  
  const [showCam, setShowCam] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const MIN_TXTAREA_H = 44
  const textareaRef = useRef(null);


  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, MIN_TXTAREA_H) + "px";
  };
  useLayoutEffect(() => {
    autoResize(textareaRef.current);
  }, [beschreibung]);


  const MAX_CHARS = 150;
  
  
  


const [, setIsRec] = useState(false);
const recognitionRef = useRef(null);

const handleVoice = (text) => {
  
  setBeschreibung(prev =>
    (prev + " " + (text ?? "")).slice(0, MAX_CHARS)
  );
  
  
  handleFrageSenden();
};


  const clearVerlauf = () => {
    setVerlauf([]);
    try {
      localStorage.setItem(LS_VERLAUF_KEY, JSON.stringify([]));
    } catch (e) {
      console.warn("[BildUpload] Konnte Verlauf nicht leeren:", e);
    }
  };

  
  useEffect(() => {
    try {
      const gespeicherterVerlauf = localStorage.getItem(LS_VERLAUF_KEY);
      const gespeichertesBild = localStorage.getItem(LS_BILD_KEY);

      if (gespeicherterVerlauf) setVerlauf(JSON.parse(gespeicherterVerlauf));
      if (gespeichertesBild) {
        setBild(gespeichertesBild); 
        setBase64Bild(gespeichertesBild);
        letztesBild.current = gespeichertesBild;
      }
    } catch (e) {
      console.warn("[BildUpload] Konnte LocalStorage nicht lesen:", e);
    }
  }, []);

  
  useEffect(() => {
    try {
      localStorage.setItem(LS_VERLAUF_KEY, JSON.stringify(verlauf));
    } catch (e) {
      console.warn("[BildUpload] Konnte Verlauf nicht speichern:", e);
    }
  }, [verlauf]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [verlauf]);


  useEffect(() => {
    return () => {
      streamRef.current?.getTracks()?.forEach(t => t.stop());
    };
  }, []);
  
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      recognitionRef.current = null;
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "de-DE"; 
    rec.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
      }
      if (finalText) {
        
        setBeschreibung(prev =>
          (prev + (prev && !prev.endsWith(" ") ? " " : "") + finalText).slice(0, MAX_CHARS)
        );
      }
    };
    rec.onend = () => setIsRec(false);
    recognitionRef.current = rec;
  
    requestAnimationFrame(() => autoResize(textareaRef.current));
  }, []);
  


  const startWebcam = async () => {
    try {
 
      let constraints = { video: true };
  
     
      if (/Mobi|Android/i.test(navigator.userAgent)) {
        constraints = { video: { facingMode: "environment" } };
      }
  
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
  
    
      setShowCam(true);
  
 
      requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (!video) return;
  
        video.srcObject = stream;
        
        video.muted = true;
        video.setAttribute("muted", "");
        video.playsInline = true;
        video.setAttribute("playsinline", "");
  
        
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
    streamRef.current?.getTracks()?.forEach((t) => t.stop());
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
  const handleBeschreibungChange = (e) => {
    const value = e.target.value.slice(0, MAX_CHARS);
    setBeschreibung(value);
  };
  
  const handleBildAuswahl = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    
    const objectURL = URL.createObjectURL(file);
    setBild(objectURL);

    
    const base64 = await resizeImageToBase64(file);
    setBase64Bild(base64);
    letztesBild.current = base64;
    try {
      localStorage.setItem(LS_BILD_KEY, base64);
      localStorage.removeItem(LS_THREAD_KEY);
    } catch (err) {
      console.warn("[BildUpload] Konnte Bild nicht speichern:", err);
    }

    
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
      const existingThreadId = localStorage.getItem(LS_THREAD_KEY) || null;
   const body = {
     prompt: beschreibung,
     base64Bild: base64Bild
   };
   if (existingThreadId) body.threadId = existingThreadId;

      const response = await fetch("/api/symptom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),      // 🔐 Token dazu
        },
        body: JSON.stringify(body),
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


  const resetChat = () => {
    setVerlauf([]);
    setBild(null);
    setBase64Bild("");
    setBeschreibung("");
    try {
      localStorage.removeItem(LS_VERLAUF_KEY);
      localStorage.removeItem(LS_BILD_KEY);
      localStorage.removeItem(LS_THREAD_KEY);
    } catch (e) {
      console.warn("[BildUpload] Konnte LocalStorage nicht lesen:", e);
    }
  };
useEffect(() => {
  
  autoResize(textareaRef.current);

  
  if (document.activeElement === textareaRef.current) {
    textareaRef.current.blur();
  }
}, []);
  return (
    <div className="bildupload-container">
      <h2>Bild hochladen & analysieren</h2>

     
      <button className="btn btn--sm" onClick={resetChat}>
  <span className="icon">↻</span> Neues Gespräch
</button>
      <button className="btn btn--sm btn--danger" onClick={clearVerlauf}>
  <span className="icon">🧹</span> Verlauf löschen
</button>
 
<div className="upload-sidebar">
  
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



    
        {bild && <img src={bild} alt="Vorschau" className="bild-vorschau-klein" />}
      </div>

   
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

      
{base64Bild && (
  <div className="eingabe-bereich">
    {/* Textfeld */}
    <textarea
  ref={textareaRef}
  placeholder="Beschreibe das Bild oder stelle eine Frage dazu ..."
  value={beschreibung}
  maxLength={MAX_CHARS}      
  rows={1}
  onChange={(e) => { handleBeschreibungChange(e); autoResize(e.target); }}
  onInput={(e) => autoResize(e.target)}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFrageSenden();
    }
  }}
  className="chat-textarea"
/>




    
    <div className="eingabe-actions">
      <span className={`char-count ${beschreibung.length >= MAX_CHARS ? "limit" : ""}`}>
        {beschreibung.length}/{MAX_CHARS}
      </span>

      
      <div className="voice-wrap">
        <VoiceInput onTranscribed={handleVoice} />
      </div>

      <button className="send-btn" onClick={handleFrageSenden} disabled={ladezustand}>
        <FaPaperPlane />
      </button>
    </div>
  </div>
)}


     
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
                 Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
