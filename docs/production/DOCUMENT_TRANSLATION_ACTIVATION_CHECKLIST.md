# Document translation — activation checklist

> **This is a technical release gate, not legal advice.** It records what the
> repository can and cannot establish, so that the remaining questions are
> answered by the people qualified to answer them rather than inferred from
> code. Nothing in this file constitutes a data-protection assessment.

**Status: NOT APPROVED FOR ACTIVATION.**
Code complete through Phase 2D; external approval open.

| | |
|---|---|
| Feature flag | `ENABLE_DOCUMENT_TRANSLATION` — **false** (default) |
| Client flag | `VITE_DOCUMENT_TRANSLATION_ENABLED` — **false / unset** |
| Provider | not configured |
| Approved endpoint hosts | **none** (`APPROVED_PROVIDER_HOSTS` is empty) |
| Rollout stage | **Stage 0** |

---

## 1. What this feature does

A patient opens a document their practice released to them and asks for it in
another language, or in plain wording. The server extracts the text locally,
masks the values that must not be altered, sends only prepared text segments to
an external model, and restores the masked values in the answer.

**The transmitted material is the text of a medical document.** Under Art. 9
GDPR that is special-category personal data. It is not comparable to the
metadata and billing-code payloads the other AI features send, and an approval
that covers those does not cover this one.

```
Full medical document content may contain special-category personal data.
```

### What never leaves the server

| | |
|---|---|
| The original file | never — no upload, no Files API, no attachment |
| Patient identity | masked before transmission (name, DOB, contact, insurance IDs) |
| Medication and dosage | masked as atomic tokens; unmaskable medication fails closed |
| Document, file, practice, patient IDs | never in the payload |
| The result | not persisted server-side, not cached client-side |

---

## 2. Where the boundary sits

```
practice releases document
   └─ provenance gate  (link active + share active + type allowlist)
      └─ local extraction  (isolated worker, resource-limited)
         └─ local masking  (PII, medication, dosage, identifiers, dates)
            └─ prepared text segments ──────────────→ provider
               └─ integrity + safety checks on the answer
                  └─ restore masked values locally
```

The arrow is the only external step, and it carries prepared text only.
Everything to the left of it stays on MedScoutX infrastructure.

---

## 3. External approval matrix

**Moved.** Since Phase 4A the live status of every requirement is tracked in
[`DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md`](DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md),
which uses a six-value status model (`OPEN` / `EVIDENCE_PROVIDED` / `VERIFIED` /
`INSUFFICIENT` / `CONFLICT` / `NOT_APPLICABLE`) and records the evidence behind
each value. Keeping two tables would have let them drift, and a compliance
document that contradicts itself is worse than one document.

Summary at the time of writing — 13 provider/contract requirements and 7
data-protection/product requirements, of which:

| | |
|---|---|
| `VERIFIED` | **none** |
| `CONFLICT` | 1 — the live privacy notice (register §6) |
| `OPEN` | all others |

**No requirement may be marked done from inside the repository**, with two
narrow exceptions: that a dedicated key exists and is not the generic one, and
that the endpoint host is on the approved list. Both are statements about
configuration, not about permission.

---

## 4. What the environment flags do and do not mean

Two variables read like guarantees and are not:

```
DOCUMENT_TRANSLATION_ZERO_RETENTION
This flag records an operator assertion. It does not technically verify the
provider's retention configuration.

DOCUMENT_TRANSLATION_DATA_REGION
This value records an operator assertion. It does not technically verify where
the provider processes the request.
```

They exist so the running configuration is inspectable and the claim is
attributable — enabling external processing should be a deliberate, signed act,
not a side effect of a key appearing in the environment. Neither is evidence.
Rows 3 and 5 of the matrix stay open no matter what these are set to.

---

## 5. Endpoint approval — why it is a code change

`APPROVED_PROVIDER_HOSTS` in
`server/services/documentTranslation/provider/documentTranslationProviderConfig.js`
is **empty**. In production, an endpoint whose host is not on that list is
refused, so production cannot currently be configured at all.

This is deliberate, and it replaces the "compliance approved" boolean that would
otherwise belong here. A boolean an operator can set proves nothing — it is the
same category of claim as `ZERO_RETENTION=true`. Filling this list is a commit
that goes through review, so activation requires a second pair of eyes by
construction.

**Do not add a host** until row 6 of the matrix has real evidence behind it. A
host that merely looks regional is a guess.

---

## 6. Patient consent — open question

