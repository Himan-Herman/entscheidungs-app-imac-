# Medical Interpreter — Phase 6.6 International Rollout & Multilingual Governance (Planning Only)

**Status:** Planning document. No implementation in Phase 6.6.  
**Builds on:** [PHASE_6_1_ECOSYSTEM_PLAN.md](./PHASE_6_1_ECOSYSTEM_PLAN.md) through [PHASE_6_5_OBSERVABILITY_OPS_PLAN.md](./PHASE_6_5_OBSERVABILITY_OPS_PLAN.md)  
**Scope:** Global deployability — languages, RTL, typography, translation quality governance, cultural safety, accessibility, regional ops, and privacy — without changing B2C/B2B behaviour and without clinical decision support.

---

## Core principle (non-negotiable)

The Medical Interpreter platform must become:

- **globally deployable** — org-gated rollout, not chaotic global enable  
- **multilingual by design** — conversation languages ≠ UI locale bundles  
- **culturally safe** — calm healthcare tone, no Western-only metaphors  
- **RTL-safe** — layout, content, PDF, and assistive tech  
- **accessibility-first** — elderly, low vision, hearing, low digital literacy  
- **medically calm** — communication assistance only  
- **privacy-first** — no transcript analytics by language  

It must **not** become a medical-decision, diagnostic, or triage system.

---

## Executive summary

The repo already has **strong multilingual foundations** for interpreter *conversation* languages (22 codes aligned client/server), **Phase 2.6 RTL** (`interpreterMultilingual.css`, `InterpreterMultilingualText`, per-field `dir`/`lang`, mixed-direction notes), **server terminology heuristics** (anchors, negation, uncertainty), and **DE/EN-complete UI copy** for the interpreter module.

**Gaps:** Full `medicalInterpreter` UI namespaces exist only in **de/en**; other UI locales rely on global overrides with **en → de key fallback** — interpreter strings often appear in English/German when UI is set to Arabic, etc. Header language picker remains **de/en selectable** only. PDF uses jsPDF with RTL **limitation notices**, not full bidirectional layout. TTS does not vary voice by language code on server (`language` param ignored). No formal localization CI or glossary database.

Phase 6.6 plans Tier 1/2 rollout, RTL hardening, typography, quality governance, cultural UX, international a11y, infrastructure, compliance, ops support, cost routing, risks, and subphases **6.6.1–6.6.7**.

---

## Section 1 — Current internationalization review

### 1.1 Current i18n architecture

| Layer | Implementation |
|-------|----------------|
| **Registry** | `client/src/i18n/localeConfig.js` — `LOCALE_OPTIONS`, `RTL_LANGUAGE_CODES`, `resolveInitialLanguage` |
| **Runtime** | `LanguageProvider` — sets `document.documentElement.lang` + `dir`; persists `medscout_language` |
| **Messages** | `getMessages(lang)` in `translations/index.js` — per-locale bundle + **key-level fallback: selected → en → de** |
| **Deep merge** | `deepMerge` + `mergeFallbackMessages` |
| **Overrides** | `translations/overrides/{ar,fa,tr,...}.js` — app-wide modules (account, practice, preVisit, etc.) |
| **Interpreter namespaces** | `medicalInterpreter`, `medicalInterpreterPractice` imported in **de/index.js** and **en/index.js** only |
| **API** | `GET /api/i18n/locales` returns `activeLocales: ["de", "en"]` — metadata only; bundles client-shipped |

### 1.2 Current language namespaces

| Namespace | Locales with dedicated files |
|-----------|------------------------------|
| `medicalInterpreter` | **de**, **en** (full) |
| `medicalInterpreterPractice` | **de**, **en** (full) |
| Other app namespaces | Many locales via overrides |

*Needs repo verification:* whether any override layer partially defines `medicalInterpreter` keys (grep found **none** in `overrides/ar.js`).

### 1.3 DE/EN implementation quality

| Aspect | Assessment |
|--------|------------|
| Coverage | Primary product copy complete in both files (~500+ keys each) |
| Safety copy | Communication-only; privacy; no diagnosis/triage wording (QA doc) |
| Parity | Intended 1:1 key structure between de/en |
| Practice B2B | Separate `medicalInterpreterPractice` bundle |

