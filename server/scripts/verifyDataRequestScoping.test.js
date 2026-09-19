/**
 * "Daten & Freigaben" for ONE relationship — against a REAL PostgreSQL database.
 *
 * The practice-scoped views (the patient's "Meine Daten & Freigaben" inside one
 * practice's area, and the practice's "Daten & Freigaben" record tab) narrow
 * the existing lists by a link id. Everything here proves that narrowing can
 * only ever take away, never widen:
 *
 *   - a practice passing ANOTHER practice's link id gets nothing,
 *   - a patient passing somebody else's link id gets nothing,
 *   - the practice never receives the patient's global account id,
 *   - the practice's answer reaches the patient's own list.
 *
 * SAFETY: creates and drops a database named after this process, and refuses to
 * run unless the host is loopback. `medscoutx_dev` is never opened.
 *
 * Run: node --test scripts/verifyDataRequestScoping.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

const run = promisify(execFile);
const SANDBOX_DB = `medscoutx_dr_scope_${process.pid}`;

function adminUrl() {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
  url.pathname = "/postgres";
  url.search = "";
  return url.toString();
}
const psql = (url, sql) => run("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql]);

const admin = adminUrl();
let sandboxUrl = null;
let db = null;
let skip = false;

try {
  if (!admin) {
    skip = "no loopback DATABASE_URL, so no throwaway database can be created";
  } else {
    const u = new URL(admin);
    u.pathname = `/${SANDBOX_DB}`;
    sandboxUrl = u.toString();
    await psql(admin, `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`);
    await psql(admin, `CREATE DATABASE "${SANDBOX_DB}"`);
    await run("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: sandboxUrl },
    });
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });
    await db.$queryRaw`SELECT 1`;
  }
} catch (err) {
  skip = `sandbox database unavailable: ${err?.message ?? err}`;
}

test.after(async () => {
  if (db) await db.$disconnect();
  if (!sandboxUrl || !admin) return;
  try { await psql(admin, `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`); } catch { /* noise */ }
});

let reqSvc = null, controlSvc = null, base = null, jwt = null;
const TRIAGE = { triage: true, answer: false };
const ANSWER = { triage: true, answer: true };

if (!skip) {
  // Point the app's shared client at the sandbox, model by model.
  const { prisma } = await import("../lib/prisma.js");
  const { Prisma } = await import("@prisma/client");
  for (const name of Object.values(Prisma.ModelName)) {
    const key = name.charAt(0).toLowerCase() + name.slice(1);
    prisma[key] = db[key];
  }
  prisma.$transaction = db.$transaction.bind(db);
  prisma.$queryRaw = db.$queryRaw.bind(db);
  prisma.$executeRaw = db.$executeRaw.bind(db);

  reqSvc = await import("../services/patientDataControl/patientDataRequestService.js");
  controlSvc = await import("../services/patientDataControl/patientDataControlService.js");

  // The real route, with the real auth middleware, against the sandbox.
  process.env.CARE_RELATIONSHIP_ENABLED = "true";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-data-requests";
  jwt = (await import("jsonwebtoken")).default;
  const express = (await import("express")).default;
  const { requireAuth } = await import("../middleware/requireAuth.js");
  const { default: router } = await import("../routes/practiceDataRequests.js");
  const app = express();
  app.use(express.json());
  app.use("/api/practice/data-requests", requireAuth, router);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  test.after(() => server.close());
}

/* ---------------------------------------------------------------- fixtures */

let seq = 0;
const uid = () => `${process.pid}-${(seq += 1)}`;

const user = (label) => db.user.create({
  data: {
    email: `${label}-${uid()}@test.invalid`, passwordHash: "x",
    firstName: label, lastName: "Test", dateOfBirth: new Date("1980-01-01"),
  },
});

async function practice(label) {
  const owner = await user(`owner-${label}`);
  const p = await db.practiceProfile.create({
    data: { userId: owner.id, practiceName: `Praxis ${label}`, publicSlug: `slug-${uid()}` },
  });
  return { owner, p };
}

const link = (practiceId, patientId) => db.practicePatientLink.create({
  data: { practiceProfileId: practiceId, patientUserId: patientId, status: "active" },
});

