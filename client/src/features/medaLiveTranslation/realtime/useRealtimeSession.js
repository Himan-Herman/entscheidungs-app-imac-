import { useState, useRef, useCallback } from 'react';
import { authFetch } from '../../../api/authFetch.js';

// OpenAI Realtime WebRTC endpoint — browser posts SDP offer directly
const OPENAI_REALTIME_BASE = 'https://api.openai.com/v1/realtime';

/**
 * @typedef {'idle'|'connecting'|'connected'|'disconnecting'|'error'} ConnectionState
 * @typedef {'closed'|'connecting'|'open'} DataChannelState
 */

/**
 * Hook for a single OpenAI Realtime WebRTC session.
 *
 * Responsibilities (Phase 8.2 scope only):
 *  - Fetch ephemeral token from /api/meda-realtime/session
 *  - Build RTCPeerConnection, attach microphone, create data channel
 *  - Perform SDP offer → OpenAI → SDP answer exchange
 *  - Expose raw incoming server events (no pingpong logic yet)
 *  - Expose connect / disconnect / sendEvent
 *
 * NOT in this hook: pingpong state machine, voice switching, UI logic.
 */
export function useRealtimeSession() {
  const [connectionState, setConnectionState] = useState(/** @type {ConnectionState} */ ('idle'));
  const [dataChannelState, setDataChannelState] = useState(/** @type {DataChannelState} */ ('closed'));
  const [lastEvent, setLastEvent] = useState(/** @type {object|null} */ (null));
  const [events, setEvents] = useState(/** @type {object[]} */ ([]));
  const [error, setError] = useState(/** @type {string|null} */ (null));

  const pcRef = useRef(/** @type {RTCPeerConnection|null} */ (null));
  const dcRef = useRef(/** @type {RTCDataChannel|null} */ (null));
  const streamRef = useRef(/** @type {MediaStream|null} */ (null));
  const audioElRef = useRef(/** @type {HTMLAudioElement|null} */ (null));

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
      audioElRef.current = null;
    }
    setDataChannelState('closed');
  }, []);

  const connect = useCallback(async ({ patientLanguage, practiceLanguage }) => {
    if (connectionState === 'connecting' || connectionState === 'connected') return;

    setConnectionState('connecting');
    setError(null);
    setEvents([]);
    setLastEvent(null);

    try {
      // 1. Fetch ephemeral token from our server
      const tokenRes = await authFetch('/api/meda-realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientLanguage, practiceLanguage }),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `Token-Fehler ${tokenRes.status}`);
      }
      const { clientSecret, sessionId } = await tokenRes.json();

      // 2. Microphone stream — hardware echo cancellation to prevent audio loop
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

      // Receive OpenAI audio output
      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioElRef.current = audioEl;

      pc.ontrack = (ev) => {
        if (ev.streams?.[0]) {
          audioEl.srcObject = ev.streams[0];
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setConnectionState('error');
          setError(`ICE-Verbindung fehlgeschlagen: ${pc.iceConnectionState}`);
        }
      };

      // Attach microphone track
      stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));

      // 4. Data channel for server events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setDataChannelState('open');
        setConnectionState('connected');
      };

      dc.onclose = () => {
        setDataChannelState('closed');
        if (connectionState !== 'disconnecting') {
          setConnectionState('idle');
        }
      };

      dc.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          setLastEvent(parsed);
          setEvents(prev => [...prev, parsed]);
        } catch (_) {
          // Non-JSON frame — ignore
        }
      };

      // 5. SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete (max 4s)
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

      // 6. Exchange SDP with OpenAI directly using the ephemeral token
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

      // sessionId available for future session.update calls
      void sessionId;

    } catch (err) {
      _cleanup();
      setConnectionState('error');
      setError(err?.message ?? 'Verbindung fehlgeschlagen');
    }
  }, [connectionState, _cleanup]);

  const disconnect = useCallback(() => {
    setConnectionState('disconnecting');
    _cleanup();
    setConnectionState('idle');
  }, [_cleanup]);

  /**
   * Send a Realtime API client event over the data channel.
   * @param {object} event - Must include `type` field.
   */
  const sendEvent = useCallback((event) => {
    if (dcRef.current?.readyState !== 'open') return;
    dcRef.current.send(JSON.stringify(event));
  }, []);

  return {
    connect,
    disconnect,
    sendEvent,
    connectionState,
    dataChannelState,
    lastEvent,
    events,
    error,
  };
}
