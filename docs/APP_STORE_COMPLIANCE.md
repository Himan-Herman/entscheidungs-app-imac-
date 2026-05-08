# MedScoutX — App Store & Play Store compliance preparation

This document supports **review readiness** for a Pre-Visit–focused MedScoutX client (web/PWA today; native wrapper assumed later). It does **not** constitute legal advice and does **not** claim HIPAA, MDR certification, medical-device clearance, or jurisdiction-specific compliance unless you complete separate legal review.

---

## 1. Permission rationale copy (for native shells)

Use these **in-app** (first-use education) and **store listing / OS permission dialogs** when you wrap the web app (e.g. Capacitor, TWA). Align wording with your actual implementation.

### Microphone (speech input in Pre-Visit)

**English (short)**  
MedScoutX uses the microphone **only when you tap record** to turn your speech into text for your preparation. Recording **does not run in the background**. Audio is sent to our servers for transcription and is **not stored** as a recording by this feature.

**English (permission dialog / App Store “purpose string” style)**  
We need microphone access so you can **dictate answers** during appointment preparation. We only capture audio **while you are recording**; we do not listen in the background.

**German (Kurz)**  
Das Mikrofon wird **nur nach Tippen auf Aufnahme** genutzt, um Sprache in Text für Ihre Vorbereitung zu verwandeln. Es gibt **keine Aufnahme im Hintergrund**. Die Audio-Daten werden zur Verarbeitung übermittelt und von dieser Funktion **nicht dauerhaft als Aufnahme gespeichert**.

### Text-to-speech / playback

Usually **no OS permission**; still clarify in privacy policy: audio is generated from **text you already entered or that is shown on screen**, played locally after download.

### Notifications (if you add push later)

**Policy**: Do **not** include symptom assessments, diagnoses, urgency, or treatment content in notification body or title. Use neutral operational text only (e.g. “You have a new message” / “Reminder: complete your preparation”).

---

## 2. Apple App Store — Privacy Nutrition Label checklist

Complete in App Store Connect from **actual behavior** + privacy policy. Below is a **mapping guide** for the **current architecture** described in this repo (adjust if you change backends or SDKs).

| Data type | Collected? | Linked to user? | Used for tracking? | Notes |
|-----------|------------|-----------------|---------------------|--------|
| **Contact info** (email, name from registration) | Yes (account) | Typically yes | No (unless you use it for cross-app tracking — you should not) | Registration / account |
| **User content** (free-text preparation answers, PDFs user generates/sends) | Yes | Yes | No | Core feature; clarify retention & deletion |
| **Identifiers** (user id server-side; JWT client-side) | Yes | Yes | No | Auth/session |
| **Usage data** | Yes | Prefer “no” if strictly hashed/anonymized events; if **any** row can be re-linked internally, disclose carefully | **Review analytics design** | See `AnalyticsEvent` — practice/user/session **hashes**, metadata allowlisted |
| **Diagnostics** | Only if you add crash SDKs | Per SDK | Per SDK | Not evidenced in this audit — add row when you integrate |

**Purchase / health**: If you do **not** process HealthKit data, say **no**. Do **not** label the app as processing “health” data unless Apple’s definitions clearly apply to **your** collected fields; when in doubt, confirm with counsel — misleading labels are a rejection risk.

**Tracking**: If you use no cross-app advertising identifiers and analytics is first-party, anonymized, and not used for ads, you generally align with **no tracking** — still describe analytics in privacy policy.

---

## 3. Google Play — Data safety checklist

Answer the Play questionnaire consistently with your privacy policy.

Suggested declarations (verify against production):

1. **Data collected**  
   - Account registration data (e.g. email, name, DOB if collected).  
   - User-generated content (appointment preparation text, optional identity fields, documents user chooses to save or send).  
   - Operational/analytics events (hashed identifiers, allowlisted metadata — no raw medical free-text in analytics table by design).

2. **Purpose**  
   - App functionality, account management, security, **optional** product improvement (analytics).

3. **Sharing**  
   - Processors/subprocessors you use (hosting, email, AI transcription/TTS if applicable). List them in privacy policy.

4. **Encryption**  
   - State in transit (HTTPS) — confirm TLS for all API calls.

5. **Deletion**  
   - Describe **export** (`Settings` → data export) and **what delete covers**.  
   - **Gap today**: see §7 — partial deletion vs full account removal.

6. **Optional / sensitive**  
   - Microphone: collected **ephemerally** or “processed ephemerally” only if true for your pipeline; otherwise disclose temporary processing honestly.

---

## 4. Screenshot checklist (stores)

For both stores, screenshots should **reinforce non-clinical positioning**:

- [ ] Visible **disclaimer** or tagline: preparation / documentation only; **not** diagnosis or treatment; **not** emergency care.  
- [ ] Pre-Visit flow showing **user-authored** structure (no “AI diagnosed…” style headlines).  
- [ ] Document/PDF screen framed as **“your statements”** / **for the appointment**, not as a clinical report.  
- [ ] Settings or privacy entry showing **export** and **data deletion** paths (transparency).  
- [ ] If showing microphone UI: include **short on-screen note** that recording is **user-initiated only** (matches permission story).  
- [ ] Avoid screenshots of **symptom modules** that could be read as triage unless paired with clear “orientation only” copy.

Avoid: urgency meters, “AI doctor”, “instant diagnosis”, emergency routing claims, before/after cure imagery.

---

## 5. Icon & promotional asset checklist

