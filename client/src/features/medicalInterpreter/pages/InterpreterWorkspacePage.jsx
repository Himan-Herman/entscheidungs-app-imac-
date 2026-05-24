import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import InterpreterLiveRoom from "../components/InterpreterLiveRoom.jsx";
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
import "../styles/MedicalInterpreter.css";

function copyFor(language) {
  const locale = ["de", "en", "it", "es", "fr"].includes(language) ? language : "en";

  const copy = {
    de: {
      eyebrow: "MedScoutX Live Interpreter",
      title: "Dolmetscher neu von Grund auf",
      subtitle:
        "Ein einziger professioneller Arbeitsbereich fur Live-Ubersetzung, Dokumentation und PDF. Keine alten Misch-Oberflachen mehr.",
      patientEntry: "Patienten-Einstieg",
      practiceEntry: "Praxis-Einstieg",
      backPatient: "Zuruck zum Patientenbereich",
      backPractice: "Zuruck zum Praxisbereich",
      setupTitle: "Neue Sitzung vorbereiten",
      setupText:
        "Nur die Basics zuerst. Wenige Felder, klare Sprache, saubere Grundlage fur den kompletten Neuaufbau.",
      patientName: "Patientenname *",
      patientLanguage: "Patientensprache *",
      doctorLanguage: "Arzt-/Praxis-Sprache *",
      doctorName: "Arztname",
      practiceName: "Praxis / Klinik",
      appointment: "Termin",
      titleField: "Gesprachestitel",
      optional: "Optionale Angaben",
      create: "Sitzung anlegen",
      recentTitle: "Sitzungen auf diesem Gerat",
      noSessions: "Noch keine Sitzung vorhanden.",
      open: "Offnen",
      delete: "Loschen",
      pdf: "PDF herunterladen",
      timeline: "Dokumentierter Verlauf",
      liveTitle: "Live-Arbeitsbereich",
      noTurns: "Noch keine dokumentierten Gesprachsbeitrage.",
      original: "Original",
      translation: "Ubersetzung",
      selectedTitle: "Ausgewahlte Sitzung",
      safety:
        "Nur Kommunikationsunterstutzung. Keine Diagnose, Triage oder Behandlungsempfehlung.",
      routeNote:
        "Diese neue Basis liegt jetzt auf einer einzigen Route. Alte Interpreter-Unterseiten werden nur noch hierher umgeleitet.",
      sessionCreated: "Sitzung angelegt",
      requiredError: "Bitte die Pflichtfelder ausfullen.",
    },
    en: {
      eyebrow: "MedScoutX Live Interpreter",
      title: "Interpreter rebuilt from scratch",
      subtitle:
        "One professional workspace for live translation, documentation, and PDF. No mixed legacy surfaces anymore.",
      patientEntry: "Patient entry",
      practiceEntry: "Practice entry",
      backPatient: "Back to patient area",
      backPractice: "Back to practice area",
      setupTitle: "Prepare new session",
      setupText:
        "Basics first. Few fields, clear language, and a clean foundation for the full rebuild.",
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
      noSessions: "No session yet.",
      open: "Open",
      delete: "Delete",
      pdf: "Download PDF",
      timeline: "Documented conversation",
      liveTitle: "Live workspace",
      noTurns: "No documented turns yet.",
      original: "Original",
      translation: "Translation",
      selectedTitle: "Selected session",
      safety:
        "Communication support only. No diagnosis, triage, or treatment recommendations.",
      routeNote:
        "This new base now lives on one single route. Old interpreter subpages only redirect here.",
      sessionCreated: "Session created",
      requiredError: "Please complete the required fields.",
    },
    it: {
      eyebrow: "MedScoutX Live Interpreter",
      title: "Interprete ricostruito da zero",
      subtitle:
        "Un unico spazio professionale per traduzione live, documentazione e PDF. Nessuna vecchia interfaccia mista.",
      patientEntry: "Accesso paziente",
      practiceEntry: "Accesso studio",
      backPatient: "Torna all'area paziente",
      backPractice: "Torna all'area studio",
      setupTitle: "Prepara una nuova sessione",
      setupText:
        "Prima le basi. Pochi campi, linguaggio chiaro e una base pulita per la ricostruzione completa.",
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
      noSessions: "Nessuna sessione disponibile.",
      open: "Apri",
      delete: "Elimina",
      pdf: "Scarica PDF",
      timeline: "Conversazione documentata",
      liveTitle: "Spazio live",
      noTurns: "Nessun intervento documentato.",
      original: "Originale",
      translation: "Traduzione",
      selectedTitle: "Sessione selezionata",
      safety:
        "Solo supporto alla comunicazione. Nessuna diagnosi, triage o raccomandazione terapeutica.",
      routeNote:
        "Questa nuova base ora vive su un'unica route. Le vecchie sottopagine dell'interprete reindirizzano solo qui.",
      sessionCreated: "Sessione creata",
      requiredError: "Compila i campi obbligatori.",
    },
    es: {
      eyebrow: "MedScoutX Live Interpreter",
      title: "Intérprete reconstruido desde cero",
      subtitle:
        "Un único espacio profesional para traducción en vivo, documentación y PDF. Sin superficies antiguas mezcladas.",
      patientEntry: "Entrada paciente",
      practiceEntry: "Entrada consulta",
      backPatient: "Volver al área del paciente",
      backPractice: "Volver al área de la consulta",
      setupTitle: "Preparar nueva sesión",
      setupText:
        "Primero lo básico. Pocos campos, lenguaje claro y una base limpia para la reconstrucción completa.",
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
      noSessions: "Todavía no hay sesión.",
      open: "Abrir",
      delete: "Eliminar",
      pdf: "Descargar PDF",
      timeline: "Conversación documentada",
      liveTitle: "Espacio en vivo",
      noTurns: "Todavía no hay intervenciones documentadas.",
      original: "Original",
      translation: "Traducción",
      selectedTitle: "Sesión seleccionada",
      safety:
        "Solo apoyo para la comunicación. Sin diagnóstico, triaje ni recomendaciones de tratamiento.",
      routeNote:
        "Esta nueva base ahora vive en una sola ruta. Las antiguas subpáginas del intérprete solo redirigen aquí.",
      sessionCreated: "Sesión creada",
      requiredError: "Complete los campos obligatorios.",
    },
    fr: {
      eyebrow: "MedScoutX Live Interpreter",
      title: "Interprète reconstruit de zéro",
      subtitle:
        "Un seul espace professionnel pour la traduction en direct, la documentation et le PDF. Plus aucune ancienne interface mélangée.",
      patientEntry: "Entrée patient",
      practiceEntry: "Entrée cabinet",
      backPatient: "Retour à l'espace patient",
      backPractice: "Retour à l'espace cabinet",
      setupTitle: "Préparer une nouvelle session",
      setupText:
        "Les bases d'abord. Peu de champs, langage clair et fondation propre pour la reconstruction complète.",
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
      noSessions: "Aucune session pour le moment.",
      open: "Ouvrir",
      delete: "Supprimer",
      pdf: "Télécharger le PDF",
      timeline: "Conversation documentée",
      liveTitle: "Espace live",
      noTurns: "Aucune prise de parole documentée.",
      original: "Original",
      translation: "Traduction",
      selectedTitle: "Session sélectionnée",
      safety:
        "Aide à la communication uniquement. Aucun diagnostic, triage ou conseil de traitement.",
      routeNote:
        "Cette nouvelle base vit maintenant sur une seule route. Les anciennes sous-pages de l'interprète redirigent uniquement ici.",
      sessionCreated: "Session créée",
      requiredError: "Veuillez remplir les champs obligatoires.",
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

      <section className="interpreter-shell__layout">
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
            <p>{copy.recentTitle}</p>
          </div>

          {selectedSession ? (
            <div className="interpreter-shell__selected">
              <h3>{getSessionDisplayTitle(selectedSession, t, language)}</h3>
              <p>
                {(formatLanguageDisplayName(language, selectedSession.patientLanguage) ||
                  selectedSession.patientLanguage)}{" "}
                {"->"}{" "}
                {(formatLanguageDisplayName(language, selectedSession.doctorLanguage) ||
                  selectedSession.doctorLanguage)}
              </p>
              <div className="interpreter-shell__selected-actions">
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
                    {"->"}{" "}
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
        <div className="interpreter-shell__panel-head">
          <h2>{copy.liveTitle}</h2>
        </div>

        {selectedSession ? (
          <InterpreterLiveRoom
            sessionId={selectedSession.sessionId}
            embedded
            hideBackLink
            homePath={`/interpreter?entry=${encodeURIComponent(entry)}${practiceId ? `&practiceId=${encodeURIComponent(practiceId)}` : ""}`}
          />
        ) : (
          <p className="interpreter-shell__empty">{copy.noSessions}</p>
        )}
      </section>

      <section className="interpreter-shell__panel interpreter-shell__panel--wide">
        <div className="interpreter-shell__panel-head">
          <h2>{copy.timeline}</h2>
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
