/**
 * The whole product flow, end to end, against a REAL PostgreSQL database.
 *
 * The unit and route tests each prove one link in the chain. This file proves
 * the chain: a practice creates a record, invites, a patient claims, consent is
 * given separately, and only then does the relationship carry any access. The
 * interesting failures live between the steps — a claim that quietly grants
 * access, a second practice overwriting the first, a revoked consent that still
 * works — and none of them is visible from inside a single step.
 *
 * SAFETY: creates and drops a database named after this process, and refuses to
 * run unless the host is loopback. `medscoutx_dev` is never opened.
 *
 * Run: node --test scripts/verifyPatientOnboardingE2E.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

const run = promisify(execFile);
const SANDBOX_DB = `medscoutx_e2e_${process.pid}`;

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
let deliverySvc = null;
let emailCopy = null;

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
  deliverySvc = await import("../services/patientOnboarding/invitationDeliveryService.js");
  emailCopy = await import("../services/patientOnboarding/invitationEmailCopy.js");
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

async function practice(owner, name) {
  const n = uid();
  return db.practiceProfile.create({
    data: {
      userId: owner.id,
      practiceName: name || `Praxis ${n}`,
      publicSlug: `slug-${n}`,
    },
  });
}

async function entryWithInvitation(p, owner, over = {}) {
  const { entry } = await entrySvc.createPracticePatientEntry({
    practiceProfileId: p.id, createdByUserId: owner.id,
    givenName: "Anna", familyName: "Müller", dateOfBirth: "1980-05-04",
    ...over,
  });
  const inv = await invSvc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: p.id, createdByUserId: owner.id,
  });
  return { entry, inv };
}

/** A practice, a staff owner, an entry with a live invitation, and a patient. */
async function scene(over = {}) {
  const owner = await user("owner");
  const p = await practice(owner, over.practiceName);
  const patient = await user("patient");
  const { entry, inv } = await entryWithInvitation(p, owner, over.entry);
  return { owner, practice: p, patient, entry, inv };
}

const SELF = { type: "self" };
const SCOPES = ["profile"];

/** The consent step. Separate act, separate call — never part of the claim. */
const giveConsent = (linkId, patientUserId, scopes = SCOPES) =>
  linkSvc.acceptPracticePatientLinkConsent({ linkId, patientUserId, scopes });

/* ====================================================================
 * FLOW 1 — self, via link
 * ==================================================================== */

test("FLOW 1: entry, invitation, claim, consent, and both sides see it", { skip }, async () => {
  const s = await scene();

  /* --- the claim binds, and grants nothing ------------------------------- */
  const claimed = await claimSvc.claimInvitation({
    token: s.inv.token, userId: s.patient.id, subject: SELF,
  });
  assert.equal(claimed.link.status, "invited");

  let link = await db.practicePatientLink.findUnique({ where: { id: claimed.link.id } });
  assert.equal(link.status, "invited");
  assert.equal(link.consentAcceptedAt, null, "the claim must not accept consent");
  // null, not [] — the claim does not write the column at all.
  assert.deepEqual(link.consentScopes ?? [], [], "the claim must not grant a scope");

  const consentsAfterClaim = await db.consentRecord.count({
    where: { practicePatientLinkId: link.id },
  });
  assert.equal(consentsAfterClaim, 0, "the claim created a ConsentRecord on its own");

  /* --- the practice can see the state without any patient identity ------- */
  const entryAfter = await entrySvc.getPracticePatientEntry(s.entry.id, s.practice.id);
  const dto = entrySvc.entryToJson(entryAfter);
  assert.equal(dto.isLinked, true, "the practice cannot tell the entry was claimed");
  assert.equal(dto.status, "linked");
  assert.ok(dto.linkedAt instanceof Date);
  assert.equal("patientUserId" in dto, false, "the DTO leaks the patient's user id");
  assert.equal("practicePatientLinkId" in dto, false, "the DTO leaks the link id");

  /* --- the patient sees the practice, as a pending request --------------- */
  const before = await linkSvc.listPatientCareLinks(s.patient.id, {});
  const seen = before.links.find((l) => l.id === link.id);
  assert.ok(seen, "the patient cannot find the practice after claiming");
  assert.equal(seen.status, "invited");

  /* --- consent is a separate, explicit act ------------------------------- */
  await giveConsent(link.id, s.patient.id);

  link = await db.practicePatientLink.findUnique({ where: { id: link.id } });
  assert.equal(link.status, "active", "consent did not activate the link");
  assert.deepEqual(link.consentScopes, SCOPES);
  assert.ok(link.consentAcceptedAt, "consent left no timestamp");

  const after = await linkSvc.listPatientCareLinks(s.patient.id, {});
  assert.equal(after.links.find((l) => l.id === link.id).status, "active");
});

