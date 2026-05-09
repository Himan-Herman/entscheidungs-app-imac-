# MedScoutX AI safety hardening — report

Date: internal engineering note. Scope: runtime output filtering, prompt alignment, safe fallbacks, forbidden wording — **not** a legal or regulatory certification.

## Modules audited (server)

| Module key | Entry points | Runtime hardening |
|------------|----------------|-------------------|
| `symptom_check` | `server/routes/symptomThread.js`, `server/routes/ki.js` (text-only) | `sanitizeAiOutput` on assistant text |
| `image_analysis` | `server/routes/symptom.js`, `server/routes/ki.js` (with image) | `sanitizeAiOutput` + image-specific regex set in policy |
| `body_map` | `server/routes/koerpersymptomThread.js` | `sanitizeAiOutput` |
| `previsit_intake` | `server/services/preVisitIntakeAdaptiveClient.js` | One strict-retry completion if `shouldRegenerateUnsafeOutput`; then `sanitizeAiOutput` on `followUpQuestion` |
| `previsit_adaptive` | `server/services/preVisitAdaptiveIntakeClient.js` + `adaptiveIntakeOutputGuard.js` | Unified patterns via `getOutputSafetyPatterns` in `adaptivePromptRules.js`; existing retry + guard retained |
| `previsit_doctor_transform` | `server/services/preVisitOpenAiClient.js` | `ALLOWED_COMMUNICATION_STYLE` appended to system prompt; `sanitizeStructuredPlainText` on each field + `safetyNotice` |
| `previsit_history_diff` | `server/services/preVisitHistoryDiffClient.js` | Existing regex scrub + `sanitizeStructuredPlainText` per bullet |
| `previsit_case_continuity` | `server/services/preVisitCaseContinuityClient.js` | Existing word filter + `sanitizeStructuredPlainText` per bullet |
| `previsit_followup_format` | Reserved in `aiSafetyPolicy.js` (fallbacks + patterns) | For future AI-assisted follow-up message formatting |

## Central artifacts

- `server/config/aiSafetyPolicy.js` — forbidden concepts (regex groups), phrase replacements, safe fallbacks by module, `ALLOWED_COMMUNICATION_STYLE`, retry suffix for JSON intake.
- `server/services/aiSafetySanitizer.js` — `sanitizeAiOutput`, `detectForbiddenMedicalClaims`, `replaceUnsafePhrases`, `shouldRegenerateUnsafeOutput`, `sanitizeStructuredPlainText`, `logAiSafetyEvent`.

## Logging (privacy)

Structured log line **only**: `event: ai_output_safety`, `unsafe_output_detected`, `sanitized`, `module`, `used_fallback`. **No** user text, images, or transcripts in these logs.

## Prompt consistency

- Symptom / image client prompts (`textsymptomPrompt.js`, `bildanalysePrompt.js`) reference server-side policy/sanitizer.
- Pre-Visit adaptive system string includes shared `ALLOWED_COMMUNICATION_STYLE`.
- `adaptivePromptRules.js` `OUTPUT_VIOLATION_PATTERNS` is sourced from `getOutputSafetyPatterns(PREVISIT_ADAPTIVE)` to avoid drift from global policy.

## Multilingual patterns

- Primary coverage: **English + German** (high traffic).
- Additional script/latin cues: **Arabic**, **Persian/Arabic script tokens**, **Turkish**, **Russian** (high-urgency / diagnosis-like tokens only — conservative to limit false positives).

## Remaining MDR / store risks

1. **OpenAI Assistants** (`ASSISTANT_ID`, `ASSISTANT_ID_BILDANALYSE`, etc.) may still embed instructions that conflict with app prompts; runtime sanitization reduces but does not eliminate every edge case.
2. **Regex blind spots**: Novel phrasing in any language can slip until patterns are extended; periodic review of `unsafe_output_detected` metrics (counts only) is recommended.
3. **False positives**: Words like “Infektion” / “fracture” in **patient-quoted** text could trigger replacement or fallback — acceptable tradeoff for store safety; tune patterns if support load rises.
4. **Client-only or third-party paths**: Any route not wired to `aiSafetySanitizer` remains a gap — grep for `openai.` when adding features.
5. **Marketing vs runtime**: Store copy and in-app disclaimers should explicitly match “documentation / visit preparation only”; this layer enforces runtime alignment for wired modules.

## Unsafe phrases still theoretically possible

- Misspellings or obfuscated clinical claims not matching current regexes.
- Very long compound sentences where a forbidden clause survives sentence-split heuristics.
- Non-Latin scripts beyond the small curated list.

## Client / UX

- No intentional UX changes beyond prompt comment lines in `textsymptomPrompt.js` and `bildanalysePrompt.js`.

## Verification

Run after deploy:

- `node --check` on modified server files.
- Optional: `npm run build` / `npm run lint` in `client/` if client prompts change (minimal).
