import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { useMicrophoneLevel } from "./useMicrophoneLevel";
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
    playStartTone();
    await start();
  }, [start]);

  const handleStop = useCallback(() => {
    clearTimer();
    stop();
    setSecondsLeft(DURATION_S);
  }, [clearTimer, stop]);

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

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  // Full cleanup on unmount
  useEffect(() => () => stop(), [stop]);

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