> **Corrected in Phase 4A.** The reading below originally inferred the scope of
> `ai_organizational_assistance` from its name and legacy-scope mapping. A
> direct audit of the enforcement sites gave a more precise picture, recorded in
> [`DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md`](DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md) §7.
> The conclusion — that no existing consent covers this use case — is unchanged;
> the reasoning is not.

The repository has a granular consent catalogue
(`server/services/consent/consentTypes.js`). Facts from the enforcement sites,
not conclusions:

- `ai_organizational_assistance` **is** required for AI processing of a practice
  document: `documentOcrService.js` demands it for the `ai_vision` OCR engine,
  alongside `document_sharing`. But that engine sends nothing anywhere — it
  parses text locally with regular expressions, and its adapter contains no HTTP
  client at all. The consent has only ever gated local processing.
- `meda_live_translation_processing` is **declared but never enforced**. It
  exists in the catalogue and as a UI label; no server code references it. It is
  an intention, not an implemented precedent.
- **No service in this codebase that actually calls OpenAI checks any consent
  type** — not pre-visit, not the interpreter, not this feature. External AI
  processing is currently gated by feature flags and by the patient's own
  action, never by a recorded consent.

This feature would therefore be the first external AI processing of
practice-released medical content, with no established consent mechanism to
inherit.

**The document transformation service currently checks no consent type at all.**
The patient starts it deliberately, and the provenance gate already requires an
active practice link and an active share — but neither is a consent to external
AI processing.

```
LEGAL/PRODUCT REVIEW REQUIRED
```

Questions a review has to answer before Stage 3:

- [ ] Does an existing consent type cover external AI transformation of document content, or is a new one required?
- [ ] Is the deliberate start of the transformation by the patient itself the consent, or does it need a separate recorded grant?
- [ ] What is the legal basis, and is consent the right instrument for it?
- [ ] What information must the patient see before the first run?
- [ ] Is it revocable, and what happens to nothing-was-stored in that case?

No consent type was reused silently to close this gap. That decision is not the
code's to make.

---

## 7. Privacy documentation status

| Document | Covers this feature? |
|---|---|
| Live privacy notice (`Datenschutz.jsx`, 21 locales) | **no — LEGAL REVIEW REQUIRED**, see below |
| `docs/legal/avv-dpa-medscoutx-pilot.de.md` | no — scoped to the GOÄ/PKV billing pilot |
| `docs/legal/subprocessors-medscoutx-pilot.de.md` | no — lists OpenAI as **disabled by default**, for billing AI review only |
| `docs/legal/privacy-notice-billing-pilot.*.md` | no — billing pilot drafts, and drafts at that |

### What the live notice actually says

`client/src/i18n/translations/legal/de/datenschutz.part1.js` names OpenAI LLC
(San Francisco, USA) as processing service for *"deiner Texteingaben, Bilddaten
und Body-Map-Angaben"* — the patient's **own inputs** — and describes the
transfer as a third-country transfer to the USA.

Two mismatches follow, both stated as observations:

1. **Scope.** The text of a document the *practice* released is not a patient
   text input. The wording does not describe this processing operation.
2. **Region.** The notice commits to a USA transfer. If activation is based on
   an EU-residency arrangement (matrix row 3), the notice and the configuration
   would say different things, and the notice is what the patient reads.

The existing legal drafts were written for a different processing operation.
They were **not** amended by this phase: extending them to cover medical
document content is a legal act, not a documentation edit. The same applies to
the live notice — un-reviewed text must not be published to patients.

Points a data-protection review has to cover for this feature:

- provider (controller/processor roles)
- purpose of processing
- data categories — **including Art. 9 health data**
- recipients and subprocessors
- third country / region
- retention at the provider
- information duty toward the patient
- legal basis
- withdrawal, if consent is the basis

---

## 8. Ordered activation runbook

Each step is a gate. Do not start a step before the previous one is documented.

1. Data-protection and contractual approval documented (matrix rows 1, 2, 12–16)
2. Dedicated provider project created (row 4)
3. Data residency confirmed for that project (row 3)
4. Zero data retention confirmed for that project (row 5)
5. Endpoint and model compatibility confirmed (rows 7–9)
6. Dedicated API key issued, scoped to that project (rows 10, 11)
7. Endpoint host added to `APPROVED_PROVIDER_HOSTS` — reviewed commit (row 6)
8. Secrets set in the deployment. **Feature flag stays `false`.**
9. `npm run verify:document-translation-provider -- --confirm` — synthetic text only
10. Check `/api/health/config` → `documentTranslation.ready`, and the startup log
11. Written activation decision recorded outside the patient data system
12. Only then: enable for a controlled pilot (Stage 3)

