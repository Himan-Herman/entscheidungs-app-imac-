import { useState, useRef, useCallback } from 'react';
import { authFetch } from '../../../api/authFetch.js';

const OPENAI_REALTIME_BASE = 'https://api.openai.com/v1/realtime';

/**
 * @typedef {'idle'|'connecting'|'connected'|'disconnecting'|'error'} ConnectionState
 * @typedef {'idle'|'ready'|'speech_active'|'processing'|'translating'|'speaking'} SessionStatus
 * @typedef {{ key: number, inputItemId: string|null, originalText: string|null, translatedText: string, isDone: boolean }} Turn
 */

/**
 * Hook for the Meda Realtime interpreter session (Phase 8.3).
 *
 * Manages:
 *  - WebRTC connection lifecycle (token fetch → SDP exchange)
 *  - Structured conversation turns parsed from Realtime server events
 *  - Session status derived from VAD + response events
 *  - audioElRef: assign to a DOM <audio> element for remote audio output
 */
export function useRealtimeSession() {
  const [connectionState, setConnectionState] = useState(/** @type {ConnectionState} */ ('idle'));
  const [sessionStatus, setSessionStatus] = useState(/** @type {SessionStatus} */ ('idle'));
  const [turns, setTurns] = useState(/** @type {Turn[]} */ ([]));
  const [events, setEvents] = useState(/** @type {object[]} */ ([]));
  const [error, setError] = useState(/** @type {string|null} */ (null));

  // Page attaches its <audio> DOM element here — avoids detached Audio() autoplay issues
  const audioElRef = useRef(/** @type {HTMLAudioElement|null} */ (null));

  const pcRef = useRef(/** @type {RTCPeerConnection|null} */ (null));
  const dcRef = useRef(/** @type {RTCDataChannel|null} */ (null));
  const streamRef = useRef(/** @type {MediaStream|null} */ (null));

  // Turn sequencing — commits arrive before response events, so this is safe
  const turnCounterRef = useRef(0);

  const _cleanup = useCallback(() => {
    if (dcRef.current) {
      dcRef.current.onmessage = null;
      dcRef.current.onopen = null;
      dcRef.current.onclose = null;
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
    setSessionStatus('idle');
  }, []);

  /** Parse a Realtime server event and update conversation state. */
  const _handleEvent = useCallback((ev) => {
    switch (ev.type) {
      case 'input_audio_buffer.speech_started':
        setSessionStatus('speech_active');
        break;

      case 'input_audio_buffer.speech_stopped':
        setSessionStatus('processing');
        break;

      case 'input_audio_buffer.committed':
        // Audio committed → create a new turn placeholder
        turnCounterRef.current += 1;
        setTurns(prev => [...prev, {
          key: turnCounterRef.current,
          inputItemId: ev.item_id ?? null,
          originalText: null,
          translatedText: '',
          isDone: false,
        }]);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Fill in original text for the matching turn
        setTurns(prev => prev.map(t =>
          t.inputItemId === ev.item_id
            ? { ...t, originalText: ev.transcript ?? '' }
            : t
        ));
        break;

      case 'response.created':
        setSessionStatus('translating');
        break;

      case 'response.audio_transcript.delta':
        // Append streaming delta to the most recent (last) turn
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
        // Overwrite with final transcript (eliminates any streaming artifacts)
        setTurns(prev => {
          if (prev.length === 0) return prev;
          return prev.map((t, i) =>
            i === prev.length - 1
              ? { ...t, translatedText: ev.transcript ?? t.translatedText, isDone: true }
              : t
          );
        });
        setSessionStatus('speaking');
        break;

      case 'response.done':
        setSessionStatus('ready');
        break;

      case 'error':
        setError(ev.error?.message ?? 'Realtime-Fehler');
        setSessionStatus('idle');
        break;

      default:
        break;
    }
  }, []);

  const connect = useCallback(async ({ patientLanguage, practiceLanguage }) => {
    if (connectionState === 'connecting' || connectionState === 'connected') return;

    setConnectionState('connecting');
    setError(null);
    setEvents([]);
    setTurns([]);
    turnCounterRef.current = 0;

    try {
      // 1. Ephemeral token from our server (never expose the API key to the client)
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

      // 2. Microphone — hardware echo cancellation prevents audio loop
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 3. RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio track → attach to the page's <audio> DOM element
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

      // 4. Data channel for Realtime events
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

      // 6. SDP exchange with OpenAI using ephemeral client secret
      const model = 'gpt-4o-realtime-preview';
      const sdpRes = await fetch(`${OPENAI_REALTIME_BASE}?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
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
  }, [_cleanup]);

  const sendEvent = useCallback((event) => {
    if (dcRef.current?.readyState !== 'open') return;
    dcRef.current.send(JSON.stringify(event));
  }, []);

  return {
    connect,
    disconnect,
    sendEvent,
    connectionState,
    sessionStatus,
    turns,
    events,
    error,
    audioElRef,
  };
}
