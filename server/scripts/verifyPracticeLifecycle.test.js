/**
 * Practice lifecycle state machine + enforcement.
 *
 * Pins the closed transition set (active ⇄ suspended, → closed,
 * closed → reactivation_requested, * → deletion_requested), the owner-only +
 * password re-auth rule on every mutation, the concurrency guard (two parallel
 * changes cannot both win and no state is lost), the central operative-access
 * revocation in getPracticeAccess, and the written proof: exactly one
 * LifecycleCase and exactly one audit row per successful change — and that a
 * deletion request deletes NOTHING and never touches the release gate.
 *
 * No database: Prisma is replaced by an in-memory adapter, so this never
 * touches medscoutx_dev. Routes, middleware and error mapping run for real.
 *
 * Run: node --test server/scripts/verifyPracticeLifecycle.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-lifecycle";
delete process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION;

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  getPracticeAccess,
  resolvePracticeOwnerForControlledDeletion,
} from "../utils/practiceAccess.js";
import {
  LIFECYCLE_ERRORS,
  applyPracticeLifecycleTransition,
  isPracticeOperative,
  practiceLifecycleStatusOf,
} from "../services/practiceLifecycle/practiceLifecycleService.js";

const practiceLifecycleRouter = await import("../routes/practiceLifecycle.js");

const OWNER = "user-owner-A";
const ADMIN_MEMBER = "user-admin-A";
const OUTSIDER = "user-outsider";
const PRACTICE_A = "practice-A";
const PRACTICE_B = "practice-B";
const OWNER_B = "user-owner-B";
const PASSWORD = "correct-horse-battery";
const PASSWORD_HASH = await bcrypt.hash(PASSWORD, 4);

let practices;
let members;
let lifecycleCases;
let auditRows;
let foreignWrites; // any write to a model the lifecycle must never touch
let caseSeq;

function resetData() {
  practices = [
    { id: PRACTICE_A, userId: OWNER, practiceName: "Praxis A", lifecycleStatus: "active", lifecycleStatusChangedAt: null },
    { id: PRACTICE_B, userId: OWNER_B, practiceName: "Praxis B", lifecycleStatus: "active", lifecycleStatusChangedAt: null },
  ];
  members = [
    { practiceProfileId: PRACTICE_A, userId: ADMIN_MEMBER, role: "admin", status: "active" },
  ];
  lifecycleCases = [];
  auditRows = [];
  foreignWrites = [];
  caseSeq = 0;
}

function installPrismaFake() {
  resetData();
  prisma.practiceProfile = {
    findUnique: async ({ where, select }) => {
      const row = practices.find((p) => p.id === where.id) ?? null;
      if (!row) return null;
      if (select) {
        const out = {};
        for (const k of Object.keys(select)) out[k] = row[k];
        return out;
      }
      return { ...row };
    },
    updateMany: async ({ where, data }) => {
      const allowed = where.lifecycleStatus?.in ?? null;
      const hit = practices.filter(
        (p) => p.id === where.id && (!allowed || allowed.includes(p.lifecycleStatus)),
      );
      for (const p of hit) Object.assign(p, data);
      return { count: hit.length };
    },
  };
  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      return (
        members.find(
          (m) => m.practiceProfileId === practiceProfileId && m.userId === userId,
        ) ?? null
      );
    },
    updateMany: async (args) => {
      foreignWrites.push(["practiceMember", args]);
      return { count: 0 };
    },
  };
  prisma.user = {
    findUnique: async ({ where }) => {
      const known = [OWNER, OWNER_B, ADMIN_MEMBER, OUTSIDER];
      if (!known.includes(where.id)) return null;
      return { id: where.id, passwordHash: PASSWORD_HASH, email: `${where.id}@example.test` };
    },
  };
  prisma.lifecycleCase = {
    create: async ({ data }) => {
      caseSeq += 1;
      const row = { ...data, id: `case-${caseSeq}`, seq: caseSeq, createdAt: new Date(), status: data.status || "recorded" };
      lifecycleCases.push(row);
      return { ...row };
    },
    update: async ({ where, data }) => {
      const row = lifecycleCases.find((c) => c.id === where.id);
      Object.assign(row, data);
      return { ...row };
    },
    findFirst: async ({ where }) => {
      return (
        lifecycleCases.find(
          (c) =>
            c.practiceProfileId === where.practiceProfileId &&
            c.action === where.action &&
            (where.status?.in ? where.status.in.includes(c.status) : true),
        ) ?? null
      );
    },
    findMany: async ({ where }) =>
      lifecycleCases.filter((c) => c.practiceProfileId === where.practiceProfileId),
  };
  prisma.auditLog = {
    create: async ({ data }) => {
      auditRows.push(data);
      return data;
    },
  };
  // Models a lifecycle change must NEVER touch: consents, grants, tokens.
  for (const model of [
    "consentRecord",
    "practicePatientLink",
    "practiceDocumentShareGrant",
    "secureDocumentAccessToken",
  ]) {
    prisma[model] = {
      create: async (args) => { foreignWrites.push([model, args]); return {}; },
      update: async (args) => { foreignWrites.push([model, args]); return {}; },
      updateMany: async (args) => { foreignWrites.push([model, args]); return { count: 0 }; },
      deleteMany: async (args) => { foreignWrites.push([model, args]); return { count: 0 }; },
    };
  }
  prisma.$transaction = async (fn) => fn(prisma);
}

let server;
let baseUrl;

test.before(async () => {
  installPrismaFake();
  const app = express();
  app.use(express.json());
  app.use("/api/practices", requireAuth, practiceLifecycleRouter.default);
  await new Promise((r) => {
    server = app.listen(0, "127.0.0.1", r);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((r) => server.close(r)));

test.beforeEach(() => installPrismaFake());

let requestSeq = 0;

async function call(method, path, { user, body } = {}) {
  // Unique per-request IP so the per-IP rate limiter never pools test traffic.
  requestSeq += 1;
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` } : {}),
      "Content-Type": "application/json",
      "X-Forwarded-For": `10.0.${Math.floor(requestSeq / 250)}.${(requestSeq % 250) + 1}`,
    },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

function statusOf(id) {
  return practices.find((p) => p.id === id).lifecycleStatus;
}

/* ------------------------------------------------- unit: state machine */

