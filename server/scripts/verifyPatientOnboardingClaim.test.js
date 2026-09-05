/**
 * The claim, against a REAL PostgreSQL database.
 *
 * Everything here needs a real database: the two partial unique indexes, the
 * advisory lock, genuinely concurrent transactions, and rollback. An in-memory
 * fake would pass a broken implementation on every single race test, so there
 * is deliberately no fake in this file.
 *
 * SAFETY: creates and drops a database named after this process, connects to
 * the `postgres` maintenance database to do so, and refuses to run unless the
 * host is loopback. `medscoutx_dev` is never opened.
 *
 * Run: node --test scripts/verifyPatientOnboardingClaim.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

const run = promisify(execFile);
const SANDBOX_DB = `medscoutx_claim_${process.pid}`;

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

/* ---------------------------------------------------------------- services */

let claimSvc = null;
let invSvc = null;
let entrySvc = null;
let linkSvc = null;
let connectSvc = null;

if (!skip) {
  const { prisma } = await import("../lib/prisma.js");
  for (const key of [
    "practiceProfile", "practicePatientEntry", "practicePatientInvitation",
    "practicePatientLink", "patientProfile", "auditLog", "user", "practiceMember",
    "patientPracticeConnectCode", "consentRecord",
  ]) {
    prisma[key] = db[key];
  }
  prisma.$transaction = db.$transaction.bind(db);
  prisma.$queryRaw = db.$queryRaw.bind(db);
  prisma.$executeRaw = db.$executeRaw.bind(db);
  claimSvc = await import("../services/patientOnboarding/practicePatientClaimService.js");
  invSvc = await import("../services/patientOnboarding/practicePatientInvitationService.js");
  entrySvc = await import("../services/patientOnboarding/practicePatientEntryService.js");
  linkSvc = await import("../services/careRelationship/practicePatientLinkService.js");
  connectSvc = await import("../services/careRelationship/connectCodeService.js");
}

/* ---------------------------------------------------------------- fixtures */

let seq = 0;
const uid = () => `${process.pid}-${(seq += 1)}`;

async function user(label = "p") {
  const n = uid();
  return db.user.create({
    data: {
      email: `${label}-${n}@test.invalid`, passwordHash: "x",
      firstName: "A", lastName: "B", dateOfBirth: new Date("1980-01-01"),
    },
  });
}

async function practice(owner) {
  const n = uid();
  return db.practiceProfile.create({
    data: { userId: owner.id, practiceName: `Praxis ${n}`, publicSlug: `slug-${n}` },
  });
}

/** A practice with an entry and a live invitation, plus a claiming patient. */
async function scene() {
  const owner = await user("owner");
  const p = await practice(owner);
  const patient = await user("patient");
  const { entry } = await entrySvc.createPracticePatientEntry({
    practiceProfileId: p.id, createdByUserId: owner.id,
    givenName: "Anna", familyName: "Müller", dateOfBirth: "1980-05-04",
  });
  const inv = await invSvc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: p.id, createdByUserId: owner.id,
  });
  return { owner, practice: p, patient, entry, inv };
}

const SELF = { type: "self" };
const claim = (over) => claimSvc.claimInvitation({ subject: SELF, ...over });

/* --------------------------------------------------------- the happy paths */

test("a link token binds the account, and nothing more", { skip }, async () => {
  const s = await scene();
  const res = await claim({ token: s.inv.token, userId: s.patient.id });

  assert.equal(res.practice.displayName, s.practice.practiceName);
  assert.equal(res.link.status, "invited");
  assert.deepEqual(Object.keys(res).sort(), ["link", "practice"]);
  assert.deepEqual(Object.keys(res.link).sort(), ["id", "status"]);
  assert.deepEqual(Object.keys(res.practice), ["displayName"]);

  const link = await db.practicePatientLink.findUnique({ where: { id: res.link.id } });
  assert.equal(link.patientUserId, s.patient.id);
  assert.equal(link.patientProfileId, null);
  assert.equal(link.status, "invited");
  // The claim is a technical binding. Consent is a separate act.
  assert.equal(link.consentAcceptedAt, null);
  assert.equal(link.consentScopes, null);
  assert.equal(await db.consentRecord.count(), 0, "a claim created consent");

  const entry = await db.practicePatientEntry.findUnique({ where: { id: s.entry.id } });
  assert.equal(entry.status, "linked");
  assert.ok(entry.linkedAt);
  assert.equal(entry.practicePatientLinkId, link.id);

  const inv = await db.practicePatientInvitation.findUnique({ where: { id: s.inv.invitation.id } });
  assert.equal(inv.status, "redeemed");
  assert.equal(inv.redeemedByUserId, s.patient.id);
  assert.ok(inv.redeemedAt);
});

