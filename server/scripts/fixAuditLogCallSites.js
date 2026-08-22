#!/usr/bin/env node
/**
 * Removes misuse of the fire-and-forget audit helper.
 *
 * Two transformations, both mechanical and both semantics-preserving:
 *
 *   writeAuditLog({...}).catch(() => {});  ->  writeAuditLog({...});
 *     The chain throws a TypeError on `undefined` AFTER the domain mutation has
 *     committed. Removing it restores the intended best-effort behaviour; the
 *     helper already swallows its own write failures.
 *
 *   await writeAuditLog({...});            ->  writeAuditLog({...});
 *     `await undefined` is a no-op, so this changes no behaviour — but the
 *     keyword tells every future reader that the audit is awaited, which it is
 *     not. Removing it keeps the call site honest about the contract.
 *
 * Edits are applied at the exact offsets the scanner reports, back to front so
 * earlier offsets stay valid, and never by pattern substitution over raw text —
 * that would also rewrite comments and documentation.
 *
 * Usage:
 *   node scripts/fixAuditLogCallSites.js --dry-run
 *   node scripts/fixAuditLogCallSites.js
 */

import fs from "node:fs";
import path from "node:path";
import { findAuditLogMisuse } from "./lib/auditLogCallScanner.js";

const ROOTS = ["routes", "services", "middleware", "utils", "worker", "lib", "scripts"];
const DRY = process.argv.includes("--dry-run");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(p, out);
    } else if (entry.name.endsWith(".js")) {
      out.push(p);
    }
  }
  return out;
}

let files = 0;
let chains = 0;
let awaits = 0;

for (const file of ROOTS.flatMap((r) => walk(r))) {
  const source = fs.readFileSync(file, "utf8");
  let next = source;

  // Repeat until stable: with several calls close together, removing one span
  // can bring the next into view, so a single pass is not guaranteed to be
  // complete. Bounded so a pathological file cannot loop forever.
  for (let pass = 0; pass < 10; pass += 1) {
    const findings = findAuditLogMisuse(next, file).filter(
      (f) => f.start >= 0 && f.end > f.start,
    );
    if (findings.length === 0) break;
    for (const f of [...findings].sort((a, b) => b.start - a.start)) {
      next = next.slice(0, f.start) + next.slice(f.end);
      if (f.kind === "chain") chains += 1;
      else awaits += 1;
    }
  }
  if (next === source) continue;

  // A removed chain leaves `});` on its own — nothing else changes, so the
  // file is written back verbatim apart from the deleted spans.
  if (next !== source) {
    files += 1;
    if (!DRY) fs.writeFileSync(file, next);
  }
}

console.log(
  `${DRY ? "[dry run] " : ""}${files} file(s): removed ${chains} promise chain(s) and ${awaits} await(s).`,
);
