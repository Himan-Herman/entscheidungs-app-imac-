/**
 * Written lifecycle receipts and the transactional outbox.
 *
 * Scope is deliberately narrow: the release gate, the practice-owner block and
 * the archive/lock invariants are already pinned by
 * verifyDestructiveDeletionGate.test.js, verifyPracticeDeletionHttp.test.js and
 * verifyContextualDataDeletionGuard.test.js — none of that is re-tested here.
 *
 * What IS pinned:
 *   - the receipt is written in the SAME transaction as the erasure, so a
 *     rolled-back deletion produces neither a case nor a queued mail (no false
 *     success confirmation), and a committed one cannot lose its receipt;
 *   - nothing is handed to the mail provider from inside a transaction;
 *   - the dispatcher marks "sent" only after a successful provider send,
 *     keeps failures for retry and never double-claims a row;
 *   - receipts carry no medical content, no internal ids and no tokens, in
 *     all five languages;
 *   - the AP3 audit action names are untouched.
 *
 * No database and no Resend: Prisma is an in-memory fake with rollback
 * semantics and the provider send is injected. Never touches medscoutx_dev.
 *
 * Run: node --test scripts/verifyLifecycleReceipts.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-lifecycle-receipts";
delete process.env.SUPPORT_EMAIL;
// The gate stays closed here: this file never exercises a destructive path.
delete process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION;

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { dispatchPendingLifecycleEmails } from "../services/practiceLifecycle/lifecycleOutboxService.js";
import { renderLifecycleEmail } from "../services/practiceLifecycle/lifecycleEmailTemplates.js";

const accountRouter = await import("../routes/account.js");

const PATIENT = "user-patient-P";
const DELETE_CONFIRM = "DELETE_MY_MEDSCOUTX_DATA";

let users;
let lifecycleCases;
let outboxRows;
let auditRows;
let deletedUsers;
let seq;
let failUserDelete;
let txDepth;
let claimedInsideTx;

function resetData() {
  users = [{ id: PATIENT, email: "patient@example.invalid", profile: { preferredUiLanguage: "de" } }];
  lifecycleCases = [];
  outboxRows = [];
  auditRows = [];
  deletedUsers = [];
  seq = 0;
  failUserDelete = false;
  txDepth = 0;
  claimedInsideTx = false;
}

function installFake() {
  resetData();
  prisma.$queryRaw = async () => [{ id: PATIENT }];
  prisma.user = {
    findUnique: async ({ where }) => {
      const row = users.find((u) => u.id === where.id);
      return row ? { ...row } : null;
    },
    delete: async ({ where }) => {
      if (failUserDelete) throw new Error("simulated db failure");
      deletedUsers.push(where.id);
      users = users.filter((u) => u.id !== where.id);
      return { id: where.id };
    },
  };
  prisma.practiceProfile = {
    count: async () => 0,
    findMany: async () => [],
    deleteMany: async () => ({ count: 0 }),
  };
  prisma.lifecycleCase = {
    create: async ({ data }) => {
      seq += 1;
      const row = { ...data, id: `case-${seq}`, seq, createdAt: new Date() };
      lifecycleCases.push(row);
      return { ...row };
    },
    update: async ({ where, data }) => {
      const row = lifecycleCases.find((c) => c.id === where.id);
      Object.assign(row, data);
      return { ...row };
    },
    updateMany: async () => ({ count: 0 }),
  };
  prisma.lifecycleOutboxEmail = {
    create: async ({ data }) => {
      const row = { ...data, id: `outbox-${outboxRows.length + 1}`, status: "pending", attempts: 0, createdAt: new Date() };
      outboxRows.push(row);
      return { ...row };
    },
    findMany: async ({ where, take }) =>
      outboxRows
        .filter((r) => where.status.in.includes(r.status) && r.attempts < where.attempts.lt)
        .slice(0, take ?? 100)
        .map((r) => ({ ...r })),
    updateMany: async ({ where, data }) => {
      // The dispatcher claims a row with exactly this call. Seeing it while a
      // transaction is open would mean the mail provider is being driven from
      // inside the erasure transaction.
      if (txDepth > 0) claimedInsideTx = true;
      const hit = outboxRows.filter(
        (r) => r.id === where.id && (where.status ? where.status.in.includes(r.status) : true),
      );
      for (const r of hit) {
        if (data.attempts?.increment) r.attempts += data.attempts.increment;
        for (const [k, v] of Object.entries(data)) if (k !== "attempts") r[k] = v;
      }
      return { count: hit.length };
    },
  };
  prisma.auditLog = {
    create: async ({ data }) => { auditRows.push(data); return data; },
    deleteMany: async () => ({ count: 0 }),
    updateMany: async () => ({ count: 0 }),
  };
  const noop = {
    deleteMany: async () => ({ count: 0 }),
    updateMany: async () => ({ count: 0 }),
    findMany: async () => [],
    count: async () => 0,
    findUnique: async () => null,
  };
  for (const model of [
    "preVisitSession", "preVisitCase", "doctorContact", "doctor",
    "interpreterCloudSession", "interpreterCloudPreference", "practiceInterpreterInvite",
    "externalResourceReference", "practiceMedaSession", "practiceDocumentAuditEntry",
    "billingPlausibilitySession", "billingPlausibilityItem", "billingPlausibilityAuditLog",
    "practiceMember", "practicePatientLink", "userProfile",
    "vitalEntry", "vaccinationEntry", "allergyEntry", "diagnosisEntry",
    "archivedPracticePatientContext", "practiceDocumentShareGrant",
  ]) {
    prisma[model] = { ...noop };
  }
  // Rollback semantics: a throwing callback discards everything written inside.
  prisma.$transaction = async (fn) => {
    txDepth += 1;
    const snap = {
      lifecycleCases: [...lifecycleCases], outboxRows: [...outboxRows],
      users: users.map((u) => ({ ...u })), deletedUsers: [...deletedUsers], seq,
    };
    try {
      return await fn(prisma);
    } catch (err) {
      lifecycleCases = snap.lifecycleCases; outboxRows = snap.outboxRows;
      users = snap.users; deletedUsers = snap.deletedUsers; seq = snap.seq;
      throw err;
    } finally {
      txDepth -= 1;
    }
  };
}

let server;
let baseUrl;
let requestSeq = 0;

test.before(async () => {
  installFake();
  const app = express();
  app.use(express.json());
  app.use("/api/account", requireAuth, accountRouter.default);
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((r) => server.close(r)));
test.beforeEach(() => installFake());

async function call(method, path, { user, body } = {}) {
  requestSeq += 1;
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` } : {}),
      "Content-Type": "application/json",
      "X-Forwarded-For": `10.2.${Math.floor(requestSeq / 250)}.${(requestSeq % 250) + 1}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  let parsed = null;
  try { parsed = await res.json(); } catch { parsed = null; }
  return { status: res.status, body: parsed };
}

/* ------------------------------------------- transactional outbox guarantees */