test("a typed code reaches the same service and the same result", { skip }, async () => {
  const s = await scene();
  const rot = await invSvc.rotateManualCode({
    invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id,
  });
  const res = await claim({ code: rot.manualCode.toLowerCase(), userId: s.patient.id });
  assert.equal(res.link.status, "invited");
  const link = await db.practicePatientLink.findUnique({ where: { id: res.link.id } });
  assert.equal(link.patientUserId, s.patient.id);
  assert.equal(link.patientProfileId, null);
});

test("a represented person gets the profile on the link", { skip }, async () => {
  const s = await scene();
  const profile = await db.patientProfile.create({
    data: { userId: s.patient.id, displayName: "Kind", relationLabel: "Tochter" },
  });
  const res = await claim({
    token: s.inv.token, userId: s.patient.id,
    subject: { type: "patient_profile", patientProfileId: profile.id },
  });
  const link = await db.practicePatientLink.findUnique({ where: { id: res.link.id } });
  assert.equal(link.patientUserId, s.patient.id, "the account holder stays the account holder");
  assert.equal(link.patientProfileId, profile.id);
});

/* ------------------------------------------------------- subject rejection */

test("a foreign, archived or invented profile all fail identically", { skip }, async () => {
  const stranger = await user("stranger");
  const foreign = await db.patientProfile.create({
    data: { userId: stranger.id, displayName: "Fremd", relationLabel: "x" },
  });

  const messages = [];
  for (const profileId of [foreign.id, "does-not-exist"]) {
    const s = await scene();
    await assert.rejects(
      () => claim({ token: s.inv.token, userId: s.patient.id,
        subject: { type: "patient_profile", patientProfileId: profileId } }),
      (e) => { messages.push(e.message); return true; },
    );
  }
  const s = await scene();
  const archived = await db.patientProfile.create({
    data: { userId: s.patient.id, displayName: "Alt", relationLabel: "x", isArchived: true },
  });
  await assert.rejects(
    () => claim({ token: s.inv.token, userId: s.patient.id,
      subject: { type: "patient_profile", patientProfileId: archived.id } }),
    (e) => { messages.push(e.message); return true; },
  );

  assert.equal(new Set(messages).size, 1, `distinguishable answers: ${messages.join(", ")}`);
  assert.equal(messages[0], "validation_subject_invalid");
});

test("the subject is mandatory and must be well formed", { skip }, async () => {
  const s = await scene();
  for (const subject of [undefined, null, {}, { type: "" }, { type: "nonsense" },
    { type: "patient_profile" }, { type: "patient_profile", patientProfileId: "" }]) {
    await assert.rejects(
      () => claimSvc.claimInvitation({ token: s.inv.token, userId: s.patient.id, subject }),
      /validation_subject/,
      `accepted subject ${JSON.stringify(subject)}`,
    );
  }
  // Nothing was consumed by any of those attempts.
  const inv = await db.practicePatientInvitation.findUnique({ where: { id: s.inv.invitation.id } });
  assert.equal(inv.status, "pending");
});

test("exactly one credential, never both and never neither", { skip }, async () => {
  const s = await scene();
  const rot = await invSvc.rotateManualCode({
    invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id,
  });
  await assert.rejects(
    () => claim({ token: s.inv.token, code: rot.manualCode, userId: s.patient.id }),
    /validation_credential_required/,
  );
  await assert.rejects(
    () => claim({ userId: s.patient.id }),
    /validation_credential_required/,
  );
});

/* ------------------------------------------------------ credential refusal */

test("every unusable credential produces one identical answer", { skip }, async () => {
  const seen = [];
  const attempt = async (mutate) => {
    const s = await scene();
    await mutate(s);
    await assert.rejects(
      () => claim({ token: s.inv.token, userId: s.patient.id }),
      (e) => { seen.push(e.message); return true; },
    );
  };
  await attempt((s) => db.practicePatientInvitation.update({
    where: { id: s.inv.invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } }));
  await attempt((s) => db.practicePatientInvitation.update({
    where: { id: s.inv.invitation.id }, data: { status: "revoked" } }));
  await attempt((s) => db.practicePatientInvitation.update({
    where: { id: s.inv.invitation.id }, data: { status: "superseded" } }));
  await attempt((s) => db.practiceProfile.update({
    where: { id: s.practice.id }, data: { isActive: false } }));
  // A string that was never a credential.
  const s = await scene();
  await assert.rejects(() => claim({ token: "z".repeat(43), userId: s.patient.id }),
    (e) => { seen.push(e.message); return true; });

  assert.equal(new Set(seen).size, 1, `distinguishable: ${[...new Set(seen)].join(", ")}`);
  assert.equal(seen[0], "invalid_or_expired_invitation");
});