**Gap:** Tier-1 conversation languages (AR, TR, FA) do **not** have matching UI bundles.

### 1.4 Current RTL support

| Area | State |
|------|-------|
| **UI chrome** | `html[dir=rtl]` when UI language ∈ `RTL_LANGUAGE_CODES` (ar, fa, ckb, he, ur) |
| **Conversation content** | `interpreterTextDirection(lang)` per field; `InterpreterMultilingualText` |
| **Mixed LTR/RTL session** | `sessionIsMixedDirection` + user-visible notes (live + review) |
| **CSS** | Logical properties (`border-inline-start`, `padding-inline-start`); selective `flex-direction: row-reverse` |
| **Kurdish Kurmancî (ku)** | Explicitly **LTR** (Latin script) in `localeConfig` comment |
| **Setup** | Language `<option dir=rtl>` for RTL codes |

Documented QA: [INTERNATIONALIZATION_QA.md](./INTERNATIONALIZATION_QA.md).

### 1.5 Multilingual typography handling

| Item | State |
|------|-------|
| Font strategy | System stacks in `interpreterMultilingual.css` — **no embedded font files** |
| Arabic stack | `"Noto Naskh Arabic"` as preference if installed on device |
| Mixed script | `unicode-bidi: plaintext` on textarea; `isolate` on blocks |
| Mobile | `overflow-wrap: anywhere`; min 44px touch targets on filter input |

### 1.6 PDF multilingual handling

| Item | State |
|------|-------|
| Engine | Client-side `jsPDF` — data never leaves device |
| RTL detection | `sessionUsesRtlScripts`, char-range heuristics |
| Layout | Primarily LTR engine; inserts **RTL limitation notice** paragraphs from `L.pdf.rtlFontNotice` |
| Mixed script | Separate notice when `hasMixedScriptText` |
| Font embedding | *needs repo verification* — likely Helvetica default; Arabic shaping limited |

### 1.7 TTS / STT language handling

| Capability | Behaviour |
|------------|-----------|
| **STT** | Whisper `language` hint from `normalizeTranscribeLanguageHint` — maps session language codes |
| **Supported codes** | `INTERPRETER_SUPPORTED_LANGUAGE_CODES` (server) = `INTERPRETER_SETUP_LANGUAGE_CODES` (client) — 22 codes |
| **TTS** | OpenAI speech; `params.language` **voided** in `interpreterSpeakService.js` — voice from `voicePreference` only |
| **Locales not in Whisper** | *needs repo verification* per-code STT quality (ckb, ku, sq, etc.) |

### 1.8 Translation architecture (AI)

| Item | State |
|------|-------|
| Model | `gpt-4o-mini` default; single-turn, no history |
| Prompts | `interpreterPrompt.js` — communication-only guardrails |
| Quality | `interpreterTerminology.js` — anchors, negation heuristics (en, de, fr, es, it, ru, ar, tr + default) |
| Uncertainty | `[UNCERTAIN]` prefix strip; `uncertain`, `terminologyWarning`, `unclearSource` flags to client |
| Near-realtime | Smaller char cap (600) — same pipeline |

**Not** a substitute for human interpreter; documented in UX.

### 1.9 Locale fallback behaviour

| Context | Fallback chain |
|---------|----------------|
| UI messages | `getMessages`: locale bundle → **en** → **de** per missing key |
| Initial UI lang | stored → browser prefix → **en** |
| Header picker | Only **de, en** selectable; others visible but disabled |
| API errors | `resolveApiErrorMessage` uses language + en apiErrors |
| Conversation lang labels | `Intl.DisplayNames` + native names from `LOCALE_OPTIONS` |

### 1.10 Localization workflow

| Item | State |
|------|-------|
| Translator workflow | **No** TMS integration verified (Phrase, Lokalise, etc.) |
| QA | Manual [INTERNATIONALIZATION_QA.md](./INTERNATIONALIZATION_QA.md) checklist |
| CI | Build + eslint on medicalInterpreter paths |
| Org allowlist | Planned in 6.1/6.2 — **not** implemented |

---

## Section 2 — Global language strategy

### 2.1 Tier definitions

