import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { useMicrophoneLevel } from "./useMicrophoneLevel";
import { useLocalTranscription } from "./useLocalTranscription";
import { useTextTranslation } from "./useTextTranslation";
import { useSpeechOutput } from "./useSpeechOutput";
import { getMltMessages } from "./medaLiveTranslation.i18n";
import "./MedaLiveTranslationPage.css";

const DURATION_S = 5 * 60;

/**
 * Available translation directions.
 * To add a new pair: append an entry here, add the pair to
 * server/routes/medaLiveTranslation.js ALLOWED_PAIRS, and add the human-
 * readable label to directionLabels in medaLiveTranslation.i18n.js.
 */
const LANG_PAIRS = [
  { id: "de-en", src: "de", tgt: "en", tts: "en-US" },
  { id: "en-de", src: "en", tgt: "de", tts: "de-DE" },
];

/**
 * @typedef {{ id: string, srcLang: string, tgtLang: string, sourceText: string,
 *   translatedText: string|null, needsClarification: boolean, error: string|null,
 *   status: 'pending'|'translated'|'unclear'|'error', timestamp: string }} ConvEntry
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

  const [direction, setDirection] = useState(LANG_PAIRS[0].id);
  const activePair = LANG_PAIRS.find((p) => p.id === direction) ?? LANG_PAIRS[0];
  const { src: srcLang, tgt: tgtLang, tts: ttsLang } = activePair;

  const { level, status, start, stop } = useMicrophoneLevel();
  const {
    isSupported: transcriptSupported,
    lines: transcriptLines,
    start: startTranscription,
    stop: stopTranscription,
    clear: clearTranscript,
  } = useLocalTranscription();
  const { isLoading: translationLoading, translate } = useTextTranslation();

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

  // Conversation state — each finalized transcript line becomes one entry
  const [conversation, setConversation] = useState(/** @type {ConvEntry[]} */ ([]));

  const translatedCountRef = useRef(0);
  const lastSpokenIdRef = useRef(/** @type {string|null} */ (null));
  const conversationEndRef = useRef(/** @type {HTMLDivElement|null} */ (null));

  const [secondsLeft, setSecondsLeft] = useState(DURATION_S);
  const timerRef = useRef(/** @type {ReturnType<typeof setInterval>|null} */ (null));

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

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

  const handleStart = useCallback(async () => {
    setSecondsLeft(DURATION_S);
    translatedCountRef.current = 0;
    lastSpokenIdRef.current = null;
    setConversation([]);
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

  // Countdown: starts when status becomes "active", stops otherwise
  useEffect(() => {
    if (status === "active") {
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearTimer();
            stop();
            return 0;
          }
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
          needsClarification: false, error: null, status: "pending", timestamp },
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
  }, [transcriptLines, translate, srcLang, tgtLang]);

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

  // Full cleanup on unmount
  useEffect(() => () => { stop(); stopTranscription(); stopSpeech(); }, [stop, stopTranscription, stopSpeech]);

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
  const isError  = status === "error";

  // Last successfully translated text for replay button
  const lastTranslatedText = conversation.filter((e) => e.status === "translated" && e.translatedText).at(-1)?.translatedText ?? null;

  return (
    <div className="mlt-page">
      <div className="mlt-card">
        <header className="mlt-card__header">
          <h1 className="mlt-card__title">{t.heading}</h1>
          <p className="mlt-card__sub">{t.sub}</p>
        </header>

        {/* Direction selector */}
        <div className="mlt-direction">
          <span className="mlt-direction__label">{t.directionLabel}</span>
          <div className="mlt-direction__btns" role="radiogroup" aria-label={t.directionLabel}>
            {LANG_PAIRS.map((pair) => (
              <button
                key={pair.id}
                type="button"
                role="radio"
                aria-checked={direction === pair.id}
                className={`mlt-direction__btn${direction === pair.id ? " mlt-direction__btn--active" : ""}`}
                onClick={() => handleDirectionChange(pair.id)}
                disabled={isActive}
              >
                {t.directionLabels[pair.id]}
              </button>
            ))}
          </div>
        </div>

        {/* Status — aria-live announces changes to screen readers */}
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

        {/* Audio level bar — visually animated; SR text hidden off-screen */}
        <div className="mlt-level" aria-label={t.levelLabel}>
          <div className="mlt-level__bar-track" aria-hidden="true">
            <div className="mlt-level__bar-fill" style={{ width: `${level}%` }} />
          </div>
          <span className="mlt-level__sr" aria-live="off" aria-atomic="true">
            {t.levelSrText(level)}
          </span>
        </div>

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
                conversation.map((entry) => (
                  <div key={entry.id} className={`mlt-conv-entry mlt-conv-entry--${entry.status}`}>
                    <div className="mlt-conv-entry__meta">
                      <span className="mlt-conv-entry__direction">
                        {t.directionLabels[`${entry.srcLang}-${entry.tgtLang}`] ??
                          `${entry.srcLang.toUpperCase()} → ${entry.tgtLang.toUpperCase()}`}
                      </span>
                      <span className="mlt-conv-entry__time">{entry.timestamp}</span>
                    </div>
                    <div className="mlt-conv-entry__row">
                      <span className="mlt-conv-entry__row-label">{t.originalLabel}</span>
                      <p className="mlt-conv-entry__text">{entry.sourceText}</p>
                    </div>
                    {entry.status === "pending" && (
                      <div className="mlt-conv-entry__row">
                        <span className="mlt-conv-entry__row-label">{t.translationLabelShort}</span>
                        <p className="mlt-conv-entry__loading">{t.translationLoading}</p>
                      </div>
                    )}
                    {entry.status === "translated" && (
                      <div className="mlt-conv-entry__row">
                        <span className="mlt-conv-entry__row-label">{t.translationLabelShort}</span>
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
                ))
              )}
              <div ref={conversationEndRef} />
            </div>
            <p className="mlt-conversation__disclaimer">{t.transcriptDisclaimer}</p>
          </div>
        ) : (
          <p className="mlt-transcript__unsupported">{t.transcriptNotSupported}</p>
        )}

        {/* Audio output controls */}
        <div className="mlt-audio">
          {!speechSupported ? (
            <p className="mlt-audio__unsupported">{t.audioNotSupported}</p>
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
              {audioEnabled && (
                <p className="mlt-audio__voice">
                  {t.voiceLabel}:{" "}
                  {selectedVoiceName === null
                    ? t.voiceNotLoadedLabel
                    : selectedVoiceName === undefined || selectedVoiceName === ""
                    ? t.defaultVoiceLabel
                    : selectedVoiceName}
                </p>
              )}
            </>
          )}
        </div>

        {/* Start / Stop */}
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

        {translationLoading && conversation.some((e) => e.status === "pending") && (
          <p className="mlt-translation__loading" aria-live="polite">
            {t.translationLoading}
          </p>
        )}

        {isError && (
          <p className="mlt-error" role="alert">
            {t.statusError}
          </p>
        )}
      </div>

      <Link to="/patient" className="mlt-back">
        ← {t.back}
      </Link>
    </div>
  );
}
