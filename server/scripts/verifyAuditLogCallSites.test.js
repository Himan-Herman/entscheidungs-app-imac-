/**
 * Guard against a whole class of defect returning.
 *
 * `writeAuditLog` is best effort BY DESIGN: it returns `undefined`, not a
 * promise, and swallows its own write failures. Chaining `.catch()` onto it
 * therefore throws a TypeError AFTER the domain mutation has already committed —
 * the database row exists, the request answers 500, and the user is told the
 * opposite of what happened. That shipped in the appointment, booking,
 * telemedicine, integration, export, inbox and document paths simultaneously,
 * so a one-off fix is not enough: the pattern has to be unable to come back.
 *
 * `await`-ing it is harmless at runtime but states something untrue at the call
 * site, so it is reported too.
 *
 * Run: node --test scripts/verifyAuditLogCallSites.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  findAuditLogMisuse,
  stripComments,
  stripCommentsAndStrings,
} from "./lib/auditLogCallScanner.js";

const SERVER_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCANNED_DIRS = ["routes", "services", "middleware", "utils", "worker", "lib", "scripts"];

function collectFiles(dir, out = []) {
  const abs = path.join(SERVER_ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") collectFiles(rel, out);
    } else if (entry.name.endsWith(".js")) {
      out.push(rel);
    }
  }
  return out;
}

function scanRepository() {
  const findings = [];
  for (const rel of SCANNED_DIRS.flatMap((d) => collectFiles(d))) {
    const source = fs.readFileSync(path.join(SERVER_ROOT, rel), "utf8");
    findings.push(...findAuditLogMisuse(source, rel));
  }
  return findings;
}

/* ------------------------------------------------- the guard itself */

test("no promise chain is attached to writeAuditLog anywhere in the server", () => {
  const chains = scanRepository().filter((f) => f.kind === "chain");
  const report = chains.map((f) => `  ${f.file}:${f.line} — ${f.detail}`).join("\n");
  assert.equal(
    chains.length,
    0,
    `writeAuditLog returns undefined; chaining onto it throws AFTER the mutation has committed.\n` +
      `Remove the chain — the helper already swallows its own failures. If the audit MUST succeed,\n` +
      `use writeRequiredAuditLog instead.\n${report}`,
  );
});

test("writeAuditLog is never awaited", () => {
  const awaits = scanRepository().filter((f) => f.kind === "await");
  const report = awaits.map((f) => `  ${f.file}:${f.line}`).join("\n");
  assert.equal(
    awaits.length,
    0,
    `writeAuditLog is fire-and-forget; awaiting it waits for nothing and misleads the reader.\n${report}`,
  );
});

/* ------------------------- the guard must not be fooled or vacuous */

test("the guard detects a reintroduced chain", () => {
  const sample = `
    import { writeAuditLog } from "./auditLogService.js";
    export function doThing() {
      writeAuditLog({ action: "x" }).catch(() => {});
    }
  `;
  const found = findAuditLogMisuse(sample, "sample.js");
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, "chain");
});

test("the guard detects .then() and .finally() too", () => {
  for (const member of ["then", "finally"]) {
    const found = findAuditLogMisuse(`writeAuditLog({ a: 1 }).${member}(() => {});`);
    assert.equal(found.length, 1, `${member} must be caught`);
  }
});

test("the guard detects a multi-line call, the shape this actually shipped in", () => {
  const sample = `
    writeAuditLog({
      userId,
      action: "appointment_confirmed",
      metadata: { nested: { deep: true } },
    }).catch(() => {});
  `;
  const found = findAuditLogMisuse(sample);
  assert.equal(found.length, 1, "balanced-paren walking must survive nesting and newlines");
  assert.equal(found[0].kind, "chain");
});

test("the guard does NOT fire on documentation that mentions the pattern", () => {
  // The audit service's own JSDoc warns about exactly this, and so does this
  // test file. A regex over raw source would fail on both.
  const sample = `
    /**
     * Never chain writeAuditLog({...}).catch(...) onto this helper.
     */
    // writeAuditLog(x).then(y) is forbidden
    const help = "writeAuditLog({}).catch(() => {})";
    writeAuditLog({ action: "ok" });
  `;
  assert.deepEqual(findAuditLogMisuse(sample), []);
});

test("the guard does NOT fire on writeRequiredAuditLog, which does return a promise", () => {
  const sample = `
    await writeRequiredAuditLog({ action: "consent_granted" });
    writeRequiredAuditLog({ action: "x" }).catch(() => {});
  `;
  assert.deepEqual(findAuditLogMisuse(sample), []);
});