const request = (l, type = "export") => db.patientDataRequest.create({
  data: {
    patientUserId: l.patientUserId, practiceProfileId: l.practiceProfileId,
    practicePatientLinkId: l.id, type, status: "submitted",
  },
});

async function world() {
  const A = await practice("A");
  const B = await practice("B");
  const patient = await user("patient");
  const other = await user("other");
  const LA = await link(A.p.id, patient.id);
  const LB = await link(B.p.id, patient.id);
  const LA2 = await link(A.p.id, other.id);
  const rA = await request(LA, "export");
  const rB = await request(LB, "deletion");
  const rA2 = await request(LA2, "export");
  return { A, B, patient, other, LA, LB, LA2, rA, rB, rA2 };
}

/* ------------------------------------------------------------------- tests */

test("practice: narrowing by link only narrows, and never crosses practices", { skip }, async () => {
  const w = await world();

  const all = await reqSvc.listPracticeDataRequests(w.A.p.id);
  assert.deepEqual(all.map((r) => r.id).sort(), [w.rA.id, w.rA2.id].sort());

  const one = await reqSvc.listPracticeDataRequests(w.A.p.id, { linkId: w.LA.id });
  assert.deepEqual(one.map((r) => r.id), [w.rA.id]);

  // Practice A asking for practice B's relationship: nothing, not B's request.
  const foreign = await reqSvc.listPracticeDataRequests(w.A.p.id, { linkId: w.LB.id });
  assert.deepEqual(foreign, [], "a foreign link id leaked another practice's request");
});

test("practice: responses never carry the patient's global account id", { skip }, async () => {
  const w = await world();
  const [row] = await reqSvc.listPracticeDataRequests(w.A.p.id, { linkId: w.LA.id });
  assert.equal("patientUserId" in row, false);
  assert.equal(row.patient && "id" in row.patient, false);
  assert.equal(row.patient.firstName, "patient");
  assert.equal(row.practicePatientLinkId, w.LA.id);

  const detail = await reqSvc.getPracticeDataRequest(w.rA.id, w.A.p.id, w.A.owner.id);
  assert.equal("patientUserId" in detail, false);
  assert.equal(detail.patient && "id" in detail.patient, false);

  const updated = await reqSvc.updatePracticeDataRequestStatus({
    requestId: w.rA.id, practiceProfileId: w.A.p.id, handlerUserId: w.A.owner.id,
    handlerRole: "owner", permissions: ANSWER, status: "in_review",
  });
  assert.equal("patientUserId" in updated, false);
});

test("patient: the practice's answer reaches their own, narrowed list", { skip }, async () => {
  const w = await world();
  await reqSvc.updatePracticeDataRequestStatus({
    requestId: w.rA.id, practiceProfileId: w.A.p.id, handlerUserId: w.A.owner.id,
    handlerRole: "owner", permissions: ANSWER, status: "answered", responseNote: "Export liegt bereit.",
  });

  const mine = await reqSvc.listPatientDataRequests(w.patient.id, { linkId: w.LA.id });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].status, "answered");
  assert.equal(mine[0].responseNote, "Export liegt bereit.");
  assert.ok(mine[0].completedAt, "the answer time is recorded");

  // Somebody else's link id yields nothing, however it was obtained.
  const stranger = await reqSvc.listPatientDataRequests(w.other.id, { linkId: w.LA.id });
  assert.deepEqual(stranger, []);
});

test("patient: the scoped 'Meine Daten & Freigaben' is exactly one relationship", { skip }, async () => {
  const w = await world();

  const full = await controlSvc.getPatientDataControl(w.patient.id);
  assert.equal(full.practices.length, 2);
  assert.equal(full.requests.length, 2);

  const scoped = await controlSvc.getPatientDataControl(w.patient.id, { linkId: w.LB.id });
  assert.deepEqual(scoped.practices.map((p) => p.id), [w.LB.id]);
  assert.deepEqual(scoped.requests.map((r) => r.id), [w.rB.id]);

  const foreign = await controlSvc.getPatientDataControl(w.other.id, { linkId: w.LA.id });
  assert.deepEqual(foreign.practices, [], "another patient's link opened someone else's data");
  assert.deepEqual(foreign.requests, []);
});

