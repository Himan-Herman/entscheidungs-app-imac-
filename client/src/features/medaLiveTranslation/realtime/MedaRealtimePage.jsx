import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRealtimeSession } from './useRealtimeSession.js';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';
import { getMessages } from '../../../i18n/translations/index.js';
import { getPracticeChromeMessages } from './medaRealtimePractice.i18n.js';
import { usePracticeProfilePrefill } from './usePracticeProfilePrefill.js';
import PracticeMedaQrModal from './PracticeMedaQrModal.jsx';
import PracticeMedaPdfQrCard from './PracticeMedaPdfQrCard.jsx';
import { createMedaPdfLink } from './medaPdfQrApi.js';
import { REALTIME_LANGUAGES, REALTIME_LANGUAGE_MAP } from './realtimeLanguages.js';
import { exportRealtimeConversationPdf } from './exportRealtimeConversationPdf.js';
import { speakTranslation, cancelSpeech } from './realtimeSpeechPlayback.js';
import { SESSION_MODES, speakerLabel } from './utteranceGate.js';
import { getMedaTranscriptionMessages } from './medaTranscription.i18n.js';
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
import './MedaTranscription.css';

/**
 * Maximum session duration in seconds — the single source for the time limit.
 * Bump this one constant to allow 15/20/30-minute sessions later (e.g. 20 * 60).
 */
const SESSION_MAX_SECONDS = 5 * 60; // 300 s

/** Warning threshold — show banner when this many seconds remain. */
const SESSION_WARN_SECONDS = 60;

/** Inactivity cutoff: stop the live link after this many seconds with no speech. */
const INACTIVITY_TIMEOUT_SECONDS = 30;

/**
 * Live transcription (same language, no translation) documents a whole
 * consultation, examination pauses included — so it has its own limits:
 * a 60-minute maximum, and silence never ends it (only a hint after a while).
 * Only an explicit stop, a technical abort or the maximum end the session.
 */
const TRANSCRIPTION_MAX_SECONDS = 60 * 60;
const TRANSCRIPTION_WARN_SECONDS = 5 * 60;
const TRANSCRIPTION_SILENCE_HINT_SECONDS = 3 * 60;

/**
 * Languages offered for live transcription in the UI. The engine and server
 * are language-generic (same language on both sides = transcription); the
 * visible rollout starts with German. Add a code here to offer it.
 */
const TRANSCRIPTION_LANGUAGES = ['de'];

/** Wall-clock time with seconds, e.g. "14:32:18" — transcript entries. */
function formatClock(isoString, locale) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function interpolate(text, values = {}) {
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''));
}

function formatTurnTime(isoString, locale) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Date only, e.g. "10.06.2026". */
function formatSessionDate(isoString, locale) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/** Time only, e.g. "17:44". */
function formatSessionTime(isoString, locale) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit',
  });
}

/** CSS modifier for the status badge. */
function statusCls(connectionState, sessionStatus, sessionExpired, isPaused) {
  if (sessionExpired)                              return 'expired';
  if (connectionState === 'connecting')            return 'active';
  if (connectionState === 'error')                 return 'idle';
  if (connectionState !== 'connected')             return 'idle';
  if (isPaused)                                    return 'paused';
  if (sessionStatus === 'ready')                   return 'ready';
  if (sessionStatus === 'speaking')                return 'speaking';
  return 'active';
}

