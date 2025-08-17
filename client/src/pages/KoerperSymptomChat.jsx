// src/pages/KoerpersymptomChat.jsx
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import "../styles/KoerperSymptomChat.css";

const THREAD_API = "/api/koerpersymptomthread";
const LS_CHAT_KEY = "koerperChatVerlauf";
const LS_THREAD_KEY = "koerperThreadId";

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

  // 🔹 Thread-ID für echte Threads
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

  // Intro-Text bei Organwechsel (nur UI, nicht an KI senden)
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

  // Nachricht senden -> Threads
  const frageSenden = async () => {
    if (!eingabe.trim()) return;

    const userMsg = { role: "user", content: eingabe.trim() };
    const basisVerlauf = [...verlauf, userMsg];

    // ⏳ UI-Spinner
    const mitUhr = [...basisVerlauf, { role: "assistant", content: "🕒" }];
    setVerlauf(mitUhr);
    setEingabe("");

    try {
      // Beim allerersten Senden ohne Thread-ID einmal den Organ-Kontext mitgeben
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

      // Falls der Server Fehler schickt, zeige ihn an
      if (!response.ok) {
        const text = await response.text();
        console.error("[Thread API] HTTP", response.status, text);
        const fertigFehler = [...basisVerlauf, { role: "assistant", content: "⚠️ Serverfehler (Thread)." }];
        setVerlauf(fertigFehler);
        return;
      }

      const data = await response.json();

      // 🧠 Thread-ID merken (vom Server zurückgegeben)
      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId);
        try {
          localStorage.setItem(LS_THREAD_KEY, data.threadId);
        } catch (e) {
          console.warn("[LS write] koerperThreadId fehlgeschlagen:", e);
        }
      }

      // ⏹️ Spinner entfernen, Antwort einsetzen
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

  // Neustart: Chat + Thread zurücksetzen
  const neustart = () => {
    setVerlauf([]);
    setEingabe("");
    setThreadId("");
    try {
      localStorage.removeItem(LS_CHAT_KEY);
      localStorage.removeItem(LS_THREAD_KEY);
    } catch (e) {
      console.warn("[LS remove] fehlgeschlagen:", e);
    }
    setSearchParams({});
    if (lastIntroOrganRef?.current !== undefined) lastIntroOrganRef.current = null;

    // Zur Körperkarte und zurück (History sauber)
    navigate("/koerperregionen", { replace: true });
    navigate("/koerpersymptom", { replace: false });

    inputRef.current?.focus();
  };

  return (
    <div className="symptomchat-container">
      <div className="chat-header">
        <h2>Körpersymptom beschreiben</h2>
        <button className="reset-btn" onClick={neustart} title="Chat & Thread löschen und neu starten">
          🔄 Neustart
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

      <div className="eingabe-bereich">
        <input
          ref={inputRef}
          type="text"
          placeholder="Beschreibe dein Symptom hier..."
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={frageSenden}>Frage senden</button>
      </div>

      {/* Optional: Thread-ID anzeigen */}
      {threadId ? (
        <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.7 }}>
          Thread-ID: <code>{threadId}</code>
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.6 }}>
          Noch kein Thread erstellt
        </div>
      )}
    </div>
  );
}
