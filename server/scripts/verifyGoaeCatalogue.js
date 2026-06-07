/**
 * GOÄ catalogue structural validation — Phase G3a / G3a-2.
 *
 * Validates that every entry in the local catalogue test subset meets the
 * required structural constraints before the catalogue can be safely expanded.
 *
 * Rules enforced:
 *   - GOAE_ENTRIES is a non-empty array
 *   - GOAE_CATALOGUE_META has all required fields pointing to the official source
 *   - catalogueCompleteness clearly communicates subset status
 *   - Every entry has required core fields (ziffer, title, section, notes, source)
 *   - Every entry has required provenance fields (activeStatus, completenessStatus,
 *     sourceName, sourceUrl, sourceLineOrReference, sourceVersionDate, verifiedAt)
 *   - Ziffer values are unique and match the expected format
 *   - points is a positive finite number or null
 *   - If points is null, notes must mention that verification is required
 *   - If points is null, completenessStatus must not be "verified"
 *   - If points is not null and completenessStatus is "verified", source metadata must be present
 *   - No entry carries forbidden decision-claim fields
 *   - No sentinel/test ziffern that would break the unknown-ziffer fallback
 *
 * Deterministic and offline — no database, no network, no OpenAI.
 *
 * Run: node scripts/verifyGoaeCatalogue.js
 */

import {
  GOAE_ENTRIES,
  GOAE_CATALOGUE_META,
} from "../data/goaeCatalogue.js";

const failures = [];

function assert(name, condition) {
  if (!condition) failures.push(name);
}

// ISO date pattern: YYYY-MM or YYYY-MM-DD
const ISO_DATE_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;

// ─── 1. Top-level exports ─────────────────────────────────────────────────────

assert("GOAE_ENTRIES is exported and is an Array", Array.isArray(GOAE_ENTRIES));
assert(
  "GOAE_CATALOGUE_META is exported and is an object",
  typeof GOAE_CATALOGUE_META === "object" && GOAE_CATALOGUE_META !== null,
);
assert("GOAE_ENTRIES is non-empty", Array.isArray(GOAE_ENTRIES) && GOAE_ENTRIES.length > 0);

// ─── 2. Catalogue metadata fields ────────────────────────────────────────────

const REQUIRED_META_FIELDS = [
  "sourceName",
  "sourceUrl",
  "anlageUrl",
  "legalStatus",
  "catalogueCompleteness",
  "accessDate",
  "disclaimer",
];

for (const field of REQUIRED_META_FIELDS) {
  assert(
    `meta.${field} is present and non-empty`,
    typeof GOAE_CATALOGUE_META[field] === "string" &&
      GOAE_CATALOGUE_META[field].trim().length > 0,
  );
}

// Source URLs must point to the official Gesetze im Internet GOÄ publication
assert(
  "meta.sourceUrl is official Gesetze im Internet GOÄ URL",
  typeof GOAE_CATALOGUE_META.sourceUrl === "string" &&
    GOAE_CATALOGUE_META.sourceUrl.startsWith(
      "https://www.gesetze-im-internet.de/go__1982/",
    ),
);
assert(
  "meta.anlageUrl references Gesetze im Internet and the Anlage",
  typeof GOAE_CATALOGUE_META.anlageUrl === "string" &&
    GOAE_CATALOGUE_META.anlageUrl.includes("gesetze-im-internet.de") &&
    GOAE_CATALOGUE_META.anlageUrl.toLowerCase().includes("anlage"),
);

// catalogueCompleteness must communicate subset/test status
// It must not claim a full or complete catalogue
const completeness = (GOAE_CATALOGUE_META.catalogueCompleteness ?? "").toLowerCase();
assert(
  'meta.catalogueCompleteness indicates subset or test status (contains "subset", "test", or "partial")',
  completeness.includes("subset") ||
    completeness.includes("test") ||
    completeness.includes("partial"),
);
assert(
  'meta.catalogueCompleteness does not claim full catalogue ("complete-catalogue" or "full-catalogue" forbidden)',
  !completeness.includes("complete-catalogue") && !completeness.includes("full-catalogue"),
);

// disclaimer must mention non-binding or incomplete nature
const disclaimer = (GOAE_CATALOGUE_META.disclaimer ?? "").toLowerCase();
assert(
  "meta.disclaimer mentions non-binding or incomplete nature",
  disclaimer.includes("not") ||
    disclaimer.includes("no ") ||
    disclaimer.includes("kein") ||
    disclaimer.includes("subset") ||
    disclaimer.includes("test"),
);

// ─── 3. Per-entry validation ──────────────────────────────────────────────────

