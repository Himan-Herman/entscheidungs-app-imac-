# AI safety audit — GPT-5.4 default model

Date: 2026-05-24  
Scope: Patient + practice AI modules after centralizing chat on `gpt-5.4`.

## Summary

Changing the default **chat** model to `gpt-5.4` does **not** remove or weaken MedScoutX safety rules. Boundaries are enforced via:

1. **System prompts** (module-specific, unchanged in scope)
2. **`server/config/aiSafetyPolicy.js`** + **`server/services/aiSafetySanitizer.js`** on server chat outputs
3. **Client guards** for live translation (semantic drift, medical scope, **new** `translationOutputSafety.js`)
4. **Regression script** `server/scripts/verifyAiSafetyRegression.js`

## Central model config (`server/config/openAiModels.js`)

| Role | Default | Env override |
|------|---------|--------------|
| Chat / completions | `gpt-5.4` | `OPENAI_CHAT_MODEL` |
| Realtime (WebRTC) | `gpt-realtime-2` | `OPENAI_REALTIME_MODEL` |
| ASR transcription | `gpt-4o-transcribe` | `OPENAI_TRANSCRIPTION_MODEL` |
| TTS | `gpt-4o-mini-tts` | `OPENAI_TTS_MODEL` |

**Intentionally not GPT-5.4:** Realtime voice, ASR, TTS, OpenAI Assistants (`ASSISTANT_ID*` in dashboard).

## Modules audited

| # | Module | Safety enforcement | Chat model |
|---|--------|-------------------|------------|
| 1 | Meda live translation | Fidelity prompts, `liveTranslationMedicalScope.js`, client scope + semantic drift + `translationOutputSafety` | Realtime + transcribe |
| 2 | Meda floating assistant | `medaPrompt.js`, `medaChatService.js`, sanitizer | `gpt-5.4` |
| 3 | Pre-Visit | `preVisitOpenAiClient.js` SYSTEM_INSTRUCTION, sanitizer | `gpt-5.4` |
| 4 | Symptom Check | `symptomPrompt.js`, server sanitizer on `/api/symptom` | Assistants + sanitizer |
| 5 | Körperkarte | `koerperkartePrompt.js`, sanitizer | Assistants + sanitizer |
| 6 | Image analysis | `bildanalysePrompt.js`, sanitizer | Assistants + sanitizer |
| 7 | Lab explanation | `labPatientExplanationService.js`, `AI_MODULES.LAB_EXPLANATION` | `gpt-5.4` |
| 8 | Medication plan | `medicationPlanAiService.js`, regenerate on unsafe | `gpt-5.4` |
| 9 | Patient messages / appointments | `practiceMessagesAiService.js`, `appointmentAiService.js` (organizational only) | `gpt-5.4` |
| 10 | Practice AI helpers | inbox, telemedicine, activity, documents — `getOpenAiChatModel()` + sanitizer | `gpt-5.4` |

## Rules confirmed

- No diagnosis, triage, treatment, medication advice, urgency classification
- Specialist referral only in allowed administrative calendar context (organizational prompts)
- Missing data → `nicht angegeben` / `not specified` (Pre-Visit, medication plan, calendar)
- Unclear speech → repeat/clarify (live translation ASR + unclear turns)
- Lab: parameter meaning + in-range only; doctor disclaimer
- Meda chat: redirect diagnosis/emergency/medication questions
- Live translation: translation-only prompts; unsafe translation output → unclear turn

## Files changed (this audit)

- `server/config/aiSafetyPolicy.js` — `LIVE_MEDICAL_TRANSLATION` module + fallbacks
- `client/.../translationOutputSafety.js` — client output guard
- `client/.../asrQuality.js` — wire output guard
- `server/scripts/verifyAiSafetyRegression.js` — regression checks
- `server/package.json` — `verify:ai-safety` script
- `docs/ai-safety-gpt54-audit.md` — this report

## Hardcoded models (acceptable)

- `gpt-4o-transcribe` — ASR (by design)
- `gpt-4o-mini-tts` — TTS
- `openAiRealtimePayload.js` — allowlist of legacy realtime model IDs
- `testRealtimeClientSecrets.js`, `verifyLabPatientExplanation.js` (test fixtures only)
- Assistants API — dashboard `ASSISTANT_ID*`, not chat model string

## Remaining risks

1. **Assistants threads** (symptom/bild/körperkarte): model version is dashboard-configured; prompts + sanitizer are the main guard — verify Assistants model settings in OpenAI dashboard after any change.
2. **Live translation**: relies heavily on realtime instructions; client guards catch drift/unsafe output but cannot replace prompt discipline for rare edge cases.
3. **GPT-5.4 capability**: stronger models may paraphrase more; regenerate + sanitizer loops mitigate but should be re-run after major prompt edits.
4. **No automated E2E** against live OpenAI for forbidden user questions — use `npm run verify:ai-safety` plus existing `verify-meda-safety`, `verify-symptom-check-safety`, etc.

## Verification

```bash
cd server && npm run verify:ai-safety
```

Also run existing scripts: `verify-meda-safety.js`, `verify-symptom-check-safety.js`, `verify-body-map-safety.js`, `verify:lab-explanation`, client `verifyMedicalScopePolicy.js`.
