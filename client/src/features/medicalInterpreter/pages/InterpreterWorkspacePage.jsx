import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import {
  interpreterErrorMessage,
  transcribeAudio,
  translateTurn,
} from "../api/interpreterApi.js";
import { translateNearRealtimePreview } from "../api/interpreterNearRealtimeApi.js";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_ENDED,
  SPEAKER_DOCTOR,
  SPEAKER_PATIENT,
  TURN_STATUS_ERROR,
  TURN_STATUS_SPOKEN,
  TURN_STATUS_TRANSCRIBED,
  TURN_STATUS_TRANSLATED,
} from "../constants.js";
import { INTERPRETER_SETUP_LANGUAGE_OPTIONS } from "../constants/setupLanguages.js";
import { isNearRealtimeTranslationClientEnabled } from "../config/isNearRealtimeTranslationEnabled.js";
import { useInterpreterRecorder } from "../hooks/useInterpreterRecorder.js";
import { useInterpreterTtsPlayback } from "../hooks/useInterpreterTtsPlayback.js";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import { downloadInterpreterSessionPdf } from "../pdf/generateInterpreterSessionPdf.js";
import {
  addTurn,
  createSession,
  deleteSession,
  endSession,
  getSession,
  listSessions,
  setCurrentSessionId,
  updateSessionMetadata,
  updateTurn,
} from "../store/interpreterSessionStore.js";
import { detectLikelySilentBlob } from "../utils/interpreterAudioLevel.js";
import { INTERPRETER_SILENCE_AUTO_STOP_MS } from "../utils/interpreterAudioConstants.js";
import { detectSpeakerFromLanguage } from "../utils/detectSpeakerFromLanguage.js";
import { getSessionDisplayTitle } from "../utils/sessionDisplayTitle.js";
import { languagesForSpeaker } from "../utils/liveLanguages.js";
import { practiceInterpreterPath } from "../utils/practiceContextQuery.js";
import { playInterpreterTurnSignal } from "../utils/interpreterTurnSignal.js";
import "../styles/MedicalInterpreter.css";

const LIVE_PHASE = {
  IDLE: "idle",
  LISTENING: "listening",
  SILENCE_WAITING: "silence_waiting",
  TRANSCRIBING: "transcribing",
  TRANSLATING: "translating",
  SPEAKING: "speaking",
  ENDED: "ended",
  ERROR: "error",
};

const AUTO_RESTART_DELAY_MS = 120;
const TURN_SIGNAL_WAIT_MS = 120;
const VOICE_PROFILE = "neutral_medical";

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeLang(code) {
  return String(code || "").trim().toLowerCase().split("-")[0];
}

function oppositeSpeaker(speaker) {
  return speaker === SPEAKER_DOCTOR ? SPEAKER_PATIENT : SPEAKER_DOCTOR;
}