**Never use a real patient document for step 9.** The smoke test sends invented
text about an invented person and is the only sanctioned way to exercise the
provider before activation.

---

## 9. Rollout stages

| Stage | Feature flag | Provider | Data | Gate to enter |
|---|---|---|---|---|
| **0 — current** | off | off | none | — |
| 1 | off | configured | synthetic only | matrix rows 1–11 closed |
| 2 | on, internal only | configured | synthetic + internal test accounts | Stage 1 clean, logs reviewed |
| 3 | on, limited pilot | configured | real, consented, limited group | rows 12–16 closed, written approval |
| 4 | on, broader | configured | real | Stage 3 monitored, refusal/error rates acceptable |

No stage advances automatically. Each is a decision.

---

## 10. Kill switch

```bash
ENABLE_DOCUMENT_TRANSLATION=false
```

Takes effect on the next request — the flag is read per request, not cached at
boot. No migration, no code change, no rebuild. On Render this is an environment
change plus a restart.

Second, independent lever: revoke the dedicated API key in the provider
dashboard. Because the key is not shared with any other MedScoutX feature,
revoking it stops document translation and nothing else.

**First action on any of the following is to switch the feature off, then
investigate:**

- the provider's retention or residency terms change
- a provider security incident
- new legal uncertainty
- a rise in `integrity_failed` or `document_medication_unverifiable`
- any suspicion of content leaving through an unintended path

Do **not** fail over to another provider. There is no fallback chain by
construction, and adding one would move medical documents to a party covered by
no agreement. A provider change is its own approval process, starting again at
row 1.

---

## 11. Monitoring without health data

The existing `AuditLog` already records, per transformation, metadata only:

`mode`, `targetLanguage`, `outcome`, `segmentCount`, `attempts`,
`promptVersion`, `providerKind`, `model`, `durationMs`, plus the document and
practice ids that the audit table records for every entry.

Document text, medication names, diagnoses, patient names and model output are
**not** recorded. No analytics platform was added and none should be: the audit
log is the monitoring surface.

Rates worth watching during a pilot: refusals by error code, `integrity_failed`,
`document_medication_unverifiable`, parser rejections, provider timeouts,
duration, and volume per patient.

---

## 12. Cost control

Already enforced in code:

| Control | Where |
|---|---|
| One repair attempt, never more | `MAX_ATTEMPTS = 2` in the service |
| One transformation per patient at a time | in-flight set in the service |
| Per-IP rate limit | `documentTranslationIpLimiter` |
| 60 s request deadline | `PROVIDER_TIMEOUT_MS` |
| Client abort propagates to the provider call | route + service |
| Models pinned by configuration | `MODEL_STRICT` / `MODEL_PLAIN` |
| No automatic model upgrading | models are read from the environment, never chosen at runtime |
| Size and structure limits before any call | extraction preflight |

Before a pilot, decide a per-patient and per-day volume ceiling. No price
figures are given here; provider pricing is external and changes.

---

## 13. What the code guarantees, restated honestly

**Enforced here:**
- the feature is off unless both flags are on
- nothing is sent unless a complete, dedicated provider configuration resolves
- the dedicated key may not be the generic `OPENAI_API_KEY`
- production endpoints must be https and on the approved host list
- the in-process test double is refused in production
- no tools, no retrieval, no file upload, no streaming, no conversation state
- the original file never leaves the server
- results are not persisted or cached

**Not enforceable here, ever:**
- that a DPA exists and is in force
- that processing happens in the asserted region
- that the provider retains nothing
- that a legal basis has been determined
- that the patient has been adequately informed

The second list is what §3 tracks. Code cannot close it.

---

## 14. Verification

```bash
cd server && npm test                                        # includes the activation gate suite
cd server && npm run verify:document-translation-provider    # prints usage; needs --confirm
```

The gate suite (`scripts/verifyDocumentTranslationActivationGate.test.js`)
asserts that in every unsafe configuration state the number of outbound HTTP
requests is zero.

---

*Related: [`../legal/README.md`](../legal/README.md) ·
[`../billing-plausibility-compliance-checklist.md`](../billing-plausibility-compliance-checklist.md)
(separate feature, separate approval)*
