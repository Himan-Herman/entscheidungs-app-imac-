# Medical Interpreter — Phase 5 Implementation Report

**Status:** Implemented and hardened (realtime communication layer)  
**Date:** 2026-05-20

## Summary

Phase 5 adds **optional** realtime capabilities on top of the existing push-to-talk (PTT) workflow. PTT remains the default and safest path. All realtime features are flag-gated, auth-protected, rate-limited, and bounded by privacy rules (no audio persistence, no transcript logging, no medical interpretation).

---

## Feature flags

| Server | Client (Vite) | Default |
|--------|-----------------|---------|
| `MEDICAL_INTERPRETER_STREAMING_STT_ENABLED` | `VITE_MEDICAL_INTERPRETER_STREAMING_STT_ENABLED` | off |
| `MEDICAL_INTERPRETER_NEAR_REALTIME_TRANSLATION_ENABLED` | `VITE_MEDICAL_INTERPRETER_NEAR_REALTIME_TRANSLATION_ENABLED` | off |
| `MEDICAL_INTERPRETER_STREAMING_TTS_ENABLED` | `VITE_MEDICAL_INTERPRETER_STREAMING_TTS_ENABLED` | off |

Runtime: `GET /api/interpreter/status` exposes `streamingSttEnabled`, `nearRealtimeTranslationEnabled`, `streamingTtsEnabled` (client uses `useInterpreterServerStatus`).

---

## Backend endpoints

### Streaming STT (Option B — chunked upload prototype)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/interpreter/stream/transcribe/start` | Start in-memory stream session |
| POST | `/api/interpreter/stream/transcribe/chunk` | Upload audio chunk (multipart) |
| GET | `/api/interpreter/stream/transcribe/:streamId/status` | Partial status |
| POST | `/api/interpreter/stream/transcribe/:streamId/finish` | Final Whisper transcribe |
| DELETE | `/api/interpreter/stream/transcribe/:streamId` | Cancel + cleanup |

**Limits** (`server/config/interpreterStreamEnv.js`): 120s max duration, 256KB/chunk, 4MB total, 1 active stream/user, max 5 partial previews.

### Near-realtime translation

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/interpreter/near-realtime/translate` | Stateless preview translate (no history) |

**Limits:** 600 chars/chunk, debounced client-side, same `translateInterpreterTurn` + safety prompts as PTT.

### Streaming / near-realtime TTS

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/interpreter/stream/speak` | TTS for preview text (flag-gated) |
| POST | `/api/interpreter/speak` | Confirmed-turn playback (existing) |

---

## Frontend architecture

| Area | Key files |
|------|-----------|
| Live room orchestration | `InterpreterLiveRoom.jsx` |
| PTT recorder | `hooks/useInterpreterRecorder.js` |
| PTT phase machine | `utils/interpreterPttPhase.js` |
| Streaming capture | `hooks/useInterpreterStreamCapture.js` |
| Near-realtime preview | `hooks/useInterpreterNearRealtimePreview.js` |
| TTS playback | `hooks/useInterpreterTtsPlayback.js` |
| UI panels | `InterpreterPushToTalkPanel`, `InterpreterStreamingPanel`, `InterpreterNearRealtimePreviewPanel`, `InterpreterPlaybackStatus` |
| APIs | `interpreterStreamApi.js`, `interpreterNearRealtimeApi.js`, `interpreterStreamSpeakApi.js` |

---

## PTT reliability (Phase 5.2 + hardening pass)

**State machine** (`derivePttPhase`):

`idle` → `recording` → `uploading` → `transcribing` → `draft_ready` → `translating` → `translated` | `blocked` | `error`

**Hardening applied in this pass:**

- Distinct **uploading** phase while recorder is stopping (before transcribe).
- **Double-start guard:** `recorderBusy` + in-flight transcribe/translate flags.
- **Double-stop:** `stoppingRef` in recorder; toggle treats `isStopping` as stop intent.
- **No record during pending draft:** `hasPendingDraftTurn(session)` blocks new PTT.
- **Stop TTS on record start:** `stopAllPlayback()` in `onRecordingStart`.
- **Speaker change blocked** during transcribe/translate pipeline (calm busy message).
- **Tab hidden / page hide / route leave:** recorder cancel, stream cancel, abort controllers, TTS revoke.
- **Draft autosave** (400ms debounce) + leave guard via `useInterpreterDraftGuard`.
- **Edit-before-translate** enforced via draft status + confirm flow.

---

## Streaming STT behaviour

- User must tap **Start streaming** — no always-on mic.
- Chunks uploaded every 1s; queue max 12 (backpressure → stop + fallback message).
- **Auto-stop at 120s** (client timer + server expiry).
- Provisional captions with **“Provisional draft (not confirmed)”** label.
- **Use as draft** → creates `TURN_STATUS_DRAFT`; user must still confirm translate.
- Unsupported browser → panel hidden / error; PTT remains available.
- On failure → calm error + PTT fallback copy.