/* ====================================================================
 * Variante C — who may do what, and "Beantwortet" as the neutral end
 * ==================================================================== */

test("reception (triage only) may mark 'in progress' — and nothing more", { skip }, async () => {
  const w = await world();
  const done = await reqSvc.updatePracticeDataRequestStatus({
    requestId: w.rA.id, practiceProfileId: w.A.p.id, handlerUserId: w.A.owner.id,
    handlerRole: "secretary", permissions: TRIAGE, status: "in_review",
  });
  assert.equal(done.status, "in_review");

  // No final answer, no closing, no answer text riding along with "in progress".
  await assert.rejects(
    () => reqSvc.updatePracticeDataRequestStatus({
      requestId: w.rA.id, practiceProfileId: w.A.p.id, handlerUserId: w.A.owner.id,
      handlerRole: "secretary", permissions: TRIAGE, status: "answered", responseNote: "Erledigt.",
    }),
    (e) => e.message === "forbidden_answer",
  );
  await assert.rejects(
    () => reqSvc.updatePracticeDataRequestStatus({
      requestId: w.rA.id, practiceProfileId: w.A.p.id, handlerUserId: w.A.owner.id,
      handlerRole: "secretary", permissions: TRIAGE, status: "in_review", responseNote: "Hallo",
    }),
    (e) => e.message === "forbidden_answer",
  );
  const row = await db.patientDataRequest.findUnique({ where: { id: w.rA.id } });
  assert.equal(row.status, "in_review");
  assert.equal(row.responseNote, null, "reception wrote patient-visible text");
});

test("an answering role closes with an answer — never without one, never twice", { skip }, async () => {
  const w = await world();
  await assert.rejects(
    () => reqSvc.updatePracticeDataRequestStatus({
      requestId: w.rB.id, practiceProfileId: w.B.p.id, handlerUserId: w.B.owner.id,
      handlerRole: "doctor", permissions: ANSWER, status: "answered", responseNote: "   ",
    }),
    (e) => e.message === "validation_answer_required",
  );

  // A deletion request can be answered — whatever the outcome, the text says it.
  const answer = "Ihre Kontaktdaten sind entfernt; die Behandlungsdokumentation müssen wir 10 Jahre aufbewahren.";
  const done = await reqSvc.updatePracticeDataRequestStatus({
    requestId: w.rB.id, practiceProfileId: w.B.p.id, handlerUserId: w.B.owner.id,
    handlerRole: "doctor", permissions: ANSWER, status: "answered", responseNote: answer,
  });
  assert.equal(done.status, "answered");
  assert.equal(done.responseNote, answer, "the practice's own words, nothing generated");

  await assert.rejects(
    () => reqSvc.updatePracticeDataRequestStatus({
      requestId: w.rB.id, practiceProfileId: w.B.p.id, handlerUserId: w.B.owner.id,
      handlerRole: "doctor", permissions: ANSWER, status: "answered", responseNote: "Nachtrag",
    }),
    (e) => e.message === "request_already_answered",
  );

  // Legacy terminal values can no longer be written.
  for (const legacy of ["completed", "rejected", "submitted"]) {
    await assert.rejects(
      () => reqSvc.updatePracticeDataRequestStatus({
        requestId: w.rA.id, practiceProfileId: w.A.p.id, handlerUserId: w.A.owner.id,
        handlerRole: "owner", permissions: ANSWER, status: legacy, responseNote: "x",
      }),
      (e) => e.message === "validation_invalid_status",
    );
  }
});

