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

/** Build the human-readable status string from sessionStatus + speakerRole. */
function buildStatusLabel(connectionState, sessionStatus, speakerRole) {
  if (connectionState === 'connecting')  return 'Verbinde …';
  if (connectionState === 'error')       return 'Fehler — bitte neu starten';
  if (connectionState !== 'connected')   return 'Nicht verbunden';

  const role = ROLE_LABEL[speakerRole] ?? speakerRole;
  switch (sessionStatus) {
    case 'ready':        return `Wartet auf ${role}`;
    case 'speech_active': return `${role} spricht`;
    case 'processing':   return 'Verarbeite …';
    case 'translating':  return `Meda übersetzt für ${speakerRole === 'patient' ? 'Praxis' : 'Patient'}`;
    case 'speaking':     return 'Meda spricht';
    default:             return 'Bereit';
  }
}

/** CSS modifier for the status badge based on what's happening. */
function statusClass(connectionState, sessionStatus) {
  if (connectionState === 'connecting')              return 'active';
  if (connectionState === 'error')                   return 'error';
  if (connectionState !== 'connected')               return 'idle';
  if (sessionStatus === 'ready')                     return 'ready';
  if (sessionStatus === 'speaking')                  return 'speaking';
  return 'active'; // speech_active, processing, translating
}

/**
 * Phase 8.4 — Realtime Pingpong Interpreter.
 * Alternates automatically between patient and practice after each complete turn.
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

  const [patientLang, setPatientLang] = useState('de');
  const [practiceLang, setPracticeLang] = useState('en');
  const [showDebug, setShowDebug] = useState(false);

  const turnsEndRef = useRef(null);
  const debugLogRef = useRef(null);

  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    if (debugLogRef.current) {
      debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight;
    }
  }, [events]);

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';
  const isBusy = isConnecting || connectionState === 'disconnecting';
  const langMismatch = patientLang === practiceLang;

  const patientLangLabel  = LANG_OPTIONS.find(o => o.value === patientLang)?.label  ?? patientLang;
  const practiceLangLabel = LANG_OPTIONS.find(o => o.value === practiceLang)?.label ?? practiceLang;

  function langLabel(langCode) {
    return LANG_OPTIONS.find(o => o.value === langCode)?.label ?? langCode;
  }

  function handleStart() {
    connect({ patientLanguage: patientLang, practiceLanguage: practiceLang });
  }

  const label = buildStatusLabel(connectionState, sessionStatus, currentSpeakerRole);
  const cls   = statusClass(connectionState, sessionStatus);
  const showPulse = cls === 'active' || cls === 'speaking';

  return (
    <div className="mrt-page">
      {/* Hidden audio element — receives remote WebRTC audio track */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioElRef} autoPlay style={{ display: 'none' }} />

      {/* Header */}
      <header className="mrt-header">
        <h1 className="mrt-title">Meda Live-Dolmetscher</h1>
        <div className={`mrt-status-badge mrt-status-badge--${cls}`} role="status" aria-live="polite">
          {showPulse && <span className="mrt-pulse" aria-hidden="true" />}
          {label}
        </div>
      </header>

      {/* Language config + start/stop */}
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

        {error && (
          <p className="mrt-error" role="alert">{error}</p>
        )}
      </section>

      {/* Pingpong speaker indicator — visible only while connected */}
      {isConnected && (
        <div className="mrt-pingpong-bar" aria-live="polite">
          <div className={`mrt-speaker-pill ${currentSpeakerRole === 'patient' ? 'mrt-speaker-pill--active' : ''}`}>
            Patient · {patientLangLabel}
          </div>
          <div className="mrt-pingpong-arrow" aria-hidden="true">⇄</div>
          <div className={`mrt-speaker-pill ${currentSpeakerRole === 'practice' ? 'mrt-speaker-pill--active' : ''}`}>
            Praxis · {practiceLangLabel}
          </div>
        </div>
      )}

      {/* Conversation turns */}
      <section className="mrt-conversation" aria-label="Gesprächsverlauf">
        {turns.length === 0 && isConnected && (
          <p className="mrt-conversation-empty">
            {currentSpeakerRole === 'patient'
              ? `Patient: Bitte auf ${patientLangLabel} sprechen.`
              : `Praxis: Bitte auf ${practiceLangLabel} sprechen.`}
          </p>
        )}
        {turns.length === 0 && !isConnected && !isConnecting && (
          <p className="mrt-conversation-empty mrt-conversation-empty--idle">
            Starten Sie ein Gespräch — der Gesprächsverlauf erscheint hier.
          </p>
        )}

        {turns.map(turn => (
          <div
            key={turn.key}
            className={`mrt-turn mrt-turn--${turn.speakerRole}${turn.isDone ? ' mrt-turn--done' : ''}`}
          >
            {/* Turn header: role + language direction */}
            <div className="mrt-turn-header">
              <span className="mrt-turn-role">
                {ROLE_LABEL[turn.speakerRole]}
              </span>
              <span className="mrt-turn-direction">
                {langLabel(turn.sourceLanguage)} → {langLabel(turn.targetLanguage)}
              </span>
            </div>

            {/* Original text */}
            <div className="mrt-turn-original">
              <span className="mrt-turn-lang">{langLabel(turn.sourceLanguage)}</span>
              <p className="mrt-turn-text">
                {turn.originalText !== null
                  ? turn.originalText
                  : <span className="mrt-turn-pending">Transkription …</span>}
              </p>
            </div>

            {/* Translation */}
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

      {/* Debug section — collapsed by default */}
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
