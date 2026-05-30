import { useState, useRef, useCallback } from 'react';
import { authFetch } from '../../../api/authFetch.js';
import { detectLanguage } from './realtimeLanguages.js';

const OPENAI_REALTIME_BASE = 'https://api.openai.com/v1/realtime';

/**
 * @typedef {'idle'|'connecting'|'connected'|'disconnecting'|'error'} ConnectionState
 * @typedef {'idle'|'ready'|'speech_active'|'processing'|'translating'|'speaking'} SessionStatus
 * @typedef {'patient'|'practice'} SpeakerRole
 * @typedef {{
 *   key: number,
 *   inputItemId: string|null,
 *   originalText: string|null,
 *   translatedText: string,
 *   isDone: boolean,
 *   speakerRole: SpeakerRole|null,
 *   targetRole: SpeakerRole|null,
 *   sourceLanguage: string|null,
 *   targetLanguage: string|null,
 * }} Turn
 */

/**
 * Hook for the Meda Realtime auto-detect interpreter session (Phase 8.9).
 *
 * Architecture:
 *  - No fixed input language is set; gpt-4o-transcribe auto-detects per utterance.
 *  - Speaker role (patient / practice) is derived from the transcript text using
 *    script and word-fingerprint detection against the two configured languages.
 *  - No rigid pingpong alternation — either speaker may speak at any time.
 *  - speakerLockRef still blocks mic processing during Meda audio playback (echo guard).
 *  - audioWatchdogRef provides a fallback if output_audio_buffer.stopped is late/missing.
 *  - sessionActiveRef guards all async steps and event handlers against stale updates.
 */
