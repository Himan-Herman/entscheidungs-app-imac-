# Medical Interpreter — Phase 2.7 Reliability QA

Operational resilience only. No diagnosis, triage, treatment, or symptom interpretation.

## Weak network

- [ ] Throttle network (Fast 3G / offline) during transcribe — calm offline banner, no crash
- [ ] Throttle during translate — draft preserved, recovery banner with retry
- [ ] Throttle during simplify — retry banner, no duplicate simplify
- [ ] Request timeout (45s JSON) shows `requestTimeout` message, not generic panic copy

## Offline / reconnect

- [ ] Go offline in live room — banner, mic/recording stops, in-flight requests abort
- [ ] Reconnect — short “connection restored” banner, error cleared when appropriate
- [ ] Offline during review continue — blocked with offline message, no navigation to live

## Duplicate actions

- [ ] Double-tap confirm/translate rapidly — only one request
- [ ] Double-tap simplify — guarded
- [ ] Double-tap end/delete session — guarded
- [ ] Double PDF export on review — guarded

## Route / lifecycle

- [ ] Navigate away during translate — no console errors, no stale loading after return
- [ ] Browser back from live — recorder/TTS cleanup
- [ ] Refresh during active session — session restores from local store
- [ ] Tab hidden/visible — session state reloads on visibility

## Recovery

- [ ] Failed translate (network) — recovery banner, retry succeeds when online
- [ ] Dismiss recovery — banner clears, draft still editable
- [ ] Transcribe failure — user can record again without stuck “transcribing”

## Error boundary

- [ ] Force render error inside interpreter route — patient shell intact, back link works
- [ ] Copy does not imply medical urgency or treatment advice

## Long session

- [ ] 20+ turns — UI remains responsive
- [ ] Repeated listen (TTS) — no orphaned audio / memory growth in DevTools

## Phase 5.6 — Realtime hardening (5.2–5.5)

See [PHASE_5_6_REALTIME_QA.md](./PHASE_5_6_REALTIME_QA.md) for full flag, security, privacy, and stress checklist.

## Phase 5.2 — PTT stress (enhanced push-to-talk)

- [ ] Double-tap PTT start rapidly — only one recording starts
- [ ] Double-tap stop rapidly — no duplicate transcribe requests
- [ ] Start record during transcribe — blocked with calm disabled state
- [ ] Switch speaker while recording — recording cancels, no orphan stream
- [ ] Listen (TTS) then record — playback stops, no overlap
- [ ] Record during TTS — playback stops
- [ ] Draft edit + navigate away — blocker; draft flushed; keep editing preserves text
- [ ] Mic denied — guidance + retry (no auto-start)
- [ ] Very short / silent clip — calm error, no transcript created
- [ ] Low STT confidence — caution note; confirm still required
- [ ] Tab hidden during record — mic released, no stuck “recording” state

## Mobile / browsers

- [ ] iOS Safari — record/stop, background tab mic release
- [ ] Android Chrome — offline banner readable
- [ ] Desktop Chrome/Firefox — basic smoke

## Accessibility (failure states)

- [ ] Offline banner `role="status"` announced
- [ ] Recovery retry keyboard-focusable, `aria-busy` while retrying
- [ ] Error alert receives focus on failure