test("FLOW 1b: the invitation is spent — the same token cannot claim twice", { skip }, async () => {
  const s = await scene();
  await claimSvc.claimInvitation({ token: s.inv.token, userId: s.patient.id, subject: SELF });

  const other = await user("second");
  await assert.rejects(
    () => claimSvc.claimInvitation({ token: s.inv.token, userId: other.id, subject: SELF }),
    (err) => err.message === "invalid_or_expired_invitation",
  );
});

/* ====================================================================
 * FLOW 2 — a family profile, not the account holder
 * ==================================================================== */

test("FLOW 2: a claim for a family profile binds to that profile", { skip }, async () => {
  const s = await scene();
  const profile = await db.patientProfile.create({
    data: { userId: s.patient.id, displayName: "Kind", relationLabel: "Kind" },
  });

  const res = await claimSvc.claimInvitation({
    token: s.inv.token, userId: s.patient.id,
    subject: { type: "patient_profile", patientProfileId: profile.id },
  });

  const link = await db.practicePatientLink.findUnique({ where: { id: res.link.id } });
  assert.equal(link.patientUserId, s.patient.id, "the account still owns the link");
  assert.equal(link.patientProfileId, profile.id, "the profile is who the care is for");
  assert.equal(link.status, "invited");

  // Consent is still the account holder's act — a profile cannot consent itself.
  await giveConsent(link.id, s.patient.id);
  const activated = await db.practicePatientLink.findUnique({ where: { id: link.id } });
  assert.equal(activated.status, "active");
  assert.equal(activated.patientProfileId, profile.id, "consent moved the subject");
});

test("FLOW 2b: a profile belonging to somebody else is refused", { skip }, async () => {
  const s = await scene();
  const stranger = await user("stranger");
  const theirProfile = await db.patientProfile.create({
    data: { userId: stranger.id, displayName: "Fremd", relationLabel: "Andere" },
  });

  await assert.rejects(
    () => claimSvc.claimInvitation({
      token: s.inv.token, userId: s.patient.id,
      subject: { type: "patient_profile", patientProfileId: theirProfile.id },
    }),
    (err) => err.message !== undefined,
  );

  // And the invitation is NOT burnt by the rejected attempt.
  const ok = await claimSvc.claimInvitation({
    token: s.inv.token, userId: s.patient.id, subject: SELF,
  });
  assert.equal(ok.link.status, "invited");
});

/* ====================================================================
 * FLOW 3 — the on-site code
 * ==================================================================== */

test("FLOW 3: a manual code claims exactly like a link", { skip }, async () => {
  const s = await scene();
  const rotated = await invSvc.rotateManualCode({
    invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id,
  });
  assert.ok(rotated.manualCode, "no code was issued");

  const res = await claimSvc.claimInvitation({
    code: rotated.manualCode, userId: s.patient.id, subject: SELF,
  });
  assert.equal(res.link.status, "invited");
  assert.equal(res.practice.displayName, s.practice.practiceName);
});

