import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import { isLiveMedicalTranslationEnabled } from "../featureFlag.js";
import { LIVE_TRANSLATION_LANGUAGE_OPTIONS } from "../languages.js";
import { buildLanguageRouting } from "../utils/routing.js";
import { useLiveTranslationSession } from "../hooks/useLiveTranslationSession.js";
import { playSpeakerSwitchSound } from "../utils/speakerSwitchFeedback.js";
import SetupPracticeAccordion from "../components/SetupPracticeAccordion.jsx";
import {
  buildSessionMetadata,
  EMPTY_PRACTICE_INFO,
} from "../utils/sessionMetadata.js";
import { getMedaIntroText } from "../utils/medaIntro.js";
import { isSetupComplete, isValidBirthDate, normalizePatientName } from "../utils/setupValidation.js";
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

function formatTurnTime(iso, lang) {
  try {
    return new Date(iso).toLocaleTimeString(getPrimaryIntlLocale(lang), {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function LiveTranslationPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).liveMedicalTranslation ||
      getMessages("en").liveMedicalTranslation,
    [language],
  );

  const [step, setStep] = useState(/** @type {"setup" | "prelive" | "active"} */ ("setup"));
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
  const [speakerSwitchAnim, setSpeakerSwitchAnim] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [practiceInfo, setPracticeInfo] = useState(() => ({ ...EMPTY_PRACTICE_INFO }));
  const [sessionMetadata, setSessionMetadata] = useState(
    /** @type {ReturnType<typeof buildSessionMetadata> | null} */ (null),
  );
  const [formError, setFormError] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [languageUncertain, setLanguageUncertain] = useState(false);
  const skipLanguageRoutingRef = useRef(false);

  const handleTurnComplete = useCallback(
    (completedSpeaker) => {
      if (!autoSwitchSpeaker) return;
      setActiveSpeaker(completedSpeaker === "patient" ? "doctor" : "patient");
      setSpeakerSwitchAnim(true);
      playSpeakerSwitchSound();
    },
    [autoSwitchSpeaker],
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
  }, []);

  const handleLanguageUncertain = useCallback(() => {
    setLanguageUncertain(true);
  }, []);

  const handleManualSpeakerSelect = useCallback((speaker) => {
    skipLanguageRoutingRef.current = true;
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
    reconnect,
  } = useLiveTranslationSession({
    patientLanguage,
    doctorLanguage,
    activeSpeaker,
    enabled: sessionActive,
    introText: medaIntroText,
    languageBasedRouting: true,
    skipLanguageRoutingRef,
    instructionOptions,
    autoSwitchSpeaker,
    onTurnComplete: handleTurnComplete,
    onSpeakerFromLanguage: handleSpeakerFromLanguage,
    onLanguageUncertain: handleLanguageUncertain,
  });

  const endSessionRef = useRef(endSession);
  endSessionRef.current = endSession;

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    return () => {
      endSessionRef.current();
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

  const connectionLabel = t.status[connectionStatus] || connectionStatus;
  const micLabel = microphoneStatus === "on" ? t.status.micOn : t.status.micOff;
  const isSessionLive =
    connectionStatus === "introducing" ||
    connectionStatus === "listening" ||
    connectionStatus === "translating" ||
    connectionStatus === "speaking";
  const activityClass =
    connectionStatus === "introducing"
      ? "live-translation__activity--introducing"
      : connectionStatus === "listening"
      ? "live-translation__activity--listening"
      : connectionStatus === "translating"
        ? "live-translation__activity--translating"
        : connectionStatus === "speaking"
          ? "live-translation__activity--speaking"
          : "";
  const activeSpeakerLabel =
    activeSpeaker === "patient" ? t.live.patientSpeaker : t.live.doctorSpeaker;
  const speakerBannerLabel =
    activeSpeaker === "patient" ? t.live.speakerBannerPatient : t.live.speakerBannerDoctor;
  const directionLabel = `${displayRouting.sourceLanguageName} → ${displayRouting.targetLanguageName}`;

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
    setSessionMetadata(
      buildSessionMetadata({
        patientName: name,
        birthDate,
        patientLanguage,
        doctorLanguage,
        practice: practiceInfo,
      }),
    );
    setStep("prelive");
  }, [birthDate, doctorLanguage, patientLanguage, patientName, practiceInfo, t]);

  const handleSessionStart = useCallback(() => {
    setLanguageUncertain(false);
    skipLanguageRoutingRef.current = false;
    setStep("active");
    setSessionActive(true);
  }, []);

  const handleEnd = useCallback(() => {
    endSession();
    setSessionActive(false);
    setLanguageUncertain(false);
    setStep("prelive");
  }, [endSession]);

  const handleBackToSetup = useCallback(() => {
    endSession();
    setSessionActive(false);
    setSessionMetadata(null);
    setLanguageUncertain(false);
    setStep("setup");
  }, [endSession]);

  if (!isLiveMedicalTranslationEnabled()) {
    return <Navigate to="/patient" replace />;
  }

  return (
    <div className="live-translation">
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
              : t.live.heading}
        </h1>
        {step === "setup" ? (
          <p className="live-translation__sub">{t.setup.subheading}</p>
        ) : step === "prelive" ? (
          <p className="live-translation__sub">{t.prelive.subheading}</p>
        ) : null}
      </header>

      <p className="live-translation__notice" role="note">
        {t.safetyNotice}
      </p>

      {step === "setup" ? (
        <form
          className="live-translation__form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSetupContinue();
          }}
        >
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
      ) : step === "prelive" ? (
        <div className="live-translation__prelive">
          <div className="live-translation__context">
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
          </div>

          <div className="live-translation__meda-intro-preview" role="note">
            <span className="live-translation__meda-intro-label">{t.live.medaIntroHeading}</span>
            <p>{medaIntroText}</p>
          </div>

          <div className="live-translation__actions">
            <button
              type="button"
              className="live-translation__secondary"
              onClick={handleBackToSetup}
            >
              {t.prelive.backToSetup}
            </button>
            <button
              type="button"
              className="live-translation__primary"
              aria-label={t.prelive.startAria}
              onClick={handleSessionStart}
            >
              {t.prelive.startButton}
            </button>
          </div>
        </div>
      ) : (
        <>
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
                    : connectionStatus === "connected" ||
                        connectionStatus === "introducing" ||
                        connectionStatus === "listening" ||
                        connectionStatus === "translating" ||
                        connectionStatus === "speaking"
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
                  microphoneStatus === "on" ? "live-translation__status-value--ok" : "",
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
                {patientLabel} → {doctorLabel}
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
                {doctorLabel} → {patientLabel}
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

          <div className="live-translation__actions live-translation__actions--inline">
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

          {turns.length > 0 ? (
            <section className="live-translation__turns" aria-label={t.live.turnHistory}>
              <h2 className="live-translation__turns-title">{t.live.turnHistory}</h2>
              <ol className="live-translation__turns-list">
                {turns.map((turn, index) => {
                  const speakerLabel =
                    turn.speaker === "patient" ? t.turn.speakerPatient : t.turn.speakerDoctor;
                  const sourceLabel = LIVE_TRANSLATION_LANGUAGE_OPTIONS.find(
                    (o) => o.code === turn.sourceLanguage,
                  )?.label || turn.sourceLanguage;
                  const targetLabel = LIVE_TRANSLATION_LANGUAGE_OPTIONS.find(
                    (o) => o.code === turn.targetLanguage,
                  )?.label || turn.targetLanguage;

                  return (
                    <li key={`${turn.timestamp}-${index}`} className="live-translation__turn">
                      <header className="live-translation__turn-header">
                        <span className="live-translation__turn-speaker">{speakerLabel}</span>
                        <span className="live-translation__turn-meta">
                          {sourceLabel} → {targetLabel}
                          {turn.timestamp ? (
                            <time dateTime={turn.timestamp}>
                              {" · "}
                              {formatTurnTime(turn.timestamp, language)}
                            </time>
                          ) : null}
                        </span>
                      </header>
                      {turn.originalText ? (
                        <p className="live-translation__turn-original">
                          <span className="live-translation__turn-field-label">
                            {t.turn.original}
                          </span>
                          {turn.originalText}
                        </p>
                      ) : (
                        <p className="live-translation__turn-original live-translation__turn-original--missing">
                          <span className="live-translation__turn-field-label">
                            {t.turn.original}
                          </span>
                          {t.turn.originalMissing}
                        </p>
                      )}
                      <p className="live-translation__turn-translated">
                        <span className="live-translation__turn-field-label">
                          {t.turn.translated}
                        </span>
                        {turn.translatedText}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