// Fields that must never appear on an entry — they would imply a legal or billing claim
// that the catalogue does not support.
const FORBIDDEN_ENTRY_FIELDS = [
  "baseFee",
  "reimbursementDecision",
  "billingOpinion",
  "approved",
  "certified",
  "compliant",
  "legallyBinding",
];

// Valid completenessStatus values
const VALID_COMPLETENESS_STATUSES = new Set(["verified", "points-uncertain", "needs-review"]);

// Valid activeStatus values
const VALID_ACTIVE_STATUSES = new Set(["active", "deprecated"]);

// Valid ziffer format: one or more digits, optionally followed by a single letter (e.g. "1", "1a", "100")
const ZIFFER_FORMAT = /^\d+[a-zA-Z]?$/;

const seenZiffern = new Set();

if (Array.isArray(GOAE_ENTRIES)) {
  for (let i = 0; i < GOAE_ENTRIES.length; i++) {
    const entry = GOAE_ENTRIES[i];
    const rowLabel = `entry[${i + 1}]`;
    const ziffer = String(entry?.ziffer ?? "").trim();
    const displayId = ziffer || `(index ${i})`;

    // ── Core required string fields ────────────────────────────────────────────

    assert(
      `${rowLabel} ziffer "${displayId}" — ziffer is a non-empty string`,
      typeof entry.ziffer === "string" && entry.ziffer.trim().length > 0,
    );
    assert(
      `${rowLabel} ziffer "${displayId}" — title is a non-empty string`,
      typeof entry.title === "string" && entry.title.trim().length > 0,
    );
    assert(
      `${rowLabel} ziffer "${displayId}" — section is a non-empty string`,
      typeof entry.section === "string" && entry.section.trim().length > 0,
    );
    assert(
      `${rowLabel} ziffer "${displayId}" — notes is a non-empty string`,
      typeof entry.notes === "string" && entry.notes.trim().length > 0,
    );
    assert(
      `${rowLabel} ziffer "${displayId}" — source is a non-empty string`,
      typeof entry.source === "string" && entry.source.trim().length > 0,
    );

    // ── Ziffer format and uniqueness ───────────────────────────────────────────

    assert(
      `${rowLabel} ziffer "${displayId}" — format is valid (digits + optional letter suffix)`,
      ZIFFER_FORMAT.test(ziffer),
    );
    assert(
      `${rowLabel} ziffer "${displayId}" — not a duplicate`,
      !seenZiffern.has(ziffer),
    );
    seenZiffern.add(ziffer);

    // ── points ─────────────────────────────────────────────────────────────────

    assert(
      `${rowLabel} ziffer "${displayId}" — points is a positive finite number or null`,
      entry.points === null ||
        (typeof entry.points === "number" &&
          Number.isFinite(entry.points) &&
          entry.points > 0),
    );

    // If points is null, notes must indicate that verification against the official Anlage is required
    if (entry.points === null) {
      const notesLower = (entry.notes ?? "").toLowerCase();
      assert(
        `${rowLabel} ziffer "${displayId}" — points is null; notes must mention "verify", "uncertain", or "check"`,
        notesLower.includes("verify") ||
          notesLower.includes("uncertain") ||
          notesLower.includes("check"),
      );
    }

    // ── Provenance fields (G3a-2) ──────────────────────────────────────────────

    // activeStatus
    assert(
      `${rowLabel} ziffer "${displayId}" — activeStatus is "active" or "deprecated"`,
      VALID_ACTIVE_STATUSES.has(entry.activeStatus),
    );

    // completenessStatus
    assert(
      `${rowLabel} ziffer "${displayId}" — completenessStatus is "verified", "points-uncertain", or "needs-review"`,
      VALID_COMPLETENESS_STATUSES.has(entry.completenessStatus),
    );

    // If points is null, completenessStatus must not be "verified"
    if (entry.points === null) {
      assert(
        `${rowLabel} ziffer "${displayId}" — points is null so completenessStatus must not be "verified"`,
        entry.completenessStatus !== "verified",
      );
    }

    // P1b hardening: "needs-review" notes must name what needs review
    // (title, section, scope, or ziffer) so future entries cannot be vague.
    if (entry.completenessStatus === "needs-review") {
      const notesForReview = (entry.notes ?? "").toLowerCase();
      assert(
        `${rowLabel} ziffer "${displayId}" — needs-review entry notes must mention what needs review ("title", "section", "scope", or "ziffer")`,
        notesForReview.includes("title") ||
          notesForReview.includes("section") ||
          notesForReview.includes("scope") ||
          notesForReview.includes("ziffer"),
      );
    }

    // P1b hardening: "points-uncertain" notes must mention that points need verification.
    if (entry.completenessStatus === "points-uncertain") {
      const notesForPoints = (entry.notes ?? "").toLowerCase();
      assert(
        `${rowLabel} ziffer "${displayId}" — points-uncertain entry notes must mention "uncertain" (re: points)`,
        notesForPoints.includes("uncertain"),
      );
    }

    // If points is not null and completenessStatus is "verified", source metadata must be present
    if (entry.points !== null && entry.completenessStatus === "verified") {
      assert(
        `${rowLabel} ziffer "${displayId}" — completenessStatus "verified" requires sourceName`,
        typeof entry.sourceName === "string" && entry.sourceName.trim().length > 0,
      );
      assert(
        `${rowLabel} ziffer "${displayId}" — completenessStatus "verified" requires sourceUrl`,
        typeof entry.sourceUrl === "string" && entry.sourceUrl.trim().length > 0,
      );
    }

    // sourceName — must be a non-empty string
    assert(
      `${rowLabel} ziffer "${displayId}" — sourceName is a non-empty string`,
      typeof entry.sourceName === "string" && entry.sourceName.trim().length > 0,
    );

    // sourceUrl — must reference the official go__1982 GOÄ source
    assert(
      `${rowLabel} ziffer "${displayId}" — sourceUrl references official go__1982 GOÄ source`,
      typeof entry.sourceUrl === "string" &&
        entry.sourceUrl.includes("go__1982"),
    );

    // sourceLineOrReference — null or non-empty string
    assert(
      `${rowLabel} ziffer "${displayId}" — sourceLineOrReference is null or a non-empty string`,
      entry.sourceLineOrReference === null ||
        (typeof entry.sourceLineOrReference === "string" &&
          entry.sourceLineOrReference.trim().length > 0),
    );

    // verifiedAt — null or ISO date string (YYYY-MM or YYYY-MM-DD)
    assert(
      `${rowLabel} ziffer "${displayId}" — verifiedAt is null or ISO date string (YYYY-MM or YYYY-MM-DD)`,
      entry.verifiedAt === null ||
        (typeof entry.verifiedAt === "string" &&
          ISO_DATE_PATTERN.test(entry.verifiedAt)),
    );

    // sourceVersionDate — null or ISO date string (YYYY-MM or YYYY-MM-DD)
    assert(
      `${rowLabel} ziffer "${displayId}" — sourceVersionDate is null or ISO date string`,
      entry.sourceVersionDate === null ||
        (typeof entry.sourceVersionDate === "string" &&
          ISO_DATE_PATTERN.test(entry.sourceVersionDate)),
    );

    // ── Forbidden decision-claim fields ───────────────────────────────────────

    for (const field of FORBIDDEN_ENTRY_FIELDS) {
      assert(
        `${rowLabel} ziffer "${displayId}" — does not contain forbidden field "${field}"`,
        !(field in entry),
      );
    }
  }
}