test("FLOW 3b: rotating the code kills the previous one", { skip }, async () => {
  const s = await scene();
  const first = await invSvc.rotateManualCode({
    invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id,
  });
  const second = await invSvc.rotateManualCode({
    invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id,
  });
  assert.notEqual(first.manualCode, second.manualCode);

  await assert.rejects(
    () => claimSvc.claimInvitation({ code: first.manualCode, userId: s.patient.id, subject: SELF }),
    (err) => err.message === "invalid_or_expired_invitation",
    "the superseded code still worked",
  );

  const ok = await claimSvc.claimInvitation({
    code: second.manualCode, userId: s.patient.id, subject: SELF,
  });
  assert.equal(ok.link.status, "invited");
});

test("FLOW 3c: rotating a code does NOT extend the invitation's own expiry", { skip }, async () => {
  const s = await scene();
  const before = await db.practicePatientInvitation.findUnique({
    where: { id: s.inv.invitation.id },
  });
  await invSvc.rotateManualCode({
    invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id,
  });
  const after = await db.practicePatientInvitation.findUnique({
    where: { id: s.inv.invitation.id },
  });
  assert.equal(
    after.expiresAt.getTime(), before.expiresAt.getTime(),
    "a fresh 60-minute code silently moved the 7-day invitation window",
  );
});

test("FLOW 3d: an expired code is refused, while its invitation stays alive", { skip }, async () => {
  const s = await scene();
  const code = await invSvc.rotateManualCode({
    invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id,
  });

  // Age the code past its 60 minutes without touching the invitation.
  await db.practicePatientInvitation.update({
    where: { id: s.inv.invitation.id },
    data: { manualCodeExpiresAt: new Date(Date.now() - 60_000) },
  });

  await assert.rejects(
    () => claimSvc.claimInvitation({ code: code.manualCode, userId: s.patient.id, subject: SELF }),
    (err) => err.message === "invalid_or_expired_invitation",
  );

  // The link token is a separate credential and must still work.
  const ok = await claimSvc.claimInvitation({
    token: s.inv.token, userId: s.patient.id, subject: SELF,
  });
  assert.equal(ok.link.status, "invited");
});

/* ====================================================================
 * FLOW 4 — one patient, two practices
 * ==================================================================== */

test("FLOW 4: two practices produce two independent relationships", { skip }, async () => {
  const patient = await user("shared");

  const ownerA = await user("ownerA");
  const A = await practice(ownerA, "Praxis A");
  const a = await entryWithInvitation(A, ownerA);

  const ownerB = await user("ownerB");
  const B = await practice(ownerB, "Praxis B");
  const b = await entryWithInvitation(B, ownerB);

  const linkA = await claimSvc.claimInvitation({
    token: a.inv.token, userId: patient.id, subject: SELF,
  });
  const linkB = await claimSvc.claimInvitation({
    token: b.inv.token, userId: patient.id, subject: SELF,
  });

  assert.notEqual(linkA.link.id, linkB.link.id, "the second claim overwrote the first");
  assert.equal(linkA.practice.displayName, "Praxis A");
  assert.equal(linkB.practice.displayName, "Praxis B");

  /* --- consent to A only ------------------------------------------------- */
  await giveConsent(linkA.link.id, patient.id, ["profile"]);

  const rowA = await db.practicePatientLink.findUnique({ where: { id: linkA.link.id } });
  const rowB = await db.practicePatientLink.findUnique({ where: { id: linkB.link.id } });
  assert.equal(rowA.status, "active");
  assert.equal(rowB.status, "invited", "consenting to A also activated B");
  assert.deepEqual(rowB.consentScopes ?? [], [], "scopes leaked across practices");
  assert.equal(rowA.practiceProfileId, A.id);
  assert.equal(rowB.practiceProfileId, B.id);

  /* --- each practice sees only its own side ------------------------------ */
  const listA = await linkSvc.listPracticePatientLinks(A.id, {});
  const listB = await linkSvc.listPracticePatientLinks(B.id, {});
  assert.deepEqual(listA.links.map((l) => l.id), [linkA.link.id]);
  assert.deepEqual(listB.links.map((l) => l.id), [linkB.link.id]);

  /* --- the patient sees both, distinctly --------------------------------- */
  const mine = await linkSvc.listPatientCareLinks(patient.id, {});
  const ids = mine.links.map((l) => l.id).sort();
  assert.deepEqual(ids, [linkA.link.id, linkB.link.id].sort());
});

