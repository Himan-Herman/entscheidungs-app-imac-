import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { FaPaperPlane } from "react-icons/fa";

import "../styles/KoerperSymptomChat.css";
import "../styles/PatientChatComposer.css";
import "../styles/PatientChatInputDesktop.css";
import "../features/patientChatHistory/styles/PatientChatHistory.css";

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
import PatientChatHistoryPanel from "../features/patientChatHistory/components/PatientChatHistoryPanel.jsx";
import ConfirmDeleteDialog from "../features/patientChatHistory/components/ConfirmDeleteDialog.jsx";
import { CHAT_KIND_BODY_MAP } from "../features/patientChatHistory/constants.js";
import { usePatientChatHistory } from "../features/patientChatHistory/hooks/usePatientChatHistory.js";

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

  const organ = searchParams.get("organ");
  const organLabel = organ ? organ.replace(/_/g, " ") : "";
  const seite =
    searchParams.get("seite") ||
    sessionStorage.getItem("koerperSeite") ||
    "vorderseite";
  const locale = language === "en" ? "en" : "de";

  const tc = useMemo(() => {
    const b = getMessages(language);
    return b.bodyMap?.chat ?? getMessages("en").bodyMap.chat;
  }, [language]);

  const historyLabels = useMemo(() => {
    const h = getMessages(language).patientChatHistory ?? getMessages("en").patientChatHistory;
    return {
      ...h,
      defaultBodyMapTitle: tc.defaultRegionConversation,
      defaultSymptomTitle: "",
    };
  }, [language, tc.defaultRegionConversation]);

  const initialState = useMemo(
    () =>
      loadBodyMapChatState({
        organ,
        organLabel,
        seite,
        language: locale,
      }),
    [organ, organLabel, seite, locale],
  );

  const [regionFilterOn, setRegionFilterOn] = useState(true);
  const [confirmDeleteCurrent, setConfirmDeleteCurrent] = useState(false);

  const chat = useBodyMapChat({
    initialSessionId: initialState.sessionId,
    initialVerlauf: initialState.verlauf,
    initialThreadId: initialState.threadId,
    initialSummary: initialState.summary,
    organ,
    organLabel,
    seite,
    language: locale,
    tc,
  });

  const history = usePatientChatHistory({
    kind: CHAT_KIND_BODY_MAP,
    organFilter: regionFilterOn && organ ? organ : null,
    language: locale,
    labels: historyLabels,
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

  const handleNewConversation = useCallback(() => {
    chat.startNewConversation();
    history.refresh();
  }, [chat, history]);

  const handleOpenHistorySession = useCallback(
    (id) => {
      const session = chat.openSession(id);
      history.openSession(id);
      history.refresh();
      if (session?.organ) {
        const nextSeite = session.seite || "vorderseite";
        setSearchParams({ organ: session.organ, seite: nextSeite });
        sessionStorage.setItem("koerperSeite", nextSeite);
      }
    },
    [chat, history, setSearchParams],
  );

  const handleDeleteHistorySession = useCallback(
    (id) => {
      chat.deleteConversation(id);
      history.refresh();
    },
    [chat, history],
  );

  const handleDeleteCurrent = useCallback(() => {
    chat.deleteConversation(chat.sessionId);
    setConfirmDeleteCurrent(false);
    history.refresh();
  }, [chat, history]);

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
                onClick={handleNewConversation}
                title={tc.btnNewChatTitle}
                aria-label={tc.btnNewChatTitle}
              >
                ↻ {tc.btnNewChat}
              </button>
              <button
                type="button"
                className="body-map-btn body-map-btn--ghost-danger"
                onClick={() => setConfirmDeleteCurrent(true)}
                title={tc.btnClearHistoryTitle}
                aria-label={tc.btnClearHistoryTitle}
              >
                {tc.btnClearHistory}
              </button>
            </div>
          </header>

          <PatientChatHistoryPanel
            sessions={history.sessions}
            activeId={chat.sessionId}
            labels={historyLabels}
            language={locale}
            showRegionFilter={Boolean(organ)}
            regionFilterOn={regionFilterOn}
            onToggleRegionFilter={() => setRegionFilterOn((v) => !v)}
            onOpen={handleOpenHistorySession}
            onDelete={handleDeleteHistorySession}
          />

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

            <div className="patient-chat-composer__toolbar body-map-composer__actions">
              <span
                className={`patient-chat-composer__count body-map-composer__count ${
                  chat.eingabe.length >= chat.maxChars
                    ? "patient-chat-composer__count--limit body-map-composer__count--limit"
                    : ""
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
                  className="voice-wrap"
                  compact
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

        <ConfirmDeleteDialog
          open={confirmDeleteCurrent}
          title={historyLabels.deleteConfirmTitle}
          body={historyLabels.deleteConfirmBody}
          confirmLabel={historyLabels.deleteConfirmAction}
          cancelLabel={historyLabels.deleteCancel}
          onCancel={() => setConfirmDeleteCurrent(false)}
          onConfirm={handleDeleteCurrent}
        />
      </div>
    </main>
  );
}
