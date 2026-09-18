# Document translation — evidence register (Phase 4A)

> **Working document for verifying external approvals.** It records which
> evidence has been produced, what it establishes, and what is still missing.
> It is not legal advice and it does not itself approve anything.
>
> **Contains no patient data, no secrets, no API keys, and no screenshots.**
> Contracts and account screenshots stay outside the repository; only the fact
> that they were checked is recorded here.

**Technical implementation: COMPLETE** (closed 2026-09-18)
**Production provider activation: DEFERRED — NOT APPROVED**
**Go/No-Go status: `NO-GO FOR PRODUCTION ACTIVATION`**
Baseline commit: `545444ea` · Phase 2A–2D frozen · both feature flags off
Last evidence assessed: A5–A13 reclassified + A8 corrected, 2026-09-18 · `VERIFIED` 6 / 21 · legal sign-off sheet prepared
A3/A4 deferred 2026-09-18 (no provider response), re-opened the same day as `OPEN – approval required` with a combined request
Legal readiness prepared 2026-09-18 — decision matrix, DPIA draft, data-subject-rights runbook (§11)
Legal sign-off: `PENDING EXTERNAL REVIEW` · A3/A4: `OPEN – approval required`, combined request prepared 2026-09-18 (§12.5)

---

## 1. Status model

| Status | Meaning |
|---|---|
| `OPEN` | no evidence produced yet |
| `EVIDENCE_PROVIDED` | evidence exists and has been received, assessment not complete |
| `VERIFIED` | evidence received **and** it establishes the requirement |
| `INSUFFICIENT` | evidence received but it does not establish the requirement |
| `CONFLICT` | evidence contradicts another statement or the intended configuration |
| `NOT_APPLICABLE` | requirement does not apply, with the reason recorded |

`VERIFIED` requires a concrete piece of evidence. It is never awarded because
something is likely, standard, or documented as available in general.

**Deferral is not a status.** Where a requirement is parked, it stays `OPEN` and
the deferral is written into the evidence column. A row is never nearer to
`VERIFIED` for having been postponed, and silence from a third party is not
evidence of anything.

Two further qualifiers are used where a requirement is partly technical:

- `VERIFIED – technical/documentary evidence` — the document or configuration
  demonstrably exists and says what it needs to say. It does **not** mean the
  arrangement is legally effective.
- `LEGAL REVIEW REQUIRED` — the remaining question is one of legal
  interpretation and cannot be settled from this repository.

---

## 2. Register

Acquisition order, not importance order. `Repo?` = can this repository
establish it — `yes` / `partial` (can enforce a configuration, cannot verify
the underlying fact) / `no`.

### Block A — provider and contract

