import { useCallback, useEffect, useRef, useState } from "react";
import { createLiveTranslationRealtimeSession } from "../api/liveTranslationApi.js";
import { LIVE_TRANSLATION_TRANSCRIPTION_MODEL, resolveOpenAiTranscriptionLanguage } from "../constants.js";
import { buildLanguageRouting } from "../utils/routing.js";
import { buildClientSideInstructions } from "../utils/translationInstructions.js";
import { resolveTurnStatus, isLikelyEmptyOrNoiseTranscript } from "../utils/asrQuality.js";
import {
  formatSessionTimer,
  resolveLiveSessionMaxMs,
  resolveLiveSessionWarnAtMs,
} from "../utils/sessionTimer.js";
import { getRepeatPhrase } from "../utils/repeatPhrase.js";
import { resolveSpeakerFromDetectedLanguage } from "../utils/languageBasedRouting.js";
import {
  extractDetectedLanguage,
  extractOriginalText,
  extractTranslatedText,
  REALTIME_PEER_CONNECTION_CONFIG,
  waitForIceGatheringComplete,
} from "../utils/webrtc.js";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

/** @param {Response} res @param {Record<string, unknown>} data */
function resolveSessionApiErrorKey(res, data) {
  if (res.status === 401 || res.status === 403) return "sessionUnauthorized";
  if (data?.error === "feature_disabled") return "featureDisabled";
  if (data?.error === "openai_not_configured") return "openaiNotConfigured";
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

/** @typedef {"idle" | "connecting" | "introducing" | "connected" | "listening" | "translating" | "speaking" | "error" | "ended"} LiveTranslationConnectionStatus */

/**
 * @typedef {"translated" | "unclear" | "corrected" | "replayed"} LiveTranslationTurnStatus
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

/** @typedef {{ type: "correction"; sourceText: string; correctsTurnId: string; routing: ReturnType<typeof buildLanguageRouting> } | { type: "replay" } | { type: "repeat"; phrase: string } | null} PendingPlanB */

/**
 * @param {{
 *   patientLanguage: string;
 *   doctorLanguage: string;
 *   activeSpeaker: "patient" | "doctor";
 *   enabled: boolean;
 *   introText?: string;
 *   languageBasedRouting?: boolean;
 *   skipLanguageRoutingRef?: React.MutableRefObject<boolean>;
 *   instructionOptions?: { medicalDomainWarningDe?: string; medicalDomainWarningEn?: string };
 *   autoSwitchSpeaker?: boolean;
 *   onTurnComplete?: (completedSpeaker: "patient" | "doctor") => void;
 *   onSpeakerFromLanguage?: (speaker: "patient" | "doctor") => void;
 *   onLanguageUncertain?: () => void;
 *   onUnclearTurn?: (info?: { overlapDetected?: boolean; missingOriginal?: boolean }) => void;
 *   onSessionTimeWarning?: (info: { elapsedMs: number; markMs: number; maxMs: number }) => void;
 *   onSessionAutoEnd?: () => void;
 * }} config
 */
export function useLiveTranslationSession({
  patientLanguage,
  doctorLanguage,
  activeSpeaker,
  enabled,
  introText = "",
  languageBasedRouting = true,
  skipLanguageRoutingRef,
  instructionOptions = {},
  autoSwitchSpeaker = false,
  onTurnComplete,
  onSpeakerFromLanguage,
  onLanguageUncertain,
  onUnclearTurn,
  onSessionTimeWarning,
  onSessionAutoEnd,
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
  const sessionStartedAtRef = useRef(/** @type {number | null} */ (null));
  const sessionWarnedAtRef = useRef(/** @type {Set<number>} */ (new Set()));
  const sessionTimerIntervalRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));
  const onUnclearTurnRef = useRef(onUnclearTurn);
  const onSessionTimeWarningRef = useRef(onSessionTimeWarning);
  const onSessionAutoEndRef = useRef(onSessionAutoEnd);
  const sessionMaxMsRef = useRef(resolveLiveSessionMaxMs());

  sessionConfigRef.current = { patientLanguage, doctorLanguage, activeSpeaker };
  autoSwitchSpeakerRef.current = autoSwitchSpeaker;
  onTurnCompleteRef.current = onTurnComplete;
  onSpeakerFromLanguageRef.current = onSpeakerFromLanguage;
  onLanguageUncertainRef.current = onLanguageUncertain;
  introTextRef.current = introText;
  languageBasedRoutingRef.current = languageBasedRouting;
  instructionOptionsRef.current = instructionOptions;
  turnsRef.current = turns;
  connectionStatusRef.current = connectionStatus;
  onUnclearTurnRef.current = onUnclearTurn;
  onSessionTimeWarningRef.current = onSessionTimeWarning;
  onSessionAutoEndRef.current = onSessionAutoEnd;
  sessionMaxMsRef.current = resolveLiveSessionMaxMs();

  const safeSetState = useCallback((setter) => {
    if (mountedRef.current) setter();
  }, []);

  const attachOutputAudio = useCallback((audioEl) => {
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.setAttribute("playsinline", "true");
    audioEl.setAttribute("webkit-playsinline", "true");
    audioEl.style.display = "none";
    if (!audioEl.isConnected) {
      document.body.appendChild(audioEl);
    }
  }, []);

  const clearSessionTimer = useCallback(() => {
    if (sessionTimerIntervalRef.current) {
      clearInterval(sessionTimerIntervalRef.current);
      sessionTimerIntervalRef.current = null;
    }
  }, []);

  const startSessionTimer = useCallback(() => {
    clearSessionTimer();
    sessionStartedAtRef.current = Date.now();
    sessionWarnedAtRef.current = new Set();
    const maxMs = sessionMaxMsRef.current;
    const warnAt = resolveLiveSessionWarnAtMs(maxMs);

    sessionTimerIntervalRef.current = setInterval(() => {
      if (!sessionStartedAtRef.current || !mountedRef.current) return;
      const elapsed = Date.now() - sessionStartedAtRef.current;
      safeSetState(() => setSessionElapsedMs(elapsed));

      for (const mark of warnAt) {
        if (elapsed >= mark && !sessionWarnedAtRef.current.has(mark)) {
          sessionWarnedAtRef.current.add(mark);
          onSessionTimeWarningRef.current?.({ elapsedMs: elapsed, markMs: mark, maxMs });
        }
      }

      if (elapsed >= maxMs) {
        clearSessionTimer();
        onSessionAutoEndRef.current?.();
      }
    }, 1000);
  }, [clearSessionTimer, safeSetState]);

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
    sessionStartedAtRef.current = null;
    clearSessionTimer();
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      audioElRef.current.remove();
      audioElRef.current = null;
    }
    stopMic();
  }, [clearSessionTimer, stopMic]);

  const appendTurn = useCallback(
    (originalText, translatedText, meta = {}) => {
      const routing = turnContextRef.current;
      if (!translatedText.trim()) return;

      const original = originalText.trim();
      const status = resolveTurnStatus({
        originalText: original,
        translatedText,
        targetLanguage: routing.targetLanguage,
        overlapDetected: Boolean(meta.overlapDetected),
        forcedStatus: meta.status,
      });

      if (status !== "translated" && !meta.status) {
        onUnclearTurnRef.current?.({
          overlapDetected: Boolean(meta.overlapDetected),
          missingOriginal: !original,
        });
      }

      turnIdCounterRef.current += 1;
      const turn = {
        id: `turn-${Date.now()}-${turnIdCounterRef.current}`,
        speaker: meta.speaker || routing.activeSpeaker,
        sourceLanguage: meta.sourceLanguage || routing.sourceLanguage,
        targetLanguage: meta.targetLanguage || routing.targetLanguage,
        originalText: original,
        originalMissing: !original,
        translatedText: translatedText.trim(),
        timestamp: new Date().toISOString(),
        status,
        correctsTurnId: meta.correctsTurnId,
        wrongOriginalText: meta.wrongOriginalText,
        wrongTranslatedText: meta.wrongTranslatedText,
      };

      const signature = `${turn.speaker}|${turn.originalText}|${turn.translatedText}|${turn.status}`;
      if (!meta.allowDuplicate && signature === lastTurnSignatureRef.current) return;
      lastTurnSignatureRef.current = signature;

      const trimmed = translatedText.trim();
      currentTranslatedRef.current = trimmed;
      latestReplayTextRef.current = trimmed;
      safeSetState(() => {
        setTurns((prev) => [...prev, turn]);
        setCurrentTranslatedText(trimmed);
      });
      pendingOriginalRef.current = "";

      if (status === "translated" && autoSwitchSpeakerRef.current && onTurnCompleteRef.current) {
        onTurnCompleteRef.current(turn.speaker);
      }
    },
    [safeSetState],
  );

  const endSession = useCallback(() => {
    teardown();
    safeSetState(() => {
      setConnectionStatus("ended");
      setCurrentTranslatedText("");
      setTurns([]);
      setErrorKey("");
    });
    pendingOriginalRef.current = "";
    currentTranslatedRef.current = "";
    lastTurnSignatureRef.current = "";
    introPlayedRef.current = false;
    pendingPlanBRef.current = null;
  }, [safeSetState, teardown]);

  /** Stop WebRTC/mic but keep turns in memory for PDF export. */
  const disconnectSession = useCallback(() => {
    teardown();
    safeSetState(() => {
      setConnectionStatus("ended");
      setCurrentTranslatedText("");
      setErrorKey("");
    });
    pendingOriginalRef.current = "";
    currentTranslatedRef.current = "";
    lastTurnSignatureRef.current = "";
    introPlayedRef.current = false;
    pendingPlanBRef.current = null;
  }, [safeSetState, teardown]);

  const cancelActiveResponse = useCallback(() => {
    const dc = dcRef.current;
    if (dc?.readyState === "open") {
      suppressErrorsUntilRef.current = Date.now() + 2000;
      dc.send(JSON.stringify({ type: "response.cancel" }));
    }
  }, []);

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
    safeSetState(() => setConnectionStatus("connected"));
  }, [cancelActiveResponse, safeSetState]);

  const speakExactText = useCallback(
    (text, planB) => {
      const dc = dcRef.current;
      const trimmed = text?.trim();
      if (!dc || dc.readyState !== "open" || !trimmed) return false;

      pendingPlanBRef.current = planB;
      cancelActiveResponse();
      safeSetState(() => setConnectionStatus("speaking"));
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["audio"],
            instructions: `Say exactly and only the following in a calm, professional tone. Do not translate, add, or change anything: "${trimmed}"`,
          },
        }),
      );
      return true;
    },
    [cancelActiveResponse, safeSetState],
  );

  const requestFaithfulTranslation = useCallback(
    (sourceText, routing, planB) => {
      const dc = dcRef.current;
      const trimmed = sourceText?.trim();
      if (!dc || dc.readyState !== "open" || !trimmed) return false;

      turnContextRef.current = routing;
      pendingPlanBRef.current = planB;
      cancelActiveResponse();
      safeSetState(() => setConnectionStatus("translating"));

      const fidelityHint = buildClientSideInstructions(routing, instructionOptionsRef.current);
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["audio"],
            instructions: `${fidelityHint}\n\nTranslate ONLY this ${routing.sourceLanguageName} statement into ${routing.targetLanguageName}. Output ONLY the translation, spoken aloud:\n"${trimmed}"`,
          },
        }),
      );
      return true;
    },
    [cancelActiveResponse, safeSetState],
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
    const phrase = getRepeatPhrase(routing.targetLanguage);
    return speakExactText(phrase, { type: "repeat", phrase });
  }, [speakExactText]);

  const sendMedaIntro = useCallback(() => {
    const dc = dcRef.current;
    const text = introTextRef.current?.trim();
    if (!dc || dc.readyState !== "open" || !text || introPlayedRef.current) return;

    introPlayedRef.current = true;
    safeSetState(() => setConnectionStatus("introducing"));
    dc.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio"],
          instructions: `Say exactly and only the following in a calm, professional tone. Do not add anything else: "${text}"`,
        },
      }),
    );
  }, [safeSetState]);

  const applyLanguageRouting = useCallback(
    (event) => {
      if (!languageBasedRoutingRef.current) return;
      if (skipLanguageRoutingRef?.current) return;

      const cfg = sessionConfigRef.current;
      const detected = extractDetectedLanguage(event);
      const result = resolveSpeakerFromDetectedLanguage(
        detected,
        cfg.patientLanguage,
        cfg.doctorLanguage,
        cfg.activeSpeaker,
      );

      if (result.uncertain) {
        onLanguageUncertainRef.current?.();
        return;
      }

      if (result.speaker !== cfg.activeSpeaker) {
        onSpeakerFromLanguageRef.current?.(result.speaker);
      }
    },
    [skipLanguageRoutingRef],
  );

  const handleServerEvent = useCallback(
    (event) => {
      if (!event || typeof event !== "object") return;
      const type = event.type;

      if (type === "session.created") {
        connectedRef.current = true;
        safeSetState(() => {
          setConnectionStatus("connected");
          setMicrophoneStatus("on");
          setSessionElapsedMs(0);
        });
        startSessionTimer();
        sendMedaIntro();
        return;
      }

      if (type === "input_audio_buffer.speech_started") {
        const prevStatus = connectionStatusRef.current;
        if (prevStatus === "speaking" || prevStatus === "translating") {
          overlapDetectedRef.current = true;
        }
        turnContextRef.current = buildLanguageRouting(sessionConfigRef.current);
        pendingOriginalRef.current = "";
        currentTranslatedRef.current = "";
        safeSetState(() => {
          setCurrentTranslatedText("");
          setConnectionStatus("listening");
        });
        return;
      }

      if (type === "input_audio_buffer.speech_stopped") {
        safeSetState(() => setConnectionStatus("translating"));
        return;
      }

      if (
        type === "conversation.item.input_audio_transcription.completed" ||
        type === "input_audio_buffer.transcription.completed"
      ) {
        const transcript = extractOriginalText(event);
        if (transcript && !isLikelyEmptyOrNoiseTranscript(transcript)) {
          pendingOriginalRef.current = transcript;
        }
        applyLanguageRouting(event);
        return;
      }

      if (
        type === "conversation.item.input_audio_transcription.delta" ||
        type === "input_audio_buffer.transcription.delta"
      ) {
        const transcript = extractOriginalText(event);
        if (transcript && !isLikelyEmptyOrNoiseTranscript(transcript)) {
          pendingOriginalRef.current = `${pendingOriginalRef.current}${transcript}`;
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
        if (delta) {
          currentTranslatedRef.current += delta;
          safeSetState(() => {
            setCurrentTranslatedText(currentTranslatedRef.current);
            setConnectionStatus("speaking");
          });
        } else {
          safeSetState(() => setConnectionStatus("speaking"));
        }
        return;
      }

      if (type === "response.created" || type === "response.output_item.added") {
        safeSetState(() => setConnectionStatus("translating"));
        return;
      }

      if (type === "response.audio.delta") {
        safeSetState(() => setConnectionStatus("speaking"));
        return;
      }

      if (
        type === "response.output_audio_transcript.done" ||
        type === "response.audio_transcript.done"
      ) {
        const translated =
          extractTranslatedText(event) || currentTranslatedRef.current;
        if (translated) {
          currentTranslatedRef.current = translated;
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
          } else if (planB?.type === "replay" || planB?.type === "repeat") {
            latestReplayTextRef.current = translated;
            safeSetState(() => setCurrentTranslatedText(translated));
            pendingPlanBRef.current = null;
          } else {
            const overlap = overlapDetectedRef.current;
            overlapDetectedRef.current = false;
            appendTurn(pendingOriginalRef.current, translated, { overlapDetected: overlap });
          }
        }
        if (skipLanguageRoutingRef) {
          skipLanguageRoutingRef.current = false;
        }
        safeSetState(() => setConnectionStatus("connected"));
        return;
      }

      if (
        type === "response.text.done" ||
        type === "response.output_text.done" ||
        type === "response.content_part.done"
      ) {
        const translated =
          extractTranslatedText(event) || currentTranslatedRef.current;
        if (translated) {
          currentTranslatedRef.current = translated;
          safeSetState(() => setCurrentTranslatedText(translated));
        }
        safeSetState(() => setConnectionStatus("connected"));
        return;
      }

      if (type === "response.done") {
        safeSetState(() => setConnectionStatus("connected"));
        return;
      }

      if (type === "error") {
        if (Date.now() < suppressErrorsUntilRef.current) return;
        safeSetState(() => {
          setConnectionStatus("error");
          setErrorKey("realtimeChannelError");
        });
      }
    },
    [appendTurn, applyLanguageRouting, safeSetState, sendMedaIntro, skipLanguageRoutingRef, startSessionTimer],
  );

  const sendSpeakerUpdate = useCallback(() => {
    if (!connectedRef.current) return;

    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") {
      pendingSpeakerUpdateRef.current = true;
      return;
    }

    pendingSpeakerUpdateRef.current = false;
    const routing = buildLanguageRouting(sessionConfigRef.current);
    turnContextRef.current = routing;

    suppressErrorsUntilRef.current = Date.now() + 2000;
    dc.send(JSON.stringify({ type: "response.cancel" }));
    const txLanguage = resolveOpenAiTranscriptionLanguage(routing.sourceLanguage);
    dc.send(
      JSON.stringify({
        type: "session.update",
        session: {
          instructions: buildClientSideInstructions(routing, instructionOptionsRef.current),
          audio: {
            input: {
              transcription: {
                model: transcriptionModelRef.current,
                ...(txLanguage ? { language: txLanguage } : {}),
              },
            },
          },
        },
      }),
    );
    currentTranslatedRef.current = "";
    lastTurnSignatureRef.current = "";
    safeSetState(() => {
      setCurrentTranslatedText("");
      setConnectionStatus("connected");
    });
    pendingOriginalRef.current = "";
  }, [safeSetState]);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;

    const preserveTurns = connectPreserveTurnsRef.current;
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

    try {
      const { res, data } = await createLiveTranslationRealtimeSession({
        patientLanguage: routing.patientLanguage,
        doctorLanguage: routing.doctorLanguage,
        activeSpeaker: routing.activeSpeaker,
      });

      if (!mountedRef.current) {
        return;
      }

      if (!res.ok) {
        safeSetState(() => {
          setErrorKey(resolveSessionApiErrorKey(res, data));
          setConnectionStatus("error");
        });
        return;
      }

      if (!data.clientSecret) {
        safeSetState(() => {
          setErrorKey("sessionStartFailed");
          setConnectionStatus("error");
        });
        return;
      }

      if (typeof data.transcriptionModel === "string" && data.transcriptionModel) {
        transcriptionModelRef.current = data.transcriptionModel;
      }

      const pc = new RTCPeerConnection(REALTIME_PEER_CONNECTION_CONFIG);
      pcRef.current = pc;

      const audioEl = document.createElement("audio");
      attachOutputAudio(audioEl);
      audioElRef.current = audioEl;

      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (!audioElRef.current || !stream) return;
        if (outputStreamIdRef.current === stream.id) return;
        outputStreamIdRef.current = stream.id;
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
        pc.addTrack(micTrack, stream);
        safeSetState(() => setMicrophoneStatus("on"));
      }

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("open", () => {
        sendMedaIntro();
        if (pendingSpeakerUpdateRef.current) {
          sendSpeakerUpdate();
        }
      });
      dc.addEventListener("message", (e) => {
        try {
          handleServerEvent(JSON.parse(String(e.data)));
        } catch {
          /* ignore malformed events */
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
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

      const sdpResponse = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        body: localSdp,
        headers: {
          Authorization: `Bearer ${data.clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!mountedRef.current) {
        teardown();
        return;
      }

      if (!sdpResponse.ok) {
        teardown();
        safeSetState(() => {
          setErrorKey("sdpExchangeFailed");
          setConnectionStatus("error");
        });
        return;
      }

      const answerSdp = await sdpResponse.text();
      if (!answerSdp.trim()) {
        teardown();
        safeSetState(() => {
          setErrorKey("sdpExchangeFailed");
          setConnectionStatus("error");
        });
        return;
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      connectedRef.current = true;
      prevSpeakerRef.current = sessionConfigRef.current.activeSpeaker;
      safeSetState(() => setConnectionStatus("connected"));
    } catch (err) {
      teardown();
      if (!mountedRef.current) return;
      safeSetState(() => {
        setErrorKey(resolveConnectExceptionErrorKey(err));
        setConnectionStatus("error");
      });
    }
  }, [attachOutputAudio, handleServerEvent, safeSetState, sendMedaIntro, sendSpeakerUpdate, teardown]);

  useEffect(() => {
    if (!enabled) return undefined;
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
    sendSpeakerUpdate();
  }, [activeSpeaker, connectionStatus, enabled, sendSpeakerUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    const onPageHide = () => teardown();
    const onVisibility = () => {
      if (document.hidden) {
        if (audioElRef.current) {
          audioElRef.current.pause();
        }
      } else {
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
  }, [resumeAudioPlayback, teardown]);

  const reconnect = useCallback(async () => {
    if (reconnectInFlightRef.current || !mountedRef.current) return;
    reconnectInFlightRef.current = true;
    try {
      connectPreserveTurnsRef.current = true;
      teardown();
      safeSetState(() => {
        setErrorKey("");
        setConnectionStatus("connecting");
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
    askToRepeat,
    resumeAudioPlayback,
    latestReplayText: latestReplayTextRef.current,
  };
}
