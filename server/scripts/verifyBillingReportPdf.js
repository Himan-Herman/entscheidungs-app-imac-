/**
 * verifyBillingReportPdf — Phase G4c offline verification.
 *
 * Confirms that buildReportPdf produces a valid PDF buffer for a variety of
 * mock session / item shapes.  No database, no network, no AI calls.
 *
 * Usage:  node scripts/verifyBillingReportPdf.js
 *
 * All assertions are deterministic and offline.
 */

import { buildReportPdf } from "../services/billingPlausibility/billingPlausibilityReportService.js";

// ─── Minimal assert helper ────────────────────────────────────────────────────

const failures = [];
let total = 0;

function assert(name, condition) {
  total++;
  if (!condition) {
    failures.push(name);
    process.stdout.write(`  FAIL  ${name}\n`);
  } else {
    process.stdout.write(`  ok    ${name}\n`);
  }
}

// ─── Mock data ────────────────────────────────────────────────────────────────

/** Minimal session row (no DB required). */
function makeSession(overrides = {}) {
  return {
    id: "mock-session-g4c-1",
    practiceId: "mock-practice-1",
    status: "pending",
    sourceType: "manual",
    disclaimerVersion: "1.0",
    createdAt: new Date("2026-06-01T10:00:00Z"),
    resultSummaryJson: null,
    ...overrides,
  };
}

/** Item with a known catalogue entry (verified). */
const itemVerified = {
  id: "item-1",
  ziffer: "1",
  factor: "2.3",
  count: "1",
  contextText: null,
  warningsJson: [],
  catalogueMatchJson: {
    found: true,
    ziffer: "1",
    completenessStatus: "verified",
    sourceLineOrReference: "GOÄ §4 Abs.1 | Anlage, Z. 1",
  },
};

/** Item with points-uncertain status. */
const itemPointsUncertain = {
  id: "item-2",
  ziffer: "5",
  factor: "3.5",
  count: "2",
  contextText: "Kurze Anmerkung",
  warningsJson: ["factor_requires_justification", "justification_missing"],
  catalogueMatchJson: {
    found: true,
    ziffer: "5",
    completenessStatus: "points-uncertain",
    sourceLineOrReference: null,
  },
};

/** Item with needs-review status. */
const itemNeedsReview = {
  id: "item-3",
  ziffer: "10",
  factor: "1.0",
  count: "1",
  contextText: null,
  warningsJson: [],
  catalogueMatchJson: {
    found: true,
    ziffer: "10",
    completenessStatus: "needs-review",
    sourceLineOrReference: "GOÄ Anlage Z.10",
  },
};

/** Item not found in local catalogue subset. */
const itemNotFound = {
  id: "item-4",
  ziffer: "9999",
  factor: "1.0",
  count: "1",
  contextText: null,
  warningsJson: ["unknown_goae_ziffer"],
  catalogueMatchJson: {
    found: false,
    ziffer: "9999",
  },
};

/** Old-session item — catalogueMatchJson has no G3b-2 completeness keys (backward compat). */
const itemOldSession = {
  id: "item-5",
  ziffer: "3",
  factor: "2.3",
  count: "1",
  contextText: null,
  warningsJson: [],
  catalogueMatchJson: {
    found: true,
    ziffer: "3",
    // no completenessStatus, no sourceLineOrReference — old session shape
  },
};

/** Item with no catalogueMatchJson at all (extreme old-session fallback). */
const itemNoCatalogueJson = {
  id: "item-6",
  ziffer: "4",
  factor: "1.15",
  count: "3",
  contextText: null,
  warningsJson: [],
  catalogueMatchJson: null,
};

/** Session with an AI review block saved. */
const sessionWithAiReview = makeSession({
  id: "mock-session-ai",
  status: "reviewed",
  resultSummaryJson: {
    aiReview: {
      generalNote: "No obvious billing anomalies detected.",
      uncertaintyNote: "Factor 3.5 on code 5 may require written justification.",
      rowHints: [
        { ziffer: "5", hint: "Factor exceeds standard threshold." },
      ],
      fallback: false,
    },
  },
});

