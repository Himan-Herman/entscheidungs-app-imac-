import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { useMicrophoneLevel } from "./useMicrophoneLevel";
import { useLocalTranscription } from "./useLocalTranscription";
import { useTextTranslation } from "./useTextTranslation";
import { useSpeechOutput } from "./useSpeechOutput";
import { getMltMessages } from "./medaLiveTranslation.i18n";
import { formatConversationExport } from "./formatConversationExport";
import "./MedaLiveTranslationPage.css";

const DURATION_S = 5 * 60;

/** Languages available for selection in setup. */
const SUPPORTED_LANGUAGES = ["de", "en"];

/**
 * All translation directions backed by the server.
 * To add a new pair: append an entry here, add the pair to
 * server/routes/medaLiveTranslation.js ALLOWED_PAIRS, and add the human-
 * readable label to directionLabels in medaLiveTranslation.i18n.js.
 */
const LANG_PAIRS = [
  { id: "de-en", src: "de", tgt: "en", tts: "en-US", speaker: "patient",  target: "practice" },
  { id: "en-de", src: "en", tgt: "de", tts: "de-DE", speaker: "practice", target: "patient"  },
];

/**
 * @typedef {{ id: string, srcLang: string, tgtLang: string, sourceText: string,
 *   translatedText: string|null, needsClarification: boolean, error: string|null,
 *   status: 'pending'|'translated'|'unclear'|'error', timestamp: string,
 *   speakerRole: 'patient'|'practice', targetRole: 'patient'|'practice' }} ConvEntry
 */

function playStartTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    osc.addEventListener("ended", () => void ctx.close());
  } catch {
    /* audio not critical */
  }
}

