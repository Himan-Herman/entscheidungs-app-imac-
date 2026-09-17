/**
 * Masking of patient identifiers MedScoutX already knows.
 *
 * ── Why only known values ───────────────────────────────────────────────────
 * The server knows exactly who this document belongs to: the provenance gate
 * resolved a PracticeDocument to one User. So the patient's own name, date of
 * birth, email and phone can be matched literally — no name detection, no
 * entity recognition, no model, no guessing.
 *
 * That restriction is the whole design. A generic person detector would also
 * hit the treating physician, a relative, or a contact person, and masking
 * "Dr. Anna Schmidt" as if she were the patient would be both wrong and
 * misleading. Only values the database already asserts about THIS patient are
 * masked; every other person in the letter is left untouched.
 *
 * ── This is minimisation, not anonymisation ─────────────────────────────────
 * PII masking reduces transmitted identifiers but does not constitute
 * anonymization. A letter can remain re-identifiable through a rare diagnosis,
 * a named clinic, a procedure date or the combination of all three. Nothing
 * here should be described as anonymised or pseudonymised output.
 */

/**
 * Build masking patterns for one patient.
 *
 * Ordering matters and is longest-first: a full name must be claimed before the
 * surname pattern could take half of it.
 *
 * @param {{
 *   firstName?: string,
 *   lastName?: string,
 *   dateOfBirth?: Date | string,
 *   email?: string,
 *   phone?: string,
 *   insuranceNumber?: string,
 *   patientNumber?: string,
 * }} identity
 * @returns {{ kind: string, re: RegExp }[]}
 */
export function buildPatientIdentifierPatterns(identity) {
  if (!identity || typeof identity !== "object") return [];

  const first = cleanName(identity.firstName);
  const last = cleanName(identity.lastName);
  const patterns = [];

  // ── Contact and administrative identifiers, FIRST ────────────────────────
  // Before the name patterns on purpose: "max.mustermann@example.de" contains
  // the surname, so a surname rule running first would carve the address into
  // fragments instead of masking one identifier.
  //
  // The generic EMAIL/PHONE/INSURANCE patterns already mask these shapes for
  // anyone. These entries exist so THIS patient's values are labelled as such
  // and are matched even in a formatting the generic pattern would miss.
  for (const [kind, value] of [
    ["PATIENTEMAIL", identity.email],
    ["PATIENTINSURANCE", identity.insuranceNumber],
    ["PATIENTNUMBER", identity.patientNumber],
  ]) {
    const v = cleanName(value);
    if (v) {
      patterns.push({
        kind,
        re: new RegExp(`(?<![\\w.-])${esc(v)}(?![\\w.-])`, "gi"),
      });
    }
  }

  const phone = cleanName(identity.phone);
  if (phone) {
    // Match the stored number regardless of how the document spaces or groups
    // it: "+49 171 1234567", "0171/1234567", "0171-123 45 67".
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 6) {
      const loose = digits.split("").map(esc).join("[\\s/().-]*");
      patterns.push({
        kind: "PATIENTPHONE",
        re: new RegExp(`(?<![\\d])\\+?${loose}(?![\\d])`, "g"),
      });
    }
  }

  // ── Full name, both orders, tolerant of spacing and letter case ──────────
  if (first && last) {
    const f = esc(first);
    const l = esc(last);
    patterns.push({
      kind: "PATIENTNAME",
      // "Max Mustermann" · "Max  Mustermann" · "Mustermann, Max" ·
      // "MUSTERMANN, Max". Middle names are not assumed; a second given name
      // between the two would simply not match here and the parts are then
      // caught by the individual patterns below.
      re: new RegExp(
        `(?<![\\p{L}-])(?:${f}\\s+${l}|${l}\\s*,\\s*${f})(?![\\p{L}-])`,
        "giu",
      ),
    });
  }

  // ── Surname on its own ───────────────────────────────────────────────────
  // Distinctive enough to mask unconditionally. If the treating physician
  // happens to share the patient's surname the result is over-masking, which
  // is the harmless direction.
  if (last) {
    patterns.push({
      kind: "PATIENTLAST",
      re: new RegExp(`(?<![\\p{L}-])${esc(last)}(?![\\p{L}-])`, "giu"),
    });
  }

  // ── Given name on its own ────────────────────────────────────────────────
  // Deliberately conditional. A bare given name followed by another
  // capitalised word is somebody else — "Max Schmidt" is not this patient —
  // and one preceded by a title belongs to a clinician. Both are left alone.
  if (first) {
    patterns.push({
      kind: "PATIENTFIRST",
      re: new RegExp(
        `(?<!(?:Dr|Prof|Dipl|Med)\\.\\s{0,3})(?<![\\p{L}-])${esc(first)}` +
          `(?![\\p{L}-])(?!\\s+\\p{Lu})`,
        "gu",
      ),
    });
  }

  // ── Date of birth, in the formats a German letter uses ───────────────────
  for (const rendered of birthDateForms(identity.dateOfBirth)) {
    patterns.push({
      kind: "PATIENTDOB",
      re: new RegExp(`(?<![\\d.])${esc(rendered)}(?![\\d.])`, "g"),
    });
  }

  return patterns;
}

/* ------------------------------------------------------------- internals */

/** @param {unknown} value */
function cleanName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  // A single character is not distinctive enough to mask safely.
  return trimmed.length >= 2 ? trimmed : null;
}

/** @param {string} literal */
function esc(literal) {
  return String(literal).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Render a date of birth in the formats that appear in German letters.
 * @param {Date | string | undefined} value
 * @returns {string[]}
 */
function birthDateForms(value) {
  if (!value) return [];
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return [];

  // UTC throughout: the stored value is a calendar date, and shifting it by a
  // local timezone offset would produce a date the document never contained.
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const pad = (n) => String(n).padStart(2, "0");

  return [
    `${pad(day)}.${pad(month)}.${year}`,
    `${day}.${month}.${year}`,
    `${year}-${pad(month)}-${pad(day)}`,
    `${pad(day)}/${pad(month)}/${year}`,
  ];
}
