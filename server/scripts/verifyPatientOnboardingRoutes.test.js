/**
 * REAL HTTP tests for practice-initiated patient onboarding.
 *
 * Boots an Express app with the real routers, the real requireAuth middleware
 * and real JWTs over a real socket. Only Prisma is replaced by an in-memory
 * adapter, so no database is involved.
 *
 * What this suite is about is the contract at the HTTP boundary: who may act,
 * whose rows they may touch, what leaves the process, and what an outsider can
 * learn from a failure. Transactional behaviour — the partial unique index, the
 * regeneration race — cannot be proved without a real database and is covered in
 * verifyPatientOnboardingLifecycle.test.js.
 *
 * Run: node --test scripts/verifyPatientOnboardingRoutes.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-onboarding-routes";
process.env.PATIENT_ONBOARDING_V2 = "true";
// Every request here comes from one loopback address; without these the suite
// would throttle itself instead of testing the endpoints. The limiters' own
// behaviour is asserted separately at the bottom of this file.
process.env.INVITATION_ISSUE_IP_MAX = "5000";
process.env.INVITATION_PREVIEW_IP_MAX = "5000";
process.env.INVITATION_MANUAL_CODE_IP_MAX = "5000";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { hashInvitationToken, hashManualCode } from "../services/patientOnboarding/invitationTokens.js";

/* ------------------------------------------------------------------ actors */

const PRACTICE_A = "practice-A";
const PRACTICE_B = "practice-B";
const PRACTICE_OFF = "practice-off";

const OWNER_A = "user-owner-a";       // owner of A            → read + write
const VIEWER_A = "user-viewer-a";     // active viewer of A    → read only
const REVOKED_A = "user-revoked-a";   // membership revoked    → nothing
const OWNER_B = "user-owner-b";       // owner of B
const OWNER_OFF = "user-owner-off";   // owner of the inactive practice
const STRANGER = "user-stranger";     // member of nothing

/* ------------------------------------------------------------- prisma fake */

let practices = [];
let members = [];
let entries = [];
let invitations = [];
let auditRows = [];
let seq = 0;

function reset() {
  seq = 0;
  practices = [
    { id: PRACTICE_A, userId: OWNER_A, isActive: true, practiceName: "Praxis A",
      displayNameForPatients: null, logoUrl: null, logoStorageKey: null, logoMimeType: null,
      accentColor: null, patientIntroText: "Willkommen", specialty: "Allgemeinmedizin", city: "Berlin" },
    { id: PRACTICE_B, userId: OWNER_B, isActive: true, practiceName: "Praxis B",
      displayNameForPatients: null, logoUrl: null, logoStorageKey: null, logoMimeType: null,
      accentColor: null, patientIntroText: null, specialty: null, city: null },
    { id: PRACTICE_OFF, userId: OWNER_OFF, isActive: false, practiceName: "Praxis Off",
      displayNameForPatients: null, logoUrl: null, logoStorageKey: null, logoMimeType: null,
      accentColor: null, patientIntroText: null, specialty: null, city: null },
  ];
  members = [
    { id: "m1", practiceProfileId: PRACTICE_A, userId: VIEWER_A, role: "viewer",
      status: "active", clinicalRole: null, clinicalRoleStatus: null },
    { id: "m2", practiceProfileId: PRACTICE_A, userId: REVOKED_A, role: "admin",
      status: "revoked", clinicalRole: null, clinicalRoleStatus: null },
  ];
  entries = [];
  invitations = [];
  auditRows = [];
}

const id = (p) => `${p}-${(seq += 1)}`;
const matches = (row, where) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("not" in v) return row[k] !== v.not;
      if ("gt" in v) return new Date(row[k]) > new Date(v.gt);
      if ("contains" in v) {
        return String(row[k] ?? "").toLowerCase().includes(String(v.contains).toLowerCase());
      }
    }
    return row[k] === v;
  });

const pick = (row, select) =>
  Object.fromEntries(
    Object.entries(select)
      .filter(([, want]) => want)
      .map(([k, want]) => [k, typeof want === "object" ? row[k] : row[k]]),
  );