| # | Requirement | Status | Evidence description | Date | Repo? | Reviewer | Notes |
|---|---|---|---|---|---|---|---|
| A1 | Executed DPA / AVV with the provider | **`VERIFIED – technical/documentary evidence`** | Executed OpenAI Data Processing Addendum, version `v.010126`, both parties dated 2026-08-16, DocuSign envelope with PKCS#7 seal. Evidence checked on 2026-08-17 – source stored externally. | 2026-08-17 | no | operator | Customer: Himan Khorshidi, title "Sole Proprietor". Provider entity follows from the EEA clause, see A1a. Contract text byte-identical to the public template — no customisation. |
| A1a | Contractual scope covers **medical document content** | **`LEGAL REVIEW REQUIRED`** | Same document. Schedule 1 §5 reads *"No sensitive data is intended to be transferred unless the user includes it unexpectedly in unstructured data."* No occurrence of special categories, health, Article 9, HIPAA, prohibited or restricted data anywhere in the contract. | 2026-08-17 | no | operator | Our use case transfers health data **deliberately and systematically**. Classified `not determinable from the DPA`. Feeds into B4. **A1 being verified does not resolve this.** One-page question for external review prepared 2026-09-18 — [`DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md`](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) §6. |
| A2 | Dedicated provider project for document translation | **`VERIFIED – account/project evidence`** | Provider console screenshots: a dedicated project named "MedScoutX Document Translation" exists, and it belongs to the same provider organization as the executed DPA. Match performed 2026-08-17. Evidence checked on 2026-08-17 – source stored externally. | 2026-08-17 | no | operator | Identifiers deliberately not recorded here. Separation from the key behind `OPENAI_API_KEY` is **not** established by this row — that is A11/A12. |
| A3 | Data residency confirmed **for that project** | `OPEN – approval required` | Provider request submitted and acknowledged 2026-08-17. **No provider response was ever received.** Deliberately deferred 2026-09-18. The *path* is now documented, which the deferral did not change: data residency is *"configured per-project within your API Organization"*, the region is selected *"from the dropdown"* when creating a project, and *"To use data residency with any region other than the United States, you must be approved for abuse monitoring controls, and execute a Modified Retention amendment."* | 2026-09-18 | partial | operator | `DATA_REGION` records an assertion only. **Three named prerequisites** now replace "ask sales": (1) abuse-monitoring approval, (2) an executed Modified Retention amendment — a contract act that belongs beside A1a, (3) a project in the Europe region. Whether the **existing** dedicated project (A2) can be moved to a region or must be recreated is **not established by the documentation** and is account evidence. |
| A4 | Zero data retention confirmed **for that project** | `OPEN – approval required` | Provider request submitted and acknowledged 2026-08-17. **No provider response was ever received.** Deliberately deferred 2026-09-18. Documented path: ZDR *"requires prior approval"*; once approved it is configured by the customer under *"Settings → Organization → Data controls"* at organisation or project level. | 2026-09-18 | partial | operator | `ZERO_RETENTION` records an assertion only. Approval is genuinely a provider decision — this is one of the few rows where that is true. Once granted, the setting is **visible in our own console** and becomes account evidence rather than a sales question. |
| A5 | Endpoint `/v1/chat/completions` available on the approved regional endpoint | **`VERIFIED – public provider documentation`** *(general support only)* | API reference documents `POST /v1/chat/completions` as current with no deprecation notice on the endpoint. The data-controls guide lists it among the endpoints covered by data residency **and** among the ZDR-eligible endpoints. | 2026-09-18 | yes (documentation) | operator | Establishes that the path exists, is supported and is in scope for both programmes. Does **not** establish that our project reaches it in a given region — that is A13 + A3. |
| A6 | That endpoint supports `response_format: json_schema` as used | **`VERIFIED – public provider documentation`** | The Chat Completions API reference documents `response_format` and states that setting `{ "type": "json_schema", "json_schema": {...} }` *"enables Structured Outputs which ensures the model will match your supplied JSON schema"*. | 2026-09-18 | yes (documentation) | operator | Structured output is load-bearing, not cosmetic. **Directional note:** the Structured Outputs *guide* is now written around the Responses API and the provider recommends Responses for new projects while stating Chat Completions remains supported. Not a blocker; a reason to keep the adapter's endpoint choice under review. Model-side support is A9/A10. |
| A7 | Endpoint compatible with the agreed retention/ZDR configuration | **`VERIFIED – public provider documentation`** *(endpoint eligibility only)* | The data-controls guide lists `/v1/chat/completions` among the ZDR-eligible endpoints and states that under ZDR *"the `store` parameter for `/v1/responses` and `v1/chat/completions` will always be treated as `false`, even if the request attempts to set the value to `true`"*. | 2026-09-18 | yes (documentation) | operator | The endpoint is **capable** of running under a ZDR arrangement. Whether ZDR is active for our organisation/project is **A4 and stays open**. The adapter sets no `store` parameter either way. |
| A8 | Prompt/response caching behaviour of that endpoint understood | **`VERIFIED – public provider documentation`** *(for this endpoint, conditional on the model class — see gap)* | **Checked against the Chat Completions API reference itself, not the Responses API.** That reference documents, on `/v1/chat/completions`: `prompt_cache_key` (*"Used by OpenAI to cache responses for similar requests… Replaces the `user` field"*), `prompt_cache_options` (*"Options for prompt caching. Supported for `gpt-5.6` and later models"*) with `mode: implicit\|explicit` and `ttl: "30m"`, and the now-deprecated `prompt_cache_retention` with `in_memory\|24h`. Setting `mode: "explicit"` without placing breakpoints means *"the request does not use prompt caching"*. The caching guide adds that caches are org-isolated and *"cannot be reused across regional processing boundaries"*, and that organisations *"with Zero Data Retention enabled default to `in_memory`"*. | 2026-09-18 | yes (documentation) | operator | **Corrects the assessment of 2026-09-18 earlier the same day.** That one read the caching *guide*, which is written around the Responses API, and concluded no opt-out was documented. The API reference for our own endpoint documents the controls. Answers all five sub-questions for `/v1/chat/completions`: caching happens (implicit by default); the full rendered context is cacheable; maximum retention is `in_memory` under ZDR, otherwise 30 min on `gpt-5.6`+ and up to 24 h on earlier models; it is controllable and can effectively be opted out of; ZDR shortens retention to `in_memory`. **Remaining gap:** `prompt_cache_options` requires `gpt-5.6` or later, so this verification holds only if A9/A10 select that class — with an earlier model the control is a deprecated parameter and the ceiling is 24 h. Whether default-on caching of medical text is acceptable stays a legal question (sign-off field 13 territory). |
| A9 | `MODEL_STRICT` available in the approved project and region | `OPEN – account evidence required` *(candidate selected)* | **No model name exists anywhere in this repository**; both slots are env-only with no default and the configuration is refused if either is absent. Documented candidate selection recorded in [`…LEGAL_DECISION_MATRIX.md`](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) §7.4: primary `gpt-5.6-terra`, fallback candidate `gpt-5.6-sol`. Both are documented as supporting `v1/chat/completions`, `structured_outputs` and `prompt_caching`, with a 1,050,000-token context window. | 2026-09-18 | partial | operator | Choosing the class is ours; **availability in our project and region is not**. No silent fallback exists in code and none will be added — the fallback is a documented candidate, not a runtime behaviour. |
| A10 | `MODEL_PLAIN` available in the approved project and region | `OPEN – account evidence required` *(candidate selected)* | As A9. The two slots are independent; the same candidate is proposed for both, with the reasoning in §7.4. | 2026-09-18 | partial | operator | Unavailable ⇒ deliberate decision required, not a fallback. Organisation verification may gate access to some models — see §2a. |
| A11 | Dedicated API key exists for the approved project | **`READY FOR ACCOUNT ACTION`** | Not a provider approval question and not a sales matter. The provider documents project **service-account** keys scoped to a single project. The code already enforces the hard part: a configuration whose key equals `OPENAI_API_KEY` is refused with `reused_generic_key`. Exact step recorded in [`…LEGAL_DECISION_MATRIX.md`](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) §7.3. | 2026-09-18 | yes (existence only) | — | Executable today **without** activating anything: a key that exists but is never placed in a running environment changes nothing. Evidence needed is one sentence: `Key exists for approved translation project: yes`. Never sent in chat, never committed, never truncated. |
| A12 | Key scoped to that project only, rotatable | **`READY FOR ACCOUNT ACTION`** | Provider guidance: *"We strongly recommend setting an expiration date when you create a project API key and establishing a regular key rotation process."* Administrators can *"allow only service-account keys, allow only user-owned project keys, or disable all new API key creation"*; organisation-level restrictions take precedence. | 2026-09-18 | no | — | A **service-account** key is the right shape here: it belongs to the project rather than to a person, so it survives staff changes and is not revoked with an individual's access. Console configuration, executable in the same sitting as A11. |
| A13 | Confirmed regional host, to be added to `APPROVED_PROVIDER_HOSTS` | **`HOST = VERIFIED BY PUBLIC DOCUMENTATION` · `PROJECT USE = BLOCKED BY A3`** | The data-controls guide documents a per-region domain prefix, names `eu.api.openai.com` for Europe to be added *"to each request"*, and lists `/v1/chat/completions` among the covered endpoints. | 2026-09-18 | yes (enforced) | operator | The split is the point and is kept deliberately: **the host is documented, our project is not enabled.** The row cannot go fully `VERIFIED` while A3 is open, because the requirement asks for a confirmed host *for our configuration*. Entering it remains a reviewed commit, which is the four-eyes gate. |

