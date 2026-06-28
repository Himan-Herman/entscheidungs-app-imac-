/**
 * Structural verification for the data-request honesty guard (GDPR Art. 17, K5).
 *
 * No database required. Asserts that:
 *   1) a "deletion" request cannot be marked "completed" without a real erasure;
 *   2) the route surfaces that as a clear 409 (not a silent success / 500);
 *   3) "export" and "access_restriction" completion are NOT blocked;
 *   4) PatientDataRequest cascades on account erasure (K4 cross-check);
 *   5) no raw health data is written to audit metadata in this path.
 *
 * Run: node scripts/verifyDataRequestHonesty.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const svc = fs.readFileSync(
  path.join(here, "../services/patientDataControl/patientDataRequestService.js"),
  "utf8"
);
const route = fs.readFileSync(path.join(here, "../routes/practiceDataRequests.js"), "utf8");
const schema = fs.readFileSync(path.join(here, "../prisma/schema.prisma"), "utf8");

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

// 1) deletion + completed is blocked in the service.
check(
  'Service blocks deletion -> completed without erasure',
  /row\.type\s*===\s*"deletion"\s*&&\s*status\s*===\s*"completed"[\s\S]{0,80}throw new Error\("deletion_requires_manual_erasure"\)/.test(
    svc
  ),
  "throws deletion_requires_manual_erasure"
);

// 2) Route maps the guard error to 409 (honest client signal), not 500.
check(
  "Route maps deletion_requires_manual_erasure -> 409",
  /deletion_requires_manual_erasure"\)\s*return\s*\{\s*status:\s*409/.test(route),
  "client sees an explicit conflict, not a silent success"
);

// 3) The guard is scoped to deletion only — export / access_restriction unaffected.
check(
  "Guard is scoped to deletion only (export/access_restriction not blocked)",
  !/"export"[\s\S]{0,40}deletion_requires_manual_erasure/.test(svc) &&
    !/"access_restriction"[\s\S]{0,40}deletion_requires_manual_erasure/.test(svc),
  "only type === 'deletion' is guarded"
);

// 4) K4 cross-check: PatientDataRequest.patientUser cascades on user delete.
const pdrBlock = (schema.match(/model\s+PatientDataRequest\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
check(
  "PatientDataRequest cascades on account erasure (patientUser onDelete: Cascade)",
  /patientUser\s+User\s+@relation\([^)]*onDelete:\s*Cascade/.test(pdrBlock),
  "deletion requests are removed automatically when the account is erased (K4)"
);

// 5) No raw health-data fields written into audit metadata in this service.
check(
  "Audit metadata carries no raw health fields",
  !/metadata:\s*\{[^}]*(symptom|diagnosis|allerg|medication|reason:\s*row\.reason)/i.test(svc),
  "only ids / status transitions are logged"
);

let failed = 0;
console.log("\nData-request honesty verification\n" + "=".repeat(40));
for (const r of results) {
  const tag = r.ok ? "PASS" : "FAIL";
  if (!r.ok) failed++;
  console.log(`[${tag}] ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
}
console.log("\n" + (failed === 0 ? "ALL CHECKS PASSED ✓" : `${failed} CHECK(S) FAILED ✗`));
process.exit(failed === 0 ? 0 : 1);