prisma.practiceProfile = {
  findUnique: async ({ where, select }) => {
    const p = practices.find((x) => x.id === where.id);
    if (!p) return null;
    return select ? pick(p, select) : p;
  },
};
prisma.practiceMember = {
  findUnique: async ({ where }) => {
    const k = where.practiceProfileId_userId;
    return members.find((m) => m.practiceProfileId === k.practiceProfileId && m.userId === k.userId) ?? null;
  },
};
prisma.practicePatientEntry = {
  findFirst: async ({ where }) => entries.find((e) => matches(e, where)) ?? null,
  findMany: async ({ where, take }) => entries.filter((e) => matches(e, where)).slice(0, take ?? 100),
  count: async ({ where }) => entries.filter((e) => matches(e, where)).length,
  create: async ({ data }) => {
    const row = { id: id("entry"), createdAt: new Date(), updatedAt: new Date(),
      linkedAt: null, archivedAt: null, practicePatientLinkId: null, ...data };
    entries.push(row);
    return row;
  },
  update: async ({ where, data }) => {
    const row = entries.find((e) => e.id === where.id);
    Object.assign(row, data);
    return row;
  },
};
prisma.practicePatientInvitation = {
  findFirst: async ({ where }) => invitations.find((i) => matches(i, where)) ?? null,
  findUnique: async ({ where, select }) => {
    const i = invitations.find((x) =>
      (where.id && x.id === where.id) ||
      (where.tokenHash && x.tokenHash === where.tokenHash) ||
      (where.manualCodeHash && x.manualCodeHash && x.manualCodeHash === where.manualCodeHash));
    if (!i) return null;
    if (!select) return i;
    const out = pick(i, select);
    if (select.practiceProfile) {
      const p = practices.find((x) => x.id === i.practiceProfileId);
      out.practiceProfile = p ? { ...p } : null;
    }
    return out;
  },
  findMany: async ({ where, take }) => invitations.filter((i) => matches(i, where)).slice(0, take ?? 100),
  create: async ({ data }) => {
    const row = { id: id("inv"), createdAt: new Date(), updatedAt: new Date(),
      tokenPrefix: null, manualCodeHash: null, manualCodeExpiresAt: null,
      redeemedAt: null, redeemedByUserId: null, revokedAt: null, revokedByUserId: null,
      supersededAt: null, deliveryChannel: null, ...data };
    invitations.push(row);
    return row;
  },
  update: async ({ where, data }) => {
    const row = invitations.find((i) => i.id === where.id);
    Object.assign(row, data);
    return row;
  },
  updateMany: async ({ where, data }) => {
    const hit = invitations.filter((i) => matches(i, where));
    hit.forEach((i) => Object.assign(i, data));
    return { count: hit.length };
  },
};
prisma.auditLog = { create: async ({ data }) => { auditRows.push(data); return data; } };
/*
 * The writers take a row lock on the entry as their first statement (L1 of the
 * shared lock order). There is nothing to lock in memory, but the statement is
 * not decoration: it also resolves the entry tenant-scoped and refuses a foreign
 * one, so the fake has to answer it — and answer it the same way the database
 * would, or the tenant tests here would stop meaning anything.
 *
 * Called as a tagged template, so the interpolated values arrive as arguments:
 * [entryId, practiceProfileId].
 */
prisma.$queryRaw = async (_strings, entryId, practiceProfileId) => {
  const row = entries.find(
    (e) => e.id === entryId && e.practiceProfileId === practiceProfileId,
  );
  return row
    ? [{
        id: row.id,
        status: row.status,
        linkedAt: row.linkedAt,
        practicePatientLinkId: row.practicePatientLinkId,
        practiceProfileId: row.practiceProfileId,
      }]
    : [];
};
// The fake runs the callback against itself. That is enough to exercise the
// route contract; it deliberately does NOT model rollback, which is why the
// atomicity claims are proved against a real database elsewhere.
prisma.$transaction = async (fn) => fn(prisma);

const { default: practicePatientEntriesRouter } = await import("../routes/practicePatientEntries.js");
const { default: practicePatientInvitationsRouter } = await import("../routes/practicePatientInvitations.js");
const { default: publicPatientInvitationsRouter } = await import("../routes/publicPatientInvitations.js");

/* ---------------------------------------------------------------- harness */

const app = express();
app.use(express.json());
app.use("/api/practice/patient-entries", requireAuth, practicePatientEntriesRouter);
app.use("/api/practice/patient-invitations", requireAuth, practicePatientInvitationsRouter);
app.use("/api/public/patient-invitations", publicPatientInvitationsRouter);

const server = app.listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => server.close());

const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "10m" });

async function call(method, path, { userId = OWNER_A, body, auth = true } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: `Bearer ${token(userId)}` } : {}),
    },
    // GET/HEAD may carry no body; passing one is a fetch error, not a test result.
    ...(body === undefined || method === "GET" || method === "HEAD"
      ? {}
      : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const NEW_PATIENT = { givenName: "Anna", familyName: "Müller", dateOfBirth: "1980-05-04" };

/**
 * The ONLY way this suite talks to the public preview. It takes a token and puts
 * it in a body — there is no variant that puts it in a URL, which is the point.
 */
async function preview(token) {
  const res = await fetch(`${base}/api/public/patient-invitations/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})), url: res.url };
}

/** The public typed-code check. Body only, same as the preview. */
async function checkCode(code) {
  const res = await fetch(`${base}/api/public/patient-invitations/manual-code/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})), url: res.url };
}

/** Create an entry in `practiceId` directly, bypassing HTTP. */
function seedEntry(practiceProfileId, over = {}) {
  const row = {
    id: id("entry"), practiceProfileId, givenName: "Max", familyName: "Beispiel",
    dateOfBirth: null, email: null, phone: null, practiceRecordNumber: null,
    status: "draft", linkedAt: null, archivedAt: null, practicePatientLinkId: null,
    createdByUserId: null, createdAt: new Date(), updatedAt: new Date(), ...over,
  };
  entries.push(row);
  return row;
}

/* ------------------------------------------------------- authentication */

test.beforeEach(reset);

test("every practice route refuses an unauthenticated caller", async () => {
  const e = seedEntry(PRACTICE_A);
  const routes = [
    ["POST", "/api/practice/patient-entries"],
    ["GET", `/api/practice/patient-entries?practiceId=${PRACTICE_A}`],
    ["GET", `/api/practice/patient-entries/${e.id}?practiceId=${PRACTICE_A}`],
    ["POST", `/api/practice/patient-entries/${e.id}/archive`],
    ["POST", `/api/practice/patient-entries/${e.id}/invitations`],
    ["POST", `/api/practice/patient-entries/${e.id}/invitations/regenerate`],
    ["POST", "/api/practice/patient-invitations/inv-x/revoke"],
    ["POST", "/api/practice/patient-invitations/inv-x/manual-code"],
  ];
  for (const [method, path] of routes) {
    const { status } = await call(method, path, { auth: false, body: {} });
    assert.equal(status, 401, `${method} ${path} was reachable unauthenticated`);
  }
});