| Tier | Languages | Role |
|------|-----------|------|
| **Tier 1 (launch)** | de, en, ar, tr, fa, ku, ckb, es, fr | High migration/clinic demand; STT/TTS viability |
| **Tier 2 (expansion)** | ru, uk, it, pl, el, bs, hr, sr, ro, nl, pt, sq | Community + EU neighbourhood |
| **Tier 3 (later)** | he, ur, … + regional dialects | Policy + provider quality dependent |

*Note:* **ku** (Kurmancî) = LTR; **ckb** (Sorani) = RTL — both Tier 1 for Kurdish communities.

### 2.2 Rollout criteria (must meet ≥4 of 6)

1. **UI bundle** ≥95% keys for `medicalInterpreter` + practice namespace  
2. **RTL QA** passed (if RTL script)  
3. **STT smoke** acceptable on scripted non-medical phrase  
4. **Translate QA** negation + number preservation spot-check (20 cases)  
5. **Legal/privacy** consent strings reviewed in locale  
6. **Pilot partner** or community reviewer sign-off  

### 2.3 Healthcare & migration relevance (planning)

| Language | Relevance |
|----------|-----------|
| de | Host country (DACH) |
| en | International patients, clinicians |
| ar, fa, tr, ckb, ku | Large migration communities in DE/EU |
| ru, uk | Recent displacement populations |
| es, fr, it | EU labour mobility |

### 2.4 Operational complexity scoring

| Factor | Low | High |
|--------|-----|------|
| RTL layout | en, de | ar, fa, ckb |
| UI bundle effort | en (done) | ar, fa (full new file) |
| STT | en, de | dialect-heavy oral varieties |
| PDF | Latin only | Arabic shaping |
| Support | en/de | multilingual desk |

### 2.5 Dialect strategy

| Policy | Rule |
|--------|------|
| **UI locale** | Standard national/code (ar, fa, tr) — no ar-SY vs ar-EG split in MVP |
| **Conversation** | User selects parent code; optional note “regional variety may vary” |
| **STT** | Whisper language hint = parent code; document accuracy limits |
| **Future** | Org-level `preferredVariant` metadata — not content inference |

### 2.6 Low-resource language strategy

- Do **not** auto-enable Tier 3 globally.  
- Require **org allowlist** + capped pilot quota (6.4).  
- Show **honest capability banner** when STT/translate confidence historically low.  
- Never fabricate missing translation — show uncertainty UI instead.

### 2.7 Rollout mechanism (governance)

```text
Global master flag
  └── OrganizationPolicy.allowedConversationLanguages[]
  └── OrganizationPolicy.allowedUiLocales[]
  └── Optional: practice subset
```

Default production: Tier 1 conversation languages on; Tier 1 UI locales gated per pilot.

---

## Section 3 — RTL architecture

### 3.1 Direction model (three layers)

| Layer | Control |
|-------|---------|
| **UI shell** | `html[dir]` from UI locale (`LanguageProvider`) |
| **Conversation field** | `dir` + `lang` per `patientLanguage` / `doctorLanguage` / turn |
| **PDF** | Detect RTL scripts; notices + best-effort rendering |

**Rule:** UI RTL must not force transcript RTL when editing LTR doctor language block (per-field dir already — harden in 6.6.1).

### 3.2 Layout mirroring

| Component | Strategy |
|-----------|----------|
| Navigation / back | Logical `margin-inline`, `inset-inline` |
| Dialog actions | `row-reverse` under `[dir=rtl]` — verify focus order |
| History cards | Head row reverse — tested in QA |
| Icons with direction | Use logical transforms or mirror only chevrons — **not** universal icons (⚠️ medical neutrality) |

### 3.3 Mixed LTR/RTL sessions

| Scenario | UX |
|----------|-----|
| AR patient ↔ EN doctor | Mixed-direction note; patient block `dir=rtl`, translation `dir=ltr` |
| Numbers in Arabic text | `unicode-bidi: plaintext` |
| Timestamps | Always LTR isolate `\u2066...\u2069` or dedicated `dir=ltr` span on ISO timestamps |

### 3.4 Punctuation & wrapping

- Strip dangerous bidi control chars on PDF export (already in `sanitizePdfText`).  
- Avoid forcing `text-align: right` globally — use `text-align: start`.  

### 3.5 PDF RTL (target state — 6.6.2+)

