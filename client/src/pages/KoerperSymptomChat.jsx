// src/pages/KoerperSymptomChat.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  useSearchParams,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";

import "../styles/KoerperSymptomChat.css";

import { useTheme } from "../ThemeMode";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { readBodyMapConsent } from "../features/bodyMap/bodyMapSession";
import DisclaimerShort from "../components/DisclaimerShort";
import VoiceInput from "../components/VoiceInput.jsx";
import { FaPaperPlane } from "react-icons/fa";
import { authFetch } from "../api/authFetch";
import SpeakButton from "../components/SpeakButton";

const THREAD_API = "/api/koerpersymptomthread";
const LS_CHAT_KEY = "koerperChatVerlauf";
const LS_THREAD_KEY = "koerperThreadId";
const MAX_CHARS = 1200;

function interpolateRegion(template, region) {
  return template.replace(/\{\{region\}\}/g, region);
}

function interpolateMax(template, max) {
  return template.replace(/\{\{max\}\}/g, String(max));
}

function introExistsForOrgan(messages, organKey) {
  return messages.some(
    (m) =>
      m.role === "assistant" &&
      (m.bodyMapIntro === true && m.introOrgan === organKey),
  );
}

export default function KoerperSymptomChat() {
  const { theme } = useTheme();
  const { language } = useLanguage();

  const tc = useMemo(() => {
    const b = getMessages(language);
    return b.bodyMap?.chat ?? getMessages("en").bodyMap.chat;
  }, [language]);

  const voiceLabels = useMemo(
    () => ({
      micError: tc.voiceMicError,
      transcriptionError: tc.voiceTxError,
      start: tc.voiceStart,
      stop: tc.voiceStop,
    }),
    [tc],
  );

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

  const organLabel = organ ? organ.replace(/_/g, " ") : "";

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

  useEffect(() => {
    document.title = tc.pageTitle;
  }, [tc.pageTitle]);

  useEffect(() => {
    if (!readBodyMapConsent()) {
      navigate("/region-start", { replace: true });
    }
  }, [navigate]);

  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    const maxH = 160;
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  };

  useEffect(() => {
    if (location.state?.from) {
      sessionStorage.setItem("lastMapRoute", location.state.from);
    }
    if (seite) {
      sessionStorage.setItem("koerperSeite", seite);
    }
  }, [seite, location]);

  useEffect(() => {
    if (fromReset) {
      sessionStorage.removeItem("koerperSeite");
      sessionStorage.removeItem("lastMapRoute");
    }
  }, [fromReset]);

  useEffect(() => {
    if (!organ) return;

    if (introExistsForOrgan(verlauf, organ)) {
      lastIntroOrganRef.current = organ;
      return;
    }

    if (lastIntroOrganRef.current !== organ) {
      const neueStartFrage = {
        role: "assistant",
        content: interpolateRegion(tc.introAssistant, organLabel),
        bodyMapIntro: true,
        introOrgan: organ,
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

  useEffect(() => {
    try {
      localStorage.setItem(LS_CHAT_KEY, JSON.stringify(verlauf));
    } catch (e) {
      console.warn("[LS write] koerperChatVerlauf fehlgeschlagen:", e);
    }
  }, [verlauf]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [verlauf]);

  const frageSenden = async (textOverride) => {
    const raw = typeof textOverride === "string" ? textOverride : eingabe;
    const aktuelleFrage = (raw || "").trim();
    if (!aktuelleFrage || isSending) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setVerlauf((prev) => [
        ...prev,
        { role: "assistant", content: tc.offlineError },
      ]);
      return;
    }

    const userMsg = { role: "user", content: aktuelleFrage };
    const basisVerlauf = [...verlauf, userMsg];

    const mitUhr = [
      ...basisVerlauf,
      {
        role: "assistant",
        content: tc.loadingLine,
      },
    ];
    setVerlauf(mitUhr);
    setEingabe("");
    setIsSending(true);

    try {
      const payload = {
        threadId: threadId || null,
        organName: organ || organLabel,
        verlauf:
          !threadId && organ
            ? [
                {
                  role: "user",
                  content: `[Body map — visit preparation] Marked region: "${organ}". Neutral notes only; no diagnosis.`,
                },
                userMsg,
              ]
            : [userMsg],
      };

      const response = await authFetch(THREAD_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error("[Thread API] HTTP", response.status);
        const fertigFehler = [
          ...basisVerlauf,
          {
            role: "assistant",
            content: tc.httpError,
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
          content: tc.serverError,
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

  const handleVoice = (text) => {
    setEingabe((text || "").slice(0, MAX_CHARS));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

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
      localStorage.removeItem(LS_CHAT_KEY);
    } catch (e) {
      console.warn("[LS remove] koerperChatVerlauf löschen fehlgeschlagen:", e);
    }

    if (organ) {
      const neueStartFrage = {
        role: "assistant",
        content: interpolateRegion(tc.introAssistant, organLabel),
        bodyMapIntro: true,
        introOrgan: organ,
      };

      const neu = [neueStartFrage];
      setVerlauf(neu);

      lastIntroOrganRef.current = organ;

      try {
        localStorage.setItem(LS_CHAT_KEY, JSON.stringify(neu));
      } catch (e) {
        console.warn("[LS write] koerperChatVerlauf nach Reset fehlgeschlagen:", e);
      }
    } else {
      setVerlauf([]);
    }
  };

  const zeichenAnzahl = eingabe.length;
  const maxLabel = interpolateMax(tc.maxCharsLabel, MAX_CHARS);

  return (
    <main
      className={`koerper-page koerper-page--${theme}`}
      data-theme={theme}
      aria-labelledby="koerper-heading"
      role="main"
      dir="ltr"
    >
      <div className="koerper-shell">
        <header className="koerper-header">
          <div className="koerper-header-text">
            <h1 id="koerper-heading" className="koerper-title">
              {tc.title}
            </h1>
            <p className="koerper-subtitle">{tc.subtitle}</p>
            <p className="koerper-organ-hint">
              {tc.accountDataHint}{" "}
              <Link to="/settings/privacy">{tc.accountDataLink}</Link>
            </p>
          </div>
          <div className="koerper-header-meta" aria-hidden="true">
            <span className="chip chip--accent">{tc.chip1}</span>
            <span className="chip chip--soft">{tc.chip2}</span>
          </div>
        </header>

        <section
          className="koerper-disclaimer-section"
          aria-label={tc.sectionChat}
        >
          <DisclaimerShort />
        </section>

        <section
          className="symptomchat-container"
          aria-label={tc.sectionChat}
        >
          <header className="chat-top-row">
            <h2 className="chat-title">{tc.chatHeading}</h2>
            <div className="chat-top-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={neustart}
                title={tc.btnNewChatTitle}
              >
                ↻ {tc.btnNewChat}
              </button>

              <button
                type="button"
                className="btn btn--ghost-danger"
                onClick={clearVerlauf}
                title={tc.btnClearHistoryTitle}
              >
                🧹 {tc.btnClearHistory}
              </button>
            </div>
          </header>

          <p className="koerper-chat-intro">{tc.chatIntro}</p>

          <div
            className="chatverlauf"
            ref={chatRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {verlauf.length === 0 && (
              <p className="chat-placeholder">
                {tc.placeholderEmpty}
                <br />
                <span className="chat-placeholder-example">
                  {tc.placeholderExample}
                </span>
              </p>
            )}

            {verlauf.map((nachricht, index) => {
              const isUser = nachricht.role === "user";
              return (
                <article
                  key={index}
                  className={`chat-bubble ${isUser ? "user" : "assistant"}`}
                  aria-label={`${index + 1}: ${isUser ? tc.userLabel : tc.assistantLabel}`}
                >
                  {isUser ? (
                    <>
                      <strong className="bubble-label">
                        {tc.userLabel}:
                      </strong>
                      <p className="bubble-text">{nachricht.content}</p>
                    </>
                  ) : (
                    <>
                      <div className="bubble-header-row">
                        <strong className="bubble-label">
                          {tc.assistantLabel}:
                        </strong>
                        <SpeakButton
                          text={nachricht.content || ""}
                          className="tts-btn"
                          ariaLabel={tc.speakAria}
                        />
                      </div>
                      <p className="bubble-text">{nachricht.content}</p>
                    </>
                  )}
                </article>
              );
            })}
          </div>

          <div className="eingabe-bereich">
            <div className="eingabe-label-row">
              <label htmlFor="koerper-eingabe" className="eingabe-label">
                {tc.inputLabel}
              </label>
              <span className="eingabe-hint">{maxLabel}</span>
            </div>

            {organ ? (
              <p className="koerper-organ-hint">
                <strong>{tc.organHintIntro}</strong>{" "}
                <span className="koerper-organ-example">
                  {interpolateRegion(tc.organHintExample, organLabel)}
                </span>{" "}
                {tc.organHintOutro}
              </p>
            ) : null}

            <textarea
              id="koerper-eingabe"
              ref={inputRef}
              className="chat-textarea"
              placeholder={tc.inputPlaceholder}
              value={eingabe}
              maxLength={MAX_CHARS}
              rows={1}
              onChange={(e) =>
                setEingabe(e.target.value.slice(0, MAX_CHARS))
              }
              onInput={(e) => autoResize(e.target)}
              onKeyDown={handleKeyDown}
              aria-label={tc.inputLabel}
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
                  notice={tc.micNotice}
                  labels={voiceLabels}
                />
              </div>

              <button
                type="button"
                className="send-btn"
                onClick={() => frageSenden()}
                disabled={isSending}
                aria-label={tc.sendAria}
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
