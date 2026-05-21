import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  interpreterErrorMessage,
  simplifyTurn,
  transcribeAudio,
  translateTurn,
} from "../api/interpreterApi.js";
import { useInterpreterRecorder } from "../hooks/useInterpreterRecorder.js";
import { useInterpreterTtsPlayback } from "../hooks/useInterpreterTtsPlayback.js";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_ENDED,
  SPEAKER_PATIENT,
  TURN_STATUS_BLOCKED,
  TURN_STATUS_CONFIRMED,
  TURN_STATUS_DRAFT,
  TURN_STATUS_ERROR,
  TURN_STATUS_TRANSLATED,
} from "../constants.js";
import {
  addTurn,
  deleteSession,
  deleteTurn,
  endSession,
  maybeApplyAutoSessionTitle,
  getCurrentSession,
  hasPendingDraftTurn,
  updateSessionMetadata,
  updateTurn,
} from "../store/interpreterSessionStore.js";
import { useInterpreterDraftGuard } from "../hooks/useInterpreterDraftGuard.js";
import InterpreterConfirmDialog from "./InterpreterConfirmDialog.jsx";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { INTERPRETER_TRANSCRIBE_RETRY_DELAY_MS } from "../utils/interpreterAudioConstants.js";
import { detectLikelySilentBlob } from "../utils/interpreterAudioLevel.js";
import {
  derivePttPhase,
  isPttCaptureActive,
  pttPhaseStatusLabel,
  PTT_PHASE,
} from "../utils/interpreterPttPhase.js";
import { INTERPRETER_REQUEST_RETRY_DELAY_MS } from "../utils/interpreterReliabilityConstants.js";
import { languagesForSpeaker } from "../utils/liveLanguages.js";
import { sessionIsMixedDirection } from "../utils/interpreterLocale.js";
import { isRetryableInterpreterCode } from "../utils/interpreterRetry.js";
import { useMountedRef } from "../hooks/useMountedRef.js";
import { useInterpreterConnectivity } from "../hooks/useInterpreterConnectivity.js";
import InterpreterConnectivityBanner from "./InterpreterConnectivityBanner.jsx";
import InterpreterRecoveryBanner from "./InterpreterRecoveryBanner.jsx";
import InterpreterLiveHeader from "./InterpreterLiveHeader.jsx";
import InterpreterSpeakerToggle from "./InterpreterSpeakerToggle.jsx";
import InterpreterPushToTalkPanel from "./InterpreterPushToTalkPanel.jsx";
import InterpreterTranscriptPanel from "./InterpreterTranscriptPanel.jsx";
import InterpreterTranslationPanel from "./InterpreterTranslationPanel.jsx";
import InterpreterSimplifiedPanel from "./InterpreterSimplifiedPanel.jsx";
import InterpreterSessionActions from "./InterpreterSessionActions.jsx";
import InterpreterStreamingPanel from "./InterpreterStreamingPanel.jsx";
import InterpreterNearRealtimePreviewPanel from "./InterpreterNearRealtimePreviewPanel.jsx";
import { useInterpreterStreamCapture } from "../hooks/useInterpreterStreamCapture.js";
import { useInterpreterNearRealtimePreview } from "../hooks/useInterpreterNearRealtimePreview.js";
import { useInterpreterServerStatus } from "../hooks/useInterpreterServerStatus.js";
import {
  isStreamingSttClientEnabled,
} from "../config/isStreamingSttEnabled.js";
import { isNearRealtimeTranslationClientEnabled } from "../config/isNearRealtimeTranslationEnabled.js";
import { isStreamingTtsClientEnabled } from "../config/isStreamingTtsEnabled.js";
import InterpreterPlaybackStatus from "./InterpreterPlaybackStatus.jsx";

/** @param {string | undefined} apiConfidence */
function mapTranscribeConfidence(apiConfidence) {
  if (apiConfidence === "high") return "high";
  if (apiConfidence === "medium" || apiConfidence === "low") return "low";
  return undefined;
}

/**
 * @param {'mic_denied'|'mic_unavailable'|'too_short'} code
 * @param {object} t
 */
function recorderErrorMessage(code, t) {
  if (code === "mic_denied") return t.pushToTalk.micDenied;
  if (code === "too_short") return t.pushToTalk.tooShort;
  return t.errors.generic;
}