// ─── 4. Sentinel / test-only ziffer guard ─────────────────────────────────────
// These must NOT be present in the real catalogue — they are reserved for use
// in the verify script to test the unknown-ziffer fallback.

const RESERVED_SENTINEL_ZIFFERN = ["99999", "00000"];
if (Array.isArray(GOAE_ENTRIES)) {
  for (const sentinel of RESERVED_SENTINEL_ZIFFERN) {
    assert(
      `catalogue does not contain reserved sentinel ziffer "${sentinel}"`,
      !GOAE_ENTRIES.some((e) => e.ziffer === sentinel),
    );
  }
}

// ─── Result ───────────────────────────────────────────────────────────────────

if (failures.length) {
  console.error("verifyGoaeCatalogue FAILED:");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}

const entryCount = Array.isArray(GOAE_ENTRIES) ? GOAE_ENTRIES.length : 0;
const withPoints = Array.isArray(GOAE_ENTRIES)
  ? GOAE_ENTRIES.filter((e) => e.points !== null).length
  : 0;

console.log("verifyGoaeCatalogue OK");
console.log(
  JSON.stringify({
    entries: entryCount,
    uniqueZiffern: seenZiffern.size,
    sections: Array.isArray(GOAE_ENTRIES)
      ? [...new Set(GOAE_ENTRIES.map((e) => e.section))].sort()
      : [],
    withPointsValue: withPoints,
    withPointsNull: entryCount - withPoints,
    completenessBreakdown: Array.isArray(GOAE_ENTRIES)
      ? {
          verified: GOAE_ENTRIES.filter((e) => e.completenessStatus === "verified").length,
          pointsUncertain: GOAE_ENTRIES.filter((e) => e.completenessStatus === "points-uncertain").length,
          needsReview: GOAE_ENTRIES.filter((e) => e.completenessStatus === "needs-review").length,
        }
      : {},
  }),
);
