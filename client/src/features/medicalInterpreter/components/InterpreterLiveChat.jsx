import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  SPEAKER_DOCTOR,
  TURN_STATUS_TRANSLATED,
} from "../constants.js";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { useLanguage } from "../../../i18n/LanguageContext";

/**
 * ChatGPT-style live interpreter — minimal chrome, conversation-first.
 * @param {{
 *   session: import('../types.js').InterpreterSession;
 *   turns: import('../types.js').InterpreterTurn[];
 *   phase: 'ready'|'listening'|'transcribing'|'translating'|'speaking'|'busy';
 *   errorMessage?: string | null;
 *   micDenied?: boolean;
 *   onRetryMic?: () => void;
 *   onBack: (e: import('react').MouseEvent) => void;
 *   onEnd: () => void;
 *   onDownloadPdf: () => void;
 *   onDelete: () => void;
 *   endDisabled?: boolean;
 *   pdfDisabled?: boolean;
 *   deleteDisabled?: boolean;
 *   isExporting?: boolean;
 *   labels: object;
 * }} props
 */
export default function InterpreterLiveChat({
  session,
  turns,
  phase,
  errorMessage,
  micDenied = false,
  onRetryMic,
  onBack,
  onEnd,
  onDownloadPdf,
  onDelete,
  endDisabled = false,
  pdfDisabled = false,
  deleteDisabled = false,
  isExporting = false,
  labels: t,
}) {
  const { language: uiLanguage } = useLanguage();
  const scrollRef = useRef(null);
  const items = (turns ?? []).filter((turn) => turn.originalText?.trim());

  const patientLang = formatLanguageDisplayName(session.patientLanguage, uiLanguage);
  const doctorLang = formatLanguageDisplayName(session.doctorLanguage, uiLanguage);

  const phaseLabel =
    phase === "listening"
      ? t.chat.listening
      : phase === "transcribing"
        ? t.chat.transcribing
        : phase === "translating"
          ? t.chat.translating
          : phase === "speaking"
            ? t.chat.speaking
            : t.chat.ready;

  const phaseClass =
    phase === "listening"
      ? "interp-chat__phase--listening"
      : phase === "speaking"
        ? "interp-chat__phase--speaking"
        : phase === "transcribing" || phase === "translating" || phase === "busy"
          ? "interp-chat__phase--busy"
          : "interp-chat__phase--ready";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length, phase]);

  return (
    <main
      className="interp-chat medical-interpreter-page medical-interpreter-page--live interp-root"
      id="main-content"
    >
      <header className="interp-chat__header">
        <Link
          className="interp-chat__back"
          to="/patient/interpreter"
          onClick={onBack}
          aria-label={t.chrome.backToInterpreterHome}
        >
          ←
        </Link>
        <div className="interp-chat__title-block">
          <h1 className="interp-chat__title">{t.chat.liveTitle}</h1>
          <p className="interp-chat__langs">
            {patientLang} ↔ {doctorLang}
          </p>
        </div>
      </header>

      <div className="interp-chat__messages" ref={scrollRef} aria-live="polite">
        {!items.length ? (
          <p className="interp-chat__empty">{t.chat.empty}</p>
        ) : (
          <ol className="interp-chat__list">
            {items.map((turn) => {
              const isDoctor = turn.speaker === SPEAKER_DOCTOR;
              const roleLabel = isDoctor
                ? t.conversation.clinicianLabel
                : t.conversation.patientLabel;
              const isDone =
                turn.status === TURN_STATUS_TRANSLATED &&
                turn.translatedText?.trim();
              const isPending = !isDone;

              return (
                <li key={turn.turnId} className="interp-chat__exchange">
                  <article className="interp-chat__bubble interp-chat__bubble--source">
                    <span className="interp-chat__bubble-meta">
                      {roleLabel} · {formatLanguageDisplayName(turn.sourceLanguage, uiLanguage)}
                    </span>
                    <p dir="auto" lang={turn.sourceLanguage}>
                      {turn.originalText}
                    </p>
                  </article>
                  <article
                    className={[
                      "interp-chat__bubble",
                      "interp-chat__bubble--translation",
                      isPending ? "interp-chat__bubble--pending" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="interp-chat__bubble-meta">
                      {t.chat.translation} ·{" "}
                      {formatLanguageDisplayName(turn.targetLanguage, uiLanguage)}
                    </span>
                    <p dir="auto" lang={turn.targetLanguage}>
                      {isDone
                        ? turn.translatedText
                        : t.conversation.translationPending}
                    </p>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {errorMessage ? (
        <p className="interp-chat__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {micDenied ? (
        <div className="interp-chat__mic-denied">
          <p>{t.pushToTalk.micDenied}</p>
          {onRetryMic ? (
            <button type="button" className="interp-chat__btn" onClick={onRetryMic}>
              {t.pushToTalk.micRetry}
            </button>
          ) : null}
        </div>
      ) : null}

      <footer className="interp-chat__footer">
        <div className={`interp-chat__phase ${phaseClass}`} role="status">
          <span className="interp-chat__phase-dot" aria-hidden="true" />
          <span>{phaseLabel}</span>
        </div>
        <div className="interp-chat__actions">
          <button
            type="button"
            className="interp-chat__btn interp-chat__btn--ghost"
            onClick={onEnd}
            disabled={endDisabled}
          >
            {endDisabled ? t.sessionActions.endPreparing || t.chat.end : t.chat.end}
          </button>
          <button
            type="button"
            className="interp-chat__btn interp-chat__btn--primary"
            onClick={onDownloadPdf}
            disabled={pdfDisabled}
            aria-busy={isExporting}
          >
            {isExporting ? t.pdf.exportLoading : t.chat.pdf}
          </button>
          <button
            type="button"
            className="interp-chat__btn interp-chat__btn--danger"
            onClick={onDelete}
            disabled={deleteDisabled}
          >
            {t.chat.delete}
          </button>
        </div>
      </footer>
    </main>
  );
}
