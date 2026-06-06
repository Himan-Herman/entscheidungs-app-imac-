# MedScoutX — internal app & store readiness checklist

Internal engineering and product checklist. **Not legal advice.** Verify all claims, privacy labels, and regional requirements with qualified counsel before submission.

---

## 1. App purpose (positioning)

- **Purpose:** Multilingual **doctor visit preparation**, **structured patient statements**, **document preparation**, and **patient-controlled sharing** (e.g. PDFs / secure links where implemented).
- **Pre-Visit–first:** Primary store-facing scope should emphasize preparation, communication clarity, and document workflows — not diagnostic or therapeutic tools.

---

## 2. Non-diagnosis / safety disclaimer (visible copy baseline)

Use consistent language in store listings and in-app where appropriate:

- **Safety note (EN):** “MedScoutX does not provide diagnosis, treatment recommendations or emergency assessment.”
- **Short description (EN):** “Better prepared. Better care.”
- **Short description (DE):** “Better prepared. Better care.”

Avoid in visible UX and metadata: “AI doctor”, “medical decision”, unqualified “clinical validation”, emergency triage positioning, treatment/diagnosis promises.

---

## 3. Privacy summary (high level — verify against live policy)

Document in the public Datenschutz / privacy policy (and keep in sync with the app):

- What account and Pre-Visit-related data are stored.
- Purposes (e.g. session, preparation storage, practice QR linking, follow-ups, email delivery).
- Retention and deletion paths (including user-initiated export/deletion where offered).
- Processors: e.g. hosting, database, **OpenAI** (if used for transcription or text assistance), **email provider (e.g. Resend)** — **only as actually integrated**.
- No statement of HIPAA / MDR / medical device certification unless formally completed and documented.

---

## 4. Data deletion & account deletion

Ensure routes are linked from settings/account (as implemented):

- **Export:** e.g. `/settings/privacy`, `/account/data` — confirm API `/api/account/export` behavior matches UI copy.
- **Deletion:** phrase-confirmed deletion on privacy/settings flows — confirm scope matches backend (Pre-Visit data vs full account if separate).

**Support email placeholder:** configure before release — e.g. `support@example.com` — replace in UI copy where noted.

---

## 5. Contact / support

- Add a real support inbox in Impressum / Datenschutz / in-app help before submission.
- Document response SLA internally (not a legal promise in the app unless intended).

---

## 6. Required screenshots (draft list)

Prepare separate sets if required by locale:

- Home / logged-in entry or Pre-Visit language selection.
- Pre-Visit chat or intake (show **preparation** framing, not diagnosis).
- Document / PDF review or download screen.
- Account hub (`/account`) or “My preparations”.
- Cases / timeline (`/pre-visit/cases`).
- Follow-ups list (`/pre-visit/follow-ups`).
- Doctor contacts (`/settings/doctor-contacts`).
- Settings / privacy / data export or deletion confirmation step (blur sensitive data).

---

## 7. App Store privacy labels (Apple) — checklist

Complete in App Store Connect from actual practices:

- [ ] Data linked to user vs not linked.
- [ ] Tracking declaration (accurate; avoid “hidden” analytics).
- [ ] Categories collected: contact info, user content, identifiers, usage data, etc. — **match backend and SDKs**.
- [ ] Third-party AI / transcription: disclose if audio or text is processed by OpenAI or similar.
- [ ] Email: disclose if transactional email vendor processes recipient addresses/content.

---

## 8. Google Play Data safety — checklist

- [ ] Data collection vs sharing (accurate).
- [ ] Encryption in transit (as implemented).
- [ ] Account deletion request URL or in-app path.
- [ ] Sensitive health data: **only declare if you actually collect/store health information under Play’s definitions** — align legal analysis with product facts.

---

## 9. Medical claims risk checklist

Review onboarding, settings, Pre-Visit chrome, and marketing:

- [ ] No diagnosis or treatment claims.
- [ ] No emergency redirect unless product truly provides vetted emergency guidance (generally avoid).
- [ ] Microphone: **permission rationale** explains recording **only for user-controlled dictation / intake**, not background surveillance.
- [ ] Consent before sending documents / emails / sharing links (explicit user action).
- [ ] Push notifications (future): no medical urgency; informational only; opt-in.