test("a caller who belongs to no practice is refused everywhere", async () => {
  const e = seedEntry(PRACTICE_A);
  const { status } = await call("GET",
    `/api/practice/patient-entries/${e.id}?practiceId=${PRACTICE_A}`, { userId: STRANGER });
  assert.equal(status, 403);
});

test("a revoked membership grants nothing", async () => {
  const { status } = await call("GET",
    `/api/practice/patient-entries?practiceId=${PRACTICE_A}`, { userId: REVOKED_A });
  assert.equal(status, 403);
});

test("without a practice context the request is rejected before anything is loaded", async () => {
  const { status, body } = await call("POST", "/api/practice/patient-entries", { body: NEW_PATIENT });
  assert.equal(status, 400);
  assert.equal(body.error, "practiceId_required");
  assert.equal(entries.length, 0);
});

/* ---------------------------------------------------------- capabilities */

test("reading needs PATIENT_LINKS_READ, writing needs PATIENT_LINKS_WRITE", async () => {
  const e = seedEntry(PRACTICE_A);

  // A viewer of A may read...
  const read = await call("GET",
    `/api/practice/patient-entries/${e.id}?practiceId=${PRACTICE_A}`, { userId: VIEWER_A });
  assert.equal(read.status, 200);

  // ...and may change nothing at all.
  const writes = [
    ["POST", "/api/practice/patient-entries", { ...NEW_PATIENT, practiceId: PRACTICE_A }],
    ["POST", `/api/practice/patient-entries/${e.id}/archive`, { practiceId: PRACTICE_A }],
    ["POST", `/api/practice/patient-entries/${e.id}/invitations`, { practiceId: PRACTICE_A }],
    ["POST", `/api/practice/patient-entries/${e.id}/invitations/regenerate`, { practiceId: PRACTICE_A }],
    ["POST", "/api/practice/patient-invitations/inv-x/revoke", { practiceId: PRACTICE_A }],
    ["POST", "/api/practice/patient-invitations/inv-x/manual-code", { practiceId: PRACTICE_A }],
  ];
  for (const [method, path, body] of writes) {
    const { status } = await call(method, path, { userId: VIEWER_A, body });
    assert.equal(status, 403, `${method} ${path} was allowed for a read-only member`);
  }
  assert.equal(invitations.length, 0);
  assert.equal(entries.length, 1);
});

/* ------------------------------------------------------- tenant isolation */

test("an entry id from another practice is indistinguishable from one that does not exist", async () => {
  const foreign = seedEntry(PRACTICE_B);

  const real = await call("GET",
    `/api/practice/patient-entries/${foreign.id}?practiceId=${PRACTICE_A}`);
  const invented = await call("GET",
    `/api/practice/patient-entries/entry-does-not-exist?practiceId=${PRACTICE_A}`);

  assert.equal(real.status, 404);
  assert.deepEqual(real.body, invented.body, "the two answers differ, which is an oracle");
});

test("practice A cannot modify practice B's entry", async () => {
  const foreign = seedEntry(PRACTICE_B);
  for (const path of [
    `/api/practice/patient-entries/${foreign.id}/archive`,
    `/api/practice/patient-entries/${foreign.id}/invitations`,
  ]) {
    const { status } = await call("POST", path, { body: { practiceId: PRACTICE_A } });
    assert.equal(status, 404, `${path} reached across the tenant boundary`);
  }
  assert.equal(foreign.status, "draft");
  assert.equal(invitations.length, 0);
});

test("naming somebody else's practice does not grant access to it", async () => {
  seedEntry(PRACTICE_B);
  const { status } = await call("GET",
    `/api/practice/patient-entries?practiceId=${PRACTICE_B}`, { userId: OWNER_A });
  assert.equal(status, 403);
});

test("a practiceProfileId in the body is ignored, not obeyed", async () => {
  // The classic confused-deputy attempt: authorize against my own practice,
  // then try to have the row written into somebody else's.
  const { status, body } = await call("POST", "/api/practice/patient-entries", {
    body: { ...NEW_PATIENT, practiceId: PRACTICE_A, practiceProfileId: PRACTICE_B },
  });
  assert.equal(status, 201);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].practiceProfileId, PRACTICE_A);
  assert.equal(body.entry.id, entries[0].id);
});

/* ---------------------------------------------------------- entry create */

test("create writes an entry and nothing else", async () => {
  const { status, body } = await call("POST", "/api/practice/patient-entries", {
    body: { ...NEW_PATIENT, practiceId: PRACTICE_A, email: "Anna@Example.COM" },
  });
  assert.equal(status, 201);
  assert.equal(body.entry.status, "draft");
  assert.equal(body.entry.isLinked, false);
  // No invitation, no link, no account lookup.
  assert.equal(invitations.length, 0);
  assert.equal(entries[0].practicePatientLinkId, null);
  // An address, normalised, not an identifier.
  assert.equal(entries[0].email, "anna@example.com");
  // The record the practice gets back must not expose the link column.
  assert.equal("practicePatientLinkId" in body.entry, false);
});

test("a nameless entry is refused", async () => {
  for (const body of [{}, { givenName: "Anna" }, { familyName: "Müller" }, { givenName: " ", familyName: " " }]) {
    const res = await call("POST", "/api/practice/patient-entries",
      { body: { ...body, practiceId: PRACTICE_A } });
    assert.equal(res.status, 400);
  }
  assert.equal(entries.length, 0);
});

