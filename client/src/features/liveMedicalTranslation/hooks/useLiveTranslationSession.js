import { useCallback, useEffect, useRef, useState } from "react";
import { createLiveTranslationRealtimeSession } from "../api/liveTranslationApi.js";
import { LIVE_TRANSLATION_TRANSCRIPTION_MODEL } from "../constants.js";
import { buildLanguageRouting } from "../utils/routing.js";
import {
  extractOriginalText,
  extractTranslatedText,
  REALTIME_PEER_CONNECTION_CONFIG,
  waitForIceGatheringComplete,
} from "../utils/webrtc.js";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

/** @typedef {"idle" | "connecting" | "connected" | "listening" | "translating" | "speaking" | "error" | "ended"} LiveTranslationConnectionStatus */

/**
 * @typedef {{
 *   speaker: "patient" | "doctor";
 *   sourceLanguage: string;
 *   targetLanguage: string;
 *   originalText: string;
 *   translatedText: string;
 *   timestamp: string;
 * }} LiveTranslationTurn
 */

/**
 * @param {{
 *   patientLanguage: string;
 *   doctorLanguage: string;
 *   activeSpeaker: "patient" | "doctor";
 *   enabled: boolean;
 * }} config
 */
export function useLiveTranslationSession({
  patientLanguage,
  doctorLanguage,
  activeSpeaker,
  enabled,
}) {
  const [connectionStatus, setConnectionStatus] = useState(
    /** @type {LiveTranslationConnectionStatus} */ ("idle"),
  );
  const [microphoneStatus, setMicrophoneStatus] = useState("off");
  const [currentTranslatedText, setCurrentTranslatedText] = useState("");
  const [turns, setTurns] = useState(/** @type {LiveTranslationTurn[]} */ ([]));
  const [errorKey, setErrorKey] = useState("");

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
  const turnContextRef = useRef(
    buildLanguageRouting({ patientLanguage, doctorLanguage, activeSpeaker }),
  );

  sessionConfigRef.current = { patientLanguage, doctorLanguage, activeSpeaker };

  const safeSetState = useCallback((setter) => {
    if (mountedRef.current) setter();
  }, []);

  const attachOutputAudio = useCallback((audioEl) => {
    audioEl.autoplay = true;
    audioEl.setAttribute("playsinline", "true");
    audioEl.style.display = "none";
    if (!audioEl.isConnected) {
      document.body.appendChild(audioEl);
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
  }, [stopMic]);

  const appendTurn = useCallback(
    (originalText, translatedText) => {
      const routing = turnContextRef.current;
      if (!translatedText.trim()) return;

      const turn = {
        speaker: routing.activeSpeaker,
        sourceLanguage: routing.sourceLanguage,
        targetLanguage: routing.targetLanguage,
        originalText: originalText.trim(),
        translatedText: translatedText.trim(),
        timestamp: new Date().toISOString(),
      };

      const signature = `${turn.speaker}|${turn.originalText}|${turn.translatedText}`;
      if (signature === lastTurnSignatureRef.current) return;
      lastTurnSignatureRef.current = signature;

      const trimmed = translatedText.trim();
      currentTranslatedRef.current = trimmed;
      safeSetState(() => {
        setTurns((prev) => [...prev, turn]);
        setCurrentTranslatedText(trimmed);
      });
      pendingOriginalRef.current = "";
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
  }, [safeSetState, teardown]);

  const handleServerEvent = useCallback(
    (event) => {
      if (!event || typeof event !== "object") return;
      const type = event.type;

      if (type === "session.created") {
        safeSetState(() => {
          setConnectionStatus("connected");
          setMicrophoneStatus("on");
        });
        return;
      }

      if (type === "input_audio_buffer.speech_started") {
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
        type === "conversation.item.input_audio_transcription.delta" ||
        type === "input_audio_buffer.transcription.completed" ||
        type === "input_audio_buffer.transcription.delta"
      ) {
        const transcript = extractOriginalText(event);
        if (transcript) {
          pendingOriginalRef.current = type.endsWith(".delta")
            ? `${pendingOriginalRef.current}${transcript}`
            : transcript;
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
          appendTurn(pendingOriginalRef.current, translated);
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
          setErrorKey("connectionError");
        });
      }
    },
    [appendTurn, safeSetState],
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
    dc.send(
      JSON.stringify({
        type: "session.update",
        session: {
          instructions: buildClientSideInstructions(routing),
          audio: {
            input: {
              transcription: {
                model: transcriptionModelRef.current,
                language: routing.sourceLanguage,
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

    safeSetState(() => {
      setErrorKey("");
      setCurrentTranslatedText("");
      setTurns([]);
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
          setErrorKey(data?.error === "feature_disabled" ? "featureDisabled" : "sessionStartFailed");
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
          setErrorKey("connectionError");
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
          setErrorKey("connectionError");
          setConnectionStatus("error");
        });
        return;
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      connectedRef.current = true;
      prevSpeakerRef.current = sessionConfigRef.current.activeSpeaker;
      safeSetState(() => setConnectionStatus("connected"));
    } catch (err) {
      teardown();
      if (!mountedRef.current) return;
      const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
      safeSetState(() => {
        setErrorKey(name === "NotAllowedError" ? "microphoneDenied" : "connectionError");
        setConnectionStatus("error");
      });
    }
  }, [attachOutputAudio, handleServerEvent, safeSetState, sendSpeakerUpdate, teardown]);

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
    window.addEventListener("pagehide", onPageHide);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", onPageHide);
      teardown();
    };
  }, [teardown]);

  const reconnect = useCallback(async () => {
    teardown();
    safeSetState(() => setConnectionStatus("idle"));
    await connect();
  }, [connect, safeSetState, teardown]);

  const routing = buildLanguageRouting({ patientLanguage, doctorLanguage, activeSpeaker });

  return {
    connectionStatus,
    microphoneStatus,
    currentTranslatedText,
    turns,
    routing,
    errorKey,
    endSession,
    reconnect,
  };
}

/** @param {ReturnType<typeof buildLanguageRouting>} routing */
function buildClientSideInstructions(routing) {
  return [
    "You are a live medical conversation translator ONLY.",
    `activeSpeaker=${routing.activeSpeaker}; patientLanguage=${routing.patientLanguage}; doctorLanguage=${routing.doctorLanguage}; sourceLanguage=${routing.sourceLanguage}; targetLanguage=${routing.targetLanguage}.`,
    `When activeSpeaker is patient, translate from ${routing.patientLanguageName} to ${routing.doctorLanguageName}.`,
    `When activeSpeaker is doctor, translate from ${routing.doctorLanguageName} to ${routing.patientLanguageName}.`,
    "Do not infer speaker identity. Use only activeSpeaker from the UI.",
    `Current: listen ${routing.sourceLanguageName}, speak translation in ${routing.targetLanguageName}.`,
    "Translate only what was said. Do not diagnose, triage, recommend treatment, add medical facts, or interpret symptoms.",
    "If unclear, say it was unclear in the target language. Never invent content.",
    "Speak clearly, calmly, and at a moderate pace.",
  ].join(" ");
}
