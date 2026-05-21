# Medical Interpreter — session organization QA (Phase 2.5)

## Scope

Local-only session intelligence. No server persistence, no AI session summaries, no clinical categories.

## Manual checks

| # | Action | Expect |
|---|--------|--------|
| 1 | New session without manual title | Auto title uses languages, practice, doctor, or date (neutral wording) |
| 2 | End session without title | Auto title applied on end |
| 3 | First successful translation without title | Auto title applied |
| 4 | Rename to “Verdacht auf Migräne” | Rejected; calm `titleUnsafe` message |
| 5 | Rename to “Gespräch am 21.05.2026” | Accepted |
| 6 | Review page | Timeline sections (start / patient / clinician / close), turn summary, documentation notice |
| 7 | PDF export | Section headings, turn summary in metadata, neutral labels |
| 8 | History search “Praxis” | Filters locally; no network call |
| 9 | Screen reader | Section headings announced; search field labelled |
| 10 | Logout | Sessions remain on device only |

## Regression

- `npm run build` (client)
- `npx eslint "src/features/medicalInterpreter/**/*.{js,jsx}"`