| MVP (today) | Target |
|-------------|--------|
| Notice + LTR engine | Optional `@napi-rs/canvas` or pdf-lib with embedded Noto Naskh **subset** OR export HTML-print RTL |
| Mixed-script notice | Per-turn `dir` metadata in PDF JSON export (6.3) before print |

### 3.6 Keyboard & screen reader

| Check | Requirement |
|-------|-------------|
| Tab order | Dialog actions visual order = focus order in RTL |
| `lang` | Set on each `InterpreterMultilingualText` |
| Live regions | `aria-live="polite"` for translation updates — language tag matches content |
| Screen reader | Test VoiceOver (iOS) + NVDA with AR UI |

### 3.7 CSS architecture (consolidate)

- Single import: `interpreterMultilingual.css` + `MedicalInterpreter.css` logical tokens.  
- Document **no** physical `margin-left` in new interpreter CSS.  
- Component constraint: prefer `InterpreterMultilingualText` wrapper for user-generated strings.

### 3.8 Testing strategy

- Automated: snapshot RTL layout smoke *needs repo verification* (Playwright).  
- Manual: [INTERNATIONALIZATION_QA.md](./INTERNATIONALIZATION_QA.md) expanded per locale.  
- Visual: AR, FA, ckb sessions on 320px width.

---

## Section 4 — Multilingual typography

### 4.1 Design goals

- Readable for **elderly** (base 16px, line-height ≥1.5 on prose).  
- **No giant font payloads** — system + optional one subset per script if PDF requires.  
- Stable **mixed-script** without clipping.

### 4.2 Font fallback chains (planned standard)

| Script | Stack |
|--------|-------|
| **Latin** | `system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif` |
| **Arabic** | `"Noto Naskh Arabic", "Geeza Pro", "Segoe UI", Tahoma, Arial, sans-serif` |
| **Cyrillic** | `system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| **Greek** | `system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif` |
| **CJK (future)** | `system-ui, "PingFang SC", "Hiragino Sans", "Microsoft YaHei", sans-serif` |

Apply via `[lang="ar"]` selector on conversation blocks, not only `html[dir]`.

### 4.3 Mobile & low vision

- Respect `prefers-reduced-motion` (existing patterns — extend to interpreter animations).  
- Support browser text scaling to 200% without horizontal scroll on setup.  
- Minimum 44×44px controls (PTT, playback).  

### 4.4 PDF font strategy

| Option | Tradeoff |
|--------|----------|
| A — Latin-only PDF + RTL notice | Current; honest limitation |
| B — Embed Noto Naskh subset (~100–300 KB) | Better AR; build size |
| C — Server-side print PDF | Privacy risk — **avoid** for B2C |

**Recommendation:** B for Tier 1 RTL pilot only; keep client-only generation.

### 4.5 Anti-patterns

- Loading full Noto mega-family on every page load.  
- Synthetic bold on Arabic (breaks shaping).  
- Tiny font on uncertainty warnings.

---

## Section 5 — Translation quality governance

### 5.1 Governance principles

- **Preserve uncertainty** — never strip `[UNCERTAIN]` without user visibility.  
- **Preserve negation** — expand `NEGATION_BY_LANG` with pl, uk, fa, ckb reviewers.  
- **Preserve dosage/units** — anchor extraction before translate; post-validate anchor presence.  
- **No medical inference** — prompts forbid diagnosis/triage/treatment additions.  

### 5.2 Terminology architecture (planned)

```text
GlossaryTerm
  - id, conceptId (non-clinical: "appointment_time", "referral_letter")
  - translations: { de, en, ar, ... }
  - partOfSpeech?, notes?
  - approvedAt, approvedByRole

GlossaryBinding (optional)
  - organizationId?, practiceId?
  - overrides global term
