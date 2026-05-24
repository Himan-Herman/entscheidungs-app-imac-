import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import InterpreterLiveRoom from "../components/InterpreterLiveRoom.jsx";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_DRAFT,
  SESSION_STATUS_ENDED,
} from "../constants.js";
import {
  createSession,
  deleteSession,
  getCurrentSession,
  getSession,
  listSessions,
  setCurrentSessionId,
  updateSessionMetadata,
} from "../store/interpreterSessionStore.js";
import { downloadInterpreterSessionPdf } from "../pdf/generateInterpreterSessionPdf.js";
import { getSessionDisplayTitle } from "../utils/sessionDisplayTitle.js";
import { INTERPRETER_SETUP_LANGUAGE_OPTIONS } from "../constants/setupLanguages.js";
import { practiceInterpreterPath } from "../utils/practiceContextQuery.js";
import { getSessionSummaryStats } from "../utils/sessionSummary.js";
import "../styles/MedicalInterpreter.css";

function copyFor(language) {
  const locale = ["de", "en", "it", "es", "fr"].includes(language) ? language : "en";

  const copy = {
    de: {
      eyebrow: "MedScoutX Live Interpreter",
      title: "MedScoutX Medical Interpreter",
      subtitle:
        "Ein professioneller Arbeitsbereich fur Live-Ubersetzung, Sprachausgabe, Dokumentation und PDF-Export.",
      patientEntry: "Patienten-Einstieg",
      practiceEntry: "Praxis-Einstieg",
      backPatient: "Zuruck zum Patientenbereich",
      backPractice: "Zuruck zum Praxisbereich",
      setupTitle: "Neue Sitzung vorbereiten",
      setupText:
        "Erfassen Sie nur die wichtigsten Angaben fur ein sicheres, klar dokumentiertes Live-Gesprach.",
      patientName: "Patientenname *",
      patientLanguage: "Patientensprache *",
      doctorLanguage: "Arzt-/Praxis-Sprache *",
      doctorName: "Arztname",
      practiceName: "Praxis / Klinik",
      appointment: "Termin",
      titleField: "Gesprachstitel",
      optional: "Optionale Angaben",
      create: "Sitzung anlegen",
      recentTitle: "Sitzungen auf diesem Gerat",
      recentText: "Wahlen Sie eine bestehende Sitzung aus, setzen Sie sie fort oder laden Sie die Dokumentation als PDF herunter.",
      noSessions: "Noch keine Sitzung vorhanden.",
      open: "Offnen",
      delete: "Loschen",
      pdf: "PDF herunterladen",
      timeline: "Dokumentierter Verlauf",
      liveTitle: "Live-Arbeitsbereich",
      liveText: "Hier startet und endet das Live-Gesprach. Die Dokumentation bleibt darunter ubersichtlich getrennt.",
      liveStageLabel: "Aktive Sitzung",
      liveStagePair: "Sprachpaar",
      liveStageTurns: "Dokumentierte Beitrage",
      timelineText: "Jeder Beitrag wird mit Original und Ubersetzung fortlaufend dokumentiert.",
      noTurns: "Noch keine dokumentierten Gesprachsbeitrage.",
      original: "Original",
      translation: "Ubersetzung",
      selectedTitle: "Ausgewahlte Sitzung",
      safety:
        "Nur Kommunikationsunterstutzung. Keine Diagnose, keine Triage und keine Behandlungsempfehlung.",
      routeNote:
        "Audio wird nur fur Transkription und Sprachausgabe verwendet. Wichtige Inhalte sollten immer mit dem Behandlungsteam bestatigt werden.",
      sessionCreated: "Sitzung angelegt",
      requiredError: "Bitte die Pflichtfelder ausfullen.",
      navSetup: "Vorbereitung",
      navLive: "Live",
      navTimeline: "Verlauf",
      statusDraft: "Entwurf",
      statusActive: "Aktiv",
      statusEnded: "Beendet",
      statTurns: "Beitrage",
      statTranslated: "Ubersetzt",
      statPatient: "Patient",
      statDoctor: "Praxis",
    },
    en: {
      eyebrow: "MedScoutX Live Interpreter",
      title: "MedScoutX Medical Interpreter",
      subtitle:
        "One professional workspace for live translation, spoken playback, documentation, and PDF export.",
      patientEntry: "Patient entry",
      practiceEntry: "Practice entry",
      backPatient: "Back to patient area",
      backPractice: "Back to practice area",
      setupTitle: "Prepare new session",
      setupText:
        "Enter only the key details needed for a clear, well-documented live conversation.",
      patientName: "Patient name *",
      patientLanguage: "Patient language *",
      doctorLanguage: "Doctor / practice language *",
      doctorName: "Doctor name",
      practiceName: "Practice / clinic",
      appointment: "Appointment",
      titleField: "Conversation title",
      optional: "Optional details",
      create: "Create session",
      recentTitle: "Sessions on this device",
      recentText: "Select an existing session, continue it, or download its documentation as a PDF.",
      noSessions: "No session yet.",
      open: "Open",
      delete: "Delete",
      pdf: "Download PDF",
      timeline: "Documented conversation",
      liveTitle: "Live workspace",
      liveText: "Use this area to run the live conversation. Documentation remains clearly separated below.",
      liveStageLabel: "Active session",
      liveStagePair: "Language pair",
      liveStageTurns: "Documented turns",
      timelineText: "Each turn is documented here with original wording and translation.",
      noTurns: "No documented turns yet.",
      original: "Original",
      translation: "Translation",
      selectedTitle: "Selected session",
      safety:
        "Communication support only. No diagnosis, no triage, and no treatment recommendations.",
      routeNote:
        "Audio is used for transcription and playback only. Important content should always be confirmed with the healthcare professional.",
      sessionCreated: "Session created",
      requiredError: "Please complete the required fields.",
      navSetup: "Setup",
      navLive: "Live",
      navTimeline: "Timeline",
      statusDraft: "Draft",
      statusActive: "Active",
      statusEnded: "Ended",
      statTurns: "Turns",
      statTranslated: "Translated",
      statPatient: "Patient",
      statDoctor: "Practice",
    },
    it: {
      eyebrow: "MedScoutX Live Interpreter",
      title: "MedScoutX Medical Interpreter",
      subtitle:
        "Un unico spazio professionale per traduzione live, riproduzione vocale, documentazione ed esportazione PDF.",
      patientEntry: "Accesso paziente",
      practiceEntry: "Accesso studio",
      backPatient: "Torna all'area paziente",
      backPractice: "Torna all'area studio",
      setupTitle: "Prepara una nuova sessione",
      setupText:
        "Inserisci solo i dati essenziali per una conversazione live chiara e ben documentata.",
      patientName: "Nome paziente *",
      patientLanguage: "Lingua del paziente *",
      doctorLanguage: "Lingua medico / studio *",
      doctorName: "Nome del medico",
      practiceName: "Studio / clinica",
      appointment: "Appuntamento",
      titleField: "Titolo conversazione",
      optional: "Dettagli opzionali",
      create: "Crea sessione",
      recentTitle: "Sessioni su questo dispositivo",
      recentText: "Seleziona una sessione esistente, continua oppure scarica la documentazione in PDF.",
      noSessions: "Nessuna sessione disponibile.",
      open: "Apri",
      delete: "Elimina",
      pdf: "Scarica PDF",
      timeline: "Conversazione documentata",
      liveTitle: "Spazio live",
      liveText: "Qui puoi gestire la conversazione live. Cronologia e PDF restano ordinati nella sezione sottostante.",
      liveStageLabel: "Sessione attiva",
      liveStagePair: "Coppia di lingue",
      liveStageTurns: "Interventi documentati",
      timelineText: "Ogni intervento viene documentato qui con testo originale e traduzione.",
      noTurns: "Nessun intervento documentato.",
      original: "Originale",
      translation: "Traduzione",
      selectedTitle: "Sessione selezionata",
      safety:
        "Solo supporto alla comunicazione. Nessuna diagnosi, nessun triage e nessuna raccomandazione terapeutica.",
      routeNote:
        "L'audio viene usato solo per trascrizione e riproduzione. Le informazioni importanti devono sempre essere confermate con il professionista sanitario.",
      sessionCreated: "Sessione creata",
      requiredError: "Compila i campi obbligatori.",
      navSetup: "Preparazione",
      navLive: "Live",
      navTimeline: "Cronologia",
      statusDraft: "Bozza",
      statusActive: "Attiva",
      statusEnded: "Conclusa",
      statTurns: "Interventi",
      statTranslated: "Tradotti",
      statPatient: "Paziente",
      statDoctor: "Studio",
    },
    es: {
      eyebrow: "MedScoutX Live Interpreter",
      title: "MedScoutX Medical Interpreter",
      subtitle:
        "Un único espacio profesional para traducción en vivo, reproducción por voz, documentación y exportación en PDF.",
      patientEntry: "Entrada paciente",
      practiceEntry: "Entrada consulta",
      backPatient: "Volver al área del paciente",
      backPractice: "Volver al área de la consulta",
      setupTitle: "Preparar nueva sesión",
      setupText:
        "Introduzca solo los datos esenciales para una conversación en vivo clara y bien documentada.",
      patientName: "Nombre del paciente *",
      patientLanguage: "Idioma del paciente *",
      doctorLanguage: "Idioma del médico / consulta *",
      doctorName: "Nombre del médico",
      practiceName: "Consulta / clínica",
      appointment: "Cita",
      titleField: "Título de la conversación",
      optional: "Detalles opcionales",
      create: "Crear sesión",
      recentTitle: "Sesiones en este dispositivo",
      recentText: "Seleccione una sesión existente, continúela o descargue la documentación en PDF.",
      noSessions: "Todavía no hay sesión.",
      open: "Abrir",
      delete: "Eliminar",
      pdf: "Descargar PDF",
      timeline: "Conversación documentada",
      liveTitle: "Espacio en vivo",
      liveText: "Desde aquí puede gestionar la conversación en vivo. El historial y el PDF permanecen claramente separados debajo.",
      liveStageLabel: "Sesión activa",
      liveStagePair: "Par de idiomas",
      liveStageTurns: "Intervenciones documentadas",
      timelineText: "Cada intervención se documenta aquí con texto original y traducción.",
      noTurns: "Todavía no hay intervenciones documentadas.",
      original: "Original",
      translation: "Traducción",
      selectedTitle: "Sesión seleccionada",
      safety:
        "Solo apoyo para la comunicación. Sin diagnóstico, sin triaje y sin recomendaciones de tratamiento.",
      routeNote:
        "El audio se usa solo para transcripción y reproducción. La información importante debe confirmarse siempre con el profesional sanitario.",
      sessionCreated: "Sesión creada",
      requiredError: "Complete los campos obligatorios.",
      navSetup: "Preparación",
      navLive: "Live",
      navTimeline: "Historial",
      statusDraft: "Borrador",
      statusActive: "Activa",
      statusEnded: "Finalizada",
      statTurns: "Intervenciones",
      statTranslated: "Traducidas",
      statPatient: "Paciente",
      statDoctor: "Consulta",
    },
    fr: {
      eyebrow: "MedScoutX Live Interpreter",
      title: "MedScoutX Medical Interpreter",
      subtitle:
        "Un espace professionnel unique pour la traduction en direct, la restitution vocale, la documentation et l'export PDF.",
      patientEntry: "Entrée patient",
      practiceEntry: "Entrée cabinet",
      backPatient: "Retour à l'espace patient",
      backPractice: "Retour à l'espace cabinet",
      setupTitle: "Préparer une nouvelle session",
      setupText:
        "Renseignez uniquement les informations essentielles pour une conversation en direct claire et bien documentée.",
      patientName: "Nom du patient *",
      patientLanguage: "Langue du patient *",
      doctorLanguage: "Langue médecin / cabinet *",
      doctorName: "Nom du médecin",
      practiceName: "Cabinet / clinique",
      appointment: "Rendez-vous",
      titleField: "Titre de la conversation",
      optional: "Détails optionnels",
      create: "Créer la session",
      recentTitle: "Sessions sur cet appareil",
      recentText: "Sélectionnez une session existante, poursuivez-la ou téléchargez la documentation en PDF.",
      noSessions: "Aucune session pour le moment.",
      open: "Ouvrir",
      delete: "Supprimer",
      pdf: "Télécharger le PDF",
      timeline: "Conversation documentée",
      liveTitle: "Espace live",
      liveText: "Cette zone pilote la conversation en direct. L'historique et le PDF restent clairement séparés en dessous.",
      liveStageLabel: "Session active",
      liveStagePair: "Paire de langues",
      liveStageTurns: "Prises de parole documentées",
      timelineText: "Chaque prise de parole est documentée ici avec le texte original et la traduction.",
      noTurns: "Aucune prise de parole documentée.",
      original: "Original",
      translation: "Traduction",
      selectedTitle: "Session sélectionnée",
      safety:
        "Aide à la communication uniquement. Aucun diagnostic, aucun triage et aucun conseil de traitement.",
      routeNote:
        "L'audio est utilisé uniquement pour la transcription et la restitution vocale. Les informations importantes doivent toujours être confirmées avec le professionnel de santé.",
      sessionCreated: "Session créée",
      requiredError: "Veuillez remplir les champs obligatoires.",
      navSetup: "Préparation",
      navLive: "Live",
      navTimeline: "Historique",
      statusDraft: "Brouillon",
      statusActive: "Active",
      statusEnded: "Terminée",
      statTurns: "Prises de parole",
      statTranslated: "Traduits",
      statPatient: "Patient",
      statDoctor: "Cabinet",
    },
  };

  return copy[locale];
}