test("an expired typed code fails while its link token still works", { skip }, async () => {
  const s = await scene();
  const rot = await invSvc.rotateManualCode({
    invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id,
  });
  await db.practicePatientInvitation.update({
    where: { id: s.inv.invitation.id },
    data: { manualCodeExpiresAt: new Date(Date.now() - 1000) },
  });
  await assert.rejects(() => claim({ code: rot.manualCode, userId: s.patient.id }),
    /invalid_or_expired_invitation/);
  const res = await claim({ token: s.inv.token, userId: s.patient.id });
  assert.equal(res.link.status, "invited");
});

/* -------------------------------------------------- separation of duties */

test("whoever can issue the credential may not redeem it", { skip }, async () => {
  // The owner.
  let s = await scene();
  await assert.rejects(() => claim({ token: s.inv.token, userId: s.owner.id }),
    /invalid_or_expired_invitation/);

  // An ACTIVE member of the same practice.
  s = await scene();
  const staff = await user("staff");
  await db.practiceMember.create({
    data: { practiceProfileId: s.practice.id, userId: staff.id, role: "assistant", status: "active" },
  });
  await assert.rejects(() => claim({ token: s.inv.token, userId: staff.id }),
    /invalid_or_expired_invitation/);
  // Nothing was consumed by either refusal.
  const inv = await db.practicePatientInvitation.findUnique({ where: { id: s.inv.invitation.id } });
  assert.equal(inv.status, "pending");
});

test("a revoked member, and a member of another practice, may claim", { skip }, async () => {
  let s = await scene();
  const former = await user("former");
  await db.practiceMember.create({
    data: { practiceProfileId: s.practice.id, userId: former.id, role: "assistant", status: "revoked" },
  });
  const a = await claim({ token: s.inv.token, userId: former.id });
  assert.equal(a.link.patientUserId, undefined, "the DTO must not carry the account id");
  assert.ok(a.link.id);

  s = await scene();
  const otherOwner = await user("other");
  const otherPractice = await practice(otherOwner);
  await db.practiceMember.create({
    data: { practiceProfileId: otherPractice.id, userId: s.patient.id, role: "admin", status: "active" },
  });
  const b = await claim({ token: s.inv.token, userId: s.patient.id });
  assert.ok(b.link.id);
});

/* -------------------------------------------------------- existing links */

test("an existing live link is reused, never re-created and never promoted", { skip }, async () => {
  for (const status of ["invited", "active"]) {
    const s = await scene();
    const existing = await db.practicePatientLink.create({
      data: { practiceProfileId: s.practice.id, patientUserId: s.patient.id, status },
    });
    const res = await claim({ token: s.inv.token, userId: s.patient.id });
    assert.equal(res.link.id, existing.id, `${status}: a second link was created`);
    assert.equal(res.link.status, status, `${status}: the claim changed the link status`);
    assert.equal(
      await db.practicePatientLink.count({
        where: { practiceProfileId: s.practice.id, patientUserId: s.patient.id } }),
      1,
    );
  }
});

test("a live link already owned by another entry is a conflict, not a merge", { skip }, async () => {
  const s = await scene();
  const other = await entrySvc.createPracticePatientEntry({
    practiceProfileId: s.practice.id, givenName: "Zweit", familyName: "Akte",
  });
  const existing = await db.practicePatientLink.create({
    data: { practiceProfileId: s.practice.id, patientUserId: s.patient.id, status: "active" },
  });
  await db.practicePatientEntry.update({
    where: { id: other.entry.id },
    data: { status: "linked", linkedAt: new Date(), practicePatientLinkId: existing.id },
  });

  await assert.rejects(() => claim({ token: s.inv.token, userId: s.patient.id }),
    /link_already_bound_to_entry/);
  assert.equal(
    await db.practicePatientLink.count({
      where: { practiceProfileId: s.practice.id, patientUserId: s.patient.id } }),
    1,
    "a second link was created despite the conflict",
  );
});

