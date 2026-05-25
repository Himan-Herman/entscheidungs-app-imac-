# Meda transcription & anti-hallucination hardening

Date: 2026-05-24

## Summary

Meda live translation is now **transcription-first**, **two-language locked**, and **medically conservative**. Translation never finalizes without a stable ASR transcript; uncertain audio yields repeat prompts only (no invented content).

## Changes by area

### 1. Transcription-first

- Server VAD: `create_response: false` — OpenAI no longer auto-translates on silence; client calls `response.create` only after `input_audio_transcription.completed`.
- Client: `canProceedToTranslation()` gates `requestTurnTranslation` and `scheduleFinalizeTranslation`.
- Orphan translations without transcript within `MAX_TRANSCRIPT_WAIT_MS` (2200ms) → acoustic repeat phrase, no turn card with invented text.
- Buffer constant raised to 1400ms (reference); finalize wait uses 2200ms max.

### 2. Language lock

- `isTargetLanguageInPair()` validates output language ∈ {patientLanguage, doctorLanguage}.
- Wrong-language phrases updated (DE: „Nur die ausgewählten Gesprächssprachen…“).
- Existing containment blocks in Realtime instructions retained.

### 3. No free conversation

- Medical scope blocks updated (client + server): allowed healthcare domains; forbidden tourism/shopping/politics/entertainment/general chat.

### 4. Context monitoring

- `conversationContextMonitor.js`: rolling window (8 turns), soft warning ~40% non-healthcare, translation pause ~55%.
- Soft warning → existing scope dialog (updated copy).
- Sustained unrelated → `scopeTranslationPaused` (translation blocked, mic can stay on).

### 5. Medical conservative mode

- Semantic checks: negation loss (e.g. „keine Allergien“ → „allergies“), uncertainty inflation („maybe“ → „definitely“).
- Anti-hallucination + drift checks unchanged but tightened paths.

### 6. VAD / stabilization

- Silence: 850ms → **1000ms**; threshold: 0.58 → **0.62**; prefix padding: 500ms.
- `speech_stopped` no longer sets UI to „translating“ before ASR completes.

### 7. PDF integrity

- Labels: **Akustisch unsicher erkannt**, **Original bestätigt**, **Manuell korrigiert** (via `transcriptIntegrityLabel`).

### 8. Correction flow

- Unchanged: manual correction still replaces turn in history/PDF with `status: corrected` and wrong/corrected sections.

## Tests run

```bash
node client/src/features/liveMedicalTranslation/scripts/verifyTranscriptionFirst.js
node client/src/features/liveMedicalTranslation/scripts/verifyConversationContextMonitor.js
node client/src/features/liveMedicalTranslation/scripts/verifyAsrQuality.js
node client/src/features/liveMedicalTranslation/scripts/verifyMedicalScopePolicy.js
```

## Remaining risks

1. **Realtime ASR quality** still depends on OpenAI `gpt-4o-transcribe` and room acoustics — conservative gates reduce harm but cannot fix bad audio.
2. **`create_response: false`** requires client to always request translation after ASR; regression-test live sessions after deploy.
3. **Context heuristics** may occasionally flag long medical small-talk; user can „Continue anyway“.
4. **Third languages** detected with weak heuristics may still reach repeat flow rather than perfect detection.

## Deploy note

Redeploy **server + client** so VAD `create_response: false` and client transcription-first logic are active together.
