# Document Translation — Technical Debt & Residual Risk

Status as of Phase 2A.1 (adversarial audit). Each item has a stable id so it can
be referenced from code comments and from later phase reports.

None of these blocks the translation implementation. The one item that *does*
block Phase 2B is not debt — it is the open data-protection question, recorded
at the bottom.

---

## `i18n_single_source_deployment_constraint`

**What.** `shared/i18n/localeConfig.js` is the canonical locale registry. The
server imports it directly. The client keeps a mirrored copy at
`client/src/i18n/localeConfig.js` instead of importing it.

**Why.** The frontend deploys with `client/` as the Vercel root directory (see
`client/vercel.json`), so a repository-root path is outside the client build
context. Making the client import the shared module would require changing the
deploy Root Directory setting, which lives outside the repository and cannot be
verified from here. Getting it wrong breaks the production frontend build.

**Current mitigation.** `server/scripts/verifyLocaleSourceOfTruth.test.js`
compares both files and fails on any divergence in the locale data. Drift is
caught by test rather than prevented by the module graph.

**Resolution when someone owns the deploy config.**

1. Set the Vercel Root Directory to the repository root, with build command
   `npm run client:build` and output directory `client/dist`.
2. Replace the locale data in `client/src/i18n/localeConfig.js` with a re-export
   from `shared/i18n/localeConfig.js`, keeping `LANGUAGE_STORAGE_KEY` and
   `resolveInitialLanguage` client-side.
3. The drift test then becomes trivially true and can be reduced to an identity
   assertion.

**Risk while open.** Low. The failure mode is a test failure, not a runtime
fault.

---

## `document_translation_pdf_font_licensing`

**What.** `client/public/previsit-pdf-tahoma.ttf` and its bold variant are
already embedded into generated PDFs by the Pre-Visit export, and their glyph
coverage was verified to include Cyrillic, so they would technically satisfy all
six shipped UI languages for a translation export.

**Why this is not simply reused.** Tahoma is a proprietary Microsoft typeface.
Whether the licence permits embedding and redistribution in this product cannot
be established from the repository. The existing Pre-Visit usage is a
pre-existing situation, not a precedent that clears the licence.

**Decision for Phase 2B/2C.** Do not reuse the Tahoma files for the translation
export. Prefer a font with an unambiguous redistribution licence and full
Latin + Cyrillic coverage — for example an SIL Open Font Licence family. No font
has been downloaded or added; this is a decision to be taken when the export UI
is actually built.

**Risk while open.** None today — no PDF export exists for this feature yet.

---

## ~~`document_translation_parser_isolation`~~ — CLOSED in Phase 2A.2

**Was.** `unpdf`/pdf.js and `mammoth` ran in the main Node process, bounded only
by byte-level preflights and an in-process `Promise.race` timeout. That timeout
depended on the parser yielding; a synchronous hot loop would have blocked the
event loop and the timer with it. Memory was not bounded at all.

**Now.** `extraction/isolatedParser.js` runs every parse in a `worker_threads`
worker with `resourceLimits` (256 MB old generation, 32 MB young, 4 MB stack)
and a wall-clock deadline enforced by `terminate()`. Byte-level preflight still
runs in the host first, so an obvious bomb is rejected without a thread spawn.

Proven by test against a deliberately hostile worker
(`scripts/lib/hostileParserWorkerFixture.js`):

- a synchronous infinite loop is terminated at the deadline;
- the main event loop keeps ticking while it runs;
- a runaway allocation trips `ERR_WORKER_OUT_OF_MEMORY` and surfaces as
  `document_too_large` / `parse_out_of_memory`.

**Residual risk.** A parse still costs a thread and up to the configured heap
for its duration; concurrency limiting belongs with the Phase 2B route, not
here. Worker startup adds roughly 40–80 ms per document.

---

## `document_translation_medication_refusal_rate` — new in Phase 2A.2

**What.** A medication context whose product name cannot be protected locally
now refuses the whole document (`document_medication_unverifiable`) instead of
translating it. This closes the Phase 2A.1 known limits (`Quensyl → Resochin`,
`warfarin → heparin`) the only way that is honest without a drug database.

Phase 2A.3 extended the same principle to written-out dosages: a recognised one
("fünf Milligramm", "eine halbe Tablette") is masked atomically, and a dosage
unit whose quantity is *not* recognised refuses the document with
`document_dosage_unverifiable`. A separate code rather than reusing the
medication one — the cause and the message to the reader differ, and this error
vocabulary is already granular.

