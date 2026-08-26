/**
 * Phase 6c.1 — a stored inbox destination can never leave this origin.
 *
 * ── What is being defended ──────────────────────────────────────────────────
 * `targetUrl` is written into an inbox row when the notice is created, and the
 * client navigates to what the API hands back. React Router advisories through
 * 7.17.0 include open-redirect variants in `useNavigate`, and the router was
 * upgraded to 7.18.2 — but a destination that leaves the origin is not
 * something the router should have to defend against in the first place.
 *
 * ── Why the previous check was not enough ───────────────────────────────────
 * `safeInternalPath` used to require a leading `/` and reject `//`. That is the
 * obvious rule and it misses the case the advisory is about: a browser
 * normalises a backslash to a slash before resolving, so `/\evil.example`
 * becomes `//evil.example` and lands on another origin. Three such values
 * passed the old check and left the origin when measured against a real URL
 * parser. It now asks the parser instead.
 *
 * ── Read-time, not write-time ───────────────────────────────────────────────
 * Rows written before this exists cannot be trusted, and there is no migration:
 * every read goes through the derivation, so a hostile or stale value is
 * refused when it is read rather than cleaned up in place. These tests plant
 * hostile values directly in the database — the state a legacy row would be in
 * — and assert that nothing hostile survives the serializer.
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import crypto from "node:crypto";

const { prisma } = await import("../lib/prisma.js");
const { safeInternalPath, patientInboxTargetUrl } = await import(
  "../services/patientInbox/patientInboxTargets.js"
);
const { practiceInboxTargetUrl } = await import(
  "../services/practiceInbox/practiceInboxTargets.js"
);

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/** The base only exists so the parser has something to resolve against. */
const ORIGIN = "https://medscoutx.invalid";

/**
 * Values that genuinely move the origin, verified with the same parser a
 * browser uses. Asserting that a harmless path is "refused" would prove
 * nothing, so the list is checked before it is used.
 */
const LEAVES_ORIGIN = [
  ["absolute https", "https://evil.example/steal"],
  ["absolute http", "http://evil.example"],
  ["protocol-relative", "//evil.example/x"],
  ["double backslash", "\\\\evil.example"],
  ["backslash after slash", "/\\evil.example"],
  ["backslash then slash", "/\\/evil.example"],
  ["tab inside the path", "/\t/evil.example"],
  ["javascript scheme", "javascript:alert(document.cookie)"],
  ["data scheme", "data:text/html,<script>alert(1)</script>"],
  ["leading space then protocol-relative", "  //evil.example"],
];

test("the hostile list really is hostile", () => {
  for (const [label, value] of LEAVES_ORIGIN) {
    let origin;
    try {
      origin = new URL(value, ORIGIN).origin;
    } catch {
      origin = "(unparseable)";
    }
    assert.notEqual(origin, ORIGIN, `"${label}" stays internal — it does not belong in this list`);
  }
});

/* ═════════════════════════════════════════════════ the derivation itself */

test("safeInternalPath refuses every destination that leaves the origin", () => {
  for (const [label, value] of LEAVES_ORIGIN) {
    assert.equal(safeInternalPath(value), null, `${label} was accepted`);
  }
});

test("safeInternalPath keeps real in-app destinations", () => {
  for (const path of [
    "/patient/inbox",
    "/patient/messages/cm123",
    "/practice/patients/L1?practiceId=P1",
    "/patient/medication-plans/practice/cm456",
  ]) {
    assert.equal(safeInternalPath(path), path, `${path} was refused`);
  }
});

test("safeInternalPath does not over-block encodings that stay here", () => {
  // Refusing these would be a different bug: they resolve to this origin.
  for (const path of ["/%2f%2fevil.example", "/..//evil.example", "/a%20b"]) {
    assert.equal(safeInternalPath(path), path, `${path} was refused but is internal`);
  }
});

/* ═══════════════════════════ a hostile row cannot survive the serializer */

test("a hostile targetUrl on a KNOWN kind is ignored entirely", () => {
  /*
   * Known kinds are rebuilt from the source id, so the stored value has no say
   * at all. This is the stronger of the two protections and worth pinning
   * separately: it holds even if the same-origin check were removed.
   */
  for (const [, hostile] of LEAVES_ORIGIN) {
    const out = patientInboxTargetUrl({
      sourceRefType: "patient_thread",
      sourceRefId: "cm123",
      targetUrl: hostile,
    });
    assert.equal(out, "/patient/messages/cm123", `a stored value influenced a known kind`);
  }
});

test("a hostile targetUrl on an UNKNOWN kind is dropped, not passed through", () => {
  for (const [label, hostile] of LEAVES_ORIGIN) {
    const out = patientInboxTargetUrl({
      sourceRefType: "some_future_kind",
      sourceRefId: "x",
      targetUrl: hostile,
    });
    assert.equal(out, null, `${label} survived an unknown kind`);
  }
});

test("the practice side answers the same way", () => {
  for (const [label, hostile] of LEAVES_ORIGIN) {
    // Not relationship-bound, so the stored value is all there is.
    const out = practiceInboxTargetUrl({ targetUrl: hostile });
    assert.equal(out, null, `${label} survived on the practice side`);
  }

  // And a relationship-bound row ignores the stored value completely.
  const bound = practiceInboxTargetUrl({
    practicePatientLinkId: "L1",
    practiceProfileId: "P1",
    sourceRefType: "thread",
    targetUrl: "https://evil.example",
  });
  assert.equal(bound, "/practice/patients/L1/messages?practiceId=P1");
});

/* ══════════════════════════ the same thing, through the real database */

test("a hostile row planted in the database is neutralised on read", { skip }, async () => {
  const stamp = `${Date.now()}${crypto.randomInt(1e5)}`;
  const patient = await prisma.user.create({
    data: {
      email: `nav-${stamp}@test.invalid`,
      passwordHash: "x",
      firstName: "Nav",
      lastName: "Test",
      dateOfBirth: new Date("1980-01-01"),
      verified: true,
    },
  });

  try {
    // Exactly what a legacy or tampered row would look like: written straight
    // into the column, bypassing whatever the producers do today.
    const planted = [];
    for (const [, hostile] of LEAVES_ORIGIN) {
      planted.push(
        await prisma.patientInboxItem.create({
          data: {
            patientUserId: patient.id,
            type: "some_future_kind",
            title: "probe",
            targetUrl: hostile,
          },
        }),
      );
    }

    const rows = await prisma.patientInboxItem.findMany({
      where: { patientUserId: patient.id },
    });
    assert.equal(rows.length, LEAVES_ORIGIN.length, "the probe rows were not all created");

    for (const row of rows) {
      const derived = patientInboxTargetUrl({
        sourceRefType: row.type,
        sourceRefId: row.sourceRefId,
        targetUrl: row.targetUrl,
      });
      assert.equal(
        derived,
        null,
        `a stored hostile destination survived the read: ${JSON.stringify(row.targetUrl)}`,
      );
    }

    // The values really are still in the database — the protection is at read
    // time, and this test would otherwise pass because nothing was stored.
    const stored = rows.map((r) => r.targetUrl);
    assert.ok(
      stored.includes("/\\evil.example"),
      "the hostile value was rewritten on write; this test is measuring the wrong thing",
    );
  } finally {
    await prisma.user.deleteMany({ where: { email: `nav-${stamp}@test.invalid` } });
  }
});

test.after(async () => {
  if (dbAvailable) await prisma.$disconnect();
});