test("after a terminal link a new relationship may begin — both subject types", { skip }, async () => {
  for (const terminal of ["revoked", "archived", "declined"]) {
    const s = await scene();
    await db.practicePatientLink.create({
      data: { practiceProfileId: s.practice.id, patientUserId: s.patient.id, status: terminal },
    });
    const res = await claim({ token: s.inv.token, userId: s.patient.id });
    assert.equal(res.link.status, "invited", `${terminal}: expected a fresh link`);
  }
  // and for a represented person, where the old three-column unique forbade it
  const s = await scene();
  const profile = await db.patientProfile.create({
    data: { userId: s.patient.id, displayName: "Kind", relationLabel: "Tochter" },
  });
  await db.practicePatientLink.create({
    data: { practiceProfileId: s.practice.id, patientUserId: s.patient.id,
      patientProfileId: profile.id, status: "revoked" },
  });
  const res = await claim({
    token: s.inv.token, userId: s.patient.id,
    subject: { type: "patient_profile", patientProfileId: profile.id },
  });
  assert.equal(res.link.status, "invited");
});

/* ------------------------------------------------------------- idempotency */

test("the same claim twice succeeds; a different subject does not", { skip }, async () => {
  const s = await scene();
  const first = await claim({ token: s.inv.token, userId: s.patient.id });
  const second = await claim({ token: s.inv.token, userId: s.patient.id });
  assert.deepEqual(second, first, "the repeat answered differently");
  assert.equal(
    await db.practicePatientLink.count({ where: { practiceProfileId: s.practice.id } }), 1);

  const profile = await db.patientProfile.create({
    data: { userId: s.patient.id, displayName: "Kind", relationLabel: "Tochter" },
  });
  await assert.rejects(
    () => claim({ token: s.inv.token, userId: s.patient.id,
      subject: { type: "patient_profile", patientProfileId: profile.id } }),
    /claim_subject_mismatch/,
  );
  assert.equal(
    await db.practicePatientLink.count({ where: { practiceProfileId: s.practice.id } }), 1);
});

test("somebody else's redeemed invitation is refused generically", { skip }, async () => {
  const s = await scene();
  await claim({ token: s.inv.token, userId: s.patient.id });
  const other = await user("other-patient");
  await assert.rejects(() => claim({ token: s.inv.token, userId: other.id }),
    /invalid_or_expired_invitation/);
});

/* --------------------------------------------------------------- no writes */

test("the claim touches neither the account nor the profile", { skip }, async () => {
  const s = await scene();
  const profile = await db.patientProfile.create({
    data: { userId: s.patient.id, displayName: "Kind", relationLabel: "Tochter",
      dateOfBirth: new Date("2018-03-03") },
  });
  const userBefore = await db.user.findUnique({ where: { id: s.patient.id } });
  const profileBefore = await db.patientProfile.findUnique({ where: { id: profile.id } });

  await claim({ token: s.inv.token, userId: s.patient.id,
    subject: { type: "patient_profile", patientProfileId: profile.id } });

  assert.deepEqual(await db.user.findUnique({ where: { id: s.patient.id } }), userBefore);
  assert.deepEqual(await db.patientProfile.findUnique({ where: { id: profile.id } }), profileBefore);
});

test("the audit records the act and none of the secrets", { skip }, async () => {
  const s = await scene();
  const rot = await invSvc.rotateManualCode({
    invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id,
  });
  await claim({ code: rot.manualCode, userId: s.patient.id });

  // Scoped to THIS practice: the sandbox is shared across the whole file.
  const rows = await db.auditLog.findMany({
    where: {
      practiceProfileId: s.practice.id,
      action: { in: ["practice_patient_invitation_redeemed", "practice_patient_entry_linked"] },
    },
  });
  assert.equal(rows.length, 2, "both claim events must be recorded");
  for (const row of rows) {
    assert.equal(row.actorRole, "patient");
    assert.equal(row.userId, s.patient.id);
  }
  const dump = JSON.stringify(rows);
  const inv = await db.practicePatientInvitation.findUnique({ where: { id: s.inv.invitation.id } });
  for (const secret of [s.inv.token, rot.manualCode, inv.tokenHash, inv.manualCodeHash,
    "Müller", "Anna", "1980-05-04"]) {
    assert.equal(dump.includes(secret), false, `the audit leaked ${secret}`);
  }
  assert.ok(dump.includes("claimFlowVersion"));
});

