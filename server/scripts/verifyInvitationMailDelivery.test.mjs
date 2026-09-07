/**
 * What actually goes out on the wire when a practice presses "send by email".
 *
 * The copy tests prove the WORDING. This proves the DELIVERY: which address it
 * is sent to, that the sender is ours and never the patient's, and that the
 * message handed to the transport carries a fragment link and nothing that
 * identifies a person or their health.
 *
 * The transport is intercepted, so nothing is ever actually sent.
 *
 * NOTE: this file needs module mocking, which is still behind a flag, so it is
 * deliberately named `.test.mjs` and stays OUT of `npm test`'s `scripts/*.test.js`
 * glob. Run it explicitly:
 *
 *   node --test --experimental-test-module-mocks scripts/verifyInvitationMailDelivery.test.mjs
 */
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "dotenv/config";

const run = promisify(execFile);
const SANDBOX_DB = `medscoutx_mail_${process.pid}`;

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

/** Every message the code tried to send, captured instead of delivered. */
const sent = [];
const FROM = "MedScoutX <noreply@test.invalid>";

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

    // The transport, replaced. `from` is modelled exactly as emailService does
    // it: taken from configuration, never from an argument — so a caller cannot
    // put the patient's own address in the From header even by mistake.
    mock.module("../emailService.js", {
      namedExports: {
        sendMail: async (to, subject, text, html) => {
          sent.push({ from: FROM, to, subject, text, html });
          return true;
        },
        sendEmailWithPdfAttachment: async () => true,
      },
    });
  }
} catch (err) {
  skip = `sandbox or module mocking unavailable: ${err?.message ?? err}`;
}

test.after(async () => {
  if (db) await db.$disconnect();
  if (!sandboxUrl || !admin) return;
  try { await psql(admin, `DROP DATABASE IF EXISTS "${SANDBOX_DB}"`); } catch { /* noise */ }
});

let entrySvc = null, invSvc = null, deliverySvc = null;

if (!skip) {
  process.env.FRONTEND_URL = "https://app.test.invalid";
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

  entrySvc = await import("../services/patientOnboarding/practicePatientEntryService.js");
  invSvc = await import("../services/patientOnboarding/practicePatientInvitationService.js");
  deliverySvc = await import("../services/patientOnboarding/invitationDeliveryService.js");
}

/* ---------------------------------------------------------------- fixtures */

let seq = 0;
const uid = () => `${process.pid}-${(seq += 1)}`;
const PATIENT_EMAIL = "erika.musterfrau@test.invalid";

async function scene() {
  const n = uid();
  const owner = await db.user.create({
    data: {
      email: `owner-${n}@test.invalid`, passwordHash: "x",
      firstName: "O", lastName: "W", dateOfBirth: new Date("1980-01-01"),
    },
  });
  const practice = await db.practiceProfile.create({
    data: { userId: owner.id, practiceName: "Praxis Nordlicht", publicSlug: `slug-${n}` },
  });
  const { entry } = await entrySvc.createPracticePatientEntry({
    practiceProfileId: practice.id, createdByUserId: owner.id,
    givenName: "Erika", familyName: "Musterfrau",
    dateOfBirth: "1974-11-23", email: PATIENT_EMAIL,
    practiceRecordNumber: "CHART-4711",
  });
  const inv = await invSvc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: practice.id, createdByUserId: owner.id,
  });
  return { owner, practice, entry, inv };
}

/* ------------------------------------------------------------------ tests */

test("the message goes to the address on the entry, from our own sender", { skip }, async () => {
  const s = await scene();
  sent.length = 0;

  const res = await deliverySvc.sendInvitationEmail({
    entryId: s.entry.id, practiceProfileId: s.practice.id,
    token: s.inv.token, locale: "de",
  });

  assert.equal(sent.length, 1, "expected exactly one message");
  const m = sent[0];
  assert.equal(m.to, PATIENT_EMAIL, "sent to the wrong recipient");
  assert.equal(m.from, FROM, "the sender was not the configured address");
  assert.equal(m.from.includes(PATIENT_EMAIL), false, "the patient's address became the sender");

  // What the practice gets back is masked, not the full address.
  assert.equal(res.deliveredTo, "e…u@test.invalid");
  assert.equal(res.deliveredTo.includes("erika.musterfrau"), false);
});

