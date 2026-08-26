/**
 * The router stays past the open-redirect advisories.
 *
 * ── Why a version is worth a test ───────────────────────────────────────────
 * `react-router` was vulnerable through 7.17.0 to several open-redirect
 * variants in `<Link>` and `useNavigate`. The obvious remediation — bumping to
 * the first patched-looking 7.11.x — would NOT have been enough: the advisory
 * range runs to 7.17.0, and only 7.18.0 and later clear all of it. That is an
 * easy thing to get wrong twice, which is why the floor is written down rather
 * than remembered.
 *
 * The application-level guard (safeNavigation.js) is the belt beside this, not
 * a replacement for it: it protects the two places that navigate to stored
 * values, while the router version protects every `<Link>` in the product.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** The first release above the advisory range `6.0.0 - 7.17.0`. */
const MINIMUM = [7, 18, 0];

const parse = (v) => String(v).replace(/^[^\d]*/, "").split(".").slice(0, 3).map(Number);
const atLeast = (v, min) => {
  const p = parse(v);
  for (let i = 0; i < 3; i++) {
    if (p[i] > min[i]) return true;
    if (p[i] < min[i]) return false;
  }
  return true;
};

test("both router packages are declared past the advisory range", () => {
  const pkg = JSON.parse(readFileSync(join(CLIENT, "package.json"), "utf8"));
  for (const name of ["react-router", "react-router-dom"]) {
    const declared = pkg.dependencies?.[name];
    assert.ok(declared, `${name} is not a declared dependency`);
    assert.ok(
      atLeast(declared, MINIMUM),
      `${name} is declared as ${declared}; the advisory range ends at 7.17.0, so ${MINIMUM.join(".")} is the floor`,
    );
  }
});

test("no resolved copy in the lockfile is still in the advisory range", () => {
  /*
   * The declaration is a range; what actually ships is what the lockfile
   * resolved. A second copy hoisted under another dependency would be
   * invisible to the check above and is exactly what this catches.
   */
  const lock = JSON.parse(readFileSync(join(CLIENT, "package-lock.json"), "utf8"));
  const copies = Object.entries(lock.packages ?? {}).filter(
    ([p]) => /(^|\/)node_modules\/react-router(-dom)?$/.test(p),
  );
  assert.ok(copies.length > 0, "the router is not in the lockfile at all");

  const stale = copies
    .filter(([, meta]) => meta.version && !atLeast(meta.version, MINIMUM))
    .map(([p, meta]) => `${p}@${meta.version}`);
  assert.deepEqual(stale, [], `these resolved copies are still vulnerable:\n  ${stale.join("\n  ")}`);
});

test("the app uses only declarative router APIs", () => {
  /*
   * Most of the advisories are framework-mode and SSR only — RSC redirects,
   * single-fetch, Server Actions, ScrollRestoration, the `__manifest`
   * endpoint. None of that applies while the app mounts a plain
   * `BrowserRouter`, and the report says so.
   *
   * That claim has to keep being true. Adopting `createBrowserRouter` or a
   * data router would bring the rest of the advisory surface into scope and
   * this test would be the place it is noticed.
   */
  const main = readFileSync(join(CLIENT, "src", "main.jsx"), "utf8");
  assert.match(main, /<BrowserRouter>/, "the app no longer mounts BrowserRouter");
  for (const api of ["createBrowserRouter", "RouterProvider", "ScrollRestoration", "HydratedRouter"]) {
    assert.ok(
      !new RegExp(`\\b${api}\\b`).test(main),
      `main.jsx now uses ${api} — the framework-mode advisories become relevant`,
    );
  }
});