test("the audit records who, which role and which status — not the answer text", { skip }, async () => {
  const w = await world();
  const answer = `Antwort ${process.pid} mit Gesundheitsbezug`;
  await reqSvc.updatePracticeDataRequestStatus({
    requestId: w.rA.id, practiceProfileId: w.A.p.id, handlerUserId: w.A.owner.id,
    handlerRole: "doctor", permissions: ANSWER, status: "answered", responseNote: answer,
  });
  let log = null;
  for (let i = 0; i < 20 && !log; i += 1) {
    log = await db.auditLog.findFirst({
      where: { action: "patient_data_request_status_changed", entityId: w.rA.id },
    });
    if (!log) await new Promise((r) => setTimeout(r, 50));
  }
  assert.ok(log, "no audit row");
  assert.equal(log.userId, w.A.owner.id);
  assert.equal(log.metadata.practiceRole, "doctor");
  assert.equal(log.metadata.newStatus, "answered");
  assert.equal(log.metadata.answerSent, true);
  assert.equal(JSON.stringify(log.metadata).includes(answer), false, "the answer text was copied into the log");
  const row = await db.patientDataRequest.findUnique({ where: { id: w.rA.id } });
  assert.equal(row.handledByUserId, w.A.owner.id);
  assert.ok(row.completedAt);
});

test("practice A cannot handle practice B's request; patient A never sees B's answer", { skip }, async () => {
  const w = await world();
  await assert.rejects(
    () => reqSvc.updatePracticeDataRequestStatus({
      requestId: w.rB.id, practiceProfileId: w.A.p.id, handlerUserId: w.A.owner.id,
      handlerRole: "owner", permissions: ANSWER, status: "answered", responseNote: "fremd",
    }),
    (e) => e.message === "request_not_found",
  );
  assert.equal((await db.patientDataRequest.findUnique({ where: { id: w.rB.id } })).status, "submitted");

  await reqSvc.updatePracticeDataRequestStatus({
    requestId: w.rA2.id, practiceProfileId: w.A.p.id, handlerUserId: w.A.owner.id,
    handlerRole: "owner", permissions: ANSWER, status: "answered", responseNote: "Nur für other",
  });
  const mine = await reqSvc.listPatientDataRequests(w.patient.id);
  assert.equal(mine.some((r) => r.responseNote === "Nur für other"), false);
  const theirs = await reqSvc.listPatientDataRequests(w.other.id);
  assert.equal(theirs.find((r) => r.id === w.rA2.id).responseNote, "Nur für other");
});

/* ------------------------------------------ the same, over HTTP, by real role */

test("the route derives the rights from the practice's roles", { skip }, async () => {
  const w = await world();
  const secretary = await user("secretary");
  const doctor = await user("doctor");
  const assistant = await user("assistant");
  for (const [u, role] of [[secretary, "secretary"], [doctor, "doctor"], [assistant, "assistant"]]) {
    await db.practiceMember.create({
      data: { practiceProfileId: w.A.p.id, userId: u.id, role, status: "active", acceptedAt: new Date() },
    });
  }

  const call = async (u, method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: "5m" })}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const q = `?practiceId=${w.A.p.id}`;

  const listSec = await call(secretary, "GET", `/api/practice/data-requests${q}&linkId=${w.LA.id}`);
  assert.equal(listSec.status, 200);
  assert.deepEqual(listSec.body.capabilities, { triage: true, answer: false });
  const listDoc = await call(doctor, "GET", `/api/practice/data-requests${q}`);
  assert.deepEqual(listDoc.body.capabilities, { triage: true, answer: true });

  const path = `/api/practice/data-requests/${w.rA.id}/status${q}`;
  assert.equal((await call(assistant, "PATCH", path, { status: "in_review" })).status, 403);
  assert.equal((await call(secretary, "PATCH", path, { status: "in_review" })).status, 200);
  const secAnswer = await call(secretary, "PATCH", path, { status: "answered", responseNote: "x" });
  assert.equal(secAnswer.status, 403);
  assert.equal(secAnswer.body.error, "forbidden_answer");

  const docAnswer = await call(doctor, "PATCH", path, { status: "answered", responseNote: "Antwort der Ärztin." });
  assert.equal(docAnswer.status, 200);
  assert.equal(docAnswer.body.request.status, "answered");
  assert.equal("patientUserId" in docAnswer.body.request, false);

  // Another practice's staff cannot reach it at all.
  const outsider = await call(w.B.owner, "PATCH", `/api/practice/data-requests/${w.rA2.id}/status?practiceId=${w.B.p.id}`,
    { status: "in_review" });
  assert.equal(outsider.status, 404);
});