test("a completed erasure writes exactly one case and queues both receipts", async () => {
  const res = await call("DELETE", "/api/account/delete", {
    user: PATIENT, body: { confirmation: DELETE_CONFIRM },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(deletedUsers, [PATIENT]);
  assert.match(res.body.caseNumber, /^AD-\d{4}-\d{6}$/);
  assert.equal(res.body.emailStatus, "email_delivery_pending");

  assert.equal(lifecycleCases.length, 1);
  assert.equal(lifecycleCases[0].entityType, "user_account");
  assert.equal(lifecycleCases[0].requestedByUserId ?? null, null, "no user id on the case row");

  assert.deepEqual(outboxRows.map((r) => r.kind).sort(), [
    "medscoutx_internal_notice", "patient_account_deleted",
  ]);
  assert.equal(
    outboxRows.find((r) => r.kind === "patient_account_deleted").recipientEmail,
    "patient@example.invalid",
  );
  assert.equal(
    outboxRows.find((r) => r.kind === "medscoutx_internal_notice").recipientEmail,
    "contact@medscoutx.com",
  );
  // The provider is never driven from inside the erasure transaction; the
  // post-commit kick may already have attempted delivery by now, which is the
  // intended behaviour.
  assert.equal(claimedInsideTx, false, "the outbox was dispatched inside the transaction");
});

test("a FAILED erasure produces no case, no receipt and no success answer", async () => {
  failUserDelete = true;
  const res = await call("DELETE", "/api/account/delete", {
    user: PATIENT, body: { confirmation: DELETE_CONFIRM },
  });
  assert.notEqual(res.status, 200);
  assert.deepEqual(deletedUsers, []);
  assert.deepEqual(lifecycleCases, [], "a rolled-back erasure leaves no written case");
  assert.deepEqual(outboxRows, [], "a rolled-back erasure queues no confirmation");
});

test("a refused confirmation phrase queues nothing", async () => {
  const res = await call("DELETE", "/api/account/delete", { user: PATIENT, body: {} });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "confirmation_required");
  assert.deepEqual(lifecycleCases, []);
  assert.deepEqual(outboxRows, []);
});

test("the AP3 audit action names are preserved and account_deleted is not resurrected", async () => {
  await call("DELETE", "/api/account/delete", {
    user: PATIENT, body: { confirmation: DELETE_CONFIRM },
  });
  const actions = auditRows.map((a) => a.action);
  assert.ok(actions.includes("account_deletion_patient_data_removed"));
  assert.ok(actions.includes("account_deletion_completed"));
  assert.ok(actions.includes("lifecycle_receipt_queued"));
  assert.ok(!actions.includes("account_deleted"), "the AP3 rename must stand");
});

/* --------------------------------------------------------- dispatcher */

test("sent only on provider success; failures stay queued and retry", async () => {
  for (const to of ["a@x.invalid", "b@x.invalid"]) {
    await prisma.lifecycleOutboxEmail.create({
      data: {
        caseNumber: "AD-2026-000001", kind: "patient_account_deleted",
        recipientEmail: to, locale: "de", paramsJson: JSON.stringify({ actionAt: "t" }),
      },
    });
  }
  const sends = [];
  const stats = await dispatchPendingLifecycleEmails({
    sendFn: async (to, subject, text, _html, opts) => {
      sends.push({ to, replyTo: opts?.replyTo });
      if (to === "b@x.invalid") throw new Error("provider down");
    },
  });
  assert.deepEqual(stats, { sent: 1, failed: 1, skipped: 0 });
  assert.equal(outboxRows.find((r) => r.recipientEmail === "a@x.invalid").status, "sent");
  const failed = outboxRows.find((r) => r.recipientEmail === "b@x.invalid");
  assert.equal(failed.status, "failed");
  assert.equal(failed.attempts, 1);
  assert.equal(sends[0].replyTo, "contact@medscoutx.com");

  const retry = await dispatchPendingLifecycleEmails({ sendFn: async () => {} });
  assert.equal(retry.sent, 1);
  assert.equal(failed.status, "sent");
});

test("a row another dispatcher already claimed is never sent twice", async () => {
  await prisma.lifecycleOutboxEmail.create({
    data: {
      caseNumber: "AD-2026-000002", kind: "patient_account_deleted",
      recipientEmail: "c@x.invalid", locale: "de", paramsJson: null,
    },
  });
  outboxRows[0].status = "sending";
  const stats = await dispatchPendingLifecycleEmails({
    sendFn: async () => { throw new Error("must not be called"); },
  });
  assert.deepEqual(stats, { sent: 0, failed: 0, skipped: 0 });
});

/* ------------------------------------------------------- receipt content */

test("receipts carry no medical content, ids or tokens — in all five languages", () => {
  const params = {
    caseNumber: "AD-2026-000042",
    actionAt: "29.07.2026, 12:00 (Europe/Berlin)",
    recipientEmail: "patient@example.invalid",
    practiceName: "Praxis A",
    supportEmail: "contact@medscoutx.com",
  };
  const kinds = [
    "patient_account_deleted", "practice_suspended", "practice_reactivated",
    "practice_closed", "practice_reactivation_requested", "practice_deletion_requested",
  ];
  for (const locale of ["de", "en", "fr", "it", "es"]) {
    for (const kind of kinds) {
      const mail = renderLifecycleEmail(kind, locale, params);
      assert.ok(mail?.subject && mail?.text, `${locale}/${kind} missing`);
      assert.ok(mail.subject.includes(params.caseNumber), `${locale}/${kind} subject lacks the case number`);
      const all = `${mail.subject}\n${mail.text}`;
      for (const forbidden of [
        PATIENT, "Diagnose", "diagnosis", "Medikament", "link-", "user-", "Bearer ", "eyJ",
      ]) {
        assert.ok(!all.includes(forbidden), `${locale}/${kind} leaked "${forbidden}"`);
      }
      assert.ok(all.includes("contact@medscoutx.com"), `${locale}/${kind} lacks the support address`);
    }
  }
});

test("the deletion-request receipt states that nothing was deleted yet", () => {
  for (const [locale, needle] of Object.entries({
    de: "noch keine endgültige Löschung",
    en: "No permanent deletion has been performed yet",
    fr: "Aucune suppression définitive n'a encore",
    it: "Non è stata ancora eseguita alcuna cancellazione",
    es: "Todavía no se ha realizado ninguna eliminación",
  })) {
    const mail = renderLifecycleEmail("practice_deletion_requested", locale, {
      caseNumber: "PD-2026-000123", actionAt: "x", practiceName: "P",
      supportEmail: "contact@medscoutx.com",
    });
    assert.ok(mail.text.includes(needle), `${locale} lacks the "nothing deleted yet" statement`);
  }
});
