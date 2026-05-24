import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  interpreterErrorMessage,
  transcribeAudio,
  translateTurn,
} from "../api/interpreterApi.js";
import { translateNearRealtimePreview } from "../api/interpreterNearRealtimeApi.js";
import InterpreterPlaybackStatus from "./InterpreterPlaybackStatus.jsx";
import { useInterpreterRecorder } from "../hooks/useInterpreterRecorder.js";
import { useInterpreterServerStatus } from "../hooks/useInterpreterServerStatus.js";
import { useInterpreterTtsPlayback } from "../hooks/useInterpreterTtsPlayback.js";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import { isNearRealtimeTranslationClientEnabled } from "../config/isNearRealtimeTranslationEnabled.js";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_ENDED,
  SPEAKER_DOCTOR,
  SPEAKER_PATIENT,
  TURN_STATUS_BLOCKED,
  TURN_STATUS_CONFIRMED,
  TURN_STATUS_DRAFT,
  TURN_STATUS_ERROR,
  TURN_STATUS_SPOKEN,
  TURN_STATUS_TRANSCRIBED,
  TURN_STATUS_TRANSLATED,
} from "../constants.js";
import {
  addTurn,
  endSession,
  getCurrentSession,
  getSession,
  updateSessionMetadata,
  updateTurn,
} from "../store/interpreterSessionStore.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { detectLikelySilentBlob } from "../utils/interpreterAudioLevel.js";
import { detectSpeakerFromLanguage } from "../utils/detectSpeakerFromLanguage.js";
import { INTERPRETER_SILENCE_AUTO_STOP_MS } from "../utils/interpreterAudioConstants.js";
import { playInterpreterTurnSignal } from "../utils/interpreterTurnSignal.js";
import { languagesForSpeaker } from "../utils/liveLanguages.js";
import { downloadInterpreterSessionPdf } from "../pdf/generateInterpreterSessionPdf.js";
import { getSessionDisplayTitle } from "../utils/sessionDisplayTitle.js";
import "../styles/MedicalInterpreter.css";

const LIVE_PHASE = {
  IDLE: "idle",
  LISTENING: "listening",
  SILENCE_WAITING: "silence_waiting",
  TRANSCRIBING: "transcribing",
  TRANSLATING: "translating",
  SPEAKING_TRANSLATION: "speaking_translation",
  PAUSED: "paused",
  ENDED: "ended",
  ERROR: "error",
};

const PHASE_TRANSITIONS = {
  [LIVE_PHASE.IDLE]: new Set([
    LIVE_PHASE.LISTENING,
    LIVE_PHASE.PAUSED,
    LIVE_PHASE.ENDED,
    LIVE_PHASE.ERROR,
  ]),
  [LIVE_PHASE.LISTENING]: new Set([
    LIVE_PHASE.SILENCE_WAITING,
    LIVE_PHASE.TRANSCRIBING,
    LIVE_PHASE.PAUSED,
    LIVE_PHASE.ENDED,
    LIVE_PHASE.ERROR,
  ]),
  [LIVE_PHASE.SILENCE_WAITING]: new Set([
    LIVE_PHASE.LISTENING,
    LIVE_PHASE.TRANSCRIBING,
    LIVE_PHASE.PAUSED,
    LIVE_PHASE.ENDED,
    LIVE_PHASE.ERROR,
  ]),
  [LIVE_PHASE.TRANSCRIBING]: new Set([
    LIVE_PHASE.TRANSLATING,
    LIVE_PHASE.PAUSED,
    LIVE_PHASE.ENDED,
    LIVE_PHASE.ERROR,
  ]),
  [LIVE_PHASE.TRANSLATING]: new Set([
    LIVE_PHASE.SPEAKING_TRANSLATION,
    LIVE_PHASE.PAUSED,
    LIVE_PHASE.ENDED,
    LIVE_PHASE.ERROR,
  ]),
  [LIVE_PHASE.SPEAKING_TRANSLATION]: new Set([
    LIVE_PHASE.LISTENING,
    LIVE_PHASE.PAUSED,
    LIVE_PHASE.ENDED,
    LIVE_PHASE.ERROR,
  ]),
  [LIVE_PHASE.PAUSED]: new Set([
    LIVE_PHASE.LISTENING,
    LIVE_PHASE.ENDED,
    LIVE_PHASE.ERROR,
    LIVE_PHASE.IDLE,
  ]),
  [LIVE_PHASE.ENDED]: new Set([]),
  [LIVE_PHASE.ERROR]: new Set([
    LIVE_PHASE.LISTENING,
    LIVE_PHASE.PAUSED,
    LIVE_PHASE.ENDED,
    LIVE_PHASE.IDLE,
  ]),
};

const AUTO_RESTART_DELAY_MS = 70;
const AUTO_RESTART_RETRY_MS = 90;
const AUTO_RESTART_MAX_ATTEMPTS = 10;
const LISTENING_WATCHDOG_DELAY_MS = 700;
const POST_PLAYBACK_HANDOFF_DELAY_MS = 180;
const INTERPRETER_VOICE_PROFILE = "neutral_medical";

