import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeSession } from './useRealtimeSession.js';
import { REALTIME_LANGUAGES, REALTIME_LANGUAGE_MAP } from './realtimeLanguages.js';
import { exportRealtimeConversationPdf } from './exportRealtimeConversationPdf.js';
import { speakTranslation, cancelSpeech } from './realtimeSpeechPlayback.js';
import {
  usePatientProfilePrefill,
  EMPTY_PATIENT_INFO,
  EMPTY_PRACTICE_INFO,
} from './realtimeFormDefaults.js';
import {
  getArchivedConversations,
  buildArchiveEntry,
  saveArchivedConversation,
  deleteArchivedConversation,
  clearArchivedConversations,
} from './realtimeConversationArchive.js';
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

function formatTurnTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Human-readable status label from connection + session state. */
function buildStatusLabel(connectionState, sessionStatus, sessionExpired) {
  if (sessionExpired)                   return 'Sitzung beendet';
  if (connectionState === 'connecting') return 'Verbinde …';
  if (connectionState === 'error')      return 'Nicht verbunden';
  if (connectionState !== 'connected')  return 'Bereit';

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
  if (connectionState === 'error')                 return 'idle';
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
    updateTurnOriginalText,
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

  // ── Session lifecycle — true once a session has been started; never reset
  //    automatically, so the setup form stays hidden after stop ────────────────
  const [sessionHasStarted, setSessionHasStarted] = useState(false);

  // ── Inline edit state — which turn is being edited and the current draft ────
  const [editingKey, setEditingKey] = useState(/** @type {number|null} */ (null));
  const [editDraft,  setEditDraft]  = useState('');

  // ── PDF state ───────────────────────────────────────────────────────────────
  const [pdfLoading, setPdfLoading] = useState(false);
  const sessionStartedAtRef = useRef(/** @type {string|null} */ (null));

  // ── Local conversation archive ───────────────────────────────────────────────
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [archiveSaved,          setArchiveSaved]          = useState(false);
  const [archiveExpandedId,     setArchiveExpandedId]     = useState(/** @type {string|null} */ (null));
  const [archivePdfLoadingId,   setArchivePdfLoadingId]   = useState(/** @type {string|null} */ (null));

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
      street:          profileData.street          || prev.street,
      postalCode:      profileData.postalCode      || prev.postalCode,
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
      cancelSpeech();
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
          cancelSpeech();
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

  // Load archive from localStorage once on mount
  useEffect(() => {
    setArchivedConversations(getArchivedConversations());
  }, []);

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
        street:          profileData.street          || '',
        postalCode:      profileData.postalCode      || '',
        city:            '',
        country:         '',
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

  function handleEditStart(turn) {
    setEditingKey(turn.key);
    setEditDraft(turn.originalText ?? '');
  }

  function handleEditSave(turnKey) {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    updateTurnOriginalText(turnKey, trimmed);
    setEditingKey(null);
    setEditDraft('');
  }

  function handleEditCancel() {
    setEditingKey(null);
    setEditDraft('');
  }

  function handleStart() {
    setSessionExpired(false);
    setSessionHasStarted(true);
    connect({ patientLanguage: patientLang, practiceLanguage: practiceLang });
  }

  function handleNewSession() {
    setSessionHasStarted(false);
    setSessionExpired(false);
    setArchiveSaved(false);
  }

  function handleSaveToArchive() {
    const entry = buildArchiveEntry({
      turns,
      patientInfo,
      practiceInfo,
      patientLanguage:  patientLang,
      practiceLanguage: practiceLang,
      sessionStartedAt: sessionStartedAtRef.current,
    });
    saveArchivedConversation(entry);
    setArchivedConversations(getArchivedConversations());
    setArchiveSaved(true);
  }

  function handleDeleteArchiveEntry(id) {
    if (!window.confirm('Dieses lokale Gesprächsprotokoll wirklich löschen?')) return;
    deleteArchivedConversation(id);
    setArchivedConversations(getArchivedConversations());
    if (archiveExpandedId === id) setArchiveExpandedId(null);
  }

  function handleClearArchive() {
    if (!window.confirm('Alle lokalen Gesprächsprotokolle wirklich löschen?')) return;
    clearArchivedConversations();
    setArchivedConversations([]);
    setArchiveExpandedId(null);
  }

  async function handleArchivePdf(entry) {
    setArchivePdfLoadingId(entry.id);
    try {
      await exportRealtimeConversationPdf({
        turns:           entry.turns,
        patientInfo:     entry.patientInfo,
        practiceInfo:    entry.practiceInfo,
        languages:       { patientLanguage: entry.patientLanguage, practiceLanguage: entry.practiceLanguage },
        sessionStartedAt: entry.sessionStartedAt,
      });
    } catch (err) {
      console.error('[MedaRealtimePage] Archiv-PDF-Export fehlgeschlagen:', err?.message);
    } finally {
      setArchivePdfLoadingId(null);
    }
  }

  function handleToggleExpand(id) {
    setArchiveExpandedId(prev => (prev === id ? null : id));
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

      {/* ── Setup panel — visible only before the first session ─────────────── */}
      {!isConnected && !sessionHasStarted && (
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
                  placeholder="z. B. Max Mustermann"
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
                <label className="mrt-form-label" htmlFor="mrt-person-ins-name">
                  Krankenkasse / Versicherung
                  <span className="mrt-form-opt"> (optional)</span>
                </label>
                <input
                  id="mrt-person-ins-name"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. AOK, TK, Barmer, Debeka"
                  value={patientInfo.insuranceName}
                  onChange={e => handlePatientInfo('insuranceName', e.target.value)}
                  disabled={isBusy}
                />
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
                <label className="mrt-form-label" htmlFor="mrt-person-street">Straße und Hausnummer</label>
                <input
                  id="mrt-person-street"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. Eisenstraße 64"
                  value={patientInfo.street}
                  onChange={e => handlePatientInfo('street', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-plz">PLZ</label>
                <input
                  id="mrt-person-plz"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. 40227"
                  value={patientInfo.postalCode}
                  onChange={e => handlePatientInfo('postalCode', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-city">Ort</label>
                <input
                  id="mrt-person-city"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. Düsseldorf"
                  value={patientInfo.city}
                  onChange={e => handlePatientInfo('city', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-country">
                  Land
                  <span className="mrt-form-opt"> (optional)</span>
                </label>
                <input
                  id="mrt-person-country"
                  className="mrt-form-input"
                  type="text"
                  placeholder="Deutschland"
                  value={patientInfo.country}
                  onChange={e => handlePatientInfo('country', e.target.value)}
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
                <label className="mrt-form-label" htmlFor="mrt-practice-street">Straße und Hausnummer</label>
                <input
                  id="mrt-practice-street"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. Musterstraße 1"
                  value={practiceInfo.street}
                  onChange={e => handlePracticeInfo('street', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-plz">PLZ</label>
                <input
                  id="mrt-practice-plz"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. 10115"
                  value={practiceInfo.postalCode}
                  onChange={e => handlePracticeInfo('postalCode', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-city">Ort</label>
                <input
                  id="mrt-practice-city"
                  className="mrt-form-input"
                  type="text"
                  placeholder="z. B. Berlin"
                  value={practiceInfo.city}
                  onChange={e => handlePracticeInfo('city', e.target.value)}
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
            onClick={() => { cancelSpeech(); disconnect(); }}
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

        {turns.map(turn => {
          const roleLabel =
            turn.speakerRole === 'patient'  ? 'Patient' :
            turn.speakerRole === 'practice' ? 'Praxis / Arzt' :
            turn.isDone ? 'Sprache nicht erkannt' : 'Erkenne Sprache …';

          return (
            <div
              key={turn.key}
              className={`mrt-turn${turn.speakerRole ? ` mrt-turn--${turn.speakerRole}` : ' mrt-turn--detecting'}${turn.isDone ? ' mrt-turn--done' : ''}`}
            >
              {/* ── Header: Rolle + Zeitstempel ──────────────────────────────── */}
              <div className="mrt-turn-header">
                <span className="mrt-turn-role">{roleLabel}</span>
                <span className="mrt-turn-timestamp">{formatTurnTime(turn.timestamp)}</span>
              </div>

              {/* ── Originaltext ─────────────────────────────────────────────── */}
              <div className="mrt-turn-original">
                <div className="mrt-turn-original-header">
                  {turn.sourceLanguage ? (
                    <span className="mrt-turn-section-label">
                      Originalsprache: <strong>{REALTIME_LANGUAGE_MAP[turn.sourceLanguage] ?? turn.sourceLanguage}</strong>
                    </span>
                  ) : (
                    <span className="mrt-turn-section-label mrt-turn-section-label--muted">
                      {turn.isDone ? 'Unbekannte Sprache' : 'Erkenne Sprache …'}
                    </span>
                  )}
                  {turn.isDone && editingKey !== turn.key && (
                    <button
                      className="mrt-turn-edit-trigger"
                      onClick={() => handleEditStart(turn)}
                      aria-label="Originaltext bearbeiten"
                      title="Originaltext bearbeiten (Ctrl+Enter speichern, Esc abbrechen)"
                    >
                      ✎
                    </button>
                  )}
                </div>

                {editingKey === turn.key ? (
                  <div className="mrt-turn-edit">
                    <textarea
                      className="mrt-turn-edit-area"
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      rows={3}
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && editDraft.trim()) handleEditSave(turn.key);
                        if (e.key === 'Escape') handleEditCancel();
                      }}
                    />
                    <div className="mrt-turn-edit-actions">
                      <button
                        className="mrt-turn-edit-btn mrt-turn-edit-btn--save"
                        onClick={() => handleEditSave(turn.key)}
                        disabled={!editDraft.trim()}
                      >
                        Speichern
                      </button>
                      <button
                        className="mrt-turn-edit-btn mrt-turn-edit-btn--cancel"
                        onClick={handleEditCancel}
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mrt-turn-text">
                    {turn.originalText !== null
                      ? turn.originalText
                      : <span className="mrt-turn-pending">Transkription …</span>}
                  </p>
                )}

                {turn.originalEdited && editingKey !== turn.key && (
                  <span className="mrt-turn-edited-badge">Originaltext manuell korrigiert</span>
                )}
              </div>

              {/* ── Übersetzung (oder Hinweis bei unclear) ────────────────────── */}
              {(turn.translatedText || !turn.isDone) && (
                <div className={`mrt-turn-translation${turn.isUnclear ? ' mrt-turn-translation--unclear' : ''}`}>
                  <div className="mrt-turn-translation-header">
                    <span className={`mrt-turn-section-label${
                      turn.isUnclear ? ' mrt-turn-section-label--unclear' :
                      turn.targetRole ? ' mrt-turn-section-label--for' : ''
                    }`}>
                      {turn.isUnclear
                        ? 'Meda'
                        : turn.targetRole
                          ? `Übersetzung für ${turn.targetRole === 'patient' ? 'Patient' : 'Praxis'}`
                          : 'Übersetzung'}
                    </span>
                    {!turn.isUnclear && turn.targetLanguage && (
                      <span className="mrt-turn-lang mrt-turn-lang--translation">
                        {REALTIME_LANGUAGE_MAP[turn.targetLanguage] ?? turn.targetLanguage}
                      </span>
                    )}
                    {turn.isDone && turn.translatedText && !turn.isUnclear && (
                      <button
                        className="mrt-turn-speak-btn"
                        onClick={() => speakTranslation(turn.translatedText, turn.targetLanguage)}
                        aria-label="Übersetzung vorlesen"
                        title="Übersetzung vorlesen"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className={`mrt-turn-text${turn.isUnclear ? ' mrt-turn-text--unclear' : ' mrt-turn-text--translation'}`}>
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
          );
        })}
        <div ref={turnsEndRef} />
      </section>

      {/* ── End-of-session box — replaces the duplicate form after stop ────────── */}
      {!isConnected && sessionHasStarted && (
        <section className="mrt-end-box" aria-label="Gespräch beendet">
          <h2 className="mrt-end-title">Gespräch beendet</h2>

          <div className="mrt-end-meta">
            <span>
              Dokumentation für:{' '}
              <strong>{patientInfo.name.trim() || 'nicht angegeben'}</strong>
            </span>
            {practiceInfo.practiceName.trim() && (
              <span>
                Praxis: <strong>{practiceInfo.practiceName.trim()}</strong>
              </span>
            )}
          </div>

          {turns.length > 0 ? (
            <p className="mrt-end-hint">
              Sie können das Gesprächsprotokoll jetzt lokal als PDF herunterladen.
              Kein Upload, keine Serverübertragung.
            </p>
          ) : (
            <p className="mrt-end-hint">Kein Gesprächsverlauf aufgezeichnet.</p>
          )}

          <div className="mrt-end-actions">
            {turns.length > 0 && (
              <button
                className="mrt-btn mrt-btn--pdf"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                aria-disabled={pdfLoading}
              >
                {pdfLoading ? 'Erstelle PDF …' : 'PDF herunterladen'}
              </button>
            )}
            {turns.length > 0 && !archiveSaved && (
              <button
                className="mrt-btn mrt-btn--archive-save"
                onClick={handleSaveToArchive}
              >
                Im Gesprächsarchiv speichern
              </button>
            )}
            <button
              className="mrt-btn mrt-btn--new-session"
              onClick={handleNewSession}
            >
              Neues Gespräch starten
            </button>
          </div>
          {archiveSaved && (
            <p className="mrt-archive-saved-hint" role="status">
              Gespräch lokal im Archiv gespeichert.
            </p>
          )}
        </section>
      )}

      {/* ── Local conversation archive ──────────────────────────────────────── */}
      {archivedConversations.length > 0 && (
        <section className="mrt-archive" aria-label="Gesprächsarchiv">
          <h2 className="mrt-archive-title">Gesprächsarchiv</h2>
          <p className="mrt-archive-privacy">
            Dieses Archiv wird nur lokal auf diesem Gerät gespeichert. Es wird nicht an MedScoutX oder eine Praxis übertragen.
          </p>
          <ul className="mrt-archive-list">
            {archivedConversations.map(entry => (
              <li key={entry.id} className="mrt-archive-entry">
                <div className="mrt-archive-entry-header">
                  <div className="mrt-archive-entry-meta">
                    <span className="mrt-archive-entry-date">{formatTurnTime(entry.createdAt)}</span>
                    <span>Patient: <strong>{entry.patientName || 'nicht angegeben'}</strong></span>
                    {entry.practiceName && <span>Praxis: <strong>{entry.practiceName}</strong></span>}
                    <span className="mrt-archive-entry-langs">
                      {REALTIME_LANGUAGE_MAP[entry.patientLanguage] ?? entry.patientLanguage ?? '—'}
                      {' ↔ '}
                      {REALTIME_LANGUAGE_MAP[entry.practiceLanguage] ?? entry.practiceLanguage ?? '—'}
                    </span>
                    <span className="mrt-archive-entry-count">{entry.turns.length} Einträge</span>
                  </div>
                  <div className="mrt-archive-entry-actions">
                    <button
                      className="mrt-btn mrt-btn--archive-pdf"
                      onClick={() => handleArchivePdf(entry)}
                      disabled={archivePdfLoadingId === entry.id}
                    >
                      {archivePdfLoadingId === entry.id ? 'PDF …' : 'PDF'}
                    </button>
                    <button
                      className="mrt-btn mrt-btn--archive-view"
                      onClick={() => handleToggleExpand(entry.id)}
                      aria-expanded={archiveExpandedId === entry.id}
                    >
                      {archiveExpandedId === entry.id ? 'Schließen' : 'Verlauf ansehen'}
                    </button>
                    <button
                      className="mrt-btn mrt-btn--archive-delete"
                      onClick={() => handleDeleteArchiveEntry(entry.id)}
                    >
                      Löschen
                    </button>
                  </div>
                </div>

                {archiveExpandedId === entry.id && (
                  <div className="mrt-archive-turns">
                    {entry.turns.length === 0 && (
                      <p className="mrt-archive-turns-empty">Kein Gesprächsverlauf gespeichert.</p>
                    )}
                    {entry.turns.map((t, i) => {
                      const isPatient  = t.speakerRole === 'patient';
                      const roleLabel  = isPatient ? 'Patient' : 'Praxis / Arzt';
                      const srcLabel   = REALTIME_LANGUAGE_MAP[t.sourceLanguage] ?? t.sourceLanguage ?? '—';
                      const tgtLabel   = REALTIME_LANGUAGE_MAP[t.targetLanguage] ?? t.targetLanguage ?? '—';
                      const transLabel = isPatient ? 'Übersetzung für Praxis' : 'Übersetzung für Patient';
                      return (
                        <div
                          key={t.key ?? i}
                          className={`mrt-archive-turn${isPatient ? ' mrt-archive-turn--patient' : ' mrt-archive-turn--practice'}`}
                        >
                          <div className="mrt-archive-turn-header">
                            <span className="mrt-archive-turn-role">{roleLabel}</span>
                            {t.timestamp && (
                              <span className="mrt-archive-turn-time">{formatTurnTime(t.timestamp)}</span>
                            )}
                            {t.isUnclear && (
                              <span className="mrt-archive-turn-unclear">Nicht sicher zugeordnet</span>
                            )}
                          </div>
                          <div className="mrt-archive-turn-body">
                            <div className="mrt-archive-turn-section">
                              <span className="mrt-archive-turn-label">Original ({srcLabel})</span>
                              <p className="mrt-archive-turn-text">{t.originalText || '—'}</p>
                              {t.originalEdited && (
                                <span className="mrt-archive-turn-edited">Originaltext manuell korrigiert</span>
                              )}
                            </div>
                            <div className="mrt-archive-turn-section mrt-archive-turn-section--translation">
                              <span className="mrt-archive-turn-label">{transLabel} ({tgtLabel})</span>
                              <p className="mrt-archive-turn-text">{t.translatedText || '—'}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {archivedConversations.length > 1 && (
            <button
              className="mrt-btn mrt-btn--archive-clear"
              onClick={handleClearArchive}
            >
              Alle lokalen Protokolle löschen
            </button>
          )}
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
