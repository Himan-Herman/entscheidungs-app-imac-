import { useState, useRef, useCallback } from 'react';
import { authFetch } from '../../../api/authFetch.js';
import { detectLanguage, isDefinitelyThirdLanguage } from './realtimeLanguages.js';

const OPENAI_REALTIME_CALLS = 'https://api.openai.com/v1/realtime/calls';

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
 *   isUnclear: boolean,
 *   languageMismatch: boolean,
 *   speakerRole: SpeakerRole|null,
 *   targetRole: SpeakerRole|null,
 *   sourceLanguage: string|null,
 *   targetLanguage: string|null,
 *   timestamp: string,
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

  // Maps OpenAI response_id → turn.key so that delta/done events always target the
  // correct turn even when a new turn is created before the previous response finishes.
  const responseTurnMapRef = useRef(/** @type {Map<string, number>} */ (new Map()));

  // Manual mode: when true, skip detectLanguage and use manualSpeakerRef instead.
  // Both are refs so the page can update them live without triggering a re-connect.
  const manualModeRef    = useRef(false);
  const manualSpeakerRef = useRef(/** @type {'patient'|'practice'} */ ('patient'));

  // Pause guard: when true, new audio input/transcription events are discarded.
  // Track.enabled is also set to false so OpenAI receives only silence.
  const isPausedRef = useRef(false);

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
    isPausedRef.current = false;
    if (streamRef.current) {
      // Re-enable tracks before stopping (idempotent if already enabled)
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
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

    // ── Per-event helpers (defined here to access refs without stale closures) ──

    /**
     * Find the turn index to write response output to.
     * Primary: look up the response_id in responseTurnMapRef.
     * Fallback: last turn that is not yet done and not unclear (pre-fix behaviour).
     * This ensures delta/done events always target the correct turn even when a
     * new turn is created before the previous response finishes.
     */
    const _targetIdx = (prev, responseId) => {
      if (responseId) {
        const key = responseTurnMapRef.current.get(responseId);
        if (key !== undefined) {
          const i = prev.findIndex(t => t.key === key);
          if (i >= 0) return i;
        }
      }
      // Fallback: rightmost non-done, non-unclear turn
      for (let i = prev.length - 1; i >= 0; i--) {
        if (!prev[i].isDone && !prev[i].isUnclear) return i;
      }
      return prev.length > 0 ? prev.length - 1 : -1;
    };

    /**
     * Output language guard: returns true when the final translatedText is
     * detectably in the wrong language (not targetLanguage).
     * Two-tier check:
     *  1. detectLanguage: confident wrong direction → block.
     *  2. isDefinitelyThirdLanguage: not target, not source, clearly third → block.
     * Short texts / inconclusive → allowed (returns false).
     */
    const _isOutputMismatch = (turn, text) => {
      if (!text || text.length < 10) return false;
      if (!turn.targetLanguage || !turn.sourceLanguage) return false;
      const detected = detectLanguage(text, turn.targetLanguage, turn.sourceLanguage);
      // Tier 1: confident wrong direction (e.g. source instead of target)
      if (detected !== null && detected !== turn.targetLanguage) return true;
      // Tier 2: detectLanguage inconclusive but clearly a third language
      // (catches e.g. Turkish translation in a DE/EN session)
      if (detected === null && isDefinitelyThirdLanguage(text, turn.targetLanguage, turn.sourceLanguage)) return true;
      return false;
    };

    switch (ev.type) {

      // ── VAD ─────────────────────────────────────────────────────────────────
      case 'input_audio_buffer.speech_started':
        if (!speakerLockRef.current && !isPausedRef.current) setSessionStatus('speech_active');
        break;

      case 'input_audio_buffer.speech_stopped':
        if (!speakerLockRef.current && !isPausedRef.current) setSessionStatus('processing');
        break;

      // Create a turn slot; speaker role is unknown until transcription completes
      case 'input_audio_buffer.committed':
        if (speakerLockRef.current) break; // echo during Meda playback — discard
        if (isPausedRef.current) break;    // paused — discard any buffered input
        turnCounterRef.current += 1;
        setTurns(prev => [...prev, {
          key:             turnCounterRef.current,
          inputItemId:     ev.item_id ?? null,
          originalText:    null,
          translatedText:  '',
          isDone:          false,
          isUnclear:       false,       // set true when language is unrecognisable
          languageMismatch: false,      // set true when output language guard fires
          speakerRole:     null,        // filled at transcription.completed
          targetRole:      null,        // filled at transcription.completed
          sourceLanguage:  null,
          targetLanguage:  null,
          timestamp:       new Date().toISOString(),
        }]);
        break;

      // ── Transcription ────────────────────────────────────────────────────────
      // Speaker role and language direction are determined here.
      // Auto mode:   detectLanguage() on the transcript text.
      // Manual mode: use manualSpeakerRef directly — no language detection.
      case 'conversation.item.input_audio_transcription.completed': {
        // Paused — discard any transcription that arrived after pause was set
        if (isPausedRef.current) break;

        const transcript = ev.transcript ?? '';

        // Resolve which turn to update.
        // Primary: match by item_id (set at input_audio_buffer.committed).
        // Fallback: last turn still waiting for its transcript (originalText === null).
        const _findTurn = (prev) => {
          const byId = prev.findIndex(t => t.inputItemId === ev.item_id);
          if (byId >= 0) return byId;
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].originalText === null) return i;
          }
          return -1;
        };

        // Empty transcript → always unclear (nothing to translate).
        if (!transcript.trim()) {
          setTurns(prev => {
            const idx = _findTurn(prev);
            if (idx < 0) return prev;
            return prev.map((t, i) => i === idx ? {
              ...t,
              originalText:   '—',
              isUnclear:      true,
              isDone:         true,
              translatedText: 'Bitte wiederholen Sie die Aussage klar in einer der ausgewählten Gesprächssprachen.',
            } : t);
          });
          break;
        }

        let speakerRole    = null;
        let sourceLanguage = null;
        let targetLanguage = null;
        let targetRole     = null;
        let markUnclear    = false;

        if (manualModeRef.current) {
          // ── Manual mode: trust the page-selected speaker, skip language detection ──
          const role     = manualSpeakerRef.current; // 'patient' | 'practice'
          speakerRole    = role;
          targetRole     = role === 'patient' ? 'practice' : 'patient';
          sourceLanguage = role === 'patient' ? patientLangRef.current : practiceLangRef.current;
          targetLanguage = role === 'patient' ? practiceLangRef.current : patientLangRef.current;
        } else {
          // ── Auto mode: detect language from transcript text ──────────────────────
          const detected = detectLanguage(transcript, patientLangRef.current, practiceLangRef.current);

          if (detected === null) {
            // Noise, foreign script, or inconclusive → mark unclear
            markUnclear = true;
          } else if (detected === patientLangRef.current) {
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
        }

        // Marks isDone immediately so delta/done events cannot overwrite with hallucinated text.
        if (markUnclear) {
          setTurns(prev => {
            const idx = _findTurn(prev);
            if (idx < 0) return prev;
            return prev.map((t, i) => i === idx ? {
              ...t,
              originalText:   transcript.trim(),
              isUnclear:      true,
              isDone:         true,
              translatedText: 'Bitte wiederholen Sie die Aussage klar in einer der ausgewählten Gesprächssprachen.',
            } : t);
          });
          break;
        }

        if (speakerRole !== null) {
          setCurrentSpeakerRole(speakerRole);
        }

        setTurns(prev => {
          const idx = _findTurn(prev);
          if (idx < 0) return prev;
          return prev.map((t, i) => i === idx ? {
            ...t,
            originalText: transcript,
            ...(speakerRole !== null ? { speakerRole, targetRole, sourceLanguage, targetLanguage } : {}),
          } : t);
        });
        break;
      }

      // ── Response ─────────────────────────────────────────────────────────────
      case 'response.created': {
        const rId = ev.response?.id;
        setSessionStatus('translating');
        if (rId) {
          // Latch: map this response_id → the turn it belongs to.
          // Find the last turn that has been transcribed but not yet completed.
          // This ensures all subsequent delta/done events for this response_id
          // target the correct turn even if new turns are created concurrently.
          setTurns(prev => {
            for (let i = prev.length - 1; i >= 0; i--) {
              const t = prev[i];
              if (!t.isDone && !t.isUnclear && t.originalText !== null) {
                responseTurnMapRef.current.set(rId, t.key);
                break;
              }
            }
            return prev; // no turn state change — only updates the ref
          });
        }
        break;
      }

      // Audio-output transcript (fires when session runs in audio mode)
      case 'response.audio_transcript.delta':
        setTurns(prev => {
          const idx = _targetIdx(prev, ev.response_id);
          if (idx < 0 || prev[idx].isUnclear) return prev;
          return prev.map((t, i) =>
            i === idx ? { ...t, translatedText: t.translatedText + (ev.delta ?? '') } : t
          );
        });
        break;

      case 'response.audio_transcript.done': {
        setTurns(prev => {
          const idx = _targetIdx(prev, ev.response_id);
          if (idx < 0 || prev[idx].isUnclear) return prev;
          const txt      = ev.transcript ?? prev[idx].translatedText;
          const mismatch = _isOutputMismatch(prev[idx], txt);
          return prev.map((t, i) => i === idx ? {
            ...t,
            translatedText: mismatch
              ? 'Bitte wiederholen Sie die Aussage klar in einer der ausgewählten Gesprächssprachen.'
              : txt,
            isDone: true,
            ...(mismatch ? { isUnclear: true, languageMismatch: true } : {}),
          } : t);
        });
        break;
      }

      // Text-output transcript (fires when session runs in text mode or combined mode).
      // Identical logic — whichever event arrives first fills translatedText.
      case 'response.text.delta':
        setTurns(prev => {
          const idx = _targetIdx(prev, ev.response_id);
          if (idx < 0 || prev[idx].isUnclear) return prev;
          return prev.map((t, i) =>
            i === idx ? { ...t, translatedText: t.translatedText + (ev.delta ?? '') } : t
          );
        });
        break;

      case 'response.text.done': {
        setTurns(prev => {
          const idx = _targetIdx(prev, ev.response_id);
          if (idx < 0 || prev[idx].isUnclear) return prev;
          const txt      = ev.text ?? prev[idx].translatedText;
          const mismatch = _isOutputMismatch(prev[idx], txt);
          return prev.map((t, i) => i === idx ? {
            ...t,
            translatedText: mismatch
              ? 'Bitte wiederholen Sie die Aussage klar in einer der ausgewählten Gesprächssprachen.'
              : txt,
            isDone: true,
            ...(mismatch ? { isUnclear: true, languageMismatch: true } : {}),
          } : t);
        });
        break;
      }

      // Fires when an output content part (audio or text) is fully generated.
      // Contains part.transcript (audio mode) or part.text (text mode).
      // Acts as a safety net if delta events did not arrive.
      case 'response.content_part.done': {
        const part = ev.part ?? {};
        const text = part.transcript ?? part.text ?? '';
        if (!text) break;
        setTurns(prev => {
          const idx = _targetIdx(prev, ev.response_id);
          if (idx < 0 || prev[idx].isUnclear) return prev;
          const mismatch = _isOutputMismatch(prev[idx], text);
          return prev.map((t, i) => i === idx ? {
            ...t,
            translatedText: mismatch
              ? 'Bitte wiederholen Sie die Aussage klar in einer der ausgewählten Gesprächssprachen.'
              : (t.translatedText || text),
            isDone: true,
            ...(mismatch ? { isUnclear: true, languageMismatch: true } : {}),
          } : t);
        });
        break;
      }

      // ── Response done ────────────────────────────────────────────────────────
      case 'response.done': {
        const responseId = ev.response?.id;
        const respStatus = ev.response?.status;

        if (respStatus === 'failed' || respStatus === 'cancelled' || respStatus === 'incomplete') {
          // No audio will follow — unlock mic and close the affected turn.
          speakerLockRef.current = false;
          setTurns(prev => {
            const idx = _targetIdx(prev, responseId);
            if (idx < 0) return prev;
            return prev.map((t, i) =>
              i === idx && !t.isDone ? { ...t, isDone: true } : t
            );
          });
          setSessionStatus('ready');

        } else if (respStatus === 'completed') {
          // Extract translation from response output as final fallback.
          // Covers the case where delta/done transcript events did not arrive.
          const part     = ev.response?.output?.[0]?.content?.[0];
          const fallback = part?.transcript ?? part?.text ?? '';
          setTurns(prev => {
            const idx = _targetIdx(prev, responseId);
            if (idx < 0 || prev[idx].isUnclear) return prev;
            const txt      = prev[idx].translatedText || fallback;
            const mismatch = txt ? _isOutputMismatch(prev[idx], txt) : false;
            return prev.map((t, i) => i === idx ? {
              ...t,
              translatedText: mismatch
                ? 'Bitte wiederholen Sie die Aussage klar in einer der ausgewählten Gesprächssprachen.'
                : txt,
              isDone: true,
              ...(mismatch ? { isUnclear: true, languageMismatch: true } : {}),
            } : t);
          });
          // Safety: if audio already stopped but status is still translating/processing,
          // reset to ready so the next turn can start.
          if (!speakerLockRef.current) {
            setSessionStatus(s => (s === 'translating' || s === 'processing') ? 'ready' : s);
          }
        }

        // Always clean up the response→turn mapping entry.
        if (responseId) responseTurnMapRef.current.delete(responseId);
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
    responseTurnMapRef.current.clear();
    manualModeRef.current    = false;    // always start in auto mode
    manualSpeakerRef.current = 'patient';
    isPausedRef.current      = false;

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

      // ── 6. SDP exchange with OpenAI (GA WebRTC endpoint) ────────────────────
      const sdpRes = await fetch(`${OPENAI_REALTIME_CALLS}?model=${encodeURIComponent(sessionModel ?? 'gpt-realtime')}`, {
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

  /** Locally correct the originalText of a completed turn (no re-translation). */
  const updateTurnOriginalText = useCallback((turnKey, newText) => {
    setTurns(prev => prev.map(t =>
      t.key === turnKey ? { ...t, originalText: newText, originalEdited: true } : t
    ));
  }, []);

  /**
   * Switch between auto and manual speaker detection without disconnecting.
   * Safe to call at any time — updates refs only, no React state change.
   * @param {boolean} isManual  true = manual, false = auto (default)
   * @param {'patient'|'practice'} speaker  active speaker in manual mode
   */
  const setManualMode = useCallback((isManual, speaker) => {
    manualModeRef.current = Boolean(isManual);
    if (speaker === 'patient' || speaker === 'practice') {
      manualSpeakerRef.current = speaker;
    }
  }, []);

  /**
   * Pause the active session: mute the microphone track so OpenAI receives only
   * silence, and block new turn creation.  The WebRTC/DataChannel connection stays
   * open — no reconnect is needed to resume.
   * Call only when connectionState === 'connected'.
   */
  const pause = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
    isPausedRef.current = true;
  }, []);

  /**
   * Resume a paused session: re-enable the microphone track.
   * The caller is responsible for adjusting the timer (sessionStartRef offset).
   */
  const resume = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
    isPausedRef.current = false;
  }, []);

  return {
    connect,
    disconnect,
    pause,
    resume,
    sendEvent,
    updateTurnOriginalText,
    setManualMode,
    connectionState,
    sessionStatus,
    currentSpeakerRole,
    turns,
    events,
    error,
    audioElRef,
  };
}
