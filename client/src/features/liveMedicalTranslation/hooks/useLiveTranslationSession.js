import { useCallback, useEffect, useRef, useState } from "react";
import { exchangeLiveTranslationSdp } from "../api/liveTranslationApi.js";
import { LIVE_TRANSLATION_TRANSCRIPTION_MODEL } from "../constants.js";
import { buildLanguageRouting } from "../utils/routing.js";
import { buildCompactClientInstructions, buildFaithfulRetryInstructions } from "../utils/translationInstructions.js";
import { buildRuntimeSessionUpdatePayload } from "../utils/realtimeSessionUpdate.js";
import { classifyRealtimeError, isCancelledOrFailedResponseDone } from "../utils/realtimeErrorPolicy.js";
import {
  logRealtimeConnect,
  logRealtimeDiag,
  summarizePipelineEvent,
  summarizeRealtimeEvent,
} from "../utils/realtimeDiagnostics.js";
import { isLikelyEmptyOrNoiseTranscript, sanitizeUnclearTurn } from "../utils/asrQuality.js";
import { isSemanticTranslationDrift } from "../utils/translationSemanticCheck.js";
import {
  isInputTranscriptionCompletedEvent,
  isInputTranscriptionFailedEvent,
  logTranscriptionEventMeta,
} from "../utils/asrTranscription.js";
import { evaluateConversationContext } from "../utils/conversationContextMonitor.js";
import {
  canProceedToTranslation,
  MAX_TRANSCRIPT_WAIT_MS,
  MIN_STABLE_TRANSCRIPT_CHARS,
} from "../utils/transcriptionFirst.js";
import { logCostGuard, normalizeTranscriptKey } from "../utils/costGuard.js";
import {
  isLanguageInSelectedPair,
  isTargetLanguageInPair,
  sanitizeWrongLanguageTurn,
} from "../utils/languageContainment.js";
import {
  getMedaUnclearRepeatPhrase,
  isMedaUnclearPhrase,
} from "../utils/repeatPhrase.js";
import { getWrongLanguagePhrase } from "../utils/wrongLanguagePhrase.js";
import {
  inferLanguageFromTranscript,
  isLanguageRoutingEnabled,
  resolveSpeakerFromDetectedLanguage,
} from "../utils/languageBasedRouting.js";
import {
  formatSessionTimer,
  resolveLiveSessionMaxMs,
  resolveLiveSessionWarnAtMs,
  computeActiveSessionElapsedMs,
} from "../utils/sessionTimer.js";
import { playMedaActivationChime } from "../utils/medaActivationFeedback.js";
import {
  isModelScopeRefusal,
  shouldRetryScopeRefusal,
} from "../utils/medicalScopePolicy.js";
import {
  extractDetectedLanguage,
  extractOriginalText,
  extractTranslatedText,
  extractTranslatedTextFromResponse,
  REALTIME_PEER_CONNECTION_CONFIG,
  waitForIceGatheringComplete,
} from "../utils/webrtc.js";

/** @param {Response} res @param {Record<string, unknown>} data */
function resolveSessionApiErrorKey(res, data) {
  if (res.status === 401 || res.status === 403) return "sessionUnauthorized";
  if (data?.error === "feature_disabled") return "featureDisabled";
  if (data?.error === "openai_not_configured") return "openaiNotConfigured";
  if (data?.error === "OPENAI_QUOTA_EXCEEDED") return "openaiQuotaExceeded";
  if (data?.error === "realtime_session_failed" || data?.error === "realtime_session_invalid") {
    if (data?.openaiErrorParam === "session.audio.input.transcription.language") {
      return "openaiSessionRejected";
    }
    return "openaiSessionRejected";
  }
  if (res.status >= 500) return "sessionStartFailed";
  return "sessionStartFailed";
}

/** @param {unknown} err */
function resolveConnectExceptionErrorKey(err) {
  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "microphoneDenied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "microphoneUnavailable";
  if (err instanceof TypeError) return "sessionNetworkFailed";
  return "webrtcConnectionFailed";
}

/** @typedef {"idle" | "connecting" | "reconnecting" | "introducing" | "connected" | "listening" | "translating" | "speaking" | "paused" | "error" | "ended"} LiveTranslationConnectionStatus */

/**
 * @typedef {"translated" | "unclear" | "wrongLanguage" | "corrected" | "replayed"} LiveTranslationTurnStatus
 */

/**
 * @typedef {{
 *   id: string;
 *   speaker: "patient" | "doctor";
 *   sourceLanguage: string;
 *   targetLanguage: string;
 *   originalText: string;
 *   originalMissing: boolean;
 *   translatedText: string;
 *   timestamp: string;
 *   status: LiveTranslationTurnStatus;
 *   correctsTurnId?: string;
 *   wrongOriginalText?: string;
 *   wrongTranslatedText?: string;
 * }} LiveTranslationTurn
 */

/** @typedef {{ type: "correction"; sourceText: string; correctsTurnId: string; routing: ReturnType<typeof buildLanguageRouting>; wrongOriginalText?: string; wrongTranslatedText?: string } | { type: "replay" } | { type: "repeat"; phrase: string } | { type: "spokenNotice"; phrase: string } | { type: "unclearRepeat"; phrase: string; routing: ReturnType<typeof buildLanguageRouting>; overlapDetected?: boolean; recordHistory?: boolean } | { type: "wrongLanguageRepeat"; phrase: string; routing: ReturnType<typeof buildLanguageRouting>; detectedLanguage?: string | null; recordHistory?: boolean } | { type: "scopeRetry"; sourceText: string; routing: ReturnType<typeof buildLanguageRouting> } | null} PendingPlanB */

/**
 * @param {{
 *   patientLanguage: string;
 *   doctorLanguage: string;
 *   activeSpeaker: "patient" | "doctor";
 *   enabled: boolean;
 *   introText?: string;
 *   activationReadinessText?: string;
 *   activationSoundEnabled?: boolean;
 *   languageBasedRouting?: boolean;
 *   skipLanguageRoutingRef?: React.MutableRefObject<boolean>;
 *   instructionOptions?: { medicalDomainWarningDe?: string; medicalDomainWarningEn?: string };
 *   autoSwitchSpeaker?: boolean;
 *   onTurnComplete?: (completedSpeaker: "patient" | "doctor") => void;
 *   onSpeakerFromLanguage?: (speaker: "patient" | "doctor") => void;
 *   onLanguageUncertain?: (uncertain?: boolean) => void;
 *   onWrongLanguagePair?: (info?: { detectedLanguage?: string | null }) => void;
 *   onUnclearTurn?: (info?: { overlapDetected?: boolean; missingOriginal?: boolean }) => void;
 *   onSessionTimeWarning?: (info: { elapsedMs: number; markMs: number; maxMs: number }) => void;
 *   onSessionAutoEnd?: () => void;
 *   onScopeWarning?: () => void;
 *   onScopeTranslationPaused?: () => void;
 * }} config
 */