test("valid transitions apply and stamp the change time", async () => {
  assert.equal(await applyPracticeLifecycleTransition(prisma, { practiceId: PRACTICE_A, action: "suspend" }), true);
  assert.equal(statusOf(PRACTICE_A), "suspended");
  assert.ok(practices[0].lifecycleStatusChangedAt instanceof Date);
  assert.equal(await applyPracticeLifecycleTransition(prisma, { practiceId: PRACTICE_A, action: "reactivate" }), true);
  assert.equal(statusOf(PRACTICE_A), "active");
});

test("invalid jumps are rejected: closed practice cannot be suspended or self-reactivated", async () => {
  await applyPracticeLifecycleTransition(prisma, { practiceId: PRACTICE_A, action: "close" });
  assert.equal(await applyPracticeLifecycleTransition(prisma, { practiceId: PRACTICE_A, action: "suspend" }), false);
  assert.equal(await applyPracticeLifecycleTransition(prisma, { practiceId: PRACTICE_A, action: "reactivate" }), false);
  assert.equal(statusOf(PRACTICE_A), "closed");
});

test("deletion_requested has no self-service exit", async () => {
  await applyPracticeLifecycleTransition(prisma, { practiceId: PRACTICE_A, action: "request_deletion" });
  for (const action of ["suspend", "reactivate", "close", "request_reactivation"]) {
    assert.equal(
      await applyPracticeLifecycleTransition(prisma, { practiceId: PRACTICE_A, action }),
      false,
      `unexpectedly allowed ${action}`,
    );
  }
  assert.equal(statusOf(PRACTICE_A), "deletion_requested");
});

test("unknown historic status values read as active but block writes", () => {
  assert.equal(practiceLifecycleStatusOf({ lifecycleStatus: undefined }), "active");
  assert.equal(practiceLifecycleStatusOf({ lifecycleStatus: "weird" }), "active");
  assert.equal(isPracticeOperative({ lifecycleStatus: "suspended" }), false);
  assert.equal(isPracticeOperative({ lifecycleStatus: "active" }), true);
});

/* --------------------------------------- unit: central access revocation */

test("suspended and closed practices have no operative access for anyone", async () => {
  for (const status of ["suspended", "closed", "reactivation_requested", "deletion_requested"]) {
    practices[0].lifecycleStatus = status;
    assert.equal(await getPracticeAccess(OWNER, PRACTICE_A), null, `owner had access while ${status}`);
    assert.equal(await getPracticeAccess(ADMIN_MEMBER, PRACTICE_A), null, `member had access while ${status}`);
  }
});

test("the lifecycle opt-in admits ONLY the owner of a non-active practice", async () => {
  practices[0].lifecycleStatus = "suspended";
  const ownerAccess = await getPracticeAccess(OWNER, PRACTICE_A, { allowInactiveLifecycle: true });
  assert.equal(ownerAccess?.isOwner, true);
  assert.equal(ownerAccess?.lifecycleStatus, "suspended");
  assert.equal(
    await getPracticeAccess(ADMIN_MEMBER, PRACTICE_A, { allowInactiveLifecycle: true }),
    null,
  );
});

test("an active practice behaves exactly as before", async () => {
  const access = await getPracticeAccess(ADMIN_MEMBER, PRACTICE_A);
  assert.equal(access?.role, "admin");
  assert.equal(access?.lifecycleStatus, "active");
});

