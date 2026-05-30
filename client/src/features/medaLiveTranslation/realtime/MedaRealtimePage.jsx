import React, { useEffect, useRef } from 'react';
import { useRealtimeSession } from './useRealtimeSession.js';
import './MedaRealtimePage.css';

const LANG_OPTIONS = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'Englisch' },
];

/**
 * Phase 8.2 test page for OpenAI Realtime WebRTC connection.
 * Displays raw server events in a scrollable debug log.
 * No pingpong logic — connection scaffolding only.
 */
export default function MedaRealtimePage() {
  const {
    connect,
    disconnect,
    connectionState,
    dataChannelState,
    lastEvent,
    events,
    error,
  } = useRealtimeSession();

  const [patientLang, setPatientLang] = React.useState('de');
  const [practiceLang, setPracticeLang] = React.useState('en');
  const logRef = useRef(null);

  // Auto-scroll debug log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const isConnected = connectionState === 'connected';
  const isBusy = connectionState === 'connecting' || connectionState === 'disconnecting';

  function handleConnect() {
    connect({ patientLanguage: patientLang, practiceLanguage: practiceLang });
  }

  return (
    <div className="mrt-page">
      <h1 className="mrt-title">Meda Realtime — Phase 8.2 Verbindungstest</h1>

      <section className="mrt-config">
        <div className="mrt-field">
          <label className="mrt-label" htmlFor="mrt-patient-lang">Patientensprache</label>
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
        <div className="mrt-field">
          <label className="mrt-label" htmlFor="mrt-practice-lang">Praxissprache</label>
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
      </section>

      <section className="mrt-controls">
        <button
          className="mrt-btn mrt-btn--connect"
          onClick={handleConnect}
          disabled={isConnected || isBusy || patientLang === practiceLang}
        >
          {connectionState === 'connecting' ? 'Verbinde …' : 'Verbinden'}
        </button>
        <button
          className="mrt-btn mrt-btn--disconnect"
          onClick={disconnect}
          disabled={!isConnected && connectionState !== 'connecting'}
        >
          Trennen
        </button>
      </section>

      <section className="mrt-status">
        <div className="mrt-status-row">
          <span className="mrt-status-label">Verbindung:</span>
          <span className={`mrt-status-value mrt-status-value--${connectionState}`}>
            {connectionState}
          </span>
        </div>
        <div className="mrt-status-row">
          <span className="mrt-status-label">DataChannel:</span>
          <span className={`mrt-status-value mrt-status-value--${dataChannelState}`}>
            {dataChannelState}
          </span>
        </div>
        {patientLang === practiceLang && (
          <p className="mrt-warning">Patientensprache und Praxissprache müssen verschieden sein.</p>
        )}
        {error && (
          <p className="mrt-error" role="alert">{error}</p>
        )}
      </section>

      <section className="mrt-events">
        <h2 className="mrt-events-title">
          Server-Events ({events.length})
          {lastEvent && (
            <span className="mrt-last-event-type"> — zuletzt: {lastEvent.type}</span>
          )}
        </h2>
        <div className="mrt-log" ref={logRef} aria-live="polite" aria-atomic="false">
          {events.length === 0 && (
            <p className="mrt-log-empty">Keine Events. Verbindung herstellen und sprechen.</p>
          )}
          {events.map((ev, i) => (
            <div key={i} className="mrt-log-entry">
              <span className="mrt-log-type">{ev.type}</span>
              <pre className="mrt-log-body">
                {JSON.stringify(ev, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