export function useLiveTranslationSession({
  patientLanguage,
  doctorLanguage,
  activeSpeaker,
  enabled,
  introText = "",
  activationReadinessText = "",
  activationSoundEnabled = true,
  languageBasedRouting = true,
  skipLanguageRoutingRef,
  instructionOptions = {},
  autoSwitchSpeaker = false,
  onTurnComplete,
  onSpeakerFromLanguage,
  onLanguageUncertain,
  onWrongLanguagePair,
  onUnclearTurn,
  onSessionTimeWarning,
  onSessionAutoEnd,
  onScopeWarning,
  onScopeTranslationPaused,
}) {
  const [connectionStatus, setConnectionStatus] = useState(
    /** @type {LiveTranslationConnectionStatus} */ ("idle"),
  );
  const [microphoneStatus, setMicrophoneStatus] = useState("off");
  const [currentTranslatedText, setCurrentTranslatedText] = useState("");
  const [turns, setTurns] = useState(/** @type {LiveTranslationTurn[]} */ ([]));
  const [errorKey, setErrorKey] = useState("");
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
  const turnsRef = useRef(/** @type {LiveTranslationTurn[]} */ ([]));

  const pcRef = useRef(/** @type {RTCPeerConnection | null} */ (null));
  const dcRef = useRef(/** @type {RTCDataChannel | null} */ (null));
  const micStreamRef = useRef(/** @type {MediaStream | null} */ (null));
  const micTrackRef = useRef(/** @type {MediaStreamTrack | null} */ (null));
  const audioElRef = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const mountedRef = useRef(true);
  const connectedRef = useRef(false);
  const pendingSpeakerUpdateRef = useRef(false);
  const transcriptionModelRef = useRef(LIVE_TRANSLATION_TRANSCRIPTION_MODEL);
  const prevSpeakerRef = useRef(activeSpeaker);
  const sessionConfigRef = useRef({ patientLanguage, doctorLanguage, activeSpeaker });
  const pendingOriginalRef = useRef("");
  const currentTranslatedRef = useRef("");
  const outputStreamIdRef = useRef(/** @type {string | null} */ (null));
  const lastTurnSignatureRef = useRef("");
  const suppressErrorsUntilRef = useRef(0);
  const autoSwitchSpeakerRef = useRef(autoSwitchSpeaker);
  const onTurnCompleteRef = useRef(onTurnComplete);
  const onSpeakerFromLanguageRef = useRef(onSpeakerFromLanguage);
  const onLanguageUncertainRef = useRef(onLanguageUncertain);
  const introTextRef = useRef(introText);
  const introPlayedRef = useRef(false);
  const activationReadinessTextRef = useRef(activationReadinessText);
  const activationSoundEnabledRef = useRef(activationSoundEnabled);
  const sessionActivationPlayedRef = useRef(false);
  const skipActivationFeedbackRef = useRef(false);
  const languageBasedRoutingRef = useRef(languageBasedRouting);
  const instructionOptionsRef = useRef(instructionOptions);
  const turnIdCounterRef = useRef(0);
  const pendingPlanBRef = useRef(/** @type {PendingPlanB} */ (null));
  const latestReplayTextRef = useRef("");
  const turnContextRef = useRef(
    buildLanguageRouting({ patientLanguage, doctorLanguage, activeSpeaker }),
  );
  const connectionStatusRef = useRef(/** @type {LiveTranslationConnectionStatus} */ ("idle"));
  const overlapDetectedRef = useRef(false);
  const reconnectInFlightRef = useRef(false);
  const connectPreserveTurnsRef = useRef(false);
  const sessionAccumulatedMsRef = useRef(0);
  const sessionRunningSinceRef = useRef(/** @type {number | null} */ (null));
  const sessionWarnedAtRef = useRef(/** @type {Set<number>} */ (new Set()));
  const sessionTimerIntervalRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));
  const enabledRef = useRef(enabled);
  const awaitingIntroResponseRef = useRef(false);
  const pendingRepeatSpeechRef = useRef(
    /** @type {{ phrase: string; type: "unclearRepeat" | "wrongLanguageRepeat" } | null} */ (null),
  );
  const lastDetectedLanguageRef = useRef(/** @type {string | null} */ (null));
  const inputTranscriptStateRef = useRef(/** @type {"pending" | "ready" | "empty" | "failed"} */ ("pending"));
  const pendingTranslatedForTurnRef = useRef("");
  const pendingFinalizeTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const onUnclearTurnRef = useRef(onUnclearTurn);
  const onWrongLanguagePairRef = useRef(onWrongLanguagePair);
  const onSessionTimeWarningRef = useRef(onSessionTimeWarning);
  const onSessionAutoEndRef = useRef(onSessionAutoEnd);
  const sessionMaxMsRef = useRef(resolveLiveSessionMaxMs());
  const responseActiveRef = useRef(false);
  const speakerUpdateTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const lastSessionUpdateSigRef = useRef("");
  const pausedRef = useRef(false);
  const scopeContinueRef = useRef(false);
  const translationDriftRetryAttemptedRef = useRef(false);
  const scopeWarningShownRef = useRef(false);
  const scopeSoftWarningShownRef = useRef(false);
  const scopeTranslationPausedRef = useRef(false);
  const onScopeWarningRef = useRef(onScopeWarning);
  const onScopeTranslationPausedRef = useRef(onScopeTranslationPaused);
  const lastResponseCreateTranscriptRef = useRef("");
  const inputSuppressedRef = useRef(false);
  const outputPlaybackActiveRef = useRef(false);
  const audioPlaybackHandlersRef = useRef(
    /** @type {{ playing: () => void; ended: () => void } | null} */ (null),
  );
  const sessionEstablishedRef = useRef(false);

  sessionConfigRef.current = { patientLanguage, doctorLanguage, activeSpeaker };
  autoSwitchSpeakerRef.current = autoSwitchSpeaker;
  onTurnCompleteRef.current = onTurnComplete;
  onSpeakerFromLanguageRef.current = onSpeakerFromLanguage;
  onLanguageUncertainRef.current = onLanguageUncertain;
  introTextRef.current = introText;
  activationReadinessTextRef.current = activationReadinessText;
  activationSoundEnabledRef.current = activationSoundEnabled;
  languageBasedRoutingRef.current = languageBasedRouting;
  instructionOptionsRef.current = instructionOptions;
  turnsRef.current = turns;
  connectionStatusRef.current = connectionStatus;
  onUnclearTurnRef.current = onUnclearTurn;
  onWrongLanguagePairRef.current = onWrongLanguagePair;
  onSessionTimeWarningRef.current = onSessionTimeWarning;
  onSessionAutoEndRef.current = onSessionAutoEnd;
  onScopeWarningRef.current = onScopeWarning;
  onScopeTranslationPausedRef.current = onScopeTranslationPaused;
  enabledRef.current = enabled;
  sessionMaxMsRef.current = resolveLiveSessionMaxMs();

  const safeSetState = useCallback((setter) => {
    if (mountedRef.current) setter();
  }, []);

  const suppressMicForMedaOutput = useCallback(() => {
    inputSuppressedRef.current = true;
    if (micTrackRef.current) {
      micTrackRef.current.enabled = false;
    }
    logCostGuard("mic_input_suppressed");
  }, []);

  const resumeMicAfterMedaOutput = useCallback(() => {
    if (pausedRef.current || !connectedRef.current) return;
    inputSuppressedRef.current = false;
    if (micTrackRef.current) {
      micTrackRef.current.enabled = true;
    }
    logCostGuard("mic_input_resumed");
    safeSetState(() => {
      if (connectionStatusRef.current !== "paused" && connectionStatusRef.current !== "ended") {
        setMicrophoneStatus("on");
      }
    });
  }, [safeSetState]);

  const attachOutputAudio = useCallback((audioEl) => {
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.setAttribute("playsinline", "true");
    audioEl.setAttribute("webkit-playsinline", "true");
    audioEl.style.display = "none";
    if (!audioEl.isConnected) {
      document.body.appendChild(audioEl);
    }

    const prev = audioPlaybackHandlersRef.current;
    if (prev) {
      audioEl.removeEventListener("playing", prev.playing);
      audioEl.removeEventListener("ended", prev.ended);
      audioEl.removeEventListener("pause", prev.ended);
    }

    const onPlaying = () => {
      outputPlaybackActiveRef.current = true;
      suppressMicForMedaOutput();
      logCostGuard("audio_playback_start");
    };
    const onEnded = () => {
      outputPlaybackActiveRef.current = false;
      logCostGuard("audio_playback_end");
      if (!responseActiveRef.current) {
        resumeMicAfterMedaOutput();
      }
    };
    audioEl.addEventListener("playing", onPlaying);
    audioEl.addEventListener("ended", onEnded);
    audioEl.addEventListener("pause", onEnded);
    audioPlaybackHandlersRef.current = { playing: onPlaying, ended: onEnded };
  }, [resumeMicAfterMedaOutput, suppressMicForMedaOutput]);

  const clearSessionTimer = useCallback(() => {
    if (sessionTimerIntervalRef.current) {
      clearInterval(sessionTimerIntervalRef.current);
      sessionTimerIntervalRef.current = null;
    }
  }, []);

  const getSessionActiveElapsedMs = useCallback(
    () =>
      computeActiveSessionElapsedMs(
        sessionAccumulatedMsRef.current,
        sessionRunningSinceRef.current,
      ),
    [],
  );

  const resetSessionTimerState = useCallback(() => {
    sessionAccumulatedMsRef.current = 0;
    sessionRunningSinceRef.current = null;
  }, []);

  const pauseSessionTimer = useCallback(() => {
    if (sessionRunningSinceRef.current != null) {
      sessionAccumulatedMsRef.current = getSessionActiveElapsedMs();
      sessionRunningSinceRef.current = null;
    }
  }, [getSessionActiveElapsedMs]);

  const resumeSessionTimer = useCallback(() => {
    if (sessionRunningSinceRef.current == null && !pausedRef.current) {
      sessionRunningSinceRef.current = Date.now();
    }
  }, []);

  const startSessionTimer = useCallback(() => {
    clearSessionTimer();
    resetSessionTimerState();
    sessionRunningSinceRef.current = Date.now();
    sessionWarnedAtRef.current = new Set();
    const maxMs = sessionMaxMsRef.current;
    const warnAt = resolveLiveSessionWarnAtMs(maxMs);

    sessionTimerIntervalRef.current = setInterval(() => {
      if (!mountedRef.current || pausedRef.current || sessionRunningSinceRef.current == null) {
        return;
      }
      const elapsed = getSessionActiveElapsedMs();
      safeSetState(() => setSessionElapsedMs(elapsed));

      for (const mark of warnAt) {
        if (elapsed >= mark && !sessionWarnedAtRef.current.has(mark)) {
          sessionWarnedAtRef.current.add(mark);
          onSessionTimeWarningRef.current?.({ elapsedMs: elapsed, markMs: mark, maxMs });
        }
      }

      if (elapsed >= maxMs) {
        clearSessionTimer();
        logCostGuard("session_closed_by_cost_guard", { elapsedMs: elapsed, maxMs });
        onSessionAutoEndRef.current?.();
      }
    }, 1000);
  }, [clearSessionTimer, getSessionActiveElapsedMs, resetSessionTimerState, safeSetState]);

  const resumeAudioPlayback = useCallback(() => {
    const el = audioElRef.current;
    if (el?.srcObject) {
      void el.play().catch(() => {
        /* autoplay may require user gesture on iOS Safari */
      });
    }
  }, []);

  const stopMic = useCallback(() => {
    micTrackRef.current?.stop();
    micTrackRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    safeSetState(() => setMicrophoneStatus("off"));
  }, [safeSetState]);

  const teardown = useCallback(() => {
    connectedRef.current = false;
    pendingSpeakerUpdateRef.current = false;
    outputStreamIdRef.current = null;
    currentTranslatedRef.current = "";
    lastTurnSignatureRef.current = "";
    introPlayedRef.current = false;
    overlapDetectedRef.current = false;
    resetSessionTimerState();
    responseActiveRef.current = false;
    awaitingIntroResponseRef.current = false;
    lastSessionUpdateSigRef.current = "";
    lastResponseCreateTranscriptRef.current = "";
    inputSuppressedRef.current = false;
    outputPlaybackActiveRef.current = false;
    sessionEstablishedRef.current = false;
    pausedRef.current = false;
    scopeContinueRef.current = false;
    scopeWarningShownRef.current = false;
    scopeSoftWarningShownRef.current = false;
    scopeTranslationPausedRef.current = false;
    if (speakerUpdateTimerRef.current) {
      clearTimeout(speakerUpdateTimerRef.current);
      speakerUpdateTimerRef.current = null;
    }
    if (pendingFinalizeTimerRef.current) {
      clearTimeout(pendingFinalizeTimerRef.current);
      pendingFinalizeTimerRef.current = null;
    }
    pendingTranslatedForTurnRef.current = "";
    clearSessionTimer();
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (audioElRef.current) {
      const handlers = audioPlaybackHandlersRef.current;
      if (handlers) {
        audioElRef.current.removeEventListener("playing", handlers.playing);
        audioElRef.current.removeEventListener("ended", handlers.ended);
        audioElRef.current.removeEventListener("pause", handlers.ended);
        audioPlaybackHandlersRef.current = null;
      }
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      audioElRef.current.remove();
      audioElRef.current = null;
    }
    stopMic();
  }, [clearSessionTimer, stopMic]);

  const cancelActiveResponse = useCallback(() => {
    if (!responseActiveRef.current) return;
    const dc = dcRef.current;
    if (dc?.readyState === "open") {
      console.debug("[MedaPipelineDebug] cancelActiveResponse fired", {
        step: "step7_cancel",
        dcState: dc.readyState,
      });
      suppressErrorsUntilRef.current = Date.now() + 3500;
      dc.send(JSON.stringify({ type: "response.cancel" }));
    }
    responseActiveRef.current = false;
  }, []);

  const maybeTriggerScopeWarning = useCallback(() => {
    if (scopeContinueRef.current) return;
    const elapsed = getSessionActiveElapsedMs();
    const ctx = evaluateConversationContext(
      turnsRef.current,
      elapsed,
      scopeContinueRef.current,
    );

    if (ctx.pauseTranslation && !scopeTranslationPausedRef.current) {
      scopeTranslationPausedRef.current = true;
      cancelActiveResponse();
      onScopeTranslationPausedRef.current?.();
      return;
    }

    if (ctx.softWarning && !scopeSoftWarningShownRef.current && !scopeWarningShownRef.current) {
      scopeSoftWarningShownRef.current = true;
      onScopeWarningRef.current?.();
      return;
    }

    if (ctx.softWarning && !scopeWarningShownRef.current) {
      scopeWarningShownRef.current = true;
      onScopeWarningRef.current?.();
    }
  }, [cancelActiveResponse, getSessionActiveElapsedMs]);

  const appendTurn = useCallback(
    (originalText, translatedText, meta = {}) => {
      if (pausedRef.current) return;
      const routing = turnContextRef.current;
      const cfg = sessionConfigRef.current;
      const unclearRepeatPhrase = getMedaUnclearRepeatPhrase(routing.targetLanguage);
      const wrongLanguageRepeatPhrase = getWrongLanguagePhrase(routing.targetLanguage);

      /** @type {{ status: LiveTranslationTurnStatus; originalText: string; translatedText: string; originalMissing: boolean; needsRepeatSpeech: boolean }} */
      let sanitized;

      if (meta.status === "wrongLanguage") {
        sanitized = {
          status: "wrongLanguage",
          originalText: "",
          translatedText: wrongLanguageRepeatPhrase,
          originalMissing: true,
          needsRepeatSpeech: String(translatedText || "").trim() !== wrongLanguageRepeatPhrase,
        };
        onWrongLanguagePairRef.current?.({
          detectedLanguage: meta.detectedLanguage ?? lastDetectedLanguageRef.current,
        });
      } else {
        const wrongCheck = sanitizeWrongLanguageTurn({
          originalText,
          translatedText,
          patientLanguage: cfg.patientLanguage,
          doctorLanguage: cfg.doctorLanguage,
          targetLanguage: routing.targetLanguage,
          detectedLanguage: meta.detectedLanguage ?? lastDetectedLanguageRef.current,
          repeatPhrase: wrongLanguageRepeatPhrase,
        });

        if (wrongCheck.isWrongLanguage) {
          sanitized = {
            status: "wrongLanguage",
            originalText: wrongCheck.originalText,
            translatedText: wrongCheck.translatedText,
            originalMissing: wrongCheck.originalMissing,
            needsRepeatSpeech: wrongCheck.needsRepeatSpeech,
          };
          onWrongLanguagePairRef.current?.({
            detectedLanguage: meta.detectedLanguage ?? lastDetectedLanguageRef.current,
          });
        } else {
          sanitized = sanitizeUnclearTurn({
            originalText,
            translatedText,
            targetLanguage: routing.targetLanguage,
            overlapDetected: Boolean(meta.overlapDetected),
            forcedStatus: meta.status,
            repeatPhrase: unclearRepeatPhrase,
          });

          if (sanitized.status !== "translated" && !meta.status) {
            onUnclearTurnRef.current?.({
              overlapDetected: Boolean(meta.overlapDetected),
              missingOriginal: sanitized.originalMissing,
            });
          }
        }
      }

      if (!sanitized.translatedText.trim()) return;

      if (sanitized.needsRepeatSpeech) {
        pendingRepeatSpeechRef.current = {
          phrase: sanitized.translatedText,
          type: sanitized.status === "wrongLanguage" ? "wrongLanguageRepeat" : "unclearRepeat",
        };
      }

      turnIdCounterRef.current += 1;
      const turn = {
        id: `turn-${Date.now()}-${turnIdCounterRef.current}`,
        speaker: meta.speaker || routing.activeSpeaker,
        sourceLanguage: meta.sourceLanguage || routing.sourceLanguage,
        targetLanguage: meta.targetLanguage || routing.targetLanguage,
        originalText: sanitized.originalText,
        originalMissing: sanitized.originalMissing,
        translatedText: sanitized.translatedText,
        timestamp: new Date().toISOString(),
        status: sanitized.status,
        correctsTurnId: meta.correctsTurnId,
        wrongOriginalText: meta.wrongOriginalText,
        wrongTranslatedText: meta.wrongTranslatedText,
      };

      const signature = `${turn.speaker}|${turn.originalText}|${turn.translatedText}|${turn.status}`;
      if (!meta.allowDuplicate && signature === lastTurnSignatureRef.current) return;
      lastTurnSignatureRef.current = signature;

      currentTranslatedRef.current = sanitized.translatedText;
      latestReplayTextRef.current = sanitized.translatedText;
      safeSetState(() => {
        setTurns((prev) => {
          const next = [...prev, turn];
          turnsRef.current = next;
          return next;
        });
        setCurrentTranslatedText(sanitized.translatedText);
      });
      pendingOriginalRef.current = "";

      maybeTriggerScopeWarning();

      if (sanitized.status === "translated" && autoSwitchSpeakerRef.current && onTurnCompleteRef.current) {
        onTurnCompleteRef.current(turn.speaker);
      }
    },
    [maybeTriggerScopeWarning, safeSetState],
  );

  const endSession = useCallback(() => {
    cancelActiveResponse();
    teardown();
    safeSetState(() => {
      setConnectionStatus("ended");
      setMicrophoneStatus("off");
      setCurrentTranslatedText("");
      setTurns([]);
      setErrorKey("");
    });
    pendingOriginalRef.current = "";
    currentTranslatedRef.current = "";
    lastTurnSignatureRef.current = "";
    introPlayedRef.current = false;
    sessionActivationPlayedRef.current = false;
    skipActivationFeedbackRef.current = false;
    pendingPlanBRef.current = null;
  }, [cancelActiveResponse, safeSetState, teardown]);

  /** Stop WebRTC/mic but keep turns in memory for PDF export. */
  const disconnectSession = useCallback(() => {
    cancelActiveResponse();
    pendingPlanBRef.current = null;
    pendingOriginalRef.current = "";
    responseActiveRef.current = false;
    awaitingIntroResponseRef.current = false;
    pauseSessionTimer();
    const finalElapsed = getSessionActiveElapsedMs();
    teardown();
    safeSetState(() => {
      setConnectionStatus("ended");
      setMicrophoneStatus("off");
      setCurrentTranslatedText("");
      setErrorKey("");
      setSessionElapsedMs(finalElapsed);
    });
    currentTranslatedRef.current = "";
    lastTurnSignatureRef.current = "";
    introPlayedRef.current = false;
    sessionActivationPlayedRef.current = false;
    skipActivationFeedbackRef.current = false;
  }, [cancelActiveResponse, getSessionActiveElapsedMs, pauseSessionTimer, safeSetState, teardown]);

  const stopVoiceOutput = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      try {
        audioElRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    cancelActiveResponse();
    safeSetState(() => {
      if (!pausedRef.current && connectionStatusRef.current !== "ended") {
        setConnectionStatus("listening");
      }
    });
  }, [cancelActiveResponse, safeSetState]);

  const pauseConversation = useCallback(() => {
    if (
      pausedRef.current ||
      connectionStatusRef.current === "ended" ||
      connectionStatusRef.current === "idle"
    ) {
      return;
    }
    pausedRef.current = true;
    pauseSessionTimer();
    stopVoiceOutput();
    pendingPlanBRef.current = null;
    pendingOriginalRef.current = "";
    pendingSpeakerUpdateRef.current = false;
    if (speakerUpdateTimerRef.current) {
      clearTimeout(speakerUpdateTimerRef.current);
      speakerUpdateTimerRef.current = null;
    }
    if (micTrackRef.current) {
      micTrackRef.current.enabled = false;
    }
    safeSetState(() => {
      setConnectionStatus("paused");
      setMicrophoneStatus("off");
      setSessionElapsedMs(getSessionActiveElapsedMs());
    });
  }, [getSessionActiveElapsedMs, pauseSessionTimer, safeSetState, stopVoiceOutput]);

  const resumeConversation = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    resumeSessionTimer();
    if (micTrackRef.current) {
      micTrackRef.current.enabled = true;
    }
    safeSetState(() => {
      setConnectionStatus("listening");
      setMicrophoneStatus("on");
    });
  }, [resumeSessionTimer, safeSetState]);

  const confirmScopeContinue = useCallback(() => {
    scopeContinueRef.current = true;
    scopeWarningShownRef.current = false;
    scopeSoftWarningShownRef.current = false;
    scopeTranslationPausedRef.current = false;
    if (pausedRef.current) {
      resumeConversation();
    }
  }, [resumeConversation]);

  const speakExactText = useCallback(
    (text, planB) => {
      const dc = dcRef.current;
      const trimmed = text?.trim();
      if (!dc || dc.readyState !== "open" || !trimmed || pausedRef.current) return false;

      pendingPlanBRef.current = planB;
      cancelActiveResponse();
      responseActiveRef.current = true;
      suppressMicForMedaOutput();
      safeSetState(() => setConnectionStatus("speaking"));
      logCostGuard("response_create_sent", { purpose: "speak_exact", textLength: trimmed.length });
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            output_modalities: ["audio"],
            instructions: `Say exactly and only the following in a calm, professional tone. Do not translate, add, or change anything: "${trimmed}"`,
          },
        }),
      );
      return true;
    },
    [cancelActiveResponse, safeSetState, suppressMicForMedaOutput],
  );

  const requestFaithfulTranslationRetry = useCallback(
    (sourceText, routing) => {
      const dc = dcRef.current;
      const trimmed = sourceText?.trim();
      if (!dc || dc.readyState !== "open" || !trimmed || pausedRef.current) return false;

      turnContextRef.current = routing;
      pendingPlanBRef.current = { type: "scopeRetry", sourceText: trimmed, routing };
      cancelActiveResponse();
      responseActiveRef.current = true;
      suppressMicForMedaOutput();
      safeSetState(() => setConnectionStatus("translating"));

      const hint = buildFaithfulRetryInstructions(routing);
      logCostGuard("response_create_sent", { purpose: "faithful_retry", finalTranscriptLength: trimmed.length });
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            output_modalities: ["audio"],
            instructions: `${hint}\n\nTranslate ONLY this ${routing.sourceLanguageName} statement into ${routing.targetLanguageName}. Output ONLY the translation, spoken aloud:\n"${trimmed}"`,
          },
        }),
      );
      return true;
    },
    [cancelActiveResponse, safeSetState, suppressMicForMedaOutput],
  );

  const requestFaithfulTranslation = useCallback(
    (sourceText, routing, planB) => {
      const dc = dcRef.current;
      const trimmed = sourceText?.trim();
      if (!dc || dc.readyState !== "open" || !trimmed || pausedRef.current) return false;

      turnContextRef.current = routing;
      pendingPlanBRef.current = planB;
      cancelActiveResponse();
      responseActiveRef.current = true;
      suppressMicForMedaOutput();
      safeSetState(() => setConnectionStatus("translating"));

      const compactHint = buildCompactClientInstructions(routing);
      logCostGuard("response_create_sent", { purpose: "faithful_translation", finalTranscriptLength: trimmed.length });
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            output_modalities: ["audio"],
            instructions: `${compactHint}\n\nTranslate ONLY this ${routing.sourceLanguageName} statement into ${routing.targetLanguageName}. Output ONLY the translation, spoken aloud:\n"${trimmed}"`,
          },
        }),
      );
      return true;
    },
    [cancelActiveResponse, safeSetState, suppressMicForMedaOutput],
  );

  const replayLatestTranslation = useCallback(() => {
    const text = latestReplayTextRef.current || currentTranslatedRef.current;
    if (!text.trim()) return false;

    safeSetState(() => {
      setTurns((prev) => {
        if (!prev.length) return prev;
        const copy = [...prev];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, status: "replayed" };
        return copy;
      });
    });

    return speakExactText(text, { type: "replay" });
  }, [safeSetState, speakExactText]);

  const submitCorrection = useCallback(
    (correctedSourceText, correctsTurnId) => {
      const wrongTurn = turnsRef.current.find((t) => t.id === correctsTurnId);
      const routing = buildLanguageRouting(sessionConfigRef.current);
      return requestFaithfulTranslation(correctedSourceText, routing, {
        type: "correction",
        sourceText: correctedSourceText.trim(),
        correctsTurnId,
        routing,
        wrongOriginalText: wrongTurn?.originalText,
        wrongTranslatedText: wrongTurn?.translatedText,
      });
    },
    [requestFaithfulTranslation],
  );

  const askToRepeat = useCallback(() => {
    const routing = buildLanguageRouting(sessionConfigRef.current);
    const phrase = getMedaUnclearRepeatPhrase(routing.targetLanguage);
    return speakExactText(phrase, { type: "repeat", phrase });
  }, [speakExactText]);

  const buildRoutingForTurn = useCallback((turn) => {
    const cfg = sessionConfigRef.current;
    return buildLanguageRouting({
      patientLanguage: cfg.patientLanguage,
      doctorLanguage: cfg.doctorLanguage,
      activeSpeaker: turn.speaker,
    });
  }, []);

  const askToRepeatForTurn = useCallback(
    (turn) => {
      if (pausedRef.current || !connectedRef.current || !turn) return false;
      const phrase = getMedaUnclearRepeatPhrase(turn.targetLanguage);
      const routing = buildRoutingForTurn(turn);
      turnContextRef.current = routing;
      return speakExactText(phrase, { type: "repeat", phrase, routing });
    },
    [buildRoutingForTurn, speakExactText],
  );

  const submitCorrectionForTurn = useCallback(
    (text, turn, mode = "source") => {
      if (!turn?.id || !text?.trim()) return false;
      const wrongTurn = turnsRef.current.find((item) => item.id === turn.id);
      const routing = buildRoutingForTurn(turn);
      const trimmed = text.trim();

      if (mode === "translation") {
        appendTurn(wrongTurn?.originalText || "", trimmed, {
          status: "corrected",
          correctsTurnId: turn.id,
          wrongOriginalText: wrongTurn?.originalText,
          wrongTranslatedText: wrongTurn?.translatedText,
          allowDuplicate: true,
          speaker: turn.speaker,
          sourceLanguage: turn.sourceLanguage,
          targetLanguage: turn.targetLanguage,
        });
        turnContextRef.current = routing;
        return speakExactText(trimmed, { type: "replay" });
      }

      return requestFaithfulTranslation(trimmed, routing, {
        type: "correction",
        sourceText: trimmed,
        correctsTurnId: turn.id,
        routing,
        wrongOriginalText: wrongTurn?.originalText,
        wrongTranslatedText: wrongTurn?.translatedText,
      });
    },
    [appendTurn, buildRoutingForTurn, requestFaithfulTranslation, speakExactText],
  );

  const clearPendingFinalizeTimer = useCallback(() => {
    if (pendingFinalizeTimerRef.current) {
      clearTimeout(pendingFinalizeTimerRef.current);
      pendingFinalizeTimerRef.current = null;
    }
  }, []);

  const resetTurnCaptureState = useCallback(() => {
    clearPendingFinalizeTimer();
    pendingTranslatedForTurnRef.current = "";
    inputTranscriptStateRef.current = "pending";
    pendingOriginalRef.current = "";
    lastDetectedLanguageRef.current = null;
    translationDriftRetryAttemptedRef.current = false;
  }, [clearPendingFinalizeTimer]);

  const notifyTurnIssue = useCallback((reason, options = {}) => {
    onUnclearTurnRef.current?.({
      reason,
      overlapDetected: Boolean(options.overlapDetected),
      missingOriginal: Boolean(options.missingOriginal),
    });
  }, []);

  const triggerLocalUnclearRepeat = useCallback(
    (routing, reason, overlapDetected = false) => {
      if (pausedRef.current || !connectedRef.current) return false;
      const phrase = getMedaUnclearRepeatPhrase(routing.targetLanguage);
      pendingOriginalRef.current = "";
      pendingTranslatedForTurnRef.current = "";
      pendingPlanBRef.current = null;
      inputTranscriptStateRef.current = "empty";
      notifyTurnIssue(reason, { overlapDetected, missingOriginal: true });
      logCostGuard("response_create_skipped", {
        reason,
        skippedBecause: reason,
      });
      safeSetState(() => {
        setCurrentTranslatedText(phrase);
        if (connectionStatusRef.current !== "paused") {
          setConnectionStatus("listening");
        }
      });
      return true;
    },
    [notifyTurnIssue, safeSetState],
  );

  const triggerUnclearRepeat = useCallback(
    (routing, overlapDetected = false, reason = "unclear", options = {}) => {
      if (pausedRef.current || !connectedRef.current) return false;
      const recordHistory = options.recordHistory !== false;
      if (!recordHistory) {
        return triggerLocalUnclearRepeat(routing, reason, overlapDetected);
      }
      const phrase = getMedaUnclearRepeatPhrase(routing.targetLanguage);
      pendingOriginalRef.current = "";
      pendingPlanBRef.current = {
        type: "unclearRepeat",
        phrase,
        routing,
        overlapDetected,
        recordHistory,
      };
      notifyTurnIssue(reason, { overlapDetected, missingOriginal: reason === "asr_failed" });
      cancelActiveResponse();
      return speakExactText(phrase, {
        type: "unclearRepeat",
        phrase,
        routing,
        overlapDetected,
        recordHistory,
      });
    },
    [cancelActiveResponse, notifyTurnIssue, speakExactText, triggerLocalUnclearRepeat],
  );

  const triggerWrongLanguageRepeat = useCallback(
    (routing, detectedLanguage = null, options = {}) => {
      if (pausedRef.current || !connectedRef.current) return false;
      const phrase = getWrongLanguagePhrase(routing.targetLanguage);
      const recordHistory = options.recordHistory !== false;
      pendingOriginalRef.current = "";
      pendingPlanBRef.current = {
        type: "wrongLanguageRepeat",
        phrase,
        routing,
        detectedLanguage,
        recordHistory,
      };
      onWrongLanguagePairRef.current?.({ detectedLanguage });
      cancelActiveResponse();
      if (!recordHistory) {
        return speakExactText(phrase, { type: "spokenNotice", phrase });
      }
      return speakExactText(phrase, {
        type: "wrongLanguageRepeat",
        phrase,
        routing,
        detectedLanguage,
        recordHistory,
      });
    },
    [cancelActiveResponse, speakExactText],
  );

  const executeBufferedFinalize = useCallback(
    (translated) => {
      if (pausedRef.current) return;
      if (scopeTranslationPausedRef.current) {
        pendingTranslatedForTurnRef.current = "";
        return;
      }

      clearPendingFinalizeTimer();
      pendingTranslatedForTurnRef.current = "";

      const routing = turnContextRef.current;
      const overlap = overlapDetectedRef.current;
      overlapDetectedRef.current = false;
      const original = String(pendingOriginalRef.current || "").trim();
      const translatedTrimmed = String(translated || "").trim();
      const inputState = inputTranscriptStateRef.current;

      pendingOriginalRef.current = "";
      inputTranscriptStateRef.current = "pending";

      if (inputState === "failed") {
        triggerUnclearRepeat(routing, overlap, "asr_failed", { recordHistory: false });
        return;
      }

      if (!translatedTrimmed || isMedaUnclearPhrase(translatedTrimmed)) {
        triggerUnclearRepeat(routing, overlap, "translation_failed", { recordHistory: false });
        return;
      }

      if (!original || isLikelyEmptyOrNoiseTranscript(original)) {
        const reason = overlap ? "overlap" : "asr_failed";
        triggerUnclearRepeat(routing, overlap, reason, { recordHistory: false });
        return;
      }

      const cfg = sessionConfigRef.current;
      if (
        languageBasedRoutingRef.current &&
        isLanguageRoutingEnabled(cfg.patientLanguage, cfg.doctorLanguage) &&
        lastDetectedLanguageRef.current &&
        !isLanguageInSelectedPair(
          lastDetectedLanguageRef.current,
          cfg.patientLanguage,
          cfg.doctorLanguage,
        )
      ) {
        triggerWrongLanguageRepeat(routing, lastDetectedLanguageRef.current);
        return;
      }

      const completedTurns = turnsRef.current.filter(
        (t) => t.status === "translated" || t.status === "corrected",
      ).length;
      const elapsed = getSessionActiveElapsedMs();

      if (
        shouldRetryScopeRefusal(
          completedTurns,
          elapsed,
          scopeContinueRef.current,
          original,
          translatedTrimmed,
        )
      ) {
        currentTranslatedRef.current = "";
        safeSetState(() => setCurrentTranslatedText(""));
        requestFaithfulTranslationRetry(original, routing);
        return;
      }

      if (isModelScopeRefusal(translatedTrimmed, instructionOptionsRef.current)) {
        if (!scopeWarningShownRef.current) {
          scopeWarningShownRef.current = true;
          onScopeWarningRef.current?.();
        }
        stopVoiceOutput();
        currentTranslatedRef.current = "";
        safeSetState(() => setCurrentTranslatedText(""));
        return;
      }

      if (isSemanticTranslationDrift(original, translatedTrimmed)) {
        if (!translationDriftRetryAttemptedRef.current) {
          translationDriftRetryAttemptedRef.current = true;
          stopVoiceOutput();
          currentTranslatedRef.current = "";
          safeSetState(() => setCurrentTranslatedText(""));
          requestFaithfulTranslationRetry(original, routing);
          return;
        }
        triggerUnclearRepeat(routing, overlap, "translation_failed", { recordHistory: false });
        return;
      }

      appendTurn(original, translatedTrimmed, { overlapDetected: overlap });
    },
    [
      appendTurn,
      clearPendingFinalizeTimer,
      getSessionActiveElapsedMs,
      requestFaithfulTranslationRetry,
      safeSetState,
      stopVoiceOutput,
      triggerUnclearRepeat,
      triggerWrongLanguageRepeat,
    ],
  );

  const maybeFlushPendingTurn = useCallback(() => {
    const pending = pendingTranslatedForTurnRef.current;
    if (!pending) return;
    if (
      canProceedToTranslation({
        transcript: pendingOriginalRef.current,
        inputState: inputTranscriptStateRef.current,
        scopeTranslationPaused: scopeTranslationPausedRef.current,
      })
    ) {
      executeBufferedFinalize(pending);
    }
  }, [executeBufferedFinalize]);

  const scheduleFinalizeTranslation = useCallback(
    (translated) => {
      pendingTranslatedForTurnRef.current = translated;

      if (
        canProceedToTranslation({
          transcript: pendingOriginalRef.current,
          inputState: inputTranscriptStateRef.current,
          scopeTranslationPaused: scopeTranslationPausedRef.current,
        })
      ) {
        executeBufferedFinalize(translated);
        return;
      }

      clearPendingFinalizeTimer();
      pendingFinalizeTimerRef.current = setTimeout(() => {
        pendingFinalizeTimerRef.current = null;
        if (
          canProceedToTranslation({
            transcript: pendingOriginalRef.current,
            inputState: inputTranscriptStateRef.current,
            scopeTranslationPaused: scopeTranslationPausedRef.current,
          })
        ) {
          executeBufferedFinalize(pendingTranslatedForTurnRef.current || translated);
          return;
        }
        pendingTranslatedForTurnRef.current = "";
        const routing = turnContextRef.current;
        triggerLocalUnclearRepeat(routing, "asr_failed", overlapDetectedRef.current);
      }, MAX_TRANSCRIPT_WAIT_MS);
    },
    [clearPendingFinalizeTimer, executeBufferedFinalize, triggerLocalUnclearRepeat],
  );

  const trySendMedaActivation = useCallback(() => {
    if (sessionActivationPlayedRef.current || skipActivationFeedbackRef.current) return false;

    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return false;
    if (!connectedRef.current) return false;

    const micTrack = micTrackRef.current;
    if (!micTrack || micTrack.readyState !== "live" || !micTrack.enabled) return false;

    sessionActivationPlayedRef.current = true;
    introPlayedRef.current = true;

    if (activationSoundEnabledRef.current) {
      playMedaActivationChime();
    }

    const phrase = activationReadinessTextRef.current?.trim();
    if (!phrase) {
      safeSetState(() => setConnectionStatus("listening"));
      return true;
    }

    awaitingIntroResponseRef.current = true;
    responseActiveRef.current = true;
    suppressMicForMedaOutput();
    safeSetState(() => setConnectionStatus("introducing"));
    logCostGuard("response_create_sent", { purpose: "activation_intro", textLength: phrase.length });
    dc.send(
      JSON.stringify({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions: `Say exactly and only the following in a calm, professional tone at a moderate pace. Do not add anything else: "${phrase}"`,
        },
      }),
    );
    return true;
  }, [safeSetState, suppressMicForMedaOutput]);

  const markRealtimeSessionConnected = useCallback(() => {
    if (sessionEstablishedRef.current) return;
    sessionEstablishedRef.current = true;
    connectedRef.current = true;
    logRealtimeConnect("session_connected", {
      dcState: dcRef.current?.readyState ?? "none",
      pcState: pcRef.current?.connectionState ?? "none",
      iceState: pcRef.current?.iceConnectionState ?? "none",
    });
    startSessionTimer();
    const activated = trySendMedaActivation();
    safeSetState(() => {
      setMicrophoneStatus("on");
      setSessionElapsedMs(0);
      if (
        !activated &&
        (connectionStatusRef.current === "connecting" ||
          connectionStatusRef.current === "reconnecting")
      ) {
        setConnectionStatus("listening");
      }
    });
  }, [safeSetState, startSessionTimer, trySendMedaActivation]);

  const sendSpeakerUpdateNow = useCallback(() => {
    if (!connectedRef.current || pausedRef.current) return;

    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") {
      pendingSpeakerUpdateRef.current = true;
      return;
    }

    pendingSpeakerUpdateRef.current = false;
    const routing = buildLanguageRouting(sessionConfigRef.current);
    turnContextRef.current = routing;

    const updateSig = `${routing.activeSpeaker}|${routing.sourceLanguage}|${routing.targetLanguage}`;
    if (updateSig === lastSessionUpdateSigRef.current) {
      return;
    }
    lastSessionUpdateSigRef.current = updateSig;

    if (responseActiveRef.current) {
      cancelActiveResponse();
    }

    const payload = buildRuntimeSessionUpdatePayload(
      routing,
      transcriptionModelRef.current,
    );
    logRealtimeDiag("session_update_send", {
      activeSpeaker: routing.activeSpeaker,
      sourceLanguage: routing.sourceLanguage,
      targetLanguage: routing.targetLanguage,
      reason: "language_routing",
      hasTranscriptionLanguage: Boolean(payload.session?.input_audio_transcription?.language),
    });
    dc.send(JSON.stringify(payload));

    if (!responseActiveRef.current && !pendingTranslatedForTurnRef.current) {
      currentTranslatedRef.current = "";
      lastTurnSignatureRef.current = "";
      safeSetState(() => {
        setCurrentTranslatedText("");
        if (
          connectionStatusRef.current !== "introducing" &&
          connectionStatusRef.current !== "speaking" &&
          connectionStatusRef.current !== "translating" &&
          connectionStatusRef.current !== "paused"
        ) {
          setConnectionStatus("listening");
        }
      });
    }
  }, [cancelActiveResponse, safeSetState]);

  const requestTurnTranslation = useCallback(
    (sourceText, routing) => {
      const dc = dcRef.current;
      const trimmed = sourceText?.trim();
      const dcState = dc?.readyState ?? "none";
      const transcriptKey = normalizeTranscriptKey(trimmed);

      const skip = (reason, extra = {}) => {
        logCostGuard("response_create_skipped", { reason, ...extra });
        console.debug("[MedaPipelineDebug] requestTurnTranslation blocked", {
          step: "step6_response_create",
          reason,
          ...extra,
        });
      };

      if (!dc || dcState !== "open" || pausedRef.current) {
        skip(!dc ? "no_dc" : dcState !== "open" ? "dc_not_open" : "paused", { dcState });
        return false;
      }

      if (!trimmed || isLikelyEmptyOrNoiseTranscript(trimmed)) {
        triggerLocalUnclearRepeat(routing, "empty");
        return false;
      }

      if (trimmed.length < MIN_STABLE_TRANSCRIPT_CHARS) {
        triggerLocalUnclearRepeat(routing, "tooShort");
        return false;
      }

      if (responseActiveRef.current) {
        skip("responding", { finalTranscriptLength: trimmed.length });
        return false;
      }

      if (
        transcriptKey &&
        transcriptKey === lastResponseCreateTranscriptRef.current
      ) {
        skip("duplicate", { finalTranscriptLength: trimmed.length });
        return false;
      }

      const cfg = sessionConfigRef.current;
      if (scopeTranslationPausedRef.current) {
        skip("scope_paused");
        return false;
      }
      if (
        !canProceedToTranslation({
          transcript: trimmed,
          inputState: inputTranscriptStateRef.current,
          scopeTranslationPaused: scopeTranslationPausedRef.current,
        })
      ) {
        triggerLocalUnclearRepeat(routing, "uncertain");
        return false;
      }
      if (!isTargetLanguageInPair(routing.targetLanguage, cfg.patientLanguage, cfg.doctorLanguage)) {
        skip("target_language_not_in_pair");
        triggerWrongLanguageRepeat(routing, lastDetectedLanguageRef.current);
        return false;
      }

      turnContextRef.current = routing;
      cancelActiveResponse();
      responseActiveRef.current = true;
      lastResponseCreateTranscriptRef.current = transcriptKey;
      suppressMicForMedaOutput();
      safeSetState(() => setConnectionStatus("translating"));

      logCostGuard("response_create_sent", {
        finalTranscriptLength: trimmed.length,
        finalTranscript: import.meta.env.DEV ? trimmed : undefined,
        activeSpeaker: routing.activeSpeaker,
        sourceLanguage: routing.sourceLanguage,
        targetLanguage: routing.targetLanguage,
      });

      console.debug("[MedaPipelineDebug] response.create sent", {
        step: "step6_response_create",
        activeSpeaker: routing.activeSpeaker,
        sourceLanguage: routing.sourceLanguage,
        targetLanguage: routing.targetLanguage,
        transcriptLength: trimmed.length,
        dcState,
      });

      const hint = buildCompactClientInstructions(routing);
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            output_modalities: ["audio"],
            instructions: `${hint}\n\nSource (${routing.sourceLanguage}): "${trimmed}"`,
          },
        }),
      );
      return true;
    },
    [
      cancelActiveResponse,
      safeSetState,
      suppressMicForMedaOutput,
      triggerLocalUnclearRepeat,
      triggerWrongLanguageRepeat,
    ],
  );

  const switchSpeakerFromDetectedLanguage = useCallback(
    (detected, transcript = "") => {
      if (!languageBasedRoutingRef.current || skipLanguageRoutingRef?.current) {
        return false;
      }

      const cfg = sessionConfigRef.current;
      if (!isLanguageRoutingEnabled(cfg.patientLanguage, cfg.doctorLanguage)) {
        return false;
      }

      let lang = detected;
      if (!lang || !String(lang).trim()) {
        lang = inferLanguageFromTranscript(transcript, cfg.patientLanguage, cfg.doctorLanguage);
      }

      const result = resolveSpeakerFromDetectedLanguage(
        lang,
        cfg.patientLanguage,
        cfg.doctorLanguage,
        cfg.activeSpeaker,
      );

      if (!result.routingEnabled) return false;

      if (result.reason === "outside_pair") {
        onWrongLanguagePairRef.current?.({ detectedLanguage: lang });
        return false;
      }

      if (result.uncertain) {
        if (String(transcript || "").trim().length >= 8) {
          onLanguageUncertainRef.current?.();
        }
        return false;
      }

      onLanguageUncertainRef.current?.(false);

      if (result.speaker !== cfg.activeSpeaker) {
        sessionConfigRef.current = {
          ...cfg,
          activeSpeaker: result.speaker,
        };
        if (responseActiveRef.current) {
          cancelActiveResponse();
        }
        onSpeakerFromLanguageRef.current?.(result.speaker);
        sendSpeakerUpdateNow();
        return true;
      }

      return false;
    },
    [cancelActiveResponse, sendSpeakerUpdateNow, skipLanguageRoutingRef],
  );

  const applyLanguageRouting = useCallback(
    (event) => {
      const transcript = extractOriginalText(event);
      const detected = extractDetectedLanguage(event);
      switchSpeakerFromDetectedLanguage(detected, transcript);
    },
    [switchSpeakerFromDetectedLanguage],
  );

  const finalizeTranslationOutput = useCallback(
    (translated) => {
      if (pausedRef.current) return;

      if (awaitingIntroResponseRef.current) {
        awaitingIntroResponseRef.current = false;
        pendingPlanBRef.current = null;
        pendingOriginalRef.current = "";
        return;
      }

      const planB = pendingPlanBRef.current;
      if (planB?.type === "correction") {
        appendTurn(planB.sourceText, translated, {
          status: "corrected",
          correctsTurnId: planB.correctsTurnId,
          wrongOriginalText: planB.wrongOriginalText,
          wrongTranslatedText: planB.wrongTranslatedText,
          allowDuplicate: true,
          speaker: planB.routing.activeSpeaker,
          sourceLanguage: planB.routing.sourceLanguage,
          targetLanguage: planB.routing.targetLanguage,
        });
        pendingPlanBRef.current = null;
        return;
      }

      if (planB?.type === "replay" || planB?.type === "repeat") {
        latestReplayTextRef.current = translated;
        safeSetState(() => setCurrentTranslatedText(translated));
        pendingPlanBRef.current = null;
        return;
      }

      if (planB?.type === "spokenNotice") {
        currentTranslatedRef.current = translated;
        safeSetState(() => setCurrentTranslatedText(translated));
        pendingPlanBRef.current = null;
        pendingOriginalRef.current = "";
        return;
      }

      if (planB?.type === "unclearRepeat") {
        if (planB.recordHistory !== false) {
          appendTurn("", translated, {
            status: "unclear",
            overlapDetected: Boolean(planB.overlapDetected),
            allowDuplicate: true,
            speaker: planB.routing.activeSpeaker,
            sourceLanguage: planB.routing.sourceLanguage,
            targetLanguage: planB.routing.targetLanguage,
          });
        } else {
          currentTranslatedRef.current = translated;
          safeSetState(() => setCurrentTranslatedText(translated));
        }
        pendingPlanBRef.current = null;
        return;
      }

      if (planB?.type === "wrongLanguageRepeat") {
        if (planB.recordHistory !== false) {
          appendTurn("", translated, {
            status: "wrongLanguage",
            detectedLanguage: planB.detectedLanguage ?? lastDetectedLanguageRef.current,
            allowDuplicate: true,
            speaker: planB.routing.activeSpeaker,
            sourceLanguage: planB.routing.sourceLanguage,
            targetLanguage: planB.routing.targetLanguage,
          });
        } else {
          currentTranslatedRef.current = translated;
          safeSetState(() => setCurrentTranslatedText(translated));
        }
        pendingPlanBRef.current = null;
        return;
      }

      if (planB?.type === "scopeRetry") {
        appendTurn(planB.sourceText, translated, {
          speaker: planB.routing.activeSpeaker,
          sourceLanguage: planB.routing.sourceLanguage,
          targetLanguage: planB.routing.targetLanguage,
          allowDuplicate: true,
        });
        pendingPlanBRef.current = null;
        return;
      }

      scheduleFinalizeTranslation(translated);
    },
    [scheduleFinalizeTranslation],
  );

  const setActivityStatus = useCallback(
    (status) => {
      if (pausedRef.current) return;
      safeSetState(() => setConnectionStatus(status));
    },
    [safeSetState],
  );

  const handleServerEvent = useCallback(
    (event) => {
      if (!event || typeof event !== "object") return;
      const type = event.type;

      const blockedDuringMedaOutput = [
        "input_audio_buffer.speech_started",
        "input_audio_buffer.speech_stopped",
        "conversation.item.input_audio_transcription.completed",
        "conversation.item.input_audio_transcription.failed",
        "input_audio_buffer.transcription.completed",
        "input_audio_buffer.transcription.failed",
        "conversation.item.input_audio_transcription.delta",
        "input_audio_buffer.transcription.delta",
      ];
      if (inputSuppressedRef.current && blockedDuringMedaOutput.includes(type)) {
        logCostGuard("input_ignored_during_output", { eventType: type });
        return;
      }

      if (pausedRef.current) {
        const blockedWhilePaused = [
          "input_audio_buffer.speech_started",
          "input_audio_buffer.speech_stopped",
          "conversation.item.input_audio_transcription.completed",
          "conversation.item.input_audio_transcription.failed",
          "input_audio_buffer.transcription.completed",
          "input_audio_buffer.transcription.failed",
          "conversation.item.input_audio_transcription.delta",
          "input_audio_buffer.transcription.delta",
          "response.created",
          "response.output_item.added",
          "response.audio.delta",
          "response.output_audio.delta",
          "response.audio_transcript.delta",
          "response.output_audio_transcript.delta",
          "response.output_audio_transcript.done",
          "response.audio_transcript.done",
          "response.text.done",
          "response.output_text.done",
          "response.content_part.done",
          "response.done",
          "conversation.item.created",
        ];
        if (blockedWhilePaused.includes(type)) return;
      }

      if (type === "session.created" || type === "session.updated") {
        logRealtimeConnect("openai_session_event", { eventType: type });
        markRealtimeSessionConnected();
        return;
      }

      if (type === "input_audio_buffer.speech_started") {
        const prevStatus = connectionStatusRef.current;
        if (prevStatus === "speaking" || prevStatus === "translating") {
          overlapDetectedRef.current = true;
        }
        turnContextRef.current = buildLanguageRouting(sessionConfigRef.current);
        const inFlightTurn =
          responseActiveRef.current ||
          Boolean(pendingTranslatedForTurnRef.current) ||
          (inputTranscriptStateRef.current === "ready" &&
            String(pendingOriginalRef.current || "").trim().length > 0);
        if (!inFlightTurn) {
          resetTurnCaptureState();
          lastResponseCreateTranscriptRef.current = "";
          currentTranslatedRef.current = "";
          safeSetState(() => setCurrentTranslatedText(""));
        }
        setActivityStatus("listening");
        return;
      }

      if (type === "input_audio_buffer.speech_stopped") {
        setActivityStatus("listening");
        return;
      }

      if (isInputTranscriptionFailedEvent(event)) {
        logTranscriptionEventMeta(event);
        inputTranscriptStateRef.current = "failed";
        if (pendingTranslatedForTurnRef.current) {
          executeBufferedFinalize(pendingTranslatedForTurnRef.current);
        }
        return;
      }

      if (isInputTranscriptionCompletedEvent(event)) {
        logTranscriptionEventMeta(event);
        const transcript = extractOriginalText(event);
        const routing = buildLanguageRouting(sessionConfigRef.current);
        const cfg = sessionConfigRef.current;
        const detected = extractDetectedLanguage(event);
        lastDetectedLanguageRef.current = detected || null;

        logCostGuard("final_transcript", {
          eventType: event.type,
          finalTranscriptLength: transcript?.length ?? 0,
          finalTranscript: import.meta.env.DEV ? transcript : undefined,
          responseActive: responseActiveRef.current,
        });

        console.debug("[MedaPipelineDebug] input transcription completed", {
          step: "step3_transcription_completed",
          eventType: event.type,
          hasTranscript: Boolean(transcript && transcript.length > 0),
          transcriptLength: transcript?.length ?? 0,
          detectedLanguage: detected || null,
          activeSpeaker: cfg.activeSpeaker,
          sourceLanguage: routing.sourceLanguage,
          targetLanguage: routing.targetLanguage,
          responseActiveAtArrival: responseActiveRef.current,
          pendingTranslated: Boolean(pendingTranslatedForTurnRef.current),
          inputStateBeforeUpdate: inputTranscriptStateRef.current,
        });

        if (responseActiveRef.current || inputSuppressedRef.current) {
          logCostGuard("response_create_skipped", {
            reason: "responding",
            finalTranscriptLength: transcript?.length ?? 0,
          });
          return;
        }

        if (transcript && !isLikelyEmptyOrNoiseTranscript(transcript)) {
          if (transcript.trim().length < MIN_STABLE_TRANSCRIPT_CHARS) {
            triggerLocalUnclearRepeat(routing, "tooShort", overlapDetectedRef.current);
            return;
          }
          pendingOriginalRef.current = transcript;
          inputTranscriptStateRef.current = "ready";
          const resolvedLang =
            detected ||
            inferLanguageFromTranscript(transcript, cfg.patientLanguage, cfg.doctorLanguage);
          lastDetectedLanguageRef.current = resolvedLang || null;

          if (
            languageBasedRoutingRef.current &&
            isLanguageRoutingEnabled(cfg.patientLanguage, cfg.doctorLanguage) &&
            resolvedLang &&
            !isLanguageInSelectedPair(resolvedLang, cfg.patientLanguage, cfg.doctorLanguage)
          ) {
            triggerWrongLanguageRepeat(routing, resolvedLang);
            return;
          }

          switchSpeakerFromDetectedLanguage(resolvedLang, transcript);
          const routingAfterSwitch = buildLanguageRouting(sessionConfigRef.current);

          if (
            canProceedToTranslation({
              transcript,
              inputState: "ready",
              scopeTranslationPaused: scopeTranslationPausedRef.current,
            }) &&
            !pendingTranslatedForTurnRef.current
          ) {
            requestTurnTranslation(transcript, routingAfterSwitch);
          }

          maybeFlushPendingTurn();
          return;
        }

        inputTranscriptStateRef.current = "empty";
        triggerLocalUnclearRepeat(routing, "empty", overlapDetectedRef.current);
        maybeFlushPendingTurn();
        return;
      }

      if (
        type === "conversation.item.input_audio_transcription.delta" ||
        type === "input_audio_buffer.transcription.delta"
      ) {
        const transcript = extractOriginalText(event);
        if (transcript && !isLikelyEmptyOrNoiseTranscript(transcript)) {
          pendingOriginalRef.current = `${pendingOriginalRef.current}${transcript}`;
          const detected = extractDetectedLanguage(event);
          if (detected) {
            lastDetectedLanguageRef.current = detected;
          }
        }
        return;
      }

      if (
        type === "response.audio_transcript.delta" ||
        type === "response.output_audio_transcript.delta"
      ) {
        const delta =
          typeof event.delta === "string"
            ? event.delta
            : extractTranslatedText(event);
        console.debug("[MedaPipelineDebug] audio transcript delta", {
          step: "step7_transcript_delta",
          eventType: type,
          hasDelta: Boolean(delta),
          accumulatedLength: currentTranslatedRef.current.length + (delta?.length ?? 0),
        });
        if (delta) {
          currentTranslatedRef.current += delta;
          safeSetState(() => {
            setCurrentTranslatedText(currentTranslatedRef.current);
            setActivityStatus("speaking");
          });
        } else {
          setActivityStatus("speaking");
        }
        return;
      }

      if (type === "response.created" || type === "response.output_item.added") {
        console.debug("[MedaPipelineDebug] response lifecycle event", {
          step: "step7_response_created",
          eventType: type,
          responseActiveBefore: responseActiveRef.current,
        });
        responseActiveRef.current = true;
        setActivityStatus("translating");
        return;
      }

      if (type === "response.audio.delta" || type === "response.output_audio.delta") {
        setActivityStatus("speaking");
        return;
      }

      if (
        type === "response.output_audio_transcript.done" ||
        type === "response.audio_transcript.done"
      ) {
        const translated =
          extractTranslatedText(event) || currentTranslatedRef.current;
        console.debug("[MedaPipelineDebug] audio transcript done", {
          step: "step8_transcript_done",
          eventType: type,
          hasTranslation: Boolean(translated),
          translationLength: translated?.length ?? 0,
          inputState: inputTranscriptStateRef.current,
          pendingOriginalLength: String(pendingOriginalRef.current || "").length,
        });
        if (translated) {
          currentTranslatedRef.current = translated;
          finalizeTranslationOutput(translated);
        }
        responseActiveRef.current = false;
        logCostGuard("response_done", {
          eventType: type,
          outputPlaybackActive: outputPlaybackActiveRef.current,
        });
        if (!outputPlaybackActiveRef.current) {
          resumeMicAfterMedaOutput();
        }
        if (pendingRepeatSpeechRef.current) {
          const { phrase, type: repeatType } = pendingRepeatSpeechRef.current;
          pendingRepeatSpeechRef.current = null;
          const routing = turnContextRef.current;
          speakExactText(phrase, { type: repeatType, phrase, routing });
        }
        safeSetState(() => {
          if (pausedRef.current) {
            setConnectionStatus("paused");
            return;
          }
          if (awaitingIntroResponseRef.current) {
            awaitingIntroResponseRef.current = false;
            setConnectionStatus("listening");
            return;
          }
          setConnectionStatus("listening");
        });
        return;
      }

      if (
        type === "response.text.done" ||
        type === "response.output_text.done" ||
        type === "response.content_part.done"
      ) {
        const translated =
          extractTranslatedText(event) || currentTranslatedRef.current;
        if (translated && !pausedRef.current && !awaitingIntroResponseRef.current) {
          currentTranslatedRef.current = translated;
          safeSetState(() => setCurrentTranslatedText(translated));
          finalizeTranslationOutput(translated);
        } else if (translated && !pausedRef.current) {
          currentTranslatedRef.current = translated;
          safeSetState(() => setCurrentTranslatedText(translated));
        }
        safeSetState(() => {
          setConnectionStatus(pausedRef.current ? "paused" : "listening");
        });
        return;
      }

      if (type === "response.done") {
        const isCancelledOrFailed = isCancelledOrFailedResponseDone(event);
        const fromResponseText = extractTranslatedTextFromResponse(event);
        console.debug("[MedaPipelineDebug] response.done", {
          step: "step8_response_done",
          isCancelledOrFailed,
          hasTranslation: Boolean(fromResponseText),
          translationLength: fromResponseText?.length ?? 0,
          inputState: inputTranscriptStateRef.current,
        });
        responseActiveRef.current = false;
        logCostGuard("response_done", {
          eventType: type,
          isCancelledOrFailed,
          outputPlaybackActive: outputPlaybackActiveRef.current,
        });
        if (!isCancelledOrFailed && !outputPlaybackActiveRef.current) {
          resumeMicAfterMedaOutput();
        }
        if (isCancelledOrFailed) {
          logRealtimeDiag("response_done_non_success", summarizeRealtimeEvent(event));
          safeSetState(() => {
            setConnectionStatus(pausedRef.current ? "paused" : "listening");
          });
          return;
        }

        if (
          fromResponseText &&
          !pausedRef.current &&
          !awaitingIntroResponseRef.current &&
          !pendingPlanBRef.current
        ) {
          currentTranslatedRef.current = fromResponseText;
          safeSetState(() => setCurrentTranslatedText(fromResponseText));
          finalizeTranslationOutput(fromResponseText);
        }

        safeSetState(() => {
          if (awaitingIntroResponseRef.current) {
            awaitingIntroResponseRef.current = false;
          }
          setConnectionStatus(pausedRef.current ? "paused" : "listening");
        });
        return;
      }

      if (type === "error") {
        const summary = summarizeRealtimeEvent(event);
        const classified = classifyRealtimeError(event);
        console.debug("[MedaPipelineDebug] error event received", {
          step: "step9_error",
          errorCode: event?.error?.code ?? null,
          errorType: event?.error?.type ?? null,
          fatal: classified.fatal,
          ignorable: classified.ignorable,
          dcState: dcRef.current?.readyState ?? "none",
        });
        logRealtimeDiag("realtime_error", { ...summary, ...classified });

        if (Date.now() < suppressErrorsUntilRef.current) return;
        if (classified.ignorable) return;

        const dcOpen = dcRef.current?.readyState === "open";
        const pc = pcRef.current;
        const pcState = pc?.connectionState;
        const pcFailed = pcState === "failed" || pcState === "closed";

        if (classified.fatal || !dcOpen || pcFailed) {
          safeSetState(() => {
            setConnectionStatus("error");
            setErrorKey("realtimeChannelError");
          });
          return;
        }

        // Transient error while channel still open — stay connected, do not collapse session.
        logRealtimeDiag("realtime_error_recoverable", summary);
        return;
      }
    },
    [
      cancelActiveResponse,
      executeBufferedFinalize,
      finalizeTranslationOutput,
      markRealtimeSessionConnected,
      maybeFlushPendingTurn,
      requestTurnTranslation,
      resetTurnCaptureState,
      safeSetState,
      setActivityStatus,
      speakExactText,
      switchSpeakerFromDetectedLanguage,
      startSessionTimer,
      triggerLocalUnclearRepeat,
      triggerWrongLanguageRepeat,
      resumeMicAfterMedaOutput,
    ],
  );

  const sendSpeakerUpdate = useCallback(() => {
    if (!connectedRef.current || pausedRef.current) return;

    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") {
      pendingSpeakerUpdateRef.current = true;
      return;
    }

    pendingSpeakerUpdateRef.current = false;
    const routing = buildLanguageRouting(sessionConfigRef.current);
    turnContextRef.current = routing;

    const updateSig = `${routing.activeSpeaker}|${routing.sourceLanguage}|${routing.targetLanguage}`;
    if (updateSig === lastSessionUpdateSigRef.current) {
      return;
    }
    lastSessionUpdateSigRef.current = updateSig;

    cancelActiveResponse();

    const payload = buildRuntimeSessionUpdatePayload(
      routing,
      transcriptionModelRef.current,
    );
    logRealtimeDiag("session_update_send", {
      activeSpeaker: routing.activeSpeaker,
      sourceLanguage: routing.sourceLanguage,
      targetLanguage: routing.targetLanguage,
      hasTranscriptionLanguage: Boolean(payload.session?.input_audio_transcription?.language),
    });
    dc.send(JSON.stringify(payload));

    if (!responseActiveRef.current && !pendingTranslatedForTurnRef.current) {
      currentTranslatedRef.current = "";
      lastTurnSignatureRef.current = "";
      safeSetState(() => {
        setCurrentTranslatedText("");
        if (
          connectionStatusRef.current !== "introducing" &&
          connectionStatusRef.current !== "speaking" &&
          connectionStatusRef.current !== "translating" &&
          connectionStatusRef.current !== "paused"
        ) {
          setConnectionStatus("listening");
        }
      });
    }
  }, [cancelActiveResponse, safeSetState]);

  const scheduleSpeakerUpdate = useCallback(() => {
    pendingSpeakerUpdateRef.current = true;
    if (speakerUpdateTimerRef.current) {
      clearTimeout(speakerUpdateTimerRef.current);
    }
    speakerUpdateTimerRef.current = setTimeout(() => {
      speakerUpdateTimerRef.current = null;
      sendSpeakerUpdate();
    }, 400);
  }, [sendSpeakerUpdate]);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;

    const preserveTurns = connectPreserveTurnsRef.current;
    skipActivationFeedbackRef.current = preserveTurns;
    connectPreserveTurnsRef.current = false;

    safeSetState(() => {
      setErrorKey("");
      setCurrentTranslatedText("");
      if (!preserveTurns) {
        setTurns([]);
      }
      setConnectionStatus("connecting");
    });

    const routing = buildLanguageRouting(sessionConfigRef.current);
    turnContextRef.current = routing;
    sessionEstablishedRef.current = false;

    logRealtimeConnect("connect_start", {
      architecture: "sdp_realtime_call_only",
      patientLanguage: routing.patientLanguage,
      doctorLanguage: routing.doctorLanguage,
      activeSpeaker: routing.activeSpeaker,
    });

    try {
      const pc = new RTCPeerConnection(REALTIME_PEER_CONNECTION_CONFIG);
      pcRef.current = pc;
      logRealtimeConnect("peer_created", {
        iceServers: REALTIME_PEER_CONNECTION_CONFIG.iceServers.length,
      });

      pc.onconnectionstatechange = () => {
        logRealtimeConnect("rtc_connection_state_change", { state: pc.connectionState });
        logRealtimeDiag("pc_connection_state", { state: pc.connectionState });
        if (pc.connectionState === "connected") {
          logRealtimeConnect("connection_connected", {
            dcState: dcRef.current?.readyState ?? "none",
            sessionEstablished: sessionEstablishedRef.current,
          });
        }
        if (pc.connectionState === "connected" && connectedRef.current && !sessionEstablishedRef.current) {
          logRealtimeConnect("webrtc_connected_awaiting_openai_session", {
            dcState: dcRef.current?.readyState ?? "none",
          });
        }
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          if (connectedRef.current) {
            safeSetState(() => {
              setConnectionStatus("error");
              setErrorKey("realtimeChannelError");
            });
          }
        }
      };
      pc.oniceconnectionstatechange = () => {
        logRealtimeConnect("ice_connection_state_change", { state: pc.iceConnectionState });
        logRealtimeDiag("pc_ice_state", { state: pc.iceConnectionState });
      };
      pc.onicegatheringstatechange = () => {
        logRealtimeConnect("ice_gathering_state_change", { state: pc.iceGatheringState });
      };

      const audioEl = document.createElement("audio");
      attachOutputAudio(audioEl);
      audioElRef.current = audioEl;

      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (!audioElRef.current || !stream) return;
        if (outputStreamIdRef.current === stream.id) return;
        outputStreamIdRef.current = stream.id;
        logRealtimeConnect("remote_audio_track_received", {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          trackKind: e.track?.kind ?? null,
        });
        audioElRef.current.srcObject = stream;
        void audioElRef.current.play().catch(() => {
          /* autoplay may require user gesture on some browsers */
        });
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        teardown();
        return;
      }

      micStreamRef.current = stream;
      const micTrack = stream.getAudioTracks()[0] || null;
      micTrackRef.current = micTrack;
      if (micTrack) {
        micTrack.enabled = true;
        pc.addTrack(micTrack, stream);
        logRealtimeDiag("mic_track_added", {
          enabled: micTrack.enabled,
          readyState: micTrack.readyState,
          muted: micTrack.muted,
        });
        safeSetState(() => setMicrophoneStatus("on"));
      }

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("open", () => {
        logRealtimeConnect("data_channel_open", { readyState: dc.readyState });
        logRealtimeDiag("dc_open", { readyState: dc.readyState });
        if (sessionEstablishedRef.current) {
          trySendMedaActivation();
        } else if (connectedRef.current) {
          logRealtimeConnect("data_channel_open_awaiting_openai_session", {
            pcState: pcRef.current?.connectionState ?? "none",
          });
        }
        if (pendingSpeakerUpdateRef.current) {
          sendSpeakerUpdate();
        }
      });
      dc.addEventListener("error", (err) => {
        logRealtimeConnect("data_channel_error", {
          readyState: dc.readyState,
          error: err && typeof err === "object" && "error" in err ? String(err.error) : null,
        });
        logRealtimeDiag("dc_error", { readyState: dc.readyState });
      });
      dc.addEventListener("close", () => {
        logRealtimeDiag("dc_close", { readyState: dc.readyState });
        if (connectedRef.current && mountedRef.current) {
          safeSetState(() => {
            setConnectionStatus("error");
            setErrorKey("realtimeChannelError");
          });
        }
      });
      dc.addEventListener("message", (e) => {
        try {
          const parsed = JSON.parse(String(e.data));
          const eventType =
            parsed && typeof parsed === "object" && "type" in parsed ? String(parsed.type) : null;
          if (
            eventType &&
            (eventType.startsWith("session.") ||
              eventType === "error" ||
              !sessionEstablishedRef.current)
          ) {
            logRealtimeConnect("data_channel_message", { eventType });
          }
          const summary = summarizePipelineEvent(parsed);
          if (summary.type === "error" || summary.errorCode) {
            logRealtimeDiag("dc_message_error_event", summary);
          } else if (
            summary.type &&
            (summary.hasTranscript ||
              summary.hasTranslation ||
              summary.type.includes("speech") ||
              summary.type.includes("response") ||
              summary.type.includes("transcription"))
          ) {
            logRealtimeDiag("dc_event", summary);
          }
          handleServerEvent(parsed);
        } catch {
          logRealtimeDiag("dc_message_parse_failed", {});
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      logRealtimeConnect("local_description_set", {
        signalingState: pc.signalingState,
        sdpBytes: pc.localDescription?.sdp?.length ?? 0,
      });
      await waitForIceGatheringComplete(pc);

      const localSdp = pc.localDescription?.sdp;
      if (!localSdp) {
        teardown();
        safeSetState(() => {
          setErrorKey("sdpOfferMissing");
          setConnectionStatus("error");
        });
        return;
      }

      logRealtimeConnect("sdp_exchange_start", {
        architecture: "sdp_realtime_call_only",
        offerBytes: localSdp.length,
      });

      const { res: sdpResponse, answerSdp, data: sdpErrorData } =
        await exchangeLiveTranslationSdp(localSdp, {
          patientLanguage: routing.patientLanguage,
          doctorLanguage: routing.doctorLanguage,
          activeSpeaker: routing.activeSpeaker,
        });

      if (!mountedRef.current) {
        teardown();
        return;
      }

      if (!sdpResponse.ok || !answerSdp.trim()) {
        logRealtimeConnect("sdp_exchange_failed", {
          status: sdpResponse.status,
          phase: sdpErrorData?.phase,
          error: sdpErrorData?.error ?? null,
          connectionErrorKind: sdpErrorData?.connectionErrorKind ?? null,
          openaiErrorParam: sdpErrorData?.openaiErrorParam,
          openaiErrorMessage: sdpErrorData?.openaiErrorMessage ?? null,
        });
        logRealtimeDiag("sdp_exchange_failed", {
          status: sdpResponse.status,
          phase: sdpErrorData?.phase,
          openaiErrorParam: sdpErrorData?.openaiErrorParam,
          openaiErrorCode: sdpErrorData?.openaiErrorMessage ? "message" : null,
        });
        teardown();
        safeSetState(() => {
          setErrorKey(
            sdpErrorData?.error === "OPENAI_QUOTA_EXCEEDED"
              ? "openaiQuotaExceeded"
              : sdpErrorData?.openaiErrorParam === "session.audio.input.transcription.language"
                ? "openaiSessionRejected"
                : "sdpExchangeFailed",
          );
          setConnectionStatus("error");
        });
        return;
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      connectedRef.current = true;
      prevSpeakerRef.current = sessionConfigRef.current.activeSpeaker;
      logRealtimeConnect("remote_description_set", {
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        answerBytes: answerSdp.length,
      });
    } catch (err) {
      logRealtimeConnect("connect_exception", {
        errorName: err && typeof err === "object" && "name" in err ? String(err.name) : "Error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      teardown();
      if (!mountedRef.current) return;
      safeSetState(() => {
        setErrorKey(resolveConnectExceptionErrorKey(err));
        setConnectionStatus("error");
      });
    }
  }, [
    attachOutputAudio,
    handleServerEvent,
    markRealtimeSessionConnected,
    safeSetState,
    sendSpeakerUpdate,
    teardown,
    trySendMedaActivation,
  ]);

  useEffect(() => {
    if (!enabled) {
      teardown();
      sessionActivationPlayedRef.current = false;
      skipActivationFeedbackRef.current = false;
      safeSetState(() => {
        setConnectionStatus("idle");
        setMicrophoneStatus("off");
      });
      return undefined;
    }
    void connect();
    return () => {
      teardown();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) {
      prevSpeakerRef.current = activeSpeaker;
      return;
    }
    if (!connectedRef.current) return;
    if (prevSpeakerRef.current === activeSpeaker) return;
    prevSpeakerRef.current = activeSpeaker;
    scheduleSpeakerUpdate();
  }, [activeSpeaker, enabled, scheduleSpeakerUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    const onPageHide = () => {
      cancelActiveResponse();
      teardown();
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (audioElRef.current) {
          audioElRef.current.pause();
        }
      } else if (
        !pausedRef.current &&
        enabledRef.current &&
        connectionStatusRef.current !== "ended" &&
        connectionStatusRef.current !== "idle"
      ) {
        resumeAudioPlayback();
      }
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      teardown();
    };
  }, [cancelActiveResponse, resumeAudioPlayback, teardown]);

  const reconnect = useCallback(async () => {
    if (reconnectInFlightRef.current || !mountedRef.current) return;
    reconnectInFlightRef.current = true;
    try {
      connectPreserveTurnsRef.current = true;
      teardown();
      safeSetState(() => {
        setErrorKey("");
        setConnectionStatus("reconnecting");
      });
      await connect();
    } finally {
      reconnectInFlightRef.current = false;
    }
  }, [connect, safeSetState, teardown]);

  const routing = buildLanguageRouting({ patientLanguage, doctorLanguage, activeSpeaker });
  const sessionMaxMs = sessionMaxMsRef.current;
  const sessionTimerLabel = formatSessionTimer(sessionElapsedMs, sessionMaxMs);

  return {
    connectionStatus,
    microphoneStatus,
    currentTranslatedText,
    turns,
    routing,
    errorKey,
    sessionElapsedMs,
    sessionMaxMs,
    sessionTimerLabel,
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
    isPaused: connectionStatus === "paused",
    latestReplayText: latestReplayTextRef.current,
  };
}