test("the guard actually scans a non-trivial number of files", () => {
  // Protects against the scan silently covering nothing — a guard that looks at
  // an empty file list would pass forever.
  const files = SCANNED_DIRS.flatMap((d) => collectFiles(d));
  assert.ok(files.length > 100, `expected the server tree, scanned only ${files.length} files`);
  assert.ok(
    files.some((f) => f.startsWith("routes/")) && files.some((f) => f.startsWith("services/")),
    "both routes and services must be in scope",
  );
});

test("comment stripping preserves offsets so reported lines stay accurate", () => {
  const src = `// comment\nwriteAuditLog({}).catch(() => {});\n`;
  assert.equal(stripCommentsAndStrings(src).length, src.length);
  assert.equal(findAuditLogMisuse(src)[0].line, 2);
});

/* ------------------------------------------------- required-audit policy */

/**
 * Mutations whose audit is mandatory, per the contract in auditLogService.js:
 * "creating/activating/revoking a care link, granting/revoking consent,
 * exporting or sharing patient data".
 *
 * Named by ACTION rather than by function, because the action string is what
 * actually appears in the audit row and is stable across refactors. Deliberately
 * narrow: observational events (opened, viewed, downloaded, queued, denied) stay
 * best effort — making every read mandatory would drown the guarantee.
 */
const REQUIRED_AUDIT_ACTIONS = [
  "consent_record_granted",
  "consent_record_revoked",
  "practice_patient_link_declined",
  "practice_patient_link_archived",
  "document_share_grant_created",
  "document_share_grant_revoked",
  // Issuing and cancelling a prescription. Named by the JSDoc on
  // writeRequiredAuditLog and already written with it — listed here so the
  // guard pins that, rather than leaving it to survive on good intentions.
  // This widens no policy: it records what the code already does.
  "erezept_issued",
  "erezept_cancelled",
];

test("mandatory-audit actions are never written with the best-effort helper", () => {
  const offenders = [];

  // Production call sites only: this very file lists the action names, and a
  // test naming an action is not a call site.
  const productionFiles = SCANNED_DIRS.flatMap((d) => collectFiles(d)).filter(
    (rel) => !rel.endsWith(".test.js"),
  );

  for (const rel of productionFiles) {
    // Comments only: the action names the guard looks for ARE string literals,
    // so blanking strings would make this search find nothing and pass vacuously.
    const source = stripComments(fs.readFileSync(path.join(SERVER_ROOT, rel), "utf8"));

    for (const action of REQUIRED_AUDIT_ACTIONS) {
      let idx = source.indexOf(`"${action}"`);
      while (idx !== -1) {
        // Walk back to whichever audit helper opened this call.
        const before = source.slice(Math.max(0, idx - 1500), idx);
        const bestEffort = before.lastIndexOf("writeAuditLog(");
        const required = before.lastIndexOf("writeRequiredAuditLog(");
        // writeRequiredAuditLog contains "writeAuditLog" as a substring only if
        // matched loosely, so compare positions: the later opener wins.
        if (bestEffort > required) {
          offenders.push(
            `${rel}:${source.slice(0, idx).split("\n").length} — ${action} uses writeAuditLog`,
          );
        }
        idx = source.indexOf(`"${action}"`, idx + 1);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These mutations must not be able to persist without their audit row.\n` +
      `Use writeRequiredAuditLog inside the same transaction as the mutation.\n${offenders.join("\n")}`,
  );
});

test("the policy list is not empty and names only actions that exist in the code", () => {
  assert.ok(REQUIRED_AUDIT_ACTIONS.length >= 6, "the policy must actually cover something");

  const allSource = SCANNED_DIRS.flatMap((d) => collectFiles(d))
    .map((rel) => fs.readFileSync(path.join(SERVER_ROOT, rel), "utf8"))
    .join("\n");

  for (const action of REQUIRED_AUDIT_ACTIONS) {
    assert.ok(
      allSource.includes(`"${action}"`),
      `${action} is in the policy list but no longer exists — remove it or fix the rename`,
    );
  }
});

test("the policy guard actually finds the action strings it searches for", () => {
  // Without this, a stripper that blanks string literals would make the guard
  // above pass on an empty search — which is exactly how it failed once.
  let found = 0;
  for (const rel of SCANNED_DIRS.flatMap((d) => collectFiles(d)).filter(
    (rel) => !rel.endsWith(".test.js"),
  )) {
    const source = stripComments(fs.readFileSync(path.join(SERVER_ROOT, rel), "utf8"));
    for (const action of REQUIRED_AUDIT_ACTIONS) {
      if (source.includes(`"${action}"`)) found += 1;
    }
  }
  assert.ok(found >= REQUIRED_AUDIT_ACTIONS.length, `only ${found} action occurrences seen`);
});