- [ ] Icon does **not** use a red cross or other protected medical symbols where restricted.  
- [ ] No claims on icon or banner such as “Dr.”, “Diagnose”, “Therapie”, “Notfall”, “AI Arzt”.  
- [ ] Age rating questionnaire: answer honestly; health-adjacent apps often receive higher ratings — prepare support URL and moderation story.

---

## 6. Support & contact checklist

Apple and Google expect a **working support URL** and responsive contact for account/data questions.

- [ ] Public **privacy policy URL** (matches in-app “Privacy” link).  
- [ ] Public **terms / medical disclaimer URL** if referenced in-app.  
- [ ] **Support email or form** responsive within a few business days.  
- [ ] For EU users: **data controller identity** and DPO only if legally required (legal task).  
- [ ] Process for **access/export** and **deletion** requests documented (even if automated in-app).

---

## 7. Codebase-aligned review (current state)

### Strengths (review-positive)

- **Disclaimers**: Multiple locales state **no diagnosis, no treatment, no emergency/urgency assessment** (e.g. `client/src/i18n/translations/en/preVisit.js`, `de/startseite.js`, legal bundles).  
- **PDF / email**: Copy stresses **user consent** before sending; content described as **patient statements only** (`preVisit.js` document strings; doctor-contacts route requires explicit consent flag server-side).  
- **Microphone UX**: Recording is **button-driven** (`PreVisitAudioToolbar.jsx`); not background service.  
- **Privacy hub**: `SettingsPrivacyPage.jsx` exposes **export** and **deletion** with explicit confirmation phrase.  
- **Analytics**: Recent design uses **hashed IDs** and **metadata allowlist** (`server/services/analyticsService.js`) — good direction for “no hidden tracking”; must still be **disclosed**.

### Apple Review — **current risks**

| Risk | Severity | Detail |
|------|----------|--------|
| **Account deletion vs data deletion** | **High** | `server/routes/account.js` notes full account removal **not implemented**; `DELETE /api/account/delete` removes Pre-Visit/practice artifacts but **login account remains**. Apple commonly expects **account deletion** where accounts exist (Guideline 5.1.1(v)). |
| **“Doctor version” / AI wording** | Medium | UI strings use **“doctor version”**, **“Create doctor version”**, and audio privacy mentions **“AI service”** (`en/preVisit.js`). Reviewers may map this to **“AI diagnosis”** unless screenshots and description are crystal clear. Prefer neutral labels: e.g. **“Structured summary for your appointment”**, **“Clinic-oriented layout”**, **“Assistive formatting”**. |
| **Medical positioning in store listing** | Medium | Any subtitle like “symptom checker” or “AI health” triggers extra scrutiny. Keep listing aligned with **appointment preparation**. |
| **Privacy Nutrition Label accuracy** | Medium | Must include **analytics**, **AI processing** (transcribe/TTS), **email/PDF send**, and **account data** consistently with policy. |
| **PWA / WebView wrapper** | Low–Medium | If submitted as thin browser shell, Apple may question **minimum functionality**; ensure offline/error handling and native permission flows are solid. |

### Google Play — **current risks**

| Risk | Severity | Detail |
|------|----------|--------|
| **Health / medical app policies** | Medium | Declarations must match **actual features**; misleading “treatment” or “diagnosis” keywords in listing → removal. |
| **Data safety form vs reality** | Medium | Analytics, AI APIs, and optional health-adjacent **user content** must match questionnaire; inconsistencies → rejection or takedown. |
| **Foreground microphone** | Lower | Declare microphone use honestly; justify with **user-initiated** recording only. |

---

## 8. Missing requirements before submission (action list)

Not legal sign-off — engineering/product tasks:

1. **Implement true account deletion** (or equivalent approved flow): delete **User** row and credentials after confirmation, with clear UX distinction from “delete my preparation data only”. Until then, Apple rejection risk remains **material**.  
2. **Privacy policy updates**: Explicit sections for (a) **analytics** (what, why, retention), (b) **speech/audio processing** (no retention vs retained — match engineering), (c) **third-party AI** providers.  
3. **Store listings**: Remove/replace any **“AI doctor”**, **diagnosis**, **treatment**, **emergency** implications; align EN/DE/others.  
4. **In-app copy audit**: Replace or qualify **“doctor version”** where possible; ensure **Italian AGB** legal text (“possible causes…”) does **not** leak into consumer-facing UI if it overstates clinical inference.  
5. **Account deletion visibility**: If full deletion ships, surface it **alongside** export in Settings (same area Apple reviewers check).  
6. **Push notifications**: If added, implement **content policy** (§1) and declare in both stores.  
7. **Native wrapper**: Add `NSMicrophoneUsageDescription` (iOS) / Android permission rationale aligned with §1; confirm **no background audio** entitlement unless justified.  
8. **Support URL & contact**: Live pages before first submission.

---

## 9. Disclaimer for internal use

This document was prepared from **repository inspection** and common store guidelines themes. **Apple and Google policies change**; **final compliance** requires your legal counsel and your actual production configuration (servers, subprocessors, data flows). Do **not** claim HIPAA, MDR medical device status, or clinical validation in store metadata unless you have **completed** the corresponding compliance program and counsel approves the claim.

---

## 10. Quick reference — sensitive strings to audit (non-exhaustive)

- `client/src/i18n/translations/en/preVisit.js` — `createDoctorVersion`, `doctor version`, `audioPrivacy` (AI mention).  
- `client/src/i18n/translations/de/preVisit.js` — mirror strings.  
- `client/src/pages/SettingsPrivacyPage.jsx` — deletion scope vs account.  
- `server/routes/account.js` — export/delete scope comments.  
- Store-facing marketing outside repo — **not audited here**.
