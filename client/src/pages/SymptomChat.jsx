import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/SymptomChat.css";

import { useTheme } from "../ThemeMode";
import { getOrganPrompt } from "./prompt/organPrompts";
import { getAuthHeaders } from "../api/authHeaders";
import DisclaimerShort from "../components/DisclaimerShort";
import VoiceInput from "../components/VoiceInput.jsx";
import { FaPaperPlane } from "react-icons/fa";
import SpeakButton from "../components/SpeakButton.jsx";

const LS_VERLAUF_KEY = "symptomVerlauf";
const LS_THREAD_KEY = "symptomThreadId";
const MAX_CHARS = 150;

export default function SymptomChat() {
  const { theme } = useTheme(); // "light" | "dark"
  const [eingabe, setEingabe] = useState("");
  const [ladeStatus, setLadeStatus] = useState(false);
  const [verlauf, setVerlauf] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [searchParams] = useSearchParams();
  const organ = searchParams.get("organ");

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [verlauf]);

  // Verlauf & Thread-ID aus LocalStorage laden
  // 1) Initialisierung: erst LocalStorage, sonst Organ-Prompt
  useEffect(() => {
    let initialVerlauf = [];

    try {
      const gespeicherterVerlauf = localStorage.getItem(LS_VERLAUF_KEY);
      if (gespeicherterVerlauf) {
        const parsed = JSON.parse(gespeicherterVerlauf);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialVerlauf = parsed;
        }
      }
    } catch (e) {
      console.warn("[SymptomChat] Konnte Verlauf nicht lesen:", e);
      localStorage.removeItem(LS_VERLAUF_KEY);
    }

    // Nur wenn WIRKLICH kein gespeicherter Verlauf da ist → Organ-Prompt setzen
    if (initialVerlauf.length === 0 && organ) {
      const prompt = getOrganPrompt(organ);
      if (prompt) {
        initialVerlauf = [{ role: "assistant", content: prompt }];
      }
    }

    if (initialVerlauf.length > 0) {
      setVerlauf(initialVerlauf);
    }

    // Thread-ID laden
    const gespeicherteThreadId = localStorage.getItem(LS_THREAD_KEY);
    if (
      gespeicherteThreadId &&
      gespeicherteThreadId !== "null" &&
      gespeicherteThreadId !== "undefined" &&
      gespeicherteThreadId.trim() !== ""
    ) {
      setThreadId(gespeicherteThreadId);
    } else {
      localStorage.removeItem(LS_THREAD_KEY);
    }
  }, [organ]);

  // 2) Verlauf immer speichern, wenn er sich ändert
  useEffect(() => {
    try {
      localStorage.setItem(LS_VERLAUF_KEY, JSON.stringify(verlauf));
    } catch (e) {
      console.warn("[SymptomChat] Konnte Verlauf nicht speichern:", e);
    }
  }, [verlauf]);

  // Speech-to-Text Ergebnis aus VoiceInput
  const handleVoice = (text /* , language */) => {
    if (!text) return;
    setEingabe((prev) =>
      (
        prev +
        (prev && !prev.endsWith(" ") ? " " : "") +
        text
      ).slice(0, MAX_CHARS)
    );

    // Fokus ins Textfeld
    textareaRef.current?.focus();
  };

  const frageSenden = async () => {
    if (!eingabe.trim()) return;

    const aktuelleFrage = eingabe.trim();
    const neueFrage = { role: "user", content: aktuelleFrage };
    const neuerVerlauf = [...verlauf, neueFrage];

    // temporäre Lade-Antwort
    setVerlauf([
      ...neuerVerlauf,
      { role: "assistant", content: "🕒 Meda denkt nach …" },
    ]);
    setEingabe("");
    setLadeStatus(true);

    try {
      const response = await fetch("/api/textsymptom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ verlauf: neuerVerlauf, threadId }),
      });

      const data = await response.json();

      if (data.threadId) {
        setThreadId(data.threadId);
        localStorage.setItem(LS_THREAD_KEY, data.threadId);
      }

      const verlaufOhneLadeanzeige = [...neuerVerlauf];
      verlaufOhneLadeanzeige.push({
        role: "assistant",
        content: data.antwort || "Keine Antwort erhalten.",
      });
      setVerlauf(verlaufOhneLadeanzeige);
    } catch (error) {
      console.error("Fehler bei der KI-Antwort:", error);
      const verlaufMitFehler = [...neuerVerlauf];
      verlaufMitFehler.push({
        role: "assistant",
        content:
          "⚠️ Fehler bei der Antwort. Bitte versuche es später erneut.",
      });
      setVerlauf(verlaufMitFehler);
    } finally {
      setLadeStatus(false);
    }
  };

  const resetChat = () => {
    setVerlauf([]);
    setThreadId(null);
    localStorage.removeItem(LS_VERLAUF_KEY);
    localStorage.removeItem(LS_THREAD_KEY);
  };

  const clearVerlauf = () => {
    setVerlauf([]);
    try {
      localStorage.removeItem(LS_VERLAUF_KEY);
    } catch (e) {
      console.warn("[SymptomChat] Konnte Verlauf nicht löschen:", e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      frageSenden();
    }
  };

  const zeichenAnzahl = eingabe.length;

  return (
    <main
      className={`symptom-page symptom-page--${theme}`}
      data-theme={theme}
      aria-labelledby="symptom-heading"
      role="main"
    >
      <div className="symptom-shell">
        <header className="symptom-header">
          <div className="symptom-header-text">
            <h1 id="symptom-heading" className="symptom-title">
              Symptom-Check mit MedScoutX
            </h1>
            <p className="symptom-subtitle">
              Beschreibe deine Beschwerden in eigenen Worten. Meda stellt
              Rückfragen und hilft dir, die nächsten Schritte besser zu
              verstehen.
            </p>
          </div>
          <div className="symptom-header-meta" aria-hidden="true">
            <span className="chip chip--accent">Symptom-Chat</span>
            <span className="chip chip--soft">Conversational Triage</span>
          </div>
        </header>

        <section
          className="symptom-disclaimer-section"
          aria-label="Wichtige Hinweise"
        >
          <DisclaimerShort />
        </section>

        <div className="symptom-layout">
          {/* Hinweise-Box – jetzt ÜBER dem Chat */}
          <section
            className="symptom-panel symptom-panel--hints"
            aria-label="Hinweise zur Beschreibung"
          >
            <h2 className="panel-title">Hinweise zur Beschreibung</h2>
            <p className="panel-description">
              Je genauer du dein Symptom beschreibst, desto gezielter kann Meda
              Rückfragen stellen. Du kannst auch in ganzen Sätzen schreiben –
              oder die Sprachfunktion nutzen.
            </p>
            <ul className="tip-list">
              <li>🕒 Seit wann besteht das Symptom?</li>
              <li>📍 Wo genau tritt es auf?</li>
              <li>🎚️ Wie stark sind die Beschwerden (z. B. 1–10)?</li>
              <li>➕ Gibt es Begleitsymptome (Fieber, Übelkeit, Schwellung)?</li>
            </ul>

            <div className="hint-button-row">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={resetChat}
                aria-label="Neues Gespräch starten, Verlauf und Kontext zurücksetzen"
              >
                <span className="icon" aria-hidden="true">
                  🔄
                </span>
                <span>Neues Gespräch</span>
              </button>

              <button
                type="button"
                className="btn btn--ghost-danger"
                onClick={clearVerlauf}
                aria-label="Nur den bisherigen Verlauf löschen"
              >
                <span className="icon" aria-hidden="true">
                  🧹
                </span>
                <span>Verlauf löschen</span>
              </button>
            </div>
          </section>

          {/* Chat mit Meda */}
          <section
            className="symptom-panel symptom-panel--chat"
            aria-label="Symptom-Chat mit Meda"
          >
            <div
              className="chat-card"
              role="group"
              aria-label="Nachrichtenverlauf und Eingabe"
            >
              <header className="chat-header">
                <div>
                  <h2 className="panel-title">Chat mit Meda</h2>
                  <p className="panel-description">
                    Meda stellt Rückfragen und gibt dir am Ende eine
                    unverbindliche Empfehlung, welche Fachrichtung passend sein
                    könnte.
                  </p>
                </div>
                <div className="chat-header-badge">
                  <span className="status-dot" aria-hidden="true" />
                  <span className="status-label">Meda ist bereit</span>
                </div>
              </header>

              <section
                className="chatverlauf symptom-chatlog"
                role="log"
                aria-live="polite"
                aria-label="Bisherige Fragen und Antworten"
              >
                {verlauf.length === 0 && (
                  <p className="chat-placeholder">
                    Noch kein Verlauf vorhanden. Du kannst z. B. starten mit:
                    <br />
                    <span className="chat-placeholder-example">
                      „Seit gestern habe ich stechende Schmerzen im unteren
                      Rücken, vor allem beim Bücken.“
                    </span>
                  </p>
                )}

                {verlauf.map((nachricht, index) => {
                  const isUser = nachricht.role === "user";

                  return (
                    <article
                      key={index}
                      className={`chat-message-block ${
                        isUser
                          ? "chat-message-block--user"
                          : "chat-message-block--assistant"
                      }`}
                      aria-label={`Nachricht ${index + 1} von ${
                        isUser ? "dir" : "Meda"
                      }`}
                    >
                      {isUser ? (
                        <div className="message-bubble message-bubble--user">
                          <strong className="message-label">👤 Du:</strong>
                          <p className="message-text">{nachricht.content}</p>
                        </div>
                      ) : (
                        <div className="message-bubble message-bubble--meda">
                          <div className="message-header-row">
                            <strong className="message-label">
                              🩺 Meda:
                            </strong>

                            {/* 🔊 OpenAI-TTS über Backend */}
                            <SpeakButton
                              text={nachricht.content || ""}
                              className="tts-btn"
                              ariaLabel="Antwort von Meda vorlesen"
                            />
                          </div>

                          <p className="message-text">{nachricht.content}</p>
                        </div>
                      )}
                    </article>
                  );
                })}

                <div ref={chatEndRef} />
              </section>

              <div
                className="loading-row"
                aria-live="polite"
                aria-atomic="true"
              >
                {ladeStatus && (
                  <p className="loading-text">
                    ⏳ Meda analysiert deine Angaben …
                  </p>
                )}
              </div>

              <div className="eingabe-bereich symptom-input-area">
                <div className="eingabe-label-row">
                  <label
                    htmlFor="symptom-eingabe"
                    className="eingabe-label"
                  >
                    Dein Symptom in eigenen Worten
                  </label>
                  <span className="eingabe-hint">
                    Max. {MAX_CHARS} Zeichen
                  </span>
                </div>

                <textarea
                  id="symptom-eingabe"
                  ref={textareaRef}
                  className="chat-textarea"
                  placeholder="Beschreibe hier dein Symptom, z. B. Ort, Dauer, Stärke, Auslöser …"
                  value={eingabe}
                  maxLength={MAX_CHARS}
                  onChange={(e) =>
                    setEingabe(e.target.value.slice(0, MAX_CHARS))
                  }
                  onKeyDown={handleKeyDown}
                  rows={2}
                  aria-label="Symptombeschreibung eingeben"
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
                    <VoiceInput
                      onTranscribed={handleVoice}
                      className="voice-btn"
                    />
                  </div>

                  <button
                    type="button"
                    className="send-btn"
                    onClick={frageSenden}
                    aria-label="Symptombeschreibung senden"
                  >
                    <FaPaperPlane />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