/* ====================================================================
 * FLOW 5 — revoked before the patient gets there
 * ==================================================================== */

test("FLOW 5: a revoked invitation cannot be claimed", { skip }, async () => {
  const s = await scene();
  await invSvc.revokeInvitation({
    invitationId: s.inv.invitation.id, practiceProfileId: s.practice.id,
  });

  await assert.rejects(
    () => claimSvc.claimInvitation({ token: s.inv.token, userId: s.patient.id, subject: SELF }),
    (err) => err.message === "invalid_or_expired_invitation",
  );

  // Revoking also ends the on-site code that rode on the same invitation.
  const s2 = await scene();
  const code = await invSvc.rotateManualCode({
    invitationId: s2.inv.invitation.id, practiceProfileId: s2.practice.id,
  });
  await invSvc.revokeInvitation({
    invitationId: s2.inv.invitation.id, practiceProfileId: s2.practice.id,
  });
  await assert.rejects(
    () => claimSvc.claimInvitation({ code: code.manualCode, userId: s2.patient.id, subject: SELF }),
    (err) => err.message === "invalid_or_expired_invitation",
    "the code outlived the invitation it belonged to",
  );

  const links = await db.practicePatientLink.count({ where: { practiceProfileId: s.practice.id } });
  assert.equal(links, 0, "a refused claim still created a relationship");
});

/* ====================================================================
 * FLOW 6 — reissue
 * ==================================================================== */

test("FLOW 6: reissuing kills the old invitation and the new one works", { skip }, async () => {
  const s = await scene();
  const fresh = await invSvc.createInvitationForEntry({
    entryId: s.entry.id, practiceProfileId: s.practice.id, createdByUserId: s.owner.id,
  });
  assert.equal(fresh.supersededCount, 1, "the previous invitation was not superseded");
  assert.notEqual(fresh.token, s.inv.token);

  await assert.rejects(
    () => claimSvc.claimInvitation({ token: s.inv.token, userId: s.patient.id, subject: SELF }),
    (err) => err.message === "invalid_or_expired_invitation",
    "the replaced invitation still worked",
  );

  const ok = await claimSvc.claimInvitation({
    token: fresh.token, userId: s.patient.id, subject: SELF,
  });
  assert.equal(ok.link.status, "invited");
});

/* ====================================================================
 * FLOW 7 — an existing, already-consented relationship
 * ==================================================================== */

test("FLOW 7a: an existing active relationship is reused, not reset", { skip }, async () => {
  const s = await scene();

  // The patient is ALREADY connected and has already consented — via the
  // existing connect-code path, so the link belongs to no local entry. Then the
  // practice creates a local record for them and invites.
  const existing = await db.practicePatientLink.create({
    data: {
      practiceProfileId: s.practice.id,
      patientUserId: s.patient.id,
      status: "active",
      consentScopes: SCOPES,
      consentAcceptedAt: new Date(),
    },
  });

  const res = await claimSvc.claimInvitation({
    token: s.inv.token, userId: s.patient.id, subject: SELF,
  });

  assert.equal(res.link.id, existing.id, "a second relationship row was created");
  assert.equal(res.link.status, "active", "an active relationship was demoted to invited");

  const rows = await db.practicePatientLink.findMany({
    where: { practiceProfileId: s.practice.id, patientUserId: s.patient.id },
  });
  assert.equal(rows.length, 1, "the patient now has two links to one practice");
  assert.equal(rows[0].status, "active");
  assert.deepEqual(rows[0].consentScopes, SCOPES, "the existing consent was dropped");
  assert.ok(rows[0].consentAcceptedAt, "the consent timestamp was cleared");
});

