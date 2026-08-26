/**
 * A stored destination can only send the browser somewhere inside this app.
 *
 * ── What this is defending ──────────────────────────────────────────────────
 * Two places in the product navigate to a value that came out of the database:
 * a patient inbox notice and a header notification. Everything else navigates
 * to a literal or a path the component built itself.
 *
 * React Router advisories up to 7.17.0 include open-redirect variants in
 * `<Link>` and `useNavigate`; 7.18.2 fixes them. This suite covers the belt
 * beside that upgrade — the destination is checked before the router is asked
 * to follow it.
 *
 * ── The cases that matter, and why the obvious check misses them ────────────
 * "starts with / and not //" looks sufficient and is not. A browser normalises
 * a backslash to a slash BEFORE resolving, so `/\evil.example` becomes
 * `//evil.example` and leaves the origin. That is the CVE-2025-68470 bypass,
 * and it is why this checks with the URL parser rather than with characters:
 * the parser is the same one that will follow the link.
 *
 * The expectations below are not guesses. Each hostile value was resolved
 * against a real origin first, and only those that actually moved the origin
 * are asserted as rejected — see the `LEAVES_ORIGIN` table.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { safeInternalPath, navigateInternal } = await import("../safeNavigation.js");

/** No `window` in this runtime, so the module's fallback origin is in play. */
const ORIGIN = "https://medscoutx.invalid";

/* ────────────────────────────────────────── destinations the app produces */

const INTERNAL = [
  "/patient/inbox",
  "/practice/patients/L1?practiceId=P1",
  "/patient/messages/cm123",
  "/patient/medication-plans/practice/cm456",
  "/patient/practice-documents/cm789",
  "/patient/telemedicine/cm000",
  "/practice/patients/L1/messages?practiceId=P1",
];

test("a real in-app destination is followed", () => {
  for (const path of INTERNAL) {
    assert.equal(safeInternalPath(path), path, `${path} was refused`);
  }
});

/* ─────────────────────────────────────────────────── hostile destinations */

/**
 * Values that genuinely move the origin when a browser resolves them.
 *
 * Measured with the same WHATWG parser the browser uses, against a real base,
 * rather than assumed from their shape.
 */
const LEAVES_ORIGIN = [
  ["absolute https", "https://evil.example"],
  ["absolute http", "http://evil.example"],
  ["protocol-relative", "//evil.example"],
  ["double backslash", "\\\\evil.example"],
  ["backslash after slash", "/\\evil.example"],
  ["backslash then slash", "/\\/evil.example"],
  ["tab inside the path", "/\t/evil.example"],
  ["javascript scheme", "javascript:alert(1)"],
  ["data scheme", "data:text/html,<script>alert(1)</script>"],
  ["leading whitespace then protocol-relative", "  //evil.example"],
  ["uppercase scheme", "HTTPS://evil.example"],
  ["scheme with newline", "java\nscript:alert(1)"],
];

test("the hostile list really is hostile", () => {
  /*
   * The premise of every rejection below. If one of these resolves to this
   * origin after all, asserting that it is refused proves nothing about
   * open redirects — it would just be a rule refusing a harmless path.
   */
  for (const [label, value] of LEAVES_ORIGIN) {
    let origin = null;
    try {
      origin = new URL(value, ORIGIN).origin;
    } catch {
      origin = "(unparseable)";
    }
    assert.notEqual(
      origin,
      ORIGIN,
      `"${label}" stays on this origin (${origin}) — it does not belong in this list`,
    );
  }
});

test("nothing that leaves the origin is followed", () => {
  for (const [label, value] of LEAVES_ORIGIN) {
    assert.equal(safeInternalPath(value), null, `${label} was accepted: ${JSON.stringify(value)}`);
  }
});

test("a non-string destination is refused", () => {
  for (const value of [null, undefined, 0, 1, {}, [], true, () => {}]) {
    assert.equal(safeInternalPath(value), null, `${typeof value} was accepted`);
  }
});

test("an empty or relative destination is refused", () => {
  // A path is what the router is given; a bare word would resolve against
  // whatever page happens to be open.
  for (const value of ["", "   ", "patient/inbox", "./inbox", "../inbox", "#anchor", "?q=1"]) {
    assert.equal(safeInternalPath(value), null, `${JSON.stringify(value)} was accepted`);
  }
});

test("encodings that stay on this origin are still allowed", () => {
  // Refusing these would be over-blocking: they resolve here. The rule is
  // "does it leave", not "does it look unusual".
  for (const value of ["/%2f%2fevil.example", "/..//evil.example", "/a%20b", "/x?y=%2F%2Fz"]) {
    assert.equal(safeInternalPath(value), value, `${value} was refused but stays internal`);
  }
});

/* ─────────────────────────────────────── the navigation wrapper itself */

test("navigateInternal calls the router for an internal destination", () => {
  const calls = [];
  const ok = navigateInternal((to) => calls.push(to), "/patient/inbox");
  assert.equal(ok, true);
  assert.deepEqual(calls, ["/patient/inbox"]);
});

test("navigateInternal never calls the router for a hostile destination", () => {
  for (const [label, value] of LEAVES_ORIGIN) {
    const calls = [];
    const warn = console.warn;
    console.warn = () => {};
    try {
      const ok = navigateInternal((to) => calls.push(to), value);
      assert.equal(ok, false, `${label} reported success`);
      assert.deepEqual(calls, [], `${label} reached the router`);
    } finally {
      console.warn = warn;
    }
  }
});

test("navigateInternal is quiet about an absent destination", () => {
  // A notice with no destination is ordinary — it just is not clickable — and
  // should not fill the console.
  let warned = false;
  const warn = console.warn;
  console.warn = () => {
    warned = true;
  };
  try {
    assert.equal(navigateInternal(() => {}, null), false);
    assert.equal(navigateInternal(() => {}, ""), false);
  } finally {
    console.warn = warn;
  }
  assert.equal(warned, false, "an absent destination was logged as a refusal");
});

/* ─────────────────────────── the real call sites go through this */

test("both data-driven navigations use the guard", async () => {
  /*
   * The two places that navigate to a stored value. A third one appearing
   * without this guard is exactly what this catches — by not being here.
   */
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

  const SITES = [
    ["notification centre", "features/notificationCenter/components/NotificationCenter.jsx"],
    ["patient inbox", "features/patientInbox/pages/PatientInboxPage.jsx"],
  ];
  for (const [label, rel] of SITES) {
    const src = readFileSync(join(SRC, rel), "utf8");
    assert.match(src, /navigateInternal\(navigate,/, `${label} no longer uses the guard`);
    assert.ok(
      !/\bnavigate\((path|item\.targetUrl)\)/.test(src),
      `${label} navigates to a stored value directly again`,
    );
  }
});
