import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import "../styles/BildUpload.css";
import { Image, Camera, Video } from "lucide-react";
import { Volume2 } from "lucide-react";


import { useTheme } from "../ThemeMode";
import VoiceInput from "../components/VoiceInput.jsx";
import { FaPaperPlane } from "react-icons/fa";
import { getAuthHeaders } from "../api/authHeaders";
import DisclaimerShort from "../components/DisclaimerShort";
// Beispiel – so ähnlich wie auf deiner Infoseite


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
  const { theme } = useTheme();

  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const letztesBild = useRef("");
  const chatEndRef = useRef(null);

  const [showCam, setShowCam] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const MIN_TXTAREA_H = 44;
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
    setBeschreibung((prev) =>
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
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
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
        if (e.results[i].isFinal)
          finalText += e.results[i][0].transcript + " ";
      }
      if (finalText) {
        setBeschreibung((prev) =>
          (
            prev +
            (prev && !prev.endsWith(" ") ? " " : "") +
            finalText
          ).slice(0, MAX_CHARS)
        );
      }
    };
    rec.onend = () => setIsRec(false);
    recognitionRef.current = rec;

    requestAnimationFrame(() => autoResize(textareaRef.current));
  }, []);
    // ---- Text-to-Speech (Antwort von Meda vorlesen) ----
    const stripHtml = (html) => {
      if (!html) return "";
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    };
  
    const handleSpeak = (htmlText) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        alert("Vorlesen wird von diesem Browser nicht unterstützt.");
        return;
      }
  
      const text = stripHtml(htmlText);
      if (!text.trim()) return;
  
      const synth = window.speechSynthesis;
      synth.cancel(); // alte Ausgabe abbrechen
  
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "de-DE";
      utter.rate = 1.0;
      utter.pitch = 1.0;
  
      synth.speak(utter);
    };
  

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
        const file = new File([blob], "snapshot.jpg", {
          type: "image/jpeg",
        });
        await handleBildAuswahl({ target: { files: [file] } });
        stopWebcam();
      },
      "image/jpeg",
      0.9
    );
  };

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
      const warnung = "❗ Bitte lade ein Bild hoch, bevor du analysierst.";
      setAntwort(warnung);
      setVerlauf((prev) => [
        ...prev,
        { frage: beschreibung, antwort: warnung },
      ]);
      setBeschreibung("");
      return;
    }

    setLadezustand(true);
    try {
      const existingThreadId = localStorage.getItem(LS_THREAD_KEY) || null;
      const body = {
        prompt: beschreibung,
        base64Bild: base64Bild,
      };
      if (existingThreadId) body.threadId = existingThreadId;

      const response = await fetch("/api/symptom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.threadId) localStorage.setItem(LS_THREAD_KEY, data.threadId);

      const antwortText = data.antwort || data.fehler || "Keine Antwort erhalten.";
      setAntwort(antwortText);
      setVerlauf((prev) => [
        ...prev,
        { frage: beschreibung, antwort: antwortText },
      ]);
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
    <main
      className={`bildupload-page bildupload-page--${theme}`}
      data-theme={theme}
      aria-labelledby="bildanalyse-heading"
      role="main"
    >
      <div className="bildupload-shell">
        <header className="bildupload-header">
          <div className="bildupload-header-text">
            <h1 id="bildanalyse-heading" className="bildupload-title">
              Bildanalyse mit MedScoutX
            </h1>
            <p className="bildupload-subtitle">
              Lade ein medizinisches Foto hoch (z. B. Haut, Schwellung oder
              Verletzung) und stelle Meda gezielte Fragen zur Einschätzung.
            </p>
          </div>
          <div className="bildupload-header-meta" aria-hidden="true">
            <span className="chip chip--accent">Bildanalyse</span>
            <span className="chip chip--soft">Vision-Assist by Meda</span>
          </div>
        </header>

        <section
          className="bildupload-disclaimer-section"
          aria-label="Wichtige Hinweise"
        >
          <DisclaimerShort />
        </section>

        <div className="bildupload-layout">
          {/* Linke Seite: Bild & Upload-Optionen */}
          <section
            className="bildupload-panel bildupload-panel--left"
            aria-label="Bildauswahl und Vorschau"
          >
            <h2 className="panel-title">Bild auswählen</h2>
            <p className="panel-description">
              Wähle ein vorhandenes Foto, nutze die Kamera oder die Webcam.
            </p>

            {/* Versteckte Inputs für Galerie/Kamera */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleBildAuswahl}
              className="visually-hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleBildAuswahl}
              className="visually-hidden"
              aria-hidden="true"
              tabIndex={-1}
            />

<div className="upload-actions" role="group" aria-label="Bildquellen">
  <button
    type="button"
    className="btn btn--primary-2"
    onClick={() => galleryInputRef.current?.click()}
  >
    <Image size={18} strokeWidth={2} aria-hidden="true" />
    <span>Bild aus Galerie wählen</span>
  </button>

  <button
    type="button"
    className="btn btn--primary-2"
    onClick={() => cameraInputRef.current?.click()}
    title="Öffnet auf Mobilgeräten direkt die Kamera"
  >
    <Camera size={18} strokeWidth={2} aria-hidden="true" />
    <span>Smartphone-Kamera</span>
  </button>

  <button
    type="button"
    className="btn btn--primary-2"
    onClick={startWebcam}
    title="Webcam im Browser (Desktop)"
  >
    <Video size={18} strokeWidth={2} aria-hidden="true" />
    <span>Webcam starten</span>
  </button>
</div>


            <div className="bild-preview-wrapper" aria-live="polite">
              {bild ? (
                <figure className="bild-preview-card">
                  <img
                    src={bild}
                    alt="Ausgewähltes Bild zur Analyse"
                    className="bild-vorschau-klein"
                  />
                  <figcaption className="bild-preview-caption">
                    Aktives Bild für die Analyse
                  </figcaption>
                </figure>
              ) : (
                <div className="bild-placeholder" aria-hidden="true">
                  <div className="bild-placeholder-outline" />
                  <p>Noch kein Bild ausgewählt</p>
                </div>
              )}
            </div>

            <div className="control-row">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={resetChat}
                aria-label="Neues Gespräch starten, Bild und Verlauf zurücksetzen"
              >
                <span className="icon" aria-hidden="true">
                  ↻
                </span>
                <span>Neues Gespräch</span>
              </button>
              <button
                type="button"
                className="btn btn--ghost-danger"
                onClick={clearVerlauf}
                aria-label="Nur den Gesprächsverlauf löschen"
              >
                <span className="icon" aria-hidden="true">
                  🧹
                </span>
                <span>Verlauf löschen</span>
              </button>
            </div>
          </section>

          {/* Rechte Seite: Chat & Eingabe */}
          <section
            className="bildupload-panel bildupload-panel--right"
            aria-label="Chatverlauf und Frageeingabe"
          >
            <div className="chat-card" role="group" aria-label="Analyse-Chat mit Meda">
              <header className="chat-header">
                <div>
                  <h2 className="panel-title">Analyse-Chat</h2>
                  <p className="panel-description">
                    Stelle der KI-Assistentin Meda konkrete Fragen zu deinem Bild.
                  </p>
                </div>
                <div className="chat-header-badge">
                  <span className="status-dot" aria-hidden="true" />
                  <span className="status-label">Meda ist bereit</span>
                </div>
              </header>

              <section
                className="chatverlauf"
                style={{ maxHeight: 300, overflowY: "auto" }}
                role="log"
                aria-live="polite"
                aria-label="Bisherige Fragen und Antworten"
              >
                {verlauf.length === 0 && (
                  <p className="chat-placeholder">
                    Noch keine Fragen gestellt. Lade ein Bild hoch und stelle
                    deine erste Frage, z. B.:
                    <br />
                    <span className="chat-placeholder-example">
                      „Was könnte diese Rötung bedeuten?“
                    </span>
                  </p>
                )}

{verlauf.map((eintrag, index) => (
  <article
    key={index}
    className="chat-message-block"
    aria-label={`Nachricht ${index + 1}`}
  >
    <div className="frage-block message-bubble message-bubble--user">
      <strong className="message-label">👤 Du:</strong>
      <p className="message-text">{eintrag.frage}</p>
    </div>

    <div className="antwort-block message-bubble message-bubble--meda">
      <div className="message-header-row">
        <strong className="message-label">🩺 Meda:</strong>
        <button
          type="button"
          className="tts-btn"
          onClick={() => handleSpeak(eintrag.antwort)}
          aria-label="Antwort von Meda vorlesen"
        >
          <Volume2 size={16} aria-hidden="true" />
        </button>
      </div>
      <span
        className="message-text"
        dangerouslySetInnerHTML={{ __html: eintrag.antwort }}
      />
    </div>
  </article>
))}

                <div ref={chatEndRef} />
              </section>

              <div
                className="loading-row"
                aria-live="polite"
                aria-atomic="true"
              >
                {ladezustand && (
                  <p className="loading-text">
                    ⏳ Analyse läuft&nbsp;… Meda wertet dein Bild gerade aus.
                  </p>
                )}
              </div>

              {base64Bild && (
                <div className="eingabe-bereich">
                  <div className="eingabe-label-row">
                    <label
                      htmlFor="bildbeschreibung"
                      className="eingabe-label"
                    >
                      Frage zu diesem Bild
                    </label>
                    <span className="eingabe-hint">
                      Max. {MAX_CHARS} Zeichen
                    </span>
                  </div>

                  <textarea
                    id="bildbeschreibung"
                    ref={textareaRef}
                    placeholder="Beschreibe das Bild oder stelle eine Frage dazu …"
                    value={beschreibung}
                    maxLength={MAX_CHARS}
                    rows={1}
                    onChange={(e) => {
                      handleBeschreibungChange(e);
                      autoResize(e.target);
                    }}
                    onInput={(e) => autoResize(e.target)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleFrageSenden();
                      }
                    }}
                    className="chat-textarea"
                    aria-label="Frage zur Bildanalyse eingeben"
                  />

                  <div className="eingabe-actions">
                    <span
                      className={`char-count ${
                        beschreibung.length >= MAX_CHARS ? "limit" : ""
                      }`}
                      aria-live="polite"
                    >
                      {beschreibung.length}/{MAX_CHARS}
                    </span>

                    <div className="voice-wrap">
                      <VoiceInput onTranscribed={handleVoice} />
                    </div>

                    <button
                      type="button"
                      className="send-btn"
                      onClick={handleFrageSenden}
                      disabled={ladezustand}
                      aria-label="Frage an Meda senden"
                    >
                      <FaPaperPlane aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {!base64Bild && (
                <p className="eingabe-disabled-hint">
                  Lade zuerst ein Bild hoch, um eine Frage zu stellen.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {showCam && (
        <div
          className="webcam-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="webcam-dialog-title"
        >
          <div className="webcam-dialog">
            <h2 id="webcam-dialog-title" className="webcam-title">
              Webcam-Foto aufnehmen
            </h2>
            <p className="webcam-subtitle">
              Richte das Bild gut aus und klicke anschließend auf „Foto
              aufnehmen“.
            </p>

            <div className="webcam-video-wrapper">
              <video
                ref={videoRef}
                className="webcam-video"
                playsInline
                muted
              />
            </div>

            <div className="webcam-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={capturePhoto}
              >
                <span aria-hidden="true">📸</span>
                <span>Foto aufnehmen</span>
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={stopWebcam}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
