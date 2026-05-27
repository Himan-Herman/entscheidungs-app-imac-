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

  const { level, status, start, stop } = useMicrophoneLevel();
  const {
    isSupported: transcriptSupported,
    lines: transcriptLines,
    start: startTranscription,
    stop: stopTranscription,
  } = useLocalTranscription();
  const {
    translations,
    isLoading: translationLoading,
    error: translationError,
    translate,
    clear: clearTranslations,
  } = useTextTranslation();

  const {
    isSupported: speechSupported,
    enabled: audioEnabled,
    toggleEnabled: toggleAudio,
    autoSpeak,
    replay: replaySpeech,
    stopSpeech,
    resetSession: resetSpeechSession,
    speechStatus,
  } = useSpeechOutput();

  const translatedCountRef = useRef(0);
  const spokenCountRef = useRef(0);

  const [secondsLeft, setSecondsLeft] = useState(DURATION_S);
  const timerRef = useRef(/** @type {ReturnType<typeof setInterval>|null} */ (null));

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(async () => {
    setSecondsLeft(DURATION_S);
    translatedCountRef.current = 0;
    spokenCountRef.current = 0;
    clearTranslations();
    resetSpeechSession();
    playStartTone();
    await start();
    startTranscription(language);
  }, [start, startTranscription, clearTranslations, resetSpeechSession, language]);

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

  // Auto-translate every newly finalized transcript line (de→en only for Phase 3)
  useEffect(() => {
    if (language !== "de") return;
    const newLines = transcriptLines.slice(translatedCountRef.current);
    if (newLines.length === 0) return;
    translatedCountRef.current = transcriptLines.length;
    newLines.forEach((line) => translate(line, "de", "en"));
  }, [transcriptLines, language, translate]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  // Auto-speak each new translated line (de→en; loop-safe via de-DE recognizer language)
  useEffect(() => {
    if (translations.length === 0) return;
    const newOnes = translations.slice(spokenCountRef.current);
    if (newOnes.length === 0) return;
    spokenCountRef.current = translations.length;
    autoSpeak(newOnes[newOnes.length - 1]);
  }, [translations, autoSpeak]);

  // Full cleanup on unmount
  useEffect(() => () => { stop(); stopTranscription(); stopSpeech(); }, [stop, stopTranscription, stopSpeech]);

  const showTranslationBox = language === "de";

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

  return (
    <div className="mlt-page">
      <div className="mlt-card">
        <header className="mlt-card__header">
          <h1 className="mlt-card__title">{t.heading}</h1>
          <p className="mlt-card__sub">{t.sub}</p>
        </header>

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

        {/* Transcription box */}
        <div className="mlt-transcript">
          <span className="mlt-transcript__label">{t.transcriptLabel}</span>
          {!transcriptSupported ? (
            <p className="mlt-transcript__unsupported">{t.transcriptNotSupported}</p>
          ) : (
            <>
              <div
                className="mlt-transcript__box"
                role="log"
                aria-live="polite"
                aria-label={t.transcriptLabel}
              >
                {transcriptLines.length === 0 ? (
                  <span className="mlt-transcript__empty">{t.transcriptEmpty}</span>
                ) : (
                  transcriptLines.map((line, i) => (
                    <p key={i} className="mlt-transcript__line">{line}</p>
                  ))
                )}
              </div>
              <p className="mlt-transcript__disclaimer">{t.transcriptDisclaimer}</p>
            </>
          )}
        </div>

        {/* Translation box — only shown when source language is DE (Phase 3: de→en) */}
        {showTranslationBox && (
          <div className="mlt-translation">
            <span className="mlt-translation__label">{t.translationLabel}</span>
            <div
              className="mlt-translation__box"
              role="log"
              aria-live="polite"
              aria-label={t.translationLabel}
            >
              {translations.length === 0 && !translationLoading ? (
                <span className="mlt-translation__empty">{t.translationEmpty}</span>
              ) : (
                translations.map((line, i) => (
                  <p key={i} className="mlt-translation__line">{line}</p>
                ))
              )}
              {translationLoading && (
                <p className="mlt-translation__loading">{t.translationLoading}</p>
              )}
            </div>
            {translationError && (
              <p className="mlt-translation__error">{t.translationError}</p>
            )}
          </div>
        )}

        {/* Audio output controls — only shown when translation is active (DE source) */}
        {showTranslationBox && (
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
                        onClick={() => replaySpeech(translations[translations.length - 1])}
                        disabled={translations.length === 0}
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
              </>
            )}
          </div>
        )}

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
