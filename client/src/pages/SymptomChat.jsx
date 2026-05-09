import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../styles/SymptomChat.css";

import { useTheme } from "../ThemeMode";
import { getOrganPrompt } from "./prompt/organPrompts";
import { authFetch } from "../api/authFetch";
import DisclaimerShort from "../components/DisclaimerShort";
import VoiceInput from "../components/VoiceInput.jsx";
import { FaPaperPlane } from "react-icons/fa";
import SpeakButton from "../components/SpeakButton.jsx";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations/index.js";
import { useOnlineStatus } from "../hooks/useOnlineStatus.js";

const LS_VERLAUF_KEY = "symptomVerlauf";
const LS_THREAD_KEY = "symptomThreadId";
const LS_CONSENT_KEY = "medscoutx_symptom_check_ack_v1";
const MAX_CHARS = 1200;
const LOADING_MARKER = "__symptom_check_loading__";

export default function SymptomChat() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const online = useOnlineStatus();

  const t = useMemo(() => {
    const bundle = getMessages(language);
    return bundle.symptomCheck ?? getMessages("en").symptomCheck;
  }, [language]);

  const [eingabe, setEingabe] = useState("");
  const [verlauf, setVerlauf] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [consentOk, setConsentOk] = useState(() => {
    try {
      return localStorage.getItem(LS_CONSENT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [consentDraft, setConsentDraft] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [searchParams] = useSearchParams();
  const organ = searchParams.get("organ");

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const lastPersistedVerlaufJson = useRef(null);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [verlauf]);

  useEffect(() => {
    if (!consentOk) return;

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
      console.warn("[SymptomChat] could not read history:", e);
      localStorage.removeItem(LS_VERLAUF_KEY);
    }

    if (initialVerlauf.length === 0 && organ) {
      const prompt = getOrganPrompt(organ);
      if (prompt) {
        initialVerlauf = [{ role: "assistant", content: prompt }];
      }
    }

    setVerlauf(initialVerlauf);
    lastPersistedVerlaufJson.current = JSON.stringify(initialVerlauf);

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
      setThreadId(null);
    }
  }, [consentOk, organ]);

  useEffect(() => {
    if (!consentOk) return;
    const snap = JSON.stringify(verlauf);
    if (snap === lastPersistedVerlaufJson.current) return;
    lastPersistedVerlaufJson.current = snap;
    try {
      localStorage.setItem(LS_VERLAUF_KEY, snap);
    } catch (e) {
      console.warn("[SymptomChat] could not persist history:", e);
    }
  }, [verlauf, consentOk]);

  const handleVoice = (text) => {
    if (!text) return;
    setEingabe((prev) =>
      (
        prev +
        (prev && !prev.endsWith(" ") ? " " : "") +
        text
      ).slice(0, MAX_CHARS),
    );
    textareaRef.current?.focus();
  };

  function persistConsent() {
    try {
      localStorage.setItem(LS_CONSENT_KEY, "1");
    } catch {
      /* ignore */
    }
    setConsentOk(true);
  }

  function buildExportText() {
    return verlauf
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.content !== LOADING_MARKER))
      .map((m) => {
        const label = m.role === "user" ? t.userLabel : t.assistantLabel;
        return `${label}:\n${m.content}\n`;
      })
      .join("\n---\n\n");
  }

  async function handleCopyConversation() {
    setCopyStatus("");
    const text = buildExportText().trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(t.copyDone);
    } catch {
      setCopyStatus(t.copyFail);
    }
    window.setTimeout(() => setCopyStatus(""), 4000);
  }

  function handleDownloadTxt() {
    const text = buildExportText().trim();
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medscoutx-symptom-check-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const frageSenden = async () => {
    if (!consentOk || !eingabe.trim()) return;
    if (!online) {
      window.alert(t.offlineError);
      return;
    }

    const aktuelleFrage = eingabe.trim();
    const neueFrage = { role: "user", content: aktuelleFrage };
    const neuerVerlauf = [...verlauf, neueFrage];

    setVerlauf([
      ...neuerVerlauf,
      { role: "assistant", content: LOADING_MARKER },
    ]);
    setEingabe("");

    try {
      const response = await authFetch("/api/textsymptom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ verlauf: neuerVerlauf, threadId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.fehler || "request_failed");
      }

      if (data.threadId) {
        setThreadId(data.threadId);
        localStorage.setItem(LS_THREAD_KEY, data.threadId);
      }

      const verlaufOhneLadeanzeige = [...neuerVerlauf];
      verlaufOhneLadeanzeige.push({
        role: "assistant",
        content: data.antwort || t.serverError,
      });
      setVerlauf(verlaufOhneLadeanzeige);
    } catch (error) {
      console.error("[SymptomChat]", error);
      const verlaufMitFehler = [...neuerVerlauf];
      verlaufMitFehler.push({
        role: "assistant",
        content: t.serverError,
      });
      setVerlauf(verlaufMitFehler);
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
      console.warn("[SymptomChat] could not clear history:", e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void frageSenden();
    }
  };

  const zeichenAnzahl = eingabe.length;
  const maxCharsHint = t.maxCharsLabel.replace("{{max}}", String(MAX_CHARS));
  const hasExportable = verlauf.some(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      m.content &&
      m.content !== LOADING_MARKER,
  );

  const voiceLabels = {
    start: t.voiceStart,
    stop: t.voiceStop,
    micError: t.voiceMicError,
    transcriptionError: t.voiceTxError,
  };

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
              {t.heading}
            </h1>
            <p className="symptom-subtitle">{t.subtitle}</p>
          </div>
          <div className="symptom-header-meta" aria-hidden="true">
            <span className="chip chip--accent">{t.chipPrimary}</span>
            <span className="chip chip--soft">{t.chipSecondary}</span>
          </div>
        </header>

        <section className="symptom-store-safety" role="region" aria-label={t.consentTitle}>
          <p className="symptom-store-safety__text">{t.storeSafetyNotice}</p>
        </section>

        <section className="symptom-disclaimer-section" aria-label="Disclaimer">
          <DisclaimerShort />
        </section>

        {!consentOk ? (
          <section className="symptom-consent-card" aria-labelledby="symptom-consent-title">
            <h2 id="symptom-consent-title" className="symptom-consent-card__title">
              {t.consentTitle}
            </h2>
            <label className="symptom-consent-card__check">
              <input
                type="checkbox"
                checked={consentDraft}
                onChange={(e) => setConsentDraft(e.target.checked)}
              />
              <span>{t.consentCheckbox}</span>
            </label>
            <p className="symptom-consent-card__links">
              <Link to="/datenschutz">{t.consentPrivacyLink}</Link>
              {" · "}
              <Link to="/settings/privacy">{t.accountDataLink}</Link>
            </p>
            <button
              type="button"
              className="symptom-consent-card__cta"
              disabled={!consentDraft}
              onClick={persistConsent}
            >
              {t.consentContinue}
            </button>
          </section>
        ) : null}

        {consentOk ? (
        <div className="symptom-layout">
          <section className="symptom-panel symptom-panel--hints" aria-label={t.hintsTitle}>
            <h2 className="panel-title">{t.hintsTitle}</h2>
            <p className="panel-description">{t.hintsIntro}</p>
            <ul className="tip-list">
              <li>{t.hintDuration}</li>
              <li>{t.hintLocation}</li>
              <li>{t.hintSeverity}</li>
              <li>{t.hintAssociated}</li>
            </ul>

            <div className="hint-button-row">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={resetChat}
                aria-label={t.newChatAria}
              >
                <span className="icon" aria-hidden="true">
                  ↻
                </span>
                <span>{t.newChat}</span>
              </button>

              <button
                type="button"
                className="btn btn--ghost-danger"
                onClick={clearVerlauf}
                aria-label={t.clearHistoryAria}
              >
                <span className="icon" aria-hidden="true">
                  🧹
                </span>
                <span>{t.clearHistory}</span>
              </button>
            </div>

            {hasExportable ? (
              <div className="symptom-export-row">
                <button type="button" className="btn btn--ghost" onClick={() => void handleCopyConversation()}>
                  {t.copyConversation}
                </button>
                <button type="button" className="btn btn--ghost" onClick={handleDownloadTxt}>
                  {t.downloadTxt}
                </button>
                {copyStatus ? (
                  <span className="symptom-export-row__status" role="status">
                    {copyStatus}
                  </span>
                ) : null}
              </div>
            ) : null}

            <p className="symptom-account-hint">
              {t.accountDataHint}{" "}
              <Link to="/settings/privacy">{t.accountDataLink}</Link>
            </p>
          </section>

          <section className="symptom-panel symptom-panel--chat" aria-label={t.chatTitle}>
            <div className="chat-card" role="group" aria-label={t.chatTitle}>
              <header className="chat-header">
                <div>
                  <h2 className="panel-title">{t.chatTitle}</h2>
                  <p className="panel-description">{t.chatIntro}</p>
                </div>
                <div className="chat-header-badge">
                  <span className="status-dot" aria-hidden="true" />
                  <span className="status-label">{online ? t.statusReady : t.offlineBadge}</span>
                </div>
              </header>

              <section
                className="chatverlauf symptom-chatlog"
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                aria-label={t.chatTitle}
              >
                {verlauf.length === 0 && (
                  <p className="chat-placeholder">
                    {t.placeholderEmpty}
                    <br />
                    <span className="chat-placeholder-example">{t.placeholderExample}</span>
                  </p>
                )}

                {verlauf.map((nachricht, index) => {
                  const isUser = nachricht.role === "user";
                  const isLoading = nachricht.role === "assistant" && nachricht.content === LOADING_MARKER;

                  return (
                    <article
                      key={index}
                      className={`chat-message-block ${
                        isUser ? "chat-message-block--user" : "chat-message-block--assistant"
                      }`}
                      aria-label={`${index + 1} ${isUser ? t.userLabel : t.assistantLabel}`}
                    >
                      {isUser ? (
                        <div className="message-bubble message-bubble--user">
                          <strong className="message-label">{t.userLabel}:</strong>
                          <p className="message-text">{nachricht.content}</p>
                        </div>
                      ) : (
                        <div className="message-bubble message-bubble--meda">
                          <div className="message-header-row">
                            <strong className="message-label">{t.assistantLabel}:</strong>
                            {!isLoading ? (
                              <SpeakButton
                                text={nachricht.content || ""}
                                className="tts-btn"
                                ariaLabel={t.speakAria}
                              />
                            ) : null}
                          </div>

                          <p className="message-text">
                            {isLoading ? <span className="symptom-loading-dots">{t.thinking}</span> : nachricht.content}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}

                <div ref={chatEndRef} />
              </section>

              <div className="eingabe-bereich symptom-input-area">
                <div className="eingabe-label-row">
                  <label htmlFor="symptom-eingabe" className="eingabe-label">
                    {t.inputLabel}
                  </label>
                  <span className="eingabe-hint">{maxCharsHint}</span>
                </div>

                <textarea
                  id="symptom-eingabe"
                  ref={textareaRef}
                  className="chat-textarea"
                  placeholder={t.inputPlaceholder}
                  value={eingabe}
                  maxLength={MAX_CHARS}
                  disabled={!consentOk}
                  onChange={(e) => setEingabe(e.target.value.slice(0, MAX_CHARS))}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  aria-label={t.inputLabel}
                />

                <div className="eingabe-actions">
                  <span
                    className={`char-count ${zeichenAnzahl >= MAX_CHARS ? "limit" : ""}`}
                    aria-live="polite"
                  >
                    {zeichenAnzahl}/{MAX_CHARS}
                  </span>

                  <div className="voice-wrap">
                    <VoiceInput
                      onTranscribed={handleVoice}
                      className="voice-input-wrap"
                      labels={voiceLabels}
                      notice={consentOk ? t.micNotice : undefined}
                    />
                  </div>

                  <button
                    type="button"
                    className="send-btn"
                    disabled={!consentOk || !online || !eingabe.trim()}
                    onClick={() => void frageSenden()}
                    aria-label={t.sendAria}
                  >
                    <FaPaperPlane />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
        ) : null}
      </div>
    </main>
  );
}