export default function MedaRealtimePage({ variant = 'patient' }) {
  // Practice variant: professional B2B chrome (header + status chips) and a
  // dedicated root CSS class. The Realtime engine and all logic are identical to
  // the patient page — only the surrounding presentation differs.
  const isPractice = variant === 'practice';
  const { language } = useLanguage();
  const practiceTx = useMemo(() => getPracticeChromeMessages(language), [language]);
  const txTx = useMemo(() => getMedaTranscriptionMessages(language), [language]);
  const interpreterTx = useMemo(() => {
    const fallback = getMessages('en').medicalInterpreter ?? {};
    return getMessages(language).medicalInterpreter ?? fallback;
  }, [language]);
  const rt = interpreterTx.realtimePage ?? {};
  const uiLocale = useMemo(() => {
    if (language) return language;
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
    return 'en';
  }, [language]);
  const pdfFilePrefix = interpreterTx.pdf?.filenamePrefix || 'medscoutx-interpreter';
  const languageDisplayNames = useMemo(() => {
    if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return null;
    try {
      return new Intl.DisplayNames([uiLocale], { type: 'language' });
    } catch {
      return null;
    }
  }, [uiLocale]);
  const getLanguageName = useCallback((code) => {
    const label = languageDisplayNames?.of(code) || REALTIME_LANGUAGE_MAP[code] || code;
    if (!label) return code;
    return `${String(label).charAt(0).toUpperCase()}${String(label).slice(1)}`;
  }, [languageDisplayNames]);

  // Practice variant only: read practiceId from the URL (?practiceId=...).
  // Patient variant always resolves to '' so it never triggers a practice fetch.
  const [searchParams] = useSearchParams();
  const practiceId = isPractice ? (searchParams.get('practiceId') || '') : '';

  const {
    connect,
    disconnect,
    pause:  pauseSession,
    resume: resumeSession,
    connectionState,
    sessionStatus,
    currentSpeakerRole,
    turns,
    events,
    error,
    audioElRef,
    updateTurnOriginalText,
    setManualMode,
    setActiveSpeaker,
    updateTurnSpeaker,
    sessionMode,
    gateNotice,
  } = useRealtimeSession();

  // ── Language selection ─────────────────────────────────────────────────────
  const [patientLang,  setPatientLang]  = useState('de');
  const [practiceLang, setPracticeLang] = useState('en');

  // ── Practice: interpreting (two languages) or live transcription (one) ──────
  // The patient variant always interprets.
  const [sessionKind, setSessionKind] = useState(SESSION_MODES.INTERPRETATION);
  const interpretationPairRef = useRef({ patient: 'de', practice: 'en' });
  // Transcription: who is speaking right now — null = nobody selected, so a
  // segment stays unassigned instead of being attributed on a guess.
  const [activeSpeaker, setActiveSpeakerState] = useState(/** @type {'patient'|'practice'|null} */ (null));
  // Transcription: shown after a longer silence; never ends the session.
  const [silenceHint, setSilenceHint] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showDebug,        setShowDebug]        = useState(false);
  // Live notice that a segment was kept out of the conversation (never its words)
  const [visibleNotice,    setVisibleNotice]    = useState(/** @type {{reason:string, at:number}|null} */ (null));
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_MAX_SECONDS);
  const [sessionExpired,   setSessionExpired]   = useState(false);

  // ── Consent checkboxes — stay checked for the page lifetime ────────────────
  const [consentAudio,            setConsentAudio]            = useState(false);
  const [consentContext,          setConsentContext]          = useState(false);
  const [consentMedical,          setConsentMedical]          = useState(false);
  const [patientConsentConfirmed, setPatientConsentConfirmed] = useState(false);

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

  // ── Practice section — collapsed by default; data is NOT cleared on collapse ─
  const [showPracticeFields, setShowPracticeFields] = useState(false);

  // ── Speaker detection mode ───────────────────────────────────────────────────
  // 'auto'   = detectLanguage() decides who is speaking (default)
  // 'manual' = user explicitly selects the active speaker
  const [mode,          setMode]          = useState(/** @type {'auto'|'manual'} */ ('auto'));
  const [manualSpeaker, setManualSpeaker] = useState(/** @type {'patient'|'practice'} */ ('patient'));

  // ── Practice QR modal (practice variant only) ────────────────────────────────
  const [qrOpen, setQrOpen] = useState(false);

  // ── Pause state ──────────────────────────────────────────────────────────────
  const [isPaused,   setIsPaused]   = useState(false);
  const pausedAtRef = useRef(/** @type {number|null} */ (null)); // Date.now() when paused

  // ── PDF state ───────────────────────────────────────────────────────────────
  const [pdfLoading, setPdfLoading] = useState(false);
  const sessionStartedAtRef = useRef(/** @type {string|null} */ (null));

  // ── Continue-after-interruption — true during a reconnect that keeps history,
  //    so the original session start time (used by the PDF) is not overwritten ──
  const isContinuingRef = useRef(false);

  // ── How the live session last ended — drives the end-box message ────────────
  // null | 'manual' | 'time_limit' | 'inactivity' | 'connection_error' | 'completed'
  const [endReason, setEndReason] = useState(/** @type {string|null} */ (null));
  const inactivityTimerRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null));

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

  // ── Practice variant: prefill practice master data from the practice profile ─
  // Only runs in the practice variant (practiceId is '' otherwise). Manual input
  // wins: per field `prev.field || practiceData.field` keeps anything the user
  // has already typed even if the fetch resolves afterwards. doctorName stays
  // manual on purpose (no team endpoint in this phase).
  const { practiceData } = usePracticeProfilePrefill(practiceId);
  const practicePrefilled = isPractice && !!practiceData &&
    Object.values(practiceData).some(v => String(v || '').trim() !== '');

  useEffect(() => {
    if (!practiceData) return;
    setPracticeInfo(prev => ({
      ...prev,
      practiceName: prev.practiceName || practiceData.practiceName || '',
      department:   prev.department   || practiceData.department   || '',
      street:       prev.street       || practiceData.street       || '',
      postalCode:   prev.postalCode   || practiceData.postalCode   || '',
      city:         prev.city         || practiceData.city         || '',
      country:      prev.country      || practiceData.country      || '',
      phone:        prev.phone        || practiceData.phone        || '',
      email:        prev.email        || practiceData.email        || '',
      // doctorName intentionally not prefilled — stays manual
    }));
  }, [practiceData]);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const turnsEndRef      = useRef(null);
  const debugLogRef      = useRef(null);
  const timerIntervalRef = useRef(null);
  const sessionStartRef  = useRef(null);

  const disconnectRef = useRef(disconnect);
  useEffect(() => { disconnectRef.current = disconnect; });

  // ── Sync mode/manualSpeaker into useRealtimeSession refs (live, no reconnect) ─
  useEffect(() => {
    setManualMode(mode === 'manual', manualSpeaker);
  }, [mode, manualSpeaker, setManualMode]);

  // ── Transcription: hand the current speaker selection to the engine ────────
  useEffect(() => {
    setActiveSpeaker(activeSpeaker);
  }, [activeSpeaker, setActiveSpeaker]);

  // ── Gate notice: show briefly, then clear ──────────────────────────────────
  useEffect(() => {
    if (!gateNotice) return undefined;
    setVisibleNotice(gateNotice);
    const t = setTimeout(() => setVisibleNotice(null), 5000);
    return () => clearTimeout(t);
  }, [gateNotice]);

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
  // Live transcription keeps running: the practice may switch to its PVS or
  // another tab during the consultation; only stop, abort or the maximum end it.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden' && connectionState === 'connected'
        && sessionMode !== SESSION_MODES.TRANSCRIPTION) {
        disconnect();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [connectionState, disconnect, sessionMode]);

  // ── Hard timeout + countdown ────────────────────────────────────────────────
  // Effect A: Initialise timer values on connect; reset pause state on disconnect.
  useEffect(() => {
    if (connectionState === 'connected') {
      sessionStartRef.current     = Date.now();
      // On a "continue" reconnect keep the ORIGINAL session start so the PDF /
      // history still reflect the whole conversation; otherwise stamp a new start.
      if (!isContinuingRef.current || !sessionStartedAtRef.current) {
        sessionStartedAtRef.current = new Date().toISOString();
      }
      isContinuingRef.current = false;
      setRemainingSeconds(sessionMode === SESSION_MODES.TRANSCRIPTION ? TRANSCRIPTION_MAX_SECONDS : SESSION_MAX_SECONDS);
      setSessionExpired(false);
      setIsPaused(false);
      pausedAtRef.current = null;
    } else {
      // Clear leftover pause on disconnect/error
      setIsPaused(false);
      pausedAtRef.current = null;
    }
    // sessionMode is set by the hook before the connection opens, so it is
    // already final when connectionState turns 'connected'.
  }, [connectionState, sessionMode]);

  // Effect B: Manage the countdown interval.  Stops when paused; restarts on resume.
  // handleResume() shifts sessionStartRef forward by pause duration before setIsPaused(false),
  // so the remaining-seconds calculation is correct when the interval restarts.
  useEffect(() => {
    if (connectionState !== 'connected' || isPaused) return;
    const maxSeconds = sessionMode === SESSION_MODES.TRANSCRIPTION ? TRANSCRIPTION_MAX_SECONDS : SESSION_MAX_SECONDS;

    timerIntervalRef.current = setInterval(() => {
      const elapsed   = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const remaining = Math.max(0, maxSeconds - elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        setSessionExpired(true);
        setEndReason('time_limit');
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
  }, [connectionState, isPaused, sessionMode]);

  // Effect C: Inactivity watchdog. Armed only while the session is connected and
  // genuinely idle ('ready' = waiting for a speaker), and never while paused.
  // sessionStatus changes (speech_active/processing/translating/speaking) re-run
  // this effect and reset the window, so it counts only continuous silence and can
  // never fire while Meda is speaking/translating.
  // Live transcription: silence never ends the session (an examination pause is
  // normal) — after a longer silence it only shows a hint, cleared by speech.
  useEffect(() => {
    if (connectionState !== 'connected' || isPaused || sessionStatus !== 'ready') return;
    const isTranscription = sessionMode === SESSION_MODES.TRANSCRIPTION;

    inactivityTimerRef.current = setTimeout(() => {
      if (isTranscription) {
        setSilenceHint(true);
        return;
      }
      setEndReason('inactivity');
      cancelSpeech();
      disconnectRef.current();
    }, (isTranscription ? TRANSCRIPTION_SILENCE_HINT_SECONDS : INACTIVITY_TIMEOUT_SECONDS) * 1000);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [connectionState, sessionStatus, isPaused, sessionMode]);

  // Speech (or leaving the live state) clears the silence hint.
  useEffect(() => {
    if (sessionStatus !== 'ready' || connectionState !== 'connected') setSilenceHint(false);
  }, [sessionStatus, connectionState]);

  // Effect D: Surface a real connection drop as the end reason (only when it was
  // not already ended for a more specific reason that produces an 'idle' state).
  useEffect(() => {
    if (connectionState === 'error' && sessionHasStarted) {
      setEndReason(prev => prev ?? 'connection_error');
    }
  }, [connectionState, sessionHasStarted]);

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
  const isTranscriptionSetup = isPractice && sessionKind === SESSION_MODES.TRANSCRIPTION;
  // Same language twice is only valid for transcription.
  const langMismatch = !isTranscriptionSetup && patientLang === practiceLang;
  // What the server actually granted for the running / finished session.
  const isTranscriptionLive = sessionMode === SESSION_MODES.TRANSCRIPTION;
  const isTranscriptionView = (isConnected || sessionHasStarted) ? isTranscriptionLive : isTranscriptionSetup;
  const warnSeconds  = isTranscriptionLive ? TRANSCRIPTION_WARN_SECONDS : SESSION_WARN_SECONDS;
  const showWarning  = isConnected && remainingSeconds <= warnSeconds && remainingSeconds > 0;
  // Speaker names from the session form / practice profile only — never from audio.
  const speakerNames = useMemo(() => ({
    patientName:      patientInfo.name,
    practitionerName: practiceInfo.doctorName,
  }), [patientInfo.name, practiceInfo.doctorName]);
  const speakerFallbacks = useMemo(() => ({
    patient:    txTx.speakerPatientFallback,
    practice:   txTx.speakerPractitionerFallback,
    unassigned: txTx.speakerUnassigned,
  }), [txTx]);
  const allConsents  = consentAudio && consentContext && consentMedical && patientConsentConfirmed;
  const hasName      = patientInfo.name.trim() !== '';
  const canStart     = !isBusy && !langMismatch && allConsents && hasName;

  const patientLangLabel  = getLanguageName(patientLang);
  const practiceLangLabel = getLanguageName(practiceLang);

  function endReasonText(reason) {
    switch (reason) {
      case 'time_limit':       return rt.endBox.reasonTimeLimit;
      case 'inactivity':       return rt.endBox.reasonInactivity;
      case 'connection_error': return rt.endBox.reasonConnection;
      case 'manual':
      case 'completed':        return rt.endBox.reasonManual;
      default:                 return null;
    }
  }

  function archivePartyLabel(entry) {
    const dept = String(entry?.practiceDepartment ?? entry?.practiceInfo?.department ?? '').trim();
    const doctor = String(entry?.doctorName ?? entry?.practiceInfo?.doctorName ?? '').trim();
    const parts = [dept, doctor].filter(Boolean);
    if (parts.length) return parts.join(' ');
    const practice = String(entry?.practiceName ?? '').trim();
    if (practice) return practice;
    return rt.title;
  }

  function buildStatusLabel() {
    if (sessionExpired) return rt.status.ended;
    if (connectionState === 'connecting') return rt.status.connecting;
    if (connectionState === 'error') return rt.status.disconnected;
    if (connectionState !== 'connected') return rt.status.ready;
    if (isPaused) return rt.status.paused;

    switch (sessionStatus) {
      case 'ready': return rt.status.waitingSpeaker;
      case 'speech_active': return rt.status.speakingDetected;
      case 'processing': return rt.status.processing;
      case 'translating': return rt.status.translating;
      case 'speaking': return rt.status.speakingOutput;
      default: return rt.status.ready;
    }
  }

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
        messages: interpreterTx,
        locale: uiLocale,
        mode: sessionMode,
        speakerNames,
        transcriptionText: txTx,
      });
    } catch (err) {
      console.error('[MedaRealtimePage] PDF export failed:', err?.message);
    } finally {
      setPdfLoading(false);
    }
  }, [turns, patientInfo, practiceInfo, forSelf, patientLang, practiceLang, interpreterTx, uiLocale,
    sessionMode, speakerNames, txTx]);

  // Practice PDF-QR: build the PDF blob and upload it for a secure token link.
  // Runs ONLY on explicit user action inside the practice variant — never on the
  // normal local download or when saving to local history.
  const handleProvidePdfQr = useCallback(async () => {
    const blob = await exportRealtimeConversationPdf({
      turns,
      patientInfo,
      practiceInfo,
      forSelf,
      languages: { patientLanguage: patientLang, practiceLanguage: practiceLang },
      sessionStartedAt: sessionStartedAtRef.current,
      messages: interpreterTx,
      locale: uiLocale,
      mode: sessionMode,
      speakerNames,
      transcriptionText: txTx,
    }, { returnBlob: true });

    const datePart = (sessionStartedAtRef.current || '').slice(0, 10) || 'session';
    return createMedaPdfLink({
      practiceId,
      blob,
      fileName: `${pdfFilePrefix}-${datePart}.pdf`,
      sessionStartedAt: sessionStartedAtRef.current,
      patientLanguage:  patientLang,
      practiceLanguage: practiceLang,
    });
  }, [turns, patientInfo, practiceInfo, forSelf, patientLang, practiceLang, practiceId, interpreterTx, uiLocale, pdfFilePrefix,
    sessionMode, speakerNames, txTx]);

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
    setIsPaused(false);
    pausedAtRef.current = null;
    setEndReason(null);
    connect({
      patientLanguage:  patientLang,
      practiceLanguage: practiceLang,
      mode: isTranscriptionSetup ? SESSION_MODES.TRANSCRIPTION : SESSION_MODES.INTERPRETATION,
    });
  }

  // Practice setup: switch between interpreting and live transcription. The
  // interpreting pair is remembered so switching back restores it.
  function handleSessionKind(kind) {
    if (kind === sessionKind) return;
    if (kind === SESSION_MODES.TRANSCRIPTION) {
      interpretationPairRef.current = { patient: patientLang, practice: practiceLang };
      const lang = TRANSCRIPTION_LANGUAGES.includes(practiceLang) ? practiceLang : TRANSCRIPTION_LANGUAGES[0];
      setPatientLang(lang);
      setPracticeLang(lang);
    } else {
      setPatientLang(interpretationPairRef.current.patient);
      setPracticeLang(interpretationPairRef.current.practice);
    }
    setSessionKind(kind);
  }

  function handleTranscriptionLanguage(code) {
    setPatientLang(code);
    setPracticeLang(code);
  }

  // Manual end — clearly distinguished from time-limit / inactivity / error stops.
  function handleStopSession() {
    setEndReason('manual');
    cancelSpeech();
    disconnect();
  }

  // Continue after a technical stop / connection drop: rebuild the Realtime
  // connection while keeping existing turns + form data. No new form, no PDF,
  // no history entry — purely a fresh live link onto the same conversation.
  function handleContinueSession() {
    setSessionExpired(false);
    setIsPaused(false);
    pausedAtRef.current = null;
    setEndReason(null);
    isContinuingRef.current = true; // keep original sessionStartedAt for the PDF
    connect(
      { patientLanguage: patientLang, practiceLanguage: practiceLang, mode: sessionMode },
      { keepHistory: true },
    );
  }

  function handlePause() {
    pauseSession();           // disables mic track in hook
    pausedAtRef.current = Date.now();
    setIsPaused(true);        // triggers Effect B to clear interval
  }

  function handleResume() {
    // Shift the session start forward by however long we were paused.
    // Effect B restarts the interval after setIsPaused(false), so by then
    // sessionStartRef already reflects the correct elapsed time.
    if (pausedAtRef.current !== null) {
      sessionStartRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    resumeSession();          // re-enables mic track in hook
    setIsPaused(false);       // triggers Effect B to restart interval
  }

  function handleNewSession() {
    setSessionHasStarted(false);
    setSessionExpired(false);
    setArchiveSaved(false);
    setIsPaused(false);
    pausedAtRef.current = null;
    setEndReason(null);
    setMode('auto');
    setManualSpeaker('patient');
    setActiveSpeakerState(null);
  }

  function handleSaveToArchive() {
    const entry = buildArchiveEntry({
      turns,
      patientInfo,
      practiceInfo,
      patientLanguage:  patientLang,
      practiceLanguage: practiceLang,
      sessionStartedAt: sessionStartedAtRef.current,
      mode:             sessionMode,
    });
    saveArchivedConversation(entry);
    setArchivedConversations(getArchivedConversations());
    setArchiveSaved(true);
  }

  function handleDeleteArchiveEntry(id) {
    if (!window.confirm(rt.confirm.deleteEntry)) return;
    deleteArchivedConversation(id);
    setArchivedConversations(getArchivedConversations());
    if (archiveExpandedId === id) setArchiveExpandedId(null);
  }

  function handleClearArchive() {
    if (!window.confirm(rt.confirm.deleteAll)) return;
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
        messages: interpreterTx,
        locale: uiLocale,
        mode: entry.mode ?? SESSION_MODES.INTERPRETATION,
        speakerNames: { patientName: entry.patientName ?? '', practitionerName: entry.doctorName ?? '' },
        transcriptionText: txTx,
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
    if (langMismatch) return rt.setup.blockLanguages;
    if (!hasName) return rt.setup.blockName;
    if (!allConsents) return rt.setup.blockConsents;
    return null;
  }
  const blockHint = (!canStart && !isBusy) ? getBlockHint() : null;

  const label = buildStatusLabel();
  const badgeCls = statusCls(connectionState, sessionStatus, sessionExpired, isPaused);
  const showPulse = badgeCls === 'active' || badgeCls === 'speaking';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={`mrt-page${isPractice ? ' mrt-page--practice' : ''}`}>
      {/* Hidden audio element — receives remote WebRTC audio track */}
      {/* The playback sink for translated speech: live audio, so there is no
          track to caption, and it is display:none — out of the a11y tree. The
          transcript beside it is what a screen reader follows. */}
      <audio ref={audioElRef} autoPlay style={{ display: 'none' }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className={`mrt-header${isPractice ? ' mrt-header--practice' : ''}`}>
        <div className="mrt-header-titles">
          <h1 className="mrt-title">
            {isTranscriptionView ? txTx.transcriptionTitle : (isPractice ? practiceTx.title : rt.title)}
          </h1>
          {isTranscriptionView ? (
            <p className="mrt-subtitle mrt-subtitle--transcription">{txTx.transcriptionSubtitle}</p>
          ) : (isPractice || rt.subtitle) && (
            <p className="mrt-subtitle">{isPractice ? practiceTx.subtitle : rt.subtitle}</p>
          )}
        </div>
        <div className="mrt-header-right">
          {isConnected && (
            <div
              className={`mrt-timer${remainingSeconds <= warnSeconds ? ' mrt-timer--warn' : ''}`}
              aria-label={interpolate(rt.timerAria, { time: formatTime(remainingSeconds) })}
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

      {/* ── Practice status chips — local-only / no-audio / two-language ────── */}
      {isPractice && (
        <div className="mrt-practice-chips" role="list" aria-label={practiceTx.subtitle}>
          <span className="mrt-practice-chip" role="listitem">
            <span className="mrt-practice-chip-dot" aria-hidden="true" />
            {practiceTx.chipLocalOnly}
          </span>
          <span className="mrt-practice-chip" role="listitem">
            <span className="mrt-practice-chip-dot" aria-hidden="true" />
            {practiceTx.chipNoAudio}
          </span>
          {!isTranscriptionView && (
            <span className="mrt-practice-chip" role="listitem">
              <span className="mrt-practice-chip-dot" aria-hidden="true" />
              {practiceTx.chipTwoLang}
            </span>
          )}
        </div>
      )}

      {/* ── Practice QR action — opens a modal with the start-page QR code ───── */}
      {isPractice && (
        <div className="mrt-qr-bar">
          <button
            type="button"
            className="mrt-btn mrt-qr-trigger"
            onClick={() => setQrOpen(true)}
            aria-haspopup="dialog"
          >
            <span aria-hidden="true" className="mrt-qr-trigger-icon">▦</span>
            {practiceTx.qrShow}
          </button>
        </div>
      )}

      {/* QR modal — practice variant only. Encodes only the protected start-page URL,
          never patient data, transcript, PDF or medical content. */}
      {isPractice && qrOpen && (
        <PracticeMedaQrModal
          practiceId={practiceId}
          practiceName={practiceInfo.practiceName}
          tx={practiceTx}
          onClose={() => setQrOpen(false)}
        />
      )}

      {/* ── Warning / expired banners ────────────────────────────────────────── */}
      {showWarning && (
        <div className="mrt-timeout-warning" role="alert">
          {interpolate(rt.warningEnding, { time: formatTime(remainingSeconds) })}
        </div>
      )}
      {sessionExpired && (
        <div className="mrt-expired-banner" role="status">
          {rt.expiredBanner}
        </div>
      )}

      {/* ── Setup panel — visible only before the first session ─────────────── */}
      {!isConnected && !sessionHasStarted && (
        <section className="mrt-setup" aria-label={rt.setup.aria}>

          {/* ── 1. Sprachauswahl ──────────────────────────────────────────────── */}
          <div className="mrt-setup-section">
            <h2 className="mrt-setup-section-title">{rt.setup.languagesTitle}</h2>
            {/* Practice only: interpreting (two languages) or live transcription (one). */}
            {isPractice && (
              <div className="mrt-kind-switch" role="radiogroup" aria-label={txTx.modeGroupAria}>
                {[
                  [SESSION_MODES.INTERPRETATION, txTx.modeInterpretation, txTx.modeInterpretationHint],
                  [SESSION_MODES.TRANSCRIPTION, txTx.modeTranscription, txTx.modeTranscriptionHint],
                ].map(([kind, title, hint]) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={sessionKind === kind}
                    className={`mrt-kind-option${sessionKind === kind ? ' mrt-kind-option--active' : ''}`}
                    onClick={() => handleSessionKind(kind)}
                    disabled={isBusy}
                  >
                    <span className="mrt-kind-title">{title}</span>
                    <span className="mrt-kind-hint">{hint}</span>
                  </button>
                ))}
              </div>
            )}
            {isTranscriptionSetup ? (
              <div className="mrt-field mrt-field--single">
                <label className="mrt-label" htmlFor="mrt-transcription-lang">{txTx.transcriptionLanguageLabel}</label>
                <select
                  id="mrt-transcription-lang"
                  className="mrt-select"
                  value={practiceLang}
                  onChange={e => handleTranscriptionLanguage(e.target.value)}
                  disabled={isBusy}
                >
                  {TRANSCRIPTION_LANGUAGES.map(code => (
                    <option key={code} value={code}>{getLanguageName(code)}</option>
                  ))}
                </select>
              </div>
            ) : (
            <div className="mrt-lang-row">
              <div className="mrt-field">
                <label className="mrt-label" htmlFor="mrt-patient-lang">{rt.setup.patientSpeaks}</label>
                <select
                  id="mrt-patient-lang"
                  className="mrt-select"
                  value={patientLang}
                  onChange={e => setPatientLang(e.target.value)}
                  disabled={isBusy}
                >
                  {REALTIME_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{getLanguageName(l.code)}</option>
                  ))}
                </select>
              </div>

              <span className="mrt-arrow" aria-hidden="true">⇄</span>

              <div className="mrt-field">
                <label className="mrt-label" htmlFor="mrt-practice-lang">{rt.setup.practiceSpeaks}</label>
                <select
                  id="mrt-practice-lang"
                  className="mrt-select"
                  value={practiceLang}
                  onChange={e => setPracticeLang(e.target.value)}
                  disabled={isBusy}
                >
                  {REALTIME_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{getLanguageName(l.code)}</option>
                  ))}
                </select>
              </div>
            </div>
            )}
          </div>

          {/* ── Transcription: participants for the speaker labels ─────────────── */}
          {isTranscriptionSetup && (
            <div className="mrt-setup-section">
              <h2 className="mrt-setup-section-title">{txTx.participantsTitle}</h2>
              <p className="mrt-privacy-note">{txTx.participantsHint}</p>
              <div className="mrt-form-grid">
                <div className="mrt-form-field mrt-form-field--full">
                  <label className="mrt-form-label" htmlFor="mrt-doctor-name-display">{txTx.doctorNameLabel}</label>
                  <input
                    id="mrt-doctor-name-display"
                    className="mrt-form-input"
                    type="text"
                    placeholder={rt.setup.doctorNamePlaceholder}
                    value={practiceInfo.doctorName}
                    onChange={e => handlePracticeInfo('doctorName', e.target.value)}
                    disabled={isBusy}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="mrt-tx-hints">
                <p>{txTx.limitHint}</p>
                <p>{txTx.sharedMicHint}</p>
              </div>
            </div>
          )}

          {/* ── 2. Angaben zur Person ─────────────────────────────────────────── */}
          <div className="mrt-setup-section">
            <h2 className="mrt-setup-section-title">{rt.setup.personTitle}</h2>

            <div
              className="mrt-person-toggle"
              role="group"
              aria-label={rt.setup.personGroupAria}
            >
              <button
                type="button"
                className={`mrt-toggle-btn${forSelf ? ' mrt-toggle-btn--active' : ''}`}
                onClick={() => handleForSelf(true)}
                disabled={isBusy}
              >
                {rt.setup.forSelf}
              </button>
              <button
                type="button"
                className={`mrt-toggle-btn${!forSelf ? ' mrt-toggle-btn--active' : ''}`}
                onClick={() => handleForSelf(false)}
                disabled={isBusy}
              >
                {rt.setup.forOther}
              </button>
            </div>

            <div className="mrt-form-grid">
              <div className="mrt-form-field mrt-form-field--full">
                <label className="mrt-form-label" htmlFor="mrt-person-name">
                  {rt.setup.fullNameLabel} <span className="mrt-required-star" aria-label={rt.setup.required}>*</span>
                </label>
                <input
                  id="mrt-person-name"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.fullNamePlaceholder}
                  value={patientInfo.name}
                  onChange={e => handlePatientInfo('name', e.target.value)}
                  disabled={isBusy}
                  aria-required="true"
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-dob">{rt.setup.dateOfBirthLabel}</label>
                <input
                  id="mrt-person-dob"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.dateOfBirthPlaceholder}
                  value={patientInfo.dateOfBirth}
                  onChange={e => handlePatientInfo('dateOfBirth', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-gender">{rt.setup.genderLabel}</label>
                <select
                  id="mrt-person-gender"
                  className="mrt-form-select"
                  value={patientInfo.gender}
                  onChange={e => handlePatientInfo('gender', e.target.value)}
                  disabled={isBusy}
                >
                  <option value="">{rt.setup.genderUnknown}</option>
                  <option value="weiblich">{rt.setup.genderFemale}</option>
                  <option value="männlich">{rt.setup.genderMale}</option>
                  <option value="divers">{rt.setup.genderDiverse}</option>
                </select>
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-insurance">{rt.setup.insuranceStatusLabel}</label>
                <select
                  id="mrt-person-insurance"
                  className="mrt-form-select"
                  value={patientInfo.insuranceStatus}
                  onChange={e => handlePatientInfo('insuranceStatus', e.target.value)}
                  disabled={isBusy}
                >
                  <option value="">{rt.setup.insuranceStatusUnknown}</option>
                  <option value="gesetzlich">{rt.setup.insuranceStatutory}</option>
                  <option value="privat">{rt.setup.insurancePrivate}</option>
                  <option value="Selbstzahler">{rt.setup.insuranceSelfPay}</option>
                </select>
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-ins-name">
                  {rt.setup.insuranceNameLabel}
                  <span className="mrt-form-opt"> {rt.setup.insuranceNameOptional}</span>
                </label>
                <input
                  id="mrt-person-ins-name"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.insuranceNamePlaceholder}
                  value={patientInfo.insuranceName}
                  onChange={e => handlePatientInfo('insuranceName', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-ins-nr">
                  {rt.setup.insuranceNumberLabel}
                  <span className="mrt-form-opt"> {rt.setup.insuranceNameOptional}</span>
                </label>
                <input
                  id="mrt-person-ins-nr"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.insuranceNumberPlaceholder}
                  value={patientInfo.insuranceNumber}
                  onChange={e => handlePatientInfo('insuranceNumber', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-email">{rt.setup.emailLabel}</label>
                <input
                  id="mrt-person-email"
                  className="mrt-form-input"
                  type="email"
                  placeholder={rt.setup.emailPlaceholder || "name@example.com"}
                  value={patientInfo.email}
                  onChange={e => handlePatientInfo('email', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-phone">{rt.setup.phoneLabel}</label>
                <input
                  id="mrt-person-phone"
                  className="mrt-form-input"
                  type="tel"
                  placeholder={rt.setup.phonePlaceholder}
                  value={patientInfo.phone}
                  onChange={e => handlePatientInfo('phone', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field mrt-form-field--full">
                <label className="mrt-form-label" htmlFor="mrt-person-street">{rt.setup.streetLabel}</label>
                <input
                  id="mrt-person-street"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.streetPlaceholder}
                  value={patientInfo.street}
                  onChange={e => handlePatientInfo('street', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-plz">{rt.setup.postalCodeLabel}</label>
                <input
                  id="mrt-person-plz"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.postalCodePlaceholder}
                  value={patientInfo.postalCode}
                  onChange={e => handlePatientInfo('postalCode', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-city">{rt.setup.cityLabel}</label>
                <input
                  id="mrt-person-city"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.cityPlaceholder}
                  value={patientInfo.city}
                  onChange={e => handlePatientInfo('city', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-person-country">
                  {rt.setup.countryLabel}
                  <span className="mrt-form-opt"> {rt.setup.insuranceNameOptional}</span>
                </label>
                <input
                  id="mrt-person-country"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.countryPlaceholder}
                  value={patientInfo.country}
                  onChange={e => handlePatientInfo('country', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              {!forSelf && (
                <div className="mrt-form-field mrt-form-field--full">
                  <label className="mrt-form-label" htmlFor="mrt-person-relation">
                    {rt.setup.relationLabel}
                    <span className="mrt-form-opt"> {rt.setup.insuranceNameOptional}</span>
                  </label>
                  <input
                    id="mrt-person-relation"
                    className="mrt-form-input"
                    type="text"
                    placeholder={rt.setup.relationPlaceholder}
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
            <button
              type="button"
              className="mrt-practice-toggle"
              aria-expanded={showPracticeFields}
              aria-controls="mrt-practice-fields"
              onClick={() => setShowPracticeFields(v => !v)}
              disabled={isBusy}
            >
              <span className="mrt-practice-toggle-label">
                {showPracticeFields ? rt.setup.practiceHide : rt.setup.practiceShow}
              </span>
              <span className="mrt-practice-toggle-hint">{rt.setup.practiceHint}</span>
              <span className="mrt-practice-toggle-arrow" aria-hidden="true">
                {showPracticeFields ? '▲' : '▼'}
              </span>
            </button>
            {showPracticeFields && (
            <div id="mrt-practice-fields" className="mrt-form-grid">
              {practicePrefilled && (
                <p className="mrt-privacy-note mrt-form-field--full" role="status">
                  {rt.setup.practicePrefilled}
                </p>
              )}
              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-name">{rt.setup.practiceNameLabel}</label>
                <input
                  id="mrt-practice-name"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.practiceNamePlaceholder}
                  value={practiceInfo.practiceName}
                  onChange={e => handlePracticeInfo('practiceName', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-doctor-name">{rt.setup.doctorNameLabel}</label>
                <input
                  id="mrt-doctor-name"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.doctorNamePlaceholder}
                  value={practiceInfo.doctorName}
                  onChange={e => handlePracticeInfo('doctorName', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-dept">{rt.setup.specialtyLabel}</label>
                <input
                  id="mrt-practice-dept"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.specialtyPlaceholder}
                  value={practiceInfo.department}
                  onChange={e => handlePracticeInfo('department', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-email">{rt.setup.practiceEmailLabel}</label>
                <input
                  id="mrt-practice-email"
                  className="mrt-form-input"
                  type="email"
                  placeholder={rt.setup.practiceEmailPlaceholder}
                  value={practiceInfo.email}
                  onChange={e => handlePracticeInfo('email', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-phone">{rt.setup.practicePhoneLabel}</label>
                <input
                  id="mrt-practice-phone"
                  className="mrt-form-input"
                  type="tel"
                  placeholder={rt.setup.phonePlaceholder}
                  value={practiceInfo.phone}
                  onChange={e => handlePracticeInfo('phone', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field mrt-form-field--full">
                <label className="mrt-form-label" htmlFor="mrt-practice-street">{rt.setup.practiceStreetLabel}</label>
                <input
                  id="mrt-practice-street"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.practiceStreetPlaceholder}
                  value={practiceInfo.street}
                  onChange={e => handlePracticeInfo('street', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-plz">{rt.setup.practicePostalCodeLabel}</label>
                <input
                  id="mrt-practice-plz"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.practicePostalCodePlaceholder}
                  value={practiceInfo.postalCode}
                  onChange={e => handlePracticeInfo('postalCode', e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="mrt-form-field">
                <label className="mrt-form-label" htmlFor="mrt-practice-city">{rt.setup.practiceCityLabel}</label>
                <input
                  id="mrt-practice-city"
                  className="mrt-form-input"
                  type="text"
                  placeholder={rt.setup.practiceCityPlaceholder}
                  value={practiceInfo.city}
                  onChange={e => handlePracticeInfo('city', e.target.value)}
                  disabled={isBusy}
                />
              </div>
            </div>
            )}
          </div>

          {/* ── 4. Zustimmungen ───────────────────────────────────────────────── */}
          <div className="mrt-consent-list" role="group" aria-label={rt.setup.consentsAria}>
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
                {isTranscriptionSetup ? txTx.consentAudioTranscription : rt.setup.consentAudio}
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
                {rt.setup.consentContext}
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
                {isTranscriptionSetup ? txTx.consentMedicalTranscription : rt.setup.consentMedical}
              </label>
            </div>

            <div className="mrt-consent-item">
              <input
                type="checkbox"
                id="mrt-consent-patient"
                className="mrt-consent-checkbox"
                checked={patientConsentConfirmed}
                onChange={e => setPatientConsentConfirmed(e.target.checked)}
                disabled={isBusy}
              />
              <label htmlFor="mrt-consent-patient" className="mrt-consent-label">
                {isTranscriptionSetup ? txTx.consentPatientTranscription : rt.setup.consentPatient}
              </label>
            </div>
          </div>

          <p className="mrt-privacy-note mrt-privacy-note--data">
            {rt.setup.localAudioNote}
          </p>

          {blockHint && (
            <p className="mrt-consent-hint" role="alert">{blockHint}</p>
          )}

          <p className="mrt-privacy-note">
            {rt.setup.localSessionNote}
          </p>

          <div className="mrt-controls">
            <button
              className="mrt-btn mrt-btn--start"
              onClick={handleStart}
              disabled={!canStart}
              aria-disabled={!canStart}
            >
              {isConnecting ? rt.setup.connecting : rt.setup.start}
            </button>
          </div>

          {error && !sessionExpired && (
            <p className="mrt-error" role="alert">{error}</p>
          )}
        </section>
      )}

      {/* ── Active session bar — compact summary + pause + stop button ─────── */}
      {isConnected && (
        <div className="mrt-session-bar">
          {isTranscriptionLive ? (
            <span className="mrt-session-langs">
              {txTx.languageLabel}: <strong>{patientLangLabel}</strong>
            </span>
          ) : (
            <span className="mrt-session-langs">
              {rt.sessionBar.patientLabel}: <strong>{patientLangLabel}</strong>
              <span className="mrt-session-sep" aria-hidden="true"> · </span>
              {rt.sessionBar.practiceLabel}: <strong>{practiceLangLabel}</strong>
            </span>
          )}
          <div className="mrt-session-controls">
            <button
              className={`mrt-btn mrt-btn--pause mrt-btn--compact${isPaused ? ' mrt-btn--pause-active' : ''}`}
              onClick={isPaused ? handleResume : handlePause}
              aria-pressed={isPaused}
              aria-label={isPaused ? rt.sessionBar.resumeAria : rt.sessionBar.pauseAria}
              title={isPaused ? rt.sessionBar.resumeTitle : rt.sessionBar.pauseTitle}
            >
              {isPaused ? `▶ ${rt.sessionBar.resumeButton}` : `⏸ ${rt.sessionBar.pauseButton}`}
            </button>
            <button
              className="mrt-btn mrt-btn--stop mrt-btn--compact"
              onClick={handleStopSession}
            >
              {rt.sessionBar.endButton}
            </button>
          </div>
        </div>
      )}

      {/* ── Transcription: who is speaking now (bound at speech start) ──────── */}
      {isConnected && isTranscriptionLive && (
        <div className="mrt-speaker-select" role="group" aria-labelledby="mrt-who-speaks">
          <span id="mrt-who-speaks" className="mrt-speaker-select-label">{txTx.whoSpeaks}</span>
          <div className="mrt-speaker-select-buttons">
            {['practice', 'patient'].map(role => (
              <button
                key={role}
                type="button"
                className={`mrt-speaker-choice mrt-speaker-choice--${role}${activeSpeaker === role ? ' mrt-speaker-choice--active' : ''}`}
                aria-pressed={activeSpeaker === role}
                onClick={() => setActiveSpeakerState(prev => (prev === role ? null : role))}
              >
                <span className="mrt-speaker-choice-dot" aria-hidden="true" />
                {speakerLabel(role, speakerNames, speakerFallbacks)}
              </button>
            ))}
          </div>
          <p className="mrt-speaker-select-hint">{txTx.whoSpeaksHint}</p>
        </div>
      )}
      {isConnected && isTranscriptionLive && silenceHint && (
        <p className="mrt-silence-hint" role="status">{txTx.silenceHint}</p>
      )}

      {/* ── Mode bar — auto / manual speaker detection toggle ───────────────── */}
      {isConnected && !isTranscriptionLive && (
        <div className="mrt-mode-bar">
          {/* Segmented control: Automatisch / Manuell */}
          <div
            className="mrt-mode-seg"
            role="group"
            aria-label={rt.mode.groupAria}
          >
            <button
              type="button"
              className={`mrt-mode-btn${mode === 'auto' ? ' mrt-mode-btn--active' : ''}`}
              onClick={() => setMode('auto')}
              aria-pressed={mode === 'auto'}
              disabled={sessionStatus === 'speaking' || sessionStatus === 'translating'}
              title={rt.mode.autoTitle}
            >
              {rt.mode.autoLabel}
            </button>
            <button
              type="button"
              className={`mrt-mode-btn${mode === 'manual' ? ' mrt-mode-btn--active' : ''}`}
              onClick={() => setMode('manual')}
              aria-pressed={mode === 'manual'}
              disabled={sessionStatus === 'speaking' || sessionStatus === 'translating'}
              title={rt.mode.manualTitle}
            >
              {rt.mode.manualLabel}
            </button>
          </div>

          {/* Speaker selection — only visible in manual mode */}
          {mode === 'manual' && (
            <div
              className="mrt-mode-speaker"
              role="group"
              aria-label={rt.mode.activeSpeakerAria}
            >
              <button
                type="button"
                className={`mrt-mode-speaker-btn mrt-mode-speaker-btn--patient${manualSpeaker === 'patient' ? ' mrt-mode-speaker-btn--active' : ''}`}
                onClick={() => setManualSpeaker('patient')}
                aria-pressed={manualSpeaker === 'patient'}
                disabled={sessionStatus === 'speaking' || sessionStatus === 'translating' || sessionStatus === 'processing' || sessionStatus === 'speech_active'}
              >
                {rt.mode.activePatient}
              </button>
              <button
                type="button"
                className={`mrt-mode-speaker-btn mrt-mode-speaker-btn--practice${manualSpeaker === 'practice' ? ' mrt-mode-speaker-btn--active' : ''}`}
                onClick={() => setManualSpeaker('practice')}
                aria-pressed={manualSpeaker === 'practice'}
                disabled={sessionStatus === 'speaking' || sessionStatus === 'translating' || sessionStatus === 'processing' || sessionStatus === 'speech_active'}
              >
                {rt.mode.activePractice}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Gate notice — a segment was kept out of the conversation ───────── */}
      {isConnected && visibleNotice && rt.gate?.[visibleNotice.reason] && (
        <p key={visibleNotice.at} className="mrt-gate-notice" role="status">
          <span className="mrt-gate-notice-icon" aria-hidden="true">⊘</span>
          <span className="visually-hidden">{rt.gate.aria}: </span>
          {rt.gate[visibleNotice.reason]}
        </p>
      )}

      {/* ── Speaker bar — highlights last detected speaker ──────────────────── */}
      {isConnected && !isTranscriptionLive && (
        <div className="mrt-pingpong-bar" aria-live="polite" aria-label={rt.mode.detectedSpeakerAria}>
          <div className={`mrt-speaker-pill${currentSpeakerRole === 'patient' ? ' mrt-speaker-pill--active' : ''}`}>
            {rt.sessionBar.patientLabel} · {patientLangLabel}
          </div>
          <div className="mrt-pingpong-arrow" aria-hidden="true">⇄</div>
          <div className={`mrt-speaker-pill${currentSpeakerRole === 'practice' ? ' mrt-speaker-pill--active' : ''}`}>
            {rt.sessionBar.practiceLabel} · {practiceLangLabel}
          </div>
        </div>
      )}

      {/* ── Conversation turns ───────────────────────────────────────────────── */}
      <section className="mrt-conversation" aria-label={rt.conversation.aria}>
        {turns.length === 0 && isConnected && isTranscriptionLive && (
          <p className="mrt-conversation-empty">{txTx.transcriptWaiting}</p>
        )}
        {turns.length === 0 && isConnected && !isTranscriptionLive && (
          <p className="mrt-conversation-empty">
            {mode === 'manual'
              ? (manualSpeaker === 'patient'
                ? rt.conversation.emptyManualPatient
                : rt.conversation.emptyManualPractice)
              : rt.conversation.emptyAuto}
          </p>
        )}
        {turns.length === 0 && !isConnected && !isConnecting && !sessionExpired && (
          <p className="mrt-conversation-empty mrt-conversation-empty--idle">
            {rt.conversation.emptyIdle}
          </p>
        )}

        {turns.map(turn => {
          // Same-language session: one transcript, no translation column.
          if (turn.mode === SESSION_MODES.TRANSCRIPTION) {
            const role = turn.speakerRole === 'patient' || turn.speakerRole === 'practice' ? turn.speakerRole : null;
            return (
              <article key={turn.key} className={`mrt-tx-turn mrt-tx-turn--${role ?? 'unassigned'}`}>
                <header className="mrt-tx-head">
                  <span className="mrt-tx-speaker">{speakerLabel(role, speakerNames, speakerFallbacks)}</span>
                  <time className="mrt-tx-time" dateTime={turn.timestamp}>{formatClock(turn.timestamp, uiLocale)}</time>
                  {turn.isDone && (
                    <span className="mrt-tx-tools">
                      {/* Correcting the speaker belongs to the review after the
                          session; live, the view stays on speaker, text, time. */}
                      {!isConnected && (
                        <select
                          className="mrt-tx-reassign"
                          value={role ?? ''}
                          onChange={e => updateTurnSpeaker(turn.key, e.target.value || null)}
                          aria-label={txTx.reassignSpeakerAria}
                        >
                          <option value="practice">{speakerLabel('practice', speakerNames, speakerFallbacks)}</option>
                          <option value="patient">{speakerLabel('patient', speakerNames, speakerFallbacks)}</option>
                          <option value="">{txTx.speakerUnassigned}</option>
                        </select>
                      )}
                      {editingKey !== turn.key && (
                        <button
                          type="button"
                          className="mrt-turn-edit-trigger"
                          onClick={() => handleEditStart(turn)}
                          aria-label={rt.conversation.editOriginalAria}
                          title={rt.conversation.editOriginalTitle}
                        >
                          ✎
                        </button>
                      )}
                    </span>
                  )}
                </header>
                {editingKey === turn.key ? (
                  <div className="mrt-turn-edit">
                    <textarea
                      className="mrt-turn-edit-area"
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      rows={3}
                      // Focused deliberately: this field only exists because
                      // the user just chose to edit this turn.
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
                        {rt.conversation.save}
                      </button>
                      <button className="mrt-turn-edit-btn mrt-turn-edit-btn--cancel" onClick={handleEditCancel}>
                        {rt.conversation.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mrt-tx-text">
                    {turn.originalText !== null
                      ? turn.originalText
                      : <span className="mrt-turn-pending">{rt.conversation.pendingTranscription}</span>}
                  </p>
                )}
                {editingKey !== turn.key && (turn.originalEdited || turn.speakerEdited) && (
                  <span className="mrt-turn-edited-badge">
                    {turn.originalEdited ? rt.conversation.editedBadge : txTx.speakerEdited}
                  </span>
                )}
              </article>
            );
          }

          const roleLabel =
            turn.speakerRole === 'patient' ? rt.conversation.rolePatient :
            turn.speakerRole === 'practice' ? rt.conversation.rolePractice :
            turn.speakerUncertain ? rt.conversation.roleUncertain :
            turn.isDone ? rt.conversation.roleUnknownLanguage : rt.conversation.roleDetecting;

          return (
            <div
              key={turn.key}
              className={`mrt-turn${turn.speakerRole ? ` mrt-turn--${turn.speakerRole}` : ' mrt-turn--detecting'}${turn.isDone ? ' mrt-turn--done' : ''}`}
            >
              {/* ── Header: Rolle + Zeitstempel ──────────────────────────────── */}
              <div className="mrt-turn-header">
                <span className="mrt-turn-role">{roleLabel}</span>
                <span className="mrt-turn-timestamp">{formatTurnTime(turn.timestamp, uiLocale)}</span>
              </div>

              {/* ── Originaltext ─────────────────────────────────────────────── */}
              <div className="mrt-turn-original">
                <div className="mrt-turn-original-header">
                  {turn.sourceLanguage ? (
                    <span className="mrt-turn-section-label">
                      {rt.conversation.sourceLanguageLabel}: <strong>{getLanguageName(turn.sourceLanguage)}</strong>
                    </span>
                  ) : (
                    <span className="mrt-turn-section-label mrt-turn-section-label--muted">
                      {turn.speakerUncertain
                        ? rt.conversation.languageUncertain
                        : turn.isDone ? rt.conversation.unknownLanguage : rt.conversation.detectingLanguage}
                    </span>
                  )}
                  {turn.isDone && !turn.unsupportedLanguage && editingKey !== turn.key && (
                    <button
                      className="mrt-turn-edit-trigger"
                      onClick={() => handleEditStart(turn)}
                      aria-label={rt.conversation.editOriginalAria}
                      title={rt.conversation.editOriginalTitle}
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
                      // Focused deliberately: this field only exists because
                      // the user just chose to edit this turn, so focus follows
                      // the action they took.
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
                        {rt.conversation.save}
                      </button>
                      <button
                        className="mrt-turn-edit-btn mrt-turn-edit-btn--cancel"
                        onClick={handleEditCancel}
                      >
                        {rt.conversation.cancel}
                      </button>
                    </div>
                  </div>
                ) : turn.unsupportedLanguage ? (
                  // Privacy/safety: never show the raw foreign transcript.
                  <p className="mrt-turn-text mrt-turn-text--unsupported">
                    {rt.conversation.unsupportedLanguage}
                  </p>
                ) : (
                  <p className="mrt-turn-text">
                    {turn.originalText !== null
                      ? turn.originalText
                      : <span className="mrt-turn-pending">{rt.conversation.pendingTranscription}</span>}
                  </p>
                )}

                {turn.originalEdited && editingKey !== turn.key && (
                  <span className="mrt-turn-edited-badge">{rt.conversation.editedBadge}</span>
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
                        ? rt.conversation.translatorLabel
                        : turn.targetRole
                          ? (turn.targetRole === 'patient'
                            ? rt.conversation.translationForPatient
                            : rt.conversation.translationForPractice)
                          : rt.conversation.translationGeneric}
                    </span>
                    {!turn.isUnclear && turn.targetLanguage && (
                      <span className="mrt-turn-lang mrt-turn-lang--translation">
                        {getLanguageName(turn.targetLanguage)}
                      </span>
                    )}
                    {turn.isDone && turn.translatedText && !turn.isUnclear && (
                      <button
                        className="mrt-turn-speak-btn"
                        onClick={() => speakTranslation(turn.translatedText, turn.targetLanguage)}
                        aria-label={rt.conversation.speakTranslationAria}
                        title={rt.conversation.speakTranslationTitle}
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
                      : <span className="mrt-turn-pending">{rt.conversation.pendingTranslation}</span>}
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
        <section className="mrt-end-box" aria-label={rt.endBox.title}>
          <h2 className="mrt-end-title">{rt.endBox.title}</h2>

          {endReasonText(endReason) && (
            <p
              className={`mrt-end-reason mrt-end-reason--${endReason}`}
              role="status"
              aria-live="polite"
            >
              {endReasonText(endReason)}
            </p>
          )}

          <div className="mrt-end-meta">
            <span>
              {rt.endBox.documentationFor}:{' '}
              <strong>{patientInfo.name.trim() || rt.endBox.notProvided}</strong>
            </span>
            {practiceInfo.practiceName.trim() && (
              <span>
                {rt.endBox.practiceLabel}: <strong>{practiceInfo.practiceName.trim()}</strong>
              </span>
            )}
          </div>

          {/* Continue after a technical stop — keeps existing turns, only rebuilds
              the live connection. Shown only while session data is still in memory
              (a page refresh clears it, so no stale live session is resumed). */}
          {turns.length > 0 && (
            <div className="mrt-continue-card">
              <h3 className="mrt-continue-title">{rt.endBox.continueTitle}</h3>
              <p className="mrt-continue-hint">{rt.endBox.continueHint}</p>
              <button
                className="mrt-btn mrt-continue-btn"
                onClick={handleContinueSession}
                disabled={isBusy}
                aria-disabled={isBusy}
              >
                {isConnecting ? rt.endBox.continuing : rt.endBox.continueButton}
              </button>
            </div>
          )}

          {turns.length > 0 ? (
            <p className="mrt-end-hint">{rt.endBox.hint}</p>
          ) : (
            <p className="mrt-end-hint">{rt.endBox.hintEmpty}</p>
          )}

          {isPractice ? (
            <>
              {/* A) Local PDF — created and downloaded on this device, no server storage. */}
              {turns.length > 0 && (
                <div className="mrt-localpdf-card">
                  <h3 className="mrt-localpdf-title">{practiceTx.localPdfTitle}</h3>
                  <p className="mrt-localpdf-hint">{practiceTx.localPdfHint}</p>
                  <button
                    className="mrt-btn mrt-btn--pdf mrt-localpdf-btn"
                    onClick={handleDownloadPdf}
                    disabled={pdfLoading}
                    aria-disabled={pdfLoading}
                    aria-label={rt.endBox.ariaDownloadPdf}
                  >
                    {pdfLoading ? rt.endBox.creatingPdf : rt.endBox.downloadPdf}
                  </button>
                </div>
              )}

              {/* B) PDF via QR — server-stored only after consent, time-limited token link.
                  The QR encodes only the backend token URL — no patient data, no transcript. */}
              {turns.length > 0 && (
                <PracticeMedaPdfQrCard
                  tx={practiceTx}
                  practiceId={practiceId}
                  locale={uiLocale}
                  onProvide={handleProvidePdfQr}
                />
              )}

              {/* General actions — keep history + new session separate from the PDF cards. */}
              <div className="mrt-end-actions">
                {turns.length > 0 && !archiveSaved && (
                  <button
                    className="mrt-btn mrt-btn--archive-save"
                    onClick={handleSaveToArchive}
                  >
                    {rt.endBox.saveToHistory}
                  </button>
                )}
                <button
                  className="mrt-btn mrt-btn--new-session"
                  onClick={handleNewSession}
                >
                  {rt.endBox.newSession}
                </button>
              </div>
              {archiveSaved && (
                <p className="mrt-archive-saved-hint" role="status" aria-live="polite">
                  {rt.endBox.savedLocally}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="mrt-end-actions">
                {turns.length > 0 && (
                  <button
                    className="mrt-btn mrt-btn--pdf"
                    onClick={handleDownloadPdf}
                    disabled={pdfLoading}
                    aria-disabled={pdfLoading}
                    aria-label={rt.endBox.ariaDownloadPdf}
                  >
                    {pdfLoading ? rt.endBox.creatingPdf : rt.endBox.downloadPdf}
                  </button>
                )}
                {turns.length > 0 && !archiveSaved && (
                  <button
                    className="mrt-btn mrt-btn--archive-save"
                    onClick={handleSaveToArchive}
                  >
                    {rt.endBox.saveToHistory}
                  </button>
                )}
                <button
                  className="mrt-btn mrt-btn--new-session"
                  onClick={handleNewSession}
                >
                  {rt.endBox.newSession}
                </button>
              </div>
              {archiveSaved && (
                <p className="mrt-archive-saved-hint" role="status" aria-live="polite">
                  {rt.endBox.savedLocally}
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Local conversation history ──────────────────────────────────────── */}
      {(archivedConversations.length > 0 || (!isConnected && sessionHasStarted)) && (
        <section className="mrt-archive" aria-label={rt.history.title}>
          <h2 className="mrt-archive-title">{rt.history.title}</h2>
          <p className="mrt-archive-privacy">{rt.history.privacy}</p>

          {archivedConversations.length === 0 ? (
            <p className="mrt-archive-empty">{rt.history.empty}</p>
          ) : (
          <ul className="mrt-archive-list">
            {archivedConversations.map(entry => {
              const partyLabel = archivePartyLabel(entry);
              const sessionIso = entry.sessionStartedAt || entry.createdAt;
              const dateStr    = formatSessionDate(sessionIso, uiLocale);
              const timeStr    = formatSessionTime(sessionIso, uiLocale);
              return (
              <li key={entry.id} className="mrt-archive-entry">
                <div className="mrt-archive-entry-header">
                  <div className="mrt-archive-entry-meta">
                    <span className="mrt-archive-entry-summary">
                      <span className="mrt-archive-entry-date">{dateStr}</span>
                      <span className="mrt-archive-entry-sep" aria-hidden="true"> · </span>
                      <span className="mrt-archive-entry-party">{partyLabel}</span>
                      <span className="mrt-archive-entry-sep" aria-hidden="true"> · </span>
                      <span className="mrt-archive-entry-time">{timeStr}</span>
                    </span>
                    <span className="mrt-archive-entry-langs">
                      {rt.history.patientLanguage}: {entry.patientLanguage ? getLanguageName(entry.patientLanguage) : '—'}
                      <span className="mrt-archive-entry-sep" aria-hidden="true"> · </span>
                      {rt.history.practiceLanguage}: {entry.practiceLanguage ? getLanguageName(entry.practiceLanguage) : '—'}
                    </span>
                    <span className="mrt-archive-entry-count">{interpolate(rt.history.turnsCount, { count: entry.turns.length })}</span>
                  </div>
                  <div className="mrt-archive-entry-actions">
                    <button
                      className="mrt-btn mrt-btn--archive-pdf"
                      onClick={() => handleArchivePdf(entry)}
                      disabled={archivePdfLoadingId === entry.id}
                      aria-label={interpolate(rt.history.ariaArchivePdf, { label: `${dateStr} ${partyLabel}` })}
                    >
                      {archivePdfLoadingId === entry.id ? rt.history.pdfLoadingShort : rt.history.pdf}
                    </button>
                    <button
                      className="mrt-btn mrt-btn--archive-view"
                      onClick={() => handleToggleExpand(entry.id)}
                      aria-expanded={archiveExpandedId === entry.id}
                    >
                      {archiveExpandedId === entry.id ? rt.history.closeDetails : rt.history.viewDetails}
                    </button>
                    <button
                      className="mrt-btn mrt-btn--archive-delete"
                      onClick={() => handleDeleteArchiveEntry(entry.id)}
                      aria-label={interpolate(rt.history.ariaDelete, { label: `${dateStr} ${partyLabel}` })}
                    >
                      {rt.history.deleteEntry}
                    </button>
                  </div>
                </div>

                {archiveExpandedId === entry.id && (
                  <div className="mrt-archive-turns">
                    {entry.turns.length === 0 && (
                      <p className="mrt-archive-turns-empty">{rt.history.noStoredTurns}</p>
                    )}
                    {entry.turns.map((t, i) => {
                      // No stored speaker = not reliably assigned — never shown as practice.
                      const role       = t.speakerRole === 'patient' || t.speakerRole === 'practice' ? t.speakerRole : null;
                      const isPatient  = role === 'patient';
                      // Transcription: names from the stored session data, one text, no translation.
                      const isTx       = (t.mode ?? entry.mode) === SESSION_MODES.TRANSCRIPTION;
                      const roleLabel  = isTx
                        ? speakerLabel(role, { patientName: entry.patientName ?? '', practitionerName: entry.doctorName ?? '' }, speakerFallbacks)
                        : role === null ? rt.conversation.roleUncertain
                          : isPatient ? rt.conversation.rolePatient : rt.conversation.rolePractice;
                      const srcLabel   = t.sourceLanguage ? getLanguageName(t.sourceLanguage) : '—';
                      const tgtLabel   = t.targetLanguage ? getLanguageName(t.targetLanguage) : '—';
                      const transLabel = role === null ? rt.conversation.translationGeneric
                        : isPatient ? rt.history.translationForPractice : rt.history.translationForPatient;
                      return (
                        <div
                          key={t.key ?? i}
                          className={`mrt-archive-turn mrt-archive-turn--${role ?? 'uncertain'}`}
                        >
                          <div className="mrt-archive-turn-header">
                            <span className="mrt-archive-turn-role">{roleLabel}</span>
                            {t.timestamp && (
                              <span className="mrt-archive-turn-time">
                                {isTx ? formatClock(t.timestamp, uiLocale) : formatTurnTime(t.timestamp, uiLocale)}
                              </span>
                            )}
                            {t.isUnclear && (
                              <span className="mrt-archive-turn-unclear">{rt.history.unclear}</span>
                            )}
                          </div>
                          <div className="mrt-archive-turn-body">
                            <div className="mrt-archive-turn-section">
                              <span className="mrt-archive-turn-label">{rt.history.originalLabel} ({srcLabel})</span>
                              <p className="mrt-archive-turn-text">{t.originalText || '—'}</p>
                              {t.originalEdited && (
                                <span className="mrt-archive-turn-edited">{rt.history.editedBadge}</span>
                              )}
                            </div>
                            {!isTx && (
                              <div className="mrt-archive-turn-section mrt-archive-turn-section--translation">
                                <span className="mrt-archive-turn-label">{transLabel} ({tgtLabel})</span>
                                <p className="mrt-archive-turn-text">{t.translatedText || '—'}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
              );
            })}
          </ul>
          )}

          {archivedConversations.length > 1 && (
            <button
              className="mrt-btn mrt-btn--archive-clear"
              onClick={handleClearArchive}
            >
              {rt.history.deleteAll}
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
          {interpolate(rt.debug.toggle, { count: events.length })} {showDebug ? '▲' : '▼'}
        </button>
        {showDebug && (
          <div className="mrt-debug-log" ref={debugLogRef}>
            {events.length === 0 && (
              <p className="mrt-debug-empty">{rt.debug.empty}</p>
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
