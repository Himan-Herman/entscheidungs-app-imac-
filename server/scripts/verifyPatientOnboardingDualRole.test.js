/**
 * One human, two roles — against a REAL PostgreSQL database.
 *
 * MedScoutX has no global account class. A person is practice staff because a
 * PracticeMember row says so for ONE practice, and a patient because a link says
 * so for ANOTHER. The receptionist at practice A is somebody's patient at
 * practice B, and that is the normal case, not an edge case.
 *
 * Everything here exists to prove the two halves do not bleed into each other:
 * that staff rights at A never become data access at B, that being a patient at
 * B never becomes a right at A, and that the one place the roles genuinely must
 * not meet — claiming your own practice's invitation — is closed.
 *
 * SAFETY: creates and drops a database named after this process, and refuses to
 * run unless the host is loopback. `medscoutx_dev` is never opened.
 *
 * Run: node --test scripts/verifyPatientOnboardingDualRole.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

const run = promisify(execFile);
const SANDBOX_DB = `medscoutx_dual_${process.pid}`;

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

let claimSvc = null, invSvc = null, entrySvc = null, linkSvc = null, access = null, perms = null;

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
  access = await import("../utils/practiceAccess.js");
  perms = await import("../utils/practicePermissions.js");
}

/* ---------------------------------------------------------------- fixtures */

let seq = 0;
const uid = () => `${process.pid}-${(seq += 1)}`;

async function user(label) {
  const n = uid();
  return db.user.create({
    data: {
      email: `${label}-${n}@test.invalid`, passwordHash: "x",
      firstName: "T", lastName: "User", dateOfBirth: new Date("1985-03-02"),
    },
  });
}

async function practice(owner, name) {
  const n = uid();
  return db.practiceProfile.create({
    data: { userId: owner.id, practiceName: name || `Praxis ${n}`, publicSlug: `slug-${n}` },
  });
}

/** Make `u` staff at `p`. Organizational role only — no clinical role. */
const employ = (p, u, role = "secretary", status = "active") =>
  db.practiceMember.create({
    data: { practiceProfileId: p.id, userId: u.id, role, status, acceptedAt: new Date() },
  });

async function entryWithInvitation(p, staffUserId, over = {}) {
  const { entry } = await entrySvc.createPracticePatientEntry({
    practiceProfileId: p.id, createdByUserId: staffUserId,
    givenName: "Test", familyName: "Person", ...over,
  });
  const inv = await invSvc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: p.id, createdByUserId: staffUserId,
  });
  return { entry, inv };
}

const SELF = { type: "self" };
const GENERIC = "invalid_or_expired_invitation";
const giveConsent = (linkId, patientUserId, scopes) =>
  linkSvc.acceptPracticePatientLinkConsent({ linkId, patientUserId, scopes });

/**
 * The whole world these tests share:
 *   DUAL_USER — secretary at PRACTICE_A, patient at PRACTICE_B (and C)
 *   USER_2    — a plain patient, no practice anywhere
 *   USER_3    — owner of PRACTICE_B, so A's staff never issues B's invitations
 */
async function world() {
  const ownerA = await user("ownerA");
  const A = await practice(ownerA, "Praxis A");
  const USER_3 = await user("ownerB");
  const B = await practice(USER_3, "Praxis B");
  const ownerC = await user("ownerC");
  const C = await practice(ownerC, "Praxis C");

  const DUAL = await user("dual");
  await employ(A, DUAL, "secretary");

  const USER_2 = await user("patient2");
  return { ownerA, A, USER_3, B, ownerC, C, DUAL, USER_2 };
}

/* ====================================================================
 * 1 + 3 — one login, two roles
 * ==================================================================== */

