# Medical Interpreter — Phase 5.6 Realtime QA & Hardening

Hardening pass for Phase 5.2–5.5 (PTT, streaming STT, near-realtime translate, streaming TTS). No new product features.

## Feature flags (default safe)

| Flag | Default | Expected when OFF |
|------|---------|-------------------|
| `MEDICAL_INTERPRETER_STREAMING_STT_ENABLED` | off | No streaming panel; PTT only |
| `MEDICAL_INTERPRETER_NEAR_REALTIME_TRANSLATION_ENABLED` | off | No preview translate UI |
| `MEDICAL_INTERPRETER_STREAMING_TTS_ENABLED` | off | No preview playback; confirmed `/speak` if `ttsEnabled` |
| `VITE_*` client mirrors | off | UI hidden even if server on |

- [ ] All flags off: live room shows PTT + standard translate only
- [ ] No microphone until user taps PTT or explicitly starts streaming
- [ ] Disabled API returns 503 with safe JSON (no stack traces)

## Safety boundaries (verified in code)

Realtime paths use:

- Whisper STT (transcription only)
- `translateInterpreterTurn` / `buildInterpreterTranslateSystemPrompt` (single utterance, no history)
- OpenAI TTS (verbatim text, no LLM rewrite)

Prompts explicitly forbid diagnosis, triage, treatment, medication, specialist, and urgency inference.

- [ ] No new medical interpretation endpoints added in Phase 5

## Privacy

- [ ] No audio files written server-side (memory buffers zeroed after use)
- [ ] No audio/transcript in server logs (error logs: event + requestId only)
- [ ] Recorder/stream hooks do not use localStorage for blobs
- [ ] Session text in localStorage is user-confirmed turns only (existing Phase 1 policy)
- [ ] No practice transcript sharing in realtime routes
- [ ] Cloud sync unchanged — requires explicit consent
- [ ] No autoplay: TTS and mic require explicit button/checkbox

## Security

- [ ] `/api/interpreter/*` (except public invite) behind `requireAuth`
- [ ] Streaming/near-realtime/stream-speak gated by module + feature flags
- [ ] Rate limits: shared, chunk, near-realtime translate, stream speak, transcribe, translate
- [ ] Max chunk 256KB; max stream 4MB / 120s; max preview translate 600 chars; max stream TTS 600 chars
- [ ] `validateInterpreter*Input` + prompt-injection patterns on all text paths
- [ ] Malformed/empty audio rejected via `validateAudioUploadBuffer`
- [ ] Stream sessions scoped to `userId` + `streamId`

## Reliability stress checklist

### PTT (5.2)

- [ ] Rapid start/stop — single transcribe, mic released
- [ ] Tab hidden during record — mic cancelled
- [ ] Route leave — recorder + TTS + abort controllers cleaned up
- [ ] Offline during transcribe — calm banner, no stuck transcribing

### Streaming STT (5.3)

- [ ] Rapid start/stop — server session cancelled; mic released
- [ ] Tab hidden during stream — stream cancelled (mic off)
- [ ] Chunk queue under load — no silent chunk drops (queued upload)
- [ ] Backpressure — stops stream with calm message if queue > 12
- [ ] Route leave / unmount — cancel stream + server DELETE
- [ ] Finish failure — server session cleaned; client error state

### Near-realtime translate (5.4)

- [ ] Debounce — no flood of identical requests
- [ ] Unmount — abort in-flight preview translate
- [ ] Stale preview label when transcript changes
- [ ] Draft confirm still required before turn save

### Streaming TTS (5.5)

- [ ] Preview playback opt-in default off
- [ ] Stop during record/stream — audio stops
- [ ] Object URLs revoked; blob cache cleared on unmount
- [ ] Repeat same text < 4s — client throttle
- [ ] No overlap: one playback at a time

## Accessibility

- [ ] Streaming captions region labelled + `aria-live`
- [ ] Connection/playback status `role="status"` + `aria-live="polite"`
- [ ] Start/stop buttons keyboard accessible with `aria-label`
- [ ] Preview/final labels in copy (“not confirmed”)
- [ ] `aria-busy` on active streaming / loading preview
- [ ] Playback status text (not color-only)
- [ ] `prefers-reduced-motion` disables PTT pulse animation

## Mobile / browser

| Environment | Notes |
|-------------|--------|
| iOS Safari | MediaRecorder + getUserMedia; tab hide releases mic |
| Android Chrome | Same; offline banner |
| Desktop Chrome/Firefox | Full smoke |
| Unsupported | No MediaRecorder → streaming hidden; PTT may still work |

## Token / cost

- [ ] No conversation history in translate/TTS requests
- [ ] Partial Whisper capped (5 runs, 2.5s min interval)
- [ ] Near-realtime translate debounced 1.4s, min 20 chars, max 600 chars
- [ ] TTS in-memory cache (8 entries), 4s repeat throttle

## Phase 5 completion

Phases 5.2–5.5 are feature-complete behind flags. Phase 5.6 adds hardening only.

## Readiness for Phase 6

Phase 6 (if planned) may add broader product integration; realtime stack is flag-gated and safe to leave off in production until explicitly enabled.