/* --------------------------------------------------------- HTTP: authz */

test("HTTP: owner can suspend an active practice; case + audit are written once", async () => {
  const res = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/suspend`, {
    user: OWNER, body: { password: PASSWORD },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "suspended");
  assert.match(res.body.caseNumber, /^PS-\d{4}-\d{6}$/);
  assert.equal(statusOf(PRACTICE_A), "suspended");
  assert.equal(lifecycleCases.length, 1);
  assert.equal(auditRows.filter((a) => a.action === "lifecycle_practice_suspended").length, 1);
});

test("HTTP: an admin member cannot perform lifecycle actions", async () => {
  const res = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/suspend`, {
    user: ADMIN_MEMBER, body: { password: PASSWORD },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, LIFECYCLE_ERRORS.OWNER_REQUIRED);
  assert.equal(statusOf(PRACTICE_A), "active");
  assert.equal(lifecycleCases.length, 0);
});

test("HTTP: outsiders and foreign owners resolve to 404 — no tenant enumeration", async () => {
  for (const user of [OUTSIDER, OWNER_B]) {
    const res = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/close`, {
      user, body: { password: PASSWORD },
    });
    assert.equal(res.status, 404);
  }
  assert.equal(statusOf(PRACTICE_A), "active");
});

test("HTTP: missing or wrong password is confirmation_required and changes nothing", async () => {
  for (const body of [{}, { password: "wrong" }]) {
    const res = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/suspend`, {
      user: OWNER, body,
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, LIFECYCLE_ERRORS.CONFIRMATION_REQUIRED);
  }
  assert.equal(statusOf(PRACTICE_A), "active");
  assert.equal(lifecycleCases.length, 0);
});

test("HTTP: unexpected body fields are rejected as unsupported_field", async () => {
  const res = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/suspend`, {
    user: OWNER, body: { password: PASSWORD, practiceId: PRACTICE_B },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, LIFECYCLE_ERRORS.UNSUPPORTED_FIELD);
  assert.equal(statusOf(PRACTICE_A), "active");
  assert.equal(statusOf(PRACTICE_B), "active");
});

/* ---------------------------------------------------- HTTP: transitions */

test("HTTP: suspended practice can be reactivated by the owner — nothing else is restored", async () => {
  practices[0].lifecycleStatus = "suspended";
  const res = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/reactivate`, {
    user: OWNER, body: { password: PASSWORD },
  });
  assert.equal(res.status, 200);
  assert.equal(statusOf(PRACTICE_A), "active");
  // Revoked consents, grants, tokens and team members are untouched.
  assert.deepEqual(foreignWrites, []);
});

test("HTTP: closing works from active and suspended, and is idempotent-safe", async () => {
  practices[0].lifecycleStatus = "suspended";
  const res = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/close`, {
    user: OWNER, body: { password: PASSWORD },
  });
  assert.equal(res.status, 200);
  const again = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/close`, {
    user: OWNER, body: { password: PASSWORD },
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, LIFECYCLE_ERRORS.ALREADY_CLOSED);
  assert.equal(lifecycleCases.length, 1);
});

test("HTTP: double suspend maps to practice_already_suspended", async () => {
  await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/suspend`, { user: OWNER, body: { password: PASSWORD } });
  const res = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/suspend`, { user: OWNER, body: { password: PASSWORD } });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, LIFECYCLE_ERRORS.ALREADY_SUSPENDED);
});

test("HTTP: closed practice can request reactivation exactly once", async () => {
  practices[0].lifecycleStatus = "closed";
  const res = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/request-reactivation`, {
    user: OWNER, body: { password: PASSWORD },
  });
  assert.equal(res.status, 200);
  assert.equal(statusOf(PRACTICE_A), "reactivation_requested");
  assert.match(res.body.caseNumber, /^PR-\d{4}-\d{6}$/);
  const again = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/request-reactivation`, {
    user: OWNER, body: { password: PASSWORD },
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, LIFECYCLE_ERRORS.REACTIVATION_ALREADY_REQUESTED);
});

test("HTTP: two parallel identical changes — exactly one wins, no lost state", async () => {
  const [a, b] = await Promise.all([
    call("POST", `/api/practices/${PRACTICE_A}/lifecycle/suspend`, { user: OWNER, body: { password: PASSWORD } }),
    call("POST", `/api/practices/${PRACTICE_A}/lifecycle/suspend`, { user: OWNER, body: { password: PASSWORD } }),
  ]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [200, 409]);
  assert.equal(statusOf(PRACTICE_A), "suspended");
  // Exactly one written case + one lifecycle audit row — the loser wrote nothing.
  assert.equal(lifecycleCases.length, 1);
  assert.equal(auditRows.filter((r) => r.action === "lifecycle_practice_suspended").length, 1);
});