**The cost.** Some legitimate letters will be refused — for instance one naming
an unusual preparation without a strength. The safe-word list in
`medicationContextGuard.js` (grammar, dosage forms, frequencies, routes, drug
classes) keeps that proportionate, but the direction is deliberate: a refused
document leaves the patient with the unaltered original, whereas a silently
renamed medication reads as authoritative.

**What would reduce it.** A licensed substance index (e.g. an ATC or national
medicinal-product list) would let the guard recognise rather than refuse. That
is a procurement and licensing decision, not a code change, and no such data is
bundled here.

**Open question for the product owner.** Whether the refusal rate on real
practice documents is acceptable can only be answered by measuring it against a
real corpus. Until then the rate is unknown, and it is not claimed to be low.

---

## `document_translation_lab_excluded`

**What.** `lab` was removed from the V1 translation allowlist in Phase 2A.1.

**Why.** A lab result's meaning lives in its table structure. A PDF text layer
cannot prove a value still belongs to its parameter, DOCX lab reports are not a
relevant mainstream case, and the plain-language need is already served by
`services/practiceDocument/labPatientExplanationService.js`.

The structure-critical machinery in `documentTranslationPolicy.js`
(`STRUCTURE_CRITICAL_TYPES`) is kept even though it is currently unreachable: it
is the precondition that must hold before `lab` may ever be re-admitted.

**Risk while open.** None. This is a deliberate scope reduction.

---

## `document_translation_source_language_scope` — new in Phase 2A.3

**What.** V1 processes German source documents only
(`SUPPORTED_DOCUMENT_SOURCE_LANGUAGES = ["de"]`). Six UI **target** languages
does not imply six **source** languages.

**Why.** Nearly every content protection is language-specific: the
medication-context triggers ("Gabe von", "nimmt", "Therapie mit"), the
safe-word list, the written-out dosage vocabulary, the negation cues and the
section headings. Over a French or Russian letter none of them fire — no
medication context is recognised, so nothing is refused, and a document nobody
actually checked would look like one that passed.

**How the language is established.** It is **declared by the caller**, never
inferred. `PracticeDocument` has no language field; `DocumentOcrJob.locale` is
the locale a practice *requested* for an OCR run and `DocumentOcrResult.language`
is the stub engine echoing that request, so neither is an observation about the
document. `PracticeProfile.preferredDoctorLanguage` is a practice preference,
and treating it as "this document is German" would be exactly the assumption
that must not be made.

A deterministic contradiction check runs on top: non-Latin script, or another
language's function words with none of German's, produce
`document_source_language_uncertain`. It can only ever contradict a
declaration, never confirm one — silence means "no evidence against", not
"verified German". No model, no probabilistic classifier.

**To widen it.** Porting the trigger phrases, safe words, dosage vocabulary and
negation cues to the new language *and* testing them adversarially. Adding a
code to the array is not sufficient and must not be done alone.

---

## `document_translation_pii_is_minimisation_not_anonymisation` — new in Phase 2A.3

**What.** The patient's own known identifiers — name forms, date of birth,
email, phone, insurance and patient number — are masked before anything could
be transmitted, using values the database already asserts about *this* patient.
No entity recognition, no model. Other people in the letter (treating
physicians, relatives, contacts) are deliberately **not** masked.

**The statement that must accompany it:**

> PII masking reduces transmitted identifiers but does not constitute
> anonymization.

A letter can remain re-identifiable through a rare diagnosis, a named clinic, a
procedure date, or the combination of all three. Nothing in this feature may be
described as anonymised or pseudonymised output, and no compliance conclusion
follows from the masking alone.

---

## Not debt — the open blocker for Phase 2B

`BLOCKER – organisatorisch/rechtlich außerhalb des Repository zu klären.`

Transmitting the full text of a medical document to an external AI provider.
The OpenAI client sets no `baseURL` (US endpoint), and neither EU data residency
nor zero-data-retention is configured or evidenced anywhere in this repository;
`docs/legal/README.md` states no signed AVV exists. This is a category beyond
what existing AI features send (metadata, lab rows).

Phase 2A and 2A.1 are deliberately built so this blocker holds nothing up:
authorization, extraction, segmentation, masking and integrity validation are
complete and proven by tests before any document content could leave the server.