export default function InterpreterLiveRoom() {
  const t = useMedicalInterpreterMessages();
  const { language: uiLanguage } = useLanguage();
  const navigate = useNavigate();
  const errorAlertRef = useRef(null);
  const transcriptRef = useRef(null);
  const mountedRef = useMountedRef();
  const transcribeInFlightRef = useRef(false);
  const translateInFlightRef = useRef(false);
  const simplifyInFlightRef = useRef(false);
  const sessionActionInFlightRef = useRef(false);
  const transcribeAbortRef = useRef(null);
  const translateAbortRef = useRef(null);
  const simplifyAbortRef = useRef(null);
  const connectivity = useInterpreterConnectivity();
  const serverStatus = useInterpreterServerStatus();
  const streamingFeatureAvailable =
    isStreamingSttClientEnabled() && serverStatus.streamingSttEnabled === true;
  const nearRealtimeFeatureAvailable =
    isNearRealtimeTranslationClientEnabled() &&
    serverStatus.nearRealtimeTranslationEnabled === true &&
    streamingFeatureAvailable;
  const streamingTtsFeatureAvailable =
    isStreamingTtsClientEnabled() &&
    serverStatus.streamingTtsEnabled === true &&
    serverStatus.ttsEnabled === true;

  const [session, setSession] = useState(() => getCurrentSession());
  const [previewPlaybackEnabled, setPreviewPlaybackEnabled] = useState(false);
  const [speaker, setSpeaker] = useState(SPEAKER_PATIENT);
  const [activeTurnId, setActiveTurnId] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [maxDurationReached, setMaxDurationReached] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [liveMessage, setLiveMessage] = useState("");
  /** @type {'translate'|'simplify'|null} */
  const [recoveryAction, setRecoveryAction] = useState(null);
  const [sessionActionBusy, setSessionActionBusy] = useState(false);

  const reloadSession = useCallback(() => {
    const next = getCurrentSession();
    if (mountedRef.current) setSession(next);
    return next;
  }, [mountedRef]);

  const announceError = useCallback(
    (message) => {
      if (!mountedRef.current) return;
      setErrorMessage(message);
      requestAnimationFrame(() => {
        if (mountedRef.current) errorAlertRef.current?.focus();
      });
    },
    [mountedRef],
  );

  const announceStatus = useCallback(
    (message) => {
      if (!mountedRef.current) return;
      setLiveMessage("");
      requestAnimationFrame(() => {
        if (mountedRef.current) setLiveMessage(message);
      });
    },
    [mountedRef],
  );

  const abortAllRequests = useCallback(() => {
    transcribeAbortRef.current?.abort();
    translateAbortRef.current?.abort();
    simplifyAbortRef.current?.abort();
  }, []);

  const {
    activeTarget: speakTarget,
    playText: playSpeakText,
    stopAllPlayback,
    retryPlayback,
    lastErrorCode: speakLastErrorCode,
    isLoading: isSpeakLoading,
    isPlaying: isSpeakPlaying,
  } = useInterpreterTtsPlayback({
    streamSpeakEnabled: streamingTtsFeatureAvailable,
  });

  const runTranscribe = useCallback(
    async (blob, mimeType, sessionSnapshot, speakerSnapshot, signal) => {
      const langs = languagesForSpeaker(sessionSnapshot, speakerSnapshot);
      const filename = mimeType?.includes("mp4")
        ? "recording.m4a"
        : mimeType?.includes("ogg")
          ? "recording.ogg"
          : "recording.webm";

      let result = await transcribeAudio(blob, {
        language: langs.sourceLanguage,
        filename,
        signal,
      });

      if (
        !result.ok &&
        result.code === "network" &&
        !signal.aborted &&
        typeof navigator !== "undefined" &&
        navigator.onLine !== false
      ) {
        await new Promise((resolve) => {
          setTimeout(resolve, INTERPRETER_TRANSCRIBE_RETRY_DELAY_MS);
        });
        if (!signal.aborted) {
          result = await transcribeAudio(blob, {
            language: langs.sourceLanguage,
            filename,
            signal,
          });
        }
      }

      return result;
    },
    [],
  );

  const handleRecorded = useCallback(
    async ({ blob, mimeType }) => {
      const current = getCurrentSession();
      if (
        !current ||
        transcribeInFlightRef.current ||
        translateInFlightRef.current ||
        simplifyInFlightRef.current
      ) {
        return;
      }

      if (!connectivity.isOnline) {
        announceError(t.errors.offline);
        return;
      }

      const silence = await detectLikelySilentBlob(blob);
      if (silence.silent && !silence.skipped) {
        announceError(t.pushToTalk.likelySilent);
        return;
      }

      transcribeInFlightRef.current = true;
      transcribeAbortRef.current?.abort();
      transcribeAbortRef.current = new AbortController();
      const { signal } = transcribeAbortRef.current;

      if (mountedRef.current) {
        setIsTranscribing(true);
        setErrorMessage(null);
        setRecoveryAction(null);
        setMaxDurationReached(false);
      }
      announceStatus(t.room.statusTranscribing);

      try {
        const result = await runTranscribe(blob, mimeType, current, speaker, signal);
        if (!mountedRef.current) return;

        if (!result.ok) {
          if (result.code === "cancelled" || result.code === "generic") return;
          if (result.code === "validation") {
            announceError(t.pushToTalk.tooShort);
            return;
          }
          announceError(
            interpreterErrorMessage(result.code, t, result.message),
          );
          return;
        }

        const transcript = result.transcript.trim();
        if (!transcript) {
          announceError(t.pushToTalk.tooShort);
          return;
        }

        const langs = languagesForSpeaker(current, speaker);
        const turn = addTurn(current.sessionId, {
          speaker,
          sourceLanguage: langs.sourceLanguage,
          targetLanguage: langs.targetLanguage,
          originalText: transcript,
          status: TURN_STATUS_DRAFT,
          confidence: mapTranscribeConfidence(result.confidence),
        });

        if (turn) {
          setActiveTurnId(turn.turnId);
          setDraftText(transcript);
          reloadSession();
          announceStatus(t.room.statusEditingDraft);
          requestAnimationFrame(() => {
            if (mountedRef.current) transcriptRef.current?.focus();
          });
        }
      } finally {
        transcribeInFlightRef.current = false;
        if (mountedRef.current) setIsTranscribing(false);
      }
    },
    [
      speaker,
      t,
      reloadSession,
      announceError,
      announceStatus,
      runTranscribe,
      connectivity.isOnline,
      mountedRef,
    ],
  );

  const streamCapture = useInterpreterStreamCapture({
    languageHint: session
      ? languagesForSpeaker(session, speaker).sourceLanguage
      : undefined,
    onStatusMessage: (msg) => {
      const labels = {
        streaming: t.streaming.statusConnected,
        finalizing: t.streaming.statusFinalizing,
        max_duration: t.streaming.maxDurationReached,
      };
      const text = labels[msg] || (typeof msg === "string" ? msg : "");
      if (text) announceStatus(text);
    },
    onError: (code) => {
      const message =
        code === "mic_denied"
          ? t.pushToTalk.micDenied
          :         code === "unsupported_browser"
            ? t.streaming.unsupportedBrowser
            : code === "stream_backpressure"
              ? t.streaming.backpressureError
              : t.streaming.errorGeneric;
      announceError(message);
    },
  });

  const {
    isPreparing,
    isRecording,
    isStopping,
    isBusy: recorderBusy,
    recorderError,
    clearRecorderError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useInterpreterRecorder({
    onRecorded: handleRecorded,
    onMaxDuration: () => setMaxDurationReached(true),
    onRecordingStart: () => {
      setMaxDurationReached(false);
      stopAllPlayback();
      announceStatus(t.room.statusRecording);
    },
  });

  useEffect(() => {
    const current = getCurrentSession();
    if (
      current &&
      current.status !== SESSION_STATUS_ENDED &&
      current.status !== SESSION_STATUS_ACTIVE
    ) {
      updateSessionMetadata(current.sessionId, { status: SESSION_STATUS_ACTIVE });
      reloadSession();
    }
  }, [reloadSession]);

  useEffect(() => {
    if (recorderError) {
      announceError(recorderErrorMessage(recorderError, t));
    }
  }, [recorderError, t, announceError]);

  useEffect(() => {
    if (!connectivity.showOfflineBanner) return;
    abortAllRequests();
    cancelRecording();
    void streamCapture.cancelStream();
    stopAllPlayback();
    if (mountedRef.current) {
      setIsTranscribing(false);
      setIsTranslating(false);
      setIsSimplifying(false);
    }
    transcribeInFlightRef.current = false;
    translateInFlightRef.current = false;
    simplifyInFlightRef.current = false;
  }, [
    connectivity.showOfflineBanner,
    abortAllRequests,
    cancelRecording,
    streamCapture,
    stopAllPlayback,
    mountedRef,
  ]);

  useEffect(() => {
    if (!connectivity.showReconnectedBanner || !mountedRef.current) return;
    setErrorMessage(null);
  }, [connectivity.showReconnectedBanner, mountedRef]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") reloadSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reloadSession]);

  const displayTurn = useMemo(() => {
    if (!session?.turns?.length) return null;
    if (activeTurnId) {
      return session.turns.find((turn) => turn.turnId === activeTurnId) ?? null;
    }
    return session.turns[session.turns.length - 1];
  }, [session, activeTurnId]);

  useEffect(() => {
    if (displayTurn?.status === TURN_STATUS_DRAFT) {
      setDraftText(displayTurn.originalText || "");
    } else if (displayTurn) {
      setDraftText(displayTurn.originalText || "");
    }
  }, [displayTurn]);

  useEffect(() => {
    if (!session?.sessionId || !displayTurn || displayTurn.status !== TURN_STATUS_DRAFT) {
      return undefined;
    }
    const stored = (displayTurn.originalText || "").trim();
    const next = draftText.trim();
    if (next === stored) return undefined;
    const timer = window.setTimeout(() => {
      updateTurn(session.sessionId, displayTurn.turnId, { originalText: draftText });
      reloadSession();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftText, displayTurn, session?.sessionId, reloadSession]);

  const sessionEnded = session?.status === SESSION_STATUS_ENDED;
  const hasDraftTurn = displayTurn?.status === TURN_STATUS_DRAFT;

  const streamLangs = session
    ? languagesForSpeaker(session, speaker)
    : { sourceLanguage: undefined, targetLanguage: undefined };

  const streamSourceStable =
    streamCapture.phase !== "connecting" && streamCapture.phase !== "finalizing";

  const nearRealtimePreview = useInterpreterNearRealtimePreview({
    enabled:
      nearRealtimeFeatureAvailable &&
      Boolean(streamCapture.previewText.trim()) &&
      !hasDraftTurn,
    sourceText: streamCapture.previewText,
    sourceLanguage: streamLangs.sourceLanguage,
    targetLanguage: streamLangs.targetLanguage,
    speaker,
    isSourceStable: streamSourceStable,
    onError: () => {
      announceError(t.nearRealtime.errorGeneric);
    },
  });

  useEffect(() => {
    return () => {
      abortAllRequests();
      cancelRecording();
      void streamCapture.cancelStream();
      stopAllPlayback();
      nearRealtimePreview.discardPreview();
      transcribeInFlightRef.current = false;
      translateInFlightRef.current = false;
      simplifyInFlightRef.current = false;
    };
  }, [
    abortAllRequests,
    cancelRecording,
    streamCapture,
    stopAllPlayback,
    nearRealtimePreview,
  ]);

  const draftPending =
    !sessionEnded &&
    hasDraftTurn &&
    Boolean(draftText.trim());

  const discardActiveDraft = useCallback(() => {
    if (!session?.sessionId || !displayTurn || displayTurn.status !== TURN_STATUS_DRAFT) {
      return;
    }
    deleteTurn(session.sessionId, displayTurn.turnId);
    setActiveTurnId(null);
    setDraftText("");
    reloadSession();
  }, [session?.sessionId, displayTurn, reloadSession]);

  const flushDraftToStore = useCallback(() => {
    if (!session?.sessionId || !displayTurn || displayTurn.status !== TURN_STATUS_DRAFT) {
      return;
    }
    const trimmed = draftText.trim();
    if (!trimmed) return;
    updateTurn(session.sessionId, displayTurn.turnId, { originalText: draftText });
  }, [session?.sessionId, displayTurn, draftText]);

  const {
    dialogOpen: leaveDialogOpen,
    cancelLeave,
    confirmLeave: confirmLeaveBase,
  } = useInterpreterDraftGuard(draftPending, discardActiveDraft, flushDraftToStore);

  const confirmLeave = useCallback(() => {
    void streamCapture.cancelStream();
    cancelRecording();
    stopAllPlayback();
    nearRealtimePreview.discardPreview();
    setPreviewPlaybackEnabled(false);
    confirmLeaveBase();
  }, [
    streamCapture,
    cancelRecording,
    stopAllPlayback,
    nearRealtimePreview,
    confirmLeaveBase,
  ]);

  const pttPhase = useMemo(
    () =>
      derivePttPhase({
        sessionEnded,
        isPreparing,
        isRecording,
        isStopping,
        isTranscribing,
        isTranslating,
        isSimplifying,
        turnStatus: displayTurn?.status,
      }),
    [
      sessionEnded,
      isPreparing,
      isRecording,
      isStopping,
      isTranscribing,
      isTranslating,
      isSimplifying,
      displayTurn?.status,
    ],
  );

  const streamActive = streamCapture.isActive;

  const busy =
    isPttCaptureActive(pttPhase) ||
    pttPhase === PTT_PHASE.TRANSCRIBING ||
    pttPhase === PTT_PHASE.TRANSLATING ||
    streamActive ||
    isSpeakLoading;

  const statusLabel = useMemo(() => {
    if (streamCapture.phase === "streaming") return t.streaming.statusConnected;
    if (streamCapture.phase === "finalizing") return t.streaming.statusFinalizing;
    if (streamCapture.phase === "connecting") return t.streaming.statusConnecting;
    if (isSpeakPlaying) return t.room.statusSpeaking;
    if (isSpeakLoading) return t.speak.loading;
    if (isSimplifying && pttPhase !== PTT_PHASE.TRANSLATING) {
      return t.room.statusSimplifying;
    }
    return pttPhaseStatusLabel(pttPhase, t);
  }, [
    streamCapture.phase,
    isSpeakPlaying,
    isSpeakLoading,
    isSimplifying,
    pttPhase,
    t,
  ]);

  const speakerDisabled =
    sessionEnded ||
    isRecording ||
    isPreparing ||
    isStopping ||
    isTranscribing ||
    isTranslating ||
    isSimplifying ||
    hasDraftTurn ||
    streamActive;

  const pttDisabledReason = useMemo(() => {
    if (sessionEnded) return t.room.statusReadyForNext;
    if (hasDraftTurn) return t.pushToTalk.disabledDraft;
    if (
      isTranscribing ||
      isTranslating ||
      isSimplifying ||
      isPreparing ||
      isStopping
    ) {
      return t.pushToTalk.disabledBusy;
    }
    if (!connectivity.isOnline) return t.pushToTalk.disabledOffline;
    return "";
  }, [
    sessionEnded,
    hasDraftTurn,
    isTranscribing,
    isTranslating,
    isSimplifying,
    isPreparing,
    isStopping,
    connectivity.isOnline,
    t,
  ]);

  const handleListenTranslation = async () => {
    if (!displayTurn?.translatedText?.trim()) return;
    if (!serverStatus.ttsEnabled) {
      announceError(t.errors.ttsDisabled);
      return;
    }
    if (isRecording || isPreparing || isStopping) {
      cancelRecording();
    }
    stopAllPlayback();
    const result = await playSpeakText({
      text: displayTurn.translatedText,
      language: displayTurn.targetLanguage,
      target: "translation",
      useStreamEndpoint: false,
    });
    if (!result.ok && result.code) {
      announceError(
        interpreterErrorMessage(result.code, t, result.message),
      );
    } else if (!result.ok) {
      announceError(t.errors.speakFailed);
    } else if (result.ok) {
      announceStatus(t.speak.playbackPlaying);
    }
  };

  const handleListenPreviewTranslation = async () => {
    const text = nearRealtimePreview.previewTranslation.trim();
    if (!text || !streamingTtsFeatureAvailable || !previewPlaybackEnabled) {
      return;
    }
    if (nearRealtimePreview.isStale) {
      announceError(t.streamingTts.staleBlockPlayback);
      return;
    }
    if (isRecording || isPreparing || isStopping) {
      cancelRecording();
    }
    if (streamActive) {
      announceError(t.streaming.disabledWhileStreaming);
      return;
    }
    stopAllPlayback();
    const langs = session ? languagesForSpeaker(session, speaker) : null;
    if (!langs?.targetLanguage) return;

    const result = await playSpeakText({
      text,
      language: langs.targetLanguage,
      target: "preview",
      useStreamEndpoint: true,
    });
    if (!result.ok && result.code) {
      if (result.code === "rate_limited") {
        announceError(t.errors.rateLimited);
      } else {
        announceError(
          result.code === "speak_failed" || result.code === "network"
            ? t.streamingTts.errorGeneric
            : interpreterErrorMessage(result.code, t, result.message),
        );
      }
    } else if (result.ok) {
      announceStatus(t.speak.playbackPlaying);
    }
  };

  const handleListenSimplified = async () => {
    if (!displayTurn?.simplifiedText?.trim()) return;
    if (isRecording || isPreparing || isStopping) {
      cancelRecording();
    }
    stopAllPlayback();
    const result = await playSpeakText({
      text: displayTurn.simplifiedText,
      language: displayTurn.targetLanguage,
      target: "simplified",
      useStreamEndpoint: false,
    });
    if (!result.ok && result.code) {
      announceError(
        interpreterErrorMessage(result.code, t, result.message),
      );
    } else if (!result.ok) {
      announceError(t.errors.speakFailed);
    }
  };

  const applyStreamTranscriptAsDraft = useCallback(
    (transcript, confidence) => {
      const current = getCurrentSession();
      if (!current || !transcript.trim()) return;
      const langs = languagesForSpeaker(current, speaker);
      const turn = addTurn(current.sessionId, {
        speaker,
        sourceLanguage: langs.sourceLanguage,
        targetLanguage: langs.targetLanguage,
        originalText: transcript.trim(),
        status: TURN_STATUS_DRAFT,
        confidence: mapTranscribeConfidence(confidence),
      });
      if (turn) {
        setActiveTurnId(turn.turnId);
        setDraftText(transcript.trim());
        reloadSession();
        announceStatus(t.room.statusEditingDraft);
        requestAnimationFrame(() => {
          if (mountedRef.current) transcriptRef.current?.focus();
        });
      }
    },
    [speaker, reloadSession, announceStatus, mountedRef],
  );

  const handleStreamStart = useCallback(() => {
    if (!streamingFeatureAvailable || streamActive) return;
    stopAllPlayback();
    cancelRecording();
    nearRealtimePreview.discardPreview();
    setErrorMessage(null);
    void streamCapture.startStreaming();
  }, [
    streamingFeatureAvailable,
    streamActive,
    stopAllPlayback,
    cancelRecording,
    nearRealtimePreview,
    streamCapture,
  ]);

  const handleStreamStop = useCallback(() => {
    void (async () => {
      const result = await streamCapture.stopStreaming();
      if (result.ok && result.transcript) {
        announceStatus(t.streaming.previewReady);
      }
    })();
  }, [streamCapture, announceStatus, t.streaming.previewReady]);

  const handleStreamUseAsDraft = useCallback(() => {
    const text = streamCapture.previewText.trim();
    if (!text) return;
    nearRealtimePreview.discardPreview();
    applyStreamTranscriptAsDraft(text, streamCapture.previewConfidence);
  }, [
    streamCapture.previewText,
    streamCapture.previewConfidence,
    applyStreamTranscriptAsDraft,
    nearRealtimePreview,
  ]);

  const handleToggleRecording = async () => {
    if (!session || sessionEnded || streamActive) return;
    if (session && hasPendingDraftTurn(session)) {
      announceStatus(t.pushToTalk.disabledDraft);
      return;
    }
    if (
      isStopping ||
      isPreparing ||
      recorderBusy ||
      transcribeInFlightRef.current ||
      translateInFlightRef.current ||
      simplifyInFlightRef.current ||
      isTranslating ||
      isSimplifying ||
      isTranscribing
    ) {
      return;
    }
    stopAllPlayback();
    nearRealtimePreview.discardPreview();
    if (recorderError !== "mic_denied") {
      clearRecorderError();
    }
    setErrorMessage(null);

    if (isRecording || isStopping) {
      stopRecording();
      return;
    }

    if (!connectivity.isOnline) {
      announceError(t.errors.offline);
      return;
    }

    if (hasDraftTurn) {
      return;
    }

    setActiveTurnId(null);
    await startRecording();
  };

  const handleRetryMic = useCallback(() => {
    clearRecorderError();
    setErrorMessage(null);
    if (!connectivity.isOnline) {
      announceError(t.errors.offline);
      return;
    }
    if (hasDraftTurn || sessionEnded) return;
    setActiveTurnId(null);
    void startRecording();
  }, [
    clearRecorderError,
    connectivity.isOnline,
    hasDraftTurn,
    sessionEnded,
    announceError,
    t.errors.offline,
    startRecording,
  ]);

  const handleSpeakerChange = useCallback(
    (nextSpeaker) => {
      if (nextSpeaker === speaker) return;
      if (
        isTranscribing ||
        isTranslating ||
        isSimplifying ||
        transcribeInFlightRef.current ||
        translateInFlightRef.current
      ) {
        announceStatus(t.pushToTalk.disabledBusy);
        return;
      }
      if (isRecording || isPreparing || isStopping) {
        cancelRecording();
      }
      if (streamCapture.isActive) {
        void streamCapture.cancelStream();
      }
      nearRealtimePreview.discardPreview();
      stopAllPlayback();
      abortAllRequests();
      setSpeaker(nextSpeaker);
      announceStatus(
        nextSpeaker === SPEAKER_PATIENT
          ? t.room.turnPatient
          : t.room.turnClinician,
      );
    },
    [
      speaker,
      isRecording,
      isPreparing,
      isStopping,
      abortAllRequests,
      cancelRecording,
      stopAllPlayback,
      announceStatus,
      t.room.turnPatient,
      t.room.turnClinician,
      streamCapture,
      nearRealtimePreview,
      isTranscribing,
      isTranslating,
      isSimplifying,
      t.pushToTalk.disabledBusy,
    ],
  );

  const speakerDirectionLabel = useMemo(() => {
    if (!session) return "";
    const langs = languagesForSpeaker(session, speaker);
    const source = formatLanguageDisplayName(uiLanguage, langs.sourceLanguage);
    const target = formatLanguageDisplayName(uiLanguage, langs.targetLanguage);
    return t.room.speakerDirection
      .replace("{{source}}", source)
      .replace("{{target}}", target);
  }, [session, speaker, uiLanguage, t.room.speakerDirection]);

  const runConfirmTranslate = useCallback(async () => {
    if (translateInFlightRef.current || transcribeInFlightRef.current) return;
    if (!session || !displayTurn || displayTurn.status !== TURN_STATUS_DRAFT) {
      return;
    }
    const text = draftText.trim();
    if (!text) return;

    if (!connectivity.isOnline) {
      announceError(t.errors.offline);
      return;
    }

    translateInFlightRef.current = true;
    translateAbortRef.current?.abort();
    translateAbortRef.current = new AbortController();
    const { signal } = translateAbortRef.current;

    if (mountedRef.current) {
      setIsTranslating(true);
      setErrorMessage(null);
      setRecoveryAction(null);
    }
    announceStatus(t.room.statusTranslating);

    const turnId = displayTurn.turnId;
    const sessionId = session.sessionId;

    try {
      updateTurn(sessionId, turnId, {
        originalText: text,
        status: TURN_STATUS_CONFIRMED,
      });
      reloadSession();

      const translateParams = {
        text,
        sourceLanguage: displayTurn.sourceLanguage,
        targetLanguage: displayTurn.targetLanguage,
        speaker: displayTurn.speaker,
      };

      let result = await translateTurn(translateParams, { signal });

      if (
        !result.ok &&
        isRetryableInterpreterCode(result.code) &&
        !signal.aborted &&
        connectivity.isOnline
      ) {
        await new Promise((resolve) => {
          setTimeout(resolve, INTERPRETER_REQUEST_RETRY_DELAY_MS);
        });
        if (!signal.aborted && mountedRef.current) {
          result = await translateTurn(translateParams, { signal });
        }
      }

      if (!mountedRef.current) return;

      if (result.ok) {
        const confidence =
          result.confidence === "low" || result.uncertain
            ? "low"
            : displayTurn.confidence === "low"
              ? "low"
              : displayTurn.confidence;

        updateTurn(sessionId, turnId, {
          originalText: text,
          translatedText: result.translatedText,
          status: TURN_STATUS_TRANSLATED,
          confidence,
          translationDirection:
            result.translationDirection ||
            `${displayTurn.sourceLanguage}->${displayTurn.targetLanguage}`,
          translationUncertain: result.uncertain === true ? true : undefined,
          terminologyWarning:
            result.terminologyWarning === true ? true : undefined,
          unclearSource: result.unclearSource === true ? true : undefined,
        });
        setActiveTurnId(null);
        reloadSession();
        maybeApplyAutoSessionTitle(sessionId, t, uiLanguage);
        reloadSession();
        announceStatus(t.room.statusReadyForNext);
        return;
      }

      if (result.code === "cancelled") return;

      if (result.code === "blocked") {
        updateTurn(sessionId, turnId, {
          originalText: text,
          status: TURN_STATUS_BLOCKED,
          translatedText: undefined,
          translationDirection: undefined,
          translationUncertain: undefined,
          terminologyWarning: undefined,
          unclearSource: undefined,
        });
        announceError(
          interpreterErrorMessage("blocked", t, result.message),
        );
        reloadSession();
        return;
      }

      updateTurn(sessionId, turnId, {
        originalText: text,
        status: TURN_STATUS_DRAFT,
      });
      reloadSession();
      if (isRetryableInterpreterCode(result.code)) {
        setRecoveryAction("translate");
      }
      announceError(interpreterErrorMessage(result.code, t, result.message));
    } finally {
      translateInFlightRef.current = false;
      if (mountedRef.current) setIsTranslating(false);
    }
  }, [
    session,
    displayTurn,
    draftText,
    t,
    uiLanguage,
    reloadSession,
    announceError,
    announceStatus,
    connectivity.isOnline,
    mountedRef,
  ]);

  const handleConfirmTranscript = () => {
    void runConfirmTranslate();
  };

  const runSimplify = useCallback(async () => {
    if (simplifyInFlightRef.current || translateInFlightRef.current) return;
    if (!session || !displayTurn) return;
    const translated = displayTurn.translatedText?.trim();
    if (displayTurn.status !== TURN_STATUS_TRANSLATED || !translated) return;

    if (!connectivity.isOnline) {
      announceError(t.errors.offline);
      return;
    }

    simplifyInFlightRef.current = true;
    simplifyAbortRef.current?.abort();
    simplifyAbortRef.current = new AbortController();
    const { signal } = simplifyAbortRef.current;

    if (mountedRef.current) {
      setIsSimplifying(true);
      setErrorMessage(null);
      setRecoveryAction(null);
    }
    announceStatus(t.room.statusSimplifying);

    const simplifyParams = {
      text: translated,
      language: displayTurn.targetLanguage,
      speaker: displayTurn.speaker,
    };

    try {
      let result = await simplifyTurn(simplifyParams, { signal });

      if (
        !result.ok &&
        isRetryableInterpreterCode(result.code) &&
        !signal.aborted &&
        connectivity.isOnline
      ) {
        await new Promise((resolve) => {
          setTimeout(resolve, INTERPRETER_REQUEST_RETRY_DELAY_MS);
        });
        if (!signal.aborted && mountedRef.current) {
          result = await simplifyTurn(simplifyParams, { signal });
        }
      }

      if (!mountedRef.current) return;

      if (result.ok) {
        updateTurn(session.sessionId, displayTurn.turnId, {
          simplifiedText: result.simplifiedText,
        });
        reloadSession();
        return;
      }

      if (result.code === "cancelled") return;

      if (result.code === "blocked") {
        announceError(
          interpreterErrorMessage("blocked", t, result.message),
        );
        return;
      }

      if (isRetryableInterpreterCode(result.code)) {
        setRecoveryAction("simplify");
      }
      announceError(interpreterErrorMessage(result.code, t, result.message));
    } finally {
      simplifyInFlightRef.current = false;
      if (mountedRef.current) setIsSimplifying(false);
    }
  }, [
    session,
    displayTurn,
    t,
    reloadSession,
    announceError,
    announceStatus,
    connectivity.isOnline,
    mountedRef,
  ]);

  const handleSimplifyLanguage = () => {
    void runSimplify();
  };

  const handleRecoveryRetry = useCallback(() => {
    if (!connectivity.isOnline) {
      announceError(t.errors.offline);
      return;
    }
    const action = recoveryAction;
    setRecoveryAction(null);
    setErrorMessage(null);
    if (action === "simplify") {
      void runSimplify();
      return;
    }
    if (action === "translate") {
      void runConfirmTranslate();
    }
  }, [
    connectivity.isOnline,
    recoveryAction,
    announceError,
    t.errors.offline,
    runSimplify,
    runConfirmTranslate,
  ]);

  const handleHideSimplified = () => {
    if (!session || !displayTurn) return;
    updateTurn(session.sessionId, displayTurn.turnId, {
      simplifiedText: undefined,
    });
    reloadSession();
  };

  const doEndSession = useCallback(() => {
    if (!session || sessionActionInFlightRef.current) return;
    sessionActionInFlightRef.current = true;
    if (mountedRef.current) setSessionActionBusy(true);
    abortAllRequests();
    cancelRecording();
      void streamCapture.cancelStream();
    stopAllPlayback();
    endSession(session.sessionId, t, uiLanguage);
    reloadSession();
    announceStatus(t.sessionActions.ended);
    sessionActionInFlightRef.current = false;
    if (mountedRef.current) setSessionActionBusy(false);
  }, [
    session,
    reloadSession,
    announceStatus,
    t,
    uiLanguage,
    abortAllRequests,
    cancelRecording,
    streamCapture,
    stopAllPlayback,
    mountedRef,
  ]);

  const handleEndSession = () => {
    if (!session || sessionEnded || sessionActionBusy || busy) return;
    flushDraftToStore();
    const current = reloadSession();
    if (current && hasPendingDraftTurn(current)) {
      setConfirmAction("end");
      return;
    }
    doEndSession();
  };

  const handleDeleteSession = () => {
    if (!session || sessionActionBusy || busy) return;
    setConfirmAction("delete");
  };

  const handleDeleteConfirm = () => {
    if (!session || sessionActionInFlightRef.current) return;
    sessionActionInFlightRef.current = true;
    if (mountedRef.current) setSessionActionBusy(true);
    abortAllRequests();
    cancelRecording();
    void streamCapture.cancelStream();
    stopAllPlayback();
    const id = session.sessionId;
    deleteSession(id);
    setConfirmAction(null);
    sessionActionInFlightRef.current = false;
    announceStatus(t.history.deleted);
    navigate("/patient/interpreter", { replace: true });
  };

  if (!session) {
    return null;
  }

  const canConfirm =
    displayTurn?.status === TURN_STATUS_DRAFT &&
    Boolean(draftText.trim()) &&
    !busy;

  const pttDisabled =
    sessionEnded ||
    isPreparing ||
    isStopping ||
    isTranscribing ||
    isTranslating ||
    isSimplifying ||
    hasDraftTurn ||
    streamActive ||
    !connectivity.isOnline;

  const statusBarClass = [
    "interpreter-status-bar",
    isPttCaptureActive(pttPhase) ? "interpreter-status-bar--recording" : "",
    busy && !isPttCaptureActive(pttPhase) ? "interpreter-status-bar--busy" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main
      className="medical-interpreter-page medical-interpreter-page--live interp-root"
      id="main-content"
      aria-busy={busy}
    >
      <Link
        className="medical-interpreter-page__back"
        to="/patient/interpreter"
      >
        {t.chrome.backToHub}
      </Link>

      {liveMessage ? (
        <p className="interpreter-live__status-live" role="status" aria-live="polite">
          {liveMessage}
        </p>
      ) : null}

      {connectivity.showOfflineBanner ? (
        <InterpreterConnectivityBanner
          variant="offline"
          message={t.reliability.offlineBanner}
        />
      ) : null}

      {connectivity.showReconnectedBanner ? (
        <InterpreterConnectivityBanner
          variant="reconnected"
          message={t.reliability.reconnectedBanner}
        />
      ) : null}

      {recoveryAction ? (
        <InterpreterRecoveryBanner
          message={t.reliability.recoveryBody}
          retryLabel={t.reliability.retryAction}
          dismissLabel={t.reliability.dismissRecovery}
          onRetry={handleRecoveryRetry}
          onDismiss={() => {
            setRecoveryAction(null);
            setErrorMessage(null);
          }}
          busy={isTranslating || isSimplifying}
        />
      ) : null}

      <InterpreterLiveHeader
        session={session}
        statusLabel={statusLabel}
        labels={t}
      />

      <p className="medical-interpreter-safety" role="note">
        {t.room.disclaimerStrip}
      </p>

      {errorMessage ? (
        <div
          ref={errorAlertRef}
          className="interpreter-feedback interpreter-feedback--error"
          role="alert"
          tabIndex={-1}
        >
          {errorMessage}
        </div>
      ) : null}

      <div
        className={statusBarClass}
        aria-live="polite"
        aria-atomic="true"
        aria-label={t.aria.liveRegion}
      >
        {statusLabel}
        {maxDurationReached ? ` ${t.pushToTalk.maxDurationHint}` : ""}
      </div>

      <InterpreterPlaybackStatus
        visible={
          (isSpeakLoading || isSpeakPlaying) &&
          (serverStatus.ttsEnabled || streamingTtsFeatureAvailable)
        }
        isLoading={isSpeakLoading}
        isPlaying={isSpeakPlaying}
        onStop={stopAllPlayback}
        stopDisabled={sessionEnded}
        labels={t}
      />

      <InterpreterSpeakerToggle
        speaker={speaker}
        onSpeakerChange={handleSpeakerChange}
        disabled={speakerDisabled}
        labels={t}
      />

      {speakerDirectionLabel ? (
        <p className="interpreter-live__speaker-direction" id="interp-speaker-direction">
          {speakerDirectionLabel}
        </p>
      ) : null}

      {session && sessionIsMixedDirection(session) ? (
        <p className="interpreter-live__mixed-direction-note" role="note">
          {t.languages.mixedDirectionNote}
        </p>
      ) : null}

      <InterpreterTranscriptPanel
        turn={displayTurn}
        draftText={draftText}
        onDraftTextChange={setDraftText}
        onConfirm={handleConfirmTranscript}
        canConfirm={canConfirm}
        isBusy={isTranscribing || isTranslating || isSimplifying}
        showLowConfidence={
          displayTurn?.status === TURN_STATUS_DRAFT &&
          displayTurn.confidence === "low"
        }
        textareaRef={transcriptRef}
        labels={t}
      />

      {hasDraftTurn ? (
        <p className="interpreter-live__draft-saved" role="status">
          {t.transcript.draftSavedHint}
        </p>
      ) : null}

      <InterpreterTranslationPanel
        turn={displayTurn}
        session={session}
        onListen={handleListenTranslation}
        listenDisabled={busy && !isSpeakPlaying}
        listenLoading={isSpeakLoading && speakTarget === "translation"}
        listenPlaying={isSpeakPlaying && speakTarget === "translation"}
        labels={t}
      />

      <InterpreterSimplifiedPanel
        turn={displayTurn}
        isSimplifying={isSimplifying}
        onSimplify={handleSimplifyLanguage}
        onHideSimplified={handleHideSimplified}
        onListenSimplified={handleListenSimplified}
        listenDisabled={busy && !(isSpeakPlaying && speakTarget === "simplified")}
        listenLoading={isSpeakLoading && speakTarget === "simplified"}
        listenPlaying={isSpeakPlaying && speakTarget === "simplified"}
        labels={t}
      />

      <InterpreterStreamingPanel
        available={streamingFeatureAvailable}
        phase={streamCapture.phase}
        isActive={streamActive}
        connectionLabel={streamCapture.connectionLabel}
        previewText={streamCapture.previewText}
        stagedMessage={streamCapture.stagedMessage}
        previewConfidence={streamCapture.previewConfidence}
        browserSupported={streamCapture.browserSupported}
        disabled={busy || hasDraftTurn || sessionEnded}
        onStart={handleStreamStart}
        onStop={handleStreamStop}
        onCancel={() => {
          nearRealtimePreview.discardPreview();
          void streamCapture.cancelStream();
        }}
        onUseAsDraft={handleStreamUseAsDraft}
        canUseAsDraft={
          Boolean(streamCapture.previewText.trim()) &&
          !streamActive &&
          !hasDraftTurn
        }
        labels={t}
      />

      <InterpreterNearRealtimePreviewPanel
        available={nearRealtimeFeatureAvailable}
        isLoading={nearRealtimePreview.isLoading}
        previewTranslation={nearRealtimePreview.previewTranslation}
        isStale={nearRealtimePreview.isStale}
        uncertain={nearRealtimePreview.uncertain}
        terminologyWarning={nearRealtimePreview.terminologyWarning}
        unclearSource={nearRealtimePreview.unclearSource}
        hasSourceText={Boolean(streamCapture.previewText.trim())}
        disabled={busy || hasDraftTurn || sessionEnded}
        onDiscard={() => {
          nearRealtimePreview.discardPreview();
          if (speakTarget === "preview") stopAllPlayback();
        }}
        streamingTtsAvailable={streamingTtsFeatureAvailable}
        previewPlaybackEnabled={previewPlaybackEnabled}
        onPreviewPlaybackEnabledChange={setPreviewPlaybackEnabled}
        onPlayPreview={() => void handleListenPreviewTranslation()}
        previewListenLoading={isSpeakLoading && speakTarget === "preview"}
        previewListenPlaying={isSpeakPlaying && speakTarget === "preview"}
        previewListenDisabled={
          busy ||
          streamActive ||
          nearRealtimePreview.isStale ||
          !connectivity.isOnline
        }
        onRetryPlayback={() => void retryPlayback()}
        showPlaybackRetry={
          speakTarget === "preview" && Boolean(speakLastErrorCode)
        }
        labels={t}
      />

      <InterpreterPushToTalkPanel
        isRecording={isRecording}
        isPreparing={isPreparing}
        isStopping={isStopping}
        onToggleRecording={() => void handleToggleRecording()}
        disabled={pttDisabled}
        disabledReason={
          streamActive ? t.streaming.disabledWhileStreaming : pttDisabledReason
        }
        privacyNote={t.privacy.body3}
        micDenied={recorderError === "mic_denied"}
        onRetryMic={handleRetryMic}
        labels={t}
      />

      <InterpreterSessionActions
        sessionId={session.sessionId}
        onEndSession={handleEndSession}
        onDeleteSession={handleDeleteSession}
        sessionEnded={sessionEnded}
        actionsDisabled={busy || sessionActionBusy}
        labels={t}
      />

      <InterpreterConfirmDialog
        open={leaveDialogOpen}
        title={t.confirm.leaveTitle}
        body={t.confirm.leaveBody}
        confirmLabel={t.confirm.discardDraft}
        cancelLabel={t.confirm.keepEditing}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
        danger
      />

      <InterpreterConfirmDialog
        open={confirmAction === "delete"}
        title={t.confirm.deleteTitle}
        body={t.confirm.deleteBody}
        confirmLabel={t.confirm.confirmDelete}
        cancelLabel={t.confirm.cancel}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmAction(null)}
        danger
      />

      <InterpreterConfirmDialog
        open={confirmAction === "end"}
        title={t.confirm.endTitle}
        body={t.confirm.endWithDraftBody}
        confirmLabel={t.confirm.endAnyway}
        cancelLabel={t.confirm.keepEditing}
        onConfirm={() => {
          setConfirmAction(null);
          if (!sessionActionInFlightRef.current) doEndSession();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </main>
  );
}
