# AI safety audit — GPT-5.4 default model

Date: 2026-05-24  
Scope: Patient + practice AI modules after centralizing chat on `gpt-5.4`.

## Summary

Changing the default **chat** model to `gpt-5.4` does **not** remove or weaken MedScoutX safety rules. Boundaries are enforced via:

1. **System prompts** (module-specific, unchanged in scope)
2. **`server/config/aiSafetyPolicy.js`** + **`server/services/aiSafetySanitizer.js`** on server chat outputs
3. **Client guards** for medical interpreter and related modules
4. **Regression script** `server/scripts/verifyAiSafetyRegression.js`

## Central model config (`server/config/openAiModels.js`)

| Role | Default | Env override |
|------|---------|--------------|
| Chat / completions | `gpt-5.4` | `OPENAI_CHAT_MODEL` |
| TTS | `gpt-4o-mini-tts` | `OPENAI_TTS_MODEL` |

**Intentionally not GPT-5.4:** TTS, OpenAI Assistants (`ASSISTANT_ID*` in dashboard).

## Modules audited

| # | Module | Safety enforcement | Chat model |
|---|--------|-------------------|------------|
| 1 | Meda floating assistant | `medaPrompt.js`, `medaChatService.js`, sanitizer | `gpt-5.4` |
| 2 | Pre-Visit | `preVisitOpenAiClient.js` SYSTEM_INSTRUCTION, sanitizer | `gpt-5.4` |
| 3 | Symptom Check | `symptomPrompt.js`, server sanitizer on `/api/symptom` | Assistants + sanitizer |
| 4 | Körperkarte | `koerperkartePrompt.js`, sanitizer | Assistants + sanitizer |
| 5 | Image analysis | `bildanalysePrompt.js`, sanitizer | Assistants + sanitizer |
| 6 | Lab explanation | `labPatientExplanationService.js`, `AI_MODULES.LAB_EXPLANATION` | `gpt-5.4` |
| 7 | Medication plan | `medicationPlanAiService.js`, regenerate on unsafe | `gpt-5.4` |
| 8 | Patient messages / appointments | `practiceMessagesAiService.js`, `appointmentAiService.js` (organizational only) | `gpt-5.4` |
| 9 | Practice AI helpers | inbox, telemedicine, activity, documents — `getOpenAiChatModel()` + sanitizer | `gpt-5.4` |

## Rules confirmed

- No diagnosis, triage, treatment, medication advice, urgency classification
- Specialist referral only in allowed administrative calendar context (organizational prompts)
- Missing data → `nicht angegeben` / `not specified` (Pre-Visit, medication plan, calendar)
- Unclear speech → repeat/clarify (interpreter ASR + unclear turns)
- Lab: parameter meaning + in-range only; doctor disclaimer
- Meda chat: redirect diagnosis/emergency/medication questions

## Files changed (this audit)

- `server/config/aiSafetyPolicy.js` — module fallbacks
- `server/scripts/verifyAiSafetyRegression.js` — regression checks
- `server/package.json` — `verify:ai-safety` script
- `docs/ai-safety-gpt54-audit.md` — this report

## Hardcoded models (acceptable)

- `gpt-4o-mini-tts` — TTS
- Assistants API — dashboard `ASSISTANT_ID*`, not chat model string

## Remaining risks

1. **Assistants threads** (symptom/bild/körperkarte): model version is dashboard-configured; prompts + sanitizer are the main guard — verify Assistants model settings in OpenAI dashboard after any change.
2. **GPT-5.4 capability**: stronger models may paraphrase more; regenerate + sanitizer loops mitigate but should be re-run after major prompt edits.
4. **No automated E2E** against live OpenAI for forbidden user questions — use `npm run verify:ai-safety` plus existing `verify-meda-safety`, `verify-symptom-check-safety`, etc.

## Verification

```bash
cd server && npm run verify:ai-safety
```

Also run existing scripts: `verify-meda-safety.js`, `verify-symptom-check-safety.js`, `verify-body-map-safety.js`, `verify:lab-explanation`.