### Block B — data protection and product

| # | Requirement | Status | Evidence description | Date | Repo? | Reviewer | Notes |
|---|---|---|---|---|---|---|---|
| B1 | Privacy notice covers this processing | `CONFLICT` | Live notice analysed from the repository, 2026-08-15 | 2026-08-15 | partial | operator | Names OpenAI **USA** for the patient's *own* inputs; see §6 |
| B2 | Provider listed as subprocessor **for this processing** | `OPEN` | Change matrix prepared 2026-09-18 — see [`DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md`](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) §3. Ten concrete additions identified across AVV, subprocessor list and TOM; text blocks drafted for those that do not depend on a decision. | 2026-09-18 | partial | operator | Billing-pilot entry does not cover it; scope note added in Phase 3. The role assignment itself is `LEGAL DECISION REQUIRED`, and the subprocessor row cannot be filled before A3/A13. |
| B3 | Consent model decided for this use case | `OPEN` | Consent architecture re-audited 2026-08-15. Both implementation variants fully specified 2026-09-18 — see [`DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md`](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) §4 (UI, server enforcement, revocation, audit, versioning, effect on existing consents, effect on B1/B7). | 2026-09-18 | partial | operator | No covering consent exists; see §7 — corrects a Phase 3 statement. **Neither variant is implemented.** |
| B4 | Legal basis determined and documented | `OPEN – legal review packet prepared` | Legal review packet prepared on 2026-08-17. External legal determination pending. See [`DOCUMENT_TRANSLATION_LEGAL_REVIEW_PACKET.md`](DOCUMENT_TRANSLATION_LEGAL_REVIEW_PACKET.md). | 2026-08-17 | no | — | `LEGAL REVIEW REQUIRED`; not to be asserted from code. A prepared packet is preparation, **not** evidence — the status stays `OPEN` until a determination exists. |
| B5 | DPIA/DSFA necessity assessed for this processing | **`OPEN – DPIA draft prepared`** | Full DPIA draft prepared 2026-09-18 — [`DOCUMENT_TRANSLATION_DPIA_DRAFT.md`](DOCUMENT_TRANSLATION_DPIA_DRAFT.md). Processing, purposes, data categories, data subjects, recipients, steps, necessity, 14 named risks, safeguards. | 2026-09-18 | partial | operator | The repository contained no DPIA and no template before this. **Residual-risk assessment and the sign-off field are deliberately left empty**, and whether a DPIA is required at all is itself an open question — a prepared draft is preparation, not evidence. |
| B6 | Erasure/access request handling reviewed for this flow | `OPEN` | Data inventory compiled 2026-08-15. Operational runbook prepared 2026-09-18 — [`DOCUMENT_TRANSLATION_DATA_SUBJECT_RIGHTS_RUNBOOK.md`](DOCUMENT_TRANSLATION_DATA_SUBJECT_RIGHTS_RUNBOOK.md): access, rectification, erasure, restriction, revocation, portability, third parties in the document. | 2026-09-18 | partial | operator | Inventory in §8; the process decision is external. Eight points must close before activation, incl. audit retention (`LEGAL DECISION REQUIRED`) and backup reach (`UNKNOWN`). |
| B7 | Patient-facing information decided (what is shown before the first run) | `OPEN` | German draft prepared 2026-09-18 — [`DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md`](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) Annex A. Legal-basis line deliberately left as a marked variant. | 2026-09-18 | partial | operator | Depends on B3/B4. The UI has **no slot** for pre-run information today — that is a contained follow-up change (one element, one i18n key × 6 languages) once the text is approved. Translations only after the German text is signed off. |