/* ============================== REAL RACES ============================== */

test("RACE claim vs claim on one entry: exactly one link", { skip }, async () => {
  const s = await scene();
  const others = await Promise.all([user("c1"), user("c2"), user("c3")]);
  const contenders = [s.patient, ...others];

  const results = await Promise.allSettled(
    contenders.map((u) => claim({ token: s.inv.token, userId: u.id })),
  );
  const won = results.filter((r) => r.status === "fulfilled");
  assert.equal(won.length, 1, `expected exactly one winner, got ${won.length}`);
  assert.equal(await db.practicePatientLink.count({ where: { practiceProfileId: s.practice.id } }), 1);
  for (const r of results.filter((x) => x.status === "rejected")) {
    assert.match(r.reason.message, /invalid_or_expired_invitation/);
  }
});

test("RACE claim(entry A) vs claim(entry B), same person: one link, the other 409", { skip }, async () => {
  const owner = await user("owner");
  const p = await practice(owner);
  const patient = await user("patient");
  const invitations = [];
  for (let i = 0; i < 2; i += 1) {
    const { entry } = await entrySvc.createPracticePatientEntry({
      practiceProfileId: p.id, givenName: `Akte${i}`, familyName: "Doppelt",
    });
    invitations.push(await invSvc.createInvitationForEntry({
      entryId: entry.id, practiceProfileId: p.id,
    }));
  }

  // Neither claim touches the other's entry, so the entry lock cannot serialise
  // them. Only the advisory relationship lock and the partial indexes can.
  const results = await Promise.allSettled(
    invitations.map((i) => claim({ token: i.token, userId: patient.id })),
  );
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  assert.equal(
    await db.practicePatientLink.count({ where: { practiceProfileId: p.id, patientUserId: patient.id } }),
    1,
    "two links were created for one relationship",
  );
  assert.equal(fulfilled.length, 1, "both claims succeeded — the second should have conflicted");
  const rejected = results.find((r) => r.status === "rejected");
  assert.match(rejected.reason.message, /link_already_bound_to_entry|invalid_or_expired_invitation/);
});

test("RACE claim vs revoke: never a live link with a revoked invitation", { skip }, async () => {
  for (let i = 0; i < 4; i += 1) {
    const s = await scene();
    const [claimed, revoked] = await Promise.allSettled([
      claim({ token: s.inv.token, userId: s.patient.id }),
      invSvc.revokeInvitation({ invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id }),
    ]);
    const inv = await db.practicePatientInvitation.findUnique({ where: { id: s.inv.invitation.id } });
    const links = await db.practicePatientLink.count({ where: { practiceProfileId: s.practice.id } });

    if (claimed.status === "fulfilled") {
      assert.equal(inv.status, "redeemed", "a revoke overwrote a completed claim");
      assert.equal(links, 1);
    } else {
      assert.equal(inv.status, "revoked");
      assert.equal(links, 0, "a link survived a failed claim");
    }
    assert.ok(claimed.status === "fulfilled" || revoked.status === "fulfilled");
  }
});

test("RACE claim vs regenerate: the entry never ends up half-linked", { skip }, async () => {
  for (let i = 0; i < 4; i += 1) {
    const s = await scene();
    const [claimed] = await Promise.allSettled([
      claim({ token: s.inv.token, userId: s.patient.id }),
      invSvc.createInvitationForEntry({ entryId: s.entry.id, practiceProfileId: s.practice.id }),
    ]);
    const entry = await db.practicePatientEntry.findUnique({ where: { id: s.entry.id } });
    const links = await db.practicePatientLink.count({ where: { practiceProfileId: s.practice.id } });
    if (claimed.status === "fulfilled") {
      assert.equal(entry.status, "linked");
      assert.ok(entry.practicePatientLinkId);
      assert.equal(links, 1);
    } else {
      assert.equal(entry.linkedAt, null);
      assert.equal(entry.practicePatientLinkId, null);
      assert.equal(links, 0);
    }
    // At most one pending invitation, whatever happened.
    assert.ok(
      await db.practicePatientInvitation.count({
        where: { practicePatientEntryId: s.entry.id, status: "pending" } }) <= 1,
    );
  }
});