test("the duplicate hint is a COUNT — never a list of other people", async () => {
  const local = seedEntry(PRACTICE_A, { givenName: "Anna", familyName: "Mueller",
    dateOfBirth: new Date("1980-05-04"), email: "anna.m@example.com",
    practiceRecordNumber: "REC-0001" });
  seedEntry(PRACTICE_B, { givenName: "Anna", familyName: "Müller", dateOfBirth: new Date("1980-05-04") });

  const { status, body } = await call("POST", "/api/practice/patient-entries", {
    body: { ...NEW_PATIENT, practiceId: PRACTICE_A },
  });

  assert.equal(status, 201, "a possible duplicate must never block the create");
  assert.equal(body.possibleDuplicateCount, 1, "Müller/Mueller must meet, and only within A");
  assert.equal(body.duplicateScanCapped, false);
  assert.equal(entries.length, 3, "the entry was created anyway");

  // The whole point: typing a similar name must not hand back another person's
  // record as a side effect.
  assert.equal("possibleDuplicates" in body, false);
  const text = JSON.stringify(body);
  for (const leaked of [local.id, local.email, local.practiceRecordNumber, "Mueller"]) {
    assert.equal(text.includes(leaked), false, `the create response leaked ${leaked}`);
  }
});

test("the duplicate signal folds the ways a German name is really written", async () => {
  // Each case seeds ONE existing entry, then creates "Anna Müller, 1980-05-04"
  // and asks how many similar local entries the count reports.
  const cases = [
    [{ givenName: "Anna", familyName: "Mueller", dateOfBirth: new Date("1980-05-04") }, 1, "ue for ü"],
    [{ givenName: "anna", familyName: "MÜLLER", dateOfBirth: new Date("1980-05-04") }, 1, "case"],
    [{ givenName: "Anna", familyName: "Muller", dateOfBirth: new Date("1980-05-04") }, 1, "diacritic dropped"],
    [{ givenName: "Anna", familyName: "Müller", dateOfBirth: null }, 1, "name alone, dob unknown"],
    [{ givenName: "Bernd", familyName: "Müller", dateOfBirth: new Date("1980-05-04") }, 1,
      "different given name, but the birthday confirms"],
    [{ givenName: "Bernd", familyName: "Müller", dateOfBirth: new Date("1975-01-01") }, 0,
      "same surname, different person"],
    [{ givenName: "Bernd", familyName: "Müller", dateOfBirth: null }, 0,
      "surname alone is not a signal"],
    [{ givenName: "Anna", familyName: "Schmidt", dateOfBirth: new Date("1980-05-04") }, 0,
      "different surname"],
    [{ givenName: "Anna", familyName: "Müller", dateOfBirth: new Date("1980-05-04"),
      status: "archived", archivedAt: new Date() }, 0, "archived entries are out of scope"],
  ];

  for (const [seed, expected, why] of cases) {
    reset();
    seedEntry(PRACTICE_A, seed);
    const { body } = await call("POST", "/api/practice/patient-entries", {
      body: { ...NEW_PATIENT, practiceId: PRACTICE_A },
    });
    assert.equal(body.possibleDuplicateCount, expected, `${why}: got ${body.possibleDuplicateCount}`);
  }
});

/* -------------------------------------------------------------- archiving */

test("archiving keeps the record and kills its live invitation", async () => {
  const e = seedEntry(PRACTICE_A);
  await call("POST", `/api/practice/patient-entries/${e.id}/invitations`, { body: { practiceId: PRACTICE_A } });
  assert.equal(invitations[0].status, "pending");

  const { status, body } = await call("POST", `/api/practice/patient-entries/${e.id}/archive`,
    { body: { practiceId: PRACTICE_A } });

  assert.equal(status, 200);
  assert.equal(body.entry.status, "archived");
  assert.equal(entries.length, 1, "the row must not be deleted");
  assert.equal(invitations[0].status, "revoked", "a shelved entry must not stay reachable");

  const again = await call("POST", `/api/practice/patient-entries/${e.id}/archive`,
    { body: { practiceId: PRACTICE_A } });
  assert.equal(again.status, 409);
});

/* ------------------------------------------------------ invitation create */

test("the plaintext token is returned once and stored only as a hash", async () => {
  const e = seedEntry(PRACTICE_A);
  const { status, body } = await call("POST", `/api/practice/patient-entries/${e.id}/invitations`,
    { body: { practiceId: PRACTICE_A, deliveryChannel: "email" } });

  assert.equal(status, 201);
  const raw = body.token;
  assert.ok(raw && raw.length >= 43);

  const stored = invitations[0];
  assert.equal(stored.tokenHash, hashInvitationToken(raw));
  assert.equal(JSON.stringify(stored).includes(raw), false, "the plaintext reached the database");
  assert.equal(JSON.stringify(auditRows).includes(raw), false, "the plaintext reached the audit log");
  assert.equal(JSON.stringify(auditRows).includes(stored.tokenHash), false, "the hash reached the audit log");
  // The practice-facing view never carries either.
  assert.equal(JSON.stringify(body.invitation).includes(raw), false);
  assert.equal("tokenHash" in body.invitation, false);

  assert.equal(stored.status, "pending");
  // Nothing was delivered, so nothing may claim a delivery happened — not on the
  // row and not in the audit. A client-supplied channel is ignored outright.
  assert.equal(stored.deliveryChannel, null);
  assert.equal(JSON.stringify(auditRows).includes("email"), false);
  assert.equal("deliveryChannel" in body.invitation, false);
  assert.equal(stored.createdByUserId, OWNER_A);
  assert.equal(stored.redeemedByUserId, null);
  assert.equal(entries[0].status, "invited", "the entry moved out of draft");

  const days = (new Date(stored.expiresAt) - new Date(stored.createdAt)) / 86_400_000;
  assert.ok(Math.abs(days - 7) < 0.01, `expected a 7-day lifetime, got ${days}`);
});