**Six of 21 rows are `VERIFIED`: A1, A2, A5, A6, A7 and A8** (the last four on public provider documentation, each only for the technical statement it actually makes — see §12). **A11 and A12 are `READY FOR ACCOUNT ACTION`**: executable today without activating anything.

*Previously two.* Three further rows carry
repository-side analysis (B1, B3, B6); that analysis narrows the question, it
does not close it.

A1 and A2 together close one chain: an executed contract, and a dedicated
project inside the very organization that contract names. A dedicated project
in a *different* organization would have been outside the agreement, which is
why the match was checked rather than assumed.

A1 is the clearest illustration of why the two statuses are kept apart. The
contract demonstrably exists, is executed by both parties and covers the API —
and the same document, in its own SCC annex, describes a transfer of sensitive
data as *unintended*. A verified contract and an unresolved contractual scope
are not a contradiction; they are two different questions, and only the first
one is answered.

---

## 2a. Observations parked for later requirements

Noticed while verifying A2, recorded so they are not rediscovered late. **None
is a precondition for A1 or A2, and nothing has been changed in the provider
account.** Each is decided when its own requirement comes up.

| Observation | Relevant to | Why it is parked |
|---|---|---|
| The provider organization carries a placeholder display name | B2 | Contractually irrelevant — the DPA binds the organization *identifier*, which matched. But a subprocessor entry naming an organization unrelated to "MedScoutX" or the contract customer reads as an inconsistency to any later reviewer. |
| Neither individual nor business verification is completed | A9 / A10 | The console states verification is needed to access protected models. Whether the models this feature needs are affected is unknown until A9/A10 — so it is a possible dependency, not a finding. |
| User-based API keys are enabled at organization and project level | A12 | Bears on how tightly the translation key can be scoped. Decided with A11/A12, once the provider conditions are known. |

No action taken on any of these.

---

## 3. Endpoint — what has to be confirmed

The adapter calls `api.chat.completions.create(...)`, i.e. **`/v1/chat/completions`**,
with `response_format: { type: "json_schema" }`, `temperature: 0`, `top_p: 1`,
`maxRetries: 0` and an explicit `baseURL`. No streaming, no tools, no `store`,
no `user` field, no metadata.

What must be confirmed before activation, and cannot be inferred from another
endpoint's behaviour:

- [ ] the approved regional endpoint serves this exact API path
- [ ] it accepts `json_schema` structured output in the form used
- [ ] it is compatible with the agreed retention configuration
- [ ] there is no ZDR restriction specific to it
- [ ] there is no regional-processing restriction specific to it

Structured output is not a convenience here. The response schema is what makes
the integrity checks possible; an endpoint that only supports free-form JSON
would change the safety properties, not just the parsing code.

---

## 4. Prompt caching — deliberately unresolved

Phase 3 marked this `EXTERN ZU VERIFIZIEREN` and it stays that way.

What has to be established for the endpoint and model actually approved:

- [ ] whether caching is applied automatically, and on what trigger
- [ ] what is retained when it is, for how long, and where
- [ ] whether a zero-retention arrangement changes that behaviour
- [ ] whether any parameter is required to disable it

The inference *"zero data retention therefore no caching of any kind"* is not
made here. It is a conclusion about a specific provider feature and needs its
own evidence.

---

## 5. `APPROVED_PROVIDER_HOSTS` — deferred to Phase 4B

```
Host to approve:  <not yet confirmed>
Evidence:         <none>
Status:           OPEN
```

The list stays empty. Once A13 is `VERIFIED`, the change is a one-line addition
to `APPROVED_PROVIDER_HOSTS` in
`server/services/documentTranslation/provider/documentTranslationProviderConfig.js`,
plus a matching entry in `DOCUMENT_TRANSLATION_BASE_URL`. **Not implemented in
Phase 4A.** That commit is the four-eyes gate and belongs to Phase 4B, on
explicit instruction.

---

## 6. Privacy notice — change matrix

Source: `client/src/i18n/translations/legal/de/datenschutz.part1.js` and
`.part2.js` (German master; 21 locales derive from it). **Nothing was changed.**