test("DUAL_USER holds practice access at A and none at B or C", { skip }, async () => {
  const w = await world();

  const atA = await access.getPracticeAccess(w.DUAL.id, w.A.id);
  assert.ok(atA, "DUAL_USER is staff at A but getPracticeAccess said no");
  assert.equal(atA.role, "secretary");

  assert.equal(await access.getPracticeAccess(w.DUAL.id, w.B.id), null,
    "staff rights at A leaked to B");
  assert.equal(await access.getPracticeAccess(w.DUAL.id, w.C.id), null);

  // And the plain patient is staff nowhere.
  assert.equal(await access.getPracticeAccess(w.USER_2.id, w.A.id), null);
});

test("the secretary role carries exactly the rights the matrix says", { skip }, async () => {
  const w = await world();
  const a = await access.getPracticeAccess(w.DUAL.id, w.A.id);

  // The onboarding module needs these two; both must come from the role, not
  // from the fact that the person also happens to be a patient somewhere.
  assert.equal(
    access.accessHasPermission(a, perms.PERMISSIONS.PATIENT_LINKS_READ),
    perms.hasPracticePermission("secretary", perms.PERMISSIONS.PATIENT_LINKS_READ),
  );
  assert.equal(
    access.accessHasPermission(a, perms.PERMISSIONS.PATIENT_LINKS_WRITE),
    perms.hasPracticePermission("secretary", perms.PERMISSIONS.PATIENT_LINKS_WRITE),
  );
  // A secretary is not an admin: team management must stay closed.
  assert.equal(
    access.accessHasPermission(a, perms.PERMISSIONS.TEAM_MANAGE), false,
    "a secretary can manage the team",
  );
});

test("a revoked or invited membership grants nothing", { skip }, async () => {
  const w = await world();
  const later = await user("later");

  await employ(w.B, later, "doctor", "invited");
  assert.equal(await access.getPracticeAccess(later.id, w.B.id), null,
    "an invited-but-not-accepted membership already granted access");

  await db.practiceMember.updateMany({
    where: { practiceProfileId: w.B.id, userId: later.id }, data: { status: "revoked" },
  });
  assert.equal(await access.getPracticeAccess(later.id, w.B.id), null,
    "a revoked membership still granted access");
});

/* ====================================================================
 * 4 — same-practice separation of duties
 * ==================================================================== */

test("DUAL_USER cannot claim an invitation issued by their OWN practice", { skip }, async () => {
  const w = await world();
  const { entry, inv } = await entryWithInvitation(w.A, w.ownerA.id);

  await assert.rejects(
    () => claimSvc.claimInvitation({ token: inv.token, userId: w.DUAL.id, subject: SELF }),
    (err) => err.message === GENERIC,
    "practice A's own staff redeemed practice A's invitation",
  );

  // Nothing happened, and nothing hints that the credential was in fact valid.
  assert.equal(
    await db.practicePatientLink.count({ where: { practiceProfileId: w.A.id } }), 0,
    "the blocked claim created a link",
  );
  const after = await db.practicePatientEntry.findUnique({ where: { id: entry.id } });
  assert.equal(after.linkedAt, null, "the blocked claim marked the entry linked");
  assert.equal(after.status, "invited");
  assert.equal(
    await db.consentRecord.count({ where: { patientUserId: w.DUAL.id } }), 0,
  );

  // The refusal is byte-identical to a nonsense credential: no oracle.
  const nonsense = await claimSvc
    .claimInvitation({ token: "definitely-not-a-token", userId: w.DUAL.id, subject: SELF })
    .catch((e) => e.message);
  assert.equal(nonsense, GENERIC, "a wrong credential answers differently than a blocked one");

  // The invitation is NOT burnt: a real patient can still use it.
  const ok = await claimSvc.claimInvitation({
    token: inv.token, userId: w.USER_2.id, subject: SELF,
  });
  assert.equal(ok.link.status, "invited");
});

