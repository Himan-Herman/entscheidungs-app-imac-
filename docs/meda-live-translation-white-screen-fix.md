# Meda live translation — white screen stabilization

Date: 2026-05-24

## Root cause (most likely)

**`ReferenceError: safeTurns is not defined`** in `LiveTranslationPage.jsx`.

The turn history panel used `turns={safeTurns}` after a partial refactor, but `safeTurns` was never declared. Any render path that reached the active session UI (with `LiveTranslationTurnHistory`) crashed the React tree → blank white page.

### Secondary crash risks (also fixed)

| Component | Risk | Fix |
|-----------|------|-----|
| `LiveTranslationTurnHistory` | `t.turn.statusUnclear` when `t.turn` missing | `turnStatusLabel` uses safe `turnT` with fallbacks |
| `LiveTranslationTurnHistory` | `new Date(undefined)` sort edge cases | `normalizeTurnForDisplay` + finite time sort |
| `LiveTranslationArchivePanel` | `archiveT.turnCount.replace(...)` when `turnCount` undefined | `formatMessageTemplate()` |
| `LiveTranslationPage` | `t.status[connectionStatus]` when `t.status` missing | Optional chaining + fallback |
| i18n | Missing `liveMedicalTranslation` bundle | `resolveLiveTranslationMessages()` always returns EN default |

## Stabilization fixes

1. **`LiveTranslationRoute.jsx`** — wraps page in `LiveTranslationErrorBoundary`
2. **`LiveTranslationErrorBoundary.jsx`** — user-facing fallback (no stack traces)
3. **`safeLiveTranslationMessages.js`** — guaranteed message tree
4. **`safeTurns`** — defined and passed to turn history
5. **Noise / failed ASR** — `recordHistory: false` + `spokenNotice` planB: banner + spoken repeat, **no history card** for noise-only failures
6. **VAD** — silence 1100ms, threshold 0.64
7. **Transcript gate** — min 3 chars + min 1 word before translation

## Verification

```bash
cd client && npm run build   # OK
node src/features/liveMedicalTranslation/scripts/verifyTranscriptionFirst.js
node src/features/liveMedicalTranslation/scripts/verifyPdfIntegrityLabels.js
```

## Deploy

Redeploy **client** to production. Hard-refresh or clear service worker cache on medscoutx.com.

## Remaining risks

- ASR quality still environment-dependent
- `create_response: false` requires client+server deploy together
- Error boundary shows fallback instead of white screen if a new regression occurs