```

Inject glossary hints into `buildInterpreterTranslateUserMessage` as **protected terms** — not auto-replacement without user confirm.

### 5.3 Quality tiers

| Tier | Meaning | UX |
|------|---------|-----|
| **A** | Full STT + translate + UI | No banner |
| **B** | Translate OK; STT variable | “Check transcription” |
| **C** | Experimental | Require extra confirm tap |

Stored in `LanguageCapabilityRegistry` (config table or JSON) — versioned.

### 5.4 QA process (per language)

1. 50 scripted utterances (administrative, not diagnostic).  
2. Negation flip tests (10).  
3. Number/unit preservation (10).  
4. RTL screenshot review (5 screens).  
5. Sign-off by native reviewer + clinical communication advisor (non-physician role).

### 5.5 Human review (later — separate product)

- Enterprise export queue to human linguist — **not** live session surveillance.  
- Requires consent type `interpreter_human_review` (6.3) — deferred.

### 5.6 Fallback behaviour

| Failure | Behaviour |
|---------|------------|
| Translate API down | Show original + retry; no auto-switch to different meaning |
| Low confidence | `uncertain` styling; block auto-save optional *product flag* |
| Unsupported pair | Disable translate button with explanation |
| **Forbidden** | Silent downgrade to “best effort” medical paraphrase |

---

## Section 6 — Cultural & UX localization

### 6.1 Tone matrix

| Dimension | Global rule |
|-----------|-------------|
| Voice | Calm, respectful, non-urgent |
| AI references | “Assistance” / “support” — not “doctor AI” |
| Errors | Blame technology, not user |
| Privacy | Explicit, short |

### 6.2 Icons & colour

- No red flashing for errors (use amber/neutral caution — already `--interp-color-caution`).  
- Icons: universal (mic, play) + text labels — not gesture-only.  
- Avoid US-centric idioms (“ER”, “911”) in copy — use neutral “emergency services in your country”.  

### 6.3 Typography hierarchy

- Headings: clear step-down; RTL maintains start alignment.  
- Avoid ALL CAPS labels in AR (shaping issues).  

### 6.4 Healthcare wording

- “Communication support during your visit” — not “diagnose your symptoms”.  
- Simplify feature = plain language — not “dumbing down medical truth”.  

### 6.5 Invite & practice surfaces

- Localize `medicalInterpreterPractice` per Tier 1.  
- Practice name stays proper noun — no auto-transliteration.  

---

## Section 7 — International accessibility

### 7.1 Multilingual screen readers

- Every control has `aria-label` from `t.*.aria` keys — must exist in each UI locale file.  
- Language of aria label = UI locale; content language = conversation `lang`.  

### 7.2 RTL accessibility

- Test focus rings visible in RTL dialogs.  
- `aria-flowto` *optional* for reading order in review — *needs repo verification*.

### 7.3 Mixed-language

- Announce language switch in UI when patient/doctor languages differ (visual note + optional `aria-describedby`).

### 7.4 Hearing-impaired

- Transcript-forward UX; TTS optional never required.  
- Visual indicator when TTS unavailable.  

### 7.5 Low vision / elderly

- Large touch targets; high contrast tokens from design system.  
- Simple sentence structure in DE/EN/AR UI strings.

### 7.6 Low digital literacy

- Progressive disclosure; PTT as primary metaphor.  
- Avoid jargon (“streaming STT”) in patient UI — use plain labels.

### 7.7 Reduced motion

- Disable waveform animations when `prefers-reduced-motion: reduce`.

### 7.8 Live regions

- Near-realtime preview updates: `aria-live="polite"` + `aria-atomic="false"` — do not read every partial char.  
- Debounce announcements (≥2s) *planned 6.6.5*.

---

## Section 8 — International infrastructure

### 8.1 Regional deployment (align 6.5)

| Region | Phase | Components |
|--------|-------|------------|
| **EU-central** | Now | API, Postgres, logs |
| **EU-west** | 6.6.6 | DR read replica |
| **Middle East** | Future | Low-latency edge for AR users in Gulf *if product expands* — data still EU-first for GDPR |

### 8.2 Low-latency routing

- GeoDNS to nearest EU POP for DE-based users.  
- Stream chunks: keep HTTP/2 connection warm — client responsibility.

### 8.3 Provider regionalization

| Provider | Plan |
|----------|------|
| OpenAI | EU data processing when available; document subprocessor in DPA |
| Whisper/TTS | Language capability matrix per region |
| Fallback | Secondary vendor only with same no-retention contract |

### 8.4 Language-provider fallback

```text
if (sttUnavailable(lang)) → show type fallback + banner
if (ttsUnavailable(lang)) → text-only mode
if (translateDegraded(langPair)) → Tier C banner
```

### 8.5 Scaling multilingual support

- Org allowlist reduces surprise combinations.  
- Monitor `language_pair_used` analytics (6.5) — no text.  

---

## Section 9 — International privacy & compliance

### 9.1 GDPR (EU)

- UI locale and conversation language are personal data — exportable in data control.  
- Translation processing: document OpenAI as processor; DPIA update for Tier 1 rollout.

### 9.2 Regional healthcare communication rules

- Tool is **not** regulated SaMD if boundaries hold — per-country legal review for marketing claims.  
- Turkey, UK post-Brexit, CH nDSG — *needs repo verification* counsel.

### 9.3 Translation-provider privacy

- No training opt-out flag documented — *needs repo verification* OpenAI enterprise terms.  
- Minimize text: single-turn only (already).

### 9.4 Data transfer

- EU patients → EU processing preferred.  
- US processing: Standard Contractual Clauses in DPA.

### 9.5 Cloud & retention localization

- `OrganizationPolicy.dataRegion` drives DB region (6.2/6.3).  
- Consent copy versioned per locale (`ConsentVersion.legalTextKey`).

### 9.6 Multilingual legal architecture

| Artifact | Approach |
|----------|----------|
| Privacy | `legal/{locale}/` pattern exists app-wide — add interpreter-specific annex |
| Terms | Reference communication-only scope |
| Consent | Native-language grant UI; store `consentLocale` in metadata |

---

## Section 10 — International operational support

### 10.1 Multilingual support operations

| Tier | Languages |
|------|-------------|
| L1 | DE, EN |
| L2 | AR, TR (written) |
| L3 | FA, RU — scheduled callback |

### 10.2 Localization QA pipeline (planned)

1. PR checklist: new keys in **all Tier 1 UI files**.  
2. CI: missing-key detector vs `en/medicalInterpreter.js`.  
3. Quarterly native review sample.

### 10.3 Translation issue reporting

- In-app “Report unclear translation” — sends **category + turn id hash** — **not** transcript to support by default.  
- Optional user paste with consent — separate flow.

### 10.4 Terminology escalation

- Practice admin proposes term → org linguist approves → glossary update.

### 10.5 Regional pilot onboarding

- Playbook: enable languages → run INTERNATIONALIZATION_QA → monitor error rates by `languagePair` label.

### 10.6 Support visibility

| May see | Must never see |
|---------|----------------|
| UI locale, conversation language codes | Transcript text |
| Error codes, requestId | Audio |
| Capability tier (A/B/C) | Prompts |
| Quota, flags | Cloud decrypted payload |

---

## Section 11 — Language performance & cost

### 11.1 Expensive pairs (planning)

| Pair | Cost driver |
|------|-------------|
| Long AR ↔ DE | Large unicode, multi-line translate |
| Realtime + RTL | Partial STT + preview translate loops |
| Low-resource | Retries, user repetition |

### 11.2 Realtime multilingual cost

- Apply **RealtimeQuota** (6.4) per org.  
- Disable partial STT for Tier B/C languages.

### 11.3 TTS/STT variance

| Lang | Typical issue |
|------|----------------|
| ar, fa | STT good; PDF weak |
| ckb | STT *verify* |
| ku (Latin) | STT as tr? *verify* |
| el, ru | Cyrillic/Greek OK |

### 11.4 Routing strategy

- `LanguageCapabilityRegistry` gates features before API call.  
- Org policy: disable realtime for languages not in pilot list.

### 11.5 Fallback strategy

- Never use free generic MT for **confirmed** documentation without quality tier C warning.  
- PTT + local storage always free path.

---

## Section 12 — Risks & mitigations

| Risk | Mitigation |
|------|------------|
| **Terminology drift** | Glossary + versioned prompts |
| **Poor RTL rendering** | 6.6.1 QA + logical CSS lint |
| **Cultural misunderstanding** | Native reviewer + calm copy guide |
| **Low-resource failures** | Tier C + honest banners |
| **Multilingual a11y failures** | Screen reader test matrix per Tier 1 RTL |
| **Translation inconsistency** | DE/EN source of truth; TMS later |
| **International support burden** | Tiered support; self-serve help |
| **Regional compliance complexity** | EU-first; legal review per new region |
| **UI shows EN for AR users** | Priority: ship `ar/medicalInterpreter.js` |
| **PDF illegible Arabic** | Notice today; embedded font in 6.6.2 |

---

## Section 13 — Implementation roadmap (6.6.1–6.6.7)

**Do not implement until explicit request.**

### 6.6.1 — RTL hardening rollout

- Focus order audit; timestamp isolates; per-field `dir` regression tests.  
- Expand INTERNATIONALIZATION_QA for fa, ckb.  
- **Exit:** No P1 RTL layout bugs in Tier 1 scripts.

### 6.6.2 — Multilingual typography layer

- `[lang]` font stacks; PDF embedded Arabic subset OR HTML print path decision.  
- **Exit:** AR PDF readable or honest notice upgraded.

### 6.6.3 — Terminology governance foundation

- `GlossaryTerm` schema + admin UI stub; inject into translate prompt.  
- Expand negation heuristics for Tier 1.  
- **Exit:** 20-term pilot glossary live.

### 6.6.4 — International localization pipeline

- Create `medicalInterpreter` for ar, tr, fa, es, fr (Tier 1 UI).  
- CI missing-key guard.  
- Optional: enable header locales beyond de/en *product decision*.  
- **Exit:** AR UI ≥95% keys native.

### 6.6.5 — Multilingual accessibility QA

- Screen reader matrix; live region debounce; reduced motion.  
- **Exit:** WCAG 2.1 AA checklist signed for DE/EN/AR.

### 6.6.6 — Regional infrastructure rollout

- EU DR; org `allowedConversationLanguages`; capability registry.  
- **Exit:** Pilot MVZ limited to DE+AR+TR+EN.

### 6.6.7 — International operational hardening

- Support playbooks; translation report flow; language-pair dashboards (6.5).  
- **Exit:** Tier 1 launch runbook complete.

### Dependency diagram

```text
6.6.1 RTL ──► 6.6.2 typography
6.6.3 glossary ──► 6.6.4 UI locales
6.6.4 ──► 6.6.5 a11y
6.2 org policy ──► 6.6.6 regional
6.5 analytics ──► 6.6.7 ops
```

---

## Section 14 — What must NOT be implemented yet

| Forbidden | Reason |
|-----------|--------|
| **AI diagnosis localization** | SaMD / trust |
| **Symptom analytics by language** | Privacy + clinical boundary |
| **Hidden multilingual analytics** | 6.5 forbids content analytics |
| **Automatic medical inference** | Core principle |
| **Unsafe low-quality MT fallback** on confirm path | Patient safety |
| **Hidden human review** of live conversations | Consent + surveillance risk |
| **Transcript mining for glossary** | GDPR purpose limitation |
| **Urgency routing by language** | Triage boundary |
| **Auto-enable all LOCALE_OPTIONS globally** | Operational + quality risk |
| **Server-side PDF with full transcript** for ops | Privacy |

---

## Appendix A — Tier 1 UI localization priority order

1. `ar` — RTL + largest gap (no interpreter bundle)  
2. `tr` — large DE community  
3. `fa` — RTL  
4. `es`, `fr` — Latin, overrides exist app-wide  
5. `ckb`, `ku` — community critical  
6. `en`/`de` — maintain parity (ongoing)

---

## Appendix B — Conversation vs UI language matrix

| User sets UI to | Conversation AR ↔ DE | Expected |
|-----------------|------------------------|----------|
| de | ✓ | UI de; content dirs per field |
| en | ✓ | UI en |
| ar (future) | ✓ | UI ar; mixed-direction notes |
| ar (today) | ✓ | UI likely **en/de fallback** for chrome — **gap** |

---

## Appendix C — Open questions (*needs repo verification*)

1. OpenAI enterprise zero-retention and EU residency status?  
2. Whisper WER by language code in production samples?  
3. TTS voice mapping per language — OpenAI voice list?  
4. Playwright or other E2E RTL tests in CI?  
5. `@font-face` Noto subset already elsewhere in monorepo?  
6. Legal: interpreter marketing claims per country?  
7. When to enable `HEADER_SELECTABLE_LOCALE_CODES` beyond de/en?

---

*Document version: Phase 6.6 planning — no code changes, no migrations, no implementation. Do not proceed to Phase 6.7 without a separate implementation request.*