test("the block follows the membership, not the person", { skip }, async () => {
  const w = await world();
  // The same DUAL_USER is refused at A (above) but must be accepted at B.
  const { inv } = await entryWithInvitation(w.B, w.USER_3.id);
  const res = await claimSvc.claimInvitation({
    token: inv.token, userId: w.DUAL.id, subject: SELF,
  });
  assert.equal(res.link.status, "invited", "staff at A were blocked from being a patient at B");
  assert.equal(res.practice.displayName, "Praxis B");
});

/* ====================================================================
 * 5 — cross-practice claim, then consent, then both views
 * ==================================================================== */

test("DUAL_USER becomes a patient at B without touching their role at A", { skip }, async () => {
  const w = await world();
  const memberBefore = await db.practiceMember.findFirst({
    where: { practiceProfileId: w.A.id, userId: w.DUAL.id },
  });

  const { entry, inv } = await entryWithInvitation(w.B, w.USER_3.id);
  const claimed = await claimSvc.claimInvitation({
    token: inv.token, userId: w.DUAL.id, subject: SELF,
  });

  /* --- the claim grants nothing ----------------------------------------- */
  assert.equal(claimed.link.status, "invited");
  let link = await db.practicePatientLink.findUnique({ where: { id: claimed.link.id } });
  assert.equal(link.practiceProfileId, w.B.id, "the link carries the wrong practice");
  assert.notEqual(link.practiceProfileId, w.A.id, "practice A context leaked into the link");
  assert.equal(link.consentAcceptedAt, null);
  assert.deepEqual(link.consentScopes ?? [], []);
  assert.equal(await db.consentRecord.count({ where: { practicePatientLinkId: link.id } }), 0);

  /* --- the membership at A is untouched ---------------------------------- */
  const memberAfter = await db.practiceMember.findFirst({
    where: { practiceProfileId: w.A.id, userId: w.DUAL.id },
  });
  assert.equal(memberAfter.role, memberBefore.role, "becoming a patient changed the staff role");
  assert.equal(memberAfter.status, memberBefore.status);
  assert.equal(
    await db.practiceMember.count({ where: { userId: w.DUAL.id } }), 1,
    "the claim created a practice membership",
  );

  /* --- consent, explicitly ----------------------------------------------- */
  await giveConsent(link.id, w.DUAL.id, ["profile", "messages"]);
  link = await db.practicePatientLink.findUnique({ where: { id: link.id } });
  assert.equal(link.status, "active");
  assert.deepEqual([...link.consentScopes].sort(), ["messages", "profile"]);

  /* --- B sees the connection, A does not --------------------------------- */
  const inB = await linkSvc.listPracticePatientLinks(w.B.id, {});
  assert.deepEqual(inB.links.map((l) => l.id), [link.id]);

  const inA = await linkSvc.listPracticePatientLinks(w.A.id, {});
  assert.equal(inA.links.length, 0, "practice A can see its own employee's care relationship at B");

  const entryB = await entrySvc.getPracticePatientEntry(entry.id, w.B.id);
  assert.equal(entrySvc.entryToJson(entryB).isLinked, true);

  /* --- and the patient sees B -------------------------------------------- */
  const mine = await linkSvc.listPatientCareLinks(w.DUAL.id, {});
  assert.deepEqual(mine.links.map((l) => l.id), [link.id]);
});

test("staff rights at A are not consent, and consent at B is not a right", { skip }, async () => {
  const w = await world();
  const { inv } = await entryWithInvitation(w.B, w.USER_3.id);
  const claimed = await claimSvc.claimInvitation({
    token: inv.token, userId: w.DUAL.id, subject: SELF,
  });
  await giveConsent(claimed.link.id, w.DUAL.id, ["profile"]);

  // Being a consented patient at B grants nothing at B's staff surface...
  assert.equal(await access.getPracticeAccess(w.DUAL.id, w.B.id), null,
    "consenting as a patient granted practice access");

  // ...and being staff at A is not a care relationship at A.
  const asPatientOfA = await db.practicePatientLink.count({
    where: { practiceProfileId: w.A.id, patientUserId: w.DUAL.id },
  });
  assert.equal(asPatientOfA, 0, "the staff membership created a care relationship");
});

