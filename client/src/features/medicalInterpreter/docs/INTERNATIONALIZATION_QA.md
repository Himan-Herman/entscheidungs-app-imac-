# Medical Interpreter — internationalization QA (Phase 2.6)

## RTL UI smoke (app UI set to Arabic via locale if enabled)

| # | Check | Expect |
|---|--------|--------|
| 1 | Setup language search | Filter finds العربية / فارسی |
| 2 | Select AR ↔ EN session | Mixed-direction note on live + review |
| 3 | Live transcript (AR) | Textarea `dir=rtl`, readable alignment |
| 4 | Translation (EN) | `dir=ltr` on translation block |
| 5 | History / review in RTL UI | Cards and meta rows mirror without overlap |
| 6 | Dialogs | Actions readable, focus order logical |

## Mixed-script content

| # | Check | Expect |
|---|--------|--------|
| 7 | Arabic + Latin numbers in one turn | `unicode-bidi: plaintext`, no clipped layout |
| 8 | Long German compound word | Wraps with `overflow-wrap: anywhere` |

## PDF

| # | Check | Expect |
|---|--------|--------|
| 9 | AR/EN session export | Export succeeds; RTL limitation notice in PDF |
| 10 | Mixed-script turn | Mixed-script notice when applicable |

## Safety copy

| # | Check | Expect |
|---|--------|--------|
| 11 | All visible labels | No diagnosis/triage/treatment/urgency routing wording |
| 12 | Error alerts in RTL UI | Readable, not clipped |

## Regression

```bash
cd client && npm run build
cd client && npx eslint "src/features/medicalInterpreter/**/*.{js,jsx}"
```
