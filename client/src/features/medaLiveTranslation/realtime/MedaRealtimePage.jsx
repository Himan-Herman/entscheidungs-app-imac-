import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeSession } from './useRealtimeSession.js';
import { REALTIME_LANGUAGES, REALTIME_LANGUAGE_MAP } from './realtimeLanguages.js';
import { exportRealtimeConversationPdf } from './exportRealtimeConversationPdf.js';
import {
  usePatientProfilePrefill,
  EMPTY_PATIENT_INFO,
  EMPTY_PRACTICE_INFO,
} from './realtimeFormDefaults.js';
import './MedaRealtimePage.css';

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
function buildStatusLabel(connectionState, sessionStatus, sessionExpired) {
  if (sessionExpired)                   return 'Sitzung beendet';
  if (connectionState === 'connecting') return 'Verbinde …';
  if (connectionState === 'error')      return 'Verbindungsfehler';
  if (connectionState !== 'connected')  return 'Nicht verbunden';

  switch (sessionStatus) {
    case 'ready':         return 'Wartet auf Sprecher';
    case 'speech_active': return 'Jemand spricht …';
    case 'processing':    return 'Verarbeite …';
    case 'translating':   return 'Meda übersetzt …';
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

  // ── Language selection ─────────────────────────────────────────────────────
  const [patientLang,  setPatientLang]  = useState('de');
  const [practiceLang, setPracticeLang] = useState('en');

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showDebug,        setShowDebug]        = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_MAX_SECONDS);
  const [sessionExpired,   setSessionExpired]   = useState(false);

  // ── Consent checkboxes — stay checked for the page lifetime ────────────────
  const [consentAudio,   setConsentAudio]   = useState(false);
  const [consentContext, setConsentContext] = useState(false);
  const [consentMedical, setConsentMedical] = useState(false);

  // ── Person selector ─────────────────────────────────────────────────────────
  // true = conversation is about the logged-in user themselves
  // false = conversation is about another person (family member, etc.)
  const [forSelf, setForSelf] = useState(true);

  // ── Patient / person info — local state only, never sent to server ──────────
  const [patientInfo,  setPatientInfo]  = useState(EMPTY_PATIENT_INFO);
  const [practiceInfo, setPracticeInfo] = useState(EMPTY_PRACTICE_INFO);

  // ── PDF state ───────────────────────────────────────────────────────────────
  const [pdfLoading, setPdfLoading] = useState(false);
  const sessionStartedAtRef = useRef(/** @type {string|null} */ (null));

  // ── Prefill from existing profile ───────────────────────────────────────────
  const { profileData } = usePatientProfilePrefill();

  // Apply prefill when profile data arrives (only when forSelf === true)
  useEffect(() => {
    if (!profileData || !forSelf) return;
    setPatientInfo(prev => ({
      ...prev,
      name:            profileData.name            || prev.name,
      dateOfBirth:     profileData.dateOfBirth     || prev.dateOfBirth,
      gender:          profileData.gender          || prev.gender,
      insuranceStatus: profileData.insuranceStatus || prev.insuranceStatus,
      email:           profileData.email           || prev.email,
      phone:           profileData.phone           || prev.phone,
      address:         profileData.address         || prev.address,
    }));
    if (profileData.patientLang)  setPatientLang(profileData.patientLang);
    if (profileData.practiceLang) setPracticeLang(profileData.practiceLang);
  }, [profileData, forSelf]);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const turnsEndRef      = useRef(null);
  const debugLogRef      = useRef(null);
  const timerIntervalRef = useRef(null);
  const sessionStartRef  = useRef(null);

  const disconnectRef = useRef(disconnect);
  useEffect(() => { disconnectRef.current = disconnect; });

  // ── Unmount cleanup ─────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      disconnectRef.current();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, []);

  // ── Tab-hidden protection ───────────────────────────────────────────────────
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
      sessionStartRef.current     = Date.now();
      sessionStartedAtRef.current = new Date().toISOString();
      setRemainingSeconds(SESSION_MAX_SECONDS);
      setSessionExpired(false);

      timerIntervalRef.current = setInterval(() => {
        const elapsed   = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        const remaining = Math.max(0, SESSION_MAX_SECONDS - elapsed);
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
  }, [connectionState]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    if (debugLogRef.current) {
      debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight;
    }
  }, [events]);

  // ── Computed values ─────────────────────────────────────────────────────────
  const isConnected  = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';
  const isBusy       = isConnecting || connectionState === 'disconnecting';
  const langMismatch = patientLang === practiceLang;
  const showWarning  = isConnected && remainingSeconds <= SESSION_WARN_SECONDS && remainingSeconds > 0;
  const allConsents  = consentAudio && consentContext && consentMedical;
  const hasName      = patientInfo.name.trim() !== '';
  const canStart     = !isBusy && !langMismatch && allConsents && hasName;

  const patientLangLabel  = REALTIME_LANGUAGE_MAP[patientLang]  ?? patientLang;
  const practiceLangLabel = REALTIME_LANGUAGE_MAP[practiceLang] ?? practiceLang;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePatientInfo  = useCallback((field, value) => setPatientInfo(prev  => ({ ...prev, [field]: value })), []);
  const handlePracticeInfo = useCallback((field, value) => setPracticeInfo(prev => ({ ...prev, [field]: value })), []);

  const handleForSelf = useCallback((isSelf) => {
    setForSelf(isSelf);
    if (isSelf && profileData) {
      // Re-apply profile data
      setPatientInfo(prev => ({
        ...prev,
        name:            profileData.name            || '',
        dateOfBirth:     profileData.dateOfBirth     || '',
        gender:          profileData.gender          || '',
        insuranceStatus: profileData.insuranceStatus || '',
        email:           profileData.email           || '',
        phone:           profileData.phone           || '',
        address:         profileData.address         || '',
        relationship:    '',
      }));
    } else if (!isSelf) {
      // Clear personal fields for another person; practice fields stay
      setPatientInfo(prev => ({
        ...EMPTY_PATIENT_INFO,
        // keep insurance/practice-related fields blank
        insuranceStatus: prev.insuranceStatus, // keep in case user already filled
      }));
    }
  }, [profileData]);

  const handleDownloadPdf = useCallback(async () => {
    setPdfLoading(true);
    try {
      await exportRealtimeConversationPdf({
        turns,
        patientInfo,
        practiceInfo,
        forSelf,
        languages: { patientLanguage: patientLang, practiceLanguage: practiceLang },
        sessionStartedAt: sessionStartedAtRef.current,
      });
    } catch (err) {
      console.error('[MedaRealtimePage] PDF export failed:', err?.message);
    } finally {
      setPdfLoading(false);
    }
  }, [turns, patientInfo, practiceInfo, forSelf, patientLang, practiceLang]);

  function handleStart() {
    setSessionExpired(false);
    connect({ patientLanguage: patientLang, practiceLanguage: practiceLang });
  }

  function getBlockHint() {
    if (langMismatch) return 'Bitte zwei verschiedene Sprachen wählen.';
    if (!hasName)     return 'Bitte vollständigen Namen der Person eingeben.';
    if (!allConsents) return 'Bitte alle drei Zustimmungen bestätigen.';
    return null;
  }
  const blockHint = (!canStart && !isBusy) ? getBlockHint() : null;

  const label    = buildStatusLabel(connectionState, sessionStatus, sessionExpired);
  const badgeCls = statusCls(connectionState, sessionStatus, sessionExpired);
  const showPulse = badgeCls === 'active' || badgeCls === 'speaking';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mrt-page">
      {/* Hidden audio element — receives remote WebRTC audio track */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioElRef} autoPlay style={{ display: 'none' }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="mrt-header">
        <h1 className="mrt-title">Meda Live-Dolmetscher</h1>
        <div className="mrt-header-right">
          {isConnected && (
            <div
              className={`mrt-timer${remainingSeconds <= SESSION_WARN_SECONDS ? ' mrt-timer--warn' : ''}`}
              aria-label={`Verbleibende Sitzungszeit: ${formatTime(remainingSeconds)}`}
            >
              {formatTime(remainingSeconds)}
            </div>
          )}
          <div className={`mrt-status-badge mrt-status-badge--${badgeCls}`} role="status" aria-live="polite">
            {showPulse && <span className="mrt-pulse" aria-hidden="true" />}
            {label}
          </div>
        </div>
      </header>

      {/* ── Warning / expired banners ────────────────────────────────────────── */}
      {showWarning && (
        <div className="mrt-timeout-warning" role="alert">
          Die Sitzung endet in {formatTime(remainingSeconds)} — bitte Gespräch beenden oder fortsetzen.
        </div>
      )}
      {sessionExpired && (
        <div className="mrt-expired-banner" role="status">
          Sitzung beendet. Für eine neue Sitzung bitte „Live-Gespräch starten" klicken.
        </div>
      )}

      {/* ── Setup panel — visible when not connected ─────────────────────────── */}
      {!isConnected && (
        <section className="mrt-setup" aria-label="Live-Gespräch einrichten">

          {/* ── 1. Sprachauswahl ──────────────────────────────────────────────── */}
          <div className="mrt-setup-section">
            <h2 className="mrt-setup-section-title">Sprachen</h2>
            <div className="mrt-lang-row">
              <div className="mrt-field">
                <label className="mrt-label" htmlFor="mrt-patient-lang">Patient spricht</label>
                <select
                  id="mrt-patient-lang"
                  className="mrt-select"
                  value={patientLang}
                  onChange={e => setPatientLang(e.target.value)}
                  disabled={isBusy}
                >
                  {REALTIME_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
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
                  disabled={isBusy}
                >
                  {REALTIME_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── 2. Angaben zur Person ─────────────────────────────────────────── */}
          <div className="mrt-setup-section">
            <h2 className="mrt-setup-section-title">Angaben zur Person</h2>

            <div
              className="mrt-person-toggle"
              role="group"
              aria-label="Für wen ist das Gespräch?"
            >
              <button
                type="button"
                className={`mrt-toggle-btn${forSelf ? ' mrt-toggle-btn--active' : ''}`}
                onClick={() => handleForSelf(true)}
                disabled={isBusy}
              >
                Das Gespräch betrifft mich selbst
              </button>
              <button
                type="button"
                className={`mrt-toggle-btn${!forSelf ? ' mrt-toggle-btn--active' : ''}`}
                onClick={() => handleForSelf(false)}
                disabled={isBusy}
              >
                Das Gespräch betrifft eine andere Person
              </button>
            </div>

            <div className="mrt-form-grid">
              <div className="mrt-form-field mrt-form-field--full">
                <label className="mrt-form-label" htmlFor="mrt-person-name">
                  Vollständiger Name <span className="mrt-required-star" aria-label="Pflichtfeld">*</span>
                </label>
                <input
                  id="mrt-person-name"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. Maria Müller"
                  value={patientInfo.name}
                  onChange={e => handlePatientInfo('name', e.target.value)}
                  disabled={isBusy}
                  aria-required="true"
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-dob">Geburtsdatum</label>
                <input
                  id="mrt-person-dob"
                  className="mrt-form-input"
                  type="text"
                  placeholder="TT.MM.JJJJ"
                  value={patientInfo.dateOfBirth}
                  onChange={e => handlePatientInfo('dateOfBirth', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-gender">Geschlecht</label>
                <select
                  id="mrt-person-gender"
                  className="mrt-form-select"
                  value={patientInfo.gender}
                  onChange={e => handlePatientInfo('gender', e.target.value)}
                  disabled={isBusy}
                >
                  <option value="">keine Angabe</option>
                  <option value="weiblich">weiblich</option>
                  <option value="männlich">männlich</option>
                  <option value="divers">divers</option>
                </select>
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-insurance">Versicherungsstatus</label>
                <select
                  id="mrt-person-insurance"
                  className="mrt-form-select"
                  value={patientInfo.insuranceStatus}
                  onChange={e => handlePatientInfo('insuranceStatus', e.target.value)}
                  disabled={isBusy}
                >
                  <option value="">unbekannt / nicht angegeben</option>
                  <option value="gesetzlich">gesetzlich</option>
                  <option value="privat">privat</option>
                  <option value="Selbstzahler">Selbstzahler</option>
                </select>
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-ins-nr">
                  Versicherungsnummer
                  <span className="mrt-form-opt"> (optional)</span>
                </label>
                <input
                  id="mrt-person-ins-nr"
                  className="mrt-form-input"
                  type="text"
                  placeholder="optional"
                  value={patientInfo.insuranceNumber}
                  onChange={e => handlePatientInfo('insuranceNumber', e.target.value)}
                  disabled={isBusy}
                />
                <span className="mrt-form-note">Nur eintragen, wenn für Dokumentation gewünscht.</span>
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-email">E-Mail</label>
                <input
                  id="mrt-person-email"
                  className="mrt-form-input"
                  type="email"
                  placeholder="name@example.com"
                  value={patientInfo.email}
                  onChange={e => handlePatientInfo('email', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-phone">Telefonnummer</label>
                <input
                  id="mrt-person-phone"
                  className="mrt-form-input"
                  type="tel"
                  placeholder="+49 …"
                  value={patientInfo.phone}
                  onChange={e => handlePatientInfo('phone', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field mrt-form-field--full">
                <label className="mrt-form-label" htmlFor="mrt-person-address">Adresse</label>
                <input
                  id="mrt-person-address"
                  className="mrt-form-input"
                  type="text"
                  placeholder="Straße, PLZ, Ort"
                  value={patientInfo.address}
                  onChange={e => handlePatientInfo('address', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              {!forSelf && (
                <div className="mrt-form-field mrt-form-field--full">
                  <label className="mrt-form-label" htmlFor="mrt-person-relation">
                    Beziehung zur Person
                    <span className="mrt-form-opt"> (optional)</span>
                  </label>
                  <input
                    id="mrt-person-relation"
                    className="mrt-form-input"
                    type="text"
                    placeholder="z. B. Mutter, Vater, Kind, Angehörige/r"
                    value={patientInfo.relationship}
                    onChange={e => handlePatientInfo('relationship', e.target.value)}
                    disabled={isBusy}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── 3. Angaben zur Praxis ─────────────────────────────────────────── */}
          <div className="mrt-setup-section">
            <h2 className="mrt-setup-section-title">
              Angaben zur Praxis <span className="mrt-optional-badge">optional</span>
            </h2>
            <div className="mrt-form-grid">
              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-name">Praxis / Einrichtung</label>
                <input
                  id="mrt-practice-name"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. Hausarztpraxis Müller"
                  value={practiceInfo.practiceName}
                  onChange={e => handlePracticeInfo('practiceName', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-doctor-name">Arzt / Ärztin / Behandler</label>
                <input
                  id="mrt-doctor-name"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. Dr. Anna Müller"
                  value={practiceInfo.doctorName}
                  onChange={e => handlePracticeInfo('doctorName', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-dept">Fachrichtung</label>
                <input
                  id="mrt-practice-dept"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. Allgemeinmedizin, Orthopädie"
                  value={practiceInfo.department}
                  onChange={e => handlePracticeInfo('department', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-email">E-Mail der Praxis</label>
                <input
                  id="mrt-practice-email"
                  className="mrt-form-input"
                  type="email"
                  placeholder="praxis@example.de"
                  value={practiceInfo.email}
                  onChange={e => handlePracticeInfo('email', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-phone">Telefon der Praxis</label>
                <input
                  id="mrt-practice-phone"
                  className="mrt-form-input"
                  type="tel"
                  placeholder="+49 …"
                  value={practiceInfo.phone}
                  onChange={e => handlePracticeInfo('phone', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field mrt-form-field--full">
                <label className="mrt-form-label" htmlFor="mrt-practice-address">Adresse der Praxis</label>
                <input
                  id="mrt-practice-address"
                  className="mrt-form-input"
                  type="text"
                  placeholder="Straße, PLZ, Ort"
                  value={practiceInfo.address}
                  onChange={e => handlePracticeInfo('address', e.target.value)}
                  disabled={isBusy}
                />
              </div>
            </div>
          </div>

          {/* ── 4. Zustimmungen ───────────────────────────────────────────────── */}
          <div className="mrt-consent-list" role="group" aria-label="Zustimmungen">
            <div className="mrt-consent-item">
              <input
                type="checkbox"
                id="mrt-consent-audio"
                className="mrt-consent-checkbox"
                checked={consentAudio}
                onChange={e => setConsentAudio(e.target.checked)}
                disabled={isBusy}
              />
              <label htmlFor="mrt-consent-audio" className="mrt-consent-label">
                Ich bestätige, dass Audio und erkannter Text zur Live-Übersetzung verarbeitet werden.
              </label>
            </div>

            <div className="mrt-consent-item">
              <input
                type="checkbox"
                id="mrt-consent-context"
                className="mrt-consent-checkbox"
                checked={consentContext}
                onChange={e => setConsentContext(e.target.checked)}
                disabled={isBusy}
              />
              <label htmlFor="mrt-consent-context" className="mrt-consent-label">
                Ich bestätige, dass Meda nur im medizinischen Arzt-Patient-Gespräch verwendet wird.
              </label>
            </div>

            <div className="mrt-consent-item">
              <input
                type="checkbox"
                id="mrt-consent-medical"
                className="mrt-consent-checkbox"
                checked={consentMedical}
                onChange={e => setConsentMedical(e.target.checked)}
                disabled={isBusy}
              />
              <label htmlFor="mrt-consent-medical" className="mrt-consent-label">
                Ich verstehe, dass Meda nur dolmetscht und keine Diagnose, Therapieempfehlung oder
                Dringlichkeitseinschätzung gibt.
              </label>
            </div>
          </div>

          {blockHint && (
            <p className="mrt-consent-hint" role="alert">{blockHint}</p>
          )}

          <p className="mrt-privacy-note">
            Diese Angaben werden in dieser Version nur lokal für die aktuelle Sitzung und den
            PDF-Export verwendet. Es findet keine Speicherung statt.
          </p>

          <div className="mrt-controls">
            <button
              className="mrt-btn mrt-btn--start"
              onClick={handleStart}
              disabled={!canStart}
              aria-disabled={!canStart}
            >
              {isConnecting ? 'Verbinde …' : 'Live-Gespräch starten'}
            </button>
          </div>

          {error && !sessionExpired && (
            <p className="mrt-error" role="alert">{error}</p>
          )}
        </section>
      )}

      {/* ── Active session bar — compact summary + stop button ───────────────── */}
      {isConnected && (
        <div className="mrt-session-bar">
          <span className="mrt-session-langs">
            Patient: <strong>{patientLangLabel}</strong>
            <span className="mrt-session-sep" aria-hidden="true"> · </span>
            Praxis: <strong>{practiceLangLabel}</strong>
          </span>
          <button
            className="mrt-btn mrt-btn--stop mrt-btn--compact"
            onClick={disconnect}
          >
            Gespräch beenden
          </button>
        </div>
      )}

      {/* ── Speaker bar — highlights last detected speaker ──────────────────── */}
      {isConnected && (
        <div className="mrt-pingpong-bar" aria-live="polite" aria-label="Zuletzt erkannter Sprecher">
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
            Bitte sprechen — Meda erkennt die Sprache automatisch.
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
            className={`mrt-turn${turn.speakerRole ? ` mrt-turn--${turn.speakerRole}` : ' mrt-turn--detecting'}${turn.isDone ? ' mrt-turn--done' : ''}`}
          >
            <div className="mrt-turn-header">
              <span className="mrt-turn-role">
                {turn.speakerRole
                  ? `${ROLE_LABEL[turn.speakerRole]} → ${ROLE_LABEL[turn.targetRole]}`
                  : '…'}
              </span>
              <span className="mrt-turn-direction">
                {turn.sourceLanguage
                  ? `${REALTIME_LANGUAGE_MAP[turn.sourceLanguage] ?? turn.sourceLanguage} → ${REALTIME_LANGUAGE_MAP[turn.targetLanguage] ?? turn.targetLanguage}`
                  : 'Erkenne Sprache …'}
              </span>
            </div>

            <div className="mrt-turn-original">
              <span className="mrt-turn-lang">
                {REALTIME_LANGUAGE_MAP[turn.sourceLanguage] ?? turn.sourceLanguage}
              </span>
              <p className="mrt-turn-text">
                {turn.originalText !== null
                  ? turn.originalText
                  : <span className="mrt-turn-pending">Transkription …</span>}
              </p>
            </div>

            {(turn.translatedText || !turn.isDone) && (
              <div className="mrt-turn-translation">
                <span className="mrt-turn-lang mrt-turn-lang--translation">
                  {REALTIME_LANGUAGE_MAP[turn.targetLanguage] ?? turn.targetLanguage}
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

      {/* ── PDF Export — visible after session ends and turns exist ───────────── */}
      {!isConnected && !isConnecting && turns.length > 0 && (
        <section className="mrt-export-section" aria-label="PDF-Export">
          <h2 className="mrt-export-heading">PDF-Gesprächsprotokoll herunterladen</h2>
          <p className="mrt-export-hint">
            Der PDF-Export wird lokal auf Ihrem Gerät erstellt. Kein Upload, keine Serverübertragung.
            Sie können die Daten unten noch anpassen, bevor Sie das PDF herunterladen.
          </p>

          {/* Patient data — pre-filled from setup form, editable */}
          <fieldset className="mrt-export-fieldset">
            <legend className="mrt-export-legend">
              {forSelf ? 'Ihre Angaben' : 'Angaben zur betroffenen Person'}
            </legend>
            <div className="mrt-export-grid">
              <div className="mrt-export-field mrt-export-field--full">
                <label className="mrt-export-label" htmlFor="pdf-patient-name">Name</label>
                <input
                  id="pdf-patient-name"
                  className="mrt-export-input"
                  type="text"
                  placeholder="nicht angegeben"
                  value={patientInfo.name}
                  onChange={e => handlePatientInfo('name', e.target.value)}
                />
              </div>
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-patient-dob">Geburtsdatum</label>
                <input
                  id="pdf-patient-dob"
                  className="mrt-export-input"
                  type="text"
                  placeholder="TT.MM.JJJJ"
                  value={patientInfo.dateOfBirth}
                  onChange={e => handlePatientInfo('dateOfBirth', e.target.value)}
                />
              </div>
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-patient-gender">Geschlecht</label>
                <select
                  id="pdf-patient-gender"
                  className="mrt-export-select"
                  value={patientInfo.gender}
                  onChange={e => handlePatientInfo('gender', e.target.value)}
                >
                  <option value="">keine Angabe</option>
                  <option value="weiblich">weiblich</option>
                  <option value="männlich">männlich</option>
                  <option value="divers">divers</option>
                </select>
              </div>
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-patient-insurance">Versicherungsstatus</label>
                <select
                  id="pdf-patient-insurance"
                  className="mrt-export-select"
                  value={patientInfo.insuranceStatus}
                  onChange={e => handlePatientInfo('insuranceStatus', e.target.value)}
                >
                  <option value="">nicht angegeben</option>
                  <option value="gesetzlich">gesetzlich</option>
                  <option value="privat">privat</option>
                  <option value="Selbstzahler">Selbstzahler</option>
                </select>
              </div>
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-patient-ins-nr">Versicherungsnummer</label>
                <input
                  id="pdf-patient-ins-nr"
                  className="mrt-export-input"
                  type="text"
                  placeholder="optional"
                  value={patientInfo.insuranceNumber}
                  onChange={e => handlePatientInfo('insuranceNumber', e.target.value)}
                />
              </div>
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-patient-email">E-Mail</label>
                <input
                  id="pdf-patient-email"
                  className="mrt-export-input"
                  type="email"
                  placeholder="nicht angegeben"
                  value={patientInfo.email}
                  onChange={e => handlePatientInfo('email', e.target.value)}
                />
              </div>
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-patient-phone">Telefon</label>
                <input
                  id="pdf-patient-phone"
                  className="mrt-export-input"
                  type="tel"
                  placeholder="nicht angegeben"
                  value={patientInfo.phone}
                  onChange={e => handlePatientInfo('phone', e.target.value)}
                />
              </div>
              <div className="mrt-export-field mrt-export-field--full">
                <label className="mrt-export-label" htmlFor="pdf-patient-address">Adresse</label>
                <input
                  id="pdf-patient-address"
                  className="mrt-export-input"
                  type="text"
                  placeholder="nicht angegeben"
                  value={patientInfo.address}
                  onChange={e => handlePatientInfo('address', e.target.value)}
                />
              </div>
              {!forSelf && (
                <div className="mrt-export-field mrt-export-field--full">
                  <label className="mrt-export-label" htmlFor="pdf-patient-relation">Beziehung zur Person</label>
                  <input
                    id="pdf-patient-relation"
                    className="mrt-export-input"
                    type="text"
                    placeholder="z. B. Mutter, Vater, Kind"
                    value={patientInfo.relationship}
                    onChange={e => handlePatientInfo('relationship', e.target.value)}
                  />
                </div>
              )}
            </div>
          </fieldset>

          {/* Practice data */}
          <fieldset className="mrt-export-fieldset">
            <legend className="mrt-export-legend">Praxisdaten</legend>
            <div className="mrt-export-grid">
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-practice-name">Praxis / Einrichtung</label>
                <input
                  id="pdf-practice-name"
                  className="mrt-export-input"
                  type="text"
                  placeholder="nicht angegeben"
                  value={practiceInfo.practiceName}
                  onChange={e => handlePracticeInfo('practiceName', e.target.value)}
                />
              </div>
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-doctor-name">Ärztin / Arzt</label>
                <input
                  id="pdf-doctor-name"
                  className="mrt-export-input"
                  type="text"
                  placeholder="nicht angegeben"
                  value={practiceInfo.doctorName}
                  onChange={e => handlePracticeInfo('doctorName', e.target.value)}
                />
              </div>
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-department">Fachrichtung</label>
                <input
                  id="pdf-department"
                  className="mrt-export-input"
                  type="text"
                  placeholder="nicht angegeben"
                  value={practiceInfo.department}
                  onChange={e => handlePracticeInfo('department', e.target.value)}
                />
              </div>
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-practice-email">E-Mail der Praxis</label>
                <input
                  id="pdf-practice-email"
                  className="mrt-export-input"
                  type="email"
                  placeholder="nicht angegeben"
                  value={practiceInfo.email}
                  onChange={e => handlePracticeInfo('email', e.target.value)}
                />
              </div>
              <div className="mrt-export-field">
                <label className="mrt-export-label" htmlFor="pdf-practice-phone">Telefon der Praxis</label>
                <input
                  id="pdf-practice-phone"
                  className="mrt-export-input"
                  type="tel"
                  placeholder="nicht angegeben"
                  value={practiceInfo.phone}
                  onChange={e => handlePracticeInfo('phone', e.target.value)}
                />
              </div>
              <div className="mrt-export-field mrt-export-field--full">
                <label className="mrt-export-label" htmlFor="pdf-practice-address">Adresse der Praxis</label>
                <input
                  id="pdf-practice-address"
                  className="mrt-export-input"
                  type="text"
                  placeholder="nicht angegeben"
                  value={practiceInfo.address}
                  onChange={e => handlePracticeInfo('address', e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <div className="mrt-export-actions">
            <button
              className="mrt-btn mrt-btn--pdf"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              aria-disabled={pdfLoading}
            >
              {pdfLoading ? 'Erstelle PDF …' : 'PDF herunterladen'}
            </button>
          </div>
        </section>
      )}

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