export function useRealtimeSession() {
  const [connectionState,    setConnectionState]    = useState(/** @type {ConnectionState} */ ('idle'));
  const [sessionStatus,      setSessionStatus]      = useState(/** @type {SessionStatus} */ ('idle'));
  const [currentSpeakerRole, setCurrentSpeakerRole] = useState(/** @type {SpeakerRole|null} */ (null));
  const [turns,  setTurns]  = useState(/** @type {Turn[]} */ ([]));
  const [events, setEvents] = useState(/** @type {object[]} */ ([]));
  const [error,  setError]  = useState(/** @type {string|null} */ (null));

  // Page attaches its <audio> DOM element here — avoids detached Audio() autoplay issues
  const audioElRef = useRef(/** @type {HTMLAudioElement|null} */ (null));

  const pcRef     = useRef(/** @type {RTCPeerConnection|null} */ (null));
  const dcRef     = useRef(/** @type {RTCDataChannel|null} */ (null));
  const streamRef = useRef(/** @type {MediaStream|null} */ (null));

  // True only between connect() and _cleanup() — every handler checks this first
  const sessionActiveRef = useRef(false);

  // Configured languages — set at connect(), read in event handlers (stale-closure safe)
  const patientLangRef  = useRef('');
  const practiceLangRef = useRef('');

  // Echo guard: true while Meda's audio is playing — blocks mic VAD false positives
  const speakerLockRef = useRef(false);

  const turnCounterRef    = useRef(0);
  const audioWatchdogRef  = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null));
  // Prevents double-handling of output_audio_buffer end (watchdog vs stopped event)
  const turnSwitchedRef   = useRef(false);

  /** Send a Realtime client event over the DataChannel (safe to call anytime). */
  const _sendDc = useCallback((payload) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(payload));
    }
  }, []);

  /**
   * Full teardown of all WebRTC resources.
   * Sets sessionActiveRef = false first — stops all in-flight handlers.
   * Safe to call multiple times (all operations are idempotent).
   */
  const _cleanup = useCallback(() => {
    sessionActiveRef.current = false; // must be first — aborts all in-flight handlers

    if (dcRef.current) {
      dcRef.current.onmessage = null;
      dcRef.current.onopen    = null;
      dcRef.current.onclose   = null;
      try { dcRef.current.close(); } catch (_) {}
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      try { pcRef.current.close(); } catch (_) {}
      pcRef.current = null;
    }
    clearTimeout(audioWatchdogRef.current);
    audioWatchdogRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioElRef.current) {
      try { audioElRef.current.pause(); } catch (_) {}
      audioElRef.current.srcObject = null;
    }
    speakerLockRef.current = false;
    setSessionStatus('idle');
  }, []);

  /** Parse a Realtime server event → update turns, sessionStatus, speaker detection. */
  const _handleEvent = useCallback((ev) => {
    if (!sessionActiveRef.current) return;

    switch (ev.type) {

      // ── VAD ─────────────────────────────────────────────────────────────────
      case 'input_audio_buffer.speech_started':
        if (!speakerLockRef.current) setSessionStatus('speech_active');
        break;

      case 'input_audio_buffer.speech_stopped':
        if (!speakerLockRef.current) setSessionStatus('processing');
        break;

      // Create a turn slot; speaker role is unknown until transcription completes
      case 'input_audio_buffer.committed':
        if (speakerLockRef.current) break; // echo during Meda playback — discard
        turnCounterRef.current += 1;
        setTurns(prev => [...prev, {
          key:            turnCounterRef.current,
          inputItemId:    ev.item_id ?? null,
          originalText:   null,
          translatedText: '',
          isDone:         false,
          speakerRole:    null,   // filled at transcription.completed
          targetRole:     null,   // filled at transcription.completed
          sourceLanguage: null,
          targetLanguage: null,
        }]);
        break;

      // ── Transcription ────────────────────────────────────────────────────────
      // Speaker role and language direction are determined here from the text.
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = ev.transcript ?? '';
        const detected   = detectLanguage(transcript, patientLangRef.current, practiceLangRef.current);

        let speakerRole    = null;
        let sourceLanguage = null;
        let targetLanguage = null;

        let targetRole = null;

        if (detected === patientLangRef.current) {
          speakerRole    = 'patient';
          targetRole     = 'practice';
          sourceLanguage = patientLangRef.current;
          targetLanguage = practiceLangRef.current;
        } else if (detected === practiceLangRef.current) {
          speakerRole    = 'practice';
          targetRole     = 'patient';
          sourceLanguage = practiceLangRef.current;
          targetLanguage = patientLangRef.current;
        }

        if (speakerRole !== null) {
          setCurrentSpeakerRole(speakerRole);
        }

        setTurns(prev => prev.map(t =>
          t.inputItemId === ev.item_id
            ? {
                ...t,
                originalText: transcript,
                ...(speakerRole !== null ? { speakerRole, targetRole, sourceLanguage, targetLanguage } : {}),
              }
            : t
        ));
        break;
      }

      // ── Response ─────────────────────────────────────────────────────────────
      case 'response.created':
        setSessionStatus('translating');
        break;

      case 'response.audio_transcript.delta':
        setTurns(prev => {
          if (prev.length === 0) return prev;
          return prev.map((t, i) =>
            i === prev.length - 1
              ? { ...t, translatedText: t.translatedText + (ev.delta ?? '') }
              : t
          );
        });
        break;

      case 'response.audio_transcript.done':
        setTurns(prev => {
          if (prev.length === 0) return prev;
          return prev.map((t, i) =>
            i === prev.length - 1
              ? { ...t, translatedText: ev.transcript ?? t.translatedText, isDone: true }
              : t
          );
        });
        break;

      // ── Response done ────────────────────────────────────────────────────────
      // For 'completed': output_audio_buffer.stopped handles cleanup.
      // For failed/cancelled/incomplete: no audio fires — recover here.
      case 'response.done': {
        const respStatus = ev.response?.status;
        if (respStatus === 'failed' || respStatus === 'cancelled' || respStatus === 'incomplete') {
          speakerLockRef.current = false;
          setTurns(prev => {
            if (prev.length === 0) return prev;
            return prev.map((t, i) =>
              i === prev.length - 1 && !t.isDone
                ? { ...t, isDone: true }
                : t
            );
          });
          setSessionStatus('ready');
        }
        break;
      }

      // ── WebRTC audio buffer (WebRTC-only events) ──────────────────────────────
      case 'output_audio_buffer.started':
        speakerLockRef.current  = true;
        turnSwitchedRef.current = false; // arm watchdog for this playback
        setSessionStatus('speaking');
        clearTimeout(audioWatchdogRef.current);
        // Fallback: if output_audio_buffer.stopped never arrives, release the lock
        audioWatchdogRef.current = setTimeout(() => {
          if (!sessionActiveRef.current) return;
          if (turnSwitchedRef.current) return;
          turnSwitchedRef.current = true;
          speakerLockRef.current  = false;
          setEvents(prev => [...prev, { type: 'audio_stopped_watchdog', ts: Date.now() }]);
          setSessionStatus('ready');
        }, 4000);
        break;

      case 'output_audio_buffer.stopped':
        clearTimeout(audioWatchdogRef.current);
        audioWatchdogRef.current = null;
        if (turnSwitchedRef.current) break; // watchdog already handled it
        turnSwitchedRef.current = true;
        speakerLockRef.current  = false;
        setSessionStatus('ready');
        break;

      // ── Error ────────────────────────────────────────────────────────────────
      case 'error':
        setError(ev.error?.message ?? 'Realtime-Fehler');
        setSessionStatus('idle');
        break;

      default:
        break;
    }
  }, []); // all accessed values are refs or stable state setters

  const connect = useCallback(async ({ patientLanguage, practiceLanguage }) => {
    if (connectionState === 'connecting' || connectionState === 'connected') return;

    setConnectionState('connecting');
    setError(null);
    setEvents([]);
    setTurns([]);
    turnCounterRef.current   = 0;
    speakerLockRef.current   = false;
    patientLangRef.current   = patientLanguage;
    practiceLangRef.current  = practiceLanguage;
    sessionActiveRef.current = true; // arm the guard
    setCurrentSpeakerRole(null);     // no speaker detected yet

    try {
      // ── 1. Ephemeral token ──────────────────────────────────────────────────
      const tokenRes = await authFetch('/api/meda-realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientLanguage, practiceLanguage }),
      });

      if (!sessionActiveRef.current) return;

      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `Token-Fehler ${tokenRes.status}`);
      }
      const { clientSecret, model: sessionModel } = await tokenRes.json();
      if (!sessionActiveRef.current) return;

      // ── 2. Microphone ───────────────────────────────────────────────────────
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
        },
      });

      if (!sessionActiveRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;

      // ── 3. RTCPeerConnection ────────────────────────────────────────────────
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (trackEv) => {
        if (!sessionActiveRef.current) return;
        if (trackEv.streams?.[0] && audioElRef.current) {
          audioElRef.current.srcObject = trackEv.streams[0];
          audioElRef.current.play().catch(() => {});
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (!sessionActiveRef.current) return;
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          _cleanup();
          setConnectionState('error');
          setError('Verbindungsfehler — bitte Gespräch neu starten.');
        }
      };

      stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));

      // ── 4. DataChannel ──────────────────────────────────────────────────────
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        if (!sessionActiveRef.current) return;
        setConnectionState('connected');
        setSessionStatus('ready');
      };

      dc.onclose = () => {
        if (!sessionActiveRef.current) return;
        setConnectionState('idle');
        setSessionStatus('idle');
      };

      dc.onmessage = (msg) => {
        if (!sessionActiveRef.current) return;
        try {
          const parsed = JSON.parse(msg.data);
          setEvents(prev => [...prev, parsed]);
          _handleEvent(parsed);
        } catch (_) {}
      };

      // ── 5. SDP offer ────────────────────────────────────────────────────────
      const offer = await pc.createOffer();
      if (!sessionActiveRef.current) { _cleanup(); return; }

      await pc.setLocalDescription(offer);
      if (!sessionActiveRef.current) { _cleanup(); return; }

      // Wait for ICE gathering (max 4 s)
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const onGather = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', onGather);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', onGather);
        setTimeout(resolve, 4000);
      });
      if (!sessionActiveRef.current) { _cleanup(); return; }

      // ── 6. SDP exchange with OpenAI ─────────────────────────────────────────
      // Use the model name returned by the server — must match the created session.
      const sdpRes = await fetch(`${OPENAI_REALTIME_BASE}?model=${encodeURIComponent(sessionModel ?? 'gpt-realtime')}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientSecret}`,
          'Content-Type':  'application/sdp',
        },
        body: pc.localDescription.sdp,
      });
      if (!sessionActiveRef.current) { _cleanup(); return; }

      if (!sdpRes.ok) {
        const text = await sdpRes.text().catch(() => '');
        throw new Error(`OpenAI SDP-Fehler ${sdpRes.status}: ${text.slice(0, 200)}`);
      }

      const answerSdp = await sdpRes.text();
      if (!sessionActiveRef.current) { _cleanup(); return; }

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    } catch (err) {
      _cleanup();
      setConnectionState('error');
      setSessionStatus('idle');
      setError(err?.message ?? 'Verbindung fehlgeschlagen');
    }
  }, [connectionState, _cleanup, _handleEvent]);

  const disconnect = useCallback(() => {
    setConnectionState('disconnecting');
    _cleanup();
    setConnectionState('idle');
    setCurrentSpeakerRole(null);
  }, [_cleanup]);

  const sendEvent = useCallback((event) => {
    _sendDc(event);
  }, [_sendDc]);

  return {
    connect,
    disconnect,
    sendEvent,
    connectionState,
    sessionStatus,
    currentSpeakerRole,
    turns,
    events,
    error,
    audioElRef,
  };
}
