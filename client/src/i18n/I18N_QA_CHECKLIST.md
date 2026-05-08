# Multilingual manual QA (MedScoutX)

Quick pass per locale: **de, en, fr, es, ar, fa, ckb, tr, ru** (add others as needed).

For each locale: set UI language in the global selector, then verify layout (especially **ar, fa, ckb** RTL: header, forms, language menu, Pre-Visit steps).

| Area | Checks |
|------|--------|
| Header | Nav labels, theme toggle, language selector opens, search filters languages, current language visible |
| Login / register / forgot / reset / check email | Page copy, errors, primary actions |
| Pre-Visit start | Language page (`/pre-visit` entry), patient language list labels |
| Chat | Steps, placeholders, audio toolbar labels, adaptive hints |
| Document | Doctor vs patient language distinction, PDF actions, timeline strings |
| PDF | Download: header/disclaimer/footer readable; non-Latin scripts may be limited (Helvetica) |
| QR landing | Practice context messages |
| Settings | Privacy, export/delete, practices, doctor contacts |
| Dashboard (if logged in as practice) | Cards, empty states, navigation |

**Regression**: symptom/body modules, account save/history, doctor PDF email, cases/timeline, follow-ups unchanged in behaviour.
