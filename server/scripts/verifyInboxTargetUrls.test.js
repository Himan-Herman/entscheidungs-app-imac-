/**
 * Every patient inbox notice must lead to a route that exists.
 *
 * `targetUrl` is written when a notice is created, so a route rename leaves
 * every existing notice pointing at a path that no longer resolves. That was
 * not hypothetical: medication notices stored `/patient/medication-plans/<id>`
 * while the patient route has always been
 * `/patient/medication-plans/practice/<id>`.
 *
 * Two things are checked here:
 *   1. every path a producer WRITES matches a route in the client router,
 *   2. the read path reconstructs the destination for the kinds it can, so a
 *      notice written before the fix still leads somewhere.
 *
 * The router is parsed rather than hard-coded: a test that lists the routes
 * itself would keep passing after a rename, which is exactly the failure it is
 * supposed to catch.
 *
 * Run: node --test scripts/verifyInboxTargetUrls.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  patientInboxTargetUrl,
  safeInternalPath,
} from "../services/patientInbox/patientInboxTargets.js";
import { stripComments } from "./lib/auditLogCallScanner.js";

const ROUTER = "../client/src/main.jsx";

/** Every `path="..."` the client router declares. */
function declaredRoutes() {
  const src = readFileSync(ROUTER, "utf8");
  const routes = [...src.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
  return routes.filter((r) => r.startsWith("/"));
}

/** Does a concrete path match any declared route pattern? */
function routeExists(candidate, routes) {
  const clean = candidate.split("?")[0].replace(/\/+$/, "") || "/";
  return routes.some((pattern) => {
    if (pattern === "*") return false;
    const rx = new RegExp(
      `^${pattern
        .replace(/\/+$/, "")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/:[A-Za-z0-9_]+/g, "[^/]+")}$`,
    );
    return rx.test(clean);
  });
}

/** Every literal patient path a producer builds, with its source file. */
function producedPatientPaths() {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".js")) continue;
      // Comments stripped first: the fix for the dead medication link QUOTES the
      // old path in a comment, and scanning the raw file finds that quote and
      // reports the bug as still present.
      const src = stripComments(readFileSync(full, "utf8"));
      if (!src.includes("notifyPatientInbox")) continue;

      // Template literals and plain strings assigned to a patient path.
      for (const m of src.matchAll(/[`"'](\/patient\/[^`"'\s]*)[`"']/g)) {
        found.push({ file: full, raw: m[1] });
      }
    }
  };
  walk("services");
  return found;
}

/** Replaces `${...}` placeholders with a concrete-looking id. */
const concrete = (raw) => raw.replace(/\$\{[^}]*\}/g, "abc123");

test("the router is actually being read", () => {
  // Without this the route check below would pass on an empty list.
  const routes = declaredRoutes();
  assert.ok(routes.length > 40, `expected the client routes, parsed ${routes.length}`);
  assert.ok(routes.includes("/patient/medication-plans/practice/:planId"));
});

test("every patient path an inbox producer writes matches a real route", () => {
  const routes = declaredRoutes();
  const produced = producedPatientPaths();
  assert.ok(produced.length >= 5, `expected the producers' paths, found ${produced.length}`);

  const dead = produced
    .filter(({ raw }) => !routeExists(concrete(raw), routes))
    .map(({ file, raw }) => `${raw}  (${file})`);

  assert.deepEqual(dead, [], "these inbox notices would lead to a route that does not exist");
});

test("a medication notice leads to the route that exists", () => {
  const routes = declaredRoutes();
  const url = patientInboxTargetUrl({
    sourceRefType: "medication_plan",
    sourceRefId: "plan-1",
    targetUrl: "/patient/medication-plans/plan-1",
  });

  assert.equal(url, "/patient/medication-plans/practice/plan-1");
  assert.ok(routeExists(url, routes), "and that route is declared");
  // The dead stored value must not decide where this navigates.
  assert.equal(routeExists("/patient/medication-plans/plan-1", routes), false);
});

test("a stale stored value cannot decide a known kind's destination", () => {
  for (const [sourceRefType, expected] of [
    ["patient_thread", "/patient/messages/x1"],
    ["medication_plan", "/patient/medication-plans/practice/x1"],
    ["practice_document", "/patient/practice-documents/x1"],
    ["telemedicine_session", "/patient/telemedicine/x1"],
  ]) {
    const url = patientInboxTargetUrl({
      sourceRefType,
      sourceRefId: "x1",
      targetUrl: "/patient/somewhere-else",
    });
    assert.equal(url, expected, `${sourceRefType} must be reconstructed, not replayed`);
  }
});

test("kinds without a reconstructable path keep their stored destination", () => {
  // Appointments and data requests carry query parameters rather than an id in
  // the path, so their stored value is still the right answer.
  assert.equal(
    patientInboxTargetUrl({
      sourceRefType: "appointment",
      sourceRefId: "a1",
      targetUrl: "/patient/appointments?appointmentId=a1",
    }),
    "/patient/appointments?appointmentId=a1",
  );
  assert.equal(
    patientInboxTargetUrl({
      sourceRefType: "data_request",
      sourceRefId: "d1",
      targetUrl: "/patient/data-control?linkId=l1",
    }),
    "/patient/data-control?linkId=l1",
  );
});

test("a notice with nothing usable gets no destination", () => {
  assert.equal(patientInboxTargetUrl({ sourceRefType: "unknown_kind" }), null);
  assert.equal(patientInboxTargetUrl({}), null);
  assert.equal(
    patientInboxTargetUrl({ sourceRefType: "medication_plan", sourceRefId: "  " }),
    null,
    "a known kind without a source id must not build a path ending in nothing",
  );
});

/* ================================================================ Security */

test("a stored destination that is not a same-origin path is refused", () => {
  for (const hostile of [
    "https://evil.example/steal",
    "//evil.example/steal",
    "javascript:alert(1)",
    "http://localhost:3000/patient/inbox",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(safeInternalPath(hostile), null, `${String(hostile)} must be refused`);
    assert.equal(
      patientInboxTargetUrl({ sourceRefType: "unknown_kind", targetUrl: hostile }),
      null,
      `${String(hostile)} must not reach the client`,
    );
  }
});

test("a same-origin path is kept as it is", () => {
  assert.equal(safeInternalPath("/patient/appointments?x=1"), "/patient/appointments?x=1");
  assert.equal(safeInternalPath("  /patient/inbox  "), "/patient/inbox");
});

test("the reconstruction escapes the source id", () => {
  const url = patientInboxTargetUrl({
    sourceRefType: "patient_thread",
    sourceRefId: "a/../../etc",
  });
  assert.equal(url, "/patient/messages/a%2F..%2F..%2Fetc", "a traversal must not survive as a path");
});

/* ================================= The practice context stays untouched */

test("the practice-context inbox does not use the stored destination at all", () => {
  // Phase 2G.1 builds its destinations from the authorized link. This fix must
  // not have reintroduced the stored value there.
  const src = readFileSync("services/patientInbox/patientInboxContextService.js", "utf8");
  assert.equal(
    /targetUrl:\s*row\.targetUrl/.test(src),
    false,
    "the context response must never carry the stored destination",
  );
  assert.ok(
    src.includes("scopedTargetPath"),
    "it builds its own path from the authorized link",
  );
});