/** Session with AI review in fallback state. */
const sessionAiFallback = makeSession({
  id: "mock-session-ai-fallback",
  resultSummaryJson: {
    aiReview: { fallback: true, rowHints: [], generalNote: null, uncertaintyNote: null },
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Call buildReportPdf and return the Buffer.
 * Any thrown error is caught and returned as-is so assertions can report it.
 */
async function runBuild(session, items, locale) {
  try {
    return await buildReportPdf({ session, items, locale });
  } catch (err) {
    return err;
  }
}

/** Check that a value is a Buffer (or Uint8Array) that starts with %PDF. */
function isPdfBuffer(buf) {
  if (!buf || typeof buf !== "object") return false;
  if (buf instanceof Error) return false;
  // Accept both Buffer and Uint8Array
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const header = bytes.slice(0, 4).toString("ascii");
  return header === "%PDF";
}

// ─── Sections ─────────────────────────────────────────────────────────────────

// ── §1  No patient identifiers in input model ─────────────────────────────────
process.stdout.write("\n§1  Input model: no patient identifiers\n");

const PATIENT_ID_KEYS = ["patientId", "patientName", "dateOfBirth", "insuranceNumber", "insuranceId", "dob"];
const allItemKeys = Object.keys(itemVerified);
for (const key of PATIENT_ID_KEYS) {
  assert(`item model has no key '${key}'`, !allItemKeys.includes(key));
}
const sessionKeys = Object.keys(makeSession());
for (const key of PATIENT_ID_KEYS) {
  assert(`session model has no key '${key}'`, !sessionKeys.includes(key));
}

// ── §2  No OpenAI import in report service ────────────────────────────────────
process.stdout.write("\n§2  Report service: no AI calls\n");
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_SVC_PATH = resolve(__dirname, "../services/billingPlausibility/billingPlausibilityReportService.js");
const REPORT_SVC = readFileSync(REPORT_SVC_PATH, "utf8");

assert("report service: no 'openai' import", !REPORT_SVC.includes("openai"));
assert("report service: no 'OpenAI' constructor", !REPORT_SVC.includes("new OpenAI"));
assert("report service: no fetch to AI endpoint", !REPORT_SVC.includes("api.openai.com"));
assert("report service uses pdf-lib", REPORT_SVC.includes("pdf-lib"));
assert("report service: buildReportPdf exported", REPORT_SVC.includes("export async function buildReportPdf"));

// ── §3  Locale: de ────────────────────────────────────────────────────────────
process.stdout.write("\n§3  Locale: de\n");

{
  const buf = await runBuild(
    makeSession(),
    [itemVerified, itemPointsUncertain, itemNotFound],
    "de",
  );
  assert("de: returns without error", !(buf instanceof Error));
  assert("de: result is Buffer/Uint8Array", Buffer.isBuffer(buf) || (buf instanceof Uint8Array));
  assert("de: starts with %PDF", isPdfBuffer(buf));
  assert("de: length > 2 KB", buf.length > 2048);
}

// ── §4  Locale: en ────────────────────────────────────────────────────────────
process.stdout.write("\n§4  Locale: en\n");

{
  const buf = await runBuild(makeSession(), [itemVerified, itemNeedsReview], "en");
  assert("en: returns without error", !(buf instanceof Error));
  assert("en: starts with %PDF", isPdfBuffer(buf));
  assert("en: length > 2 KB", buf.length > 2048);
}

// ── §5  Locale: fr ────────────────────────────────────────────────────────────
process.stdout.write("\n§5  Locale: fr\n");

{
  const buf = await runBuild(makeSession(), [itemVerified], "fr");
  assert("fr: returns without error", !(buf instanceof Error));
  assert("fr: starts with %PDF", isPdfBuffer(buf));
}

// ── §6  Locale: it ────────────────────────────────────────────────────────────
process.stdout.write("\n§6  Locale: it\n");

{
  const buf = await runBuild(makeSession(), [itemVerified], "it");
  assert("it: returns without error", !(buf instanceof Error));
  assert("it: starts with %PDF", isPdfBuffer(buf));
}

// ── §7  Locale: es ────────────────────────────────────────────────────────────
process.stdout.write("\n§7  Locale: es\n");

{
  const buf = await runBuild(makeSession(), [itemVerified], "es");
  assert("es: returns without error", !(buf instanceof Error));
  assert("es: starts with %PDF", isPdfBuffer(buf));
}

// ── §8  Unknown locale falls back to de ──────────────────────────────────────
process.stdout.write("\n§8  Unknown locale falls back to de\n");

{
  const bufUnknown = await runBuild(makeSession(), [itemVerified], "xx");
  const bufDe = await runBuild(makeSession(), [itemVerified], "de");
  assert("unknown locale: returns without error", !(bufUnknown instanceof Error));
  assert("unknown locale: starts with %PDF", isPdfBuffer(bufUnknown));
  // Both should produce valid PDFs of the same rough size (within 10%)
  const ratio = bufUnknown.length / bufDe.length;
  assert("unknown locale: same PDF size range as de (within 10%)", ratio > 0.9 && ratio < 1.1);
}

// ── §9  Null locale falls back to de ─────────────────────────────────────────
process.stdout.write("\n§9  Null locale falls back to de\n");

{
  const buf = await runBuild(makeSession(), [itemVerified], null);
  assert("null locale: returns without error", !(buf instanceof Error));
  assert("null locale: starts with %PDF", isPdfBuffer(buf));
}

// ── §10  G3b-2: completenessStatus variants ──────────────────────────────────
process.stdout.write("\n§10  G3b-2: completenessStatus variants in single session\n");

{
  const buf = await runBuild(
    makeSession(),
    [itemVerified, itemPointsUncertain, itemNeedsReview],
    "de",
  );
  assert("G3b-2 variants: returns without error", !(buf instanceof Error));
  assert("G3b-2 variants: starts with %PDF", isPdfBuffer(buf));
  assert("G3b-2 variants: length > 3 KB (3 items rendered)", buf.length > 3072);
}

// ── §11  G3b-2: old session (no completenessStatus) — no crash ───────────────
process.stdout.write("\n§11  G3b-2: old-session items (no completenessStatus key)\n");

{
  const buf = await runBuild(makeSession(), [itemOldSession], "de");
  assert("old session item: returns without error", !(buf instanceof Error));
  assert("old session item: starts with %PDF", isPdfBuffer(buf));
}

// ── §12  G3b-2: null catalogueMatchJson — no crash ───────────────────────────
process.stdout.write("\n§12  G3b-2: null catalogueMatchJson — no crash\n");

{
  const buf = await runBuild(makeSession(), [itemNoCatalogueJson], "de");
  assert("null catalogueMatchJson: returns without error", !(buf instanceof Error));
  assert("null catalogueMatchJson: starts with %PDF", isPdfBuffer(buf));
}

// ── §13  Session with AI review ───────────────────────────────────────────────
process.stdout.write("\n§13  Session with AI review block\n");

{
  const buf = await runBuild(sessionWithAiReview, [itemVerified, itemPointsUncertain], "en");
  assert("AI review session: returns without error", !(buf instanceof Error));
  assert("AI review session: starts with %PDF", isPdfBuffer(buf));
  assert("AI review session: length > 3 KB", buf.length > 3072);
}

// ── §14  Session with AI fallback ─────────────────────────────────────────────
process.stdout.write("\n§14  Session with AI fallback state\n");

{
  const buf = await runBuild(sessionAiFallback, [itemVerified], "de");
  assert("AI fallback session: returns without error", !(buf instanceof Error));
  assert("AI fallback session: starts with %PDF", isPdfBuffer(buf));
}

// ── §15  Empty items array ─────────────────────────────────────────────────────
process.stdout.write("\n§15  Empty items array\n");

{
  const buf = await runBuild(makeSession(), [], "de");
  assert("empty items: returns without error", !(buf instanceof Error));
  assert("empty items: starts with %PDF", isPdfBuffer(buf));
}

// ── §16  Session with status values ──────────────────────────────────────────
process.stdout.write("\n§16  Session status labels\n");

for (const status of ["pending", "reviewed", "dismissed", "draft"]) {
  const buf = await runBuild(makeSession({ status }), [itemVerified], "de");
  assert(`status '${status}': returns without error`, !(buf instanceof Error));
  assert(`status '${status}': starts with %PDF`, isPdfBuffer(buf));
}

// ── §17  Item with context text ───────────────────────────────────────────────
process.stdout.write("\n§17  Item with contextText\n");

{
  const itemWithCtx = {
    ...itemVerified,
    id: "item-ctx",
    contextText: "Praxis-Notiz — kein Patientendatum",
  };
  const buf = await runBuild(makeSession(), [itemWithCtx], "de");
  assert("contextText item: returns without error", !(buf instanceof Error));
  assert("contextText item: starts with %PDF", isPdfBuffer(buf));
}

// ── §18  Multiple pages (many items) ─────────────────────────────────────────
process.stdout.write("\n§18  Multi-page document (many items)\n");

{
  const manyItems = Array.from({ length: 40 }, (_, i) => ({
    id: `bulk-${i}`,
    ziffer: String(i + 1),
    factor: "2.3",
    count: "1",
    contextText: null,
    warningsJson: i % 3 === 0 ? ["factor_requires_justification"] : [],
    catalogueMatchJson: {
      found: i % 4 !== 0,
      ziffer: String(i + 1),
      completenessStatus: i % 4 !== 0 ? "points-uncertain" : undefined,
      sourceLineOrReference: null,
    },
  }));
  const buf = await runBuild(makeSession(), manyItems, "de");
  assert("multi-page: returns without error", !(buf instanceof Error));
  assert("multi-page: starts with %PDF", isPdfBuffer(buf));
  assert("multi-page: length > 5 KB (many items rendered)", buf.length > 5120);
}

// ── §19  Source reference rendered ────────────────────────────────────────────
process.stdout.write("\n§19  sourceLineOrReference rendered without error\n");

{
  const itemWithSrc = {
    ...itemVerified,
    id: "item-src",
    catalogueMatchJson: {
      found: true,
      ziffer: "1",
      completenessStatus: "verified",
      sourceLineOrReference: "GOÄ §4 Abs.1 | Anlage, Z. 1 | Stand 2026-01-15",
    },
  };
  const buf = await runBuild(makeSession(), [itemWithSrc], "en");
  assert("sourceLineOrReference: returns without error", !(buf instanceof Error));
  assert("sourceLineOrReference: starts with %PDF", isPdfBuffer(buf));
}

// ── §20  Items with all warning codes ─────────────────────────────────────────
process.stdout.write("\n§20  Items with all known warning codes\n");

{
  const allWarningsItem = {
    id: "item-all-warn",
    ziffer: "7",
    factor: "5.0",
    count: "0",
    contextText: null,
    warningsJson: [
      "unknown_goae_ziffer",
      "factor_requires_justification",
      "justification_missing",
      "invalid_factor",
      "invalid_count",
    ],
    catalogueMatchJson: { found: false, ziffer: "7" },
  };
  const buf = await runBuild(makeSession(), [allWarningsItem], "de");
  assert("all warning codes: returns without error", !(buf instanceof Error));
  assert("all warning codes: starts with %PDF", isPdfBuffer(buf));
}

// ─── Final report ─────────────────────────────────────────────────────────────

process.stdout.write("\n");
if (failures.length === 0) {
  process.stdout.write(`verifyBillingReportPdf OK — ${total} assertions passed.\n`);
} else {
  process.stdout.write(
    `verifyBillingReportPdf FAILED — ${failures.length}/${total} assertions failed:\n`,
  );
  for (const f of failures) {
    process.stdout.write(`  - ${f}\n`);
  }
  process.exit(1);
}