function formatTurnTime(value, uiLanguage) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString(uiLanguage || "de", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
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

function copyFor(language) {
  const locale = ["de", "en", "it", "es", "fr"].includes(language) ? language : "en";
  const copy = {
    de: {
      eyebrow: "MedScoutX Medical Interpreter",
      title: "Live-Gespräch übersetzen",
      subtitle:
        "Eine einzige professionelle Oberfläche für Live-Übersetzung, Sprachausgabe, Gesprächsdokumentation und PDF.",
      patientEntry: "Patientenbereich",
      practiceEntry: "Praxisbereich",
      backPatient: "Zurück zum Patientenbereich",
      backPractice: "Zurück zum Praxisbereich",
      safety:
        "Nur Kommunikationsunterstützung. Keine Diagnose, keine Triage und keine Behandlungsempfehlung.",
      safetyDetail:
        "Wichtige Inhalte sollten immer mit Arzt oder Praxis bestätigt werden. Audio wird nicht dauerhaft gespeichert.",
      setupTitle: "Neue Sitzung",
      setupText:
        "Erfassen Sie nur die wichtigsten Angaben. Die Live-Übersetzung startet später in derselben Ansicht.",
      patientName: "Patientenname *",
      patientLanguage: "Patientensprache *",
      doctorLanguage: "Arzt-/Praxis-Sprache *",
      optional: "Optionale Angaben",
      doctorName: "Arztname",
      practiceName: "Praxis / Klinik",
      appointment: "Termin",
      conversationTitle: "Gesprächstitel",
      create: "Sitzung anlegen",
      requiredError: "Bitte alle Pflichtfelder ausfüllen.",
      sessionCreated: "Sitzung angelegt.",
      sessionsTitle: "Sitzungen auf diesem Gerät",
      sessionsText:
        "Eine Sitzung auswählen, fortsetzen oder die Gesprächsdokumentation als PDF herunterladen.",
      noSessions: "Noch keine Sitzung vorhanden.",
      activeSession: "Aktive Sitzung",
      languagePair: "Sprachpaar",
      turnCount: "Dokumentierte Beiträge",
      statPatient: "Beiträge Patient:in",
      statDoctor: "Beiträge Arzt/Praxis",
      status: "Status",
      statusDraft: "Entwurf",
      statusActive: "Aktiv",
      statusEnded: "Beendet",
      liveTitle: "Live-Steuerung",
      liveText:
        "Ein Start, ein Ende und ein automatischer Wechsel zwischen beiden Seiten.",
      start: "Start",
      end: "Gespräch beenden",
      speed: "Stimme",
      normal: "Normal",
      slow: "Langsam",
      replay: "Letzte Übersetzung",
      stopPlayback: "Stopp",
      downloadPdf: "PDF herunterladen",
      deleteSession: "Auf diesem Gerät löschen",
      liveTranscript: "Live-Text",
      firstTurnOpen: "Signalton: Patient:in oder Arzt/Praxis kann jetzt beginnen.",
      doctorTurn: "Signalton: Arzt/Praxis spricht jetzt.",
      patientTurn: "Signalton: Patient:in spricht jetzt.",
      statusIdle: "Bereit",
      statusListening: "Hört zu",
      statusSilenceWaiting: "Wartet auf das Ende des Beitrags",
      statusTranscribing: "Transkribiert den aktuellen Beitrag",
      statusTranslating: "Übersetzt den aktuellen Beitrag",
      statusSpeaking: "Spricht die Übersetzung vor",
      statusEndedText: "Gespräch beendet",
      statusErrorText: "Bitte Mikrofon oder Verbindung prüfen",
      noSpeech: "Es wurde keine klare Sprache erkannt. Bitte erneut sprechen.",
      noTranscript: "Für diesen Beitrag konnte kein Text erkannt werden. Bitte erneut sprechen.",
      timelineTitle: "Gesprächsverlauf",
      timelineText:
        "Jeder Beitrag wird mit Original und Übersetzung fortlaufend dokumentiert.",
      noTurns: "Noch keine dokumentierten Beiträge.",
      turnProcessed: "Übersetzt",
      turnSpoken: "Vorgelesen",
      turnError: "Fehler",
      original: "Original",
      translationForDoctor: "Übersetzung für Arzt/Praxis",
      translationForPatient: "Übersetzung für Patient:in",
      patientLabel: "Patient:in",
      doctorLabel: "Arzt / Praxis",
      ttsLoading: "Sprachausgabe wird vorbereitet",
      ttsPlaying: "Sprachausgabe läuft",
      ttsStopped: "Wiedergabe gestoppt",
      micDenied: "Mikrofon ist nicht verfügbar. Bitte Browser-Berechtigung prüfen.",
    },
    en: {
      eyebrow: "MedScoutX Medical Interpreter",
      title: "Live conversation translation",
      subtitle:
        "One professional surface for live translation, spoken playback, conversation documentation, and PDF export.",
      patientEntry: "Patient area",
      practiceEntry: "Practice area",
      backPatient: "Back to patient area",
      backPractice: "Back to practice area",
      safety:
        "Communication support only. No diagnosis, no triage, and no treatment recommendations.",
      safetyDetail:
        "Important content should always be confirmed with the doctor or practice. Audio is not stored permanently.",
      setupTitle: "New session",
      setupText:
        "Enter only the key details. Live translation starts later in the same view.",
      patientName: "Patient name *",
      patientLanguage: "Patient language *",
      doctorLanguage: "Doctor / practice language *",
      optional: "Optional details",
      doctorName: "Doctor name",
      practiceName: "Practice / clinic",
      appointment: "Appointment",
      conversationTitle: "Conversation title",
      create: "Create session",
      requiredError: "Please complete all required fields.",
      sessionCreated: "Session created.",
      sessionsTitle: "Sessions on this device",
      sessionsText:
        "Select a session, continue it, or download the conversation documentation as a PDF.",
      noSessions: "No sessions yet.",
      activeSession: "Active session",
      languagePair: "Language pair",
      turnCount: "Documented turns",
      statPatient: "Patient turns",
      statDoctor: "Doctor/practice turns",
      status: "Status",
      statusDraft: "Draft",
      statusActive: "Active",
      statusEnded: "Ended",
      liveTitle: "Live controls",
      liveText:
        "One start, one end, and an automatic speaker change between both sides.",
      start: "Start",
      end: "End conversation",
      speed: "Voice",
      normal: "Normal",
      slow: "Slow",
      replay: "Replay last translation",
      stopPlayback: "Stop",
      downloadPdf: "Download PDF",
      deleteSession: "Delete on this device",
      liveTranscript: "Live text",
      firstTurnOpen: "Tone: patient or doctor/practice can begin now.",
      doctorTurn: "Tone: doctor/practice speaks now.",
      patientTurn: "Tone: patient speaks now.",
      statusIdle: "Ready",
      statusListening: "Listening",
      statusSilenceWaiting: "Waiting for the turn to finish",
      statusTranscribing: "Transcribing the current turn",
      statusTranslating: "Translating the current turn",
      statusSpeaking: "Playing the spoken translation",
      statusEndedText: "Conversation ended",
      statusErrorText: "Please check microphone or connection",
      noSpeech: "No clear speech was detected. Please speak again.",
      noTranscript: "No transcript could be created for this turn. Please speak again.",
      timelineTitle: "Conversation log",
      timelineText: "Each turn is documented here with original wording and translation.",
      noTurns: "No documented turns yet.",
      turnProcessed: "Translated",
      turnSpoken: "Spoken",
      turnError: "Error",
      original: "Original",
      translationForDoctor: "Translation for doctor/practice",
      translationForPatient: "Translation for patient",
      patientLabel: "Patient",
      doctorLabel: "Doctor / Practice",
      ttsLoading: "Preparing spoken playback",
      ttsPlaying: "Spoken playback is running",
      ttsStopped: "Playback stopped",
      micDenied: "Microphone is not available. Please check browser permission.",
    },
    it: {
      eyebrow: "MedScoutX Medical Interpreter",
      title: "Traduzione live della conversazione",
      subtitle:
        "Un'unica interfaccia professionale per traduzione live, riproduzione vocale, documentazione ed export PDF.",
      patientEntry: "Area paziente",
      practiceEntry: "Area studio",
      backPatient: "Torna all'area paziente",
      backPractice: "Torna all'area studio",
      safety:
        "Solo supporto alla comunicazione. Nessuna diagnosi, nessun triage e nessuna raccomandazione terapeutica.",
      safetyDetail:
        "Le informazioni importanti devono sempre essere confermate con medico o studio. L'audio non viene salvato in modo permanente.",
      setupTitle: "Nuova sessione",
      setupText:
        "Inserisci solo i dati essenziali. La traduzione live parte nella stessa schermata.",
      patientName: "Nome paziente *",
      patientLanguage: "Lingua del paziente *",
      doctorLanguage: "Lingua medico / studio *",
      optional: "Dettagli opzionali",
      doctorName: "Nome del medico",
      practiceName: "Studio / clinica",
      appointment: "Appuntamento",
      conversationTitle: "Titolo conversazione",
      create: "Crea sessione",
      requiredError: "Compila tutti i campi obbligatori.",
      sessionCreated: "Sessione creata.",
      sessionsTitle: "Sessioni su questo dispositivo",
      sessionsText:
        "Seleziona una sessione, continua oppure scarica la documentazione in PDF.",
      noSessions: "Nessuna sessione disponibile.",
      activeSession: "Sessione attiva",
      languagePair: "Coppia di lingue",
      turnCount: "Interventi documentati",
      statPatient: "Interventi paziente",
      statDoctor: "Interventi medico/studio",
      status: "Stato",
      statusDraft: "Bozza",
      statusActive: "Attiva",
      statusEnded: "Conclusa",
      liveTitle: "Controlli live",
      liveText:
        "Un avvio, una fine e un cambio automatico tra le due parti.",
      start: "Avvia",
      end: "Termina conversazione",
      speed: "Voce",
      normal: "Normale",
      slow: "Lenta",
      replay: "Riascolta ultima traduzione",
      stopPlayback: "Stop",
      downloadPdf: "Scarica PDF",
      deleteSession: "Elimina da questo dispositivo",
      liveTranscript: "Testo live",
      firstTurnOpen: "Segnale: paziente o medico/studio possono iniziare ora.",
      doctorTurn: "Segnale: medico/studio parlano ora.",
      patientTurn: "Segnale: il paziente parla ora.",
      statusIdle: "Pronto",
      statusListening: "In ascolto",
      statusSilenceWaiting: "Attende la fine dell'intervento",
      statusTranscribing: "Trascrive l'intervento corrente",
      statusTranslating: "Traduce l'intervento corrente",
      statusSpeaking: "Riproduce la traduzione",
      statusEndedText: "Conversazione conclusa",
      statusErrorText: "Controlla microfono o connessione",
      noSpeech: "Non è stato rilevato parlato chiaro. Riprovare.",
      noTranscript: "Non è stato possibile creare la trascrizione. Riprovare.",
      timelineTitle: "Cronologia conversazione",
      timelineText: "Ogni intervento viene documentato con originale e traduzione.",
      noTurns: "Nessun intervento documentato.",
      turnProcessed: "Tradotto",
      turnSpoken: "Riprodotto",
      turnError: "Errore",
      original: "Originale",
      translationForDoctor: "Traduzione per medico/studio",
      translationForPatient: "Traduzione per paziente",
      patientLabel: "Paziente",
      doctorLabel: "Medico / Studio",
      ttsLoading: "Preparazione della voce",
      ttsPlaying: "Riproduzione vocale in corso",
      ttsStopped: "Riproduzione interrotta",
      micDenied: "Microfono non disponibile. Controlla i permessi del browser.",
    },
    es: {
      eyebrow: "MedScoutX Medical Interpreter",
      title: "Traducción en vivo de la conversación",
      subtitle:
        "Una única superficie profesional para traducción en vivo, voz, documentación y exportación en PDF.",
      patientEntry: "Área del paciente",
      practiceEntry: "Área de la consulta",
      backPatient: "Volver al área del paciente",
      backPractice: "Volver al área de la consulta",
      safety:
        "Solo apoyo para la comunicación. Sin diagnóstico, sin triaje y sin recomendaciones de tratamiento.",
      safetyDetail:
        "La información importante debe confirmarse siempre con el médico o la consulta. El audio no se guarda de forma permanente.",
      setupTitle: "Nueva sesión",
      setupText:
        "Introduzca solo los datos esenciales. La traducción en vivo comienza en la misma vista.",
      patientName: "Nombre del paciente *",
      patientLanguage: "Idioma del paciente *",
      doctorLanguage: "Idioma del médico / consulta *",
      optional: "Detalles opcionales",
      doctorName: "Nombre del médico",
      practiceName: "Consulta / clínica",
      appointment: "Cita",
      conversationTitle: "Título de la conversación",
      create: "Crear sesión",
      requiredError: "Complete todos los campos obligatorios.",
      sessionCreated: "Sesión creada.",
      sessionsTitle: "Sesiones en este dispositivo",
      sessionsText:
        "Seleccione una sesión, continúela o descargue la documentación en PDF.",
      noSessions: "Aún no hay sesiones.",
      activeSession: "Sesión activa",
      languagePair: "Par de idiomas",
      turnCount: "Intervenciones documentadas",
      statPatient: "Intervenciones paciente",
      statDoctor: "Intervenciones médico/consulta",
      status: "Estado",
      statusDraft: "Borrador",
      statusActive: "Activa",
      statusEnded: "Finalizada",
      liveTitle: "Controles en vivo",
      liveText:
        "Un inicio, un final y un cambio automático entre las dos partes.",
      start: "Iniciar",
      end: "Finalizar conversación",
      speed: "Voz",
      normal: "Normal",
      slow: "Lenta",
      replay: "Repetir última traducción",
      stopPlayback: "Detener",
      downloadPdf: "Descargar PDF",
      deleteSession: "Eliminar de este dispositivo",
      liveTranscript: "Texto en vivo",
      firstTurnOpen: "Tono: paciente o médico/consulta pueden empezar ahora.",
      doctorTurn: "Tono: médico/consulta hablan ahora.",
      patientTurn: "Tono: paciente habla ahora.",
      statusIdle: "Listo",
      statusListening: "Escuchando",
      statusSilenceWaiting: "Espera a que termine la intervención",
      statusTranscribing: "Transcribiendo la intervención actual",
      statusTranslating: "Traduciendo la intervención actual",
      statusSpeaking: "Reproduciendo la traducción",
      statusEndedText: "Conversación finalizada",
      statusErrorText: "Revise micrófono o conexión",
      noSpeech: "No se detectó voz clara. Inténtelo de nuevo.",
      noTranscript: "No se pudo crear la transcripción. Inténtelo de nuevo.",
      timelineTitle: "Registro de la conversación",
      timelineText: "Cada intervención se documenta con texto original y traducción.",
      noTurns: "Todavía no hay intervenciones documentadas.",
      turnProcessed: "Traducido",
      turnSpoken: "Reproducido",
      turnError: "Error",
      original: "Original",
      translationForDoctor: "Traducción para médico/consulta",
      translationForPatient: "Traducción para paciente",
      patientLabel: "Paciente",
      doctorLabel: "Médico / Consulta",
      ttsLoading: "Preparando la voz",
      ttsPlaying: "La voz se está reproduciendo",
      ttsStopped: "Reproducción detenida",
      micDenied: "El micrófono no está disponible. Revise el permiso del navegador.",
    },
    fr: {
      eyebrow: "MedScoutX Medical Interpreter",
      title: "Traduction en direct de la conversation",
      subtitle:
        "Une surface professionnelle unique pour la traduction en direct, la restitution vocale, la documentation et l'export PDF.",
      patientEntry: "Espace patient",
      practiceEntry: "Espace cabinet",
      backPatient: "Retour à l'espace patient",
      backPractice: "Retour à l'espace cabinet",
      safety:
        "Aide à la communication uniquement. Aucun diagnostic, aucun triage et aucun conseil de traitement.",
      safetyDetail:
        "Les informations importantes doivent toujours être confirmées avec le médecin ou le cabinet. L'audio n'est pas stocké de façon permanente.",
      setupTitle: "Nouvelle session",
      setupText:
        "Renseignez uniquement les informations essentielles. La traduction en direct démarre dans la même vue.",
      patientName: "Nom du patient *",
      patientLanguage: "Langue du patient *",
      doctorLanguage: "Langue médecin / cabinet *",
      optional: "Détails optionnels",
      doctorName: "Nom du médecin",
      practiceName: "Cabinet / clinique",
      appointment: "Rendez-vous",
      conversationTitle: "Titre de la conversation",
      create: "Créer la session",
      requiredError: "Veuillez compléter tous les champs obligatoires.",
      sessionCreated: "Session créée.",
      sessionsTitle: "Sessions sur cet appareil",
      sessionsText:
        "Sélectionnez une session, poursuivez-la ou téléchargez la documentation en PDF.",
      noSessions: "Aucune session pour le moment.",
      activeSession: "Session active",
      languagePair: "Paire de langues",
      turnCount: "Prises de parole documentées",
      statPatient: "Tours patient",
      statDoctor: "Tours médecin/cabinet",
      status: "Statut",
      statusDraft: "Brouillon",
      statusActive: "Active",
      statusEnded: "Terminée",
      liveTitle: "Contrôles live",
      liveText:
        "Un démarrage, une fin et un changement automatique entre les deux côtés.",
      start: "Démarrer",
      end: "Terminer la conversation",
      speed: "Voix",
      normal: "Normale",
      slow: "Lente",
      replay: "Relire la dernière traduction",
      stopPlayback: "Arrêter",
      downloadPdf: "Télécharger le PDF",
      deleteSession: "Supprimer de cet appareil",
      liveTranscript: "Texte en direct",
      firstTurnOpen: "Signal sonore : patient ou médecin/cabinet peuvent commencer maintenant.",
      doctorTurn: "Signal sonore : médecin/cabinet parle maintenant.",
      patientTurn: "Signal sonore : le patient parle maintenant.",
      statusIdle: "Prêt",
      statusListening: "Écoute",
      statusSilenceWaiting: "Attend la fin de la prise de parole",
      statusTranscribing: "Transcrit la prise de parole en cours",
      statusTranslating: "Traduit la prise de parole en cours",
      statusSpeaking: "Lit la traduction à voix haute",
      statusEndedText: "Conversation terminée",
      statusErrorText: "Veuillez vérifier le micro ou la connexion",
      noSpeech: "Aucune parole claire n'a été détectée. Veuillez réessayer.",
      noTranscript: "Aucune transcription n'a pu être créée. Veuillez réessayer.",
      timelineTitle: "Historique de la conversation",
      timelineText: "Chaque prise de parole est documentée avec le texte original et la traduction.",
      noTurns: "Aucune prise de parole documentée.",
      turnProcessed: "Traduit",
      turnSpoken: "Lu",
      turnError: "Erreur",
      original: "Original",
      translationForDoctor: "Traduction pour médecin/cabinet",
      translationForPatient: "Traduction pour patient",
      patientLabel: "Patient",
      doctorLabel: "Médecin / Cabinet",
      ttsLoading: "Préparation de la voix",
      ttsPlaying: "La restitution vocale est en cours",
      ttsStopped: "Lecture arrêtée",
      micDenied: "Le microphone n'est pas disponible. Vérifiez l'autorisation du navigateur.",
    },
  };
  return copy[locale];
}

function turnStatusClass(status) {
  switch (status) {
    case TURN_STATUS_SPOKEN:
      return "interpreter-live-shell__turn-status--spoken";
    case TURN_STATUS_TRANSLATED:
      return "interpreter-live-shell__turn-status--translated";
    case TURN_STATUS_ERROR:
      return "interpreter-live-shell__turn-status--error";
    default:
      return "interpreter-live-shell__turn-status--processing";
  }
}

export default function InterpreterWorkspacePage() {
  const { language } = useLanguage();
  const labels = useMedicalInterpreterMessages();
  const [searchParams, setSearchParams] = useSearchParams();
  const copy = useMemo(() => copyFor(language), [language]);
  const practiceId = searchParams.get("practiceId")?.trim() || "";
  const entry = searchParams.get("entry")?.trim() || (practiceId ? "practice" : "patient");
  const sessionId = searchParams.get("sessionId")?.trim() || "";

  const [form, setForm] = useState(emptyForm);
  const [storeTick, setStoreTick] = useState(0);
  const [phase, setPhase] = useState(LIVE_PHASE.IDLE);
  const [voiceSpeed, setVoiceSpeed] = useState("normal");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [draftTranscript, setDraftTranscript] = useState("");
  const [nextSpeaker, setNextSpeaker] = useState(null);
  const [lastPlaybackRequest, setLastPlaybackRequest] = useState(null);

  const phaseRef = useRef(phase);
  const nextSpeakerRef = useRef(nextSpeaker);
  const selectedSessionRef = useRef(null);
  const loopEnabledRef = useRef(false);
  const processingRef = useRef(false);
  const restartTimerRef = useRef(null);

  const sessions = useMemo(() => {
    void storeTick;
    return listSessions();
  }, [storeTick]);

  const selectedSession = useMemo(() => {
    if (!sessions.length) return null;
    return (
      sessions.find((item) => item.sessionId === sessionId) ??
      sessions[0] ??
      null
    );
  }, [sessionId, sessions]);

  const languageOptions = useMemo(
    () =>
      INTERPRETER_SETUP_LANGUAGE_OPTIONS.map((option) => ({
        value: option.value,
        label:
          formatLanguageDisplayName(language, option.value) ||
          option.label ||
          option.value,
      })),
    [language],
  );

  const {
    playText,
    stopAllPlayback,
    isLoading: isSpeakLoading,
    isPlaying: isSpeakPlaying,
  } = useInterpreterTtsPlayback({
    voiceProfile: VOICE_PROFILE,
    voiceSpeed,
  });

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    nextSpeakerRef.current = nextSpeaker;
  }, [nextSpeaker]);

  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  useEffect(() => {
    document.title = `${copy.title} | MedScoutX`;
  }, [copy.title]);

  const refreshStore = useCallback(() => {
    setStoreTick((value) => value + 1);
  }, []);

  const backHref =
    entry === "practice"
      ? practiceInterpreterPath("/practice", practiceId)
      : "/patient";

  const selectedStatusLabel =
    selectedSession?.status === SESSION_STATUS_ACTIVE
      ? copy.statusActive
      : selectedSession?.status === SESSION_STATUS_ENDED
        ? copy.statusEnded
        : copy.statusDraft;

  const pairLabel = selectedSession
    ? `${formatLanguageDisplayName(language, selectedSession.patientLanguage) || selectedSession.patientLanguage} ↔ ${formatLanguageDisplayName(language, selectedSession.doctorLanguage) || selectedSession.doctorLanguage}`
    : "";

  const turns = selectedSession?.turns ?? [];
  const patientTurnCount = turns.filter((turn) => turn.speaker === SPEAKER_PATIENT).length;
  const doctorTurnCount = turns.filter((turn) => turn.speaker === SPEAKER_DOCTOR).length;

  const statusText = useMemo(() => {
    switch (phase) {
      case LIVE_PHASE.LISTENING:
        return copy.statusListening;
      case LIVE_PHASE.SILENCE_WAITING:
        return copy.statusSilenceWaiting;
      case LIVE_PHASE.TRANSCRIBING:
        return copy.statusTranscribing;
      case LIVE_PHASE.TRANSLATING:
        return copy.statusTranslating;
      case LIVE_PHASE.SPEAKING:
        return copy.statusSpeaking;
      case LIVE_PHASE.ENDED:
        return copy.statusEndedText;
      case LIVE_PHASE.ERROR:
        return copy.statusErrorText;
      default:
        return copy.statusIdle;
    }
  }, [copy, phase]);

  const turnPrompt = useMemo(() => {
    if (phase === LIVE_PHASE.ENDED) return copy.statusEndedText;
    if (phase === LIVE_PHASE.ERROR) return copy.statusErrorText;
    if (phase === LIVE_PHASE.SPEAKING) {
      return nextSpeaker === SPEAKER_DOCTOR ? copy.doctorTurn : copy.patientTurn;
    }
    if (turns.length === 0 || !nextSpeaker) {
      return copy.firstTurnOpen;
    }
    return nextSpeaker === SPEAKER_DOCTOR ? copy.doctorTurn : copy.patientTurn;
  }, [copy, nextSpeaker, phase, turns.length]);

  const announce = useCallback((message) => {
    setLiveAnnouncement("");
    requestAnimationFrame(() => setLiveAnnouncement(message));
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const scheduleNextListening = useCallback(() => {
    clearRestartTimer();
    if (!loopEnabledRef.current || !selectedSessionRef.current?.sessionId) {
      return;
    }
    restartTimerRef.current = window.setTimeout(async () => {
      if (
        !loopEnabledRef.current ||
        !selectedSessionRef.current?.sessionId ||
        selectedSessionRef.current.status === SESSION_STATUS_ENDED ||
        processingRef.current
      ) {
        return;
      }
      setPhase(LIVE_PHASE.LISTENING);
      await startRecordingRef.current?.();
    }, AUTO_RESTART_DELAY_MS);
  }, [clearRestartTimer]);

  const handleRecorderSilencePhase = useCallback((silencePhase) => {
    if (phaseRef.current === LIVE_PHASE.ENDED || phaseRef.current === LIVE_PHASE.ERROR) {
      return;
    }
    setPhase(silencePhase === "silence_waiting" ? LIVE_PHASE.SILENCE_WAITING : LIVE_PHASE.LISTENING);
  }, []);

  const resolveTranslation = useCallback(async ({ text, sourceLanguage, targetLanguage, speaker }) => {
    if (isNearRealtimeTranslationClientEnabled() && text.length <= 600) {
      const fast = await translateNearRealtimePreview({
        text,
        sourceLanguage,
        targetLanguage,
        speaker,
      });
      if (fast.ok) {
        return {
          ok: true,
          translatedText: fast.translatedText,
        };
      }
    }
    return translateTurn({ text, sourceLanguage, targetLanguage, speaker });
  }, []);

  const continuePingPong = useCallback(
    async (speakerForNextTurn) => {
      const next = oppositeSpeaker(speakerForNextTurn);
      setNextSpeaker(next);
      await playInterpreterTurnSignal();
      await wait(TURN_SIGNAL_WAIT_MS);
      announce(next === SPEAKER_DOCTOR ? copy.doctorTurn : copy.patientTurn);
      setPhase(LIVE_PHASE.LISTENING);
      scheduleNextListening();
    },
    [announce, copy.doctorTurn, copy.patientTurn, scheduleNextListening],
  );

  const finalizeSegment = useCallback(
    async ({ blob, mimeType }) => {
      const activeSession = selectedSessionRef.current;
      if (!activeSession?.sessionId || activeSession.status === SESSION_STATUS_ENDED) {
        return;
      }

      processingRef.current = true;
      setErrorMessage("");
      setInfoMessage("");
      setDraftTranscript("");

      try {
        const silent = await detectLikelySilentBlob(blob);
        if (silent.silent) {
          announce(copy.noSpeech);
          setPhase(LIVE_PHASE.LISTENING);
          scheduleNextListening();
          return;
        }

        const latestSession = getSession(activeSession.sessionId) || activeSession;
        const firstTurn = (latestSession.turns?.length || 0) === 0;
        const hintedSpeaker = firstTurn
          ? null
          : nextSpeakerRef.current ||
            oppositeSpeaker(latestSession.turns[latestSession.turns.length - 1]?.speaker || SPEAKER_PATIENT);
        const hintedLanguage = hintedSpeaker
          ? languagesForSpeaker(latestSession, hintedSpeaker).sourceLanguage
          : undefined;

        setPhase(LIVE_PHASE.TRANSCRIBING);
        announce(copy.statusTranscribing);
        const transcriptResult = await transcribeAudio(blob, {
          filename: mimeType?.includes("ogg") ? "utterance.ogg" : "utterance.webm",
          language: hintedLanguage,
        });

        if (!transcriptResult.ok) {
          setErrorMessage(interpreterErrorMessage(transcriptResult.code, labels, transcriptResult.message));
          setPhase(LIVE_PHASE.ERROR);
          loopEnabledRef.current = false;
          return;
        }

        const transcript = String(transcriptResult.transcript || "").trim();
        if (!transcript) {
          announce(copy.noTranscript);
          setPhase(LIVE_PHASE.LISTENING);
          scheduleNextListening();
          return;
        }

        setDraftTranscript(transcript);

        const languagesDiffer =
          normalizeLang(latestSession.patientLanguage) !== normalizeLang(latestSession.doctorLanguage);
        const resolvedSpeaker = firstTurn
          ? languagesDiffer
            ? detectSpeakerFromLanguage(
                transcriptResult.language,
                transcript,
                latestSession,
                SPEAKER_PATIENT,
              )
            : SPEAKER_PATIENT
          : hintedSpeaker || SPEAKER_PATIENT;

        const { sourceLanguage, targetLanguage } = languagesForSpeaker(
          latestSession,
          resolvedSpeaker,
        );

        const createdTurn = addTurn(latestSession.sessionId, {
          speaker: resolvedSpeaker,
          speakerLabel:
            resolvedSpeaker === SPEAKER_DOCTOR ? copy.doctorLabel : copy.patientLabel,
          sourceLanguage,
          targetLanguage,
          originalText: transcript,
          originalTranscript: transcript,
          confidence:
            transcriptResult.confidence === "high"
              ? "high"
              : transcriptResult.confidence || undefined,
          status: TURN_STATUS_TRANSCRIBED,
          timestamp: new Date().toISOString(),
        });

        if (!createdTurn) {
          setErrorMessage(copy.statusErrorText);
          setPhase(LIVE_PHASE.ERROR);
          loopEnabledRef.current = false;
          return;
        }
        refreshStore();

        setPhase(LIVE_PHASE.TRANSLATING);
        announce(copy.statusTranslating);
        const translation = await resolveTranslation({
          text: transcript,
          sourceLanguage,
          targetLanguage,
          speaker: resolvedSpeaker,
        });

        if (!translation.ok) {
          updateTurn(latestSession.sessionId, createdTurn.turnId, { status: TURN_STATUS_ERROR });
          refreshStore();
          setErrorMessage(interpreterErrorMessage(translation.code || translation.error, labels, translation.message));
          setPhase(LIVE_PHASE.ERROR);
          loopEnabledRef.current = false;
          return;
        }

        updateTurn(latestSession.sessionId, createdTurn.turnId, {
          translatedText: translation.translatedText,
          status: TURN_STATUS_TRANSLATED,
        });
        refreshStore();
        setLastPlaybackRequest({
          text: translation.translatedText,
          language: targetLanguage,
          target: "translation",
          awaitEnd: true,
          voiceProfile: VOICE_PROFILE,
          voiceSpeed,
        });

        setPhase(LIVE_PHASE.SPEAKING);
        announce(copy.statusSpeaking);
        const speech = await playText({
          text: translation.translatedText,
          language: targetLanguage,
          target: "translation",
          useStreamEndpoint: true,
          awaitEnd: true,
          voiceProfile: VOICE_PROFILE,
          voiceSpeed,
        });

        if (speech.ok) {
          updateTurn(latestSession.sessionId, createdTurn.turnId, {
            status: TURN_STATUS_SPOKEN,
          });
          refreshStore();
        } else if (speech.code !== "cancelled") {
          setInfoMessage(copy.ttsStopped);
        }

        await continuePingPong(resolvedSpeaker);
      } finally {
        processingRef.current = false;
      }
    },
    [
      announce,
      continuePingPong,
      copy,
      labels,
      playText,
      refreshStore,
      resolveTranslation,
      scheduleNextListening,
      voiceSpeed,
    ],
  );

  const {
    isPreparing,
    isRecording,
    isStopping,
    recorderError,
    clearRecorderError,
    startRecording,
    cancelRecording,
  } = useInterpreterRecorder({
    silenceAutoStopMs: INTERPRETER_SILENCE_AUTO_STOP_MS,
    onRecordingStart: () => {
      setPhase(LIVE_PHASE.LISTENING);
      announce(copy.statusListening);
    },
    onSilencePhaseChange: handleRecorderSilencePhase,
    onRecorded: finalizeSegment,
  });

  const startRecordingRef = useRef(null);
  useEffect(() => {
    startRecordingRef.current = async () => {
      if (
        !loopEnabledRef.current ||
        !selectedSessionRef.current?.sessionId ||
        processingRef.current ||
        isSpeakLoading ||
        isSpeakPlaying
      ) {
        return false;
      }
      clearRecorderError();
      const started = await startRecording();
      if (!started && recorderError === "mic_denied") {
        setErrorMessage(copy.micDenied);
        setPhase(LIVE_PHASE.ERROR);
        loopEnabledRef.current = false;
      }
      return started;
    };
  }, [
    clearRecorderError,
    copy.micDenied,
    isSpeakLoading,
    isSpeakPlaying,
    recorderError,
    startRecording,
  ]);

  useEffect(() => {
    if (!recorderError) return;
    if (recorderError === "too_short") {
      announce(copy.noSpeech);
      setPhase(LIVE_PHASE.LISTENING);
      scheduleNextListening();
      return;
    }
    if (recorderError === "mic_denied") {
      setErrorMessage(copy.micDenied);
    }
  }, [announce, copy.micDenied, copy.noSpeech, recorderError, scheduleNextListening]);

  useEffect(() => {
    const resumeIfNeeded = () => {
      if (
        document.visibilityState === "hidden" ||
        !loopEnabledRef.current ||
        phaseRef.current === LIVE_PHASE.ENDED ||
        processingRef.current ||
        isRecording ||
        isPreparing ||
        isStopping ||
        isSpeakLoading ||
        isSpeakPlaying
      ) {
        return;
      }
      scheduleNextListening();
    };

    document.addEventListener("visibilitychange", resumeIfNeeded);
    window.addEventListener("focus", resumeIfNeeded);
    window.addEventListener("pageshow", resumeIfNeeded);
    return () => {
      document.removeEventListener("visibilitychange", resumeIfNeeded);
      window.removeEventListener("focus", resumeIfNeeded);
      window.removeEventListener("pageshow", resumeIfNeeded);
    };
  }, [
    isPreparing,
    isRecording,
    isSpeakLoading,
    isSpeakPlaying,
    isStopping,
    scheduleNextListening,
  ]);

  useEffect(() => {
    return () => {
      loopEnabledRef.current = false;
      clearRestartTimer();
      cancelRecording();
      stopAllPlayback();
    };
  }, [cancelRecording, clearRestartTimer, stopAllPlayback]);

  const handleCreateSession = (event) => {
    event.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    if (!form.patientName.trim() || !form.patientLanguage || !form.doctorLanguage) {
      setErrorMessage(copy.requiredError);
      return;
    }

    const created = createSession({
      patientName: form.patientName.trim(),
      patientLanguage: form.patientLanguage,
      doctorLanguage: form.doctorLanguage,
      doctorName: form.doctorName.trim() || undefined,
      practiceName: form.practiceName.trim() || undefined,
      appointmentDateTime: form.appointmentDateTime || undefined,
      conversationTitle: form.conversationTitle.trim() || undefined,
      storageConsent: true,
      profileConsentUsed: false,
    });

    if (!created) {
      setErrorMessage(copy.statusErrorText);
      return;
    }

    setCurrentSessionId(created.sessionId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("sessionId", created.sessionId);
      next.set("entry", entry);
      if (practiceId) next.set("practiceId", practiceId);
      return next;
    });
    setForm(emptyForm());
    setPhase(LIVE_PHASE.IDLE);
    setNextSpeaker(null);
    setLiveAnnouncement("");
    refreshStore();
    setInfoMessage(copy.sessionCreated);
  };

  const handleSelectSession = useCallback(
    (selectedId) => {
      setCurrentSessionId(selectedId);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("sessionId", selectedId);
        next.set("entry", entry);
        if (practiceId) next.set("practiceId", practiceId);
        return next;
      });
      const picked = getSession(selectedId);
      setNextSpeaker(
        picked?.turns?.length
          ? oppositeSpeaker(picked.turns[picked.turns.length - 1].speaker)
          : null,
      );
      setPhase(picked?.status === SESSION_STATUS_ENDED ? LIVE_PHASE.ENDED : LIVE_PHASE.IDLE);
      refreshStore();
    },
    [entry, practiceId, refreshStore, setSearchParams],
  );

  const handleDeleteSession = useCallback(
    (selectedId) => {
      if (!selectedId) return;
      if (selectedSessionRef.current?.sessionId === selectedId) {
        loopEnabledRef.current = false;
        cancelRecording();
        stopAllPlayback();
        clearRestartTimer();
      }
      deleteSession(selectedId);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("sessionId");
        next.set("entry", entry);
        if (practiceId) next.set("practiceId", practiceId);
        return next;
      });
      setPhase(LIVE_PHASE.IDLE);
      setNextSpeaker(null);
      setDraftTranscript("");
      refreshStore();
    },
    [cancelRecording, clearRestartTimer, entry, practiceId, refreshStore, setSearchParams, stopAllPlayback],
  );

  const handleStart = useCallback(async () => {
    if (!selectedSession?.sessionId) return;
    const refreshed = updateSessionMetadata(selectedSession.sessionId, {
      status: SESSION_STATUS_ACTIVE,
    });
    refreshStore();
    selectedSessionRef.current = refreshed || selectedSession;
    loopEnabledRef.current = true;
    setErrorMessage("");
    setInfoMessage("");
    setDraftTranscript("");
    setPhase(LIVE_PHASE.IDLE);
    setNextSpeaker(
      refreshed?.turns?.length
        ? oppositeSpeaker(refreshed.turns[refreshed.turns.length - 1].speaker)
        : null,
    );
    await playInterpreterTurnSignal();
    await wait(TURN_SIGNAL_WAIT_MS);
    announce(
      refreshed?.turns?.length
        ? refreshed.turns[refreshed.turns.length - 1].speaker === SPEAKER_PATIENT
          ? copy.doctorTurn
          : copy.patientTurn
        : copy.firstTurnOpen,
    );
    const started = await startRecordingRef.current?.();
    if (!started) {
      scheduleNextListening();
    }
  }, [announce, copy.doctorTurn, copy.firstTurnOpen, copy.patientTurn, refreshStore, scheduleNextListening, selectedSession]);

  const handleEnd = useCallback(() => {
    if (!selectedSession?.sessionId) return;
    loopEnabledRef.current = false;
    clearRestartTimer();
    cancelRecording();
    stopAllPlayback();
    endSession(selectedSession.sessionId, labels, language);
    refreshStore();
    setPhase(LIVE_PHASE.ENDED);
    setInfoMessage(copy.statusEndedText);
  }, [
    cancelRecording,
    clearRestartTimer,
    copy.statusEndedText,
    labels,
    language,
    refreshStore,
    selectedSession,
    stopAllPlayback,
  ]);

  const handleDownloadPdf = useCallback(() => {
    if (!selectedSession) return;
    const current = getSession(selectedSession.sessionId) || selectedSession;
    const title = getSessionDisplayTitle(current, labels, language);
    const result = downloadInterpreterSessionPdf(current, title, labels);
    setInfoMessage(result.ok ? labels.pdf.exportSuccess : labels.pdf.exportFailed);
  }, [language, labels, selectedSession]);

  const handleReplay = useCallback(async () => {
    if (!lastPlaybackRequest || isSpeakLoading || isSpeakPlaying) return;
    const result = await playText(lastPlaybackRequest);
    if (!result.ok && result.code !== "cancelled") {
      setErrorMessage(interpreterErrorMessage(result.code, labels, result.message));
    }
  }, [isSpeakLoading, isSpeakPlaying, labels, lastPlaybackRequest, playText]);

  const playbackStatus = isSpeakLoading
    ? copy.ttsLoading
    : isSpeakPlaying
      ? copy.ttsPlaying
      : copy.ttsStopped;

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
          <p>{copy.safetyDetail}</p>
        </div>
      </section>

      <section className="interpreter-reset__grid">
        <article className="interpreter-reset__form">
          <h2 className="interpreter-reset__card-title">{copy.setupTitle}</h2>
          <p className="interpreter-shell__subtitle">{copy.setupText}</p>

          {errorMessage ? (
            <div className="interpreter-feedback interpreter-feedback--error" role="alert">
              {errorMessage}
            </div>
          ) : null}
          {infoMessage ? (
            <div className="interpreter-feedback" role="status" aria-live="polite">
              {infoMessage}
            </div>
          ) : null}

          <form onSubmit={handleCreateSession}>
            <div className="interpreter-reset__form-grid">
              <label className="interpreter-reset__field">
                <span>{copy.patientName}</span>
                <input
                  className="interpreter-reset__input"
                  value={form.patientName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, patientName: event.target.value }))
                  }
                />
              </label>

              <label className="interpreter-reset__field">
                <span>{copy.patientLanguage}</span>
                <select
                  className="interpreter-reset__input"
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

              <label className="interpreter-reset__field">
                <span>{copy.doctorLanguage}</span>
                <select
                  className="interpreter-reset__input"
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

            <details className="interpreter-reset__details">
              <summary>{copy.optional}</summary>
              <div className="interpreter-reset__form-grid">
                <label className="interpreter-reset__field">
                  <span>{copy.doctorName}</span>
                  <input
                    className="interpreter-reset__input"
                    value={form.doctorName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, doctorName: event.target.value }))
                    }
                  />
                </label>
                <label className="interpreter-reset__field">
                  <span>{copy.practiceName}</span>
                  <input
                    className="interpreter-reset__input"
                    value={form.practiceName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, practiceName: event.target.value }))
                    }
                  />
                </label>
                <label className="interpreter-reset__field">
                  <span>{copy.appointment}</span>
                  <input
                    className="interpreter-reset__input"
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
                <label className="interpreter-reset__field">
                  <span>{copy.conversationTitle}</span>
                  <input
                    className="interpreter-reset__input"
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

        <article className="interpreter-reset__card">
          <h2 className="interpreter-reset__card-title">{copy.sessionsTitle}</h2>
          <p className="interpreter-shell__subtitle">{copy.sessionsText}</p>

          {sessions.length === 0 ? (
            <p className="interpreter-empty-state">{copy.noSessions}</p>
          ) : (
            <ul className="interpreter-reset__session-list">
              {sessions.map((item) => (
                <li key={item.sessionId} className="interpreter-reset__session-card">
                  <div className="interpreter-reset__session-top">
                    <strong>{getSessionDisplayTitle(item, labels, language)}</strong>
                    <span className="interpreter-reset__badge">
                      {item.status === SESSION_STATUS_ACTIVE
                        ? copy.statusActive
                        : item.status === SESSION_STATUS_ENDED
                          ? copy.statusEnded
                          : copy.statusDraft}
                    </span>
                  </div>
                  <p className="interpreter-reset__meta">
                    {(formatLanguageDisplayName(language, item.patientLanguage) || item.patientLanguage)} ↔{" "}
                    {(formatLanguageDisplayName(language, item.doctorLanguage) || item.doctorLanguage)}
                  </p>
                  <div className="interpreter-reset__actions interpreter-reset__actions--inline">
                    <button
                      type="button"
                      className="interpreter-shell__ghost-btn"
                      onClick={() => handleSelectSession(item.sessionId)}
                    >
                      {copy.activeSession}
                    </button>
                    <button
                      type="button"
                      className="interpreter-shell__danger-btn"
                      onClick={() => handleDeleteSession(item.sessionId)}
                    >
                      {copy.deleteSession}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {selectedSession ? (
        <>
          <section className="interpreter-shell__summary-grid" aria-label={copy.activeSession}>
            <article className="interpreter-shell__summary-card interpreter-shell__summary-card--session">
              <div className="interpreter-shell__summary-head">
                <div>
                  <p className="interpreter-shell__summary-label">{copy.activeSession}</p>
                  <h2>{getSessionDisplayTitle(selectedSession, labels, language)}</h2>
                </div>
                <span className="interpreter-shell__summary-status">{selectedStatusLabel}</span>
              </div>
              <p className="interpreter-shell__summary-meta">{pairLabel}</p>
            </article>
            <article className="interpreter-shell__summary-card">
              <p className="interpreter-shell__summary-label">{copy.turnCount}</p>
              <strong>{turns.length}</strong>
            </article>
            <article className="interpreter-shell__summary-card">
              <p className="interpreter-shell__summary-label">{copy.statPatient}</p>
              <strong>{patientTurnCount}</strong>
            </article>
            <article className="interpreter-shell__summary-card">
              <p className="interpreter-shell__summary-label">{copy.statDoctor}</p>
              <strong>{doctorTurnCount}</strong>
            </article>
          </section>

          <section className="interpreter-shell__panel interpreter-shell__panel--wide">
            <div className="interpreter-shell__panel-head">
              <h2>{copy.liveTitle}</h2>
              <p>{copy.liveText}</p>
            </div>

            <div className="interpreter-status-bar interpreter-status-bar--busy" role="status" aria-live="polite">
              <strong>{copy.status}:</strong> {statusText}
            </div>

            <div className="interpreter-live-shell__status-detail">
              <span className="interpreter-live-shell__status-chip interpreter-live-shell__status-chip--speaker">
                {nextSpeaker === SPEAKER_DOCTOR
                  ? copy.doctorLabel
                  : nextSpeaker === SPEAKER_PATIENT
                    ? copy.patientLabel
                    : `${copy.patientLabel} / ${copy.doctorLabel}`}
              </span>
              <span className="interpreter-live-shell__status-chip interpreter-live-shell__status-chip--direction">
                {pairLabel}
              </span>
            </div>

            <div className="interpreter-live-shell__turn-banner" role="status" aria-live="polite">
              <p className="interpreter-live-shell__turn-banner-label">{copy.status}</p>
              <p className="interpreter-live-shell__turn-banner-text">{turnPrompt}</p>
            </div>

            {draftTranscript ? (
              <div className="interpreter-live-shell__draft">
                <p className="interpreter-live-shell__draft-label">{copy.liveTranscript}</p>
                <p className="interpreter-live-shell__draft-text" dir="auto">
                  {draftTranscript}
                </p>
              </div>
            ) : null}

            <div className="interpreter-live-shell__control-grid">
              <div className="interpreter-live-shell__actions-panel">
                <div className="interpreter-live-shell__button-row">
                  <button
                    type="button"
                    className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary interpreter-live-shell__action interpreter-live-shell__action--start"
                    onClick={handleStart}
                    disabled={
                      isRecording ||
                      isPreparing ||
                      isStopping ||
                      isSpeakLoading ||
                      isSpeakPlaying ||
                      processingRef.current ||
                      selectedSession.status === SESSION_STATUS_ENDED
                    }
                  >
                    {copy.start}
                  </button>
                  <button
                    type="button"
                    className="medical-interpreter-page__nav-link interpreter-live__action-danger interpreter-live-shell__action"
                    onClick={handleEnd}
                    disabled={selectedSession.status === SESSION_STATUS_ENDED}
                  >
                    {copy.end}
                  </button>
                </div>
              </div>

              <div className="interpreter-live-shell__playback-panel">
                <h3 className="interpreter-live-shell__playback-heading">{copy.speed}</h3>
                <div className="interpreter-live-shell__speed-toggle" role="group" aria-label={copy.speed}>
                  <button
                    type="button"
                    className={`interpreter-live-shell__speed-option${voiceSpeed === "normal" ? " interpreter-live-shell__speed-option--active" : ""}`}
                    onClick={() => setVoiceSpeed("normal")}
                  >
                    {copy.normal}
                  </button>
                  <button
                    type="button"
                    className={`interpreter-live-shell__speed-option${voiceSpeed === "slow" ? " interpreter-live-shell__speed-option--active" : ""}`}
                    onClick={() => setVoiceSpeed("slow")}
                  >
                    {copy.slow}
                  </button>
                </div>

                <div className="interpreter-feedback" role="status" aria-live="polite">
                  {playbackStatus}
                </div>

                <div className="interpreter-live-shell__playback-actions">
                  <button
                    type="button"
                    className="medical-interpreter-page__nav-link interpreter-live-shell__playback-action"
                    onClick={handleReplay}
                    disabled={!lastPlaybackRequest || isSpeakLoading || isSpeakPlaying}
                  >
                    {copy.replay}
                  </button>
                  <button
                    type="button"
                    className="medical-interpreter-page__nav-link interpreter-live-shell__playback-action"
                    onClick={stopAllPlayback}
                    disabled={!isSpeakLoading && !isSpeakPlaying}
                  >
                    {copy.stopPlayback}
                  </button>
                </div>
              </div>
            </div>

            <div className="interpreter-reset__actions" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="interpreter-shell__ghost-btn"
                onClick={handleDownloadPdf}
                disabled={turns.length === 0}
              >
                {copy.downloadPdf}
              </button>
            </div>

            <div className="sr-only" role="status" aria-live="polite">
              {liveAnnouncement || statusText}
            </div>
          </section>

          <section className="interpreter-shell__panel interpreter-shell__panel--wide">
            <div className="interpreter-shell__panel-head">
              <h2>{copy.timelineTitle}</h2>
              <p>{copy.timelineText}</p>
            </div>

            {turns.length === 0 ? (
              <p className="interpreter-empty-state">{copy.noTurns}</p>
            ) : (
              <ul className="interpreter-live-shell__turn-list" aria-live="polite">
                {turns.map((turn) => (
                  <li key={turn.turnId} className="interpreter-live-shell__turn-card">
                    <div className="interpreter-live-shell__turn-top">
                      <div>
                        <strong>
                          {turn.speaker === SPEAKER_DOCTOR ? copy.doctorLabel : copy.patientLabel}
                        </strong>
                        <span className="interpreter-live-shell__turn-time">
                          {formatTurnTime(turn.timestamp || turn.createdAt, language)}
                        </span>
                      </div>
                      <span
                        className={`interpreter-live-shell__turn-status ${turnStatusClass(turn.status)}`}
                      >
                        {turn.status === TURN_STATUS_SPOKEN
                          ? copy.turnSpoken
                          : turn.status === TURN_STATUS_TRANSLATED
                            ? copy.turnProcessed
                            : turn.status === TURN_STATUS_ERROR
                              ? copy.turnError
                              : copy.statusTranscribing}
                      </span>
                    </div>

                    <div className="interpreter-live-shell__turn-block">
                      <p className="interpreter-live-shell__turn-label">{copy.original}</p>
                      <p className="interpreter-live-shell__turn-text" dir="auto">
                        {turn.originalTranscript || turn.originalText}
                      </p>
                    </div>

                    <div className="interpreter-live-shell__turn-block">
                      <p className="interpreter-live-shell__turn-label">
                        {turn.speaker === SPEAKER_PATIENT
                          ? copy.translationForDoctor
                          : copy.translationForPatient}
                      </p>
                      <p className="interpreter-live-shell__turn-text" dir="auto">
                        {turn.translatedText || "…"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