---

## 10. OpenAI / audio processing note

If the product sends audio or text to OpenAI:

- Document in privacy policy: what is sent, purpose, retention defaults per vendor, and user control.
- In-app: clear notice before first use where required by policy/regulation.

---

## 11. Resend / email processing note

If email send uses Resend or similar:

- Document: addresses, metadata, and content processed for delivery.
- Offline behavior: **do not** fake success — show unavailable when offline.

---

## 12. PWA technical checklist

- [ ] `manifest`: name **MedScoutX**, short_name **MedScoutX**, `display: standalone`, `start_url`, `theme_color`, `background_color`, icons 192 + 512.
- [ ] **Maskable icon:** dedicated asset with safe zone (TODO in `vite.config.js` if reusing 512 for maskable).
- [ ] **Apple touch icon:** `public/apple-touch-icon.png` linked in `index.html`.
- [ ] Offline: shell loads; API-dependent features show errors / banners — no false success.
- [ ] Install hint: subtle; hidden when unsupported or already installed.

---

## 13. Icons & splash

- [ ] `pwa-192x192.png`, `pwa-512x512.png` present under `client/public/`.
- [ ] Maskable variant — **TODO** until design provides safe-zone artwork.
- [ ] iOS splash screens — optional; often handled by OS from icons when using PWA; native wrapper may need assets later (Capacitor).

---

## 14. Permission rationale copy (draft — localize)

**Microphone (EN):** “MedScoutX uses the microphone only when you start voice input for visit preparation. Audio is not recorded in the background.”

**Microphone (DE):** “MedScoutX nutzt das Mikrofon nur, wenn Sie die Spracheingabe für die Gesprächsvorbereitung starten. Es findet keine Aufzeichnung im Hintergrund statt.”

**Notifications:** not requested until push is implemented and copy is approved.

---

## 15. Manual test checklist

- [ ] iPhone Safari — add to Home Screen (PWA).
- [ ] Android Chrome — install PWA.
- [ ] Mobile login / session persistence.
- [ ] Pre-Visit flow end-to-end (prepare → document if applicable).
- [ ] Microphone permission prompt and denial path.
- [ ] PDF download / share.
- [ ] QR resolve route (requires network — verify error when offline).
- [ ] Account save / profile flows.
- [ ] Follow-up pages (online).
- [ ] Data export / deletion flows.
- [ ] Offline: banner + no fake email/QR success.

---

## 16. Current Apple review risks (subjective — verify)

- Medical adjacency: any wording that sounds like diagnosis, triage, or treatment.
- AI features: insufficient disclosure in privacy labels or in-app notice.
- Account deletion / data export discoverability.
- Microphone use: unclear purpose or perception of background recording.
- Health data classification if storing symptom-like content — align with counsel.

---

## 17. Current Google Play risks (subjective — verify)

- Data safety form mismatch with actual collection.
- Deceptive health claims in short description or screenshots.
- Sensitive permissions without clear in-app rationale.

---

## 18. Missing requirements before submission (rolling)

- Final **support contact** and legally reviewed privacy/imprint text.
- **Dedicated maskable** icon asset.
- Store listing graphics per §6.
- Push: **not** shipping until policy-approved copy and opt-in; placeholder lives under `client/src/features/notifications/`.
- Symptom chat, image analysis, body map: **out of scope** for this Pre-Visit–first submission wave — keep isolated or hidden from primary shell if product decision requires.

---

## 19. Primary routes (stability)

Confirm in production builds:

- `/pre-visit`, `/pre-visit/chat`, `/pre-visit/document`, `/pre-visit/my-preparations`, `/pre-visit/cases`
- `/settings/doctor-contacts`, `/settings/practices`, `/settings/privacy`
- `/account`, `/account/documents`, `/account/data`
- Legal: `/datenschutz`, `/impressum`, `/agb` (if applicable)

---

*Last updated: engineering checklist; replace placeholders before store submission.*