/* ====================================================================
 * "Context switching" — the query path, run repeatedly
 * ==================================================================== */

test("switching between the two contexts never carries state across", { skip }, async () => {
  const w = await world();
  const { inv } = await entryWithInvitation(w.B, w.USER_3.id);
  const claimed = await claimSvc.claimInvitation({
    token: inv.token, userId: w.DUAL.id, subject: SELF,
  });
  await giveConsent(claimed.link.id, w.DUAL.id, ["profile"]);

  // A → patient → A → patient → A. Every answer must be identical every time:
  // these calls are stateless, and this is what proves it rather than assumes it.
  for (let i = 0; i < 3; i += 1) {
    const a = await access.getPracticeAccess(w.DUAL.id, w.A.id);
    assert.equal(a.role, "secretary", `round ${i}: practice role changed`);

    const patientLinks = await linkSvc.listPatientCareLinks(w.DUAL.id, {});
    assert.deepEqual(
      patientLinks.links.map((l) => l.id), [claimed.link.id],
      `round ${i}: the patient view changed`,
    );

    const practiceLinks = await linkSvc.listPracticePatientLinks(w.A.id, {});
    assert.equal(practiceLinks.links.length, 0, `round ${i}: B's relationship appeared in A`);

    const entries = await entrySvc.listPracticePatientEntries(w.A.id, {});
    for (const e of entries.entries) {
      assert.equal(e.practiceProfileId ?? w.A.id, w.A.id, `round ${i}: a foreign entry appeared`);
    }
  }
});

test("one practice can never read another's entries, links or invitations", { skip }, async () => {
  const w = await world();
  const { entry, inv } = await entryWithInvitation(w.B, w.USER_3.id);

  // A's staff know the id — that is the interesting case, not a guessed one.
  await assert.rejects(
    () => entrySvc.getPracticePatientEntry(entry.id, w.A.id),
    () => true,
    "practice A read practice B's entry by id",
  );
  await assert.rejects(
    () => invSvc.revokeInvitation({ invitationId: inv.invitation.id, practiceProfileId: w.A.id }),
    () => true,
    "practice A revoked practice B's invitation",
  );
  const stillPending = await db.practicePatientInvitation.findUnique({
    where: { id: inv.invitation.id },
  });
  assert.equal(stillPending.status, "pending", "the cross-tenant attempt changed B's data");
});

/* ====================================================================
 * 7 — family profiles
 * ==================================================================== */

test("a family-profile claim uses exactly that profile and no matching", { skip }, async () => {
  const w = await world();
  const child = await db.patientProfile.create({
    data: {
      userId: w.DUAL.id, displayName: "Kind", relationLabel: "Kind",
      dateOfBirth: new Date("2015-06-01"),
    },
  });

  // The entry's name and date of birth are deliberately nothing like the
  // profile's: the subject comes from the patient's choice, never from matching.
  const { inv } = await entryWithInvitation(w.B, w.USER_3.id, {
    givenName: "Ganz", familyName: "Anders", dateOfBirth: "1970-01-01",
  });

  const res = await claimSvc.claimInvitation({
    token: inv.token, userId: w.DUAL.id,
    subject: { type: "patient_profile", patientProfileId: child.id },
  });
  const link = await db.practicePatientLink.findUnique({ where: { id: res.link.id } });
  assert.equal(link.patientProfileId, child.id);
  assert.equal(link.patientUserId, w.DUAL.id, "the account must still own the link");
});

