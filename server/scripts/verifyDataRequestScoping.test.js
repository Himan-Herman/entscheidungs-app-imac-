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

let reqSvc = null, controlSvc = null;

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
    status: "in_review",
  });
  assert.equal("patientUserId" in updated, false);
});

test("patient: the practice's answer reaches their own, narrowed list", { skip }, async () => {
  const w = await world();
  await reqSvc.updatePracticeDataRequestStatus({
    requestId: w.rA.id, practiceProfileId: w.A.p.id, handlerUserId: w.A.owner.id,
    status: "completed", responseNote: "Export liegt bereit.",
  });

  const mine = await reqSvc.listPatientDataRequests(w.patient.id, { linkId: w.LA.id });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].status, "completed");
  assert.equal(mine[0].responseNote, "Export liegt bereit.");

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

test("a deletion request still cannot be reported 'completed'", { skip }, async () => {
  const w = await world();
  await assert.rejects(
    () => reqSvc.updatePracticeDataRequestStatus({
      requestId: w.rB.id, practiceProfileId: w.B.p.id, handlerUserId: w.B.owner.id,
      status: "completed",
    }),
    (e) => e.message === "deletion_requires_manual_erasure",
  );
});