test("regeneration supersedes the previous invitation, expired ones included", async () => {
  const e = seedEntry(PRACTICE_A);
  const first = await call("POST", `/api/practice/patient-entries/${e.id}/invitations`,
    { body: { practiceId: PRACTICE_A } });

  // Age it past its expiry. It stays technically pending, which is the trap:
  // without superseding it, "send again" would collide with it forever.
  invitations[0].expiresAt = new Date(Date.now() - 1000);
  assert.equal(invitations[0].status, "pending");

  const second = await call("POST", `/api/practice/patient-entries/${e.id}/invitations/regenerate`,
    { body: { practiceId: PRACTICE_A } });

  assert.equal(second.status, 201);
  assert.equal(second.body.supersededCount, 1);
  assert.equal(invitations[0].status, "superseded");
  // Superseding is auditable on its own: it is the moment a credential someone
  // is already holding stopped working.
  const supersedeEvents = auditRows.filter(
    (a) => a.action === "practice_patient_invitation_superseded",
  );
  assert.equal(supersedeEvents.length, 1);
  assert.equal(supersedeEvents[0].metadata.replacedByInvitationId, invitations[1].id);
  assert.equal(
    JSON.stringify(auditRows).includes(second.body.token), false,
    "the replacement token reached the audit log",
  );
  // A first issue supersedes nothing, so it must not claim to.
  assert.equal(
    auditRows.filter((a) => a.action === "practice_patient_invitation_superseded").length, 1,
  );
  assert.ok(invitations[0].supersededAt);
  assert.equal(invitations.filter((i) => i.status === "pending").length, 1);
  assert.notEqual(second.body.token, first.body.token);
});

test("an invitation cannot be issued for an archived entry or by an inactive practice", async () => {
  const archived = seedEntry(PRACTICE_A, { status: "archived", archivedAt: new Date() });
  const a = await call("POST", `/api/practice/patient-entries/${archived.id}/invitations`,
    { body: { practiceId: PRACTICE_A } });
  assert.equal(a.status, 409);

  const linked = seedEntry(PRACTICE_A, { status: "linked", linkedAt: new Date() });
  const l = await call("POST", `/api/practice/patient-entries/${linked.id}/invitations`,
    { body: { practiceId: PRACTICE_A } });
  assert.equal(l.status, 409);

  const off = seedEntry(PRACTICE_OFF);
  const o = await call("POST", `/api/practice/patient-entries/${off.id}/invitations`,
    { userId: OWNER_OFF, body: { practiceId: PRACTICE_OFF } });
  assert.equal(o.status, 409);
  assert.equal(o.body.error, "practice_inactive");

  assert.equal(invitations.length, 0);
});

/* ------------------------------------------------------------- revocation */

test("revoking is idempotent, but revoking a superseded invitation is a conflict", async () => {
  const e = seedEntry(PRACTICE_A);
  await call("POST", `/api/practice/patient-entries/${e.id}/invitations`, { body: { practiceId: PRACTICE_A } });
  const inv = invitations[0];

  const first = await call("POST", `/api/practice/patient-invitations/${inv.id}/revoke`,
    { body: { practiceId: PRACTICE_A } });
  assert.equal(first.status, 200);
  assert.equal(first.body.alreadyRevoked, false);
  assert.equal(inv.status, "revoked");
  assert.equal(inv.revokedByUserId, OWNER_A);

  const second = await call("POST", `/api/practice/patient-invitations/${inv.id}/revoke`,
    { body: { practiceId: PRACTICE_A } });
  assert.equal(second.status, 200, "a repeated withdrawal must not fail");
  assert.equal(second.body.alreadyRevoked, true);

  inv.status = "superseded";
  const third = await call("POST", `/api/practice/patient-invitations/${inv.id}/revoke`,
    { body: { practiceId: PRACTICE_A } });
  assert.equal(third.status, 409, "withdrawing something this row no longer controls is a conflict");
});

test("an invitation of another practice cannot be revoked and does not admit existing", async () => {
  const foreign = seedEntry(PRACTICE_B);
  await call("POST", `/api/practice/patient-entries/${foreign.id}/invitations`,
    { userId: OWNER_B, body: { practiceId: PRACTICE_B } });
  const inv = invitations[0];

  const attempt = await call("POST", `/api/practice/patient-invitations/${inv.id}/revoke`,
    { userId: OWNER_A, body: { practiceId: PRACTICE_A } });
  const invented = await call("POST", "/api/practice/patient-invitations/inv-nope/revoke",
    { userId: OWNER_A, body: { practiceId: PRACTICE_A } });

  assert.equal(attempt.status, 404);
  assert.deepEqual(attempt.body, invented.body);
  assert.equal(inv.status, "pending", "the foreign invitation was modified");
});

/* ------------------------------------------------------------ manual code */