test("RACE claim vs manual-code rotation", { skip }, async () => {
  for (let i = 0; i < 3; i += 1) {
    const s = await scene();
    const [claimed] = await Promise.allSettled([
      claim({ token: s.inv.token, userId: s.patient.id }),
      invSvc.rotateManualCode({ invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id }),
    ]);
    const inv = await db.practicePatientInvitation.findUnique({ where: { id: s.inv.invitation.id } });
    if (claimed.status === "fulfilled") {
      assert.equal(inv.status, "redeemed");
    }
    assert.equal(
      await db.practicePatientLink.count({ where: { practiceProfileId: s.practice.id } }),
      claimed.status === "fulfilled" ? 1 : 0,
    );
  }
});

test("RACE claim vs redeemConnectCode: one relationship, no raw error", { skip }, async () => {
  for (let i = 0; i < 3; i += 1) {
    const s = await scene();
    const code = await connectSvc.createConnectCode({
      patientUserId: s.patient.id, scopes: ["profile"],
    });
    const results = await Promise.allSettled([
      claim({ token: s.inv.token, userId: s.patient.id }),
      connectSvc.redeemConnectCode({ practiceProfileId: s.practice.id, code: code.code }),
    ]);
    assert.equal(
      await db.practicePatientLink.count({
        where: { practiceProfileId: s.practice.id, patientUserId: s.patient.id } }),
      1,
      "two links for one relationship",
    );
    for (const r of results.filter((x) => x.status === "rejected")) {
      // A raw P2002 reaching a caller would be the bug this hardening exists for.
      assert.equal(r.reason?.code, undefined, `raw Prisma error escaped: ${r.reason?.message}`);
    }
  }
});

/* ------------------------------------------------- the database invariants */

test("the database itself refuses a second live link — both subject types", { skip }, async () => {
  const owner = await user("owner");
  const p = await practice(owner);
  const patient = await user("patient");
  const profile = await db.patientProfile.create({
    data: { userId: patient.id, displayName: "Kind", relationLabel: "Tochter" },
  });

  for (const profileId of [null, profile.id]) {
    await db.practicePatientLink.create({
      data: { practiceProfileId: p.id, patientUserId: patient.id,
        patientProfileId: profileId, status: "invited" },
    });
    await assert.rejects(
      () => db.practicePatientLink.create({
        data: { practiceProfileId: p.id, patientUserId: patient.id,
          patientProfileId: profileId, status: "active" },
      }),
      (err) => err.code === "P2002",
      `a second live link was accepted for profileId=${profileId}`,
    );
    // Terminal rows may accumulate freely.
    await db.practicePatientLink.updateMany({
      where: { practiceProfileId: p.id, patientUserId: patient.id, patientProfileId: profileId },
      data: { status: "revoked" },
    });
    await db.practicePatientLink.create({
      data: { practiceProfileId: p.id, patientUserId: patient.id,
        patientProfileId: profileId, status: "archived" },
    });
  }
});

test("the old global unique is gone and both partial indexes are correct", { skip }, async () => {
  const rows = await db.$queryRawUnsafe(`
    SELECT c.relname AS name, i.indisunique AS uniq,
           COALESCE(pg_get_expr(i.indpred, i.indrelid), '') AS pred
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND t.relname = 'PracticePatientLink' AND i.indisunique
  `);
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(
    byName["PracticePatientLink_practiceProfileId_patientUserId_patient_key"], undefined,
    "the status-less global unique is still there",
  );
  const self = byName["PracticePatientLink_practice_patient_active_no_profile_key"];
  const repr = byName["PracticePatientLink_live_link_with_profile_key"];
  assert.ok(self, "the SELF partial index is missing");
  assert.ok(repr, "the REPRESENTED partial index is missing");
  assert.ok(self.pred.includes("IS NULL") && self.pred.includes("invited"));
  assert.ok(repr.pred.includes("IS NOT NULL") && repr.pred.includes("invited"));
});

test("P2002 on this model is reported as link_already_exists", { skip }, async () => {
  const owner = await user("owner");
  const p = await practice(owner);
  const patient = await user("patient");
  await linkSvc.createPracticePatientLink({
    practiceProfileId: p.id, patientUserId: patient.id, status: "invited",
  });
  // Bypass the service's own duplicate check by racing it — or simply call it
  // again: either way the domain error, never a raw Prisma code, must surface.
  await assert.rejects(
    () => linkSvc.createPracticePatientLink({
      practiceProfileId: p.id, patientUserId: patient.id, status: "invited",
    }),
    (err) => err.message === "link_already_exists" && err.code === undefined,
  );
});
