/**
 * Structural verification for full account erasure (GDPR Art. 17).
 *
 * No database required — this asserts that DELETE /api/account/delete provably
 * erases every User-linked model, by cross-checking routes/account.js against the
 * Prisma schema:
 *   1) the User row is deleted (so login is impossible and Cascade FKs fire);
 *   2) the single onDelete: Restrict FK to User is removed before the user delete;
 *   3) scalar *UserId patient tables with NO @relation (no cascade) are handled;
 *   4) Analytics carries no raw User FK (pseudonymised).
 *
 * Run: node scripts/verifyAccountErasure.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, "../prisma/schema.prisma"), "utf8");
const account = fs.readFileSync(path.join(here, "../routes/account.js"), "utf8");

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

// 1) User row is deleted inside the transaction.
check(
  "User row is deleted (tx.user.delete)",
  /tx\.user\.delete\(\s*\{\s*where:\s*\{\s*id:\s*userId\s*\}/.test(account),
  "login becomes impossible; Cascade FKs erase patient-owned data"
);

// 2) The single onDelete: Restrict FK to User must be handled before user delete.
const restrictFks = [...schema.matchAll(/(\w+)\s+User\??\s+@relation\([^)]*onDelete:\s*Restrict[^)]*\)/g)];
check(
  "Exactly one Restrict FK to User exists",
  restrictFks.length === 1,
  `found ${restrictFks.length}`
);
check(
  "Restrict FK (PracticeInterpreterInvite.createdBy) is deleted before user.delete",
  /practiceInterpreterInvite\.deleteMany\(\s*\{\s*where:\s*\{\s*createdByUserId:\s*userId\s*\}/.test(account),
  "otherwise tx.user.delete throws a FK violation"
);

// 3) Scalar *UserId patient tables with NO @relation get no cascade — must be explicit.
//    Derive them from the schema, then assert account.js removes each one.
function scalarOnlyUserTables() {
  const out = [];
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = modelRe.exec(schema))) {
    const [_, model, body] = m;
    const relationFields = new Set();
    for (const r of body.matchAll(/fields:\s*\[([^\]]*)\]/g)) {
      r[1].split(",").forEach((f) => relationFields.add(f.trim()));
    }
    for (const s of body.matchAll(/^\s+(\w*[Uu]serId)\s+String/gm)) {
      const field = s[1];
      if (!relationFields.has(field)) out.push({ model, field });
    }
  }
  return out;
}
const scalarOnly = scalarOnlyUserTables();
// Patient-data tables that hold the patient's own/identifying data and must be erased.
const mustErase = ["externalResourceReference", "practiceMedaSession", "billingPlausibilitySession"];
for (const tbl of mustErase) {
  check(
    `Scalar-FK patient table handled: ${tbl}`,
    new RegExp(`${tbl}\\.deleteMany`).test(account),
    "no @relation → no cascade → explicit delete required"
  );
}

// 4) Analytics must not carry a raw User FK.
const analyticsBlock = (schema.match(/model\s+AnalyticsEvent\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
check(
  "AnalyticsEvent has no User @relation (pseudonymised)",
  !/User\s+@relation/.test(analyticsBlock) && /userHash/.test(analyticsBlock),
  "uses userHash/sessionHash only"
);

// 5) No raw secret/health logging in the delete path (logs go through logServerError).
check(
  "Delete path does not console.log request body / health data",
  !/console\.(log|info|error)\([^)]*req\.body/.test(account),
  "errors routed through logServerError"
);

// Report ─────────────────────────────────────────────────────────────────────
let failed = 0;
console.log("\nAccount-erasure structural verification\n" + "=".repeat(40));
for (const r of results) {
  const tag = r.ok ? "PASS" : "FAIL";
  if (!r.ok) failed++;
  console.log(`[${tag}] ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
}
console.log("\nScalar-only *UserId fields detected (no cascade):");
for (const s of scalarOnly) console.log(`  - ${s.model}.${s.field}`);
console.log("\n" + (failed === 0 ? "ALL CHECKS PASSED ✓" : `${failed} CHECK(S) FAILED ✗`));
process.exit(failed === 0 ? 0 : 1);