export default function MedaLiveTranslationPage() {
  const { language } = useLanguage();
  const t = useMemo(() => getMltMessages(language), [language]);

  // ── Setup state ────────────────────────────────────────────────────────────
  const [setupComplete, setSetupComplete] = useState(false);
  const [patientLanguage, setPatientLanguage] = useState("de");
  const [practiceLanguage, setPracticeLanguage] = useState("en");

  // Derived setup validation
  const patientDirection  = `${patientLanguage}-${practiceLanguage}`;
  const practiceDirection = `${practiceLanguage}-${patientLanguage}`;
  const sameLanguage  = patientLanguage === practiceLanguage;
  const pairSupported = LANG_PAIRS.some((p) => p.id === patientDirection);
  const setupValid    = !sameLanguage && pairSupported;

  // Helper: localized language name
  const getLangName = useCallback((lang) => {
    if (lang === "de") return t.languageDeutsch;
    if (lang === "en") return t.languageEnglish;
    return lang.toUpperCase();
  }, [t]);

  // ── Direction state (within active session) ────────────────────────────────
  const [direction, setDirection] = useState(LANG_PAIRS[0].id);
  const activePair = LANG_PAIRS.find((p) => p.id === direction) ?? LANG_PAIRS[0];
  const { src: srcLang, tgt: tgtLang, tts: ttsLang } = activePair;

  // Roles derived from setup context, not from LANG_PAIRS hardcoding
  const isPatientSpeaking = direction === patientDirection;
  const activeSpeaker = isPatientSpeaking ? "patient" : "practice";
  const activeTarget  = isPatientSpeaking ? "practice" : "patient";

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { level, status, start, stop } = useMicrophoneLevel();
  const {
    isSupported: transcriptSupported,
    lines: transcriptLines,
    start: startTranscription,
    stop: stopTranscription,
    clear: clearTranscript,
  } = useLocalTranscription();
  const { translate } = useTextTranslation();

  const {
    isSupported: speechSupported,
    enabled: audioEnabled,
    toggleEnabled: toggleAudio,
    autoSpeak,
    replay: replaySpeech,
    stopSpeech,
    resetSession: resetSpeechSession,
    speechStatus,
    selectedVoiceName,
  } = useSpeechOutput();

  // ── Conversation state ─────────────────────────────────────────────────────
  const [conversation, setConversation] = useState(/** @type {ConvEntry[]} */ ([]));

  const translatedCountRef     = useRef(0);
  const lastSpokenIdRef        = useRef(/** @type {string|null} */ (null));
  const conversationEndRef     = useRef(/** @type {HTMLDivElement|null} */ (null));
  const lastNotifiedEntryRef   = useRef(/** @type {string|null} */ (null));

  const [message, setMessage] = useState(/** @type {{type:"info"|"warning"|"error"|"success", text:string}|null} */ (null));
  const messageDismissTimerRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null));

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState(DURATION_S);
  const timerRef = useRef(/** @type {ReturnType<typeof setInterval>|null} */ (null));

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showMessage = useCallback((type, text, autoDismissMs = 0) => {
    if (messageDismissTimerRef.current) clearTimeout(messageDismissTimerRef.current);
    setMessage({ type, text });
    if (autoDismissMs > 0) {
      messageDismissTimerRef.current = setTimeout(() => setMessage(null), autoDismissMs);
    }
  }, []);

  const dismissMessage = useCallback(() => {
    if (messageDismissTimerRef.current) clearTimeout(messageDismissTimerRef.current);
    setMessage(null);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Start the interpreter after setup is confirmed. */
  const handleSetupStart = useCallback(() => {
    if (!setupValid) return;
    setDirection(patientDirection);
    setConversation([]);
    translatedCountRef.current = 0;
    lastSpokenIdRef.current = null;
    setSetupComplete(true);
  }, [setupValid, patientDirection]);

  /** Return to setup screen (only allowed when mic is not active). */
  const handleChangeLanguages = useCallback(() => {
    if (status === "active") return;
    if (conversation.length > 0 && !window.confirm(t.changeLanguagesConfirm)) return;
    stopSpeech();
    clearTranscript();
    resetSpeechSession();
    setConversation([]);
    translatedCountRef.current = 0;
    lastSpokenIdRef.current = null;
    setSetupComplete(false);
  }, [status, conversation.length, t.changeLanguagesConfirm, stopSpeech, clearTranscript, resetSpeechSession]);

  /** Switch who speaks (patient ↔ practice) within an active session. */
  const handleDirectionChange = useCallback((newDir) => {
    if (status === "active") return;
    stopSpeech();
    clearTranscript();
    resetSpeechSession();
    translatedCountRef.current = 0;
    lastSpokenIdRef.current = null;
    setConversation([]);
    setDirection(newDir);
  }, [status, stopSpeech, clearTranscript, resetSpeechSession]);

  /** Start a new session: keep languages, clear conversation and transcript. */
  const handleNewSession = useCallback(() => {
    if (status === "active") return;
    stopSpeech();
    clearTranscript();
    resetSpeechSession();
    setConversation([]);
    translatedCountRef.current = 0;
    lastSpokenIdRef.current = null;
    setSecondsLeft(DURATION_S);
  }, [status, stopSpeech, clearTranscript, resetSpeechSession]);

  /** Clear only the visible conversation log after user confirmation. */
  const handleClearConversation = useCallback(() => {
    if (status === "active") return;
    if (conversation.length === 0) return;
    if (!window.confirm(t.clearConversationConfirm)) return;
    setConversation([]);
    lastSpokenIdRef.current = null;
  }, [status, conversation.length, t.clearConversationConfirm]);

  const handleCopyConversation = useCallback(() => {
    if (status === "active" || conversation.length === 0) return;
    const text = formatConversationExport({
      conversation,
      patientLangName: getLangName(patientLanguage),
      practiceLangName: getLangName(practiceLanguage),
      t,
    });
    if (!navigator.clipboard) {
      showMessage("warning", t.messageExportUnavailable);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => showMessage("success", t.messageCopySuccess, 2500),
      () => showMessage("error",   t.messageCopyFailed,  3000)
    );
  }, [status, conversation, patientLanguage, practiceLanguage, getLangName, t, showMessage]);

  const handleDownloadConversation = useCallback(() => {
    if (status === "active" || conversation.length === 0) return;
    const text = formatConversationExport({
      conversation,
      patientLangName: getLangName(patientLanguage),
      practiceLangName: getLangName(practiceLanguage),
      t,
    });
    const dateStr = new Date().toISOString().slice(0, 10);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meda-gespraech-${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [status, conversation, patientLanguage, practiceLanguage, getLangName, t]);

  const handleStart = useCallback(async () => {
    setSecondsLeft(DURATION_S);
    resetSpeechSession();
    playStartTone();
    await start();
    startTranscription(srcLang);
  }, [start, startTranscription, resetSpeechSession, srcLang]);

  const handleStop = useCallback(() => {
    clearTimer();
    stop();
    stopTranscription();
    stopSpeech();
    setSecondsLeft(DURATION_S);
  }, [clearTimer, stop, stopTranscription, stopSpeech]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "active") {
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) { clearTimer(); stop(); return 0; }
          return s - 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [status, clearTimer, stop]);

  // For each new finalized transcript line: create a pending entry and translate
  useEffect(() => {
    const newLines = transcriptLines.slice(translatedCountRef.current);
    if (newLines.length === 0) return;
    translatedCountRef.current = transcriptLines.length;

    newLines.forEach((line) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      setConversation((prev) => [
        ...prev,
        { id, srcLang, tgtLang, sourceText: line, translatedText: null,
          needsClarification: false, error: null, status: "pending", timestamp,
          speakerRole: activeSpeaker, targetRole: activeTarget },
      ]);

      translate(line, srcLang, tgtLang, ({ translation, needsClarification: nc, error: err }) => {
        setConversation((prev) =>
          prev.map((e) =>
            e.id !== id ? e : {
              ...e,
              translatedText: nc || err ? null : translation,
              needsClarification: nc,
              error: err,
              status: err ? "error" : nc ? "unclear" : "translated",
            }
          )
        );
      });
    });
  }, [transcriptLines, translate, srcLang, tgtLang, activeSpeaker, activeTarget]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  // Auto-speak each new successfully translated entry
  useEffect(() => {
    const lastTranslated = conversation.filter((e) => e.status === "translated" && e.translatedText).at(-1);
    if (!lastTranslated || lastTranslated.id === lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = lastTranslated.id;
    autoSpeak(lastTranslated.translatedText, ttsLang);
  }, [conversation, autoSpeak, ttsLang]);

  // Auto-scroll conversation to bottom when new entries arrive
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Show a persistent error when microphone access is denied
  useEffect(() => {
    if (status === "error") showMessage("error", t.messageMicPermissionDenied);
  }, [status, t.messageMicPermissionDenied, showMessage]);

  // Show a brief notice when the last conversation entry becomes error or unclear
  useEffect(() => {
    const last = conversation.at(-1);
    if (!last) return;
    if (last.status !== "error" && last.status !== "unclear") return;
    const key = `${last.id}:${last.status}`;
    if (lastNotifiedEntryRef.current === key) return;
    lastNotifiedEntryRef.current = key;
    if (last.status === "error") showMessage("error", t.messageTranslationFailed, 4000);
    else showMessage("info", t.messageUnclearInput, 4000);
  }, [conversation, t.messageTranslationFailed, t.messageUnclearInput, showMessage]);

  // Full cleanup on unmount
  useEffect(() => () => {
    stop();
    stopTranscription();
    stopSpeech();
    if (messageDismissTimerRef.current) clearTimeout(messageDismissTimerRef.current);
  }, [stop, stopTranscription, stopSpeech]);

  // ── Derived display values ─────────────────────────────────────────────────

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const statusTextMap = {
    idle:    t.statusIdle,
    active:  t.statusActive,
    error:   t.statusError,
    stopped: t.statusStopped,
  };
  const statusText = statusTextMap[status] ?? t.statusIdle;
  const isActive = status === "active";

  const lastTranslatedText = conversation
    .filter((e) => e.status === "translated" && e.translatedText).at(-1)?.translatedText ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!setupComplete) {
    return (
      <div className="mlt-page">
        <div className="mlt-card mlt-setup-card">
          <header className="mlt-card__header">
            <h1 className="mlt-card__title">{t.heading}</h1>
            <p className="mlt-card__sub">{t.setupTitle}</p>
          </header>

          <div className="mlt-setup__fields">
            {/* Patient language */}
            <div className="mlt-setup__field">
              <label className="mlt-setup__label" htmlFor="mlt-patient-lang">
                {t.patientLanguageLabel}
              </label>
              <select
                id="mlt-patient-lang"
                className="mlt-setup__select"
                value={patientLanguage}
                onChange={(e) => setPatientLanguage(e.target.value)}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{getLangName(lang)}</option>
                ))}
              </select>
            </div>

            {/* Practice language */}
            <div className="mlt-setup__field">
              <label className="mlt-setup__label" htmlFor="mlt-practice-lang">
                {t.practiceLanguageLabel}
              </label>
              <select
                id="mlt-practice-lang"
                className="mlt-setup__select"
                value={practiceLanguage}
                onChange={(e) => setPracticeLanguage(e.target.value)}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{getLangName(lang)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Validation warnings */}
          <div aria-live="polite" aria-atomic="true">
            {sameLanguage && (
              <p className="mlt-setup__warning">{t.sameLanguageWarning}</p>
            )}
            {!sameLanguage && !pairSupported && (
              <p className="mlt-setup__warning">{t.unsupportedLanguagePairWarning}</p>
            )}
          </div>

          {/* Hint */}
          <p className="mlt-setup__hint">{t.setupHint}</p>

          {/* Start button */}
          <div className="mlt-actions">
            <button
              type="button"
              className="mlt-btn mlt-btn--start"
              onClick={handleSetupStart}
              disabled={!setupValid}
              aria-label={t.startInterpreterLabel}
              aria-disabled={!setupValid}
            >
              {t.startInterpreterLabel}
            </button>
          </div>
        </div>

        <Link to="/patient" className="mlt-back">← {t.back}</Link>
      </div>
    );
  }

  return (
    <div className="mlt-page">
      <div className="mlt-card">
        <header className="mlt-card__header">
          <h1 className="mlt-card__title">{t.heading}</h1>
        </header>

        {/* Session header — language summary + change button */}
        <div className="mlt-session-header">
          <span className="mlt-session-header__summary">
            {t.selectedLanguagesSummary(getLangName(patientLanguage), getLangName(practiceLanguage))}
          </span>
          <button
            type="button"
            className="mlt-session-header__change-btn"
            onClick={handleChangeLanguages}
            disabled={isActive}
            aria-label={t.changeLanguagesLabel}
          >
            {t.changeLanguagesLabel}
          </button>
        </div>

        {/* Who speaks now (patient ↔ practice) */}
        <div className="mlt-direction">
          <span className="mlt-direction__label">{t.directionLabel}</span>
          <div className="mlt-direction__btns" role="radiogroup" aria-label={t.directionLabel}>
            <button
              type="button"
              role="radio"
              aria-checked={direction === patientDirection}
              className={`mlt-direction__btn${direction === patientDirection ? " mlt-direction__btn--active" : ""}`}
              onClick={() => handleDirectionChange(patientDirection)}
              disabled={isActive}
            >
              <span className="mlt-direction__btn-lang">{t.patientToPracticeLabel}</span>
              <span className="mlt-direction__btn-role">{getLangName(patientLanguage)} → {getLangName(practiceLanguage)}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={direction === practiceDirection}
              className={`mlt-direction__btn${direction === practiceDirection ? " mlt-direction__btn--active" : ""}`}
              onClick={() => handleDirectionChange(practiceDirection)}
              disabled={isActive}
            >
              <span className="mlt-direction__btn-lang">{t.practiceToPatientLabel}</span>
              <span className="mlt-direction__btn-role">{getLangName(practiceLanguage)} → {getLangName(patientLanguage)}</span>
            </button>
          </div>
        </div>

        {/* Status */}
        <div
          className={`mlt-status mlt-status--${status}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="mlt-status__dot" aria-hidden="true" />
          <span className="mlt-status__text">{statusText}</span>
        </div>

        {/* Countdown timer */}
        <div className="mlt-timer" aria-label={t.timerLabel}>
          <span className="mlt-timer__display">{mm}:{ss}</span>
        </div>

        {/* Audio level bar */}
        <div className="mlt-level" aria-label={t.levelLabel}>
          <div className="mlt-level__bar-track" aria-hidden="true">
            <div className="mlt-level__bar-fill" style={{ width: `${level}%` }} />
          </div>
          <span className="mlt-level__sr" aria-live="off" aria-atomic="true">
            {t.levelSrText(level)}
          </span>
        </div>

        {/* Session controls */}
        <div className="mlt-session-controls" role="group" aria-label={t.conversationControlsLabel}>
          <button
            type="button"
            className="mlt-session-ctrl__btn"
            onClick={handleNewSession}
            disabled={isActive}
          >
            {t.newSessionLabel}
          </button>
          <button
            type="button"
            className="mlt-session-ctrl__btn"
            onClick={handleClearConversation}
            disabled={isActive || conversation.length === 0}
          >
            {t.clearConversationLabel}
          </button>
          <button
            type="button"
            className="mlt-session-ctrl__btn"
            onClick={handleCopyConversation}
            disabled={isActive || conversation.length === 0}
            aria-label={t.copyConversationLabel}
          >
            {t.copyConversationLabel}
          </button>
          <button
            type="button"
            className="mlt-session-ctrl__btn"
            onClick={handleDownloadConversation}
            disabled={isActive || conversation.length === 0}
            aria-label={t.downloadConversationLabel}
          >
            {t.downloadConversationLabel}
          </button>
        </div>

        {/* Unified message box */}
        {message && (
          <div
            className={`mlt-message mlt-message--${message.type}`}
            role={message.type === "error" ? "alert" : "status"}
            aria-live={message.type === "error" ? "assertive" : "polite"}
            aria-atomic="true"
          >
            <span className="mlt-message__text">{message.text}</span>
            {message.type !== "success" && (
              <button
                type="button"
                className="mlt-message__dismiss"
                onClick={dismissMessage}
                aria-label={t.messageDismissLabel}
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Conversation log */}
        {transcriptSupported ? (
          <div className="mlt-conversation">
            <span className="mlt-conversation__label">{t.conversationLabel}</span>
            <div
              className="mlt-conversation__scroll"
              role="log"
              aria-live="polite"
              aria-label={t.conversationLabel}
            >
              {conversation.length === 0 ? (
                <span className="mlt-conversation__empty">{t.emptyConversationLabel}</span>
              ) : (
                conversation.map((entry) => {
                  const targetRoleLabel = entry.targetRole === "patient" ? t.patientRoleLabel : t.practiceRoleLabel;
                  const roleFlow = entry.speakerRole === "patient"
                    ? t.patientToPracticeLabel
                    : t.practiceToPatientLabel;
                  return (
                    <div key={entry.id} className={`mlt-conv-entry mlt-conv-entry--${entry.status}`}>
                      <div className="mlt-conv-entry__meta">
                        <span className="mlt-conv-entry__direction">{roleFlow}</span>
                        <span className="mlt-conv-entry__time">{entry.timestamp}</span>
                      </div>
                      <div className="mlt-conv-entry__row">
                        <span className="mlt-conv-entry__row-label">{t.originalTextLabel}</span>
                        <p className="mlt-conv-entry__text">{entry.sourceText}</p>
                      </div>
                      {entry.status === "pending" && (
                        <div className="mlt-conv-entry__row">
                          <span className="mlt-conv-entry__row-label">{t.translationTextLabel}</span>
                          <p className="mlt-conv-entry__loading">{t.translationLoading}</p>
                        </div>
                      )}
                      {entry.status === "translated" && (
                        <div className="mlt-conv-entry__row">
                          <span className="mlt-conv-entry__row-label">{t.translationTextLabel}</span>
                          <p className="mlt-conv-entry__text mlt-conv-entry__text--translated">
                            {entry.translatedText}
                          </p>
                        </div>
                      )}
                      {entry.status === "unclear" && (
                        <p className="mlt-conv-entry__status-note mlt-conv-entry__status-note--unclear">
                          {t.unclearEntryLabel}
                        </p>
                      )}
                      {entry.status === "error" && (
                        <p className="mlt-conv-entry__status-note mlt-conv-entry__status-note--error">
                          {t.failedEntryLabel}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={conversationEndRef} />
            </div>
            <p className="mlt-session-hint">{t.localSessionHint}</p>
          </div>
        ) : (
          <p className="mlt-message mlt-message--warning">{t.messageTranscriptionUnsupported}</p>
        )}

        {/* Audio output controls */}
        <div className="mlt-audio">
          {!speechSupported ? (
            <p className="mlt-message mlt-message--info">{t.messageSpeechUnsupported}</p>
          ) : (
            <>
              <div className="mlt-audio__controls">
                <button
                  type="button"
                  className={`mlt-audio__toggle${audioEnabled ? " mlt-audio__toggle--on" : ""}`}
                  onClick={toggleAudio}
                  aria-pressed={audioEnabled}
                >
                  {audioEnabled ? t.audioDisable : t.audioEnable}
                </button>
                {audioEnabled && (
                  <>
                    <button
                      type="button"
                      className="mlt-audio__btn"
                      onClick={() => lastTranslatedText && replaySpeech(lastTranslatedText, ttsLang)}
                      disabled={!lastTranslatedText}
                      aria-label={t.audioReplay}
                    >
                      {t.audioReplay}
                    </button>
                    <button
                      type="button"
                      className="mlt-audio__btn mlt-audio__btn--stop"
                      onClick={stopSpeech}
                      disabled={speechStatus !== "speaking"}
                      aria-label={t.audioStopBtn}
                    >
                      {t.audioStopBtn}
                    </button>
                  </>
                )}
              </div>
              {audioEnabled && (
                <div
                  className="mlt-audio__status"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {speechStatus === "speaking"
                    ? t.audioStatusSpeaking
                    : speechStatus === "stopped"
                    ? t.audioStatusStopped
                    : t.audioStatusIdle}
                </div>
              )}
              {audioEnabled && selectedVoiceName && (
                <p className="mlt-audio__voice">{selectedVoiceName}</p>
              )}
            </>
          )}
        </div>

        {/* Start / Stop microphone */}
        <div className="mlt-actions">
          {!isActive ? (
            <button
              type="button"
              className="mlt-btn mlt-btn--start"
              onClick={handleStart}
              aria-label={t.btnStart}
            >
              {t.btnStart}
            </button>
          ) : (
            <button
              type="button"
              className="mlt-btn mlt-btn--stop"
              onClick={handleStop}
              aria-label={t.btnStop}
            >
              {t.btnStop}
            </button>
          )}
        </div>

      </div>

      <Link to="/patient" className="mlt-back">← {t.back}</Link>
    </div>
  );
}