| Current section | Problem | New processing | Review required |
|---|---|---|---|
| §3 Kategorien personenbezogener Daten | Lists the patient's *own* inputs: symptom text, body-map selections, uploaded images. Practice-released document content is not among the listed categories. | Text of a medical document the practice released to the patient | **yes** — new data category |
| §4 Zwecke der Verarbeitung | Purposes are symptom chat, body map, image analysis. No purpose covers translating or rewording a practice document. | Translation / plain-language rendering of a released document | **yes** — new purpose |
| §5 Rechtsgrundlagen | Art. 9 (2)(a) consent is described as covering *"alle von dir freiwillig eingegebenen Symptome … Body-Map … Bilder"*. Document content is **not** entered by the patient. | Art. 9 data not supplied by the data subject | **yes** — the described consent does not reach this case |
| §6 Auftragsverarbeiter | Names OpenAI LLC (USA) for *"deiner Texteingaben, Bilddaten und Body-Map-Angaben"*. Document content is not listed, and the entry describes a US processor. | Same provider, different data category — and possibly a different region | **yes** — category and region |
| §7 Drittlandtransfer | States a transfer to the **USA** under SCCs. If activation rests on EU residency (A3), the notice and the configuration would say different things. | EU-resident processing, if that is what is approved | **yes** — potential direct contradiction |
| §8 Speicherfristen | States MedScoutX stores no health content on the server. True for the transformation result — but an `AuditLog` row **is** written per request (see §8 below), and audit logging is not mentioned in this section at all. | Server-side metadata record per transformation | **yes** — completeness |
| §14 Automatisierte Verarbeitung | Advises the patient *"Übermittle keine Namen … Dritter"*. In this feature the patient does not compose the input; a practice letter routinely contains third-party names (referring physicians, signatories). | Third-party data inside the source document | **yes** — the advice does not fit the flow |
| §1 Verantwortlicher | Not analysed. Where a practice releases the document, the controller/processor relationship may differ from the B2C flow the notice describes. | — | **yes** — scope question for legal review |

```
LEGAL REVIEW REQUIRED
```

No legal basis is proposed here, and no wording is drafted. Publishing
un-reviewed privacy text to patients is a legal act, not a documentation edit.

---

## 7. Consent — re-audit, and a correction to Phase 3

### What Phase 3 said

> `ai_organizational_assistance` … describes **organisational** AI assistance.
> Transforming the full text of a medical letter is not that.

That was inferred from the type's name and its legacy-scope mapping. A direct
audit of the enforcement sites gives a more precise, and partly different,
picture.

### What the code actually does

| Finding | Evidence |
|---|---|
| `ai_organizational_assistance` **is** required for AI processing of a practice document — the `ai_vision` OCR engine | `documentOcrService.js:73-79` requires `document_sharing` **and** `ai_organizational_assistance` |
| …but that engine transmits nothing. It parses text locally with regular expressions. | `documentOcrEngineAdapter.js` — no `openai`, no `fetch`, no HTTP client anywhere in the file |
| `meda_live_translation_processing` is **declared but never enforced**. It exists in the catalogue and as a UI label only. | Whole-repo search: `consentTypes.js`, `practiceConsents.js` (de/en), and built bundles — no server enforcement site |
| **No service that actually calls OpenAI checks any consent type.** | Every file importing the OpenAI client — pre-visit, interpreter, document translation — has zero consent checks |

So the correction is this: the existing consent is not merely "about something
else". It is used for a document-AI feature — but one where no data leaves the
server. There is no existing pattern in this codebase of consent-gating an
external AI call, and `meda_live_translation_processing` is an intention rather
than an implemented precedent.

That makes the question sharper, not softer: this feature would be the first
external AI processing of practice-released medical content, and there is no
established consent mechanism to inherit.

### Answers to the four questions

**1. Does an existing consent cover this use case?**
No. `ai_organizational_assistance` has only ever gated local processing.
`document_sharing` covers the practice sharing the document with the patient,
not onward transmission to a third party. `meda_live_translation_processing` is
not enforced anywhere and is scoped to the practice-side Meda feature.

**2. What technical consent scope would later be required?**
That is a product and legal decision, not a technical one. If a recorded
consent is required, the mechanism already exists — a new entry in
`CONSENT_TYPES` plus `assertConsentForLink`, exactly as `document_sharing` is
used today. Nothing needs to be built to make that possible. **Not implemented.**

**3. Must consent be checked before the request?**
If a consent model is adopted, then yes, and it belongs in the service before
the provider gate, alongside the provenance check — that is the only point
where the transformation can still be refused without anything having been
sent. Whether a recorded consent is required at all is B4.

**4. What patient-facing information would be required?**
Depends on B4. Candidates, listed as questions rather than answers: which
provider processes the content, in which region, what is transmitted (prepared,
masked text — not the file), that the original remains authoritative, and how to
proceed without using the feature. The UI already states the last two.

```
LEGAL/PRODUCT REVIEW REQUIRED
```

---

## 8. What MedScoutX stores — for erasure and access requests

Compiled from the code, 2026-08-15. Relevant to B6.

### Stored per transformation

| Data | Where | Notes |
|---|---|---|
| `AuditLog` row | database | one per transformation that reached the document — completed **or** refused. A request rejected on its shape alone (unsupported target language, invalid mode, feature off, a second concurrent run) writes **no** row: it never touched a document, an identity or a provider, so recording a patient and a timestamp for it would create personal data about a non-event. Boundary asserted in `verifyDocumentTranslationE2E.test.js`. |
| ├ `userId`, `patientUserId` | | links the row to the patient. Both are set: `userId` carries the deletion cascade, `patientUserId` carries the index an access request is answered from. |
| ├ `entityId` (documentId), `practiceProfileId` | | which document, which practice |
| ├ `metadata`: `fileId`, `mode`, `targetLanguage`, `outcome`, `segmentCount`, `attempts`, `promptVersion`, `providerKind`, `model`, `durationMs` | | metadata only |
| ├ `ipHash` | | hashed, not the address |
| └ `userAgent` | | stored as received |

