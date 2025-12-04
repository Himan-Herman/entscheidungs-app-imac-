// src/pages/KoerperSymptomChat.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  useSearchParams,
  useNavigate,
  useLocation,
} from "react-router-dom";

import "../styles/KoerperSymptomChat.css";

import { useTheme } from "../ThemeMode";
import DisclaimerShort from "../components/DisclaimerShort";
import VoiceInput from "../components/VoiceInput.jsx";
import { FaPaperPlane } from "react-icons/fa";
import { getAuthHeaders } from "../api/authHeaders";
import SpeakButton from "../components/SpeakButton";

const THREAD_API = "/api/koerpersymptomthread";
const LS_CHAT_KEY = "koerperChatVerlauf";
const LS_THREAD_KEY = "koerperThreadId";
const MAX_CHARS = 150;

export default function KoerperSymptomChat() {
  const { theme } = useTheme(); // "light" | "dark"

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
  const [threadId, setThreadId] = useState(() => {
    try {
      return localStorage.getItem(LS_THREAD_KEY) || "";
    } catch (e) {
      console.warn("[LS read] koerperThreadId fehlgeschlagen:", e);
      return "";
    }
  });
  const [isSending, setIsSending] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const organ = searchParams.get("organ");
  
const organLabel = organ ? organ.replace(/_/g, " ") : "Region";

  const seite =
    searchParams.get("seite") ||
    sessionStorage.getItem("koerperSeite") ||
    "vorderseite";

  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const lastIntroOrganRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const fromReset = location.state?.fromReset === true;

  // Textarea-Autoresize
  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    const maxH = 160;
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  };

  // Route-Infos für „zurück zur Karte“ merken
  useEffect(() => {
    if (location.state?.from) {
      sessionStorage.setItem("lastMapRoute", location.state.from);
    }
    if (seite) {
      sessionStorage.setItem("koerperSeite", seite);
    }
  }, [seite, location]);

  // nach „Neues Gespräch“: nur Session-Caches löschen, KEINE URL-Manipulation
  useEffect(() => {
    if (fromReset) {
      sessionStorage.removeItem("koerperSeite");
      sessionStorage.removeItem("lastMapRoute");
    }
  }, [fromReset]);

  // Einstiegs-Nachricht, wenn Organ gewählt wurde
  useEffect(() => {
    if (!organ) return;

    const introExistiert = verlauf.some(
      (m) =>
        m.role === "assistant" &&
        m.content.includes(`"${organ}" als betroffene Region`)
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

  // Verlauf im LocalStorage speichern
  useEffect(() => {
    try {
      localStorage.setItem(LS_CHAT_KEY, JSON.stringify(verlauf));
    } catch (e) {
      console.warn("[LS write] koerperChatVerlauf fehlgeschlagen:", e);
    }
  }, [verlauf]);

  // Immer nach unten scrollen bei neuen Nachrichten
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [verlauf]);

  // KI-Anfrage
  const frageSenden = async (textOverride) => {
    const raw =
      typeof textOverride === "string" ? textOverride : eingabe;
    const aktuelleFrage = (raw || "").trim();
    if (!aktuelleFrage || isSending) return;

    const userMsg = { role: "user", content: aktuelleFrage };
    const basisVerlauf = [...verlauf, userMsg];

    // Zwischenstatus mit Sanduhr
    const mitUhr = [
      ...basisVerlauf,
      {
        role: "assistant",
        content: "⏳ Meda analysiert deine Angaben …",
      },
    ];
    setVerlauf(mitUhr);
    setEingabe("");
    setIsSending(true);

    try {
      const payload = {
        threadId: threadId || null,
        verlauf:
          !threadId && organ
            ? [
                {
                  role: "user",
                  content: `Kontext: Die betroffene Körperregion ist "${organ}".`,
                },
                userMsg,
              ]
            : [userMsg],
      };

      const response = await fetch(THREAD_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("[Thread API] HTTP", response.status, text);
        const fertigFehler = [
          ...basisVerlauf,
          {
            role: "assistant",
            content: "⚠️ Serverfehler. Bitte später erneut versuchen.",
          },
        ];
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

      const fertig = [
        ...basisVerlauf,
        {
          role: "assistant",
          content: data.antwort || "…",
        },
      ];
      setVerlauf(fertig);
    } catch (error) {
      console.error("Fehler bei der KI-Antwort:", error);
      const mitFehler = [
        ...basisVerlauf,
        {
          role: "assistant",
          content:
            "⚠️ Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.",
        },
      ];
      setVerlauf(mitFehler);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      frageSenden();
    }
  };

  // Ergebnis aus VoiceInput
  const handleVoice = (text) => {
    setEingabe((text || "").slice(0, MAX_CHARS));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Nur Verlauf löschen (Thread bleibt)
 

  // Alles zurücksetzen und wieder zur Region-Startseite
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
    if (lastIntroOrganRef?.current !== undefined)
      lastIntroOrganRef.current = null;

    setSearchParams({});
    sessionStorage.removeItem("koerperSeite");
    sessionStorage.removeItem("lastMapRoute");

    navigate("/region-start", { replace: true, state: { fromReset: true } });
  };
  const clearVerlauf = () => {
    try {
      // bisherigen Verlauf aus LocalStorage entfernen
      localStorage.removeItem(LS_CHAT_KEY);
    } catch (e) {
      console.warn("[LS remove] koerperChatVerlauf löschen fehlgeschlagen:", e);
    }
  
    if (organ) {
      // Wenn eine Region gewählt ist: neue Einstiegsnachricht für genau dieses Organ
      const neueStartFrage = {
        role: "assistant",
        content: `Du hast "${organ}" als betroffene Region gewählt. Kannst du bitte beschreiben, was genau du dort spürst?`,
      };
  
      const neu = [neueStartFrage];
      setVerlauf(neu);
  
      // Merken, dass für dieses Organ bereits ein Intro gesetzt wurde
      lastIntroOrganRef.current = organ;
  
      try {
        localStorage.setItem(LS_CHAT_KEY, JSON.stringify(neu));
      } catch (e) {
        console.warn("[LS write] koerperChatVerlauf nach Reset fehlgeschlagen:", e);
      }
    } else {
      // Falls aus irgendeinem Grund kein Organ gesetzt ist: einfach komplett leeren
      setVerlauf([]);
    }
  };
  

  const zeichenAnzahl = eingabe.length;

  return (
    <main
      className={`koerper-page koerper-page--${theme}`}
      data-theme={theme}
      aria-labelledby="koerper-heading"
      role="main"
    >
      <div className="koerper-shell">
        <header className="koerper-header">
          <div className="koerper-header-text">
            <h1 id="koerper-heading" className="koerper-title">
              Körpersymptom in der gewählten Region
            </h1>
            <p className="koerper-subtitle">
              Beschreibe, was du in dieser Körperregion spürst. Meda stellt
              Rückfragen und hilft dir, die nächsten Schritte besser zu
              verstehen.
            </p>
          </div>
          <div className="koerper-header-meta" aria-hidden="true">
            <span className="chip chip--accent">Body&nbsp;Map</span>
            <span className="chip chip--soft">Region auswählen</span>
          </div>
        </header>

        <section
          className="koerper-disclaimer-section"
          aria-label="Wichtige Hinweise"
        >
          <DisclaimerShort />
        </section>

        <section
          className="symptomchat-container"
          aria-label="Körpersymptom-Chat mit Meda"
        >
          <header className="chat-top-row">
            <h2 className="chat-title">Körpersymptom beschreiben</h2>
            <div className="chat-top-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={neustart}
                title="Chat & Thread löschen und neu starten"
              >
                ↻ Neues Gespräch
              </button>

              <button
                type="button"
                className="btn btn--ghost-danger"
                onClick={clearVerlauf}
                title="Nur bisherigen Verlauf löschen"
              >
                🧹 Verlauf löschen
              </button>
            </div>
          </header>

          {/* Chatverlauf */}
          <div
            className="chatverlauf"
            ref={chatRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {verlauf.length === 0 && (
              <p className="chat-placeholder">
                Wähle zuerst eine Körperregion aus. Danach kannst du hier dein
                Symptom beschreiben, z.&nbsp;B.:
                <br />
                <span className="chat-placeholder-example">
                  „Seit einigen Tagen habe ich ein Ziehen in der rechten
                  Schulter, wenn ich den Arm hebe.“
                </span>
              </p>
            )}

            {verlauf.map((nachricht, index) => {
              const isUser = nachricht.role === "user";
              return (
                <article
                  key={index}
                  className={`chat-bubble ${
                    isUser ? "user" : "assistant"
                  }`}
                  aria-label={`Nachricht ${index + 1} von ${
                    isUser ? "dir" : "Meda"
                  }`}
                >
                  {isUser ? (
                    <>
                      <strong className="bubble-label">👤 Du:</strong>
                      <p className="bubble-text">{nachricht.content}</p>
                    </>
                  ) : (
                    <>
                      <div className="bubble-header-row">
                        <strong className="bubble-label">🩺 Meda:</strong>
                        {/* OpenAI-TTS über Backend (gleiche Logik wie im Symptom-Chat) */}
                        <SpeakButton
                          text={nachricht.content || ""}
                          className="tts-btn"
                          ariaLabel="Antwort von Meda vorlesen"
                        />
                      </div>
                      <p className="bubble-text">{nachricht.content}</p>
                    </>
                  )}
                </article>
              );
            })}
          </div>

          {/* Eingabe */}
          <div className="eingabe-bereich">
  <div className="eingabe-label-row">
    <label
      htmlFor="koerper-eingabe"
      className="eingabe-label"
    >
      Dein Symptom in dieser Region
    </label>
    <span className="eingabe-hint">
      Max. {MAX_CHARS} Zeichen
    </span>
  </div>

  {organ && (
    <p className="koerper-organ-hint">
      <strong>Hinweis:</strong> Bitte beginne deine Beschreibung mit der
      gewählten Region, z.&nbsp;B.&nbsp;
      <span className="koerper-organ-example">
        „In meiner {organLabel} …“
      </span>
      . Für allgemeine, nicht region-bezogene Fragen nutze bitte den
      Symptom-Chat.
    </p>
  )}

  <textarea
    id="koerper-eingabe"
    ref={inputRef}
    className="chat-textarea"
    placeholder={`Beschreibe hier dein Symptom in der gewählten Region, z. B. Art, Dauer, Stärke, Auslöser …`}
    value={eingabe}
    maxLength={MAX_CHARS}
    rows={1}
    onChange={(e) =>
      setEingabe(e.target.value.slice(0, MAX_CHARS))
    }
    onInput={(e) => autoResize(e.target)}
    onKeyDown={handleKeyDown}
    aria-label="Symptom in dieser Körperregion eingeben"
  />

            <div className="eingabe-actions">
              <span
                className={`char-count ${
                  zeichenAnzahl >= MAX_CHARS ? "limit" : ""
                }`}
                aria-live="polite"
              >
                {zeichenAnzahl}/{MAX_CHARS}
              </span>

              <div className="voice-wrap">
                <VoiceInput onTranscribed={handleVoice} />
              </div>

              <button
                type="button"
                className="send-btn"
                onClick={() => frageSenden()}
                disabled={isSending}
                aria-label="Symptombeschreibung senden"
              >
                <FaPaperPlane aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
