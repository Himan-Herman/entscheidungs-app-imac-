import React, { useEffect, useRef, useState } from 'react';
import { useRealtimeSession } from './useRealtimeSession.js';
import './MedaRealtimePage.css';

const LANG_OPTIONS = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'Englisch' },
];

const ROLE_LABEL = {
  patient:  'Patient',
  practice: 'Praxis',
};

/** Maximum session duration in seconds. Hard cutoff to limit Realtime cost exposure. */
const SESSION_MAX_SECONDS = 5 * 60; // 300 s

/** Warning threshold — show banner when this many seconds remain. */
const SESSION_WARN_SECONDS = 60;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Human-readable status label from connection + session state. */
function buildStatusLabel(connectionState, sessionStatus, speakerRole, sessionExpired) {
  if (sessionExpired)                            return 'Sitzung beendet';
  if (connectionState === 'connecting')          return 'Verbinde …';
  if (connectionState === 'error')               return 'Verbindungsfehler';
  if (connectionState !== 'connected')           return 'Nicht verbunden';

  const role = ROLE_LABEL[speakerRole] ?? speakerRole;
  switch (sessionStatus) {
    case 'ready':         return `Wartet auf ${role}`;
    case 'speech_active': return `${role} spricht`;
    case 'processing':    return 'Verarbeite …';
    case 'translating':   return `Meda übersetzt für ${speakerRole === 'patient' ? 'Praxis' : 'Patient'}`;
    case 'speaking':      return 'Meda spricht';
    default:              return 'Bereit';
  }
}

/** CSS modifier for the status badge. */
function statusCls(connectionState, sessionStatus, sessionExpired) {
  if (sessionExpired)                              return 'expired';
  if (connectionState === 'connecting')            return 'active';
  if (connectionState === 'error')                 return 'error';
  if (connectionState !== 'connected')             return 'idle';
  if (sessionStatus === 'ready')                   return 'ready';
  if (sessionStatus === 'speaking')                return 'speaking';
  return 'active';
}

/**
 * Phase 8.5 — Realtime session with hard timeout, countdown, and full cleanup.
 *
 * Safety mechanisms:
 *  - Hard 5-minute timeout: automatic disconnect() when SESSION_MAX_SECONDS expires
 *  - Countdown timer visible in the UI; warning banner at 60 s remaining
 *  - Unmount cleanup: disconnect() called when component unmounts (navigation away)
 *  - Tab-hidden cleanup: disconnect() when tab becomes invisible
 *  - No auto-reconnect anywhere
 */