test("rotating a code replaces the old one without touching the invitation", async () => {
  const e = seedEntry(PRACTICE_A);
  await call("POST", `/api/practice/patient-entries/${e.id}/invitations`, { body: { practiceId: PRACTICE_A } });
  const inv = invitations[0];
  const expiryBefore = inv.expiresAt;

  const first = await call("POST", `/api/practice/patient-invitations/${inv.id}/manual-code`,
    { body: { practiceId: PRACTICE_A } });
  assert.equal(first.status, 201);
  const code1 = first.body.manualCode;
  assert.match(code1, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(inv.manualCodeHash, hashManualCode(code1));

  const minutes = (new Date(inv.manualCodeExpiresAt) - Date.now()) / 60_000;
  assert.ok(minutes > 59 && minutes <= 60, `expected a 60-minute code, got ${minutes}`);

  const second = await call("POST", `/api/practice/patient-invitations/${inv.id}/manual-code`,
    { body: { practiceId: PRACTICE_A } });
  const code2 = second.body.manualCode;
  assert.notEqual(code2, code1);
  assert.equal(inv.manualCodeHash, hashManualCode(code2));
  assert.notEqual(inv.manualCodeHash, hashManualCode(code1), "the old code still resolves");

  // The invitation itself is untouched: same row, same status, same lifetime.
  assert.equal(invitations.length, 1, "rotation created a second invitation");
  assert.equal(inv.status, "pending");
  assert.equal(inv.expiresAt, expiryBefore);
  assert.equal(inv.supersededAt, null);

  const audited = JSON.stringify(auditRows);
  assert.equal(audited.includes(code1), false, "a manual code reached the audit log");
  assert.equal(audited.includes(code2), false);
  assert.equal(audited.includes(inv.manualCodeHash), false);
});

test("a revoked invitation cannot be given a fresh code", async () => {
  const e = seedEntry(PRACTICE_A);
  await call("POST", `/api/practice/patient-entries/${e.id}/invitations`, { body: { practiceId: PRACTICE_A } });
  const inv = invitations[0];
  await call("POST", `/api/practice/patient-invitations/${inv.id}/revoke`, { body: { practiceId: PRACTICE_A } });

  const { status } = await call("POST", `/api/practice/patient-invitations/${inv.id}/manual-code`,
    { body: { practiceId: PRACTICE_A } });
  assert.equal(status, 409);
  assert.equal(inv.manualCodeHash, null);
});

/* ------------------------------------------------------------ the preview */

async function issue() {
  const e = seedEntry(PRACTICE_A, { givenName: "Anna", familyName: "Müller",
    dateOfBirth: new Date("1980-05-04"), email: "anna@example.com",
    practiceRecordNumber: "REC-4711" });
  const { body } = await call("POST", `/api/practice/patient-entries/${e.id}/invitations`,
    { body: { practiceId: PRACTICE_A } });
  return { entry: e, token: body.token, invitation: invitations.at(-1) };
}

test("the token is never part of a URL — there is no path route to reach", async () => {
  const { token: raw } = await issue();

  // Every shape the old design or a careless client might try. All must miss.
  for (const path of [
    `/api/public/patient-invitations/${raw}`,
    `/api/public/patient-invitations?token=${raw}`,
    `/api/public/patient-invitations/preview/${raw}`,
    `/api/public/patient-invitations/preview?token=${raw}`,
  ]) {
    const res = await fetch(`${base}${path}`);
    assert.notEqual(res.status, 200, `${path} resolved the token from a URL`);
    const body = await res.json().catch(() => ({}));
    assert.equal(JSON.stringify(body).includes("Praxis A"), false,
      `${path} disclosed the practice`);
  }

  // The supported call carries the token in the body, and the URL it was sent to
  // holds nothing secret — this is what a log line would record.
  const ok = await preview(raw);
  assert.equal(ok.status, 200);
  assert.equal(ok.url.includes(raw), false, "the request URL contained the token");
  assert.equal(ok.url.endsWith("/api/public/patient-invitations/preview"), true);
});

/** The frozen public contract. Anything outside this set is a regression. */
const PREVIEW_TOP_LEVEL_KEYS = ["ok", "practice"];
const PREVIEW_PRACTICE_KEYS = ["city", "displayName", "specialty"];

test("the preview DTO is exactly the approved minimum, and nothing else", async () => {
  const { token: raw, entry } = await issue();
  const { status, body } = await preview(raw);

  assert.equal(status, 200);
  assert.deepEqual(Object.keys(body).sort(), PREVIEW_TOP_LEVEL_KEYS);
  assert.deepEqual(Object.keys(body.practice).sort(), PREVIEW_PRACTICE_KEYS);
  assert.deepEqual(body, {
    ok: true,
    practice: { displayName: "Praxis A", specialty: "Allgemeinmedizin", city: "Berlin" },
  });

  // No identifier of any kind reaches an unauthenticated caller.
  const text = JSON.stringify(body);
  for (const secret of [PRACTICE_A, entry.id, invitations.at(-1).id,
    entry.givenName, entry.familyName, entry.email, entry.practiceRecordNumber,
    "1980-05-04", "Willkommen"]) {
    assert.equal(text.includes(secret), false, `the preview disclosed ${secret}`);
  }
  for (const key of ["id", "practiceProfileId", "practiceName", "patientHint",
    "logoUrl", "accentColor", "expiresAt", "status", "isActive"]) {
    assert.equal(key in body.practice, false, `unexpected practice key ${key}`);
    assert.equal(key in body, false, `unexpected top-level key ${key}`);
  }
});

test("no branding asset reaches the preview, however the practice configured it", async () => {
  const practice = practices.find((p) => p.id === PRACTICE_A);
  // Both shapes at once: an uploaded logo AND a self-hosted external one.
  practice.logoStorageKey = "logos/praxis-a.png";
  practice.logoUrl = "https://cdn.example.invalid/praxis-a.png";
  practice.accentColor = "#0f766e";

  const { token: raw } = await issue();
  const { body } = await preview(raw);

  // An external URL would make the patient's browser call a third-party host the
  // moment the page renders, disclosing their address and what they are looking
  // at. The uploaded one carries the practice id and is behind requireAuth.
  // Neither is published.
  assert.deepEqual(Object.keys(body.practice).sort(), PREVIEW_PRACTICE_KEYS);
  const text = JSON.stringify(body);
  assert.equal(text.includes("cdn.example.invalid"), false, "a third-party URL was published");
  assert.equal(text.includes("logos/praxis-a.png"), false);
  assert.equal(text.includes("0f766e"), false);
  assert.equal(text.includes(PRACTICE_A), false);
});

test("the preview never states when the invitation runs out", async () => {
  const { token: raw, invitation } = await issue();
  const { body } = await preview(raw);

  // Validity is decided here on the server; the caller learns only that it was
  // granted. The date itself says something precise about a live credential.
  assert.equal("expiresAt" in body, false);
  assert.equal(JSON.stringify(body).includes(String(invitation.expiresAt.getFullYear())), false);
});

test("the preview writes nothing, no matter how often it is called", async () => {
  const { token: raw } = await issue();
  const before = JSON.stringify({ invitations, entries, auditRows });

  for (let i = 0; i < 5; i += 1) {
    assert.equal((await preview(raw)).status, 200);
  }

  assert.equal(JSON.stringify({ invitations, entries, auditRows }), before,
    "a preview changed state");
});

test("every rejection is byte-identical, the inactive practice included", async () => {
  const { token: raw, invitation } = await issue();
  const answers = [];

  const revert = () => {
    invitation.status = "pending";
    invitation.expiresAt = new Date(Date.now() + 60_000);
    practices.find((p) => p.id === PRACTICE_A).isActive = true;
  };

  for (const [why, mutate] of [
    ["expired, still technically pending", () => { invitation.expiresAt = new Date(Date.now() - 1000); }],
    ["revoked", () => { invitation.status = "revoked"; }],
    ["superseded", () => { invitation.status = "superseded"; }],
    ["redeemed", () => { invitation.status = "redeemed"; }],
    // A perfectly valid credential whose practice has been switched off. It must
    // NOT be distinguishable: a separate answer would confirm the token is real
    // and would disclose an organisation's operational state to a stranger.
    ["practice switched off", () => { practices.find((p) => p.id === PRACTICE_A).isActive = false; }],
  ]) {
    revert();
    mutate();
    const { status, body } = await preview(raw);
    answers.push([why, status, JSON.stringify(body)]);
  }

  // ...and a string that was never a credential at all.
  const unknown = await preview("z".repeat(43));
  answers.push(["never existed", unknown.status, JSON.stringify(unknown.body)]);

  const reference = `${answers[0][1]} ${answers[0][2]}`;
  for (const [why, status, body] of answers) {
    assert.equal(`${status} ${body}`, reference, `"${why}" is distinguishable`);
    assert.equal(body.includes("Praxis"), false, `"${why}" leaked practice information`);
  }
  assert.equal(answers[0][1], 404);
  assert.equal(JSON.parse(answers[0][2]).error, "invalid_or_expired_invitation");
});

/* ------------------------------------------- manual code check (public) */

test("a typed code is checked without redeeming anything", async () => {
  const { invitation } = await issue();
  const rot = await call("POST", `/api/practice/patient-invitations/${invitation.id}/manual-code`,
    { body: { practiceId: PRACTICE_A } });
  const code = rot.body.manualCode;

  const before = JSON.stringify({ invitations, entries });
  const { status, body, url } = await checkCode(code.toLowerCase());

  assert.equal(status, 200);
  assert.equal(body.redeemed, undefined, "there is no redeem in this phase");
  assert.equal(url.includes(code), false, "the code appeared in the request URL");
  // Exactly the same minimal DTO as the link preview — one shape, one review.
  assert.deepEqual(Object.keys(body).sort(), PREVIEW_TOP_LEVEL_KEYS);
  assert.deepEqual(Object.keys(body.practice).sort(), PREVIEW_PRACTICE_KEYS);
  assert.equal(body.practice.displayName, "Praxis A");
  assert.equal("manualCodeExpiresAt" in body, false, "the code's clock was published");
  assert.equal(JSON.stringify(body).includes(PRACTICE_A), false);
  assert.equal(JSON.stringify({ invitations, entries }), before, "the check mutated state");
});

test("an expired code fails while its invitation stays good", async () => {
  const { invitation, token: raw } = await issue();
  const rot = await call("POST", `/api/practice/patient-invitations/${invitation.id}/manual-code`,
    { body: { practiceId: PRACTICE_A } });
  invitation.manualCodeExpiresAt = new Date(Date.now() - 1000);

  const codeRes = await checkCode(rot.body.manualCode);
  assert.equal(codeRes.status, 404);
  assert.equal(codeRes.body.error, "invalid_or_expired_invitation");

  assert.equal((await preview(raw)).status, 200,
    "the 60-minute code took the 7-day link down with it");
});

test("the code check hides an inactive practice exactly like a bad code", async () => {
  const { invitation } = await issue();
  const rot = await call("POST", `/api/practice/patient-invitations/${invitation.id}/manual-code`,
    { body: { practiceId: PRACTICE_A } });

  practices.find((p) => p.id === PRACTICE_A).isActive = false;
  const off = await checkCode(rot.body.manualCode);
  const wrong = await checkCode("AAAA-BBBB-CCCC");

  assert.equal(off.status, wrong.status);
  assert.deepEqual(off.body, wrong.body);
  assert.equal(JSON.stringify(off.body).includes("Praxis"), false);
});

test("a missing or wrong code is refused exactly like an expired one", async () => {
  const answers = [];
  for (const code of [undefined, "", "AAAA-BBBB-CCCC", 42]) {
    const { status, body } = await checkCode(code);
    answers.push([status, JSON.stringify(body)]);
  }
  const first = JSON.stringify(answers[0]);
  for (const a of answers) assert.equal(JSON.stringify(a), first);
  assert.equal(answers[0][0], 404);
});

/* ---------------------------------------------------------- feature flag */

/* --------------------------------------------------- the feature flag gate */

/**
 * Every route this phase adds. The gate has to close ALL of them: this module
 * has no claim, no delivery and no UI yet, so a deploy that quietly switched it
 * on would expose an unfinished public surface.
 */
function everyNewRoute(entryId, invitationId) {
  return [
    ["POST", "/api/practice/patient-entries", "entry create"],
    ["GET", `/api/practice/patient-entries?practiceId=${PRACTICE_A}`, "entry list"],
    ["GET", `/api/practice/patient-entries/${entryId}?practiceId=${PRACTICE_A}`, "entry detail"],
    ["POST", `/api/practice/patient-entries/${entryId}/archive`, "entry archive"],
    ["GET", `/api/practice/patient-entries/${entryId}/invitations?practiceId=${PRACTICE_A}`, "invitation list"],
    ["POST", `/api/practice/patient-entries/${entryId}/invitations`, "invitation create"],
    ["POST", `/api/practice/patient-entries/${entryId}/invitations/regenerate`, "invitation regenerate"],
    ["POST", `/api/practice/patient-invitations/${invitationId}/revoke`, "invitation revoke"],
    ["POST", `/api/practice/patient-invitations/${invitationId}/manual-code`, "manual code"],
  ];
}

/** Run `fn` with PATIENT_ONBOARDING_V2 set to `value` (or unset for undefined). */
async function withFlag(value, fn) {
  const previous = process.env.PATIENT_ONBOARDING_V2;
  if (value === undefined) delete process.env.PATIENT_ONBOARDING_V2;
  else process.env.PATIENT_ONBOARDING_V2 = value;
  try {
    await fn();
  } finally {
    process.env.PATIENT_ONBOARDING_V2 = previous;
  }
}

test("A/B/C — with no flag at all, every new route is closed", async () => {
  const { entry, invitation } = await issue();

  await withFlag(undefined, async () => {
    for (const [method, path, label] of everyNewRoute(entry.id, invitation.id)) {
      const { status, body } = await call(method, path,
        { body: { ...NEW_PATIENT, practiceId: PRACTICE_A } });
      assert.equal(status, 404, `practice route "${label}" answered with no flag set`);
      assert.deepEqual(body, { ok: false, error: "feature_disabled" });
    }

    // B — the public preview.
    const pub = await preview("any-token-at-all");
    assert.equal(pub.status, 404);
    assert.deepEqual(pub.body, { ok: false, error: "feature_disabled" });

    // C — the typed-code check.
    const code = await checkCode("AAAA-BBBB-CCCC");
    assert.equal(code.status, 404);
    assert.deepEqual(code.body, { ok: false, error: "feature_disabled" });
  });

  // Nothing was created, archived, revoked or superseded while the gate was shut.
  assert.equal(entries.filter((x) => x.status === "archived").length, 0);
  assert.equal(invitations.filter((i) => i.status !== "pending").length, 0);
});

test("B — a REAL token is refused identically while the flag is off, and leaks nothing", async () => {
  const { token: raw, entry } = await issue();

  await withFlag(undefined, async () => {
    const real = await preview(raw);
    const nonsense = await preview("z".repeat(43));

    // The disabled answer must not distinguish a genuine credential from junk,
    // and must say nothing about the practice or the entry behind it.
    assert.equal(real.status, nonsense.status);
    assert.deepEqual(real.body, nonsense.body);
    const text = JSON.stringify(real.body);
    for (const secret of ["Praxis", PRACTICE_A, entry.id, entry.familyName]) {
      assert.equal(text.includes(secret), false, `the disabled response leaked ${secret}`);
    }
  });
});

test("E — only an explicit activation value turns the module on", async () => {
  const { entry } = await issue();
  const path = `/api/practice/patient-entries/${entry.id}?practiceId=${PRACTICE_A}`;

  // Everything that is not the agreed activation value must leave it OFF —
  // including the values people reach for by habit.
  for (const value of ["", " ", "false", "0", "no", "off", "TRUE", "True",
    "yes", "on", "enabled", "y", "2", "null", "undefined", "wahr"]) {
    await withFlag(value, async () => {
      const { status, body } = await call("GET", path);
      assert.equal(status, 404, `PATIENT_ONBOARDING_V2=${JSON.stringify(value)} switched it ON`);
      assert.equal(body.error, "feature_disabled");
    });
  }

  // D — and the two documented values, and only those, turn it on.
  for (const value of ["true", "1"]) {
    await withFlag(value, async () => {
      const { status } = await call("GET", path);
      assert.equal(status, 200, `PATIENT_ONBOARDING_V2=${value} did not switch it ON`);
    });
  }
});