test("FLOW 7b: a relationship already owned by another entry is refused", { skip }, async () => {
  const s = await scene();
  const first = await claimSvc.claimInvitation({
    token: s.inv.token, userId: s.patient.id, subject: SELF,
  });
  await giveConsent(first.link.id, s.patient.id);

  // A colleague, not seeing the first record, creates a second one and invites.
  const second = await entryWithInvitation(s.practice, s.owner);

  // Refused on purpose: merging two local records is the practice's decision,
  // never a side effect of a patient pressing a button.
  await assert.rejects(
    () => claimSvc.claimInvitation({
      token: second.inv.token, userId: s.patient.id, subject: SELF,
    }),
    (err) => err.message === "link_already_bound_to_entry",
  );

  // And the refusal changed nothing: still one relationship, still active,
  // still consented, and the second entry is still unclaimed.
  const rows = await db.practicePatientLink.findMany({
    where: { practiceProfileId: s.practice.id, patientUserId: s.patient.id },
  });
  assert.equal(rows.length, 1, "the refused claim created a relationship anyway");
  assert.equal(rows[0].status, "active");
  assert.deepEqual(rows[0].consentScopes, SCOPES);

  const secondEntry = await entrySvc.getPracticePatientEntry(second.entry.id, s.practice.id);
  assert.equal(secondEntry.linkedAt, null, "the refused claim marked the entry linked");
});

/* ====================================================================
 * FLOW 8 — consent revocation is fail-closed
 * ==================================================================== */

test("FLOW 8: revoking consent closes access and stays closed", { skip }, async () => {
  const s = await scene();
  const claimed = await claimSvc.claimInvitation({
    token: s.inv.token, userId: s.patient.id, subject: SELF,
  });
  await giveConsent(claimed.link.id, s.patient.id);

  await linkSvc.revokeLink(claimed.link.id, s.practice.id);

  const revoked = await db.practicePatientLink.findUnique({ where: { id: claimed.link.id } });
  assert.equal(revoked.status, "revoked");

  // Fail-closed: a revoked relationship cannot be re-consented into life. The
  // patient has to be invited again, deliberately, by the practice.
  await assert.rejects(
    () => giveConsent(claimed.link.id, s.patient.id),
    (err) => err.message === "link_not_active",
    "a revoked link accepted consent again",
  );

  const still = await db.practicePatientLink.findUnique({ where: { id: claimed.link.id } });
  assert.equal(still.status, "revoked", "the refused consent changed the status anyway");
});

test("FLOW 8b: merely reading the relationship grants nothing", { skip }, async () => {
  const s = await scene();
  const claimed = await claimSvc.claimInvitation({
    token: s.inv.token, userId: s.patient.id, subject: SELF,
  });

  const before = await db.consentRecord.count({ where: { patientUserId: s.patient.id } });
  await linkSvc.listPatientCareLinks(s.patient.id, {});
  await linkSvc.getPatientCareLink(claimed.link.id, s.patient.id);
  await linkSvc.listPracticePatientLinks(s.practice.id, {});
  const after = await db.consentRecord.count({ where: { patientUserId: s.patient.id } });

  assert.equal(after, before, "opening a page created consent records");

  const link = await db.practicePatientLink.findUnique({ where: { id: claimed.link.id } });
  assert.equal(link.status, "invited", "reading activated the link");
});

/* ====================================================================
 * The email channel
 * ==================================================================== */

test("EMAIL: the link carries the token in the fragment and nowhere else", { skip }, () => {
  process.env.FRONTEND_URL = "https://app.example";
  const url = deliverySvc.buildInvitationUrl("tok-abc-123");

  assert.equal(url, "https://app.example/patient-invitation#token=tok-abc-123");
  const parsed = new URL(url);
  assert.equal(parsed.search, "", "the token reached the query string");
  assert.equal(parsed.pathname, "/patient-invitation", "the token reached the path");
});

