import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { FaPaperPlane } from "react-icons/fa";

import "../styles/KoerperSymptomChat.css";
import "../styles/PatientChatInputDesktop.css";

import { useTheme } from "../ThemeMode";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { readBodyMapConsent } from "../features/bodyMap/bodyMapSession";
import {
  loadBodyMapChatState,
  useBodyMapChat,
} from "../features/bodyMap/hooks/useBodyMapChat.js";
import BodyMapChatThread from "../features/bodyMap/components/BodyMapChatThread.jsx";
import BodyMapSummaryCard from "../features/bodyMap/components/BodyMapSummaryCard.jsx";
import DisclaimerShort from "../components/DisclaimerShort";
import VoiceInput from "../components/VoiceInput.jsx";

function interpolate(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  return out;
}

export default function KoerperSymptomChat() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef(null);

  const tc = useMemo(() => {
    const b = getMessages(language);
    return b.bodyMap?.chat ?? getMessages("en").bodyMap.chat;
  }, [language]);

  const initialState = useMemo(() => loadBodyMapChatState(), []);

  const organ = searchParams.get("organ");
  const organLabel = organ ? organ.replace(/_/g, " ") : "";
  const seite =
    searchParams.get("seite") ||
    sessionStorage.getItem("koerperSeite") ||
    "vorderseite";

  const chat = useBodyMapChat({
    initialVerlauf: initialState.verlauf,
    initialThreadId: initialState.threadId,
    initialSummary: initialState.summary,
    organ,
    organLabel,
    language: language === "en" ? "en" : "de",
    tc,
  });

  const voiceLabels = useMemo(
    () => ({
      micError: tc.voiceMicError,
      transcriptionError: tc.voiceTxError,
      start: tc.voiceStart,
      stop: tc.voiceStop,
    }),
    [tc],
  );

  const threadLabels = useMemo(
    () => ({
      placeholderEmpty: tc.placeholderEmpty,
      placeholderExample: tc.placeholderExample,
      loadingLine: chat.isSummarizing ? tc.summarizingLine : tc.loadingLine,
      userLabel: tc.userLabel,
      assistantLabel: tc.assistantLabel,
      speakAria: tc.speakAria,
      messageLabel: tc.messageLabel,
      threadAria: tc.threadAria,
    }),
    [chat.isSummarizing, tc],
  );

  useEffect(() => {
    document.title = tc.pageTitle;
  }, [tc.pageTitle]);

  useEffect(() => {
    if (!readBodyMapConsent()) {
      navigate("/region-start", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (location.state?.from) {
      sessionStorage.setItem("lastMapRoute", location.state.from);
    }
    if (seite) sessionStorage.setItem("koerperSeite", seite);
  }, [location.state?.from, seite]);

  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void chat.sendMessage();
    }
  };

  const handleVoice = (text) => {
    chat.setEingabe((text || "").slice(0, chat.maxChars));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const mapBackHref =
    seite === "rueckseite" ? "/rueckseite" : "/koerperregionen";

  const neustart = useCallback(() => {
    chat.resetAll();
    setSearchParams({});
    sessionStorage.removeItem("koerperSeite");
    sessionStorage.removeItem("lastMapRoute");
    navigate("/region-start", { replace: true, state: { fromReset: true } });
  }, [chat, navigate, setSearchParams]);

  const errorMessage =
    chat.errorKey && tc[chat.errorKey] ? tc[chat.errorKey] : null;

  const maxLabel = interpolate(tc.maxCharsLabel, { max: chat.maxChars });
  const canFinish = chat.userTurnCount >= 1 && !chat.isSending && !chat.isSummarizing;

  if (!organ) {
    return (
      <main
        className={`body-map-page body-map-page--${theme}`}
        data-theme={theme}
        role="main"
      >
        <div className="body-map-page__shell">
          <section className="body-map-empty" aria-labelledby="body-map-empty-title">
            <h1 id="body-map-empty-title">{tc.noRegionTitle}</h1>
            <p>{tc.noRegionBody}</p>
            <Link className="body-map-btn body-map-btn--primary" to="/region-start">
              {tc.noRegionCta}
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`body-map-page body-map-page--${theme}`}
      data-theme={theme}
      aria-labelledby="body-map-chat-title"
      role="main"
      dir="ltr"
    >
      <div className="body-map-page__shell">
        <header className="body-map-page__header">
          <div className="body-map-page__header-text">
            <p className="body-map-page__eyebrow">{tc.chip1}</p>
            <h1 id="body-map-chat-title" className="body-map-page__title">
              {tc.title}
            </h1>
            <p className="body-map-page__subtitle">{tc.subtitle}</p>
            <p className="body-map-page__privacy">
              {tc.accountDataHint}{" "}
              <Link to="/settings/privacy">{tc.accountDataLink}</Link>
            </p>
          </div>
          <div className="body-map-page__meta">
            <span className="body-map-chip body-map-chip--region" title={organLabel}>
              {tc.regionBadge}: {organLabel}
            </span>
            <Link
              className="body-map-btn body-map-btn--ghost"
              to={mapBackHref}
              aria-label={tc.backToMapAria}
            >
              {tc.backToMap}
            </Link>
          </div>
        </header>

        <section className="body-map-page__disclaimer" aria-label={tc.sectionChat}>
          <DisclaimerShort />
        </section>

        {errorMessage ? (
          <p className="body-map-page__error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <section
          className="body-map-chat-card"
          aria-label={tc.sectionChat}
        >
          <header className="body-map-chat-card__top">
            <h2 className="body-map-chat-card__title">{tc.chatHeading}</h2>
            <div className="body-map-chat-card__actions">
              <button
                type="button"
                className="body-map-btn body-map-btn--ghost"
                onClick={neustart}
                title={tc.btnNewChatTitle}
              >
                ↻ {tc.btnNewChat}
              </button>
              <button
                type="button"
                className="body-map-btn body-map-btn--ghost-danger"
                onClick={chat.clearChat}
                title={tc.btnClearHistoryTitle}
              >
                {tc.btnClearHistory}
              </button>
            </div>
          </header>

          <p className="body-map-chat-card__intro">{tc.chatIntro}</p>

          <BodyMapChatThread messages={chat.verlauf} labels={threadLabels} />

          <div className="body-map-chat-card__finish-row">
            <button
              type="button"
              className="body-map-btn body-map-btn--primary"
              disabled={!canFinish}
              title={canFinish ? tc.btnFinishTitle : tc.btnFinishDisabledHint}
              onClick={() => void chat.requestSummary()}
            >
              {tc.btnFinish}
            </button>
          </div>

          <div className="body-map-composer patient-chat-composer">
            <div className="body-map-composer__label-row">
              <label htmlFor="koerper-eingabe" className="body-map-composer__label">
                {tc.inputLabel}
              </label>
              <span className="body-map-composer__hint">{maxLabel}</span>
            </div>

            <p className="body-map-composer__region-hint">
              <strong>{tc.organHintIntro}</strong>{" "}
              <span>{interpolate(tc.organHintExample, { region: organLabel })}</span>{" "}
              {tc.organHintOutro}
            </p>

            <textarea
              id="koerper-eingabe"
              ref={inputRef}
              className="body-map-composer__textarea chat-textarea"
              placeholder={tc.inputPlaceholder}
              value={chat.eingabe}
              maxLength={chat.maxChars}
              rows={1}
              disabled={chat.isSending || chat.isSummarizing}
              onChange={(e) =>
                chat.setEingabe(e.target.value.slice(0, chat.maxChars))
              }
              onInput={(e) => autoResize(e.target)}
              onKeyDown={handleKeyDown}
              aria-label={tc.inputLabel}
            />

            <div className="body-map-composer__actions">
              <span
                className={`body-map-composer__count ${
                  chat.eingabe.length >= chat.maxChars ? "body-map-composer__count--limit" : ""
                }`}
                aria-live="polite"
              >
                {chat.eingabe.length}/{chat.maxChars}
              </span>
              <div className="patient-chat-action-group">
                <VoiceInput
                  onTranscribed={handleVoice}
                  notice={tc.micNotice}
                  labels={voiceLabels}
                />
                <button
                  type="button"
                  className="body-map-composer__send send-btn"
                  onClick={() => void chat.sendMessage()}
                  disabled={chat.isSending || chat.isSummarizing}
                  aria-label={tc.sendAria}
                >
                  <FaPaperPlane aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {chat.summary ? (
          <BodyMapSummaryCard summary={chat.summary} labels={tc} />
        ) : null}
      </div>
    </main>
  );
}
