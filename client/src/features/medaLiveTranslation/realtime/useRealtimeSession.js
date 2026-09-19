import { useState, useRef, useCallback } from 'react';
import { authFetch } from '../../../api/authFetch.js';
import { detectLanguage, isDefinitelyThirdLanguage } from './realtimeLanguages.js';
import {
  REJECT_REASONS,
  decideUtterance,
  isInterpreterRefusal,
  isOutsideSessionLanguages,
  redactEventForDebug,
} from './utteranceGate.js';

const OPENAI_REALTIME_CALLS = 'https://api.openai.com/v1/realtime/calls';

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

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
 *   unsupportedLanguage: boolean,
 *   speakerRole: SpeakerRole|null,
 *   targetRole: SpeakerRole|null,
 *   sourceLanguage: string|null,
 *   targetLanguage: string|null,
 *   speakerUncertain?: boolean,
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
 *
 * Client-gated responses (server answered responseGating 'client'):
 *  - The model does not answer on its own. Each segment is checked first
 *    (utteranceGate.js) and only an accepted one gets a response.create.
 *  - A segment clearly in a third language gets no card, no translation and
 *    is removed from the model's context (conversation.item.delete).
 *  - Old servers / the rollback switch answer 'server' → the flow below the
 *    gated handler runs exactly as before.
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

  // ── Client-gated responses ────────────────────────────────────────────────
  // 'client' → we send response.create after the gate passes; 'server' → the
  // pre-gating flow, untouched.
  const gatingRef = useRef(/** @type {'client'|'server'} */ ('server'));
  // item_id → speaker selection at SPEECH START (manual mode), so a quick
  // hand-over between two people cannot re-label a segment already under way.
  const segmentsRef = useRef(/** @type {Map<string, {manual:boolean, boundRole:'patient'|'practice'}>} */ (new Map()));
  // item_id → turn slot; only segments that got one (not echo, not paused).
  const itemTurnRef = useRef(/** @type {Map<string, {key:number, committedAt:number}>} */ (new Map()));
  // Only one model response at a time. A segment accepted while another is
  // still being translated waits here instead of being refused.
  const activeRequestKeyRef = useRef(/** @type {number|null} */ (null));
  const responseQueueRef    = useRef(/** @type {number[]} */ ([]));
  const responseRequestedAtRef = useRef(/** @type {Map<number, number>} */ (new Map()));
  // Accepted turns without a speaker → item_id; dropped if the interpreter refuses them.
  const uncertainTurnsRef   = useRef(/** @type {Map<number, string|null>} */ (new Map()));
  const retriedResponseKeysRef = useRef(/** @type {Set<number>} */ (new Set()));
  const clientEventSeqRef   = useRef(0);
  // Short live notice that a segment was kept out — never its words.
  const [gateNotice, setGateNotice] = useState(/** @type {{reason:string, at:number}|null} */ (null));
  const [ignoredCount, setIgnoredCount] = useState(0);

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
      // Closing an already-closed channel throws; that is the ordinary case
      // during teardown, not a failure worth reporting.
      try { dcRef.current.close(); } catch { /* already closed */ }
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      try { pcRef.current.close(); } catch { /* already closed */ }
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
      try { audioElRef.current.pause(); } catch { /* nothing was playing */ }
      audioElRef.current.srcObject = null;
    }
    speakerLockRef.current = false;
    segmentsRef.current.clear();
    itemTurnRef.current.clear();
    activeRequestKeyRef.current = null;
    responseQueueRef.current = [];
    responseRequestedAtRef.current.clear();
    uncertainTurnsRef.current.clear();
    retriedResponseKeysRef.current.clear();
    setSessionStatus('idle');
  }, []);

  /** Parse a Realtime server event → update turns, sessionStatus, speaker detection. */
  const _handleEvent = useCallback((ev) => {
    if (!sessionActiveRef.current) return;

    // ── Per-event helpers (defined here to access refs without stale closures) ──

    // Resolve response → turn NOW, synchronously. The setTurns updaters below
    // run later (React batches updates from the data channel); by then
    // response.done has already deleted the mapping, and the fallback would
    // write this response into whichever turn is still pending — typically the
    // next speaker's turn when two people speak in quick succession.
    const latchedKey = (() => {
      const rid = ev.response_id ?? ev.response?.id;
      return rid ? responseTurnMapRef.current.get(rid) : undefined;
    })();

    /**
     * Find the turn index to write response output to.
     * Primary: look up the response_id in responseTurnMapRef.
     * Fallback: last turn that is not yet done and not unclear (pre-fix behaviour).
     * This ensures delta/done events always target the correct turn even when a
     * new turn is created before the previous response finishes.
     */
    const _targetIdx = (prev, responseId) => {
      // Prefer the mapping as it was when THIS event arrived (see latchedKey),
      // then the live mapping (response.created sets it inside an updater).
      const key = latchedKey !== undefined
        ? latchedKey
        : (responseId ? responseTurnMapRef.current.get(responseId) : undefined);
      if (key !== undefined) {
        const i = prev.findIndex(t => t.key === key);
        if (i >= 0) return i;
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
      if (turn.speakerUncertain) {
        // No known direction: either session language is fine, a third is not.
        return isOutsideSessionLanguages(text, patientLangRef.current, practiceLangRef.current);
      }
      if (!turn.targetLanguage || !turn.sourceLanguage) return false;
      const detected = detectLanguage(text, turn.targetLanguage, turn.sourceLanguage);
      // Tier 1: confident wrong direction (e.g. source instead of target)
      if (detected !== null && detected !== turn.targetLanguage) return true;
      // Tier 2: detectLanguage inconclusive but clearly a third language
      // (catches e.g. Turkish translation in a DE/EN session)
      if (detected === null && isDefinitelyThirdLanguage(text, turn.targetLanguage, turn.sourceLanguage)) return true;
      return false;
    };

    // ── Client-gated flow ──────────────────────────────────────────────────
    // Only reached when the server confirmed responseGating 'client'.

    const _nextEventId = (prefix) => {
      clientEventSeqRef.current += 1;
      return `meda-${prefix}-${clientEventSeqRef.current}`;
    };

    /** Remove an item from the model's context so it cannot colour later turns. */
    const _forgetItem = (itemId) => {
      if (!itemId) return;
      _sendDc({ type: 'conversation.item.delete', event_id: _nextEventId('del'), item_id: itemId });
    };

    /** Ask the model for exactly one translation; queue if one is running. */
    const _requestResponse = (key) => {
      if (activeRequestKeyRef.current !== null) {
        if (!responseQueueRef.current.includes(key)) responseQueueRef.current.push(key);
        return;
      }
      activeRequestKeyRef.current = key;
      responseRequestedAtRef.current.set(key, nowMs());
      _sendDc({
        type: 'response.create',
        event_id: `meda-resp-${key}-${_nextEventId('r')}`,
        response: { metadata: { turn_key: String(key) } },
      });
    };

    const _pumpQueue = () => {
      activeRequestKeyRef.current = null;
      const next = responseQueueRef.current.shift();
      if (next !== undefined) _requestResponse(next);
    };

    const _notice = (reason) => {
      if (!reason || reason === REJECT_REASONS.EMPTY) return;
      setGateNotice({ reason, at: Date.now() });
      setIgnoredCount(c => c + 1);
    };

    /** Keep a segment out of the conversation: no card, no translation, no context. */
    const _rejectSegment = (itemId, reason) => {
      const mapped = itemTurnRef.current.get(itemId);
      itemTurnRef.current.delete(itemId);
      segmentsRef.current.delete(itemId);
      if (mapped) setTurns(prev => prev.filter(t => t.key !== mapped.key));
      _forgetItem(itemId);
      _notice(reason);
      setSessionStatus(s => (s === 'processing' ? 'ready' : s));
      // The reason only — never the words.
      setEvents(prev => [...prev, { type: 'meda.gate.rejected', reason: reason ?? null, ts: Date.now() }]);
    };

    const _handleGatedTranscript = () => {
      const itemId = ev.item_id;
      const mapped = itemId ? itemTurnRef.current.get(itemId) : undefined;
      if (!mapped) {
        // No turn slot: audio captured while Meda was speaking (echo), while
        // paused, or before a reconnect. Never shown; also dropped from context.
        segmentsRef.current.delete(itemId);
        _forgetItem(itemId);
        return;
      }
      if (isPausedRef.current) {
        _rejectSegment(itemId, null);
        return;
      }

      const seg = segmentsRef.current.get(itemId);
      segmentsRef.current.delete(itemId);

      const transcript = ev.transcript ?? '';
      const decision = decideUtterance({
        transcript,
        patientLanguage:  patientLangRef.current,
        practiceLanguage: practiceLangRef.current,
        manualMode:       seg ? seg.manual : manualModeRef.current,
        boundRole:        seg ? seg.boundRole : manualSpeakerRef.current,
      });

      // A later segment already committed means the model's context holds
      // more than this one utterance when we ask it to translate.
      let laterCommitted = 0;
      for (const other of itemTurnRef.current.values()) {
        if (other.key > mapped.key) laterCommitted += 1;
      }
      // Numbers only — never the words — so the debug view cannot leak a bystander.
      setEvents(prev => [...prev, {
        type:           'meda.gate',
        decision:       decision.accept ? 'accepted' : 'rejected',
        reason:         decision.reason,
        speakerCertain: decision.speakerCertain,
        laterCommitted,
        transcriptMs:   Math.round(nowMs() - mapped.committedAt),
        ts:             Date.now(),
      }]);

      if (!decision.accept) {
        _rejectSegment(itemId, decision.reason);
        return;
      }

      itemTurnRef.current.delete(itemId);
      if (decision.speakerRole) setCurrentSpeakerRole(decision.speakerRole);
      if (!decision.speakerCertain) uncertainTurnsRef.current.set(mapped.key, itemId);

      setTurns(prev => prev.map(t => t.key === mapped.key ? {
        ...t,
        originalText: transcript,
        ...(decision.speakerRole ? {
          speakerRole:    decision.speakerRole,
          targetRole:     decision.targetRole,
          sourceLanguage: decision.sourceLanguage,
          targetLanguage: decision.targetLanguage,
        } : {
          // Kept, but nobody is named: shown, archived and exported as
          // "speaker not reliably assigned", never as practice or patient.
          speakerUncertain: true,
        }),
      } : t));

      _requestResponse(mapped.key);
    };

    switch (ev.type) {

      // ── VAD ─────────────────────────────────────────────────────────────────
      case 'input_audio_buffer.speech_started':
        if (!speakerLockRef.current && !isPausedRef.current) setSessionStatus('speech_active');
        if (gatingRef.current === 'client' && ev.item_id) {
          // Bind the segment to whoever is selected NOW, at speech start.
          segmentsRef.current.set(ev.item_id, {
            manual:    manualModeRef.current,
            boundRole: manualSpeakerRef.current,
          });
        }
        break;

      case 'input_audio_buffer.speech_stopped':
        if (!speakerLockRef.current && !isPausedRef.current) setSessionStatus('processing');
        break;

      // Create a turn slot; speaker role is unknown until transcription completes
      case 'input_audio_buffer.committed':
        if (speakerLockRef.current) break; // echo during Meda playback — discard
        if (isPausedRef.current) break;    // paused — discard any buffered input
        turnCounterRef.current += 1;
        if (gatingRef.current === 'client' && ev.item_id) {
          itemTurnRef.current.set(ev.item_id, { key: turnCounterRef.current, committedAt: nowMs() });
        }
        setTurns(prev => [...prev, {
          key:             turnCounterRef.current,
          inputItemId:     ev.item_id ?? null,
          originalText:    null,
          translatedText:  '',
          isDone:          false,
          isUnclear:       false,       // set true when language is unrecognisable
          languageMismatch: false,      // set true when output language guard fires
          unsupportedLanguage: false,   // set true when the INPUT is a non-selected language
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
        if (gatingRef.current === 'client') {
          _handleGatedTranscript();
          break;
        }
        // ── Server-driven flow (unchanged) ───────────────────────────────────
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
          // ── Manual mode: trust the page-selected speaker, skip auto role detection ──
          // Safety: detectLanguage() stays OFF (no de/en disambiguation — that is the
          // whole point of manual mode), but a clearly foreign / third language must
          // still NOT be accepted as a normal turn. isDefinitelyThirdLanguage() blocks
          // e.g. Turkish/Arabic/Spanish in a DE/EN session; short allowed words such as
          // "Ja"/"Nein"/"Yes"/"No" stay below its threshold and pass through.
          if (isDefinitelyThirdLanguage(transcript, patientLangRef.current, practiceLangRef.current)) {
            markUnclear = true;
          } else {
            const role     = manualSpeakerRef.current; // 'patient' | 'practice'
            speakerRole    = role;
            targetRole     = role === 'patient' ? 'practice' : 'patient';
            sourceLanguage = role === 'patient' ? patientLangRef.current : practiceLangRef.current;
            targetLanguage = role === 'patient' ? practiceLangRef.current : patientLangRef.current;
          }
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

        // Privacy/safety: an utterance in a non-selected language must NOT have its
        // raw foreign transcript exposed. We deliberately do NOT store transcript.trim()
        // here — originalText stays empty so the UI, PDF and local history can never
        // show or persist the foreign text. Marks isDone immediately so delta/done
        // events cannot overwrite with hallucinated text.
        if (markUnclear) {
          setTurns(prev => {
            const idx = _findTurn(prev);
            if (idx < 0) return prev;
            return prev.map((t, i) => i === idx ? {
              ...t,
              originalText:        '',
              isUnclear:           true,
              isDone:              true,
              unsupportedLanguage: true,
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

      case 'conversation.item.input_audio_transcription.failed':
        // Unintelligible audio: never guess — keep it out and say so.
        if (gatingRef.current === 'client' && ev.item_id) {
          _rejectSegment(ev.item_id, REJECT_REASONS.UNCLEAR);
        }
        break;

      // ── Response ─────────────────────────────────────────────────────────────
      case 'response.created': {
        const rId = ev.response?.id;
        setSessionStatus('translating');
        if (rId && gatingRef.current === 'client') {
          // We named the turn ourselves in response.create; only one request
          // is ever open, so the active key is the fallback.
          const metaKey = Number(ev.response?.metadata?.turn_key);
          const key = Number.isFinite(metaKey) && metaKey > 0 ? metaKey : activeRequestKeyRef.current;
          if (key !== null) {
            responseTurnMapRef.current.set(rId, key);
            const requestedAt = responseRequestedAtRef.current.get(key);
            if (requestedAt != null) {
              setEvents(prev => [...prev, {
                type: 'meda.latency', stage: 'response_created',
                ms: Math.round(nowMs() - requestedAt), ts: Date.now(),
              }]);
            }
          }
        } else if (rId) {
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

        if (gatingRef.current === 'client') {
          const doneKey = latchedKey;
          if (doneKey !== undefined) {
            responseRequestedAtRef.current.delete(doneKey);
            // A segment we could not attribute, which the interpreter then
            // refused (third language, unintelligible): it never was part of
            // the conversation — remove it rather than show a foreign fragment.
            if (uncertainTurnsRef.current.has(doneKey)) {
              const itemId = uncertainTurnsRef.current.get(doneKey);
              uncertainTurnsRef.current.delete(doneKey);
              const part = ev.response?.output?.[0]?.content?.[0];
              const outText = part?.transcript ?? part?.text ?? '';
              if (respStatus === 'completed' && isInterpreterRefusal(outText)) {
                setTurns(prev => prev.filter(t => t.key !== doneKey));
                _forgetItem(itemId);
                _forgetItem(ev.response?.output?.[0]?.id);
                _notice(REJECT_REASONS.FOREIGN_LANGUAGE);
              }
            }
          }
          _pumpQueue();
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
      case 'error': {
        const failedEventId = String(ev.error?.event_id ?? '');
        if (gatingRef.current === 'client' && failedEventId.startsWith('meda-')) {
          // Bookkeeping calls of the gated flow (forgetting an item the server
          // already dropped, a response request racing another) are recoverable
          // and must never end a live consultation.
          setEvents(prev => [...prev, { type: 'meda.client_event_error', code: ev.error?.code ?? null, ts: Date.now() }]);
          if (failedEventId.startsWith('meda-resp-')) {
            const key = Number(failedEventId.split('-')[2]);
            if (Number.isFinite(key)) {
              if (!retriedResponseKeysRef.current.has(key)) {
                retriedResponseKeysRef.current.add(key);
                responseQueueRef.current.unshift(key);
              } else {
                // Second failure: close the turn with its original text only.
                setTurns(prev => prev.map(t => t.key === key && !t.isDone ? { ...t, isDone: true } : t));
              }
            }
            _pumpQueue();
          }
          break;
        }
        setError(ev.error?.message ?? 'Realtime-Fehler');
        setSessionStatus('idle');
        break;
      }

      default:
        break;
    }
  }, [_sendDc]); // all other accessed values are refs or stable state setters

  const connect = useCallback(async ({ patientLanguage, practiceLanguage }, opts = {}) => {
    if (connectionState === 'connecting' || connectionState === 'connected') return;

    // keepHistory = true → "continue conversation" after a technical stop: a fresh
    // Realtime connection is built, but existing turns / counter / speaker mode are
    // preserved so the conversation visually continues. Default (false) is a clean
    // new session that wipes the previous history.
    const keepHistory = opts.keepHistory === true;

    setConnectionState('connecting');
    setError(null);
    if (!keepHistory) {
      setEvents([]);
      setTurns([]);
      turnCounterRef.current    = 0;
      setCurrentSpeakerRole(null);     // no speaker detected yet
      manualModeRef.current     = false;    // always start in auto mode
      manualSpeakerRef.current  = 'patient';
    }
    speakerLockRef.current   = false;
    patientLangRef.current   = patientLanguage;
    practiceLangRef.current  = practiceLanguage;
    sessionActiveRef.current = true; // arm the guard
    responseTurnMapRef.current.clear(); // stale response_ids from the old connection
    isPausedRef.current      = false;
    // Gated-flow bookkeeping from a previous connection is meaningless now.
    gatingRef.current        = 'server';
    segmentsRef.current.clear();
    itemTurnRef.current.clear();
    activeRequestKeyRef.current = null;
    responseQueueRef.current = [];
    uncertainTurnsRef.current.clear();
    setGateNotice(null);
    if (!keepHistory) setIgnoredCount(0);

    try {
      // ── 1. Ephemeral token ──────────────────────────────────────────────────
      const tokenRes = await authFetch('/api/meda-realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // clientGating: this client sends response.create itself after its
        // checks pass. Older clients omit it and keep the server-driven flow.
        body: JSON.stringify({ patientLanguage, practiceLanguage, clientGating: true }),
      });

      if (!sessionActiveRef.current) return;

      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `Token-Fehler ${tokenRes.status}`);
      }
      const { clientSecret, model: sessionModel, responseGating } = await tokenRes.json();
      if (!sessionActiveRef.current) return;
      // A server that predates the gate answers without responseGating: keep
      // the server-driven flow, exactly as before.
      gatingRef.current = responseGating === 'client' ? 'client' : 'server';

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
          setEvents(prev => [...prev, redactEventForDebug(parsed)]);
          _handleEvent(parsed);
        } catch (err) {
          // Not swallowed. Throwing here would tear down the data channel in
          // the middle of a live conversation, so the frame is still dropped —
          // but a malformed frame, or a bug in _handleEvent, used to leave no
          // trace at all. The message text is deliberately not logged: it
          // carries what the two people are saying to each other.
          console.warn('[realtime] unhandled event frame', err?.name ?? 'Error');
        }
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
    gateNotice,
    ignoredCount,
    connectionState,
    sessionStatus,
    currentSpeakerRole,
    turns,
    events,
    error,
    audioElRef,
  };
}
