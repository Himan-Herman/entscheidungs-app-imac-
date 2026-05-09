# Image analysis — internal store readiness notes

Engineering checklist for **patient-provided image description** (`/bild`, `/api/symptom` with multipart image). Not legal advice.

---

## Feature description (store-safe)

- Users **actively select or capture** an image, confirm **processing consent**, then send a question or context.
- The assistant returns **neutral structured notes** for preparing a doctor visit — **not** a diagnosis, clinical imaging read, urgency triage, treatment, or specialist routing.

---

## Non-diagnosis statement

Must stay consistent in UI (`imageAnalysis.storeDisclaimer`, `processingNote`) and listings: **no diagnosis from images**, **no replacement for examination**.

---

## Emergency disclaimer

Shown on the page (`imageAnalysis.emergencyNote`). Users must seek immediate care for acute/life-threatening situations outside the app.

---

## AI vision processing

- Server: `server/routes/symptom.js` uploads image to OpenAI (`purpose: 'vision'`), runs Assistants thread with **`ASSISTANT_ID_BILDANALYSE`** and `additional_instructions` from `client/src/pages/prompt/bildanalysePrompt.js`.
- **`/api/ki`** (`server/routes/ki.js`): separate JSON/base64 path; system prompt aligned for neutral preparation wording — verify consumers still behave as expected.

**Critical:** Review the OpenAI **Assistant** dashboard instructions for **Bildanalyse** so they do not contradict the injected store-safe instructions.

---

## Image privacy / data handling

- **Device:** Preview uses an **object URL** in memory; **not** written to `localStorage` anymore (avoids broken blob URLs and silent persistence).
- **Chat text:** May persist locally after consent (`bildChatVerlauf`) until user clears/resets.
- **Server:** Image sent only when user taps send; processed by OpenAI per backend — disclose in Privacy Policy / Datenschutz.

---

## Camera / photo permissions

- **Gallery / pick:** No camera permission.
- **Camera capture / webcam:** User-triggered only; short explanatory copy before starting webcam (`webcamExplainer`, dialog copy).
- No background capture.

---

## Screenshot checklist

1. Safety banner + emergency + storage note + consent gate.  
2. Upload controls + large buttons + remove image.  
3. Chat with neutral “structured note” wording (no diagnosis).  
4. Loading / offline disabled send.  
5. Privacy links visible.

---

## Apple review risks (subjective)

- Framing as “analysis” or “detection” in metadata or screenshots.  
- Privacy Nutrition Labels vs image + text sent to OpenAI.  
- Camera permission purpose string must match **user-initiated** capture only.

---

## Google Play risks (subjective)

- Data safety declarations vs photos/health-adjacent content.  
- Misleading claims about diagnostic utility.

---

## Permission notes

- `capture="environment"` on file input may invoke camera — covered by consent + explainer.  
- Webcam uses `getUserMedia` — OS/browser permission dialog; denial handled with plain-language alert.

---

## Remaining blockers

- [ ] Align **OpenAI Assistant Bildanalyse** system instructions with shipped `getBildanalysePrompt`.  
- [ ] Legal/compliance review of DE/EN strings and privacy policy.  
- [ ] Replace `window.alert` for offline/denied camera with non-blocking UI (optional polish).  
- [ ] End-to-end QA: new image, same-thread follow-up, reset, consent flow.

---

*Last updated with Image Analysis store-safety pass.*
