# Privacy Notice — GOÄ/PKV Billing Plausibility (Pilot) — DRAFT

> ⚠️ **TRANSLATION DRAFT — LEGAL REVIEW REQUIRED BEFORE PUBLICATION.**
> This is a **draft** translation of the German master and is **not legal advice**,
> **not binding**, and **not final**. The authoritative version is the German master
> ([`privacy-notice-billing-pilot.de.md`](privacy-notice-billing-pilot.de.md)).
> Independent legal/DPO review is required before publication. Placeholders in
> `«angle brackets»` must be filled in first.
>
> Companion documents: [DPA draft](avv-dpa-medscoutx-pilot.de.md) ·
> [TOM](tom-medscoutx-pilot.de.md) ·
> [Subprocessors](subprocessors-medscoutx-pilot.de.md) ·
> [Data protection doc](../billing-plausibility-data-protection.md)

---

## 1. Controller / Processor roles

- **Practice (Controller):** `«practice name, address, contact»` — controller for the
  billing and context data entered during the pilot in its practice context.
- **MedScoutX (Processor):** `«operator company, address, contact»` — processes the
  data **on behalf of and on the instructions of** the practice under a data processing
  agreement (DPA, see [draft](avv-dpa-medscoutx-pilot.de.md)).
- **Data protection contact:** `«email / DPO if appointed»`
- The final allocation of roles (controller/processor per processing step) is to be
  confirmed during legal review.

---

## 2. Purposes

- Billing **plausibility support** (GOÄ/PKV)
- Generation of **deterministic warnings/hints** for codes and factors
- **PDF report** generation
- Support for **export, deletion and retention** (data-subject rights)
- **Internal logging, audit and security**

---

## 3. Categories of personal data

- Account/staff identifiers (e.g. `createdByUserId`, `actorUserId`)
- Practice profile identifiers (`practiceProfileId`)
- GOÄ code, factor, count
- Optional user-entered **free-text context** (`contextText`)
- Warning/result metadata
- Catalogue-match metadata
- PDF report metadata
- Audit-log metadata
- Technical logs
- **AI review metadata** — only if AI is enabled internally (disabled externally by
  default, see §5)

---

## 4. Data that must NOT be entered

No patient identifiers may be entered into the module — in particular into the
`contextText` free-text field — including:

- Patient name
- Date of birth
- Insurance number
- Full diagnosis text
- Clinical free text
- Other direct patient identifiers

Named patient fields are rejected by the system (HTTP 400). The free-text field cannot
technically prevent patient data entry — the practice ensures this through **staff
training**.

---

## 5. AI status

- AI-assisted review is **disabled by default** for external practices
  (`ENABLE_BILLING_AI_REVIEW=false`).
- AI is used **internally/staging only** and only under a separate agreement.
- Later activation requires OpenAI as a disclosed subprocessor, a documented legal
  basis, and a data-transfer assessment (see DPA §15).
- AI output is **non-binding** and is **not** a medical, legal, or reimbursement
  decision.

---

## 6. Legal bases (placeholders)

- **For the practice (controller):** legal basis `«to be confirmed by practice/legal»`
  — likely contract performance (Art. 6(1)(b) GDPR) or legitimate interest
  (Art. 6(1)(f) GDPR).
- **For MedScoutX (processor):** processing under the DPA and the practice's
  instructions.
- The final legal basis is determined only after legal review; this draft makes **no**
  binding statement.

---

## 7. Recipients / Subprocessors

- Hosting/compute provider: `«to be confirmed»`
- Database/hosting provider: `«to be confirmed»`
- Email provider: `«to be confirmed, if used»`
- **OpenAI:** only if AI is enabled (disabled externally by default)
- Details: [subprocessor appendix](subprocessors-medscoutx-pilot.de.md). Unconfirmed
  providers are marked "to be confirmed" and are not invented.

---

## 8. Retention and deletion

- **Retention period:** recommended **180 days** (`BILLING_SESSION_RETENTION_DAYS=180`,
  guidance) — to be finalised by the practice/DPO. There is **no automatic** purge job;
  retention is enforced via a manual purge script (D5).
- **Account deletion:** full account deletion removes associated billing data in the
  same transaction (D2).
- **Operator erasure:** targeted deletion per practice/user/session via an operator
  script with dry-run and production guard (D4).
- **Export:** privacy-safe JSON export of one's own session data (D3; raw `contextText`
  excluded).

---

## 9. Data subject rights

Subject to the statutory conditions, you have the rights to:

- Access (Art. 15 GDPR)
- Rectification (Art. 16)
- Erasure (Art. 17)
- Restriction (Art. 18)
- Portability (Art. 20)
- Objection where applicable (Art. 21)
- Lodge a complaint with a supervisory authority (Art. 77)

Contact to exercise these rights: `«controller / data protection contact»`.

---

## 10. Security

- Access control and role-based practice access (owner/admin only)
- Encryption in transit (TLS, to be confirmed at the provider edge)
- Audit logs for session lifecycle events
- Operator scripts with dry-run default and production guard
- **No** production PVS/FHIR/KIS connector without separate approval
- Further detail: [TOM appendix](tom-medscoutx-pilot.de.md)

---

## 11. Scope and limitations

- **Non-binding** plausibility support
- Uses a **local GOÄ catalogue subset** (not a complete official source)
- **No** diagnosis
- **No** therapy recommendation
- **No** triage
- **No** reimbursement guarantee/prediction
- **No** legally binding billing decision

---

*Status: **TRANSLATION DRAFT — legal review required before publication.** The German
master version prevails in case of discrepancy.*