/* ------------------------------------------------ HTTP: deletion request */

test("HTTP: a deletion request creates a PD case, deletes nothing, leaves the gate closed", async () => {
  const res = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/request-deletion`, {
    user: OWNER, body: { password: PASSWORD, reason: "Praxisaufgabe" },
  });
  assert.equal(res.status, 200);
  assert.match(res.body.caseNumber, /^PD-\d{4}-\d{6}$/);
  assert.equal(res.body.supportEmail, "contact@medscoutx.com");
  assert.equal(statusOf(PRACTICE_A), "deletion_requested");
  // The practice row still exists; nothing else was written.
  assert.equal(practices.length, 2);
  assert.deepEqual(foreignWrites, []);
  assert.equal(process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION, undefined);
  const kase = lifecycleCases[0];
  assert.equal(kase.status, "awaiting_email_confirmation");
  assert.equal(kase.reason, "Praxisaufgabe");
});

test("HTTP: a repeated deletion request does not create a second active case", async () => {
  await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/request-deletion`, {
    user: OWNER, body: { password: PASSWORD },
  });
  const again = await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/request-deletion`, {
    user: OWNER, body: { password: PASSWORD },
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, LIFECYCLE_ERRORS.DELETION_ALREADY_REQUESTED);
  assert.equal(lifecycleCases.length, 1);
});

test("HTTP: a foreign practice cannot be pushed into deletion", async () => {
  const res = await call("POST", `/api/practices/${PRACTICE_B}/lifecycle/request-deletion`, {
    user: OWNER, body: { password: PASSWORD },
  });
  assert.equal(res.status, 404);
  assert.equal(statusOf(PRACTICE_B), "active");
  assert.equal(lifecycleCases.length, 0);
});

/* ------------------------------------------------------ HTTP: status GET */

test("HTTP: the owner reads status + cases even while suspended; members cannot", async () => {
  practices[0].lifecycleStatus = "suspended";
  const res = await call("GET", `/api/practices/${PRACTICE_A}/lifecycle`, { user: OWNER });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "suspended");
  assert.equal(res.body.supportEmail, "contact@medscoutx.com");
  // A member of a suspended practice does not even resolve the tenant.
  const member = await call("GET", `/api/practices/${PRACTICE_A}/lifecycle`, { user: ADMIN_MEMBER });
  assert.equal(member.status, 404);
});

/* ------------------------- controlled deletion path vs membership lifecycle */

test("the controlled deletion resolver reaches a practice in deletion_requested", async () => {
  // The whole point of a deletion REQUEST is that MedScoutX can later run the
  // reviewed deletion. The membership lifecycle must not strand the practice.
  practices[0].lifecycleStatus = "deletion_requested";

  // Operative access is gone for everyone, including the owner...
  assert.equal(await getPracticeAccess(OWNER, PRACTICE_A), null);
  assert.equal(await getPracticeAccess(ADMIN_MEMBER, PRACTICE_A), null);

  // ...but the controlled deletion path still resolves ownership.
  const owner = await resolvePracticeOwnerForControlledDeletion(OWNER, PRACTICE_A);
  assert.equal(owner?.isOwner, true);
  assert.equal(owner.practice.id, PRACTICE_A);
});

test("the controlled deletion resolver keeps the 404/403 distinction", async () => {
  for (const status of ["active", "suspended", "closed", "deletion_requested"]) {
    practices[0].lifecycleStatus = status;
    const member = await resolvePracticeOwnerForControlledDeletion(ADMIN_MEMBER, PRACTICE_A);
    assert.equal(member?.isOwner, false, `member should be 403 while ${status}`);
    assert.equal(
      await resolvePracticeOwnerForControlledDeletion(OUTSIDER, PRACTICE_A),
      null,
      `outsider should be 404 while ${status}`,
    );
    assert.equal(
      await resolvePracticeOwnerForControlledDeletion(OWNER_B, PRACTICE_A),
      null,
      `foreign owner should be 404 while ${status}`,
    );
  }
});

test("the resolver grants no operative permissions at all", async () => {
  const owner = await resolvePracticeOwnerForControlledDeletion(OWNER, PRACTICE_A);
  assert.equal(owner.effectivePermissions, undefined);
  assert.equal(owner.role, undefined);
});

test("a lifecycle action never writes the destructive release-gate variable", async () => {
  // Pinned here because the gate lives in AP3's destructiveDeletionGate module
  // and no lifecycle path may set, clear or shadow it.
  const before = process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION;
  await call("POST", `/api/practices/${PRACTICE_A}/lifecycle/request-deletion`, {
    user: OWNER, body: { password: PASSWORD },
  });
  assert.equal(process.env.ENABLE_DESTRUCTIVE_PRACTICE_DELETION, before);
  assert.equal(practices.length, 2, "the practice row still exists");
});
