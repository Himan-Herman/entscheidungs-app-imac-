/**
 * An invitation survives account creation.
 *
 * The gap: a patient without an account opened the invitation, registered, and
 * confirmed their e-mail — in a NEW tab, because the confirmation link opens
 * wherever the mail client sends it. The invitation lived only in the old tab,
 * so the new one signed in and the invitation was simply gone.
 *
 * The fix carries the invitation token in the FRAGMENT of the confirmation link
 * and returns the patient to /patient-invitation. These tests pin the three
 * things that make that safe:
 *   1. only a genuinely redeemable invitation is carried, anything else is
 *      dropped silently (no oracle);
 *   2. the token never appears in the part of a URL a server receives;
 *   3. `next` is an allowlist of one, so the verify redirect cannot be aimed
 *      anywhere else.
 *
 * Run: node --test scripts/verifyInvitationCarry.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

import {
  AUTH_RETURN_PATHS,
  buildVerifyLink,
  buildVerifyRedirect,
  safeAuthReturnPath,
} from "../services/patientOnboarding/invitationCarry.js";

const run = promisify(execFile);
const SANDBOX_DB = `medscoutx_carry_${process.pid}`;

/* ------------------------------------------------------------ pure parts */

test("the confirmation link without an invitation is unchanged", () => {
  const link = buildVerifyLink({ apiBase: "https://api.example/", mailToken: "abc" });
  assert.equal(link, "https://api.example/api/auth/verify-email?token=abc");
});

test("a carried invitation travels ONLY in the fragment", () => {
  const link = buildVerifyLink({
    apiBase: "https://api.example",
    mailToken: "abc",
    invitationToken: "INVITE_TOKEN_1234567890abcdef",
  });
  const url = new URL(link);
  // Everything a server ever receives — origin, path and query — is clean.
  assert.equal(`${url.origin}${url.pathname}${url.search}`.includes("INVITE_TOKEN"), false,
    "the invitation token reached a part of the URL that is sent to a server");
  assert.equal(url.searchParams.get("next"), "/patient-invitation");
  assert.equal(url.hash, "#invitation=INVITE_TOKEN_1234567890abcdef");
});

test("the verify redirect keeps only an allowlisted next, and adds no fragment", () => {
  const login = "https://app.example/login";
  assert.equal(
    buildVerifyRedirect({ loginUrl: login, status: "ok", next: "/patient-invitation" }),
    "https://app.example/login?verify=ok&next=%2Fpatient-invitation",
  );
  // A fragment of its own would REPLACE the one the browser is carrying.
  assert.equal(
    buildVerifyRedirect({ loginUrl: login, status: "ok", next: "/patient-invitation" }).includes("#"),
    false,
  );
  for (const hostile of [
    "https://evil.example", "//evil.example", "/patient-invitation/../admin",
    "/practice", "/patient-invitation?x=1", " javascript:alert(1)", "", null, 42,
  ]) {
    assert.equal(
      buildVerifyRedirect({ loginUrl: login, status: "ok", next: hostile }),
      "https://app.example/login?verify=ok",
      `accepted next=${JSON.stringify(hostile)}`,
    );
  }
});

test("the allowlist really is one path", () => {
  assert.deepEqual([...AUTH_RETURN_PATHS], ["/patient-invitation"]);
  assert.equal(safeAuthReturnPath("  /patient-invitation  "), "/patient-invitation");
  assert.equal(safeAuthReturnPath("/PATIENT-INVITATION"), null);
});

/* ------------------------------------------------- against a real database */

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

let carry = null;
let invSvc = null;
let entrySvc = null;

if (!skip) {
  process.env.PATIENT_ONBOARDING_V2 = "true";
  const { prisma } = await import("../lib/prisma.js");
  for (const key of [
    "practiceProfile", "practicePatientEntry", "practicePatientInvitation",
    "practicePatientLink", "auditLog", "user", "practiceMember",
  ]) {
    prisma[key] = db[key];
  }
  prisma.$transaction = db.$transaction.bind(db);
  prisma.$queryRaw = db.$queryRaw.bind(db);
  prisma.$executeRaw = db.$executeRaw.bind(db);
  carry = await import("../services/patientOnboarding/invitationCarry.js");
  invSvc = await import("../services/patientOnboarding/practicePatientInvitationService.js");
  entrySvc = await import("../services/patientOnboarding/practicePatientEntryService.js");
}

let seq = 0;
const n = () => `${process.pid}-${(seq += 1)}`;

async function invitation() {
  const k = n();
  const owner = await db.user.create({
    data: {
      email: `owner-${k}@test.invalid`, passwordHash: "x",
      firstName: "A", lastName: "B", dateOfBirth: new Date("1980-01-01"),
    },
  });
  const p = await db.practiceProfile.create({
    data: { userId: owner.id, practiceName: `Praxis ${k}`, publicSlug: `slug-${k}` },
  });
  const { entry } = await entrySvc.createPracticePatientEntry({
    practiceProfileId: p.id, createdByUserId: owner.id,
    givenName: "Erna", familyName: "Beispiel", dateOfBirth: "1948-05-12",
  });
  const inv = await invSvc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: p.id, createdByUserId: owner.id,
  });
  return { owner, practice: p, entry, inv };
}

test("a redeemable invitation is carried", { skip }, async () => {
  const { inv } = await invitation();
  assert.equal(await carry.resolveCarriedInvitation(inv.token), inv.token);
});

test("anything that is not a redeemable invitation is dropped silently", { skip }, async () => {
  // Never throws, never distinguishes: a registration must answer the same
  // whether or not the string it carried was a live credential.
  for (const junk of [
    undefined, null, 42, {}, "", "short", "has spaces in it definitely",
    "x".repeat(200), "DefinitelyNotAnInvitationToken_000000",
  ]) {
    assert.equal(await carry.resolveCarriedInvitation(junk), null, `carried ${JSON.stringify(junk)}`);
  }

  // A real token whose invitation was revoked.
  const revoked = await invitation();
  await db.practicePatientInvitation.update({
    where: { id: revoked.inv.invitation.id },
    data: { status: "revoked", revokedAt: new Date() },
  });
  assert.equal(await carry.resolveCarriedInvitation(revoked.inv.token), null);

  // A real token whose invitation has expired.
  const expired = await invitation();
  await db.practicePatientInvitation.update({
    where: { id: expired.inv.invitation.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal(await carry.resolveCarriedInvitation(expired.inv.token), null);
});

test("carrying writes nothing", { skip }, async () => {
  const { inv } = await invitation();
  const before = await db.practicePatientInvitation.findUnique({ where: { id: inv.invitation.id } });
  await carry.resolveCarriedInvitation(inv.token);
  const after = await db.practicePatientInvitation.findUnique({ where: { id: inv.invitation.id } });
  assert.equal(after.status, "pending");
  assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime(), "the carry touched the invitation");
  assert.equal(await db.practicePatientLink.count(), 0, "the carry created a relationship");
});

test("with the onboarding feature off, nothing is carried", { skip }, async () => {
  const { inv } = await invitation();
  process.env.PATIENT_ONBOARDING_V2 = "false";
  try {
    assert.equal(await carry.resolveCarriedInvitation(inv.token), null);
  } finally {
    process.env.PATIENT_ONBOARDING_V2 = "true";
  }
});
