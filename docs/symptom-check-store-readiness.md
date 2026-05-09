# Symptom Check — internal store readiness notes

Engineering checklist for the **text Symptom Check** (`/symptom`, `/api/textsymptom`). Not legal advice. Align public texts and privacy labels with counsel before submission.

---

## Feature description (store-safe)

- Users describe symptoms in their own words; the assistant asks **neutral clarification questions** and, when enough detail exists, outputs a **structured summary** for personal notes and doctor conversations.
- **No:** diagnosis, treatment recommendation, urgency/triage, specialist routing, emergency assessment, medical device claim.

---

## Non-diagnosis statement

In-app (DE/EN via `symptomCheck.storeSafetyNotice` + subtitle) and marketing should stay consistent: preparation and orientation only; **no diagnosis or treatment recommendation**.

---

## Emergency disclaimer

Prominent banner on the Symptom Check page (localized). Users must not rely on the tool in emergencies; direct to **local emergency services** / professional care.

---

## Privacy / data handling

- **Device:** Conversation history and OpenAI thread id are stored in **localStorage** only after explicit **checkbox consent** (`medscoutx_symptom_check_ack_v1`). Users can clear with **New conversation** / **Clear history** (and browser storage controls).
- **Server:** Messages are sent authenticated to **`/api/textsymptom`** and processed via **OpenAI** (Assistants API + configured assistant id). Align Datenschutz / privacy policy with actual retention and subprocessors.
- **Account:** Links to **`/datenschutz`**, **`/settings/privacy`** for export/deletion where applicable (account-held data is separate from local-only chat).

---

## AI use

- System instructions live in `client/src/pages/prompt/textsymptomPrompt.js` (injected when a thread is created). **Re-review** the configured OpenAI Assistant’s **built-in instructions** in the provider dashboard — they must not contradict these rules (diagnosis/triage/treatment/specialty).

---

## Microphone / transcription

- **Voice:** Optional; recording only when the user taps mic (`VoiceInput`). Short notice above the control (`symptomCheck.micNotice`). Audio is sent to **`/api/transcribe`** when recording stops — disclose next to OpenAI in privacy materials if applicable.

---

## Screenshots suggested

1. Consent + emergency banner + privacy links.  
2. Chat with neutral follow-up question (no “diagnosis” wording).  
3. Structured summary sections (description, timeline, medications, gaps, questions for doctor).  
4. Copy / download actions.  
5. Offline state (send disabled + connectivity expectation).

---

## Apple review risks (subjective)

- Medical adjacency: any screenshot or metadata implying diagnosis or triage.  
- AI disclosure: App Privacy labels vs actual OpenAI/audio processing.  
- Microphone purpose string must match **user-initiated** input only.  
- Assistant-side prompts in OpenAI project conflicting with app-safe prompt.

---

## Google Play risks (subjective)

- Data safety form vs health-related user content and AI processing.  
- Misleading feature name or description suggesting diagnosis or emergency use.

---

## Remaining blockers before submission

- [ ] Verify **OpenAI Assistant** system prompt/instructions match store-safe behavior.  
- [ ] Legal review of DE/EN copy and privacy policy for Symptom Check + transcription.  
- [ ] Final support/contact details in Impressum and listing.  
- [ ] Optional: replace `window.alert` for offline with in-app banner for gentler UX.

---

*Last updated with Symptom Check store-safety pass (UI, consent, prompt, docs).*