function nextPhase(currentPhase, requestedPhase) {
  if (currentPhase === requestedPhase) return currentPhase;
  if (requestedPhase === LIVE_PHASE.ERROR || requestedPhase === LIVE_PHASE.ENDED) {
    return requestedPhase;
  }
  if (PHASE_TRANSITIONS[currentPhase]?.has(requestedPhase)) {
    return requestedPhase;
  }
  return currentPhase;
}

function oppositeSpeaker(speaker) {
  return speaker === SPEAKER_PATIENT ? SPEAKER_DOCTOR : SPEAKER_PATIENT;
}

function waitForHandoff(delayMs = POST_PLAYBACK_HANDOFF_DELAY_MS) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
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

function speakerLabelFor(speaker, labels) {
  return speaker === SPEAKER_DOCTOR
    ? labels.conversation.clinicianLabel
    : labels.conversation.patientLabel;
}

function nextExpectedSpeakerFromSession(session) {
  const lastSpeaker = session?.turns?.[session.turns.length - 1]?.speaker;
  if (lastSpeaker === SPEAKER_DOCTOR) return SPEAKER_PATIENT;
  if (lastSpeaker === SPEAKER_PATIENT) return SPEAKER_DOCTOR;
  return SPEAKER_PATIENT;
}

function turnStatusLabel(turn, labels) {
  switch (turn?.status) {
    case TURN_STATUS_SPOKEN:
      return labels.liveSession.turnStatusSpoken;
    case TURN_STATUS_TRANSLATED:
      return labels.liveSession.turnStatusTranslated;
    case TURN_STATUS_TRANSCRIBED:
    case TURN_STATUS_CONFIRMED:
      return labels.liveSession.turnStatusProcessing;
    case TURN_STATUS_DRAFT:
      return labels.review.turnDraft;
    case TURN_STATUS_BLOCKED:
      return labels.review.turnBlocked;
    case TURN_STATUS_ERROR:
      return labels.review.turnError;
    default:
      return labels.liveSession.turnStatusProcessing;
  }
}

function turnStatusClassName(status) {
  switch (status) {
    case TURN_STATUS_SPOKEN:
      return "interpreter-live-shell__turn-status--spoken";
    case TURN_STATUS_TRANSLATED:
      return "interpreter-live-shell__turn-status--translated";
    case TURN_STATUS_ERROR:
    case TURN_STATUS_BLOCKED:
      return "interpreter-live-shell__turn-status--error";
    default:
      return "interpreter-live-shell__turn-status--processing";
  }
}

