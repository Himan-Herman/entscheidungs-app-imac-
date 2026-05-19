import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaPaperPlane } from "react-icons/fa";

import "../styles/SymptomChat.css";
import "../styles/PatientChatInputDesktop.css";

import { useTheme } from "../ThemeMode";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations/index.js";
import { useOnlineStatus } from "../hooks/useOnlineStatus.js";
import DisclaimerShort from "../components/DisclaimerShort";
import VoiceInput from "../components/VoiceInput.jsx";
import SymptomChatThread from "../features/symptomCheck/components/SymptomChatThread.jsx";
import SymptomSummaryCard from "../features/symptomCheck/components/SymptomSummaryCard.jsx";
import { LOADING_MARKER } from "../features/symptomCheck/constants.js";
import {
  loadSymptomCheckState,
  persistSymptomConsent,
  useSymptomCheckChat,
} from "../features/symptomCheck/hooks/useSymptomCheckChat.js";

function interpolate(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  return out;
}

export default function SymptomChat() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const online = useOnlineStatus();
  const [searchParams] = useSearchParams();
  const organ = searchParams.get("organ");
  const organHint = organ ? organ.replace(/_/g, " ") : null;

  const initial = useMemo(() => loadSymptomCheckState(), []);
  const [consentOk, setConsentOk] = useState(initial.consentOk);
  const [consentDraft, setConsentDraft] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const textareaRef = useRef(null);

  const t = useMemo(() => {
    const bundle = getMessages(language);
    return bundle.symptomCheck ?? getMessages("en").symptomCheck;
  }, [language]);

  const chat = useSymptomCheckChat({
    initialVerlauf: initial.verlauf,
    initialThreadId: initial.threadId,
    initialSummary: initial.summary,
    organHint,
    language: language === "en" ? "en" : "de",
    t,
    consentOk,
  });

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  const threadLabels = useMemo(
    () => ({
      placeholderEmpty: t.placeholderEmpty,
      placeholderExample: t.placeholderExample,
      loadingLine: chat.isSummarizing ? t.summarizingLine : t.loadingLine,
      userLabel: t.userLabel,
      assistantLabel: t.assistantLabel,
      speakAria: t.speakAria,
      messageLabel: t.messageLabel,
      threadAria: t.threadAria,
    }),
    [chat.isSummarizing, t],
  );

  const voiceLabels = useMemo(
    () => ({
      micError: t.voiceMicError,
      transcriptionError: t.voiceTxError,
      start: t.voiceStart,
      stop: t.voiceStop,
    }),
    [t],
  );

  const maxLabel = interpolate(t.maxCharsLabel, { max: chat.maxChars });
  const canFinish =
    chat.userTurnCount >= 1 && !chat.isSending && !chat.isSummarizing;

  const errorMessage =
    chat.errorKey && t[chat.errorKey] ? t[chat.errorKey] : null;

  const buildExportText = useCallback(() => {
    return chat.verlauf
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          m.content &&
          m.content !== LOADING_MARKER,
      )
      .map((m) => {
        const label = m.role === "user" ? t.userLabel : t.assistantLabel;
        return `${label}:\n${m.content}\n`;
      })
      .join("\n---\n\n");
  }, [chat.verlauf, t.assistantLabel, t.userLabel]);

  const handleCopyConversation = useCallback(async () => {
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
  }, [buildExportText, t.copyDone, t.copyFail]);

  const handleDownloadTxt = useCallback(() => {
    const text = buildExportText().trim();
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medscoutx-symptom-check-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildExportText]);

  const handleVoice = (text) => {
    if (!text) return;
    chat.setEingabe((prev) =>
      (prev + (prev && !prev.endsWith(" ") ? " " : "") + text).slice(
        0,
        chat.maxChars,
      ),
    );
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void chat.sendMessage();
    }
  };

  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const hasExportable = chat.verlauf.some(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      m.content &&
      m.content !== LOADING_MARKER,
  );

  return (
    <main
      className={`symptom-check-page symptom-check-page--${theme}`}
      data-theme={theme}
      aria-labelledby="symptom-heading"
      role="main"
    >
      <div className="symptom-check-page__shell">
        <header className="symptom-check-page__header">
          <div className="symptom-check-page__header-text">
            <h1 id="symptom-heading" className="symptom-check-page__title">
              {t.heading}
            </h1>
            <p className="symptom-check-page__subtitle">{t.subtitle}</p>
          </div>
          <div className="symptom-check-page__meta" aria-hidden="true">
            <span className="symptom-check-chip symptom-check-chip--accent">
              {t.chipPrimary}
            </span>
            <span className="symptom-check-chip">{t.chipSecondary}</span>
          </div>
        </header>

        <section
          className="symptom-check-page__safety"
          role="region"
          aria-label={t.consentTitle}
        >
          <p>{t.storeSafetyNotice}</p>
        </section>

        <section className="symptom-check-page__disclaimer" aria-label="Disclaimer">
          <DisclaimerShort />
        </section>

        {!consentOk ? (
          <section
            className="symptom-check-consent"
            aria-labelledby="symptom-consent-title"
          >
            <h2 id="symptom-consent-title" className="symptom-check-consent__title">
              {t.consentTitle}
            </h2>
            <label className="symptom-check-consent__check">
              <input
                type="checkbox"
                checked={consentDraft}
                onChange={(e) => setConsentDraft(e.target.checked)}
              />
              <span>{t.consentCheckbox}</span>
            </label>
            <p className="symptom-check-consent__links">
              <Link to="/datenschutz">{t.consentPrivacyLink}</Link>
              {" · "}
              <Link to="/settings/privacy">{t.accountDataLink}</Link>
            </p>
            <button
              type="button"
              className="symptom-check-btn symptom-check-btn--primary"
              disabled={!consentDraft}
              onClick={() => {
                persistSymptomConsent();
                setConsentOk(true);
              }}
            >
              {t.consentContinue}
            </button>
          </section>
        ) : (
          <div className="symptom-check-layout">
            <aside
              className="symptom-check-panel symptom-check-panel--hints"
              aria-label={t.hintsTitle}
            >
              <h2 className="symptom-check-panel__title">{t.hintsTitle}</h2>
              <p className="symptom-check-panel__intro">{t.hintsIntro}</p>
              <ul className="symptom-check-tips">
                <li>{t.hintDuration}</li>
                <li>{t.hintLocation}</li>
                <li>{t.hintSeverity}</li>
                <li>{t.hintAssociated}</li>
              </ul>

              <div className="symptom-check-panel__actions">
                <button
                  type="button"
                  className="symptom-check-btn symptom-check-btn--ghost"
                  onClick={chat.resetAll}
                  aria-label={t.newChatAria}
                >
                  ↻ {t.newChat}
                </button>
                <button
                  type="button"
                  className="symptom-check-btn symptom-check-btn--ghost-danger"
                  onClick={chat.clearChat}
                  aria-label={t.clearHistoryAria}
                >
                  {t.clearHistory}
                </button>
              </div>

              {hasExportable ? (
                <div className="symptom-check-export">
                  <button
                    type="button"
                    className="symptom-check-btn symptom-check-btn--ghost"
                    onClick={() => void handleCopyConversation()}
                  >
                    {t.copyConversation}
                  </button>
                  <button
                    type="button"
                    className="symptom-check-btn symptom-check-btn--ghost"
                    onClick={handleDownloadTxt}
                  >
                    {t.downloadTxt}
                  </button>
                  {copyStatus ? (
                    <span className="symptom-check-export__status" role="status">
                      {copyStatus}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <p className="symptom-check-panel__privacy">
                {t.accountDataHint}{" "}
                <Link to="/settings/privacy">{t.accountDataLink}</Link>
              </p>
            </aside>

            <section
              className="symptom-check-panel symptom-check-panel--chat"
              aria-label={t.chatTitle}
            >
              {errorMessage ? (
                <p className="symptom-check-page__error" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <header className="symptom-check-chat__header">
                <div>
                  <h2 className="symptom-check-panel__title">{t.chatTitle}</h2>
                  <p className="symptom-check-panel__intro">{t.chatIntro}</p>
                </div>
                <div className="symptom-check-chat__status">
                  <span className="symptom-check-chat__status-dot" aria-hidden />
                  <span>{online ? t.statusReady : t.offlineBadge}</span>
                </div>
              </header>

              <SymptomChatThread messages={chat.verlauf} labels={threadLabels} />

              <div className="symptom-check-chat__finish">
                <button
                  type="button"
                  className="symptom-check-btn symptom-check-btn--primary"
                  disabled={!canFinish}
                  title={canFinish ? t.btnFinishTitle : t.btnFinishDisabledHint}
                  onClick={() => void chat.requestSummary()}
                >
                  {t.btnFinish}
                </button>
              </div>

              <div className="symptom-check-composer patient-chat-composer">
                <div className="symptom-check-composer__label-row">
                  <label htmlFor="symptom-eingabe" className="symptom-check-composer__label">
                    {t.inputLabel}
                  </label>
                  <span className="symptom-check-composer__hint">{maxLabel}</span>
                </div>

                <textarea
                  id="symptom-eingabe"
                  ref={textareaRef}
                  className="symptom-check-composer__textarea chat-textarea"
                  placeholder={t.inputPlaceholder}
                  value={chat.eingabe}
                  maxLength={chat.maxChars}
                  rows={2}
                  disabled={!consentOk || chat.isSending || chat.isSummarizing}
                  onChange={(e) =>
                    chat.setEingabe(e.target.value.slice(0, chat.maxChars))
                  }
                  onInput={(e) => autoResize(e.target)}
                  onKeyDown={handleKeyDown}
                  aria-label={t.inputLabel}
                />

                <div className="symptom-check-composer__actions">
                  <span
                    className={`symptom-check-composer__count ${
                      chat.eingabe.length >= chat.maxChars
                        ? "symptom-check-composer__count--limit"
                        : ""
                    }`}
                    aria-live="polite"
                  >
                    {chat.eingabe.length}/{chat.maxChars}
                  </span>
                  <div className="patient-chat-action-group">
                    <VoiceInput
                      onTranscribed={handleVoice}
                      labels={voiceLabels}
                      notice={t.micNotice}
                    />
                    <button
                      type="button"
                      className="symptom-check-composer__send send-btn"
                      disabled={
                        !consentOk ||
                        !online ||
                        !chat.eingabe.trim() ||
                        chat.isSending ||
                        chat.isSummarizing
                      }
                      onClick={() => void chat.sendMessage()}
                      aria-label={t.sendAria}
                    >
                      <FaPaperPlane aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {chat.summary ? (
              <SymptomSummaryCard summary={chat.summary} labels={t} />
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
