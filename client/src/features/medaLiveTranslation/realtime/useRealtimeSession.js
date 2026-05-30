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
 * Hook for the Meda Realtime Pingpong interpreter session (Phase 8.4).
 *
 * Manages:
 *  - WebRTC connection lifecycle (ephemeral token → SDP exchange)
 *  - Automatic pingpong turn-taking via output_audio_buffer.stopped
 *  - Language switching via session.update after each complete turn
 *  - Speaker-lock to suppress echo-triggered false VAD during Meda audio
 *  - Structured conversation turns with speakerRole, source/targetLanguage
 *  - audioElRef: assign to a DOM <audio> element for remote audio output
 *
 * session.update format confirmed from SDK types:
 *   { type: 'session.update', session: { input_audio_transcription: { model, language } } }
 *
 * WebRTC-only events used for speaker-lock and turn-switch:
 *   output_audio_buffer.started  → speakerLock = true
 *   output_audio_buffer.stopped  → speakerLock = false, switch language, send session.update
 */
export function useRealtimeSession() {
  const [connectionState, setConnectionState]   = useState(/** @type {ConnectionState} */ ('idle'));
  const [sessionStatus,   setSessionStatus]     = useState(/** @type {SessionStatus} */ ('idle'));
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

  // Session-lifetime values — stored in refs to avoid stale closures inside _handleEvent
  const patientLangRef       = useRef('');
  const practiceLangRef      = useRef('');
  const currentInputLangRef  = useRef('');  // mirrors currentInputLang state
  const currentSpeakerRef    = useRef(/** @type {SpeakerRole} */ ('patient')); // mirrors currentSpeakerRole
  const speakerLockRef       = useRef(false); // true while Meda audio is playing → suppress echo VAD
  const turnCounterRef       = useRef(0);

  /** Send a Realtime client event over the DataChannel (safe to call anytime). */
  const _sendDc = useCallback((payload) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(payload));
    }
  }, []);

  /** Switch input language after turn, update transcription hint via session.update. */
  const _switchLanguage = useCallback(() => {
    const nextLang = currentInputLangRef.current === patientLangRef.current
      ? practiceLangRef.current
      : patientLangRef.current;
    const nextRole = nextLang === patientLangRef.current ? 'patient' : 'practice';

    currentInputLangRef.current = nextLang;
    currentSpeakerRef.current   = nextRole;
    setCurrentInputLang(nextLang);
    setCurrentSpeakerRole(nextRole);

    // Tell transcription model which language to expect next
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

  const _cleanup = useCallback(() => {
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
      audioElRef.current.srcObject = null;
    }
    speakerLockRef.current = false;
    setSessionStatus('idle');
  }, []);

  /** Parse a Realtime server event → update turns, sessionStatus, pingpong state. */
  const _handleEvent = useCallback((ev) => {
    switch (ev.type) {

      // ── VAD events ──────────────────────────────────────────────────────────
      case 'input_audio_buffer.speech_started':
        // Ignore while Meda is speaking — hardware echo cancellation should prevent
        // pickup, but speakerLock is the safety net for any edge cases.
        if (!speakerLockRef.current) {
          setSessionStatus('speech_active');
        }
        break;

      case 'input_audio_buffer.speech_stopped':
        if (!speakerLockRef.current) {
          setSessionStatus('processing');
        }
        break;

      case 'input_audio_buffer.committed':
        // Guard: if speakerLock is set, this commit likely came from Meda's own audio
        // being picked up by the mic (echo). Skip creating a turn.
        if (speakerLockRef.current) break;

        turnCounterRef.current += 1;
        {
          const sourceLang = currentInputLangRef.current;
          const targetLang = sourceLang === patientLangRef.current
            ? practiceLangRef.current
            : patientLangRef.current;
          const role = currentSpeakerRef.current;

          setTurns(prev => [...prev, {
            key:            turnCounterRef.current,
            inputItemId:    ev.item_id ?? null,
            originalText:   null,
            translatedText: '',
            isDone:         false,
            speakerRole:    role,
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

      // ── Response lifecycle ───────────────────────────────────────────────────
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
        // Finalize translation text; mark turn done (audio still playing)
        setTurns(prev => {
          if (prev.length === 0) return prev;
          return prev.map((t, i) =>
            i === prev.length - 1
              ? { ...t, translatedText: ev.transcript ?? t.translatedText, isDone: true }
              : t
          );
        });
        break;

      // ── WebRTC audio buffer events (WebRTC-only, not emitted in WebSocket mode) ─
      case 'output_audio_buffer.started':
        // Meda begins streaming audio — lock out microphone input to suppress echo
        speakerLockRef.current = true;
        setSessionStatus('speaking');
        break;

      case 'output_audio_buffer.stopped':
        // Audio buffer fully drained — safe to switch sides and accept new input
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
    turnCounterRef.current    = 0;
    speakerLockRef.current    = false;
    patientLangRef.current    = patientLanguage;
    practiceLangRef.current   = practiceLanguage;
    currentInputLangRef.current = patientLanguage;
    currentSpeakerRef.current   = 'patient';
    setCurrentInputLang(patientLanguage);
    setCurrentSpeakerRole('patient');

    try {
      // 1. Ephemeral token — server never exposes the API key
      const tokenRes = await authFetch('/api/meda-realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientLanguage, practiceLanguage }),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `Token-Fehler ${tokenRes.status}`);
      }
      const { clientSecret } = await tokenRes.json();

      // 2. Microphone — hardware echo cancellation is the first line of defence
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
        },
      });
      streamRef.current = stream;

      // 3. RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Attach incoming audio track to the page's <audio> DOM element
      pc.ontrack = (trackEv) => {
        if (trackEv.streams?.[0] && audioElRef.current) {
          audioElRef.current.srcObject = trackEv.streams[0];
          audioElRef.current.play().catch(() => {});
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setConnectionState('error');
          setError(`ICE-Verbindung fehlgeschlagen: ${pc.iceConnectionState}`);
        }
      };

      stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));

      // 4. DataChannel for Realtime server events + client commands
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setConnectionState('connected');
        setSessionStatus('ready');
      };

      dc.onclose = () => {
        setConnectionState('idle');
        setSessionStatus('idle');
      };

      dc.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          setEvents(prev => [...prev, parsed]);
          _handleEvent(parsed);
        } catch (_) {}
      };

      // 5. SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering (max 4s)
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

      // 6. SDP exchange with OpenAI — ephemeral client secret authorises this request
      const model  = 'gpt-4o-realtime-preview';
      const sdpRes = await fetch(`${OPENAI_REALTIME_BASE}?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientSecret}`,
          'Content-Type':  'application/sdp',
        },
        body: pc.localDescription.sdp,
      });

      if (!sdpRes.ok) {
        const text = await sdpRes.text().catch(() => '');
        throw new Error(`OpenAI SDP-Fehler ${sdpRes.status}: ${text.slice(0, 200)}`);
      }

      const answerSdp = await sdpRes.text();
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