export default function InterpreterLiveRoom({
  sessionId = "",
  embedded = false,
  homePath = "/interpreter?entry=patient",
  hideBackLink = false,
}) {
  const t = useMedicalInterpreterMessages();
  const { language: uiLanguage } = useLanguage();
  const alertRef = useRef(null);
  const autoRestartTimerRef = useRef(null);
  const autoRestartAttemptRef = useRef(0);
  const listeningWatchdogTimerRef = useRef(null);
  const transcribeAbortRef = useRef(null);
  const translateAbortRef = useRef(null);
  const runTokenRef = useRef(0);
  const processingRef = useRef(false);
  const startListeningRef = useRef(null);
  const loopEnabledRef = useRef(false);
  const initialSessionRef = useRef(
    sessionId ? getSession(sessionId) || getCurrentSession() : getCurrentSession(),
  );
  const interpreterServerStatus = useInterpreterServerStatus();

  const [session, setSession] = useState(() => initialSessionRef.current);
  const [speaker, setSpeakerState] = useState(() =>
    nextExpectedSpeakerFromSession(initialSessionRef.current),
  );
  const [phase, setPhaseState] = useState(() =>
    initialSessionRef.current?.status === SESSION_STATUS_ENDED
      ? LIVE_PHASE.ENDED
      : LIVE_PHASE.IDLE,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [pdfReady, setPdfReady] = useState(() => {
    const current = initialSessionRef.current;
    return current?.status === SESSION_STATUS_ENDED && (current?.turns?.length || 0) > 0;
  });
  const [exportMessage, setExportMessage] = useState("");
  const [voiceSpeed, setVoiceSpeed] = useState("normal");
  const [lastPlaybackRequest, setLastPlaybackRequest] = useState(null);
  const [draftTranscript, setDraftTranscript] = useState("");

  const sessionRef = useRef(session);
  const speakerRef = useRef(speaker);
  const phaseRef = useRef(phase);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    speakerRef.current = speaker;
  }, [speaker]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const nearRealtimeFastTranslateAvailable = useMemo(
    () =>
      isNearRealtimeTranslationClientEnabled() &&
      interpreterServerStatus.nearRealtimeTranslationEnabled === true,
    [interpreterServerStatus.nearRealtimeTranslationEnabled],
  );

  const reloadSession = useCallback(() => {
    const targetSessionId = sessionId || sessionRef.current?.sessionId;
    const fresh = targetSessionId
      ? getSession(targetSessionId)
      : sessionRef.current?.sessionId
      ? getSession(sessionRef.current.sessionId)
      : getCurrentSession();
    const stableSession = fresh || sessionRef.current || initialSessionRef.current || null;
    setSession(stableSession);
    sessionRef.current = stableSession;
    return stableSession;
  }, [sessionId]);

  const setActiveSpeaker = useCallback((nextSpeaker) => {
    speakerRef.current = nextSpeaker;
    setSpeakerState(nextSpeaker);
  }, []);

  const setPhase = useCallback((requestedPhase) => {
    setPhaseState((current) => nextPhase(current, requestedPhase));
  }, []);

  const clearAutoRestart = useCallback(() => {
    if (autoRestartTimerRef.current) {
      clearTimeout(autoRestartTimerRef.current);
      autoRestartTimerRef.current = null;
    }
    autoRestartAttemptRef.current = 0;
  }, []);

  const clearListeningWatchdog = useCallback(() => {
    if (listeningWatchdogTimerRef.current) {
      clearTimeout(listeningWatchdogTimerRef.current);
      listeningWatchdogTimerRef.current = null;
    }
  }, []);

  const {
    playText,
    stopAllPlayback,
    isLoading: isSpeakLoading,
    isPlaying: isSpeakPlaying,
  } = useInterpreterTtsPlayback({
    voiceProfile: INTERPRETER_VOICE_PROFILE,
    voiceSpeed,
  });

  const cancelInFlight = useCallback(() => {
    runTokenRef.current += 1;
    transcribeAbortRef.current?.abort();
    translateAbortRef.current?.abort();
    transcribeAbortRef.current = null;
    translateAbortRef.current = null;
    processingRef.current = false;
  }, []);

  const stopRuntime = useCallback(() => {
    loopEnabledRef.current = false;
    clearAutoRestart();
    clearListeningWatchdog();
    cancelInFlight();
    stopAllPlayback();
  }, [cancelInFlight, clearAutoRestart, clearListeningWatchdog, stopAllPlayback]);

  const announce = useCallback((message) => {
    setLiveAnnouncement("");
    requestAnimationFrame(() => setLiveAnnouncement(message));
  }, []);

  const translateLiveTurn = useCallback(
    async (
      { text, sourceLanguage, targetLanguage, speaker: turnSpeaker },
      options = {},
    ) => {
      if (nearRealtimeFastTranslateAvailable && String(text || "").trim().length <= 600) {
        const fastResult = await translateNearRealtimePreview(
          {
            text,
            sourceLanguage,
            targetLanguage,
            speaker: turnSpeaker,
          },
          { signal: options.signal },
        );

        if (fastResult.ok) {
          return {
            ok: true,
            translatedText: fastResult.translatedText,
            sourceLanguage,
            targetLanguage,
            translationDirection: `${sourceLanguage}->${targetLanguage}`,
            confidence: fastResult.confidence,
            uncertain: fastResult.uncertain === true,
            terminologyWarning: fastResult.terminologyWarning === true,
            unclearSource: fastResult.unclearSource === true,
          };
        }

        if (fastResult.error === "cancelled") {
          return { ok: false, code: "cancelled", message: fastResult.message };
        }

        if (fastResult.error === "unsafe_medical_content") {
          return { ok: false, code: "blocked", message: fastResult.message };
        }
      }

      return translateTurn(
        {
          text,
          sourceLanguage,
          targetLanguage,
          speaker: turnSpeaker,
        },
        { signal: options.signal },
      );
    },
    [nearRealtimeFastTranslateAvailable],
  );

  const showError = useCallback(
    (message) => {
      loopEnabledRef.current = false;
      setErrorMessage(message);
      setPhase(LIVE_PHASE.ERROR);
      requestAnimationFrame(() => alertRef.current?.focus());
    },
    [setPhase],
  );

  const statusText = useMemo(() => {
    switch (phase) {
      case LIVE_PHASE.LISTENING:
        return t.liveSession.statusListening;
      case LIVE_PHASE.SILENCE_WAITING:
        return t.liveSession.statusSilenceWaiting;
      case LIVE_PHASE.TRANSCRIBING:
        return t.liveSession.statusTranscribing;
      case LIVE_PHASE.TRANSLATING:
        return t.liveSession.statusTranslating;
      case LIVE_PHASE.SPEAKING_TRANSLATION:
        return t.liveSession.statusSpeaking;
      case LIVE_PHASE.PAUSED:
        return t.liveSession.statusPaused;
      case LIVE_PHASE.ENDED:
        return t.liveSession.statusEnded;
      case LIVE_PHASE.ERROR:
        return t.liveSession.statusError;
      default:
        return t.liveSession.statusIdle;
    }
  }, [phase, t.liveSession]);

  const languagePairLabel = useMemo(() => {
    if (!session) return "";
    const patient = formatLanguageDisplayName(uiLanguage, session.patientLanguage) || session.patientLanguage;
    const doctor = formatLanguageDisplayName(uiLanguage, session.doctorLanguage) || session.doctorLanguage;
    return t.room.languagesLabel
      .replace("{{patient}}", patient)
      .replace("{{doctor}}", doctor);
  }, [session, t.room.languagesLabel, uiLanguage]);

  const currentDirectionLabel = useMemo(() => {
    if (!session) return "";
    const langs = languagesForSpeaker(session, speaker);
    const source = formatLanguageDisplayName(uiLanguage, langs.sourceLanguage) || langs.sourceLanguage;
    const target = formatLanguageDisplayName(uiLanguage, langs.targetLanguage) || langs.targetLanguage;
    return t.room.speakerDirection
      .replace("{{source}}", source)
      .replace("{{target}}", target);
  }, [session, speaker, t.room.speakerDirection, uiLanguage]);

  const turns = session?.turns ?? [];
  const hasTurns = turns.length > 0;
  const showHeader = !embedded;
  const showConversation = !embedded;
  const activeSpeakerLabel = useMemo(() => {
    if (!hasTurns) {
      return t.liveSession.firstTurnOpenLabel;
    }
    return speakerLabelFor(speaker, t);
  }, [hasTurns, speaker, t]);

  const turnPrompt = useMemo(() => {
    if (phase === LIVE_PHASE.ENDED) {
      return t.sessionActions.ended;
    }
    if (phase === LIVE_PHASE.ERROR) {
      return t.liveSession.statusError;
    }
    if (!hasTurns) {
      return t.liveSession.readyForEither;
    }
    return speaker === SPEAKER_DOCTOR
      ? t.liveSession.readyForDoctor
      : t.liveSession.readyForPatient;
  }, [
    hasTurns,
    phase,
    speaker,
    t.liveSession.readyForDoctor,
    t.liveSession.readyForEither,
    t.liveSession.readyForPatient,
    t.liveSession.statusError,
    t.sessionActions.ended,
  ]);

  const handlePhaseFromSilence = useCallback(
    (silencePhase) => {
      if (phaseRef.current === LIVE_PHASE.PAUSED || phaseRef.current === LIVE_PHASE.ENDED) {
        return;
      }
      if (silencePhase === "silence_waiting") {
        setPhase(LIVE_PHASE.SILENCE_WAITING);
      } else if (silencePhase === "listening") {
        setPhase(LIVE_PHASE.LISTENING);
      }
    },
    [setPhase],
  );

  const scheduleNextListening = useCallback(() => {
    clearAutoRestart();
    if (
      !loopEnabledRef.current ||
      !sessionRef.current ||
      phaseRef.current === LIVE_PHASE.PAUSED ||
      phaseRef.current === LIVE_PHASE.ENDED ||
      phaseRef.current === LIVE_PHASE.ERROR
    ) {
      return;
    }
    const attemptAutoRestart = () => {
      if (
        !loopEnabledRef.current ||
        !sessionRef.current ||
        phaseRef.current === LIVE_PHASE.PAUSED ||
        phaseRef.current === LIVE_PHASE.ENDED ||
        phaseRef.current === LIVE_PHASE.ERROR
      ) {
        autoRestartTimerRef.current = null;
        autoRestartAttemptRef.current = 0;
        return;
      }

      void startListeningRef.current?.().then((started) => {
        if (started) {
          autoRestartTimerRef.current = null;
          autoRestartAttemptRef.current = 0;
          return;
        }

        if (autoRestartAttemptRef.current >= AUTO_RESTART_MAX_ATTEMPTS) {
          autoRestartTimerRef.current = null;
          autoRestartAttemptRef.current = 0;
          setPhase(LIVE_PHASE.IDLE);
          announce(t.liveSession.statusIdle);
          return;
        }

        autoRestartAttemptRef.current += 1;
        autoRestartTimerRef.current = setTimeout(
          attemptAutoRestart,
          AUTO_RESTART_RETRY_MS,
        );
      });
    };

    autoRestartTimerRef.current = setTimeout(
      attemptAutoRestart,
      AUTO_RESTART_DELAY_MS,
    );
  }, [announce, clearAutoRestart, setPhase, t.liveSession.statusIdle]);

  const recoverFromShortRecording = useCallback(() => {
    if (!loopEnabledRef.current || phaseRef.current === LIVE_PHASE.ENDED) {
      return;
    }
    setErrorMessage("");
    announce(t.liveSession.noSpeechDetected);
    setPhase(LIVE_PHASE.LISTENING);
    scheduleNextListening();
  }, [announce, scheduleNextListening, setPhase, t.liveSession.noSpeechDetected]);

  const finalizeTurnFromTranscript = useCallback(
    async ({
      originalTranscript,
      detectedLanguage,
      confidence,
      activeSession = sessionRef.current,
      fallbackSpeaker = speakerRef.current,
    }) => {
      if (processingRef.current) return;
      if (!activeSession?.sessionId || activeSession.status === SESSION_STATUS_ENDED) {
        return;
      }

      const cleanedTranscript = String(originalTranscript || "").trim();
      if (!cleanedTranscript) {
        showError(t.liveSession.noTranscriptResult);
        return;
      }

      processingRef.current = true;
      setDraftTranscript("");
      setErrorMessage("");
      setExportMessage("");
      setLastPlaybackRequest(null);

      const runToken = runTokenRef.current;
      const isFirstTurn = (activeSession.turns?.length || 0) === 0;
      const shouldAutoDetectSpeaker =
        String(activeSession.patientLanguage || "").trim().toLowerCase() !==
        String(activeSession.doctorLanguage || "").trim().toLowerCase();

      try {
        const resolvedSpeaker = isFirstTurn
          ? shouldAutoDetectSpeaker
            ? detectSpeakerFromLanguage(
                detectedLanguage,
                cleanedTranscript,
                activeSession,
                fallbackSpeaker,
              )
            : fallbackSpeaker
          : fallbackSpeaker;
        const { sourceLanguage, targetLanguage } = languagesForSpeaker(
          activeSession,
          resolvedSpeaker,
        );
        setActiveSpeaker(resolvedSpeaker);

        const createdTurn = addTurn(activeSession.sessionId, {
          speaker: resolvedSpeaker,
          speakerLabel: speakerLabelFor(resolvedSpeaker, t),
          sourceLanguage,
          targetLanguage,
          originalText: cleanedTranscript,
          originalTranscript: cleanedTranscript,
          confidence:
            confidence === "high" ? "high" : confidence ? "low" : undefined,
          timestamp: new Date().toISOString(),
          status: TURN_STATUS_TRANSCRIBED,
        });

        if (!createdTurn) {
          showError(t.errors.generic);
          return;
        }

        reloadSession();

        setPhase(LIVE_PHASE.TRANSLATING);
        announce(t.liveSession.statusTranslating);
        const translateController = new AbortController();
        translateAbortRef.current = translateController;
        const translationResult = await translateLiveTurn(
          {
            text: cleanedTranscript,
            sourceLanguage,
            targetLanguage,
            speaker: resolvedSpeaker,
          },
          { signal: translateController.signal },
        );
        translateAbortRef.current = null;

        if (runToken !== runTokenRef.current) return;
        if (!translationResult.ok) {
          if (translationResult.code === "cancelled") return;
          updateTurn(activeSession.sessionId, createdTurn.turnId, {
            status: TURN_STATUS_ERROR,
          });
          reloadSession();
          showError(
            interpreterErrorMessage(
              translationResult.code,
              t,
              translationResult.message,
            ),
          );
          return;
        }

        updateTurn(activeSession.sessionId, createdTurn.turnId, {
          translatedText: translationResult.translatedText,
          translationDirection: translationResult.translationDirection,
          confidence:
            translationResult.confidence === "high"
              ? "high"
              : translationResult.confidence
                ? "low"
                : createdTurn.confidence,
          status: TURN_STATUS_TRANSLATED,
        });
        reloadSession();

        setPhase(LIVE_PHASE.SPEAKING_TRANSLATION);
        announce(t.liveSession.statusSpeaking);
        const speechResult = await playText({
          text: translationResult.translatedText,
          language: targetLanguage,
          target: "translation",
          useStreamEndpoint: true,
          awaitEnd: true,
          voiceProfile: INTERPRETER_VOICE_PROFILE,
          voiceSpeed,
        });

        if (runToken !== runTokenRef.current) return;
        if (!speechResult.ok) {
          updateTurn(activeSession.sessionId, createdTurn.turnId, {
            status: TURN_STATUS_TRANSLATED,
          });
          reloadSession();
          showError(interpreterErrorMessage(speechResult.code, t, speechResult.message));
          return;
        }

        updateTurn(activeSession.sessionId, createdTurn.turnId, {
          status: TURN_STATUS_SPOKEN,
        });
        setLastPlaybackRequest({
          text: translationResult.translatedText,
          language: targetLanguage,
          target: "translation",
          awaitEnd: true,
          voiceProfile: INTERPRETER_VOICE_PROFILE,
          voiceSpeed,
        });
        updateSessionMetadata(activeSession.sessionId, {
          status: SESSION_STATUS_ACTIVE,
        });
        reloadSession();
        setActiveSpeaker(oppositeSpeaker(resolvedSpeaker));
        await playInterpreterTurnSignal();
        await waitForHandoff();
        setPhase(LIVE_PHASE.LISTENING);
        announce(
          resolvedSpeaker === SPEAKER_PATIENT
            ? t.liveSession.readyForDoctor
            : t.liveSession.readyForPatient,
        );
        scheduleNextListening();
      } finally {
        processingRef.current = false;
      }
    },
    [
      announce,
      playText,
      reloadSession,
      scheduleNextListening,
      setActiveSpeaker,
      setPhase,
      showError,
      t,
      translateLiveTurn,
      voiceSpeed,
    ],
  );

  const processRecordedSegment = useCallback(
    async ({ blob, mimeType }) => {
      if (processingRef.current) return;
      const activeSession = sessionRef.current;
      if (!activeSession?.sessionId || activeSession.status === SESSION_STATUS_ENDED) {
        return;
      }

      processingRef.current = true;
      setErrorMessage("");
      setExportMessage("");
      setLastPlaybackRequest(null);
      setDraftTranscript("");
      const runToken = runTokenRef.current;
      const fallbackSpeaker = speakerRef.current;
      const shouldAutoDetectSpeaker =
        String(activeSession.patientLanguage || "").trim().toLowerCase() !==
        String(activeSession.doctorLanguage || "").trim().toLowerCase();

      try {
        const silenceCheck = await detectLikelySilentBlob(blob);
        if (runToken !== runTokenRef.current) return;
        if (silenceCheck.silent) {
          announce(t.liveSession.noSpeechDetected);
          setPhase(LIVE_PHASE.LISTENING);
          scheduleNextListening();
          return;
        }

        setPhase(LIVE_PHASE.TRANSCRIBING);
        announce(t.liveSession.statusTranscribing);
        const transcribeController = new AbortController();
        transcribeAbortRef.current = transcribeController;
        const transcriptResult = await transcribeAudio(blob, {
          filename: mimeType?.includes("ogg") ? "utterance.ogg" : "utterance.webm",
          language: shouldAutoDetectSpeaker
            ? undefined
            : activeSession.patientLanguage,
          signal: transcribeController.signal,
        });
        transcribeAbortRef.current = null;

        if (runToken !== runTokenRef.current) return;
        if (!transcriptResult.ok) {
          if (transcriptResult.code === "cancelled") return;
          showError(interpreterErrorMessage(transcriptResult.code, t, transcriptResult.message));
          return;
        }

        const originalTranscript = String(transcriptResult.transcript || "").trim();
        if (runToken !== runTokenRef.current) return;
        processingRef.current = false;
        await finalizeTurnFromTranscript({
          originalTranscript,
          detectedLanguage: transcriptResult.language,
          confidence: transcriptResult.confidence,
          activeSession,
          fallbackSpeaker,
        });
      } finally {
        processingRef.current = false;
      }
    },
    [announce, finalizeTurnFromTranscript, scheduleNextListening, setPhase, showError, t],
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
      announce(t.liveSession.statusListening);
    },
    onSilencePhaseChange: handlePhaseFromSilence,
    onRecorded: processRecordedSegment,
  });

  const liveLoopBusy =
    isRecording ||
    isPreparing ||
    isStopping ||
    processingRef.current ||
    isSpeakLoading ||
    isSpeakPlaying;

  const resumeListeningIfNeeded = useCallback(() => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }
    if (
      !loopEnabledRef.current ||
      !sessionRef.current?.sessionId ||
      sessionRef.current.status === SESSION_STATUS_ENDED ||
      phaseRef.current === LIVE_PHASE.PAUSED ||
      phaseRef.current === LIVE_PHASE.ENDED ||
      phaseRef.current === LIVE_PHASE.ERROR ||
      isPreparing ||
      isRecording ||
      isStopping ||
      isSpeakLoading ||
      isSpeakPlaying ||
      processingRef.current
    ) {
      return;
    }

    if (
      phaseRef.current === LIVE_PHASE.IDLE ||
      phaseRef.current === LIVE_PHASE.SILENCE_WAITING
    ) {
      setPhase(LIVE_PHASE.LISTENING);
    }
    scheduleNextListening();
  }, [
    isPreparing,
    isRecording,
    isSpeakLoading,
    isSpeakPlaying,
    isStopping,
    scheduleNextListening,
    setPhase,
  ]);

  const startRecordingRef = useRef(startRecording);
  useEffect(() => {
    startRecordingRef.current = async () => {
      if (
        !loopEnabledRef.current ||
        !sessionRef.current?.sessionId ||
        processingRef.current ||
        phaseRef.current === LIVE_PHASE.PAUSED ||
        phaseRef.current === LIVE_PHASE.ENDED
      ) {
        return false;
      }
      clearRecorderError();
      setErrorMessage("");
      const started = await startRecording();
      if (!started && recorderError) {
        if (recorderError === "too_short") {
          recoverFromShortRecording();
          return false;
        }
        showError(
          recorderError === "mic_denied"
            ? t.pushToTalk.micDenied
            : recorderError === "too_short"
              ? t.pushToTalk.tooShort
              : t.errors.generic,
        );
      }
      return started;
    };
  }, [
    clearRecorderError,
    isSpeakLoading,
    isSpeakPlaying,
    recorderError,
    recoverFromShortRecording,
    showError,
    startRecording,
    t,
  ]);

  useEffect(() => {
    startListeningRef.current = async () => {
      if (
        !sessionRef.current?.sessionId ||
        processingRef.current ||
        phaseRef.current === LIVE_PHASE.PAUSED ||
        phaseRef.current === LIVE_PHASE.ENDED
      ) {
        return false;
      }
      setDraftTranscript("");
      return startRecordingRef.current?.();
    };
  }, []);

  useEffect(() => {
    clearListeningWatchdog();
    if (
      phase !== LIVE_PHASE.LISTENING ||
      !session?.sessionId ||
      session.status === SESSION_STATUS_ENDED ||
      isRecording ||
      isPreparing ||
      isStopping ||
      isSpeakLoading ||
      isSpeakPlaying ||
      processingRef.current
    ) {
      return undefined;
    }

    listeningWatchdogTimerRef.current = setTimeout(() => {
      if (
        phaseRef.current !== LIVE_PHASE.LISTENING ||
        isRecording ||
        isPreparing ||
        isStopping ||
        isSpeakLoading ||
        isSpeakPlaying ||
        processingRef.current
      ) {
        return;
      }
      scheduleNextListening();
    }, LISTENING_WATCHDOG_DELAY_MS);

    return () => {
      clearListeningWatchdog();
    };
  }, [
    clearListeningWatchdog,
    isPreparing,
    isRecording,
    isSpeakLoading,
    isSpeakPlaying,
    isStopping,
    phase,
    scheduleNextListening,
    session,
  ]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        resumeListeningIfNeeded();
      }
    };
    const handleFocus = () => {
      resumeListeningIfNeeded();
    };
    const handlePageShow = () => {
      resumeListeningIfNeeded();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [resumeListeningIfNeeded]);

  const handleStartConversation = useCallback(async () => {
    const current = reloadSession();
    const nextSpeaker = current ? nextExpectedSpeakerFromSession(current) : SPEAKER_PATIENT;
    loopEnabledRef.current = true;
    if (current?.sessionId) {
      const activeSession = updateSessionMetadata(current.sessionId, {
        status: SESSION_STATUS_ACTIVE,
      });
      if (activeSession) {
        setSession(activeSession);
        sessionRef.current = activeSession;
      }
    }
    setActiveSpeaker(nextSpeaker);
    setPdfReady(false);
    setExportMessage("");
    setErrorMessage("");
    setDraftTranscript("");
    setPhase(LIVE_PHASE.IDLE);
    await playInterpreterTurnSignal();
    await waitForHandoff(120);
    announce(
      current?.turns?.length
        ? nextSpeaker === SPEAKER_DOCTOR
          ? t.liveSession.readyForDoctor
          : t.liveSession.readyForPatient
        : t.liveSession.readyForEither,
    );
    const started = await startListeningRef.current?.();
    if (!started) {
      scheduleNextListening();
    }
  }, [
    announce,
    reloadSession,
    scheduleNextListening,
    setActiveSpeaker,
    setPhase,
    t.liveSession.readyForDoctor,
    t.liveSession.readyForEither,
    t.liveSession.readyForPatient,
  ]);

  const handleEndConversation = useCallback(() => {
    loopEnabledRef.current = false;
    stopRuntime();
    cancelRecording();
    const current = sessionRef.current;
    if (!current?.sessionId) return;
    const ended = endSession(current.sessionId, t, uiLanguage);
    setSession(ended);
    sessionRef.current = ended;
    setPdfReady(Boolean(ended?.turns?.length));
    setPhase(LIVE_PHASE.ENDED);
    announce(t.sessionActions.ended);
  }, [announce, cancelRecording, stopRuntime, t, uiLanguage, setPhase]);

  const handleDownloadPdf = useCallback(() => {
    const current = reloadSession();
    if (!current) return;
    const title = getSessionDisplayTitle(current, t, uiLanguage);
    const result = downloadInterpreterSessionPdf(current, title, t);
    setExportMessage(result.ok ? t.pdf.exportSuccess : t.pdf.exportFailed);
  }, [reloadSession, t, uiLanguage]);

  const handleReplayLastTranslation = useCallback(async () => {
    if (!lastPlaybackRequest || isSpeakLoading || isSpeakPlaying) return;
    setErrorMessage("");
    setExportMessage("");
    const replayResult = await playText({
      ...lastPlaybackRequest,
      voiceProfile: INTERPRETER_VOICE_PROFILE,
      voiceSpeed,
    });
    if (!replayResult.ok && replayResult.code !== "cancelled") {
      showError(interpreterErrorMessage(replayResult.code, t, replayResult.message));
    }
  }, [
    isSpeakLoading,
    isSpeakPlaying,
    lastPlaybackRequest,
    playText,
    showError,
    t,
    voiceSpeed,
  ]);

  useEffect(() => {
    if (!session?.sessionId) return;
    document.title = t.room.pageTitle;
  }, [session, t.room.pageTitle]);

  useEffect(() => {
    if (!recorderError) return;
    if (recorderError === "mic_denied") {
      showError(t.pushToTalk.micDenied);
    } else if (recorderError === "too_short") {
      recoverFromShortRecording();
    } else {
      showError(t.errors.generic);
    }
  }, [recorderError, recoverFromShortRecording, showError, t]);

  useEffect(() => {
    return () => {
      stopRuntime();
      cancelRecording();
    };
  }, [cancelRecording, stopRuntime]);

  const content = (
    <>
      {!hideBackLink ? (
        <Link className="medical-interpreter-page__back" to={homePath}>
          {t.chrome.backToInterpreterHome}
        </Link>
      ) : null}

      {showHeader ? (
        <header className="interpreter-live-shell__header">
          <div>
            <h1 className="medical-interpreter-page__title">{t.room.heading}</h1>
          </div>
          <div className="interpreter-live-shell__pair" aria-label={t.liveSession.languagePairLabel}>
            {languagePairLabel}
          </div>
        </header>
      ) : null}

      <section
        className={`interpreter-live-shell__controls${embedded ? " interpreter-live-shell__controls--embedded" : ""}`}
        aria-labelledby="interp-live-controls"
      >
        <div className="interpreter-status-bar interpreter-status-bar--busy" role="status" aria-live="polite">
          <strong>{t.liveSession.statusLabel}</strong> {statusText}
        </div>
        <div className="interpreter-live-shell__status-detail">
          <span className="interpreter-live-shell__status-chip interpreter-live-shell__status-chip--speaker">
            {activeSpeakerLabel}
          </span>
          <span className="interpreter-live-shell__status-chip interpreter-live-shell__status-chip--direction">
            {currentDirectionLabel}
          </span>
        </div>
        <div
          className={`interpreter-live-shell__turn-banner${phase === LIVE_PHASE.SPEAKING_TRANSLATION ? " interpreter-live-shell__turn-banner--busy" : ""}`}
          role="status"
          aria-live="polite"
        >
          <p className="interpreter-live-shell__turn-banner-label">{t.liveSession.statusLabel}</p>
          <p className="interpreter-live-shell__turn-banner-text">{turnPrompt}</p>
        </div>
        {draftTranscript ? (
          <div className="interpreter-live-shell__draft" role="status" aria-live="polite">
            <p className="interpreter-live-shell__draft-label">
              {t.liveSession.livePreviewLabel}
            </p>
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
            onClick={handleStartConversation}
            disabled={
              liveLoopBusy ||
              phase === LIVE_PHASE.ENDED
            }
          >
                {t.liveSession.startButton}
              </button>
              <button
                type="button"
                className="medical-interpreter-page__nav-link interpreter-live__action-danger interpreter-live-shell__action"
                onClick={handleEndConversation}
                disabled={phase === LIVE_PHASE.ENDED}
              >
                {t.sessionActions.end}
              </button>
            </div>
          </div>

          <div className="interpreter-live-shell__playback-panel">
            <h3 className="interpreter-live-shell__playback-heading">
              {t.liveSession.playbackHeading}
            </h3>
            <div
              className="interpreter-live-shell__speed-toggle"
              role="group"
              aria-label={t.liveSession.speedHeading}
            >
              <button
                type="button"
                className={`interpreter-live-shell__speed-option${voiceSpeed === "normal" ? " interpreter-live-shell__speed-option--active" : ""}`}
                aria-pressed={voiceSpeed === "normal"}
                onClick={() => setVoiceSpeed("normal")}
              >
                {t.liveSession.speedNormal}
              </button>
              <button
                type="button"
                className={`interpreter-live-shell__speed-option${voiceSpeed === "slow" ? " interpreter-live-shell__speed-option--active" : ""}`}
                aria-pressed={voiceSpeed === "slow"}
                onClick={() => setVoiceSpeed("slow")}
              >
                {t.liveSession.speedSlow}
              </button>
            </div>

            <InterpreterPlaybackStatus
              visible
              isLoading={isSpeakLoading}
              isPlaying={isSpeakPlaying}
              onStop={stopAllPlayback}
              labels={t}
            />

            <div className="interpreter-live-shell__playback-actions">
              <button
                type="button"
                className="medical-interpreter-page__nav-link interpreter-live-shell__playback-action"
                onClick={handleReplayLastTranslation}
                disabled={!lastPlaybackRequest || liveLoopBusy}
              >
                {t.liveSession.replayButton}
              </button>
              <button
                type="button"
                className="medical-interpreter-page__nav-link interpreter-live-shell__playback-action"
                onClick={stopAllPlayback}
                disabled={!isSpeakLoading && !isSpeakPlaying}
              >
                {t.liveSession.stopPlaybackButton}
              </button>
            </div>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div
          ref={alertRef}
          className="interpreter-feedback interpreter-feedback--error"
          role="alert"
          tabIndex={-1}
        >
          {errorMessage}
        </div>
      ) : null}

      {exportMessage ? (
        <div className="interpreter-feedback" role="status" aria-live="polite">
          {exportMessage}
        </div>
      ) : null}

      <div className="sr-only" role="status" aria-live="polite">
        {liveAnnouncement || statusText}
      </div>

      {showConversation ? (
        <section className="interpreter-live-shell__conversation" aria-labelledby="interp-live-conversation">
          <div className="interpreter-live-shell__conversation-head">
            <h2 id="interp-live-conversation" className="interpreter-live-shell__section-title">
              {t.review.timelineHeading}
            </h2>
            {pdfReady ? (
              <button
                type="button"
                className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
                onClick={handleDownloadPdf}
              >
                {t.sessionActions.export}
              </button>
            ) : null}
          </div>

          {hasTurns ? (
            <ol
              className="interpreter-live-shell__turn-list"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {turns.map((turn) => {
                const turnSpeakerLabel =
                  turn.speakerLabel || speakerLabelFor(turn.speaker, t);
                const timeLabel = formatTurnTime(
                  turn.timestamp || turn.createdAt,
                  uiLanguage,
                );
                const translationHeading =
                  turn.speaker === SPEAKER_DOCTOR
                    ? t.liveSession.translationForPatient
                    : t.liveSession.translationForDoctor;

                return (
                  <li key={turn.turnId} className="interpreter-live-shell__turn-card">
                    <div className="interpreter-live-shell__turn-top">
                      <div>
                        <strong>{turnSpeakerLabel}</strong>
                        <span className="interpreter-live-shell__turn-time">
                          {timeLabel}
                        </span>
                      </div>
                      <span
                        className={`interpreter-live-shell__turn-status ${turnStatusClassName(turn.status)}`}
                      >
                        {turnStatusLabel(turn, t)}
                      </span>
                    </div>

                    <div className="interpreter-live-shell__turn-block">
                      <p className="interpreter-live-shell__turn-label">
                        {t.liveSession.originalLabel}
                      </p>
                      <p className="interpreter-live-shell__turn-text">
                        {turn.originalTranscript || turn.originalText}
                      </p>
                    </div>

                    <div className="interpreter-live-shell__turn-block">
                      <p className="interpreter-live-shell__turn-label">
                        {translationHeading}
                      </p>
                      <p className="interpreter-live-shell__turn-text">
                        {turn.translatedText || t.liveSession.pendingTranslation}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="interpreter-empty-state">{t.liveSession.noConversationYet}</p>
          )}
        </section>
      ) : null}
    </>
  );

  if (embedded) {
    return <section className="interpreter-live-shell interpreter-live-shell--embedded">{content}</section>;
  }

  return (
    <main
      className="medical-interpreter-page medical-interpreter-page--live interp-root"
      id="main-content"
    >
      {content}
    </main>
  );
}