**An audit row is therefore personal data**: it records that a specific patient
had a specific document transformed, at a specific time. It contains no document
text, no medication, no diagnosis and no model output.

### Not stored

| | |
|---|---|
| Document text | never — memory only, inside the parser worker |
| Masked segments sent to the provider | never |
| Provider response | never |
| Transformation result | never, server- or client-side (`no-store`, no browser storage) |
| Temporary files | none — no `writeFile`, no temp directory anywhere in the feature |
| Raw IP | never — hashed before it is written |

### Erasure behaviour

`AuditLog.user` is declared `onDelete: Cascade`, so deleting the user account
removes the audit rows with it. Whether audit records *should* be erased on
request, or retained under a legal-obligation basis, is exactly the question B6
puts to a review — the two answers point in opposite directions and code cannot
choose between them.

### Provider side

Unknown, and that is the point of A4, A7 and A8. What the provider retains —
request metadata, cached prompt prefixes, abuse-monitoring copies — is not
observable from here and is not covered by the fact that MedScoutX stores
nothing.

---

## 9. How to send evidence

**Safe to share in chat or as a file:**

- provider dashboard screenshots **with every secret blacked out** — project
  name/ID, region setting, retention setting, model list
- the DPA/AVV as a document, or the relevant clauses
- a written provider confirmation of residency or retention
- a legal opinion or DPIA document
- `Key exists for approved translation project: yes` — that sentence is the
  whole evidence needed for A11

**Never share, and never commit:**

- an API key, in full or in part, including a prefix or a length
- an unredacted dashboard screenshot
- any real patient document, letter, name, insurance number, diagnosis,
  medication or lab value
- database dumps or production logs

**What gets committed:** nothing but this register. Contracts and screenshots
stay outside git. A verified row records only:

```
Evidence checked on YYYY-MM-DD – stored externally
```

Reviewer entries stay role-based (`operator`, `legal counsel`). Names are not
needed for the technical purpose and are not collected.

---

## 10. Separation of the two approval dimensions

| Dimension | Phase | Status |
|---|---|---|
| Technical / medical safety | 2A–2D | complete — 712 server + 277 client tests |
| Privacy / legal / provider approval | 4A | **open** — this register |

A signed DPA says nothing about whether a transformation preserves a dosage.
712 passing tests say nothing about whether a contract exists. Neither
substitutes for the other, and a successful smoke test (Phase 4B) will prove
only that an API responds — not that retention is off, residency is active, or
a DPA is in force.

**Release rule: every mandatory row `VERIFIED`, or `NO-GO`.** There is no
majority, no "almost everything is in place", and no partial activation.

---

## 11. Companion documents

Prepared 2026-09-18. None of them decides anything; each exists so that a
decision, once taken, can be applied without further groundwork.

| Document | What it holds |
|---|---|
| [`DOCUMENT_TRANSLATION_LEGAL_SIGNOFF.md`](DOCUMENT_TRANSLATION_LEGAL_SIGNOFF.md) | **The one document a reviewer needs.** Facts in half a page, then 13 decision fields with checkboxes, conditions and a signature block. Everything else is an appendix |
| [`DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md`](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) | Ten decision blocks (question / technical reality / options / dependents), the B2 change matrix with drafted text blocks, both consent variants in full, the B1 change matrix split into always-required / legal-dependent / provider-dependent, the A1a one-pager, the A3–A13 provider matrix, the public-communication rule with its documented exceptions, and the B7 patient-information draft |
| [`DOCUMENT_TRANSLATION_DPIA_DRAFT.md`](DOCUMENT_TRANSLATION_DPIA_DRAFT.md) | Full DPIA draft. Risk assessment, residual risk and sign-off deliberately empty |
| [`DOCUMENT_TRANSLATION_DATA_SUBJECT_RIGHTS_RUNBOOK.md`](DOCUMENT_TRANSLATION_DATA_SUBJECT_RIGHTS_RUNBOOK.md) | What actually happens when a patient exercises a right, as a MedScoutX process rather than a list of articles |

[`DOCUMENT_TRANSLATION_LEGAL_REVIEW_PACKET.md`](DOCUMENT_TRANSLATION_LEGAL_REVIEW_PACKET.md)
remains the long-form statement of facts; the decision matrix is its compact
counterpart. Where both cover the same ground, the packet is the source.

---

## 12. Reclassification of A3–A13 — what actually needs the provider

Assessed 2026-09-18 against current **official provider documentation** only. No
third-party summaries were used where first-party documentation exists. Nothing
was configured, activated or purchased.

The previous shorthand — *"A3–A13 all need sales"* — was wrong. Of eleven rows,
**three close on documentation**, **four are our own account actions**, **two
genuinely need a provider decision**, and **two carry a legal component**.

### 12.1 Evidence type per row

