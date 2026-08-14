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

## `document_translation_parser_isolation`

**What.** `unpdf`/pdf.js and `mammoth` run in the main Node process. Byte-level
preflights (`pdfPreflight.js`, `zipPreflight.js`) reject the obvious resource
exhaustion shapes before parsing, and a wall-clock timeout bounds the common
slow case.

**Residual risk, stated plainly.** A preflight reads declared structure; a
crafted file can still be expensive in ways the declaration does not reveal.
The timeout depends on the parser yielding to the event loop — a synchronous hot
loop inside pdf.js would block the timer along with everything else. Memory is
not bounded at all.

**Proper fix.** Run extraction in a `worker_threads` worker with
`resourceLimits.maxOldGenerationSizeMb` and terminate it on breach. This gives
real memory bounding and a kill switch that does not depend on cooperation.

**Why it is deferred.** There is no route yet, so the isolation would be
speculative, and it changes the deployment shape (worker bundling, message
passing, buffer transfer). It should be built together with the Phase 2B
endpoint, before the feature is reachable by a real user.

**Risk while open.** Moderate, but currently unreachable: no route exposes the
extraction path, and `ENABLE_DOCUMENT_TRANSLATION` defaults to false.

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
