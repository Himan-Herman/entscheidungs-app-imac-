import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import {
  createSession,
  getCurrentSession,
  setCurrentSessionId,
  updateSessionMetadata,
} from "../store/interpreterSessionStore.js";
import {
  buildProfileSnapshotFromSettings,
  fetchInterpreterProfileSettings,
} from "../api/interpreterProfileApi.js";
import { INTERPRETER_SETUP_LANGUAGE_OPTIONS } from "../constants/setupLanguages.js";
import { SESSION_STATUS_ENDED } from "../constants.js";
import "../styles/MedicalInterpreter.css";

function buildCopy(language) {
  if (language === "de") {
    return {
      back: "Zurück zur Dolmetscher-Startseite",
      title: "Neue Sitzung vorbereiten",
      intro:
        "Eine klare Vorbereitung mit nur den nötigen Feldern. Optionales bleibt eingeklappt.",
      patientName: "Patientenname *",
      patientLanguage: "Patientensprache *",
      doctorLanguage: "Arzt-/Praxis-Sprache *",
      useProfile: "Kontonamen verwenden",
      optional: "Optionale Angaben",
      doctorName: "Arztname",
      practiceName: "Praxis / Klinik",
      appointment: "Termin",
      conversationTitle: "Gesprächstitel",
      start: "Live-Gespräch öffnen",
      requiredError: "Bitte füllen Sie die Pflichtfelder aus.",
    };
  }

  return {
    back: "Back to interpreter home",
    title: "Prepare new session",
    intro:
      "A clean preparation step with only the required fields. Optional details stay collapsed.",
    patientName: "Patient name *",
    patientLanguage: "Patient language *",
    doctorLanguage: "Doctor / practice language *",
    useProfile: "Use account name",
    optional: "Optional details",
    doctorName: "Doctor name",
    practiceName: "Practice / clinic",
    appointment: "Appointment",
    conversationTitle: "Conversation title",
    start: "Open live conversation",
    requiredError: "Please complete the required fields.",
  };
}

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export default function InterpreterPatientSetupWorkspacePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const copy = useMemo(() => buildCopy(language), [language]);
  const [searchParams] = useSearchParams();
  const forceNewSession = searchParams.get("new") === "1";
  const profileSettingsRef = useRef(null);
  const [sessionId, setSessionId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientLanguage, setPatientLanguage] = useState("");
  const [doctorLanguage, setDoctorLanguage] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [appointmentDateTime, setAppointmentDateTime] = useState("");
  const [conversationTitle, setConversationTitle] = useState("");
  const [useProfileName, setUseProfileName] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    document.title = `${copy.title} | MedScoutX`;
  }, [copy.title]);

  useEffect(() => {
    if (forceNewSession) return;
    const current = getCurrentSession();
    if (!current || current.status === SESSION_STATUS_ENDED) return;
    setSessionId(current.sessionId);
    setPatientName(current.patientName || "");
    setPatientLanguage(current.patientLanguage || "");
    setDoctorLanguage(current.doctorLanguage || "");
    setDoctorName(current.doctorName || "");
    setPracticeName(current.practiceName || "");
    setConversationTitle(current.conversationTitle || "");
    setAppointmentDateTime(toDatetimeLocalValue(current.appointmentDateTime));
    setUseProfileName(current.profileConsentUsed === true);
  }, [forceNewSession]);

  useEffect(() => {
    let cancelled = false;
    void fetchInterpreterProfileSettings().then((result) => {
      if (cancelled || !result.ok) return;
      profileSettingsRef.current = result;
      const first = String(result.user?.firstName || "").trim();
      const last = String(result.user?.lastName || "").trim();
      const display = [first, last].filter(Boolean).join(" ").trim();
      if (display) {
        setProfileName(display);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const languageOptions = useMemo(
    () =>
      INTERPRETER_SETUP_LANGUAGE_OPTIONS.map((option) => ({
        value: option.code,
        label: formatLanguageDisplayName(language, option.code) || option.nativeName || option.code,
      })),
    [language],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const effectivePatientName = useProfileName && profileName ? profileName : patientName.trim();
    if (!effectivePatientName || !patientLanguage || !doctorLanguage) {
      setErrorMessage(copy.requiredError);
      return;
    }

    const sessionPatch = {
      patientName: effectivePatientName,
      patientLanguage,
      doctorLanguage,
      doctorName: doctorName.trim() || undefined,
      practiceName: practiceName.trim() || undefined,
      conversationTitle: conversationTitle.trim() || undefined,
      appointmentDateTime: fromDatetimeLocalValue(appointmentDateTime),
      profileConsentUsed: useProfileName && Boolean(profileName),
      profileSnapshot:
        useProfileName && profileSettingsRef.current
          ? buildProfileSnapshotFromSettings(profileSettingsRef.current) || undefined
          : undefined,
    };

    const session =
      sessionId && !forceNewSession
        ? updateSessionMetadata(sessionId, sessionPatch)
        : createSession(sessionPatch);

    if (!session) {
      setErrorMessage(copy.requiredError);
      return;
    }

    setCurrentSessionId(session.sessionId);
    navigate(`/patient/interpreter/live?sessionId=${encodeURIComponent(session.sessionId)}`);
  };

  return (
    <main className="medical-interpreter-page interp-root" id="main-content">
      <Link className="medical-interpreter-page__back" to="/patient/interpreter">
        {copy.back}
      </Link>

      <section className="interpreter-reset__hero">
        <p className="interpreter-reset__eyebrow">MedScoutX Interpreter</p>
        <h1 className="medical-interpreter-page__title">{copy.title}</h1>
        <p className="medical-interpreter-page__intro">{copy.intro}</p>
      </section>

      <form className="interpreter-reset__form" onSubmit={handleSubmit}>
        {errorMessage ? (
          <div className="interpreter-feedback interpreter-feedback--error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <div className="interpreter-reset__form-grid">
          <label className="interpreter-reset__field">
            <span>{copy.patientName}</span>
            <input
              value={patientName}
              onChange={(event) => setPatientName(event.target.value)}
              disabled={useProfileName && Boolean(profileName)}
              className="interpreter-reset__input"
            />
          </label>

          <label className="interpreter-reset__field">
            <span>{copy.patientLanguage}</span>
            <select
              value={patientLanguage}
              onChange={(event) => setPatientLanguage(event.target.value)}
              className="interpreter-reset__input"
            >
              <option value=""></option>
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="interpreter-reset__field">
            <span>{copy.doctorLanguage}</span>
            <select
              value={doctorLanguage}
              onChange={(event) => setDoctorLanguage(event.target.value)}
              className="interpreter-reset__input"
            >
              <option value=""></option>
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {profileName ? (
          <label className="interpreter-reset__checkbox">
            <input
              type="checkbox"
              checked={useProfileName}
              onChange={(event) => setUseProfileName(event.target.checked)}
            />
            <span>
              {copy.useProfile}: <strong>{profileName}</strong>
            </span>
          </label>
        ) : null}

        <details className="interpreter-reset__details">
          <summary>{copy.optional}</summary>
          <div className="interpreter-reset__form-grid">
            <label className="interpreter-reset__field">
              <span>{copy.doctorName}</span>
              <input
                value={doctorName}
                onChange={(event) => setDoctorName(event.target.value)}
                className="interpreter-reset__input"
              />
            </label>
            <label className="interpreter-reset__field">
              <span>{copy.practiceName}</span>
              <input
                value={practiceName}
                onChange={(event) => setPracticeName(event.target.value)}
                className="interpreter-reset__input"
              />
            </label>
            <label className="interpreter-reset__field">
              <span>{copy.appointment}</span>
              <input
                type="datetime-local"
                value={appointmentDateTime}
                onChange={(event) => setAppointmentDateTime(event.target.value)}
                className="interpreter-reset__input"
              />
            </label>
            <label className="interpreter-reset__field">
              <span>{copy.conversationTitle}</span>
              <input
                value={conversationTitle}
                onChange={(event) => setConversationTitle(event.target.value)}
                className="interpreter-reset__input"
              />
            </label>
          </div>
        </details>

        <div className="interpreter-reset__actions">
          <button
            type="submit"
            className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
          >
            {copy.start}
          </button>
        </div>
      </form>
    </main>
  );
}
