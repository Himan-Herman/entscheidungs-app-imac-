/**
 * Regression guard for Task-2 Fix 3: the back link "Zur Praxis-Übersicht" must
 * point to the real overview route "/practice". The route "/practice/hub" does
 * NOT exist, so any link to it falls through the catch-all route and bounces the
 * user to the start page. This test fails if "/practice/hub" reappears anywhere
 * in the client source.
 * Run: node --test client/src/__tests__/practiceBackNavigation.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, ".."); // client/src

function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "__tests__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(jsx?|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

test("no client source links to the non-existent /practice/hub route", () => {
  const offenders = [];
  for (const file of collectSourceFiles(SRC_DIR)) {
    const content = readFileSync(file, "utf8");
    if (content.includes("/practice/hub")) {
      offenders.push(path.relative(SRC_DIR, file));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `These files link to the dead route /practice/hub (use /practice):\n${offenders.join("\n")}`,
  );
});
