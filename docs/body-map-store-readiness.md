# Body map (Körperkarte) — store & web readiness checklist

Internal reference for Apple App Store, Google Play, and responsive web/PWA. Not user-facing marketing copy.

## Feature description (stores)

- Users mark regions on a front/back diagram to **localize** where they notice something.
- Optional chat helps **phrase and structure** neutral notes for a **doctor visit**.
- Output is **patient wording** and **marked regions** only — **no** automated diagnosis, urgency scoring, triage, treatment, or specialist routing.

## Non-diagnosis statement

- UI and prompts must avoid: diagnosis, pain diagnosis, disease localization, emergency assessment, treatment recommendation, specialist recommendation, clinical decision support, medical triage, “AI doctor”, or “condition identification”.
- Allowed positioning: symptom localization support, visual communication aid, structured preparation for doctor visits, body-region documentation, patient communication support.

## Emergency disclaimer

- Hub (`/region-start`) shows acute/emergency copy (DE/EN in `bodyMap.start.emergencyNote`).
- Does **not** replace emergency services; no in-flow emergency triage logic.

## Privacy / data handling

- **Consent** before maps/chat: checkbox + privacy link (`BODY_MAP_CONSENT_KEY` / `medscoutx_body_map_ack_v1`).
- **Chat history** stored locally until cleared (`koerperChatVerlauf`, `koerperThreadId`); thread content also processed via OpenAI when sending messages.
- **Deletion**: “Clear chat” and “Reset body map flow” on chat page; consent can be revoked by user clearing site data (no separate revoke endpoint).
- **Export**: align with account/privacy settings (`/settings/privacy`); body map does not add a separate export pipeline.

## Screenshot checklist (stores)

- [ ] Hub with disclaimer + emergency note + consent (unchecked / checked).
- [ ] Front map with toolbar + inline non-diagnosis line.
- [ ] Back map — same.
- [ ] Chat: header chips, neutral subtitle, privacy hint link, sample user message (no alarming assistant copy).
- [ ] Settings/privacy or Datenschutz screen referenced from consent.

## Apple review risks

- **Assistant instructions vs OpenAI Assistant**: Runtime `instructions` from `buildKoerpersymptomPrompt` must stay aligned with the configured OpenAI **Assistant** (`ASSISTANT_ID_KOERPERSYMPTOM`). If the Assistant has older “triage/specialist” instructions in the dashboard, reviewers may still see risky replies — **sync or disable conflicting assistant presets**.
- **HealthKit / sensors**: Body map does not read HealthKit; state that clearly if asked.
- **Emergency**: Ensure no UI implies the feature detects emergencies.

## Google Play risks

- **Health / medical**: Declare as **informational / communication aid**, not diagnosis or treatment.
- **AI-generated content**: Disclose AI assistance; no guaranteed medical accuracy; user control over data (local clear).
- **Data safety form**: Mention optional text sent to backend + AI provider when user sends chat.

## Performance notes

- SVG scales with CSS (`BodyMapPages.css`: max-height, `touch-action: manipulation`).
- Chat avoids extra rerenders beyond existing patterns; large `MAX_CHARS` (1200) — adjust if payloads become heavy.

## PDF integration

- No dedicated body-map PDF section in app code at last review. If added later: sections **DE** “Körperbereiche” / “Vom Patienten markierte Bereiche”; **EN** “Body regions” / “Patient-marked regions”; render IDs/labels + patient text only — **no** interpretation.

## Remaining blockers / owners

| Item | Risk |
|------|------|
| OpenAI Assistant preset | Must match neutral prompt or overrides model behavior |
| Legacy localStorage chats | Old assistant messages may contain outdated tone; users can clear chat |
| Specialist routing elsewhere | Ensure marketing/start cards don’t promise specialist suggestions for body map |

## Web readiness

- Responsive hub + maps + chat; RTL-safe `dir="ltr"` on body-map pages with directional diagrams (labels are DE/EN only today).
- Touch targets: consent CTA, toggles, map hotspots (44px+ controls in hub CSS; SVG regions rely on diagram hit targets).

## App store readiness (binary)

- Requires consent gate before map routes (enforced on front/back/chat).
- Copy audited in `bodyMap` strings + `koerpersymptomPrompt.js`.
- Final sign-off still depends on **assistant dashboard** alignment and store questionnaire answers.
