// src/pages/KoerpersymptomChat.jsx
import React, { useState, useEffect, useRef } from "react";

import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import "../styles/KoerperSymptomChat.css";

// neu: identisch zur Symptom-UI
import VoiceInput from "../components/VoiceInput.jsx";
import { FaPaperPlane } from "react-icons/fa";

const THREAD_API = "/api/koerpersymptomthread";
const LS_CHAT_KEY = "koerperChatVerlauf";
const LS_THREAD_KEY = "koerperThreadId";

// wie im Symptom-Bereich
const MAX_CHARS = 150;

export default function KoerperSymptomChat() {
  const [eingabe, setEingabe] = useState("");
  const [verlauf, setVerlauf] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_CHAT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("[LS read] koerperChatVerlauf fehlgeschlagen:", e);
      return [];
    }
  });

  // Thread-ID
  const [threadId, setThreadId] = useState(() => {
    try {
      return localStorage.getItem(LS_THREAD_KEY) || "";
    } catch (e) {
      console.warn("[LS read] koerperThreadId fehlgeschlagen:", e);
      return "";
    }
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const organ = searchParams.get("organ");

  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const lastIntroOrganRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const fromReset = location.state?.fromReset === true;
const seite = searchParams.get("seite") || sessionStorage.getItem("koerperSeite") || "vorderseite";

// Seite & letzte Karten-Route merken (falls vorhanden)
useEffect(() => {
  // if (seite) sessionStorage.setItem("koerperSeite", seite);
  if (location.state?.from) {
    sessionStorage.setItem("lastMapRoute", location.state.from);
    
  }
  if (seite) {
    sessionStorage.setItem("koerperSeite", seite);
  }

}, [seite, location]);

// Immer wenn Chat geladen wird: History-Eintrag auf /region-start setzen
useEffect(() => {
  window.history.replaceState({}, "", "/startseite");
}, []);


// Browser-Zurück abfangen und IMMER zu /startseite leiten
useEffect(() => {
  const handlePop = (e) => {
    e.preventDefault();
    navigate("/startseite", { replace: true });
  };
  window.addEventListener("popstate", handlePop);
  return () => window.removeEventListener("popstate", handlePop);
}, [navigate]);



useEffect(() => {
  if (fromReset) {
    // Aufräumen – alte Merker löschen, damit nichts mehr „zieht“
    sessionStorage.removeItem("koerperSeite");
    sessionStorage.removeItem("lastMapRoute");
    // den Reset-Status beim Verlassen automatisch vergessen:
    history.replaceState({}, "");
  }
}, [fromReset]);

  // Intro-Text bei Organwechsel (nur UI)
  useEffect(() => {
    if (!organ) return;

    const introExistiert = verlauf.some(
      (m) => m.role === "assistant" && m.content.includes(`"${organ}" als betroffene Region`)
    );
    if (introExistiert) {
      lastIntroOrganRef.current = organ;
      return;
    }

    if (lastIntroOrganRef.current !== organ) {
      const neueStartFrage = {
        role: "assistant",
        content: `Du hast "${organ}" als betroffene Region gewählt. Kannst du bitte beschreiben, was genau du dort spürst?`,
      };
      setVerlauf((prev) => {
        const neu = [...prev, neueStartFrage];
        try {
          localStorage.setItem(LS_CHAT_KEY, JSON.stringify(neu));
        } catch (e) {
          console.warn("[LS write] koerperChatVerlauf fehlgeschlagen:", e);
        }
        return neu;
      });
      lastIntroOrganRef.current = organ;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organ]);

  // Verlauf speichern
  useEffect(() => {
    try {
      localStorage.setItem(LS_CHAT_KEY, JSON.stringify(verlauf));
    } catch (e) {
      console.warn("[LS write] koerperChatVerlauf fehlgeschlagen:", e);
    }
  }, [verlauf]);

  // Auto-Scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [verlauf]);

  // Frage senden -> Threads (optional Text von Voice)
  const frageSenden = async (textOverride) => {
    const aktuelleFrage = (textOverride ?? eingabe).trim();
    if (!aktuelleFrage) return;

    const userMsg = { role: "user", content: aktuelleFrage };
    const basisVerlauf = [...verlauf, userMsg];

    // ⏳ UI-Spinner
    const mitUhr = [...basisVerlauf, { role: "assistant", content: "🕒" }];
    setVerlauf(mitUhr);
    setEingabe("");

    try {
      const payload = {
        threadId: threadId || null,
        verlauf:
          !threadId && organ
            ? [
                { role: "user", content: `Kontext: Die betroffene Körperregion ist "${organ}".` },
                userMsg,
              ]
            : [userMsg],
      };

      const response = await fetch(THREAD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("[Thread API] HTTP", response.status, text);
        const fertigFehler = [...basisVerlauf, { role: "assistant", content: "⚠️ Serverfehler (Thread)." }];
        setVerlauf(fertigFehler);
        return;
      }

      const data = await response.json();

      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId);
        try {
          localStorage.setItem(LS_THREAD_KEY, data.threadId);
        } catch (e) {
          console.warn("[LS write] koerperThreadId fehlgeschlagen:", e);
        }
      }

      const fertig = [...basisVerlauf, { role: "assistant", content: data.antwort || "…" }];
      setVerlauf(fertig);
    } catch (error) {
      console.error("Fehler bei der KI-Antwort:", error);
      const mitFehler = [...basisVerlauf, { role: "assistant", content: "⚠️ Fehler bei der Antwort." }];
      setVerlauf(mitFehler);
    }
  };

  // Enter = senden
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      frageSenden();
    }
  };

  // Voice-Callback (wie im Symptom-Bereich)
  const handleVoice = (text) => {
    setEingabe(text);
    frageSenden(text);
  };

  // Neustart
  const neustart = () => {
    setVerlauf([]);
    setEingabe("");
    setThreadId("");
    try {
      localStorage.removeItem(LS_CHAT_KEY);
      localStorage.removeItem(LS_THREAD_KEY);
    } catch (e) {
      console.warn("[LS remove] failed:", e);
    }
    if (lastIntroOrganRef?.current !== undefined) lastIntroOrganRef.current = null;
  
    // sauber halten
    setSearchParams({});
    sessionStorage.removeItem("koerperSeite");
    sessionStorage.removeItem("lastMapRoute");
  
    // immer zur Startseite der Regionen
    navigate("/region-start", { replace: true, state: { fromReset: true } });

  };
  

  
  
  return (
    <div className="symptomchat-container">
      <div className="chat-header">
        <h2>Körpersymptom beschreiben</h2>
        <button className="reset-btn" onClick={neustart} title="Chat & Thread löschen und neu starten">
          🔄 Neues Gespräch
        </button>
      </div>

      <div
        className="chatverlauf"
        ref={chatRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {verlauf.map((nachricht, index) => (
          <div
            key={index}
            className={`chat-bubble ${nachricht.role === "user" ? "user" : "assistant"}`}
          >
            <strong>{nachricht.role === "user" ? "👤 Du:" : "🩺 Medo:"}</strong>
            <p>{nachricht.content}</p>
          </div>
        ))}
      </div>

      {/* Eingabe wie im Symptom-Chat: Textarea + Counter + Voice + Send */}
      <div className="eingabe-bereich">
        <textarea
          ref={inputRef}
          placeholder="Beschreibe dein Symptom hier..."
          value={eingabe}
          maxLength={MAX_CHARS}
          rows={1}
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
          }}
          className="chat-textarea"
          aria-label="Symptomeingabe"
        />

        <div className="eingabe-actions">
          <span className={`char-count ${eingabe.length >= MAX_CHARS ? "limit" : ""}`}>
            {eingabe.length}/{MAX_CHARS}
          </span>

          <div className="voice-wrap">
            <VoiceInput onTranscribed={handleVoice} />
          </div>

          <button
            type="button"
            className="send-btn"
            onClick={() => frageSenden()}
            disabled={!eingabe.trim()}
            title="Frage senden"
          >
            <FaPaperPlane />
          </button>
        </div>
      </div>

      {/* Thread-ID Anzeige optional leer */}
      {threadId ? (
        <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.7 }} />
      ) : (
        <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.6 }} />
      )}
    </div>
  );
}
