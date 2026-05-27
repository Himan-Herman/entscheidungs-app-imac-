import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { resolveLiveTranslationMessages } from "../utils/safeLiveTranslationMessages.js";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import { isLiveMedicalTranslationEnabled } from "../featureFlag.js";
import { LIVE_TRANSLATION_LANGUAGE_OPTIONS } from "../languages.js";
import { buildLanguageRouting } from "../utils/routing.js";
import { buildDirectionLabel, isLanguageRoutingEnabled } from "../utils/languageBasedRouting.js";
import { useLiveTranslationSession } from "../hooks/useLiveTranslationSession.js";
import { playSpeakerSwitchSound } from "../utils/speakerSwitchFeedback.js";
import SetupPracticeAccordion from "../components/SetupPracticeAccordion.jsx";
import PlanBControls from "../components/PlanBControls.jsx";
import LiveTranslationArchivePanel from "../components/LiveTranslationArchivePanel.jsx";
import LiveTranslationTurnHistory from "../components/LiveTranslationTurnHistory.jsx";
import {
  buildExportMetadata,
  buildSessionMetadata,
  EMPTY_PRACTICE_INFO,
} from "../utils/sessionMetadata.js";
import { saveLiveTranslationArchiveItem } from "../session/localLiveTranslationArchive.js";
import { downloadLiveTranslationPdf } from "../pdf/generateLiveTranslationPdf.js";
import { LIVE_SESSION_MAX_MS } from "../utils/sessionTimer.js";
import { getMedaIntroText, getMedaReadinessPhrase } from "../utils/medaIntro.js";
import {
  isActivationSoundMuted,
  setActivationSoundMuted,
} from "../utils/medaActivationFeedback.js";
import { isSetupComplete, isValidBirthDate, isPreliveStartReady, normalizePatientName, normalizeDoctorPracticeName } from "../utils/setupValidation.js";
import { fetchLiveTranslationProfilePrefill } from "../utils/patientProfilePrefill.js";
import { GENDER_FORM_OF_ADDRESS_CODES } from "../utils/genderFormOfAddress.js";
import "../styles/LiveTranslationPage.css";

function resolveInitialLanguage(language, role) {
  if (role === "patient") {
    return ["de", "en", "fr", "es", "it"].includes(language) ? language : "de";
  }
  return language === "de" ? "en" : "de";
}