---

## Near-realtime translation behaviour

- Enabled only when streaming STT + server flag + client flag.
- Debounce **1400ms**, min **20** chars, max **600** chars sent.
- Skips duplicate chunk text; aborts on unmount.
- Preview labelled **unconfirmed**; stale label when source changes.
- **No turn saved** until user uses streaming draft + confirms translate in transcript panel.

---

## TTS playback behaviour

- **No autoplay** — explicit Listen buttons; preview TTS requires opt-in checkbox.
- In-memory blob cache (max 8 entries); repeat identical request throttled **4s**.
- `URL.revokeObjectURL` on stop/unmount.
- Recording/streaming start stops playback.
- Stream speak endpoint used only for preview target when flag on.

---

## Fallback behaviour

| Failure | Behaviour |
|---------|-----------|
| Flags off | PTT + standard translate/speak only |
| Streaming error | Message + stop mic; PTT enabled |
| Offline | Banner; abort requests; cancel record/stream/TTS |
| Rate limit | Safe JSON; user message |
| Unsupported browser | Streaming hidden; PTT works |

---

## Privacy safeguards

- No server audio files; buffers zeroed after chunk handling.
- No transcript/translation in server error logs (event + requestId only).
- No localStorage for audio blobs.
- No practice sharing in realtime routes.
- Cloud sync unchanged (explicit consent only).
- Near-realtime sends **single chunk only** — no session history.

---

## Security safeguards

- All routes under `/api/interpreter` (except public invite) require auth.
- Module + per-feature flags return **503** when disabled.
- Rate limits: shared, stream chunk, near-realtime translate, stream speak.
- `validateInterpreterNearRealtimeTranslateInput`, `validateAudioUploadBuffer`, prompt-injection checks.
- Stream sessions scoped to `userId` + `streamId`.

---

## Cost / token controls

- Streaming: max duration, max bytes, max partial runs, chunk queue cap.
- Near-realtime: debounce, min/max chars, duplicate suppression.
- TTS: cache + 4s repeat throttle.
- No full conversation history on preview translate.

---

## Accessibility

- Live regions on PTT status, streaming connection, captions, preview translation.
- `aria-busy` on streaming section and transcript panel.
- Keyboard-accessible PTT and stream start/stop.
- Screen-reader labels for provisional vs confirmed content.
- `prefers-reduced-motion` disables streaming connection pulse animation.

---

## Browser / mobile limitations

- **iOS Safari:** MediaRecorder codec may fall back to mp4; tab background cancels mic (by design).
- **Firefox:** Supported where `getUserMedia` + `MediaRecorder` exist.
- **Guest / no mic permission:** Calm denial + retry; no auto-start.
- Streaming requires modern Chromium/WebKit; otherwise PTT only.

---

## Files changed (this hardening pass)

| File | Change |
|------|--------|
| `utils/interpreterPttPhase.js` | `uploading` phase; pipeline busy includes uploading |
| `hooks/useInterpreterStreamCapture.js` | 120s auto-stop; max duration timer cleanup |
| `constants/streaming.js` | Client max duration constant |
| `components/InterpreterLiveRoom.jsx` | PTT/uploading busy, recorderBusy, speaker guard, pending draft block, TTS stop on record |
| `styles/MedicalInterpreter.css` | Reduced-motion for streaming indicator |
| `i18n/.../medicalInterpreter.js` (DE/EN) | `statusUploading`, `maxDurationReached`, `fallbackToPtt` |

**Pre-existing Phase 5 stack** (verified, not re-listed): stream/near-realtime/speak routes, services, panels, hooks, rate limits, QA docs.

---

## Checks run

| Check | Result |
|-------|--------|
| `npm run build` (client) | Pass |

---

## Manual QA checklist

See also:

- `docs/RELIABILITY_QA.md` (Phase 2.7 + PTT stress)
- `docs/PHASE_5_6_REALTIME_QA.md` (full realtime hardening checklist)

Quick smoke:

- [ ] All Phase 5 flags off → PTT only
- [ ] Rapid PTT start/stop → single transcribe
- [ ] Record during transcribe → blocked
- [ ] Streaming start/stop → mic released; optional draft
- [ ] 120s stream cap → auto finalize message
- [ ] Preview translate debounced; stale label on edit
- [ ] TTS stops when recording starts
- [ ] Route leave → no stuck recording/playing state

---

## Remaining risks

1. **Chunked STT is not true WebSocket streaming** — higher latency than native streaming; documented as prototype.
2. **Partial Whisper previews** capped at 5 runs per session (cost control).
3. **iOS** background tab always cancels recording (intentional privacy/reliability trade-off).
4. **Near-realtime** still uses same translation model — user must verify clinically important content.

---

## Production readiness

**Ready for staged rollout** with all Phase 5 flags **off** by default. Enable per environment after smoke testing on target browsers. PTT-only mode is production-safe without any Phase 5 flags.