| # | Requirement | Evidence source | Evidence type | Assessment | Status | Remaining gap |
|---|---|---|---|---|---|---|
| A3 | Data residency for the project | data-controls guide; residency announcement | public documentation **+** provider approval **+** contract | Path documented: per-project region at creation, abuse-monitoring approval, Modified Retention amendment | `OPEN – approval required` | Approval, amendment, and an EU-region project. Whether the existing project can change region: **UNKNOWN** |
| A4 | Zero data retention for the project | data-controls guide | public documentation **+** provider approval | Requires prior approval; afterwards self-serve in our console | `OPEN – approval required` | The approval itself |
| A5 | Endpoint available | API reference; data-controls guide | **public documentation** | Current, not deprecated, in scope for residency and ZDR | **`VERIFIED`** *(general)* | Reaching it in a region depends on A13/A3 |
| A6 | `response_format: json_schema` | Chat Completions API reference | **public documentation** | Parameter documented as enabling Structured Outputs | **`VERIFIED`** | Model-side support is A9/A10 |
| A7 | Endpoint compatible with ZDR | data-controls guide | **public documentation** | Endpoint is ZDR-eligible; `store` forced to `false` under ZDR | **`VERIFIED`** *(eligibility only)* | Our ZDR status = A4 |
| A8 | Caching behaviour understood | **Chat Completions API reference** (not the Responses-centric guide) | **public documentation** | Controls documented on our own endpoint: `prompt_cache_options` (`mode`, `ttl`), `prompt_cache_key`, deprecated `prompt_cache_retention`. `mode: "explicit"` without breakpoints = no caching. ZDR defaults retention to `in_memory` | **`VERIFIED`** *(conditional on model class)* | Requires `gpt-5.6`+ → depends on A9/A10. Whether default-on caching of medical text is acceptable stays legal |
| A9 | `MODEL_STRICT` available | our repository; model reference pages | **account evidence** | No model is named anywhere in this repository. Candidate selected: primary `gpt-5.6-terra`, fallback candidate `gpt-5.6-sol` (§7.4 of the decision matrix) | `OPEN – account evidence required` *(candidate selected)* | Availability in **our** project and region |
| A10 | `MODEL_PLAIN` available | as A9 | **account evidence** | as A9 | `OPEN – account evidence required` *(candidate selected)* | as A9 |
| A11 | Dedicated key exists | our account; production-best-practices guide | **account action** | Service-account keys documented; the code already refuses a reused generic key | **`READY FOR ACCOUNT ACTION`** | Create it. A key that exists but is not deployed activates nothing |
| A12 | Key project-scoped and rotatable | production-best-practices guide | **account action** | Expiry and rotation recommended; service-account key is not bound to a person | **`READY FOR ACCOUNT ACTION`** | Same sitting as A11 |
| A13 | Confirmed regional host | data-controls guide | **public documentation** *(host)* **+ account evidence** *(enablement)* | `eu.api.openai.com` documented as the Europe prefix, covering this endpoint | **`HOST = VERIFIED` · `PROJECT USE = BLOCKED BY A3`** | Our project being enabled for that region |

### 12.2 What this means operationally

| CAN CLOSE NOW *(closed above)* |
|---|
| **A5** — endpoint current, documented, in scope for residency and ZDR |
| **A6** — `json_schema` structured output documented on this endpoint |
| **A7** — endpoint is ZDR-eligible; `store` is forced to `false` under ZDR |
| **A8** — caching documented **and controllable** on our endpoint, conditional on choosing `gpt-5.6`+ *(the legal read is separate)* |

| ACCOUNT ACTION NEEDED — executable by us, no provider decision |
|---|
| **A11 / A12** — `READY FOR ACCOUNT ACTION`: dedicated service-account key for the translation project, project-scoped, minimal scopes, expiry set, rotation rule written down. Executable today; deploying it is a separate act |
| **A9 / A10** — candidates chosen (`gpt-5.6-terra` primary, `gpt-5.6-sol` fallback); confirm availability in the chosen project and region |
| **A13** *(partly)* — record the host once the project's region is settled |

| PROVIDER APPROVAL NEEDED — genuinely a third-party decision |
|---|
| **A3** — abuse-monitoring approval for a non-US region |
| **A4** — zero-data-retention approval |

| LEGAL DECISION NEEDED |
|---|
| **A3** *(partly)* — the **Modified Retention amendment** is a contract act, and it belongs next to A1a rather than being treated as paperwork |
| **A8** *(partly)* — is caching of medical document text acceptable? It **can** be switched off on our endpoint, so this is now a choice to make rather than a constraint to accept |
| **A1a** — unchanged: `LEGAL REVIEW REQUIRED`. Neither provider capability nor ZDR answers whether our contract covers deliberate processing of health data |

### 12.3 What did not change

- **No** provider was configured, activated, contacted or paid.
- **No** code, flag, key, host or model was changed. `APPROVED_PROVIDER_HOSTS`
  is still empty and both feature flags are still off.
- **A3 and A4 remain open (`OPEN – approval required`).** Documentation of a *path* is not an approval,
  and a documented regional host is not our project being in that region.
- **`NO-GO FOR PRODUCTION ACTIVATION`** stands.

### 12.4 Sources

Official provider documentation, retrieved 2026-09-18:

