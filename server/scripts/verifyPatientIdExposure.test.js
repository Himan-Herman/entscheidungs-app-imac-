/**
 * Practices must reference patients only through practice-scoped ids, and the
 * telemedicine session must derive its patient from the link instead of the
 * request body. Serializer output plus source guards — no database required.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = join(here, "..", "routes");

import { linkToJson } from "../services/careRelationship/practicePatientLinkService.js";

/* ------------------------ part 4: no global patientUserId in practice output */

test("practice-facing serializers expose no global patientUserId", () => {
  const link = linkToJson({
    id: "l1",
    practiceProfileId: "practice-1",
    patientUserId: "GLOBAL-USER-ID",
    status: "active",
    consentAcceptedAt: new Date("2026-01-01"),
    patientUser: { id: "GLOBAL-USER-ID", firstName: "E", lastName: "M", email: "e@x.org" },
  });
  const serialized = JSON.stringify(link);
  assert.ok(!("patientUserId" in link), "linkToJson must not carry patientUserId");
  assert.ok(!serialized.includes("GLOBAL-USER-ID"), "no global id anywhere in the payload");
  assert.equal(link.id, "l1", "the practice-scoped link id remains the reference");
});

/**
 * Slices a top-level `function name(...) { ... }` body out of a source file, so
 * the guard inspects the serializer only — database write payloads legitimately
 * carry patientUserId and must not trip this test.
 */
function functionBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} not found`);
  const end = src.indexOf("\n}", start);
  assert.notEqual(end, -1, `end of ${name} not found`);
  return src.slice(start, end);
}

test("no practice serializer reintroduces patientUserId", () => {
  const guarded = [
    [join(routesDir, "practiceFollowUps.js"), "threadJson"],
    [join(routesDir, "..", "services", "telemedicine", "telemedicineService.js"), "sessionToJson"],
    [
      join(routesDir, "..", "services", "careRelationship", "practicePatientLinkService.js"),
      "linkToJson",
    ],
  ];
  for (const [file, label] of guarded) {
    const body = functionBody(readFileSync(file, "utf8"), label);
    assert.ok(
      !/^\s*patientUserId:/m.test(body),
      `${label} must not serialize patientUserId`,
    );
    assert.ok(
      !/^\s*id: (user|row)\.(userId|patientUserId)/m.test(body),
      `${label} must not serialize the global id under another key`,
    );
  }
});

test("telemedicine derives the patient from the link, never from the body", () => {
  const src = readFileSync(
    join(routesDir, "..", "services", "telemedicine", "telemedicineService.js"),
    "utf8",
  );
  assert.ok(
    !/patientUserId: body\.patientUserId/.test(src),
    "body.patientUserId must not be trusted",
  );
  assert.ok(
    /practicePatientLink\.findFirst/.test(src),
    "the link must be re-checked against the practice",
  );
});

