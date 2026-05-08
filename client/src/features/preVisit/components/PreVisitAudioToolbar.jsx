import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Volume2 } from "lucide-react";

const MAX_SPEAK_CHARS = 1200;

/**
 * OpenAI-backed listen / dictate controls for Pre-Visit chat (no browser TTS / Web Speech).
 */
export default function PreVisitAudioToolbar({
  speakText,
  patientLanguage,
  labels,
  onAppendTranscript,
  disabled = false,
}) {
  const [speakPhase, setSpeakPhase] = useState("idle");
  const [recordPhase, setRecordPhase] = useState("idle");
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const speakAbortRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const micSupported =
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const stopPlayback = useCallback(() => {
    speakAbortRef.current?.abort();
    speakAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSpeakPhase("idle");
  }, []);

  useEffect(() => {
    stopPlayback();
  }, [speakText, stopPlayback]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const handleSpeak = useCallback(async () => {
    setAudioError("");
    if (disabled) return;
    if (speakPhase === "playing" || speakPhase === "loading") {
      stopPlayback();
      return;
    }

    const text = String(speakText || "").trim().slice(0, MAX_SPEAK_CHARS);
    if (!text) return;

    stopPlayback();
    setSpeakPhase("loading");
    const ac = new AbortController();
    speakAbortRef.current = ac;

    try {
      const res = await fetch("/api/previsit/audio/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language: patientLanguage || "de",
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        let msg = labels.audioErrorGeneric;
        try {
          const j = await res.json();
          if (j?.error && typeof j.error === "string") msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      if (ac.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const el = new Audio(url);
      audioRef.current = el;
      el.addEventListener(
        "ended",
        () => {
          stopPlayback();
        },
        { once: true }
      );
      el.addEventListener(
        "error",
        () => {
          setAudioError(labels.audioErrorPlayback);
          stopPlayback();
        },
        { once: true }
      );
      try {
        await el.play();
      } catch {
        setAudioError(labels.audioErrorPlayback);
        stopPlayback();
        return;
      }
      if (!ac.signal.aborted) setSpeakPhase("playing");
    } catch (e) {
      if (e?.name === "AbortError") return;
      setAudioError(e?.message || labels.audioErrorGeneric);
      setSpeakPhase("idle");
    } finally {
      if (speakAbortRef.current === ac) speakAbortRef.current = null;
    }
  }, [
    disabled,
    labels.audioErrorGeneric,
    labels.audioErrorPlayback,
    patientLanguage,
    speakPhase,
    speakText,
    stopPlayback,
  ]);

  const stopRecorder = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
  }, []);

  const cleanupStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopRecorder();
      cleanupStream();
    },
    [cleanupStream, stopRecorder]
  );

  const transcribeBlob = useCallback(
    async (blob) => {
      setRecordPhase("transcribing");
      setAudioError("");
      try {
        const fd = new FormData();
        fd.append("audio", blob, "previsit-recording.webm");
        if (patientLanguage) fd.append("language", patientLanguage);
        const res = await fetch("/api/previsit/audio/transcribe", {
          method: "POST",
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : labels.audioErrorGeneric
          );
        }
        const t = data?.text != null ? String(data.text).trim() : "";
        if (t) onAppendTranscript(t);
      } catch (e) {
        setAudioError(e?.message || labels.audioErrorGeneric);
      } finally {
        setRecordPhase("idle");
      }
    },
    [labels.audioErrorGeneric, onAppendTranscript, patientLanguage]
  );

  const handleMic = useCallback(async () => {
    setAudioError("");
    if (disabled || !micSupported) return;

    if (recordPhase === "recording") {
      stopRecorder();
      return;
    }

    if (recordPhase === "transcribing") return;

    let mime = "audio/webm";
    if (typeof MediaRecorder.isTypeSupported === "function") {
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mime = "audio/webm;codecs=opus";
      } else if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) mime = "audio/mp4";
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: mime });
      } catch {
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        cleanupStream();
        mediaRecorderRef.current = null;
        const parts = chunksRef.current;
        chunksRef.current = [];
        const blob = new Blob(parts, { type: recorder.mimeType || mime });
        if (blob.size > 0) {
          void transcribeBlob(blob);
        } else {
          setRecordPhase("idle");
        }
      };

      recorder.start(200);
      setRecordPhase("recording");
    } catch {
      setAudioError(labels.audioMicPermission);
      setRecordPhase("idle");
      cleanupStream();
    }
  }, [
    cleanupStream,
    disabled,
    labels.audioMicPermission,
    micSupported,
    recordPhase,
    stopRecorder,
    transcribeBlob,
  ]);

  const speakBusy = speakPhase === "loading" || speakPhase === "playing";
  const micBusy = recordPhase === "transcribing";
  const isRecording = recordPhase === "recording";

  const audioLiveStatus =
    speakPhase === "loading"
      ? labels.audioStatusLoading
      : speakPhase === "playing"
        ? labels.audioStatusPlaying
        : recordPhase === "recording"
          ? labels.audioStatusRecording
          : recordPhase === "transcribing"
            ? labels.audioStatusTranscribing
            : "";

  return (
    <div className="pre-visit-audio">
      <div className="pre-visit-audio__row">
        <p className="pre-visit-audio__hint">{labels.audioHint}</p>
        <div className="pre-visit-audio__btns">
          <button
            type="button"
            className={`pre-visit-audio__icon-btn${speakBusy ? " pre-visit-audio__icon-btn--teal" : ""}`}
            onClick={() => void handleSpeak()}
            disabled={disabled}
            aria-label={labels.audioListenAria}
            title={labels.audioListenTitle}
            aria-busy={speakPhase === "loading"}
            aria-pressed={speakPhase === "playing"}
          >
            <Volume2 size={26} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={`pre-visit-audio__icon-btn${isRecording ? " pre-visit-audio__icon-btn--rec" : ""}${micBusy ? " pre-visit-audio__icon-btn--teal" : ""}`}
            onClick={() => void handleMic()}
            disabled={disabled || !micSupported || micBusy}
            aria-label={labels.audioDictateAria}
            title={labels.audioDictateTitle}
            aria-pressed={isRecording}
            aria-busy={micBusy}
          >
            <Mic size={26} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
      {audioLiveStatus ? (
        <p className="pre-visit-audio__live" aria-live="polite" aria-atomic="true">
          {audioLiveStatus}
        </p>
      ) : null}
      {!micSupported ? (
        <p className="pre-visit-audio__unsupported" role="status">
          {labels.audioMicUnsupported}
        </p>
      ) : null}
      {audioError ? (
        <p className="pre-visit-audio__error" role="alert">
          {audioError}
        </p>
      ) : null}
      <p className="pre-visit-audio__privacy">{labels.audioPrivacy}</p>
    </div>
  );
}