- [Data controls in the OpenAI platform](https://developers.openai.com/api/docs/guides/your-data) — retention, ZDR eligibility and behaviour, data-residency configuration and regional domain prefixes, caching as application state
- [Chat Completions API reference](https://developers.openai.com/api/docs/api-reference/chat/create) — endpoint status, `response_format` incl. `json_schema`
- [Prompt caching guide](https://developers.openai.com/api/docs/guides/prompt-caching) — default-on behaviour, what is cached, lifetimes, isolation, `in_memory` default under ZDR
- [Models](https://developers.openai.com/api/docs/models) and [Compare models](https://developers.openai.com/api/docs/models/compare) — endpoint support, structured outputs, context windows, pricing

**One correction to record.** The first pass on A8 read the caching *guide*,
which is written around the Responses API, and concluded that no opt-out was
documented. The API reference for `/v1/chat/completions` documents the controls
directly. The corrected row is in §2; the earlier reading is not preserved,
because it was simply wrong about our endpoint.
- [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) — model floor for `response_format: json_schema`
- [Production best practices](https://developers.openai.com/api/docs/guides/production-best-practices) — key types, scoping, expiry and rotation
- [Introducing data residency in Europe](https://openai.com/index/introducing-data-residency-in-europe/) and [Data residency for the OpenAI API](https://help.openai.com/en/articles/10503543-data-residency-for-the-openai-api) — regional availability *(referenced; the data-controls guide is the first-party source used for every statement above)*

---

### 12.5 Combined A3/A4 provider request — prepared 2026-09-18

Re-checked against the data-controls guide the same day. Relevant, and
unchanged from §12.1: non-US residency requires approval for abuse-monitoring
controls (Zero Data Retention **or** Modified Abuse Monitoring) **and** an
executed Modified Retention amendment; the region is chosen from a dropdown
**when a project is created**; ZDR and residency are **separate** controls;
`/v1/chat/completions` is listed for both. The documentation names one channel:
the sales team, via <https://openai.com/contact-sales>.

**Status of this request: prepared, not yet submitted.** Submission is the
operator's act. Two fields are filled in at submission and deliberately not
recorded here: the organization ID and the reply address.

> **Subject:** Zero Data Retention and Europe Data Residency — healthcare use case (Germany)
>
> Hello,
>
> We operate MedScoutX, healthcare software based in Germany. We are requesting
> Zero Data Retention and Europe Data Residency for our API organization. We sent
> a similar request on 2026-08-17; it was acknowledged but not answered, so this
> message restates it in full.
>
> **Use case.** A patient can have a medical document that their doctor's practice
> has released to them translated into another language or rewritten in plain
> language. It runs only when the patient starts it. Before any request, our
> servers replace known personal identifiers, medications, dosages and measured
> values with placeholders, and send text segments only — never files and never
> our internal identifiers. We call `/v1/chat/completions` with Structured Outputs
> (`response_format: json_schema`); no tools, no file uploads, no conversation
> state, and `store` is not set. The content is special-category health data under
> Art. 9 GDPR and is processed deliberately. Masking reduces identifiers; it does
> not anonymise the text.
>
> **Current status.** We have an executed Data Processing Addendum with OpenAI
> (version v.010126, signed 2026-08-16). A dedicated API project for this feature
> already exists in our organization. The feature is built but switched off: no
> document content has been sent to OpenAI, and none will be until these points
> are approved and our own legal review is complete.
>
> **We are asking for:**
> 1. Zero Data Retention approval for our organization, applied to the dedicated project.
> 2. Eligibility for Europe Data Residency, including approval of the required
>    abuse monitoring controls and the Modified Retention amendment.
> 3. Confirmation that `/v1/chat/completions` with Structured Outputs is supported
>    for our project under both Zero Data Retention and Europe Data Residency.
> 4. The exact next steps to set up the Europe-region project — in particular,
>    whether our existing project can be moved to the Europe region or a new
>    project must be created.
>
> Please tell us which documents or details you need from us.
>
> Organization ID: `[add at submission]`
>
> Kind regards,
> Himan Khorshidi — MedScoutX
> `[reply address, add at submission]`

**Evidence expected back** — each recorded here only as *"Evidence checked on
YYYY-MM-DD – stored externally"*:

| For | Evidence |
|---|---|
| A4 | written ZDR approval; console view of *Settings → Organization → Data controls* showing ZDR active for the organization or the project, identifiers blacked out |
| A3 | written approval of abuse-monitoring controls for our organization; the **executed** Modified Retention amendment; console view of the project showing region *Europe*, identifiers blacked out |
| A3/A4 | the provider's answer on moving the existing project vs. creating a new one |
| A5–A7 (confirmation) | the provider's statement that `/v1/chat/completions` with Structured Outputs works for our project under both controls |
| A13 (follows) | once A3 holds: the project answers on `eu.api.openai.com` — then, and only then, the reviewed one-line commit to `APPROVED_PROVIDER_HOSTS` |

Silence is still not evidence. An automated acknowledgement confirms receipt,
not approval.

---

*Gate document: [`DOCUMENT_TRANSLATION_ACTIVATION_CHECKLIST.md`](DOCUMENT_TRANSLATION_ACTIVATION_CHECKLIST.md)*