test("the self link and a profile link at the same practice stay separate", { skip }, async () => {
  const w = await world();
  const child = await db.patientProfile.create({
    data: { userId: w.DUAL.id, displayName: "Kind", relationLabel: "Kind" },
  });

  const first = await entryWithInvitation(w.B, w.USER_3.id);
  const self = await claimSvc.claimInvitation({
    token: first.inv.token, userId: w.DUAL.id, subject: SELF,
  });

  const second = await entryWithInvitation(w.B, w.USER_3.id);
  const forChild = await claimSvc.claimInvitation({
    token: second.inv.token, userId: w.DUAL.id,
    subject: { type: "patient_profile", patientProfileId: child.id },
  });

  assert.notEqual(self.link.id, forChild.link.id, "the child's care was merged into the adult's");
  const rows = await db.practicePatientLink.findMany({
    where: { practiceProfileId: w.B.id, patientUserId: w.DUAL.id },
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.patientProfileId).sort(), [child.id, null].sort());

  // Consent for one is not consent for the other.
  await giveConsent(self.link.id, w.DUAL.id, ["profile"]);
  const childLink = await db.practicePatientLink.findUnique({ where: { id: forChild.link.id } });
  assert.equal(childLink.status, "invited", "consenting for myself also released my child's data");
  assert.deepEqual(childLink.consentScopes ?? [], []);
});

test("a foreign or archived profile is refused", { skip }, async () => {
  const w = await world();
  const strangersChild = await db.patientProfile.create({
    data: { userId: w.USER_2.id, displayName: "Fremd", relationLabel: "Kind" },
  });
  const archived = await db.patientProfile.create({
    data: {
      userId: w.DUAL.id, displayName: "Alt", relationLabel: "Kind", isArchived: true,
    },
  });

  const a = await entryWithInvitation(w.B, w.USER_3.id);
  await assert.rejects(
    () => claimSvc.claimInvitation({
      token: a.inv.token, userId: w.DUAL.id,
      subject: { type: "patient_profile", patientProfileId: strangersChild.id },
    }),
    () => true,
    "a profile belonging to somebody else was accepted",
  );

  const b = await entryWithInvitation(w.B, w.USER_3.id);
  await assert.rejects(
    () => claimSvc.claimInvitation({
      token: b.inv.token, userId: w.DUAL.id,
      subject: { type: "patient_profile", patientProfileId: archived.id },
    }),
    () => true,
    "an archived profile was accepted",
  );

  assert.equal(
    await db.practicePatientLink.count({ where: { patientUserId: w.DUAL.id } }), 0,
    "a refused subject still produced a link",
  );
});

/* ====================================================================
 * 12 — several practices at once
 * ==================================================================== */

test("B and C stay independent: consent, revocation and context", { skip }, async () => {
  const w = await world();
  const b = await entryWithInvitation(w.B, w.USER_3.id);
  const c = await entryWithInvitation(w.C, w.ownerC.id);

  const linkB = await claimSvc.claimInvitation({
    token: b.inv.token, userId: w.DUAL.id, subject: SELF,
  });
  const linkC = await claimSvc.claimInvitation({
    token: c.inv.token, userId: w.DUAL.id, subject: SELF,
  });
  assert.notEqual(linkB.link.id, linkC.link.id);

  await giveConsent(linkB.link.id, w.DUAL.id, ["profile", "documents"]);

  let rowB = await db.practicePatientLink.findUnique({ where: { id: linkB.link.id } });
  let rowC = await db.practicePatientLink.findUnique({ where: { id: linkC.link.id } });
  assert.equal(rowB.status, "active");
  assert.equal(rowC.status, "invited", "consent at B activated C");
  assert.deepEqual(rowC.consentScopes ?? [], [], "B's scopes leaked to C");

  // Consent to C with a DIFFERENT set — they must not converge.
  await giveConsent(linkC.link.id, w.DUAL.id, ["messages"]);
  rowB = await db.practicePatientLink.findUnique({ where: { id: linkB.link.id } });
  rowC = await db.practicePatientLink.findUnique({ where: { id: linkC.link.id } });
  assert.deepEqual([...rowB.consentScopes].sort(), ["documents", "profile"]);
  assert.deepEqual([...rowC.consentScopes], ["messages"]);

  // Revoking B leaves C alone.
  await linkSvc.revokeLink(linkB.link.id, w.B.id);
  rowB = await db.practicePatientLink.findUnique({ where: { id: linkB.link.id } });
  rowC = await db.practicePatientLink.findUnique({ where: { id: linkC.link.id } });
  assert.equal(rowB.status, "revoked");
  assert.equal(rowC.status, "active", "revoking B took C down with it");
  assert.deepEqual([...rowC.consentScopes], ["messages"]);

  // And B cannot revoke C's link.
  await assert.rejects(() => linkSvc.revokeLink(linkC.link.id, w.B.id), () => true);
  rowC = await db.practicePatientLink.findUnique({ where: { id: linkC.link.id } });
  assert.equal(rowC.status, "active", "one practice revoked another's relationship");
});

