import React, { useEffect, useRef, useState } from 'react';
import { useRealtimeSession } from './useRealtimeSession.js';
import './MedaRealtimePage.css';

const LANG_OPTIONS = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'Englisch' },
];

const STATUS_LABELS = {
  idle:         'Nicht verbunden',
  ready:        'Bereit · Sprechen Sie jetzt',
  speech_active:'Ich höre …',
  processing:   'Verarbeite …',
  translating:  'Übersetze …',
  speaking:     'Meda spricht …',
};

const STATUS_CLASS = {
  idle:         'idle',
  ready:        'ready',
  speech_active:'active',
  processing:   'active',
  translating:  'active',
  speaking:     'speaking',
};

/**
 * Phase 8.3 — First usable Realtime Interpreter.
 * Transcribes patient speech, generates translation, plays it automatically.
 */
export default function MedaRealtimePage() {
  const {
    connect,
    disconnect,
    connectionState,
    sessionStatus,
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

  // Auto-scroll conversation to latest turn
  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  // Auto-scroll debug log
  useEffect(() => {
    if (debugLogRef.current) {
      debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight;
    }
  }, [events]);

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';
  const isBusy = isConnecting || connectionState === 'disconnecting';
  const langMismatch = patientLang === practiceLang;

  function handleStart() {
    connect({ patientLanguage: patientLang, practiceLanguage: practiceLang });
  }

  const statusLabel = isConnecting
    ? 'Verbinde …'
    : STATUS_LABELS[sessionStatus] ?? sessionStatus;

  const statusClass = isConnecting
    ? 'active'
    : STATUS_CLASS[sessionStatus] ?? 'idle';

  const patientLangLabel = LANG_OPTIONS.find(o => o.value === patientLang)?.label ?? patientLang;
  const practiceLangLabel = LANG_OPTIONS.find(o => o.value === practiceLang)?.label ?? practiceLang;

  return (
    <div className="mrt-page">
      {/* Hidden audio element — receives remote WebRTC audio track */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioElRef} autoPlay style={{ display: 'none' }} />

      {/* Header */}
      <header className="mrt-header">
        <h1 className="mrt-title">Meda Live-Dolmetscher</h1>
        <div className={`mrt-status-badge mrt-status-badge--${statusClass}`} role="status" aria-live="polite">
          {statusClass === 'active' && <span className="mrt-pulse" aria-hidden="true" />}
          {statusLabel}
        </div>
      </header>

      {/* Config + Controls */}
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

      {/* Conversation turns */}
      <section className="mrt-conversation" aria-label="Gesprächsverlauf">
        {turns.length === 0 && isConnected && (
          <p className="mrt-conversation-empty">
            Gespräch läuft · Sprechen Sie auf {patientLangLabel}.
            Meda übersetzt automatisch ins {practiceLangLabel}.
          </p>
        )}
        {turns.length === 0 && !isConnected && !isConnecting && (
          <p className="mrt-conversation-empty mrt-conversation-empty--idle">
            Starten Sie ein Gespräch — der Gesprächsverlauf erscheint hier.
          </p>
        )}

        {turns.map(turn => (
          <div key={turn.key} className={`mrt-turn${turn.isDone ? ' mrt-turn--done' : ''}`}>
            <div className="mrt-turn-original">
              <span className="mrt-turn-lang">{patientLangLabel}</span>
              <p className="mrt-turn-text">
                {turn.originalText ?? <span className="mrt-turn-pending">Transkription …</span>}
              </p>
            </div>
            {(turn.translatedText || !turn.isDone) && (
              <div className="mrt-turn-translation">
                <span className="mrt-turn-lang mrt-turn-lang--translation">{practiceLangLabel}</span>
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