function formatBirthDateDisplay(isoDate, lang) {
  try {
    const [year, month, day] = isoDate.split("-").map(Number);
    if (!year || !month || !day) return isoDate;
    return new Date(year, month - 1, day).toLocaleDateString(getPrimaryIntlLocale(lang), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return isoDate;
  }
}

export default function LiveTranslationPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => resolveLiveTranslationMessages(getMessages(language)),
    [language],
  );

  const [step, setStep] = useState(/** @type {"setup" | "prelive" | "active" | "ended"} */ ("setup"));
  const [patientLanguage, setPatientLanguage] = useState(() =>
    resolveInitialLanguage(language, "patient"),
  );
  const [doctorLanguage, setDoctorLanguage] = useState(() =>
    resolveInitialLanguage(language, "doctor"),
  );
  const [activeSpeaker, setActiveSpeaker] = useState(
    /** @type {"patient" | "doctor"} */ ("patient"),
  );
  const [autoSwitchSpeaker, setAutoSwitchSpeaker] = useState(true);
  const [activationSoundMuted, setActivationSoundMutedState] = useState(() =>
    isActivationSoundMuted(),
  );
  const [speakerSwitchAnim, setSpeakerSwitchAnim] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [genderOrFormOfAddress, setGenderOrFormOfAddress] = useState("");
  const [profilePrefilled, setProfilePrefilled] = useState(false);
  const [profilePrefillAvailable, setProfilePrefillAvailable] = useState(false);
  const [preparedForOtherPerson, setPreparedForOtherPerson] = useState(false);
  const [doctorPracticeName, setDoctorPracticeName] = useState("");
  const [participantConsent, setParticipantConsent] = useState(false);
  const [medicalPurposeConsent, setMedicalPurposeConsent] = useState(false);
  const [translationLimitationsConsent, setTranslationLimitationsConsent] = useState(false);
  const [preliveError, setPreliveError] = useState("");
  const [practiceInfo, setPracticeInfo] = useState(() => ({ ...EMPTY_PRACTICE_INFO }));
  const [sessionMetadata, setSessionMetadata] = useState(
    /** @type {ReturnType<typeof buildSessionMetadata> | null} */ (null),
  );
  const [formError, setFormError] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [languageUncertain, setLanguageUncertain] = useState(false);
  const [exportData, setExportData] = useState(
    /** @type {ReturnType<typeof buildExportMetadata> | null} */ (null),
  );
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0);
  const [unclearBanner, setUnclearBanner] = useState("");
  const [wrongLanguageBanner, setWrongLanguageBanner] = useState("");
  const [sessionWarning, setSessionWarning] = useState("");
  const [autoEnded, setAutoEnded] = useState(false);
  const [localSaveState, setLocalSaveState] = useState(/** @type {"idle" | "saved" | "declined"} */ ("idle"));
  const [scopeWarningVisible, setScopeWarningVisible] = useState(false);
  const [scopeTranslationPausedBanner, setScopeTranslationPausedBanner] = useState("");
  const [manualSpeakerOverride, setManualSpeakerOverride] = useState(false);
  const skipLanguageRoutingRef = useRef(false);
  const profilePrefillSnapshotRef = useRef(
    /** @type {import("../utils/patientProfilePrefill.js").LiveTranslationProfilePrefill | null} */ (null),
  );
  const pdfDownloadRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const turnsRef = useRef(/** @type {Array<Record<string, unknown>>} */ ([]));

  const handleTurnComplete = useCallback(
    (completedSpeaker) => {
      if (!autoSwitchSpeaker) return;
      if (isLanguageRoutingEnabled(patientLanguage, doctorLanguage) && !manualSpeakerOverride) {
        return;
      }
      setActiveSpeaker(completedSpeaker === "patient" ? "doctor" : "patient");
      setSpeakerSwitchAnim(true);
      playSpeakerSwitchSound();
    },
    [autoSwitchSpeaker, doctorLanguage, manualSpeakerOverride, patientLanguage],
  );

  useEffect(() => {
    if (!speakerSwitchAnim) return undefined;
    const timer = window.setTimeout(() => setSpeakerSwitchAnim(false), 480);
    return () => window.clearTimeout(timer);
  }, [speakerSwitchAnim, activeSpeaker]);

  const medaIntroText = useMemo(
    () => getMedaIntroText(patientLanguage, t),
    [patientLanguage, t],
  );

  const medaReadinessPhrase = useMemo(
    () => getMedaReadinessPhrase(doctorLanguage, t),
    [doctorLanguage, t],
  );

  const handleActivationSoundMutedChange = useCallback((muted) => {
    setActivationSoundMutedState(muted);
    setActivationSoundMuted(muted);
  }, []);

  const applyProfilePrefill = useCallback((prefill) => {
    profilePrefillSnapshotRef.current = prefill;
    setProfilePrefillAvailable(true);
    if (prefill.patientName) setPatientName(prefill.patientName);
    if (prefill.birthDate) setBirthDate(prefill.birthDate);
    if (prefill.genderOrFormOfAddress) setGenderOrFormOfAddress(prefill.genderOrFormOfAddress);
    if (prefill.patientLanguage) setPatientLanguage(prefill.patientLanguage);
    if (prefill.doctorLanguage) setDoctorLanguage(prefill.doctorLanguage);
    setProfilePrefilled(true);
    setPreparedForOtherPerson(false);
  }, []);

  const handlePreparedForOtherPersonChange = useCallback((checked) => {
    setPreparedForOtherPerson(checked);
    if (checked) {
      setPatientName("");
      setBirthDate("");
      setGenderOrFormOfAddress("");
      setProfilePrefilled(false);
      return;
    }
    const snapshot = profilePrefillSnapshotRef.current;
    if (snapshot) {
      if (snapshot.patientName) setPatientName(snapshot.patientName);
      if (snapshot.birthDate) setBirthDate(snapshot.birthDate);
      if (snapshot.genderOrFormOfAddress) setGenderOrFormOfAddress(snapshot.genderOrFormOfAddress);
      if (snapshot.patientLanguage) setPatientLanguage(snapshot.patientLanguage);
      if (snapshot.doctorLanguage) setDoctorLanguage(snapshot.doctorLanguage);
      setProfilePrefilled(true);
    }
  }, []);

  useEffect(() => {
    if (step !== "setup") return undefined;
    let cancelled = false;
    void fetchLiveTranslationProfilePrefill().then((prefill) => {
      if (cancelled || !prefill) return;
      applyProfilePrefill(prefill);
    });
    return () => {
      cancelled = true;
    };
  }, [applyProfilePrefill, step]);

  const genderOptions = useMemo(
    () =>
      GENDER_FORM_OF_ADDRESS_CODES.map((code) => ({
        code,
        label:
          code === "female"
            ? t.setup.genderFemale
            : code === "male"
              ? t.setup.genderMale
              : code === "diverse"
                ? t.setup.genderDiverse
                : t.setup.genderNone,
      })),
    [t.setup.genderDiverse, t.setup.genderFemale, t.setup.genderMale, t.setup.genderNone],
  );

  const instructionOptions = useMemo(
    () => ({
      medicalDomainWarningDe: t.warnings.medicalDomainDe,
      medicalDomainWarningEn: t.warnings.medicalDomainEn,
    }),
    [t],
  );

  const handleSpeakerFromLanguage = useCallback((speaker) => {
    setActiveSpeaker(speaker);
    setLanguageUncertain(false);
    setManualSpeakerOverride(false);
    skipLanguageRoutingRef.current = false;
  }, []);

  const handleLanguageUncertain = useCallback((uncertain = true) => {
    setLanguageUncertain(Boolean(uncertain));
  }, []);

  const handleUnclearTurn = useCallback(
    (info) => {
      if (info?.overlapDetected || info?.reason === "overlap") {
        setUnclearBanner(t.warnings.overlapDetected);
      } else if (info?.reason === "asr_failed") {
        setUnclearBanner(t.warnings.asrFailed);
      } else if (info?.reason === "translation_failed") {
        setUnclearBanner(t.warnings.translationFailed);
      } else {
        setUnclearBanner(t.warnings.unclearRecognition);
      }
    },
    [
      t.warnings.asrFailed,
      t.warnings.overlapDetected,
      t.warnings.translationFailed,
      t.warnings.unclearRecognition,
    ],
  );

  const handleWrongLanguagePair = useCallback(() => {
    setWrongLanguageBanner(t.warnings.wrongLanguagePair);
    setLanguageUncertain(false);
  }, [t.warnings.wrongLanguagePair]);

  const handleSessionTimeWarning = useCallback(
    ({ markMs }) => {
      if (markMs >= LIVE_SESSION_MAX_MS - 60 * 1000) {
        setSessionWarning(t.live.sessionWarn1Min);
      } else {
        setSessionWarning(t.live.sessionWarn5Min);
      }
    },
    [t.live.sessionWarn1Min, t.live.sessionWarn5Min],
  );

  const finishSessionRef = useRef(/** @type {((options?: { autoEnd?: boolean }) => void) | null} */ (null));

  const handleSessionAutoEnd = useCallback(() => {
    finishSessionRef.current?.({ autoEnd: true });
  }, []);

  const handleScopeWarning = useCallback(() => {
    setScopeWarningVisible(true);
  }, []);

  const handleScopeTranslationPaused = useCallback(() => {
    setScopeTranslationPausedBanner(
      t.warnings?.scopeTranslationPaused ||
        t.warnings?.unrelatedHealthcare ||
        "",
    );
    setScopeWarningVisible(false);
  }, [t.warnings?.scopeTranslationPaused, t.warnings?.unrelatedHealthcare]);

  const handleManualSpeakerSelect = useCallback((speaker) => {
    skipLanguageRoutingRef.current = true;
    setManualSpeakerOverride(true);
    setLanguageUncertain(false);
    setActiveSpeaker(speaker);
  }, []);

  const {
    connectionStatus,
    microphoneStatus,
    currentTranslatedText,
    turns,
    errorKey,
    endSession,
    disconnectSession,
    reconnect,
    stopVoiceOutput,
    replayLatestTranslation,
    submitCorrection,
    submitCorrectionForTurn,
    askToRepeat,
    askToRepeatForTurn,
    resumeAudioPlayback,
    pauseConversation,
    resumeConversation,
    confirmScopeContinue,
    isPaused,
    sessionTimerLabel,
    isRtcConnected,
  } = useLiveTranslationSession({
    patientLanguage,
    doctorLanguage,
    activeSpeaker,
    enabled: sessionActive,
    introText: medaIntroText,
    activationReadinessText: medaReadinessPhrase,
    activationSoundEnabled: !activationSoundMuted,
    languageBasedRouting: isLanguageRoutingEnabled(patientLanguage, doctorLanguage),
    skipLanguageRoutingRef,
    instructionOptions,
    autoSwitchSpeaker,
    onTurnComplete: handleTurnComplete,
    onSpeakerFromLanguage: handleSpeakerFromLanguage,
    onLanguageUncertain: handleLanguageUncertain,
    onWrongLanguagePair: handleWrongLanguagePair,
    onUnclearTurn: handleUnclearTurn,
    onSessionTimeWarning: handleSessionTimeWarning,
    onSessionAutoEnd: handleSessionAutoEnd,
    onScopeWarning: handleScopeWarning,
    onScopeTranslationPaused: handleScopeTranslationPaused,
  });

  turnsRef.current = turns;

  const finishSession = useCallback(
    (options = {}) => {
      const { autoEnd = false } = options;
      const endedAt = new Date().toISOString();
      const snapshotTurns = turnsRef.current;
      if (sessionMetadata) {
        setExportData(
          buildExportMetadata(sessionMetadata, snapshotTurns, {
            autoSwitchSpeaker,
            sessionEndedAt: endedAt,
          }),
        );
      } else {
        setExportData(null);
      }
      disconnectSession();
      setSessionActive(false);
      setLanguageUncertain(false);
      setUnclearBanner("");
      setWrongLanguageBanner("");
      setSessionWarning("");
      setScopeWarningVisible(false);
      setScopeTranslationPausedBanner("");
      setManualSpeakerOverride(false);
      skipLanguageRoutingRef.current = false;
      setAutoEnded(autoEnd);
      setLocalSaveState("idle");
      setStep("ended");
    },
    [autoSwitchSpeaker, disconnectSession, sessionMetadata],
  );

  finishSessionRef.current = finishSession;

  const endSessionRef = useRef(endSession);
  endSessionRef.current = endSession;
  const disconnectSessionRef = useRef(disconnectSession);
  disconnectSessionRef.current = disconnectSession;

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    return () => {
      disconnectSessionRef.current();
    };
  }, []);

  const patientLabel = useMemo(
    () =>
      LIVE_TRANSLATION_LANGUAGE_OPTIONS.find((o) => o.code === patientLanguage)?.label ||
      patientLanguage,
    [patientLanguage],
  );
  const doctorLabel = useMemo(
    () =>
      LIVE_TRANSLATION_LANGUAGE_OPTIONS.find((o) => o.code === doctorLanguage)?.label ||
      doctorLanguage,
    [doctorLanguage],
  );

  const displayRouting = useMemo(
    () => buildLanguageRouting({ patientLanguage, doctorLanguage, activeSpeaker }),
    [patientLanguage, doctorLanguage, activeSpeaker],
  );

  const safeTurns = useMemo(
    () => (Array.isArray(turns) ? turns : []).filter((turn) => turn && typeof turn === "object"),
    [turns],
  );

  const connectionLabel = !isRtcConnected
    ? connectionStatus === "reconnecting"
      ? t.status.reconnecting
      : t.status.connecting
    : (t.status && t.status[connectionStatus]) || connectionStatus || "";
  const micLabel = isRtcConnected && microphoneStatus === "on" ? t.status.micOn : t.status.micOff;
  const isSessionLive =
    isRtcConnected &&
    (connectionStatus === "introducing" ||
      connectionStatus === "connected" ||
      connectionStatus === "listening" ||
      connectionStatus === "translating" ||
      connectionStatus === "speaking" ||
      connectionStatus === "paused");
  const activityClass =
    connectionStatus === "introducing"
      ? "live-translation__activity--introducing"
      : connectionStatus === "listening"
      ? "live-translation__activity--listening"
      : connectionStatus === "translating"
        ? "live-translation__activity--translating"
        : connectionStatus === "speaking"
          ? "live-translation__activity--speaking"
          : connectionStatus === "paused"
            ? "live-translation__activity--paused"
            : "";
  const activeSpeakerLabel =
    activeSpeaker === "patient" ? t.live.patientSpeaker : t.live.doctorSpeaker;
  const speakerBannerLabel =
    activeSpeaker === "patient" ? t.live.speakerBannerPatient : t.live.speakerBannerDoctor;
  const languageRoutingActive =
    isLanguageRoutingEnabled(patientLanguage, doctorLanguage) && !manualSpeakerOverride;
  const directionLabel = useMemo(
    () =>
      buildDirectionLabel({
        activeSpeaker,
        patientLanguageLabel: patientLabel,
        doctorLanguageLabel: doctorLabel,
        patientRoleLabel: t.turn.speakerPatient,
        doctorRoleLabel: t.turn.speakerDoctor,
      }),
    [activeSpeaker, doctorLabel, patientLabel, t.turn.speakerDoctor, t.turn.speakerPatient],
  );

  const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const latestTurnId = latestTurn?.id ?? null;
  const canReplay = Boolean(latestTurn?.translatedText?.trim());
  const planBDisabled =
    connectionStatus === "connecting" ||
    connectionStatus === "reconnecting" ||
    connectionStatus === "ended" ||
    connectionStatus === "paused";

  const handleScopeContinue = useCallback(() => {
    setScopeWarningVisible(false);
    setScopeTranslationPausedBanner("");
    confirmScopeContinue();
  }, [confirmScopeContinue]);

  const handleScopePause = useCallback(() => {
    setScopeWarningVisible(false);
    pauseConversation();
  }, [pauseConversation]);

  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      resumeConversation();
    } else {
      pauseConversation();
    }
  }, [isPaused, pauseConversation, resumeConversation]);

  const canStartSession = useMemo(
    () =>
      isSetupComplete({
        patientName,
        birthDate,
        patientLanguage,
        doctorLanguage,
      }),
    [birthDate, doctorLanguage, patientLanguage, patientName],
  );

  const canStartLive = useMemo(
    () =>
      isPreliveStartReady({
        patientName,
        participantConsent,
        medicalPurposeConsent,
        translationLimitationsConsent,
      }),
    [medicalPurposeConsent, participantConsent, patientName, translationLimitationsConsent],
  );

  const resetPreliveConsent = useCallback(() => {
    setParticipantConsent(false);
    setMedicalPurposeConsent(false);
    setTranslationLimitationsConsent(false);
    setPreliveError("");
  }, []);

  const handlePracticeChange = useCallback((field, value) => {
    setPracticeInfo((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSetupContinue = useCallback(() => {
    const name = normalizePatientName(patientName);
    if (!name) {
      setFormError(t.setup.patientNameRequired);
      return;
    }
    if (!birthDate) {
      setFormError(t.setup.birthDateRequired);
      return;
    }
    if (!isValidBirthDate(birthDate)) {
      setFormError(t.setup.birthDateInvalid);
      return;
    }
    if (!patientLanguage) {
      setFormError(t.setup.patientLanguageRequired);
      return;
    }
    if (!doctorLanguage) {
      setFormError(t.setup.doctorLanguageRequired);
      return;
    }
    if (patientLanguage === doctorLanguage) {
      setFormError(t.setup.languagesMustDiffer);
      return;
    }
    setFormError("");
    resetPreliveConsent();
    setSessionMetadata(
      buildSessionMetadata({
        patientName: name,
        birthDate,
        patientLanguage,
        doctorLanguage,
        practice: practiceInfo,
        genderOrFormOfAddress: genderOrFormOfAddress || undefined,
        profilePrefilled,
        preparedForOtherPerson,
      }),
    );
    setStep("prelive");
  }, [
    birthDate,
    doctorLanguage,
    genderOrFormOfAddress,
    patientLanguage,
    patientName,
    practiceInfo,
    preparedForOtherPerson,
    profilePrefilled,
    resetPreliveConsent,
    t,
  ]);

  const handleSessionStart = useCallback(() => {
    const name = normalizePatientName(patientName);
    if (!name) {
      setPreliveError(t.prelive.patientNameRequired);
      return;
    }
    if (!participantConsent || !medicalPurposeConsent || !translationLimitationsConsent) {
      setPreliveError(t.prelive.consentRequired);
      return;
    }

    setPreliveError("");
    setLanguageUncertain(false);
    setUnclearBanner("");
    setWrongLanguageBanner("");
    setSessionWarning("");
    setScopeWarningVisible(false);
    setAutoEnded(false);
    setManualSpeakerOverride(false);
    skipLanguageRoutingRef.current = false;
    const consentAt = new Date().toISOString();
    const trimmedDoctorPractice = normalizeDoctorPracticeName(doctorPracticeName);
    setSessionMetadata((prev) =>
      prev
        ? {
            ...prev,
            patientName: name,
            birthDate,
            genderOrFormOfAddress: genderOrFormOfAddress || undefined,
            profilePrefilled,
            preparedForOtherPerson,
            ...(trimmedDoctorPractice ? { doctorPracticeName: trimmedDoctorPractice } : {}),
            sessionStartedAt: consentAt,
            consentConfirmedAt: consentAt,
            medicalPurposeConfirmed: true,
            translationLimitationsConfirmed: true,
          }
        : prev,
    );
    resumeAudioPlayback();
    setStep("active");
    setSessionActive(true);
  }, [
    birthDate,
    doctorPracticeName,
    genderOrFormOfAddress,
    medicalPurposeConsent,
    participantConsent,
    patientName,
    preparedForOtherPerson,
    profilePrefilled,
    resumeAudioPlayback,
    t.prelive.consentRequired,
    t.prelive.patientNameRequired,
    translationLimitationsConsent,
  ]);

  const handleEnd = useCallback(() => {
    finishSession({ autoEnd: false });
  }, [finishSession]);

  const handleDownloadPdf = useCallback(() => {
    if (!exportData) return;
    downloadLiveTranslationPdf(exportData, language);
  }, [exportData, language]);

  const handleSaveLocally = useCallback(() => {
    if (!exportData) return;
    try {
      saveLiveTranslationArchiveItem(exportData);
      setArchiveRefreshKey((k) => k + 1);
      setLocalSaveState("saved");
    } catch {
      setLocalSaveState("idle");
    }
  }, [exportData]);

  const handleDeclineSave = useCallback(() => {
    setLocalSaveState("declined");
  }, []);

  const handleBackToSetup = useCallback(() => {
    endSession();
    setSessionActive(false);
    setSessionMetadata(null);
    setExportData(null);
    setLanguageUncertain(false);
    setArchiveRefreshKey((k) => k + 1);
    resetPreliveConsent();
    setStep("setup");
  }, [endSession, resetPreliveConsent]);

  const handleNewConversation = useCallback(() => {
    endSession();
    setSessionActive(false);
    setExportData(null);
    setLanguageUncertain(false);
    resetPreliveConsent();
    setStep("prelive");
  }, [endSession, resetPreliveConsent]);

  useEffect(() => {
    if (step !== "ended") return;
    const focusTarget = pdfDownloadRef.current?.querySelector("button, a");
    if (focusTarget instanceof HTMLElement) {
      focusTarget.focus();
    } else {
      pdfDownloadRef.current?.focus();
    }
  }, [step]);

  if (!isLiveMedicalTranslationEnabled()) {
    return <Navigate to="/patient" replace />;
  }

  return (
    <div
      className={[
        "live-translation",
        step === "setup" ? "live-translation--setup" : "",
        step === "active" ? "live-translation--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Link className="live-translation__back" to="/patient">
        <ArrowLeft size={18} aria-hidden />
        {t.backToHub}
      </Link>

      <header className="live-translation__hero">
        <h1 className="live-translation__title">
          {step === "setup"
            ? t.setup.heading
            : step === "prelive"
              ? t.prelive.heading
              : step === "ended"
                ? t.ended.heading
                : t.live.heading}
        </h1>
        {step === "setup" ? (
          <p className="live-translation__sub">{t.setup.subheading}</p>
        ) : step === "prelive" ? (
          <p className="live-translation__sub">{t.prelive.subheading}</p>
        ) : step === "ended" ? (
          <p className="live-translation__sub">{t.ended.subheading}</p>
        ) : null}
      </header>

      <p className="live-translation__notice" role="note">
        {t.safetyNotice}
      </p>

      {step === "setup" ? (
        <>
        <section
          className="live-translation__saved-section"
          aria-labelledby="live-translation-saved-heading"
        >
          <LiveTranslationArchivePanel
            t={t}
            uiLanguage={language}
            refreshToken={archiveRefreshKey}
          />
        </section>

        <form
          className="live-translation__form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSetupContinue();
          }}
        >
          {profilePrefillAvailable ? (
            <p className="live-translation__profile-hint" role="note">
              {t.setup.profilePrefillHint}
            </p>
          ) : null}

          <div className="live-translation__field">
            <label htmlFor="live-translation-patient-name">
              {t.setup.patientNameLabel}{" "}
              <span className="live-translation__required" aria-hidden>
                *
              </span>
              <span className="live-translation__sr-only">{t.setup.requiredIndicator}</span>
            </label>
            <input
              id="live-translation-patient-name"
              type="text"
              autoComplete="name"
              required
              aria-required="true"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
          </div>

          <div className="live-translation__field">
            <label htmlFor="live-translation-birth-date">
              {t.setup.birthDateLabel}{" "}
              <span className="live-translation__required" aria-hidden>
                *
              </span>
              <span className="live-translation__sr-only">{t.setup.requiredIndicator}</span>
            </label>
            <input
              id="live-translation-birth-date"
              type="date"
              required
              aria-required="true"
              max={new Date().toISOString().slice(0, 10)}
              min="1900-01-01"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          <div className="live-translation__field">
            <label htmlFor="live-translation-gender">{t.setup.genderLabel}</label>
            <select
              id="live-translation-gender"
              value={genderOrFormOfAddress}
              onChange={(e) => setGenderOrFormOfAddress(e.target.value)}
            >
              <option value="">{t.setup.genderPlaceholder}</option>
              {genderOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {profilePrefillAvailable ? (
            <label className="live-translation__auto-switch">
              <input
                type="checkbox"
                checked={preparedForOtherPerson}
                onChange={(e) => handlePreparedForOtherPersonChange(e.target.checked)}
              />
              <span>
                <span className="live-translation__auto-switch-label">
                  {t.setup.preparedForOtherPersonLabel}
                </span>
                <span className="live-translation__auto-switch-hint">
                  {t.setup.preparedForOtherPersonHint}
                </span>
              </span>
            </label>
          ) : null}

          <div className="live-translation__field">
            <label htmlFor="live-translation-patient-language">
              {t.setup.patientLanguageLabel}{" "}
              <span className="live-translation__required" aria-hidden>
                *
              </span>
            </label>
            <select
              id="live-translation-patient-language"
              value={patientLanguage}
              onChange={(e) => setPatientLanguage(e.target.value)}
              required
              aria-required="true"
            >
              {LIVE_TRANSLATION_LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="live-translation__field">
            <label htmlFor="live-translation-doctor-language">
              {t.setup.doctorLanguageLabel}{" "}
              <span className="live-translation__required" aria-hidden>
                *
              </span>
            </label>
            <select
              id="live-translation-doctor-language"
              value={doctorLanguage}
              onChange={(e) => setDoctorLanguage(e.target.value)}
              required
              aria-required="true"
            >
              {LIVE_TRANSLATION_LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <SetupPracticeAccordion t={t.setup} practice={practiceInfo} onChange={handlePracticeChange} />

          {formError ? (
            <p className="live-translation__error" role="alert">
              {formError}
            </p>
          ) : null}

          <label className="live-translation__auto-switch">
            <input
              type="checkbox"
              checked={autoSwitchSpeaker}
              onChange={(e) => setAutoSwitchSpeaker(e.target.checked)}
            />
            <span>
              <span className="live-translation__auto-switch-label">{t.setup.autoSwitchLabel}</span>
              <span className="live-translation__auto-switch-hint">{t.setup.autoSwitchHint}</span>
            </span>
          </label>

          <button
            type="submit"
            className="live-translation__primary"
            aria-label={t.setup.continueAria}
            disabled={!canStartSession}
          >
            {t.setup.continueButton}
          </button>
        </form>
        </>
      ) : step === "ended" ? (
        <div
          ref={pdfDownloadRef}
          className="live-translation__ended"
          tabIndex={-1}
          role="region"
          aria-label={t.aria.endedRegion}
        >
          <p className="live-translation__ended-message" role="status" aria-live="assertive">
            {autoEnded ? t.ended.autoEndedNotice : t.ended.subheading}
          </p>
          {autoEnded ? (
            <p className="live-translation__ended-meta">{t.live.sessionAutoEndNotice}</p>
          ) : null}
          {exportData?.transcript?.length ? (
            <p className="live-translation__ended-meta">
              {t.ended.turnCount.replace("{count}", String(exportData.transcript.length))}
            </p>
          ) : null}
          <button
            type="button"
            className="live-translation__primary live-translation__ended-download"
            aria-label={t.ended.downloadAria}
            onClick={handleDownloadPdf}
            disabled={!exportData}
          >
            {t.ended.downloadButton}
          </button>
          <p className="live-translation__ended-privacy">{t.ended.privacyNote}</p>
          {localSaveState === "idle" ? (
            <div className="live-translation__save-prompt" role="group" aria-label={t.ended.savePrompt}>
              <p className="live-translation__save-prompt-text">{t.ended.savePrompt}</p>
              <div className="live-translation__save-prompt-actions">
                <button type="button" className="live-translation__primary" onClick={handleSaveLocally}>
                  {t.ended.saveButton}
                </button>
                <button type="button" className="live-translation__secondary" onClick={handleDeclineSave}>
                  {t.ended.saveDecline}
                </button>
              </div>
            </div>
          ) : localSaveState === "saved" ? (
            <p className="live-translation__save-confirmation" role="status">
              {t.ended.savedConfirmation}
            </p>
          ) : null}
          <div className="live-translation__actions">
            <button
              type="button"
              className="live-translation__secondary"
              onClick={handleBackToSetup}
            >
              {t.ended.backToSetup}
            </button>
            <button
              type="button"
              className="live-translation__primary"
              aria-label={t.ended.newConversationAria}
              onClick={handleNewConversation}
            >
              {t.ended.newConversation}
            </button>
          </div>
        </div>
      ) : step === "prelive" ? (
        <form
          className="live-translation__prelive"
          onSubmit={(e) => {
            e.preventDefault();
            handleSessionStart();
          }}
        >
          <div className="live-translation__context">
            {sessionMetadata ? (
              <div className="live-translation__context-row">
                <span className="live-translation__context-label">{t.live.birthDate}</span>
                <span className="live-translation__context-value">
                  {formatBirthDateDisplay(sessionMetadata.birthDate, language)}
                </span>
              </div>
            ) : null}
            <div className="live-translation__context-row">
              <span className="live-translation__context-label">{t.live.patientLanguage}</span>
              <span className="live-translation__context-value">{patientLabel}</span>
            </div>
            <div className="live-translation__context-row">
              <span className="live-translation__context-label">{t.live.doctorLanguage}</span>
              <span className="live-translation__context-value">{doctorLabel}</span>
            </div>
          </div>

          <p className="live-translation__not-started-notice" role="status">
            <span className="live-translation__not-started-dot" aria-hidden />
            {t.prelive.notStartedNotice}
          </p>

          <p className="live-translation__prelive-notice" role="note">
            {t.prelive.quietEnvironmentNotice}
          </p>

          <div className="live-translation__identity">
            <div className="live-translation__field">
              <label htmlFor="live-translation-prelive-patient-name">
                {t.prelive.patientNameLabel}{" "}
                <span className="live-translation__required" aria-hidden>
                  *
                </span>
                <span className="live-translation__sr-only">{t.setup.requiredIndicator}</span>
              </label>
              <input
                id="live-translation-prelive-patient-name"
                type="text"
                autoComplete="name"
                required
                aria-required="true"
                aria-invalid={preliveError === t.prelive.patientNameRequired}
                value={patientName}
                onChange={(e) => {
                  setPatientName(e.target.value);
                  if (preliveError) setPreliveError("");
                }}
              />
            </div>

            <div className="live-translation__field">
              <label htmlFor="live-translation-prelive-doctor-practice">
                {t.prelive.doctorPracticeNameLabel}
              </label>
              <input
                id="live-translation-prelive-doctor-practice"
                type="text"
                autoComplete="organization"
                value={doctorPracticeName}
                onChange={(e) => setDoctorPracticeName(e.target.value)}
              />
            </div>
          </div>

          <fieldset className="live-translation__consent" aria-label={t.prelive.consentFieldsetAria}>
            <legend className="live-translation__consent-title">{t.prelive.consentSectionTitle}</legend>
            <div className="live-translation__consent-options">
              <label className="live-translation__consent-option">
                <input
                  type="checkbox"
                  checked={participantConsent}
                  required
                  aria-required="true"
                  onChange={(e) => {
                    setParticipantConsent(e.target.checked);
                    if (preliveError) setPreliveError("");
                  }}
                />
                <span>{t.prelive.consentParticipantLabel}</span>
              </label>
              <label className="live-translation__consent-option">
                <input
                  type="checkbox"
                  checked={medicalPurposeConsent}
                  required
                  aria-required="true"
                  onChange={(e) => {
                    setMedicalPurposeConsent(e.target.checked);
                    if (preliveError) setPreliveError("");
                  }}
                />
                <span>{t.prelive.consentMedicalPurposeLabel}</span>
              </label>
              <label className="live-translation__consent-option">
                <input
                  type="checkbox"
                  checked={translationLimitationsConsent}
                  required
                  aria-required="true"
                  onChange={(e) => {
                    setTranslationLimitationsConsent(e.target.checked);
                    if (preliveError) setPreliveError("");
                  }}
                />
                <span>{t.prelive.consentTranslationLimitationsLabel}</span>
              </label>
            </div>
          </fieldset>

          <div className="live-translation__meda-intro-preview" role="note">
            <span className="live-translation__meda-intro-label">{t.live.medaIntroHeading}</span>
            <p>{medaIntroText}</p>
          </div>

          <label className="live-translation__auto-switch">
            <input
              type="checkbox"
              checked={activationSoundMuted}
              onChange={(e) => handleActivationSoundMutedChange(e.target.checked)}
            />
            <span>
              <span className="live-translation__auto-switch-label">
                {t.prelive.activationSoundMuteLabel}
              </span>
              <span className="live-translation__auto-switch-hint">
                {t.prelive.activationSoundMuteHint}
              </span>
            </span>
          </label>

          {preliveError ? (
            <p className="live-translation__error" role="alert" id="live-translation-prelive-error">
              {preliveError}
            </p>
          ) : null}

          <div className="live-translation__actions">
            <button
              type="button"
              className="live-translation__secondary"
              onClick={handleBackToSetup}
            >
              {t.prelive.backToSetup}
            </button>
            <button
              type="submit"
              className="live-translation__primary"
              aria-label={t.prelive.startAria}
              aria-describedby={preliveError ? "live-translation-prelive-error" : undefined}
              disabled={!canStartLive}
            >
              {t.prelive.startButton}
            </button>
          </div>
        </form>
      ) : (
        <div className="live-translation__session-layout">
          <div
            className="live-translation__context"
            aria-live="polite"
            aria-atomic="true"
            aria-label={t.aria.liveRegion}
          >
            {sessionMetadata ? (
              <>
                <div className="live-translation__context-row">
                  <span className="live-translation__context-label">{t.live.patientName}</span>
                  <span className="live-translation__context-value">{sessionMetadata.patientName}</span>
                </div>
                <div className="live-translation__context-row">
                  <span className="live-translation__context-label">{t.live.birthDate}</span>
                  <span className="live-translation__context-value">
                    {formatBirthDateDisplay(sessionMetadata.birthDate, language)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="live-translation__context-row">
              <span className="live-translation__context-label">{t.live.patientLanguage}</span>
              <span className="live-translation__context-value">{patientLabel}</span>
            </div>
            <div className="live-translation__context-row">
              <span className="live-translation__context-label">{t.live.doctorLanguage}</span>
              <span className="live-translation__context-value">{doctorLabel}</span>
            </div>
            <div
              className={[
                "live-translation__context-row",
                "live-translation__context-row--active",
                activeSpeaker === "patient"
                  ? "live-translation__context-row--patient"
                  : "live-translation__context-row--doctor",
              ].join(" ")}
            >
              <span className="live-translation__context-label">{t.live.currentlyActive}</span>
              <span className="live-translation__context-value">
                {activeSpeakerLabel}
                <span className="live-translation__direction"> ({directionLabel})</span>
              </span>
            </div>
          </div>

          <div
            className={[
              "live-translation__speaker-banner",
              activeSpeaker === "patient"
                ? "live-translation__speaker-banner--patient"
                : "live-translation__speaker-banner--doctor",
              speakerSwitchAnim ? "live-translation__speaker-banner--switching" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
            aria-live="polite"
          >
            <p className="live-translation__speaker-banner-title">{speakerBannerLabel}</p>
            <p className="live-translation__speaker-banner-direction">{directionLabel}</p>
            {languageRoutingActive ? (
              <p className="live-translation__speaker-banner-routing">{t.live.languageRoutingActive}</p>
            ) : manualSpeakerOverride ? (
              <p className="live-translation__speaker-banner-routing live-translation__speaker-banner-routing--manual">
                {t.live.manualSpeakerActive}
              </p>
            ) : null}
            {autoSwitchSpeaker ? (
              <p className="live-translation__speaker-banner-auto">{t.live.autoSwitchActive}</p>
            ) : null}
          </div>

          <div
            className={[
              "live-translation__meda-status",
              activityClass,
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
            aria-live="polite"
          >
            <span className="live-translation__activity-dot" aria-hidden />
            <div className="live-translation__meda-status-copy">
              <span className="live-translation__meda-status-title">{connectionLabel}</span>
              <span className="live-translation__meda-status-direction">{directionLabel}</span>
              <span className="live-translation__meda-status-hint">{t.live.speakOneAtATime}</span>
            </div>
          </div>

          {(connectionStatus === "introducing" || connectionStatus === "connected") && medaIntroText ? (
            <div className="live-translation__meda-intro-preview live-translation__meda-intro-preview--live" role="note">
              <span className="live-translation__meda-intro-label">{t.live.medaIntroHeading}</span>
              <p>{medaIntroText}</p>
            </div>
          ) : null}

          {sessionActive ? (
            <div className="live-translation__session-timer" role="status" aria-live="polite">
              <span className="live-translation__session-timer-label">{t.live.sessionTimerLabel}</span>
              <span className="live-translation__session-timer-value">{sessionTimerLabel}</span>
            </div>
          ) : null}

          {sessionWarning ? (
            <p className="live-translation__warning live-translation__warning--timer" role="status">
              {sessionWarning}
            </p>
          ) : null}

          {wrongLanguageBanner ? (
            <p className="live-translation__warning live-translation__warning--wrong-language" role="alert">
              {wrongLanguageBanner}
            </p>
          ) : null}

          {unclearBanner ? (
            <p className="live-translation__warning live-translation__warning--unclear" role="alert">
              {unclearBanner}
            </p>
          ) : null}

          {scopeTranslationPausedBanner ? (
            <p className="live-translation__warning live-translation__warning--scope-paused" role="alert">
              {scopeTranslationPausedBanner}
            </p>
          ) : null}

          {scopeWarningVisible ? (
            <div className="live-translation__scope-warning" role="dialog" aria-labelledby="scope-warning-title">
              <p id="scope-warning-title" className="live-translation__scope-warning-text">
                {t.warnings.unrelatedHealthcare}
              </p>
              <div className="live-translation__scope-warning-actions">
                <button
                  type="button"
                  className="live-translation__primary"
                  aria-label={t.live.continueAnywayAria}
                  onClick={handleScopeContinue}
                >
                  {t.live.continueAnyway}
                </button>
                <button
                  type="button"
                  className="live-translation__secondary"
                  aria-label={t.live.pauseDueToUnrelatedAria}
                  onClick={handleScopePause}
                >
                  {t.live.pauseDueToUnrelated}
                </button>
              </div>
            </div>
          ) : null}

          {languageUncertain ? (
            <p className="live-translation__warning" role="status">
              {t.warnings.languageUncertain}
            </p>
          ) : null}


          <div className="live-translation__status-grid">
            <div className="live-translation__status-item">
              <span className="live-translation__status-label">{t.live.connectionStatus}</span>
              <span
                className={[
                  "live-translation__status-value",
                  connectionStatus === "error"
                    ? "live-translation__status-value--error"
                    : isRtcConnected
                      ? "live-translation__status-value--ok"
                      : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {connectionLabel}
              </span>
            </div>
            <div className="live-translation__status-item">
              <span className="live-translation__status-label">{t.live.microphoneStatus}</span>
              <span
                className={[
                  "live-translation__status-value",
                  microphoneStatus === "on" && isRtcConnected
                    ? "live-translation__status-value--ok"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {micLabel}
              </span>
            </div>
          </div>

          {errorKey && t.errors[errorKey] ? (
            <p className="live-translation__error" role="alert">
              {t.errors[errorKey]}
            </p>
          ) : null}

          <label className="live-translation__auto-switch live-translation__auto-switch--live">
            <input
              type="checkbox"
              checked={autoSwitchSpeaker}
              onChange={(e) => setAutoSwitchSpeaker(e.target.checked)}
            />
            <span>
              <span className="live-translation__auto-switch-label">{t.live.autoSwitchToggle}</span>
              {autoSwitchSpeaker ? (
                <span className="live-translation__auto-switch-hint">{t.live.autoSwitchActive}</span>
              ) : null}
            </span>
          </label>

          <div
            className="live-translation__speakers"
            role="group"
            aria-label={t.aria.speakerGroup}
          >
            <button
              type="button"
              className={[
                "live-translation__speaker",
                activeSpeaker === "patient" ? "live-translation__speaker--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={activeSpeaker === "patient"}
              aria-label={t.live.patientSpeakerAria}
              onClick={() => handleManualSpeakerSelect("patient")}
            >
              <span className="live-translation__speaker-title">{t.live.patientSpeaker}</span>
              <span className="live-translation__speaker-dir">
                {buildDirectionLabel({
                  activeSpeaker: "patient",
                  patientLanguageLabel: patientLabel,
                  doctorLanguageLabel: doctorLabel,
                  patientRoleLabel: t.turn.speakerPatient,
                  doctorRoleLabel: t.turn.speakerDoctor,
                })}
              </span>
            </button>
            <button
              type="button"
              className={[
                "live-translation__speaker",
                activeSpeaker === "doctor" ? "live-translation__speaker--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={activeSpeaker === "doctor"}
              aria-label={t.live.doctorSpeakerAria}
              onClick={() => handleManualSpeakerSelect("doctor")}
            >
              <span className="live-translation__speaker-title">{t.live.doctorSpeaker}</span>
              <span className="live-translation__speaker-dir">
                {buildDirectionLabel({
                  activeSpeaker: "doctor",
                  patientLanguageLabel: patientLabel,
                  doctorLanguageLabel: doctorLabel,
                  patientRoleLabel: t.turn.speakerPatient,
                  doctorRoleLabel: t.turn.speakerDoctor,
                })}
              </span>
            </button>
          </div>

          <div
            className={[
              "live-translation__output",
              isSessionLive ? "live-translation__output--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="live-translation__output-label">{t.live.currentTranslation}</span>
            <p className="live-translation__output-text">
              {currentTranslatedText || t.live.noTranslationYet}
            </p>
          </div>

          <PlanBControls
            t={t.live}
            disabled={planBDisabled}
            canReplay={canReplay}
            latestTurnId={latestTurnId}
            onStopVoice={stopVoiceOutput}
            onReplay={() => void replayLatestTranslation()}
            onAskRepeat={() => void askToRepeat()}
            onSubmitCorrection={submitCorrection}
          />

          <LiveTranslationTurnHistory
            turns={safeTurns}
            t={t}
            uiLanguage={language}
            disabled={planBDisabled}
            onRepeatTurn={askToRepeatForTurn}
            onSubmitCorrection={submitCorrectionForTurn}
          />

          <div className="live-translation__session-controls-spacer" aria-hidden />

          <div className="live-translation__actions live-translation__actions--inline live-translation__actions--session">
            {connectionStatus === "error" ? (
              <button
                type="button"
                className="live-translation__secondary"
                aria-label={t.live.reconnectAria}
                onClick={() => void reconnect()}
              >
                {t.live.reconnectButton}
              </button>
            ) : null}
            {sessionActive && connectionStatus !== "ended" && connectionStatus !== "connecting" ? (
              <button
                type="button"
                className="live-translation__secondary"
                aria-label={isPaused ? t.live.resumeAria : t.live.pauseAria}
                onClick={handleTogglePause}
              >
                {isPaused ? t.live.resumeButton : t.live.pauseButton}
              </button>
            ) : null}
            <button
              type="button"
              className="live-translation__secondary"
              onClick={handleBackToSetup}
            >
              {t.live.backToSetup}
            </button>
            <button
              type="button"
              className="live-translation__primary"
              aria-label={t.live.endAria}
              onClick={handleEnd}
            >
              {t.live.endButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
