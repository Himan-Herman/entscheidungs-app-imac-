# Document translation — evidence register (Phase 4A)

> **Working document for verifying external approvals.** It records which
> evidence has been produced, what it establishes, and what is still missing.
> It is not legal advice and it does not itself approve anything.
>
> **Contains no patient data, no secrets, no API keys, and no screenshots.**
> Contracts and account screenshots stay outside the repository; only the fact
> that they were checked is recorded here.

**Go/No-Go status: `NO-GO FOR PRODUCTION ACTIVATION`**
Baseline commit: `545444ea` · Phase 2A–2D frozen · both feature flags off
Last evidence assessed: A2, 2026-08-17 · `VERIFIED` 2 / 21

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
| A1a | Contractual scope covers **medical document content** | **`LEGAL REVIEW REQUIRED`** | Same document. Schedule 1 §5 reads *"No sensitive data is intended to be transferred unless the user includes it unexpectedly in unstructured data."* No occurrence of special categories, health, Article 9, HIPAA, prohibited or restricted data anywhere in the contract. | 2026-08-17 | no | operator | Our use case transfers health data **deliberately and systematically**. Classified `not determinable from the DPA`. Feeds into B4. **A1 being verified does not resolve this.** |
| A2 | Dedicated provider project for document translation | **`VERIFIED – account/project evidence`** | Provider console screenshots: a dedicated project named "MedScoutX Document Translation" exists, and it belongs to the same provider organization as the executed DPA. Match performed 2026-08-17. Evidence checked on 2026-08-17 – source stored externally. | 2026-08-17 | no | operator | Identifiers deliberately not recorded here. Separation from the key behind `OPENAI_API_KEY` is **not** established by this row — that is A11/A12. |
| A3 | Data residency confirmed **for that project** | `OPEN` | OpenAI Sales request submitted and acknowledged on 2026-08-17; provider response pending. | — | partial | — | `DATA_REGION` records an assertion only |
| A4 | Zero data retention confirmed **for that project** | `OPEN` | OpenAI Sales request submitted and acknowledged on 2026-08-17; provider response pending. | — | partial | — | `ZERO_RETENTION` records an assertion only |
| A5 | Endpoint `/v1/chat/completions` available on the approved regional endpoint | `OPEN` | — | — | partial | — | Adapter uses this path; see §3 |
| A6 | That endpoint supports `response_format: json_schema` as used | `OPEN` | — | — | partial | — | Structured output is load-bearing, not cosmetic |
| A7 | Endpoint compatible with the agreed retention/ZDR configuration | `OPEN` | — | — | no | — | Separate question from A4 |
| A8 | Prompt/response caching behaviour of that endpoint understood | `OPEN` | — | — | no | — | Phase 3 marked this explicitly unverified; see §4 |
| A9 | `MODEL_STRICT` available in the approved project and region | `OPEN` | — | — | no | — | No silent fallback exists; unavailable ⇒ feature stays off |
| A10 | `MODEL_PLAIN` available in the approved project and region | `OPEN` | — | — | no | — | Unavailable ⇒ deliberate decision required, not a fallback |
| A11 | Dedicated API key exists for the approved project | `OPEN` | — | — | yes (existence only) | — | Never sent in chat or committed; `yes/no` is sufficient |
| A12 | Key scoped to that project only, rotatable | `OPEN` | — | — | no | — | Provider dashboard question |
| A13 | Confirmed regional host, to be added to `APPROVED_PROVIDER_HOSTS` | `OPEN` | — | — | yes (enforced) | — | Code change deferred to Phase 4B; see §5 |

### Block B — data protection and product

| # | Requirement | Status | Evidence description | Date | Repo? | Reviewer | Notes |
|---|---|---|---|---|---|---|---|
| B1 | Privacy notice covers this processing | `CONFLICT` | Live notice analysed from the repository, 2026-08-15 | 2026-08-15 | partial | operator | Names OpenAI **USA** for the patient's *own* inputs; see §6 |
| B2 | Provider listed as subprocessor **for this processing** | `OPEN` | — | — | no | — | Billing-pilot entry does not cover it; scope note added in Phase 3 |
| B3 | Consent model decided for this use case | `OPEN` | Consent architecture re-audited, 2026-08-15 | 2026-08-15 | partial | operator | No covering consent exists; see §7 — corrects a Phase 3 statement |
| B4 | Legal basis determined and documented | `OPEN` | — | — | no | — | `LEGAL REVIEW REQUIRED`; not to be asserted from code |
| B5 | DPIA/DSFA necessity assessed for this processing | `OPEN` | — | — | no | — | No assessment found in the repository |
| B6 | Erasure/access request handling reviewed for this flow | `OPEN` | Data inventory compiled, 2026-08-15 | 2026-08-15 | partial | operator | Inventory in §8; the process decision is external |
| B7 | Patient-facing information decided (what is shown before the first run) | `OPEN` | — | — | partial | — | Depends on B3/B4 |

**Two of 21 rows are `VERIFIED`: A1 and A2.** Three further rows carry
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
| `AuditLog` row | database | one per transformation, success and failure |
| ├ `userId`, `patientUserId` | | links the row to the patient |
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

*Gate document: [`DOCUMENT_TRANSLATION_ACTIVATION_CHECKLIST.md`](DOCUMENT_TRANSLATION_ACTIVATION_CHECKLIST.md)*
