import { useState, useRef, useCallback } from 'react';
import { authFetch } from '../../../api/authFetch.js';

const OPENAI_REALTIME_BASE = 'https://api.openai.com/v1/realtime';
const TRANSCRIPTION_MODEL  = 'gpt-4o-transcribe';

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
 *   speakerRole: SpeakerRole,
 *   sourceLanguage: string,
 *   targetLanguage: string,
 * }} Turn
 */

/**
 * Hook for the Meda Realtime Pingpong interpreter session (Phase 8.5).
 *
 * Phase 8.5 additions over 8.4:
 *  - sessionActiveRef: guards all event handlers and every async step inside connect()
 *    so that a disconnect() during token-fetch or SDP exchange cannot leave dangling
 *    mic tracks, peer connections, or stale React state updates.
 *  - ICE failure now calls _cleanup() to stop the microphone immediately.
 *  - dc.onclose is guarded so a race-condition close after explicit cleanup is ignored.
 *
 * Timeout and unmount/tab-hidden logic live in MedaRealtimePage to keep the
 * hook focused on WebRTC concerns only.
 */
export function useRealtimeSession() {
  const [connectionState,    setConnectionState]    = useState(/** @type {ConnectionState} */ ('idle'));
  const [sessionStatus,      setSessionStatus]      = useState(/** @type {SessionStatus} */ ('idle'));
  const [currentSpeakerRole, setCurrentSpeakerRole] = useState(/** @type {SpeakerRole} */ ('patient'));
  const [currentInputLang,   setCurrentInputLang]   = useState('');
  const [turns,  setTurns]  = useState(/** @type {Turn[]} */ ([]));
  const [events, setEvents] = useState(/** @type {object[]} */ ([]));
  const [error,  setError]  = useState(/** @type {string|null} */ (null));

  // Page attaches its <audio> DOM element here — avoids detached Audio() autoplay issues
  const audioElRef = useRef(/** @type {HTMLAudioElement|null} */ (null));

  const pcRef     = useRef(/** @type {RTCPeerConnection|null} */ (null));
  const dcRef     = useRef(/** @type {RTCDataChannel|null} */ (null));
  const streamRef = useRef(/** @type {MediaStream|null} */ (null));

  // True only between connect() and _cleanup() — every handler checks this first
  // so that no stale async operation can mutate state after disconnect.
  const sessionActiveRef = useRef(false);

  // Session-lifetime language / speaker values — refs avoid stale closures in handlers
  const patientLangRef      = useRef('');
  const practiceLangRef     = useRef('');
  const currentInputLangRef = useRef('');
  const currentSpeakerRef   = useRef(/** @type {SpeakerRole} */ ('patient'));
  const speakerLockRef      = useRef(false);
  const turnCounterRef      = useRef(0);

  /** Send a Realtime client event over the DataChannel (safe to call anytime). */
  const _sendDc = useCallback((payload) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(payload));
    }
  }, []);

  /** Switch input language after a completed turn; updates transcription hint via session.update. */
  const _switchLanguage = useCallback(() => {
    const nextLang = currentInputLangRef.current === patientLangRef.current
      ? practiceLangRef.current
      : patientLangRef.current;
    const nextRole = nextLang === patientLangRef.current ? 'patient' : 'practice';

    currentInputLangRef.current = nextLang;
    currentSpeakerRef.current   = nextRole;
    setCurrentInputLang(nextLang);
    setCurrentSpeakerRole(nextRole);

    _sendDc({
      type: 'session.update',
      session: {
        input_audio_transcription: {
          model:    TRANSCRIPTION_MODEL,
          language: nextLang,
        },
      },
    });
  }, [_sendDc]);

  /**
   * Full teardown of all WebRTC resources.
   * Safe to call multiple times — all operations are idempotent.
   * Sets sessionActiveRef = false first so that any in-flight async steps abort.
   */
  const _cleanup = useCallback(() => {
    sessionActiveRef.current = false; // must be first — stops all in-flight handlers

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

  /** Parse a Realtime server event → update turns, sessionStatus, pingpong state. */
  const _handleEvent = useCallback((ev) => {
    // Drop all events after disconnect / timeout
    if (!sessionActiveRef.current) return;

    switch (ev.type) {

      // ── VAD ─────────────────────────────────────────────────────────────────
      case 'input_audio_buffer.speech_started':
        if (!speakerLockRef.current) setSessionStatus('speech_active');
        break;

      case 'input_audio_buffer.speech_stopped':
        if (!speakerLockRef.current) setSessionStatus('processing');
        break;

      case 'input_audio_buffer.committed':
        if (speakerLockRef.current) break; // likely echo — discard
        turnCounterRef.current += 1;
        {
          const sourceLang = currentInputLangRef.current;
          const targetLang = sourceLang === patientLangRef.current
            ? practiceLangRef.current
            : patientLangRef.current;
          setTurns(prev => [...prev, {
            key:            turnCounterRef.current,
            inputItemId:    ev.item_id ?? null,
            originalText:   null,
            translatedText: '',
            isDone:         false,
            speakerRole:    currentSpeakerRef.current,
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
          }]);
        }
        break;

      // ── Transcription ────────────────────────────────────────────────────────
      case 'conversation.item.input_audio_transcription.completed':
        setTurns(prev => prev.map(t =>
          t.inputItemId === ev.item_id
            ? { ...t, originalText: ev.transcript ?? '' }
            : t
        ));
        break;

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

      // ── WebRTC audio buffer (WebRTC-only events) ──────────────────────────────
      case 'output_audio_buffer.started':
        speakerLockRef.current = true;
        setSessionStatus('speaking');
        break;

      case 'output_audio_buffer.stopped':
        speakerLockRef.current = false;
        _switchLanguage();
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
  }, [_switchLanguage]);

  const connect = useCallback(async ({ patientLanguage, practiceLanguage }) => {
    if (connectionState === 'connecting' || connectionState === 'connected') return;

    setConnectionState('connecting');
    setError(null);
    setEvents([]);
    setTurns([]);
    turnCounterRef.current      = 0;
    speakerLockRef.current      = false;
    patientLangRef.current      = patientLanguage;
    practiceLangRef.current     = practiceLanguage;
    currentInputLangRef.current = patientLanguage;
    currentSpeakerRef.current   = 'patient';
    sessionActiveRef.current    = true; // arm the guard
    setCurrentInputLang(patientLanguage);
    setCurrentSpeakerRole('patient');

    try {
      // ── 1. Ephemeral token ──────────────────────────────────────────────────
      const tokenRes = await authFetch('/api/meda-realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientLanguage, practiceLanguage }),
      });

      // Guard: disconnect() may have been called while the token fetch was in flight
      if (!sessionActiveRef.current) return;

      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `Token-Fehler ${tokenRes.status}`);
      }
      const { clientSecret } = await tokenRes.json();
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
        // disconnect() raced with getUserMedia — stop tracks before returning
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
          // Stop mic and all resources immediately — do not wait for the user
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
        // Guard: if _cleanup() already ran, the handler was nulled out first,
        // but some browsers fire onclose asynchronously — ignore stale closes.
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
      const model  = 'gpt-4o-realtime-preview';
      const sdpRes = await fetch(`${OPENAI_REALTIME_BASE}?model=${encodeURIComponent(model)}`, {
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
    setCurrentInputLang('');
    setCurrentSpeakerRole('patient');
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
    currentInputLang,
    turns,
    events,
    error,
    audioElRef,
  };
}
