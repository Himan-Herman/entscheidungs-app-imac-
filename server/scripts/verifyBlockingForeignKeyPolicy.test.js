/**
 * No blocking foreign key may hide from the deletion preflights (Phase 2F.3A).
 *
 * A foreign key with ON DELETE RESTRICT or NO ACTION turns a hard delete into a
 * database error. If the application preflight does not know about it, the user
 * gets an opaque 500 after being told everything was fine — which is exactly
 * what happened when document share grants were introduced: they added seven
 * blocking foreign keys and no preflight learned about any of them.
 *
 * This test compares the DATABASE against an explicit policy list. A new
 * RESTRICT foreign key therefore fails the suite until someone states, here,
 * what should happen when it blocks. That is the whole point: the decision is
 * cheap to record and expensive to discover in production.
 *
 * Run: node --test scripts/verifyBlockingForeignKeyPolicy.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/**
 * Objects the application can hard-delete. A blocking foreign key matters only
 * if something can actually try to delete its parent.
 */
const HARD_DELETABLE = new Set(["User", "PracticeProfile", "PracticePatientLink", "PracticeDocument"]);

/**
 * Every known blocking foreign key, and what the application does about it.
 *
 *   guard   — a deletion preflight reports it before the database is touched
 *   cleanup — the deletion flow ends the row itself, in a controlled way
 *   cascade — the parent's own deletion removes it first, so it never blocks
 *
 * `note` is for humans; the test only enforces that an entry exists.
 */
const POLICY = Object.freeze({
  "AllergyEntry.contextPracticePatientLinkId": { handling: "guard", note: "contextual medical record" },
  "DiagnosisEntry.contextPracticePatientLinkId": { handling: "guard", note: "contextual medical record" },
  "VaccinationEntry.contextPracticePatientLinkId": { handling: "guard", note: "contextual medical record" },
  "VitalEntry.contextPracticePatientLinkId": { handling: "guard", note: "contextual medical record" },

  "PracticeDocumentShareGrant.sourcePracticePatientLinkId": { handling: "guard", note: "live release" },
  "PracticeDocumentShareGrant.targetPracticePatientLinkId": { handling: "guard", note: "live release" },
  "PracticeDocumentShareGrant.sourcePracticeProfileId": { handling: "guard", note: "live release" },
  "PracticeDocumentShareGrant.targetPracticeProfileId": { handling: "guard", note: "live release" },
  "PracticeDocumentShareGrant.documentId": {
    handling: "guard",
    note: "a document cannot be hard-deleted while released; documents are soft-deleted in the app",
  },
  "PracticeDocumentShareGrant.patientUserId": { handling: "cleanup", note: "ended by account deletion" },
  "PracticeDocumentShareGrant.grantedByUserId": { handling: "cleanup", note: "ended by account deletion" },

  "PracticeInterpreterInvite.createdByUserId": { handling: "cleanup", note: "removed by account deletion" },

  // Phase 2F.3B: practice-issued clinical artifacts. A published plan or a
  // prescription must not disappear because a practice closed, so both hold
  // their relationship — and their practice — with RESTRICT.
  "MedicationPlan.practicePatientLinkId": { handling: "guard", note: "published clinical artifact" },
  "MedicationPlan.practiceProfileId": { handling: "guard", note: "published clinical artifact" },
  "ErezeptEntry.linkId": { handling: "guard", note: "prescription outlives the relationship" },
  "ErezeptEntry.practiceProfileId": { handling: "guard", note: "historical attribution" },
});

async function blockingForeignKeys() {
  const rows = await prisma.$queryRaw`
    SELECT (SELECT relname FROM pg_class WHERE oid = con.confrelid) AS parent,
           c.relname AS child,
           a.attname AS col,
           con.confdeltype AS del
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN unnest(con.conkey) WITH ORDINALITY k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
    WHERE con.contype = 'f' AND con.confdeltype IN ('r', 'a')`;
  return rows.map((r) => ({ ...r, key: `${r.child}.${r.col}` }));
}

test("every blocking foreign key on a hard-deletable object has a stated policy", { skip }, async () => {
  const fks = (await blockingForeignKeys()).filter((f) => HARD_DELETABLE.has(f.parent));

  const undeclared = fks.filter((f) => !POLICY[f.key]).map((f) => `${f.key} -> ${f.parent}`);
  assert.deepEqual(
    undeclared,
    [],
    "a new RESTRICT foreign key was added without deciding what a blocked deletion should say",
  );
});

test("the policy list names no foreign key that does not exist", { skip }, async () => {
  const present = new Set((await blockingForeignKeys()).map((f) => f.key));
  const stale = Object.keys(POLICY).filter((k) => !present.has(k));
  assert.deepEqual(stale, [], "a policy entry outlived its foreign key — the list is drifting");
});

test("the preflight actually queries every foreign key it claims to guard", { skip }, async () => {
  const { readFileSync } = await import("node:fs");
  const guard = readFileSync("services/dataLifecycle/contextualPatientDataDeletionGuard.js", "utf8");

  const guarded = Object.entries(POLICY)
    .filter(([, v]) => v.handling === "guard")
    .map(([key]) => key);

  const missing = guarded.filter((key) => {
    const [table, col] = key.split(".");
    const delegate = table[0].toLowerCase() + table.slice(1);
    // Either the column is filtered by name, or the whole table is counted.
    return !guard.includes(col) && !guard.includes(`${delegate}.count`);
  });

  assert.deepEqual(
    missing,
    [],
    "declared as guarded, but the preflight never looks at it",
  );
});

test("the account deletion flow touches every foreign key it claims to clean up", { skip }, async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("routes/account.js", "utf8");

  const missing = Object.entries(POLICY)
    .filter(([, v]) => v.handling === "cleanup")
    .map(([key]) => key.split(".")[0])
    .filter((table, i, all) => all.indexOf(table) === i)
    .filter((table) => {
      const delegate = table[0].toLowerCase() + table.slice(1);
      return !src.includes(`tx.${delegate}.`);
    });

  assert.deepEqual(missing, [], "declared as cleaned up, but account deletion never touches it");
});

test("the inventory is not empty — the query still finds foreign keys", { skip }, async () => {
  // Without this the three tests above would pass on any query mistake that
  // returns nothing at all.
  const fks = await blockingForeignKeys();
  assert.ok(fks.length >= 10, `expected the known blocking foreign keys, found ${fks.length}`);
  assert.ok(
    fks.some((f) => f.key === "PracticeDocumentShareGrant.patientUserId"),
    "the foreign key that broke account deletion must be in the inventory",
  );
});