/* ====================================================================
 * 11 — idempotency and double submits
 * ==================================================================== */

test("two simultaneous claims of one invitation produce one link", { skip }, async () => {
  const w = await world();
  const { inv } = await entryWithInvitation(w.B, w.USER_3.id);

  // The double-click, as the server sees it.
  const results = await Promise.allSettled([
    claimSvc.claimInvitation({ token: inv.token, userId: w.DUAL.id, subject: SELF }),
    claimSvc.claimInvitation({ token: inv.token, userId: w.DUAL.id, subject: SELF }),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled");
  assert.ok(ok.length >= 1, "both concurrent claims failed");

  const rows = await db.practicePatientLink.findMany({
    where: { practiceProfileId: w.B.id, patientUserId: w.DUAL.id },
  });
  assert.equal(rows.length, 1, `a double click produced ${rows.length} links`);

  // Whichever succeeded, both must agree on the one link that exists.
  for (const r of ok) assert.equal(r.value.link.id, rows[0].id);
});

test("re-opening a spent invitation adds nothing", { skip }, async () => {
  const w = await world();
  const { inv } = await entryWithInvitation(w.B, w.USER_3.id);
  const first = await claimSvc.claimInvitation({
    token: inv.token, userId: w.DUAL.id, subject: SELF,
  });
  await giveConsent(first.link.id, w.DUAL.id, ["profile"]);

  const consentsBefore = await db.consentRecord.count({ where: { patientUserId: w.DUAL.id } });

  // Same person, same credential, again — the "opened the mail twice" case.
  // This SUCCEEDS by design and returns the relationship that already exists:
  // an error here would tell somebody who simply re-read their email that
  // something is wrong. What must not happen is a second anything.
  const again = await claimSvc.claimInvitation({
    token: inv.token, userId: w.DUAL.id, subject: SELF,
  });
  assert.equal(again.link.id, first.link.id, "re-opening produced a different link");
  assert.equal(again.link.status, "active", "re-opening demoted the active relationship");

  // A DIFFERENT account gets the generic refusal — the idempotency is bound to
  // the person who redeemed it, not to the credential.
  const other = await claimSvc
    .claimInvitation({ token: inv.token, userId: w.USER_2.id, subject: SELF })
    .catch((e) => e.message);
  assert.equal(other, GENERIC, "a spent invitation worked for somebody else");

  const rows = await db.practicePatientLink.findMany({
    where: { practiceProfileId: w.B.id, patientUserId: w.DUAL.id },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "active", "re-opening reset the relationship");
  assert.deepEqual([...rows[0].consentScopes], ["profile"]);
  assert.equal(
    await db.consentRecord.count({ where: { patientUserId: w.DUAL.id } }), consentsBefore,
    "re-opening created another consent record",
  );
});

/* ====================================================================
 * 13 — revoke and regenerate
 * ==================================================================== */

test("revoking an invitation closes it, and reissuing opens a new one only", { skip }, async () => {
  const w = await world();
  const { entry, inv } = await entryWithInvitation(w.B, w.USER_3.id);

  await invSvc.revokeInvitation({
    invitationId: inv.invitation.id, practiceProfileId: w.B.id,
  });
  await assert.rejects(
    () => claimSvc.claimInvitation({ token: inv.token, userId: w.DUAL.id, subject: SELF }),
    (e) => e.message === GENERIC,
  );
  let row = await db.practicePatientEntry.findUnique({ where: { id: entry.id } });
  assert.equal(row.linkedAt, null, "a revoked invitation left a half-linked entry");
  assert.equal(await db.practicePatientLink.count({ where: { practiceProfileId: w.B.id } }), 0);

  // Reissue on the same entry.
  const fresh = await invSvc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: w.B.id, createdByUserId: w.USER_3.id,
  });
  const ok = await claimSvc.claimInvitation({
    token: fresh.token, userId: w.DUAL.id, subject: SELF,
  });
  assert.equal(ok.link.status, "invited");

  row = await db.practicePatientEntry.findUnique({ where: { id: entry.id } });
  assert.equal(row.status, "linked");
  assert.ok(row.linkedAt);
  assert.equal(
    await db.practicePatientLink.count({ where: { practiceProfileId: w.B.id } }), 1,
    "the reissue produced a second link",
  );
});

/* ====================================================================
 * 8 — the manual code, for the dual user
 * ==================================================================== */

test("the on-site code works for DUAL_USER at B and is still blocked at A", { skip }, async () => {
  const w = await world();

  const atB = await entryWithInvitation(w.B, w.USER_3.id);
  const codeB = await invSvc.rotateManualCode({
    invitationId: atB.inv.invitation.id, practiceProfileId: w.B.id,
  });
  const ok = await claimSvc.claimInvitation({
    code: codeB.manualCode, userId: w.DUAL.id, subject: SELF,
  });
  assert.equal(ok.link.status, "invited");

  // The same channel at their OWN practice stays closed.
  const atA = await entryWithInvitation(w.A, w.ownerA.id);
  const codeA = await invSvc.rotateManualCode({
    invitationId: atA.inv.invitation.id, practiceProfileId: w.A.id,
  });
  await assert.rejects(
    () => claimSvc.claimInvitation({ code: codeA.manualCode, userId: w.DUAL.id, subject: SELF }),
    (e) => e.message === GENERIC,
    "the code channel bypassed separation of duties",
  );
});

/* ====================================================================
 * 6 — the plain patient, for contrast
 * ==================================================================== */

test("USER_2 runs the ordinary flow at practice A end to end", { skip }, async () => {
  const w = await world();
  const { entry, inv } = await entryWithInvitation(w.A, w.ownerA.id, {
    givenName: "Zwei", familyName: "Nutzer",
  });

  const claimed = await claimSvc.claimInvitation({
    token: inv.token, userId: w.USER_2.id, subject: SELF,
  });
  assert.equal(claimed.link.status, "invited");
  assert.equal(await db.consentRecord.count({ where: { patientUserId: w.USER_2.id } }), 0);

  await giveConsent(claimed.link.id, w.USER_2.id, ["profile"]);

  const link = await db.practicePatientLink.findUnique({ where: { id: claimed.link.id } });
  assert.equal(link.status, "active");

  const practiceView = await linkSvc.listPracticePatientLinks(w.A.id, {});
  assert.deepEqual(practiceView.links.map((l) => l.id), [link.id]);
  const patientView = await linkSvc.listPatientCareLinks(w.USER_2.id, {});
  assert.deepEqual(patientView.links.map((l) => l.id), [link.id]);

  const dto = entrySvc.entryToJson(await entrySvc.getPracticePatientEntry(entry.id, w.A.id));
  assert.equal(dto.isLinked, true);
  // The practice never learns the account behind the entry.
  assert.equal("patientUserId" in dto, false);

  // A plain patient gains no practice rights from any of this.
  assert.equal(await access.getPracticeAccess(w.USER_2.id, w.A.id), null);
});