function emptyForm() {
  return {
    patientName: "",
    patientLanguage: "",
    doctorLanguage: "",
    doctorName: "",
    practiceName: "",
    appointmentDateTime: "",
    conversationTitle: "",
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

export default function InterpreterWorkspacePage() {
  const { language } = useLanguage();
  const t = useMedicalInterpreterMessages();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const copy = useMemo(() => copyFor(language), [language]);
  const practiceId = searchParams.get("practiceId")?.trim() || "";
  const entry = searchParams.get("entry")?.trim() || (practiceId ? "practice" : "patient");
  const selectedSessionId = searchParams.get("sessionId")?.trim() || "";
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [storeTick, setStoreTick] = useState(0);

  useEffect(() => {
    document.title = `${copy.title} | MedScoutX`;
  }, [copy.title]);

  const sessions = useMemo(() => {
    void storeTick;
    return listSessions();
  }, [storeTick]);

  const selectedSession = useMemo(() => {
    if (selectedSessionId) {
      return getSession(selectedSessionId);
    }
    return getCurrentSession() || sessions[0] || null;
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (!selectedSession) {
      setForm(emptyForm());
      return;
    }
    setForm({
      patientName: selectedSession.patientName || "",
      patientLanguage: selectedSession.patientLanguage || "",
      doctorLanguage: selectedSession.doctorLanguage || "",
      doctorName: selectedSession.doctorName || "",
      practiceName: selectedSession.practiceName || "",
      appointmentDateTime: toDatetimeLocalValue(selectedSession.appointmentDateTime),
      conversationTitle: selectedSession.conversationTitle || "",
    });
  }, [selectedSession]);

  const backHref =
    entry === "practice" ? practiceInterpreterPath("/practice", practiceId) : "/patient";

  const languageOptions = useMemo(
    () =>
      INTERPRETER_SETUP_LANGUAGE_OPTIONS.map((option) => ({
        value: option.code,
        label:
          formatLanguageDisplayName(language, option.code) ||
          option.nativeName ||
          option.code,
      })),
    [language],
  );

  const handleCreateOrUpdate = (event) => {
    event.preventDefault();
    if (!form.patientName.trim() || !form.patientLanguage || !form.doctorLanguage) {
      setErrorMessage(copy.requiredError);
      setInfoMessage("");
      return;
    }

    const patch = {
      patientName: form.patientName.trim(),
      patientLanguage: form.patientLanguage,
      doctorLanguage: form.doctorLanguage,
      doctorName: form.doctorName.trim() || undefined,
      practiceName: form.practiceName.trim() || undefined,
      appointmentDateTime: fromDatetimeLocalValue(form.appointmentDateTime),
      conversationTitle: form.conversationTitle.trim() || undefined,
    };

    const next =
      selectedSession?.sessionId
        ? updateSessionMetadata(selectedSession.sessionId, patch)
        : createSession(patch);

    if (!next) {
      setErrorMessage(copy.requiredError);
      setInfoMessage("");
      return;
    }

    setCurrentSessionId(next.sessionId);
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      nextParams.set("sessionId", next.sessionId);
      if (practiceId) nextParams.set("practiceId", practiceId);
      if (entry) nextParams.set("entry", entry);
      return nextParams;
    });
    setStoreTick((value) => value + 1);
    setErrorMessage("");
    setInfoMessage(copy.sessionCreated);
  };

  const selectedSummary = selectedSession ? getSessionSummaryStats(selectedSession) : null;
  const selectedLanguagePair = selectedSession
    ? `${formatLanguageDisplayName(language, selectedSession.patientLanguage) || selectedSession.patientLanguage} ↔ ${formatLanguageDisplayName(language, selectedSession.doctorLanguage) || selectedSession.doctorLanguage}`
    : "";
  const selectedStatusLabel =
    selectedSession?.status === SESSION_STATUS_ACTIVE
      ? copy.statusActive
      : selectedSession?.status === SESSION_STATUS_ENDED
        ? copy.statusEnded
        : copy.statusDraft;

  return (
    <main className="interpreter-shell" id="main-content">
      <div className="interpreter-shell__backbar">
        <Link className="interpreter-shell__backlink" to={backHref}>
          {entry === "practice" ? copy.backPractice : copy.backPatient}
        </Link>
        <span className="interpreter-shell__entry-badge">
          {entry === "practice" ? copy.practiceEntry : copy.patientEntry}
        </span>
      </div>

      <section className="interpreter-shell__hero">
        <div className="interpreter-shell__hero-copy">
          <p className="interpreter-shell__eyebrow">{copy.eyebrow}</p>
          <h1 className="interpreter-shell__title">{copy.title}</h1>
          <p className="interpreter-shell__subtitle">{copy.subtitle}</p>
        </div>
        <div className="interpreter-shell__hero-note">
          <p>{copy.safety}</p>
          <p>{copy.routeNote}</p>
        </div>
      </section>

      <nav className="interpreter-shell__section-nav" aria-label="Interpreter sections">
        <a className="interpreter-shell__section-link" href="#interpreter-setup">
          {copy.navSetup}
        </a>
        <a className="interpreter-shell__section-link" href="#interpreter-live">
          {copy.navLive}
        </a>
        <a className="interpreter-shell__section-link" href="#interpreter-timeline">
          {copy.navTimeline}
        </a>
      </nav>

      {selectedSession ? (
        <section className="interpreter-shell__summary-grid" aria-label={copy.selectedTitle}>
          <article className="interpreter-shell__summary-card interpreter-shell__summary-card--session">
            <div className="interpreter-shell__summary-head">
              <div>
                <p className="interpreter-shell__summary-label">{copy.selectedTitle}</p>
                <h2>{getSessionDisplayTitle(selectedSession, t, language)}</h2>
              </div>
              <span className="interpreter-shell__summary-status">{selectedStatusLabel}</span>
            </div>
              <p className="interpreter-shell__summary-meta">
              {(formatLanguageDisplayName(language, selectedSession.patientLanguage) ||
                selectedSession.patientLanguage)}{" "}
              {"↔"}{" "}
              {(formatLanguageDisplayName(language, selectedSession.doctorLanguage) ||
                selectedSession.doctorLanguage)}
            </p>
          </article>

          <article className="interpreter-shell__summary-card">
            <p className="interpreter-shell__summary-label">{copy.statTurns}</p>
            <strong>{selectedSummary?.turnCount ?? 0}</strong>
          </article>
          <article className="interpreter-shell__summary-card">
            <p className="interpreter-shell__summary-label">{copy.statTranslated}</p>
            <strong>{selectedSummary?.translatedCount ?? 0}</strong>
          </article>
          <article className="interpreter-shell__summary-card">
            <p className="interpreter-shell__summary-label">{copy.statPatient}</p>
            <strong>{selectedSummary?.patientTurnCount ?? 0}</strong>
          </article>
          <article className="interpreter-shell__summary-card">
            <p className="interpreter-shell__summary-label">{copy.statDoctor}</p>
            <strong>{selectedSummary?.clinicianTurnCount ?? 0}</strong>
          </article>
        </section>
      ) : null}

      <section className="interpreter-shell__layout" id="interpreter-setup">
        <article className="interpreter-shell__panel">
          <div className="interpreter-shell__panel-head">
            <h2>{copy.setupTitle}</h2>
            <p>{copy.setupText}</p>
          </div>

          {errorMessage ? (
            <div className="interpreter-shell__message interpreter-shell__message--error" role="alert">
              {errorMessage}
            </div>
          ) : null}
          {infoMessage ? (
            <div className="interpreter-shell__message" role="status" aria-live="polite">
              {infoMessage}
            </div>
          ) : null}

          <form className="interpreter-shell__form" onSubmit={handleCreateOrUpdate}>
            <label className="interpreter-shell__field">
              <span>{copy.patientName}</span>
              <input
                value={form.patientName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, patientName: event.target.value }))
                }
              />
            </label>

            <div className="interpreter-shell__field-grid">
              <label className="interpreter-shell__field">
                <span>{copy.patientLanguage}</span>
                <select
                  value={form.patientLanguage}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, patientLanguage: event.target.value }))
                  }
                >
                  <option value=""></option>
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="interpreter-shell__field">
                <span>{copy.doctorLanguage}</span>
                <select
                  value={form.doctorLanguage}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, doctorLanguage: event.target.value }))
                  }
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

            <details className="interpreter-shell__details">
              <summary>{copy.optional}</summary>
              <div className="interpreter-shell__field-grid">
                <label className="interpreter-shell__field">
                  <span>{copy.doctorName}</span>
                  <input
                    value={form.doctorName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, doctorName: event.target.value }))
                    }
                  />
                </label>

                <label className="interpreter-shell__field">
                  <span>{copy.practiceName}</span>
                  <input
                    value={form.practiceName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, practiceName: event.target.value }))
                    }
                  />
                </label>

                <label className="interpreter-shell__field">
                  <span>{copy.appointment}</span>
                  <input
                    type="datetime-local"
                    value={form.appointmentDateTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        appointmentDateTime: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="interpreter-shell__field">
                  <span>{copy.titleField}</span>
                  <input
                    value={form.conversationTitle}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        conversationTitle: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </details>

            <button type="submit" className="interpreter-shell__primary-btn">
              {copy.create}
            </button>
          </form>
        </article>

        <article className="interpreter-shell__panel">
          <div className="interpreter-shell__panel-head">
            <h2>{copy.selectedTitle}</h2>
            <p>{copy.recentText}</p>
          </div>

          {selectedSession ? (
            <div className="interpreter-shell__selected">
              <h3>{getSessionDisplayTitle(selectedSession, t, language)}</h3>
              <p>{selectedLanguagePair}</p>
              <div className="interpreter-shell__selected-actions">
                <button
                  type="button"
                  className="interpreter-shell__danger-btn"
                  onClick={() => {
                    deleteSession(selectedSession.sessionId);
                    setStoreTick((value) => value + 1);
                    navigate(`/interpreter${practiceId ? `?practiceId=${encodeURIComponent(practiceId)}&entry=${entry}` : entry ? `?entry=${entry}` : ""}`, {
                      replace: true,
                    });
                  }}
                >
                  {copy.delete}
                </button>
              </div>
            </div>
          ) : (
            <p className="interpreter-shell__empty">{copy.noSessions}</p>
          )}

          <div className="interpreter-shell__session-list">
            {sessions.length === 0 ? (
              <p className="interpreter-shell__empty">{copy.noSessions}</p>
            ) : (
              sessions.slice(0, 8).map((session) => (
                <button
                  key={session.sessionId}
                  type="button"
                  className={`interpreter-shell__session-item${selectedSession?.sessionId === session.sessionId ? " interpreter-shell__session-item--active" : ""}`}
                  onClick={() => {
                    setCurrentSessionId(session.sessionId);
                    setSearchParams((prev) => {
                      const nextParams = new URLSearchParams(prev);
                      nextParams.set("sessionId", session.sessionId);
                      if (practiceId) nextParams.set("practiceId", practiceId);
                      if (entry) nextParams.set("entry", entry);
                      return nextParams;
                    });
                  }}
                >
                  <strong>{getSessionDisplayTitle(session, t, language)}</strong>
                  <span>
                    {(formatLanguageDisplayName(language, session.patientLanguage) ||
                      session.patientLanguage)}{" "}
                    {"↔"}{" "}
                    {(formatLanguageDisplayName(language, session.doctorLanguage) ||
                      session.doctorLanguage)}
                  </span>
                </button>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="interpreter-shell__panel interpreter-shell__panel--wide">
        <div className="interpreter-shell__panel-head" id="interpreter-live">
          <h2>{copy.liveTitle}</h2>
          <p>{copy.liveText}</p>
        </div>

        {selectedSession ? (
          <>
            <div className="interpreter-shell__live-stage">
              <div className="interpreter-shell__live-stage-main">
                <p className="interpreter-shell__summary-label">{copy.liveStageLabel}</p>
                <h3>{getSessionDisplayTitle(selectedSession, t, language)}</h3>
                <div className="interpreter-shell__live-stage-meta">
                  <span className="interpreter-shell__live-chip interpreter-shell__live-chip--accent">
                    {selectedStatusLabel}
                  </span>
                  <span className="interpreter-shell__live-chip">
                    {copy.liveStagePair}: {selectedLanguagePair}
                  </span>
                  <span className="interpreter-shell__live-chip">
                    {copy.liveStageTurns}: {selectedSummary?.turnCount ?? 0}
                  </span>
                </div>
              </div>
              <div className="interpreter-shell__live-stage-actions">
                <button
                  type="button"
                  className="interpreter-shell__ghost-btn"
                  onClick={() => {
                    downloadInterpreterSessionPdf(
                      selectedSession,
                      getSessionDisplayTitle(selectedSession, t, language),
                      t,
                    );
                  }}
                  disabled={(selectedSession.turns?.length || 0) === 0}
                >
                  {copy.pdf}
                </button>
              </div>
            </div>

            <InterpreterLiveRoom
              sessionId={selectedSession.sessionId}
              embedded
              hideBackLink
              homePath={`/interpreter?entry=${encodeURIComponent(entry)}${practiceId ? `&practiceId=${encodeURIComponent(practiceId)}` : ""}`}
            />
          </>
        ) : (
          <p className="interpreter-shell__empty">{copy.noSessions}</p>
        )}
      </section>

      <section className="interpreter-shell__panel interpreter-shell__panel--wide">
        <div className="interpreter-shell__panel-head" id="interpreter-timeline">
          <h2>{copy.timeline}</h2>
          <p>{copy.timelineText}</p>
        </div>

        {selectedSession?.turns?.length ? (
          <ol className="interpreter-shell__turn-list">
            {selectedSession.turns.map((turn) => (
              <li key={turn.turnId} className="interpreter-shell__turn-card">
                <div className="interpreter-shell__turn-head">
                  <strong>{turn.speakerLabel || turn.speaker}</strong>
                  <span>{new Date(turn.timestamp || turn.createdAt).toLocaleString(language)}</span>
                </div>
                <div className="interpreter-shell__turn-body">
                  <div>
                    <p className="interpreter-shell__turn-label">{copy.original}</p>
                    <p>{turn.originalTranscript || turn.originalText || "-"}</p>
                  </div>
                  <div>
                    <p className="interpreter-shell__turn-label">{copy.translation}</p>
                    <p>{turn.translatedText || "-"}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="interpreter-shell__empty">{copy.noTurns}</p>
        )}
      </section>
    </main>
  );
}