test("the subject is neutral and the practice is named only in the body", { skip }, async () => {
  const s = await scene();
  sent.length = 0;
  await deliverySvc.sendInvitationEmail({
    entryId: s.entry.id, practiceProfileId: s.practice.id, token: s.inv.token, locale: "de",
  });

  const m = sent[0];
  assert.equal(m.subject, "Ihre Einladung");
  assert.equal(
    m.subject.includes("Nordlicht"), false,
    "the subject names the practice — readable without opening the mail",
  );
  assert.match(m.text, /Praxis Nordlicht/, "the body must say who is inviting");
  assert.match(m.html, /Praxis Nordlicht/);
});

test("the link is a fragment link, in both the text and the HTML part", { skip }, async () => {
  const s = await scene();
  sent.length = 0;
  await deliverySvc.sendInvitationEmail({
    entryId: s.entry.id, practiceProfileId: s.practice.id, token: s.inv.token, locale: "de",
  });

  const m = sent[0];
  const expected = `https://app.test.invalid/patient-invitation#token=${encodeURIComponent(s.inv.token)}`;
  assert.ok(m.text.includes(expected), "the plain-text link is not the fragment link");
  assert.ok(m.html.includes(`href="${expected}"`), "the HTML link is not the fragment link");

  for (const part of [m.text, m.html]) {
    assert.equal(part.includes("?token="), false, "a query-string token appeared");
    assert.equal(part.includes("/token/"), false, "a path token appeared");
  }
});

test("nothing in the message identifies the person or their health", { skip }, async () => {
  const s = await scene();
  sent.length = 0;
  await deliverySvc.sendInvitationEmail({
    entryId: s.entry.id, practiceProfileId: s.practice.id, token: s.inv.token, locale: "de",
  });

  const m = sent[0];
  const whole = `${m.subject}\n${m.text}\n${m.html}`;

  const forbidden = {
    "the patient's given name": "Erika",
    "the patient's family name": "Musterfrau",
    "the date of birth": "1974",
    "the practice chart number": "CHART-4711",
    "the entry id": s.entry.id,
    "the invitation id": s.inv.invitation.id,
    "the practice id": s.practice.id,
    "the creating user's id": s.owner.id,
  };
  for (const [what, value] of Object.entries(forbidden)) {
    assert.equal(whole.includes(value), false, `the email leaked ${what}`);
  }

  // No clinical vocabulary of any kind.
  assert.equal(
    /diagnos|befund|therapie|behandlung|medikament|symptom/i.test(whole), false,
    "the email contains clinical wording",
  );

  // The recipient address is a delivery detail, not content to echo back.
  assert.equal(m.text.includes(PATIENT_EMAIL), false, "the body repeats the address");
});

test("a failing precondition sends nothing at all", { skip }, async () => {
  // No address on the entry: the send must be refused before a message exists.
  const n = uid();
  const owner = await db.user.create({
    data: {
      email: `o2-${n}@test.invalid`, passwordHash: "x",
      firstName: "O", lastName: "W", dateOfBirth: new Date("1980-01-01"),
    },
  });
  const practice = await db.practiceProfile.create({
    data: { userId: owner.id, practiceName: "Praxis Ohne", publicSlug: `slug2-${n}` },
  });
  const { entry } = await entrySvc.createPracticePatientEntry({
    practiceProfileId: practice.id, createdByUserId: owner.id,
    givenName: "Ohne", familyName: "Adresse",
  });
  const inv = await invSvc.createInvitationForEntry({
    entryId: entry.id, practiceProfileId: practice.id, createdByUserId: owner.id,
  });

  sent.length = 0;
  await assert.rejects(
    () => deliverySvc.sendInvitationEmail({
      entryId: entry.id, practiceProfileId: practice.id, token: inv.token, locale: "de",
    }),
    (err) => err.message === "entry_has_no_email",
  );
  assert.equal(sent.length, 0, "a message was built despite the refusal");
});

test("each product language sends a complete message", { skip }, async () => {
  for (const locale of ["de", "en", "fr", "it", "es", "ru"]) {
    const s = await scene();
    sent.length = 0;
    await deliverySvc.sendInvitationEmail({
      entryId: s.entry.id, practiceProfileId: s.practice.id, token: s.inv.token, locale,
    });
    const m = sent[0];
    assert.ok(m.subject.trim(), `${locale}: empty subject`);
    assert.equal(m.subject.includes("Nordlicht"), false, `${locale}: subject leaked the practice`);
    assert.ok(m.text.includes("#token="), `${locale}: lost the fragment link`);
    assert.ok(m.text.includes("Praxis Nordlicht"), `${locale}: body lost the practice name`);
    assert.equal(m.text.includes("Musterfrau"), false, `${locale}: leaked the patient's name`);
  }
});