test("EMAIL: the body says who invited and nothing about the patient", { skip }, () => {
  const { subject, text, html } = emailCopy.buildInvitationEmail({
    practiceName: "Praxis Nord",
    link: "https://app.example/patient-invitation#token=tok-1",
    expiresInDays: 7,
    locale: "de",
  });

  // The subject must NOT name the practice: it is readable without opening the
  // mail, and a specialist practice's name is a health inference on its own.
  assert.equal(subject.includes("Praxis Nord"), false, "the subject named the practice");
  assert.equal(subject.trim(), "Ihre Einladung");
  assert.match(text, /Praxis Nord/, "the body must still say who is inviting");
  assert.match(text, /7 Tage/);
  assert.match(text, /#token=tok-1/);

  // Nothing that identifies a person or says anything clinical may appear. The
  // caller does not even pass these, and this asserts it stays that way.
  for (const forbidden of ["Müller", "Anna", "1980", "Diagnose", "Befund", "cuid"]) {
    assert.equal(text.includes(forbidden), false, `the email leaked "${forbidden}"`);
  }
  assert.equal(/<script/i.test(html), false);
});

test("EMAIL: the practice name is escaped, not injected as markup", { skip }, () => {
  const { html } = emailCopy.buildInvitationEmail({
    practiceName: '<img src=x onerror="alert(1)">',
    link: "https://app.example/patient-invitation#token=t",
    expiresInDays: 7, locale: "de",
  });
  assert.equal(html.includes("<img"), false, "operator text was rendered as markup");
  assert.ok(html.includes("&lt;img"));
});

test("EMAIL: every product language is present and complete", { skip }, () => {
  for (const locale of ["de", "en", "fr", "it", "es", "ru"]) {
    const m = emailCopy.buildInvitationEmail({
      practiceName: "P", link: "https://x/y#token=t", expiresInDays: 7, locale,
    });
    assert.ok(m.subject.trim(), `${locale}: empty subject`);
    assert.equal(m.subject.includes("P"), false, `${locale}: the subject leaked the practice name`);
    assert.ok(m.text.includes("P"), `${locale}: the body lost the practice name`);
    assert.ok(m.text.includes("#token=t"), `${locale}: lost the link`);
    assert.ok(m.text.includes("7"), `${locale}: lost the expiry`);
  }
  // An unknown locale must still produce a sendable message.
  const fallback = emailCopy.buildInvitationEmail({
    practiceName: "P", link: "https://x/y#token=t", expiresInDays: 7, locale: "zz",
  });
  assert.ok(fallback.subject.trim());
});

test("EMAIL: an entry with no address is refused before anything is issued", { skip }, async () => {
  const s = await scene();  // created without an email
  await assert.rejects(
    () => deliverySvc.loadDeliverableEntry({
      entryId: s.entry.id, practiceProfileId: s.practice.id,
    }),
    (err) => err.message === "entry_has_no_email",
  );
});

test("EMAIL: an entry from another practice does not resolve", { skip }, async () => {
  const mine = await scene({ entry: { email: "a@test.invalid" } });
  const otherOwner = await user("other");
  const otherPractice = await practice(otherOwner);

  await assert.rejects(
    () => deliverySvc.loadDeliverableEntry({
      entryId: mine.entry.id, practiceProfileId: otherPractice.id,
    }),
    (err) => err.message === "entry_not_found",
    "one practice could address another practice's entry",
  );
});

test("EMAIL: an already-linked entry is not invited again by mail", { skip }, async () => {
  const s = await scene({ entry: { email: "a@test.invalid" } });
  await claimSvc.claimInvitation({ token: s.inv.token, userId: s.patient.id, subject: SELF });

  await assert.rejects(
    () => deliverySvc.loadDeliverableEntry({
      entryId: s.entry.id, practiceProfileId: s.practice.id,
    }),
    (err) => err.message === "entry_already_linked",
  );
});

test("EMAIL: the address is masked when echoed back to the practice", { skip }, () => {
  assert.equal(deliverySvc.maskEmail("anna.mueller@example.com"), "a…r@example.com");
  assert.equal(deliverySvc.maskEmail("ab@example.com"), "a…@example.com");
  assert.equal(deliverySvc.maskEmail("not-an-address"), "");
  assert.equal(deliverySvc.maskEmail(null), "");
});