export default function MedaRealtimePage() {
  const {
    connect,
    disconnect,
    connectionState,
    sessionStatus,
    currentSpeakerRole,
    turns,
    events,
    error,
    audioElRef,
  } = useRealtimeSession();

  const [patientLang,  setPatientLang]  = useState('de');
  const [practiceLang, setPracticeLang] = useState('en');
  const [showDebug,    setShowDebug]    = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_MAX_SECONDS);
  const [sessionExpired,   setSessionExpired]   = useState(false);

  const turnsEndRef      = useRef(null);
  const debugLogRef      = useRef(null);
  const timerIntervalRef = useRef(null);
  const sessionStartRef  = useRef(null);

  // Always-current ref to disconnect() — used in unmount effect without stale closure
  const disconnectRef = useRef(disconnect);
  useEffect(() => { disconnectRef.current = disconnect; });

  // ── Unmount cleanup ─────────────────────────────────────────────────────────
  // Runs when the user navigates away from this page — stops mic and session.
  useEffect(() => {
    return () => {
      disconnectRef.current();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, []); // intentionally empty — runs only on unmount

  // ── Tab-hidden protection ───────────────────────────────────────────────────
  // If the user switches tabs while a session is running, stop it immediately
  // to avoid incurring Realtime costs in the background.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden' && connectionState === 'connected') {
        disconnect();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [connectionState, disconnect]);

  // ── Hard timeout + countdown ────────────────────────────────────────────────
  useEffect(() => {
    const isConnected = connectionState === 'connected';

    if (isConnected) {
      sessionStartRef.current = Date.now();
      setRemainingSeconds(SESSION_MAX_SECONDS);
      setSessionExpired(false);

      timerIntervalRef.current = setInterval(() => {
        const elapsed    = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        const remaining  = Math.max(0, SESSION_MAX_SECONDS - elapsed);
        setRemainingSeconds(remaining);

        if (remaining <= 0) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          setSessionExpired(true);
          disconnectRef.current();
        }
      }, 1000);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };
    }
  }, [connectionState]); // re-runs when connection is established or dropped

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    if (debugLogRef.current) {
      debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight;
    }
  }, [events]);

  const isConnected  = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';
  const isBusy       = isConnecting || connectionState === 'disconnecting';
  const langMismatch = patientLang === practiceLang;
  const showWarning  = isConnected && remainingSeconds <= SESSION_WARN_SECONDS && remainingSeconds > 0;

  const patientLangLabel  = LANG_OPTIONS.find(o => o.value === patientLang)?.label  ?? patientLang;
  const practiceLangLabel = LANG_OPTIONS.find(o => o.value === practiceLang)?.label ?? practiceLang;

  function langLabel(code) {
    return LANG_OPTIONS.find(o => o.value === code)?.label ?? code;
  }

  function handleStart() {
    setSessionExpired(false);
    connect({ patientLanguage: patientLang, practiceLanguage: practiceLang });
  }

  const label    = buildStatusLabel(connectionState, sessionStatus, currentSpeakerRole, sessionExpired);
  const badgeCls = statusCls(connectionState, sessionStatus, sessionExpired);
  const showPulse = badgeCls === 'active' || badgeCls === 'speaking';

  return (
    <div className="mrt-page">
      {/* Hidden audio element — receives remote WebRTC audio track */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioElRef} autoPlay style={{ display: 'none' }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="mrt-header">
        <h1 className="mrt-title">Meda Live-Dolmetscher</h1>
        <div className="mrt-header-right">
          {/* Countdown — visible while connected */}
          {isConnected && (
            <div className={`mrt-timer${remainingSeconds <= SESSION_WARN_SECONDS ? ' mrt-timer--warn' : ''}`}
              aria-label={`Verbleibende Sitzungszeit: ${formatTime(remainingSeconds)}`}>
              {formatTime(remainingSeconds)}
            </div>
          )}
          <div className={`mrt-status-badge mrt-status-badge--${badgeCls}`} role="status" aria-live="polite">
            {showPulse && <span className="mrt-pulse" aria-hidden="true" />}
            {label}
          </div>
        </div>
      </header>

      {/* ── Warning banner ──────────────────────────────────────────────────── */}
      {showWarning && (
        <div className="mrt-timeout-warning" role="alert">
          Die Sitzung endet in {formatTime(remainingSeconds)} — bitte Gespräch beenden oder fortsetzen.
        </div>
      )}

      {/* ── Expired banner ──────────────────────────────────────────────────── */}
      {sessionExpired && (
        <div className="mrt-expired-banner" role="status">
          Sitzung beendet. Für eine neue Sitzung bitte „Live-Gespräch starten" klicken.
        </div>
      )}

      {/* ── Setup ──────────────────────────────────────────────────────────── */}
      <section className="mrt-setup" aria-label="Sprachauswahl und Steuerung">
        <div className="mrt-lang-row">
          <div className="mrt-field">
            <label className="mrt-label" htmlFor="mrt-patient-lang">Patient spricht</label>
            <select
              id="mrt-patient-lang"
              className="mrt-select"
              value={patientLang}
              onChange={e => setPatientLang(e.target.value)}
              disabled={isConnected || isBusy}
            >
              {LANG_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <span className="mrt-arrow" aria-hidden="true">⇄</span>

          <div className="mrt-field">
            <label className="mrt-label" htmlFor="mrt-practice-lang">Praxis spricht</label>
            <select
              id="mrt-practice-lang"
              className="mrt-select"
              value={practiceLang}
              onChange={e => setPracticeLang(e.target.value)}
              disabled={isConnected || isBusy}
            >
              {LANG_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {langMismatch && (
          <p className="mrt-warning" role="alert">Bitte zwei verschiedene Sprachen wählen.</p>
        )}

        <div className="mrt-controls">
          {!isConnected ? (
            <button
              className="mrt-btn mrt-btn--start"
              onClick={handleStart}
              disabled={isBusy || langMismatch}
            >
              {isConnecting ? 'Verbinde …' : 'Live-Gespräch starten'}
            </button>
          ) : (
            <button
              className="mrt-btn mrt-btn--stop"
              onClick={disconnect}
            >
              Gespräch beenden
            </button>
          )}
        </div>

        {error && !sessionExpired && (
          <p className="mrt-error" role="alert">{error}</p>
        )}
      </section>

      {/* ── Pingpong speaker bar ─────────────────────────────────────────────── */}
      {isConnected && (
        <div className="mrt-pingpong-bar" aria-live="polite">
          <div className={`mrt-speaker-pill${currentSpeakerRole === 'patient' ? ' mrt-speaker-pill--active' : ''}`}>
            Patient · {patientLangLabel}
          </div>
          <div className="mrt-pingpong-arrow" aria-hidden="true">⇄</div>
          <div className={`mrt-speaker-pill${currentSpeakerRole === 'practice' ? ' mrt-speaker-pill--active' : ''}`}>
            Praxis · {practiceLangLabel}
          </div>
        </div>
      )}

      {/* ── Conversation turns ───────────────────────────────────────────────── */}
      <section className="mrt-conversation" aria-label="Gesprächsverlauf">
        {turns.length === 0 && isConnected && (
          <p className="mrt-conversation-empty">
            {currentSpeakerRole === 'patient'
              ? `Patient: Bitte auf ${patientLangLabel} sprechen.`
              : `Praxis: Bitte auf ${practiceLangLabel} sprechen.`}
          </p>
        )}
        {turns.length === 0 && !isConnected && !isConnecting && !sessionExpired && (
          <p className="mrt-conversation-empty mrt-conversation-empty--idle">
            Starten Sie ein Gespräch — der Gesprächsverlauf erscheint hier.
          </p>
        )}

        {turns.map(turn => (
          <div
            key={turn.key}
            className={`mrt-turn mrt-turn--${turn.speakerRole}${turn.isDone ? ' mrt-turn--done' : ''}`}
          >
            <div className="mrt-turn-header">
              <span className="mrt-turn-role">{ROLE_LABEL[turn.speakerRole]}</span>
              <span className="mrt-turn-direction">
                {langLabel(turn.sourceLanguage)} → {langLabel(turn.targetLanguage)}
              </span>
            </div>

            <div className="mrt-turn-original">
              <span className="mrt-turn-lang">{langLabel(turn.sourceLanguage)}</span>
              <p className="mrt-turn-text">
                {turn.originalText !== null
                  ? turn.originalText
                  : <span className="mrt-turn-pending">Transkription …</span>}
              </p>
            </div>

            {(turn.translatedText || !turn.isDone) && (
              <div className="mrt-turn-translation">
                <span className="mrt-turn-lang mrt-turn-lang--translation">
                  {langLabel(turn.targetLanguage)}
                </span>
                <p className="mrt-turn-text mrt-turn-text--translation">
                  {turn.translatedText
                    ? turn.translatedText
                    : <span className="mrt-turn-pending">Übersetze …</span>}
                  {!turn.isDone && turn.translatedText && (
                    <span className="mrt-turn-cursor" aria-hidden="true"> ▌</span>
                  )}
                </p>
              </div>
            )}
          </div>
        ))}
        <div ref={turnsEndRef} />
      </section>

      {/* ── Debug (collapsed by default) ────────────────────────────────────── */}
      <section className="mrt-debug">
        <button
          className="mrt-debug-toggle"
          onClick={() => setShowDebug(v => !v)}
          aria-expanded={showDebug}
        >
          Debug-Events ({events.length}) {showDebug ? '▲' : '▼'}
        </button>
        {showDebug && (
          <div className="mrt-debug-log" ref={debugLogRef}>
            {events.length === 0 && (
              <p className="mrt-debug-empty">Keine Events.</p>
            )}
            {events.map((ev, i) => (
              <div key={i} className="mrt-debug-entry">
                <span className="mrt-debug-type">{ev.type}</span>
                <pre className="mrt-debug-body">{JSON.stringify(ev, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
