/**
 * Security invariants for practice–patient messaging (Phase 1').
 *
 * Runs WITHOUT a database: the shared Prisma singleton is replaced by an
 * in-memory fake, so the REAL service chain executes end to end
 * (assertPracticeConsentedLink -> requireConsentScopeAsync -> linkHasConsentType)
 * together with the real authorization guard. Same approach as
 * verifyPracticeTenantIsolation.test.js, one layer higher.
 *
 * These are security invariants, not UI tests. A failure here means a
 * cross-practice or cross-patient leak, or a consent bypass.
 *
 * Fixture
 *   Practice A (owner ownerA)  -- doctorA, secretaryA, assistantA, viewerA
 *   Practice B (owner ownerB)  -- doctorB
 *   Patient  P  -- linked to A (linkA) and B (linkB)
 *   Patient  Q  -- linked to A (linkQ)
 *   Thread   TA on linkA, with one practice message and one patient message
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { prisma } from "../lib/prisma.js";
import {
  authorizePracticePatientLink,
  normalizeRequiredList,
} from "../services/authorization/practicePatientLinkAuthorization.js";
import { PERMISSIONS } from "../utils/practicePermissions.js";
import {
  addMessageFromPatient,
  addMessageFromPractice,
  archiveThreadForPractice,
  closeThread,
  appendMessage,
  createThread,
  ensureCommunicationChannel,
  getChannelForPatientLink,
  getThread,
  getThreadForPatientUser,
  listThreadsForPatient,
  listThreadsForPractice,
  markThreadRead,
  restoreThreadForPractice,
} from "../services/communication/practicePatientThreadService.js";

/* ---------------------------------------------------------------- fixture */

const PRACTICE_A = "practice-A";
const PRACTICE_B = "practice-B";

const U = {
  ownerA: "user-owner-A",
  doctorA: "user-doctor-A",
  secretaryA: "user-secretary-A",
  assistantA: "user-assistant-A",
  viewerA: "user-viewer-A",
  ownerB: "user-owner-B",
  doctorB: "user-doctor-B",
  patientP: "user-patient-P",
  patientQ: "user-patient-Q",
  outsider: "user-outsider",
};

const LINK_A = "link-A";
const LINK_B = "link-B";
const LINK_Q = "link-Q";
const THREAD_A = "thread-A";
const MSG_PRACTICE = "msg-practice-1";
const MSG_PATIENT = "msg-patient-1";

const PRACTICES = [
  { id: PRACTICE_A, userId: U.ownerA, practiceName: "Praxis A", publicSlug: "a", specialty: null, logoPath: null },
  { id: PRACTICE_B, userId: U.ownerB, practiceName: "Praxis B", publicSlug: "b", specialty: null, logoPath: null },
];

const MEMBERS = [
  { practiceProfileId: PRACTICE_A, userId: U.doctorA, role: "doctor", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: U.secretaryA, role: "secretary", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: U.assistantA, role: "assistant", status: "active" },
  { practiceProfileId: PRACTICE_A, userId: U.viewerA, role: "viewer", status: "active" },
  { practiceProfileId: PRACTICE_B, userId: U.doctorB, role: "doctor", status: "active" },
];

/** @type {any[]} */ let links = [];
/** @type {any[]} */ let consents = [];
/** @type {any[]} */ let threads = [];
/** @type {any[]} */ let messages = [];

function baseLinks() {
  return [
    {
      id: LINK_A,
      practiceProfileId: PRACTICE_A,
      patientUserId: U.patientP,
      status: "active",
      consentAcceptedAt: new Date("2026-01-01"),
      consentScopes: ["messages"],
    },
    {
      id: LINK_B,
      practiceProfileId: PRACTICE_B,
      patientUserId: U.patientP,
      status: "active",
      consentAcceptedAt: new Date("2026-01-01"),
      consentScopes: ["messages"],
    },
    {
      id: LINK_Q,
      practiceProfileId: PRACTICE_A,
      patientUserId: U.patientQ,
      status: "active",
      consentAcceptedAt: new Date("2026-01-01"),
      consentScopes: ["messages"],
    },
  ];
}

function baseThreads() {
  return [
    {
      id: THREAD_A,
      practicePatientLinkId: LINK_A,
      practiceProfileId: PRACTICE_A,
      patientUserId: U.patientP,
      subject: "Rezeptanfrage",
      status: "open",
      createdAt: new Date("2026-02-01T09:00:00Z"),
      updatedAt: new Date("2026-02-01T09:30:00Z"),
      closedAt: null,
      patientArchivedAt: null,
      practiceArchivedAt: null,
      archivedAt: null,
    },
  ];
}

function baseMessages() {
  return [
    {
      id: MSG_PRACTICE,
      threadId: THREAD_A,
      senderType: "practice",
      senderUserId: U.doctorA,
      body: "Bitte bringen Sie Ihren Medikationsplan mit.",
      clientRequestId: null,
      createdAt: new Date("2026-02-01T09:00:00Z"),
      readAt: null,
    },
    {
      id: MSG_PATIENT,
      threadId: THREAD_A,
      senderType: "patient",
      senderUserId: U.patientP,
      body: "Alles klar.",
      clientRequestId: null,
      createdAt: new Date("2026-02-01T09:30:00Z"),
      readAt: null,
    },
  ];
}

/* ------------------------------------------------------------ prisma fake */

/** Minimal where-matcher: equality plus the `{ not: x }` form the service uses. */
function matches(row, where = {}) {
  for (const [key, cond] of Object.entries(where)) {
    const value = row[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      if ("not" in cond && value === cond.not) return false;
      if ("in" in cond && !cond.in.includes(value)) return false;
      if ("lte" in cond) return false; // no expiring consents in this fixture
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

function practiceById(id) {
  return PRACTICES.find((p) => p.id === id) ?? null;
}

function messagesOfThread(threadId, { desc = false, take } = {}) {
  const list = messages
    .filter((m) => m.threadId === threadId)
    .sort((a, b) =>
      desc ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
    );
  return take ? list.slice(0, take) : list;
}

/** Attaches whatever `include` asked for, so the service sees a realistic row. */
function hydrateThread(row, include = {}) {
  const out = { ...row };
  if (include.messages) {
    const desc = include.messages?.orderBy?.createdAt === "desc";
    out.messages = messagesOfThread(row.id, { desc, take: include.messages?.take });
  }
  if (include._count) out._count = { messages: messagesOfThread(row.id).length };
  if (include.practiceProfile) out.practiceProfile = practiceById(row.practiceProfileId);
  if (include.practicePatientLink) {
    out.practicePatientLink = links.find((l) => l.id === row.practicePatientLinkId) ?? null;
  }
  return out;
}

function hydrateLink(row, include = {}) {
  const out = { ...row };
  if (include?.practiceProfile) out.practiceProfile = practiceById(row.practiceProfileId);
  return out;
}

let idCounter = 0;
/** Counts writes to PracticePatientThread — a deduplicated retry must cause none. */
let threadUpdateCalls = 0;
/** Counts practice-inbox writes — a deduplicated retry must raise no new entry. */
let practiceInboxWrites = 0;
function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function installPrismaFake() {
  links = baseLinks();
  consents = [
    { id: "c-A", practicePatientLinkId: LINK_A, consentType: "secure_messaging", status: "granted" },
    { id: "c-B", practicePatientLinkId: LINK_B, consentType: "secure_messaging", status: "granted" },
    { id: "c-Q", practicePatientLinkId: LINK_Q, consentType: "secure_messaging", status: "granted" },
  ];
  threads = baseThreads();
  messages = baseMessages();
  idCounter = 0;
  threadUpdateCalls = 0;
  practiceInboxWrites = 0;

  prisma.practicePatientLink = {
    findFirst: async ({ where, include }) => {
      const row = links.find((l) => matches(l, where));
      return row ? hydrateLink(row, include) : null;
    },
    findUnique: async ({ where, include }) => {
      const row = links.find((l) => l.id === where.id);
      return row ? hydrateLink(row, include) : null;
    },
  };

  prisma.practiceProfile = {
    findUnique: async ({ where }) => practiceById(where.id),
  };

  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      return (
        MEMBERS.find(
          (m) => m.practiceProfileId === practiceProfileId && m.userId === userId,
        ) ?? null
      );
    },
  };

  prisma.consentRecord = {
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
    findFirst: async ({ where }) => consents.find((c) => matches(c, where)) ?? null,
  };

  prisma.practicePatientThread = {
    findFirst: async ({ where, include }) => {
      const row = threads.find((t) => matches(t, where));
      return row ? hydrateThread(row, include) : null;
    },
    findUnique: async ({ where, include }) => {
      const row = threads.find((t) => matches(t, where));
      return row ? hydrateThread(row, include) : null;
    },
    findMany: async ({ where, include }) => {
      const rows = threads.filter((t) => matches(t, where));
      return rows.map((r) => hydrateThread(r, include));
    },
    create: async ({ data, include }) => {
      // Mirrors @@unique([practicePatientLinkId]): the fake must reject a second
      // channel exactly the way Postgres does, otherwise the race protection
      // would be tested against a database that cannot fail.
      if (threads.some((t) => t.practicePatientLinkId === data.practicePatientLinkId)) {
        const err = new Error(
          "Unique constraint failed on the fields: (`practicePatientLinkId`)",
        );
        err.code = "P2002";
        err.meta = { target: ["practicePatientLinkId"] };
        throw err;
      }
      const row = {
        id: nextId("thread"),
        practicePatientLinkId: data.practicePatientLinkId,
        practiceProfileId: data.practiceProfileId,
        patientUserId: data.patientUserId,
        subject: data.subject ?? null,
        status: data.status ?? "open",
        createdAt: new Date(),
        updatedAt: data.updatedAt ?? new Date(),
        closedAt: null,
        patientArchivedAt: null,
        practiceArchivedAt: null,
        archivedAt: null,
      };
      threads.push(row);
      if (data.messages?.create) {
        messages.push({
          id: nextId("msg"),
          threadId: row.id,
          senderType: data.messages.create.senderType,
          senderUserId: data.messages.create.senderUserId,
          body: data.messages.create.body,
          createdAt: new Date(),
          readAt: null,
        });
      }
      return hydrateThread(row, include);
    },
    update: async ({ where, data, include }) => {
      threadUpdateCalls += 1;
      const row = threads.find((t) => t.id === where.id);
      if (!row) throw new Error("record_not_found");
      Object.assign(row, data);
      return hydrateThread(row, include);
    },
  };

  prisma.practicePatientMessage = {
    count: async ({ where }) => messages.filter((m) => matches(m, where)).length,
    findFirst: async ({ where, orderBy }) => {
      const hits = messages.filter((m) => matches(m, where));
      if (!hits.length) return null;
      const desc = orderBy?.createdAt === "desc";
      return hits.sort((a, b) => (desc ? b.createdAt - a.createdAt : a.createdAt - b.createdAt))[0];
    },
    create: async ({ data }) => {
      // Mirrors @@unique([threadId, clientRequestId]). NULL is distinct in
      // Postgres, so keyless sends are never deduplicated — the fake must
      // reproduce exactly that, otherwise the tests would prove nothing.
      if (
        data.clientRequestId != null &&
        messages.some(
          (m) => m.threadId === data.threadId && m.clientRequestId === data.clientRequestId,
        )
      ) {
        const err = new Error(
          "Unique constraint failed on the fields: (`threadId`,`clientRequestId`)",
        );
        err.code = "P2002";
        err.meta = { target: ["threadId", "clientRequestId"] };
        throw err;
      }
      const row = {
        id: nextId("msg"),
        threadId: data.threadId,
        senderType: data.senderType,
        senderUserId: data.senderUserId ?? null,
        body: data.body,
        clientRequestId: data.clientRequestId ?? null,
        createdAt: new Date(),
        readAt: null,
      };
      messages.push(row);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const hit = messages.filter((m) => matches(m, where));
      for (const m of hit) Object.assign(m, data);
      return { count: hit.length };
    },
    /**
     * Since Phase 3A the timeline is paged, so the fake needs the same total
     * order the real query uses: createdAt, then id. Reproducing only the
     * timestamp would let a collision test pass here and fail against Postgres.
     */
    findMany: async ({ where, orderBy, take } = {}) => {
      const order = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
      const desc = order.some((o) => o.createdAt === "desc" || o.id === "desc");

      const hits = messages.filter((m) => matches(m, where)).sort((a, b) => {
        const byTime = a.createdAt - b.createdAt;
        if (byTime !== 0) return desc ? -byTime : byTime;
        const byId = String(a.id).localeCompare(String(b.id));
        return desc ? -byId : byId;
      });

      return typeof take === "number" ? hits.slice(0, take) : hits;
    },
  };

  prisma.auditLog = { create: async () => ({}) };
  prisma.user = { findUnique: async () => null };
  prisma.patientInboxItem = { findFirst: async () => null, create: async () => ({}), update: async () => ({}) };
  prisma.practiceInboxItem = {
    findFirst: async () => null,
    create: async (args) => {
      practiceInboxWrites += 1;
      return { id: nextId("inbox"), ...(args?.data ?? {}) };
    },
    update: async (args) => {
      practiceInboxWrites += 1;
      return { id: "inbox-existing", ...(args?.data ?? {}) };
    },
  };
}

test.beforeEach(() => installPrismaFake());

/** Revoke the messaging consent for a link, both record and legacy scope. */
function revokeMessagingConsent(linkId) {
  for (const c of consents) {
    if (c.practicePatientLinkId === linkId && c.consentType === "secure_messaging") {
      c.status = "revoked";
    }
  }
  const link = links.find((l) => l.id === linkId);
  if (link) link.consentScopes = ["profile"];
}

async function rejects(fn, expectedMessage, label) {
  await assert.rejects(fn, (err) => {
    assert.equal(err.message, expectedMessage, `${label}: wrong error`);
    return true;
  }, label);
}

/* ================================================================ */
/* 1. CROSS-PRACTICE: practice B must never reach practice A's data */
/* ================================================================ */

test("B cannot LIST threads on practice A's link", async () => {
  await rejects(
    () => listThreadsForPractice(LINK_A, PRACTICE_B, { actorUserId: U.doctorB }),
    "link_not_found",
    "list linkA as B",
  );
});

test("B cannot GET practice A's thread — not via its own link, not via A's link", async () => {
  // via B's own link: the thread is not on it
  await rejects(
    () => getThread(THREAD_A, PRACTICE_B, LINK_B, { actorUserId: U.doctorB }),
    "thread_not_found",
    "threadA via linkB",
  );
  // via A's link: the link is not B's
  await rejects(
    () => getThread(THREAD_A, PRACTICE_B, LINK_A, { actorUserId: U.doctorB }),
    "link_not_found",
    "threadA via linkA",
  );
});

test("B cannot SEND into practice A's thread", async () => {
  await rejects(
    () =>
      addMessageFromPractice({
        threadId: THREAD_A,
        practiceProfileId: PRACTICE_B,
        linkId: LINK_A,
        senderUserId: U.doctorB,
        body: "injected",
      }),
    "link_not_found",
    "send into threadA as B",
  );
  assert.equal(messagesOfThread(THREAD_A).length, 2, "no message may have been written");
});

test("B cannot MARK READ practice A's thread", async () => {
  await rejects(
    () =>
      markThreadRead(THREAD_A, "practice", {
        practiceProfileId: PRACTICE_B,
        linkId: LINK_A,
        actorUserId: U.doctorB,
      }),
    "link_not_found",
    "markRead as B",
  );
  assert.ok(
    messagesOfThread(THREAD_A).every((m) => m.readAt === null),
    "read state must be untouched",
  );
});

test("B cannot CLOSE, ARCHIVE or RESTORE practice A's thread", async () => {
  for (const [label, fn] of [
    ["close", () => closeThread(THREAD_A, PRACTICE_B, LINK_A, { actorUserId: U.doctorB })],
    ["archive", () => archiveThreadForPractice(THREAD_A, PRACTICE_B, LINK_A, { actorUserId: U.doctorB })],
    ["restore", () => restoreThreadForPractice(THREAD_A, PRACTICE_B, LINK_A, { actorUserId: U.doctorB })],
  ]) {
    await rejects(fn, "link_not_found", label);
  }
  assert.equal(threads.find((t) => t.id === THREAD_A).status, "open", "status unchanged");
});

test("A keeps full access to its own thread (positive control)", async () => {
  const thread = await getThread(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  assert.equal(thread.id, THREAD_A);
  assert.equal(thread.messages.length, 2);

  const list = await listThreadsForPractice(LINK_A, PRACTICE_A, { actorUserId: U.doctorA });
  assert.equal(list.length, 1);
});

/* ============================================================== */
/* 2. MANIPULATED IDENTIFIERS: no existence disclosure            */
/* ============================================================== */

test("a foreign link and a non-existent link are indistinguishable", async () => {
  const foreign = await listThreadsForPractice(LINK_A, PRACTICE_B, {}).catch((e) => e.message);
  const missing = await listThreadsForPractice("link-does-not-exist", PRACTICE_B, {}).catch(
    (e) => e.message,
  );
  assert.equal(foreign, "link_not_found");
  assert.equal(missing, foreign, "must not reveal whether the foreign link exists");
});

test("a foreign thread and a non-existent thread are indistinguishable", async () => {
  const foreign = await getThread(THREAD_A, PRACTICE_B, LINK_B, {}).catch((e) => e.message);
  const missing = await getThread("thread-nope", PRACTICE_B, LINK_B, {}).catch((e) => e.message);
  assert.equal(foreign, "thread_not_found");
  assert.equal(missing, foreign, "must not reveal whether the foreign thread exists");
});

test("a forged practiceId cannot redirect the tenant", async () => {
  // B's doctor claims practice B while addressing A's link.
  const decision = await authorizePracticePatientLink({
    actorUserId: U.doctorB,
    linkId: LINK_A,
    requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
    requiredConsentType: "secure_messaging",
    clientPracticeId: PRACTICE_B,
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "link_not_found");
  assert.equal(decision.status, 404);
});

test("even A's own doctor cannot claim a practiceId that differs from the link", async () => {
  const decision = await authorizePracticePatientLink({
    actorUserId: U.doctorA,
    linkId: LINK_A,
    requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
    requiredConsentType: "secure_messaging",
    clientPracticeId: PRACTICE_B,
  });
  assert.equal(decision.ok, false, "a mismatching practiceId is rejected, never obeyed");
  assert.equal(decision.reason, "link_not_found");
});

test("there is no messageId-addressable read path to bypass thread scoping", async () => {
  // Structural invariant: every exported read takes a thread + an owner scope.
  // If a future route adds a messageId lookup, it must go through these.
  const exported = await import("../services/communication/practicePatientThreadService.js");
  const byMessageId = Object.keys(exported).filter((k) => /message/i.test(k) && /get|find/i.test(k));
  assert.deepEqual(byMessageId, [], "no getMessageById-style export may exist");
});

/* ============================================================ */
/* 3. CROSS-PATIENT: patient Q must never reach patient P's data */
/* ============================================================ */

test("patient Q cannot GET patient P's thread", async () => {
  await rejects(
    () => getThreadForPatientUser(THREAD_A, U.patientQ),
    "thread_not_found",
    "Q reads P's thread",
  );
});

test("patient Q does not see P's thread in their own list", async () => {
  const list = await listThreadsForPatient(U.patientQ);
  assert.equal(list.length, 0, "Q shares practice A with P but must see nothing of P's");
});

test("patient Q cannot SEND into P's thread", async () => {
  await rejects(
    () => addMessageFromPatient({ threadId: THREAD_A, patientUserId: U.patientQ, body: "x" }),
    "thread_not_found",
    "Q sends into P's thread",
  );
  assert.equal(messagesOfThread(THREAD_A).length, 2);
});

test("patient Q cannot MARK READ P's thread", async () => {
  await rejects(
    () => markThreadRead(THREAD_A, "patient", { patientUserId: U.patientQ }),
    "thread_not_found",
    "Q marks P's thread read",
  );
  assert.ok(messagesOfThread(THREAD_A).every((m) => m.readAt === null));
});

test("an outsider with no relationship gets nothing", async () => {
  await rejects(
    () => getThreadForPatientUser(THREAD_A, U.outsider),
    "thread_not_found",
    "outsider read",
  );
  assert.equal((await listThreadsForPatient(U.outsider)).length, 0);
});

test("patient P sees only their own thread (positive control)", async () => {
  const list = await listThreadsForPatient(U.patientP);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, THREAD_A);
});

/* ================================================== */
/* 4. CONSENT (C-2) — asymmetric by design            */
/* ================================================== */

test("consent present: practice may read (positive control)", async () => {
  const thread = await getThread(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  assert.equal(thread.messages.length, 2);
});

test("consent revoked: EVERY practice read path is blocked, not just sending", async () => {
  revokeMessagingConsent(LINK_A);
  const ctx = { actorUserId: U.doctorA };

  for (const [label, fn] of [
    ["list", () => listThreadsForPractice(LINK_A, PRACTICE_A, ctx)],
    ["get", () => getThread(THREAD_A, PRACTICE_A, LINK_A, ctx)],
    ["markRead", () => markThreadRead(THREAD_A, "practice", { practiceProfileId: PRACTICE_A, linkId: LINK_A, ...ctx })],
    ["close", () => closeThread(THREAD_A, PRACTICE_A, LINK_A, ctx)],
    ["archive", () => archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, ctx)],
    ["restore", () => restoreThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, ctx)],
  ]) {
    await rejects(fn, "consent_required", `${label} must require consent`);
  }
});

test("consent revoked: practice cannot send or open a thread", async () => {
  revokeMessagingConsent(LINK_A);
  await rejects(
    () =>
      addMessageFromPractice({
        threadId: THREAD_A,
        practiceProfileId: PRACTICE_A,
        linkId: LINK_A,
        senderUserId: U.doctorA,
        body: "x",
      }),
    "consent_required",
    "send",
  );
  await rejects(
    () =>
      createThread({
        linkId: LINK_A,
        practiceProfileId: PRACTICE_A,
        body: "x",
        senderUserId: U.doctorA,
      }),
    "consent_required",
    "create",
  );
});

test("consent revoked: the PATIENT keeps reading their own conversation", async () => {
  revokeMessagingConsent(LINK_A);
  const thread = await getThreadForPatientUser(THREAD_A, U.patientP);
  assert.equal(thread.messages.length, 2, "own history stays accessible to the data subject");
  assert.equal((await listThreadsForPatient(U.patientP)).length, 1);
});

test("consent revoked: the patient can no longer SEND", async () => {
  revokeMessagingConsent(LINK_A);
  await rejects(
    () => addMessageFromPatient({ threadId: THREAD_A, patientUserId: U.patientP, body: "x" }),
    "consent_required",
    "patient send after revocation",
  );
});

test("a manipulated or unknown scope grants nothing", async () => {
  const decision = await authorizePracticePatientLink({
    actorUserId: U.doctorA,
    linkId: LINK_A,
    requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
    requiredConsentType: "secure_messaging__admin",
    clientPracticeId: PRACTICE_A,
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "consent_required");
});

test("consent on one link never satisfies another link", async () => {
  revokeMessagingConsent(LINK_A);
  // link-B still consented — must not help practice A on link-A.
  await rejects(
    () => getThread(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA }),
    "consent_required",
    "cross-link consent bleed",
  );
});

/* ===================================================== */
/* 5. LINK LIFECYCLE (C-4) — decided, not accidental      */
/* ===================================================== */

test("revoked link: practice loses access entirely", async () => {
  links.find((l) => l.id === LINK_A).status = "revoked";
  await rejects(
    () => getThread(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA }),
    "link_not_active",
    "practice read on revoked link",
  );
});

test("revoked link: the patient still READS, but can no longer WRITE", async () => {
  links.find((l) => l.id === LINK_A).status = "revoked";

  const thread = await getThreadForPatientUser(THREAD_A, U.patientP);
  assert.equal(thread.messages.length, 2, "C-4: access is not retention — history stays readable");

  await rejects(
    () => addMessageFromPatient({ threadId: THREAD_A, patientUserId: U.patientP, body: "x" }),
    "consent_required",
    "writing into an ended relationship",
  );
});

/* ============================================================ */
/* 6. READ ACKNOWLEDGEMENT (C-3)                                */
/* ============================================================ */

test("reading a thread does NOT change read state — practice side", async () => {
  await getThread(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  assert.ok(
    messagesOfThread(THREAD_A).every((m) => m.readAt === null),
    "GET must be free of side effects",
  );
});

test("reading a thread does NOT change read state — patient side", async () => {
  await getThreadForPatientUser(THREAD_A, U.patientP);
  assert.ok(messagesOfThread(THREAD_A).every((m) => m.readAt === null));
});

test("listing threads does NOT change read state", async () => {
  await listThreadsForPractice(LINK_A, PRACTICE_A, { actorUserId: U.doctorA });
  await listThreadsForPatient(U.patientP);
  assert.ok(messagesOfThread(THREAD_A).every((m) => m.readAt === null));
});

test("explicit acknowledgement marks only the OTHER party's messages", async () => {
  await markThreadRead(THREAD_A, "practice", {
    practiceProfileId: PRACTICE_A,
    linkId: LINK_A,
    actorUserId: U.doctorA,
  });
  const byId = Object.fromEntries(messagesOfThread(THREAD_A).map((m) => [m.id, m]));
  assert.ok(byId[MSG_PATIENT].readAt, "practice acknowledges the patient's message");
  assert.equal(byId[MSG_PRACTICE].readAt, null, "its own message stays unread");
});

test("acknowledgement is idempotent — the first timestamp survives", async () => {
  const scope = { practiceProfileId: PRACTICE_A, linkId: LINK_A, actorUserId: U.doctorA };
  await markThreadRead(THREAD_A, "practice", scope);
  const first = messagesOfThread(THREAD_A).find((m) => m.id === MSG_PATIENT).readAt;

  await markThreadRead(THREAD_A, "practice", scope);
  const second = messagesOfThread(THREAD_A).find((m) => m.id === MSG_PATIENT).readAt;

  assert.equal(second.getTime(), first.getTime(), "a repeat must not move the timestamp");
});

test("concurrent acknowledgements converge on one consistent state", async () => {
  const scope = { practiceProfileId: PRACTICE_A, linkId: LINK_A, actorUserId: U.doctorA };
  await Promise.all([
    markThreadRead(THREAD_A, "practice", scope),
    markThreadRead(THREAD_A, "practice", scope),
    markThreadRead(THREAD_A, "practice", scope),
  ]);
  const patientMsgs = messagesOfThread(THREAD_A).filter((m) => m.senderType === "patient");
  assert.ok(patientMsgs.every((m) => m.readAt instanceof Date), "all marked");
  assert.equal(
    new Set(patientMsgs.map((m) => m.readAt.getTime())).size,
    1,
    "one coherent timestamp, no partial state",
  );
});

test("patient acknowledgement marks the practice's messages, not their own", async () => {
  await markThreadRead(THREAD_A, "patient", { patientUserId: U.patientP });
  const byId = Object.fromEntries(messagesOfThread(THREAD_A).map((m) => [m.id, m]));
  assert.ok(byId[MSG_PRACTICE].readAt);
  assert.equal(byId[MSG_PATIENT].readAt, null);
});

/* ================================================================= */
/* 7. CONCURRENCY GROUNDWORK — "edit/withdraw only while unread"     */
/* ================================================================= */

test("the data model supports an atomic unread-gated mutation (no TOCTOU)", async () => {
  // Phase 2 will express edit/withdraw as a single conditional UPDATE:
  //   updateMany({ where: { id, readAt: null, ... }, data: {...} })
  // Proving here that the predicate is decisive means the later rule needs no
  // read-then-check-then-write sequence, and therefore no TOCTOU window.
  const before = await prisma.practicePatientMessage.updateMany({
    where: { threadId: THREAD_A, senderType: "practice", readAt: null },
    data: { body: "edited while unread" },
  });
  assert.equal(before.count, 1, "an unread message is mutable");

  await markThreadRead(THREAD_A, "patient", { patientUserId: U.patientP });

  const after = await prisma.practicePatientMessage.updateMany({
    where: { threadId: THREAD_A, senderType: "practice", readAt: null },
    data: { body: "edited after read" },
  });
  assert.equal(after.count, 0, "once read, the same conditional update matches nothing");
  assert.equal(
    messagesOfThread(THREAD_A).find((m) => m.id === MSG_PRACTICE).body,
    "edited while unread",
    "the post-read attempt changed nothing",
  );
});

/* ======================================================== */
/* 8. PERMISSION SEMANTICS (C-5) and guard hardening         */
/* ======================================================== */

test("required permissions are ALL-of, never any-of", async () => {
  // assistant holds MESSAGES_SEND but NOT PATIENT_LINKS_WRITE.
  const decision = await authorizePracticePatientLink({
    actorUserId: U.assistantA,
    linkId: LINK_A,
    requiredPermission: [PERMISSIONS.PATIENT_LINKS_WRITE, PERMISSIONS.MESSAGES_SEND],
    requiredConsentType: "secure_messaging",
  });
  assert.equal(decision.ok, false, "holding one of two permissions must not suffice");
  assert.equal(decision.reason, "forbidden");
});

test("the write set is unchanged by the hardening — doctor may still send", async () => {
  const decision = await authorizePracticePatientLink({
    actorUserId: U.doctorA,
    linkId: LINK_A,
    requiredPermission: [PERMISSIONS.PATIENT_LINKS_WRITE, PERMISSIONS.MESSAGES_SEND],
    requiredConsentType: "secure_messaging",
  });
  assert.equal(decision.ok, true);
});

test("viewer may read but never write", async () => {
  const read = await authorizePracticePatientLink({
    actorUserId: U.viewerA,
    linkId: LINK_A,
    requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
    requiredConsentType: "secure_messaging",
  });
  assert.equal(read.ok, true, "viewer holds PATIENT_LINKS_READ");

  const write = await authorizePracticePatientLink({
    actorUserId: U.viewerA,
    linkId: LINK_A,
    requiredPermission: [PERMISSIONS.PATIENT_LINKS_WRITE, PERMISSIONS.MESSAGES_SEND],
    requiredConsentType: "secure_messaging",
  });
  assert.equal(write.ok, false);
  assert.equal(write.reason, "forbidden");
});

test("required consents are ALL-of — the AI consent does not ride on the messaging one", async () => {
  const decision = await authorizePracticePatientLink({
    actorUserId: U.doctorA,
    linkId: LINK_A,
    requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
    requiredConsentType: ["secure_messaging", "ai_organizational_assistance"],
  });
  assert.equal(decision.ok, false, "messaging consent must not imply AI processing consent");
  assert.equal(decision.reason, "consent_required");
});

/* ================================================================== */
/* 8b. CARDINALITY (Phase 2A)                                         */
/*                                                                    */
/* One PracticePatientLink carries exactly ONE communication channel.  */
/* Enforced by @@unique([practicePatientLinkId]); the fake rejects a    */
/* second insert with P2002 exactly as Postgres does.                  */
/* ================================================================== */

/** A link that has no channel yet, so first-contact can be exercised. */
function linkWithoutChannel() {
  threads = [];
  messages = [];
  return links.find((l) => l.id === LINK_A);
}

test("first contact creates exactly one channel", async () => {
  linkWithoutChannel();
  await createThread({
    linkId: LINK_A,
    practiceProfileId: PRACTICE_A,
    subject: "Rezept",
    body: "Guten Tag",
    senderUserId: U.doctorA,
  });
  assert.equal(threads.filter((t) => t.practicePatientLinkId === LINK_A).length, 1);
});

test("opening communication twice yields ONE channel with two messages", async () => {
  linkWithoutChannel();
  for (const body of ["erste", "zweite"]) {
    await createThread({
      linkId: LINK_A,
      practiceProfileId: PRACTICE_A,
      body,
      senderUserId: U.doctorA,
    });
  }
  const own = threads.filter((t) => t.practicePatientLinkId === LINK_A);
  assert.equal(own.length, 1, "no second thread may appear");
  assert.equal(messagesOfThread(own[0].id).length, 2, "both messages land in the one channel");
});

test("concurrent first contact cannot create two channels (race)", async () => {
  linkWithoutChannel();
  // Patient and practice opening communication at the same moment is the exact
  // case a SELECT-then-CREATE would lose. The unique constraint decides.
  await Promise.all(
    ["A", "B", "C", "D"].map((n) =>
      createThread({
        linkId: LINK_A,
        practiceProfileId: PRACTICE_A,
        body: `gleichzeitig ${n}`,
        senderUserId: U.doctorA,
      }),
    ),
  );
  const own = threads.filter((t) => t.practicePatientLinkId === LINK_A);
  assert.equal(own.length, 1, "exactly one channel survives the race");
  assert.equal(messagesOfThread(own[0].id).length, 4, "and no message is lost");
});

test("ensureCommunicationChannel is idempotent and returns the same row", async () => {
  linkWithoutChannel();
  const link = links.find((l) => l.id === LINK_A);
  const first = await ensureCommunicationChannel(link, { subject: "Betreff" });
  const second = await ensureCommunicationChannel(link, { subject: "anderer Betreff" });

  assert.equal(second.id, first.id, "same channel");
  assert.equal(second.subject, "Betreff", "a later opener never retitles the channel");
  assert.equal(threads.length, 1);
});

test("archiving does not free the slot for a second channel", async () => {
  await archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  assert.ok(
    threads.find((t) => t.id === THREAD_A).practiceArchivedAt,
    "archiving writes the practice's own column",
  );

  await createThread({
    linkId: LINK_A,
    practiceProfileId: PRACTICE_A,
    body: "neuer Kontakt",
    senderUserId: U.doctorA,
  });

  const own = threads.filter((t) => t.practicePatientLinkId === LINK_A);
  assert.equal(own.length, 1, "still one channel — archiving is not a reset");
  assert.equal(own[0].id, THREAD_A, "and it is the same one");
  assert.equal(own[0].practiceArchivedAt, null, "new activity brings it back into view");
});

test("closing does not free the slot, and writing reopens the channel", async () => {
  await closeThread(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  assert.equal(threads.find((t) => t.id === THREAD_A).status, "closed");

  // With one permanent channel per relationship a terminal state would end the
  // ability to communicate for good, so writing must reopen.
  await addMessageFromPatient({ threadId: THREAD_A, patientUserId: U.patientP, body: "doch noch" });

  const own = threads.filter((t) => t.practicePatientLinkId === LINK_A);
  assert.equal(own.length, 1);
  assert.equal(own[0].status, "open");
  assert.equal(own[0].closedAt, null, "the closed marker is cleared, not stacked");
});

test("restore creates no duplicate", async () => {
  await archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  await restoreThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  assert.equal(threads.filter((t) => t.practicePatientLinkId === LINK_A).length, 1);
});

test("each care relationship of the same patient keeps its OWN channel", async () => {
  threads = [];
  messages = [];
  for (const [linkId, practiceId, actor] of [
    [LINK_A, PRACTICE_A, U.doctorA],
    [LINK_B, PRACTICE_B, U.doctorB],
  ]) {
    await createThread({
      linkId,
      practiceProfileId: practiceId,
      body: "Hallo",
      senderUserId: actor,
    });
  }
  assert.equal(threads.length, 2, "one channel per relationship, not per patient");
  assert.equal(threads.filter((t) => t.practicePatientLinkId === LINK_A).length, 1);
  assert.equal(threads.filter((t) => t.practicePatientLinkId === LINK_B).length, 1);

  // And they stay isolated, exactly as in the cross-practice section above.
  const aChannel = threads.find((t) => t.practicePatientLinkId === LINK_A);
  await rejects(
    () => getThread(aChannel.id, PRACTICE_B, LINK_B, { actorUserId: U.doctorB }),
    "thread_not_found",
    "B must not reach A's channel",
  );
});

test("the schema declares the one-channel constraint", () => {
  const schema = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "schema.prisma"),
    "utf8",
  );
  const model = schema.slice(
    schema.indexOf("model PracticePatientThread {"),
    schema.indexOf("model PracticePatientMessage {"),
  );
  assert.match(
    model,
    /@@unique\(\[practicePatientLinkId\]\)/,
    "the invariant must be enforced by the database, not only by the service",
  );
});

/* ================================================================== */
/* 8b2. MESSAGE IDEMPOTENCY (Phase 2A.1)                              */
/*                                                                    */
/* Channel and message are SEPARATE invariants:                        */
/*   channel — one per PracticePatientLink, forever                    */
/*   message — one per (channel, clientRequestId)                      */
/* ================================================================== */

test("the same logical send retried does NOT persist a second message", async () => {
  const before = messagesOfThread(THREAD_A).length;
  const key = "send-key-1";

  for (let i = 0; i < 3; i += 1) {
    await addMessageFromPatient({
      threadId: THREAD_A,
      patientUserId: U.patientP,
      body: "Bin unterwegs",
      clientRequestId: key,
    });
  }

  assert.equal(messagesOfThread(THREAD_A).length, before + 1, "exactly one message");
});

test("10 concurrent retries of one key persist exactly ONE message (race)", async () => {
  const before = messagesOfThread(THREAD_A).length;
  const key = "send-key-race";

  await Promise.all(
    Array.from({ length: 10 }, () =>
      addMessageFromPatient({
        threadId: THREAD_A,
        patientUserId: U.patientP,
        body: "gleichzeitig",
        clientRequestId: key,
      }),
    ),
  );

  const written = messagesOfThread(THREAD_A).filter((m) => m.clientRequestId === key);
  assert.equal(written.length, 1, "the unique index decides, not a prior read");
  assert.equal(messagesOfThread(THREAD_A).length, before + 1);
});

test("10 DIFFERENT keys persist 10 messages", async () => {
  const before = messagesOfThread(THREAD_A).length;

  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      addMessageFromPatient({
        threadId: THREAD_A,
        patientUserId: U.patientP,
        body: "verschieden",
        clientRequestId: `distinct-${i}`,
      }),
    ),
  );

  assert.equal(messagesOfThread(THREAD_A).length, before + 10);
});

test("identical text under a NEW key is a new message — dedup is by intent, not content", async () => {
  const before = messagesOfThread(THREAD_A).length;
  for (const key of ["k1", "k2"]) {
    await addMessageFromPatient({
      threadId: THREAD_A,
      patientUserId: U.patientP,
      body: "Wortgleich",
      clientRequestId: key,
    });
  }
  assert.equal(messagesOfThread(THREAD_A).length, before + 2, "repeating yourself is legitimate");
});

test("sending WITHOUT a key keeps the previous behaviour — every call appends", async () => {
  const before = messagesOfThread(THREAD_A).length;
  for (let i = 0; i < 3; i += 1) {
    await addMessageFromPatient({ threadId: THREAD_A, patientUserId: U.patientP, body: "ohne Key" });
  }
  assert.equal(messagesOfThread(THREAD_A).length, before + 3, "NULL keys are never grouped");
});

test("a deduplicated retry raises no second inbox notification and does not bump the channel", async (t) => {
  // The notify path returns early while the inbox module is off, so the flag is
  // turned on for this test only — otherwise the notification half of this
  // assertion would silently prove nothing.
  const previous = process.env.PRACTICE_INBOX;
  process.env.PRACTICE_INBOX = "true";
  t.after(() => {
    if (previous === undefined) delete process.env.PRACTICE_INBOX;
    else process.env.PRACTICE_INBOX = previous;
  });

  const key = "send-key-notify";
  const first = await addMessageFromPatient({
    threadId: THREAD_A,
    patientUserId: U.patientP,
    body: "einmal",
    clientRequestId: key,
  });
  // Deterministic: count the writes. Comparing timestamps would pass by luck
  // whenever both calls land in the same millisecond.
  const writesAfterFirst = threadUpdateCalls;
  const inboxAfterFirst = practiceInboxWrites;
  assert.ok(inboxAfterFirst > 0, "the first send must notify at all, or the check below is vacuous");

  const retry = await addMessageFromPatient({
    threadId: THREAD_A,
    patientUserId: U.patientP,
    body: "einmal",
    clientRequestId: key,
  });

  assert.equal(
    threadUpdateCalls,
    writesAfterFirst,
    "a retry must write nothing — no re-sorting the channel in every list",
  );
  assert.equal(
    practiceInboxWrites,
    inboxAfterFirst,
    "a retry must not put a second entry in the practice inbox",
  );
  assert.equal(retry.messageCount, first.messageCount, "and reports the same state");
});

test("the practice send path is idempotent too", async () => {
  const before = messagesOfThread(THREAD_A).length;
  for (let i = 0; i < 3; i += 1) {
    await addMessageFromPractice({
      threadId: THREAD_A,
      practiceProfileId: PRACTICE_A,
      linkId: LINK_A,
      senderUserId: U.doctorA,
      body: "Praxisantwort",
      clientRequestId: "practice-key-1",
    });
  }
  assert.equal(messagesOfThread(THREAD_A).length, before + 1);
});

test("opening communication is idempotent: one channel AND one message", async () => {
  linkWithoutChannel();
  for (let i = 0; i < 4; i += 1) {
    await createThread({
      linkId: LINK_A,
      practiceProfileId: PRACTICE_A,
      body: "Erstkontakt",
      senderUserId: U.doctorA,
      clientRequestId: "open-key-1",
    });
  }
  const own = threads.filter((t) => t.practicePatientLinkId === LINK_A);
  assert.equal(own.length, 1, "one channel");
  assert.equal(messagesOfThread(own[0].id).length, 1, "and one message, not four");
});

test("the SAME key in two different channels does not collide across tenants", async () => {
  threads = [];
  messages = [];
  const key = "shared-key";

  for (const [linkId, practiceId, actor] of [
    [LINK_A, PRACTICE_A, U.doctorA],
    [LINK_B, PRACTICE_B, U.doctorB],
  ]) {
    await createThread({
      linkId,
      practiceProfileId: practiceId,
      body: "Hallo",
      senderUserId: actor,
      clientRequestId: key,
    });
  }

  const chanA = threads.find((t) => t.practicePatientLinkId === LINK_A);
  const chanB = threads.find((t) => t.practicePatientLinkId === LINK_B);
  assert.equal(messagesOfThread(chanA.id).length, 1, "practice A wrote its message");
  assert.equal(messagesOfThread(chanB.id).length, 1, "practice B wrote its own");
  assert.notEqual(
    messagesOfThread(chanA.id)[0].id,
    messagesOfThread(chanB.id)[0].id,
    "two independent rows — a key is only ever scoped to its own channel",
  );
});

test("appendMessage reports whether it deduplicated", async () => {
  const first = await appendMessage({
    threadId: THREAD_A,
    senderType: "patient",
    senderUserId: U.patientP,
    body: "x",
    clientRequestId: "report-key",
  });
  const second = await appendMessage({
    threadId: THREAD_A,
    senderType: "patient",
    senderUserId: U.patientP,
    body: "x",
    clientRequestId: "report-key",
  });
  assert.equal(first.deduped, false);
  assert.equal(second.deduped, true);
  assert.equal(second.message.id, first.message.id, "the caller gets the original message");
});

test("an oversized idempotency key is rejected, never truncated into a collision", async () => {
  await rejects(
    () =>
      addMessageFromPatient({
        threadId: THREAD_A,
        patientUserId: U.patientP,
        body: "x",
        clientRequestId: "k".repeat(65),
      }),
    "validation_text_too_long",
    "oversized key",
  );
});

test("the schema declares the message idempotency constraint", () => {
  const schema = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "schema.prisma"),
    "utf8",
  );
  const model = schema.slice(schema.indexOf("model PracticePatientMessage {"));
  assert.match(
    model.slice(0, model.indexOf("}")),
    /@@unique\(\[threadId, clientRequestId\]\)/,
    "retry safety must be enforced by the database, not by application memory",
  );
});

/* ================================================================== */
/* 8b3. PARTY-SCOPED ARCHIVE (Phase 2A.2)                             */
/*                                                                    */
/* Replaces the two former KNOWN LIMITATION characterization tests.    */
/* Archiving is a view preference: it belongs to exactly one party and */
/* must never reach across. These are regression guards for the defect */
/* that shipped before 2A.2.                                          */
/* ================================================================== */

const patientArchive = async () => {
  const { archiveThreadForPatient } = await import(
    "../services/communication/practicePatientThreadService.js"
  );
  return archiveThreadForPatient(THREAD_A, U.patientP);
};
const patientRestore = async () => {
  const { restoreThreadForPatient } = await import(
    "../services/communication/practicePatientThreadService.js"
  );
  return restoreThreadForPatient(THREAD_A, U.patientP);
};
const row = () => threads.find((t) => t.id === THREAD_A);

test("patient archive never changes practice work state", async () => {
  const practiceListBefore = await listThreadsForPractice(LINK_A, PRACTICE_A, {
    actorUserId: U.doctorA,
  });

  await patientArchive();

  assert.ok(row().patientArchivedAt, "the patient's own column is set");
  assert.equal(row().practiceArchivedAt, null, "the practice column is untouched");
  assert.equal(row().status, "open", "the shared lifecycle is untouched");

  const practiceListAfter = await listThreadsForPractice(LINK_A, PRACTICE_A, {
    actorUserId: U.doctorA,
  });
  assert.deepEqual(
    practiceListAfter.map((t) => t.id),
    practiceListBefore.map((t) => t.id),
    "the practice work queue is unchanged",
  );
  assert.equal(
    practiceListAfter[0].unreadCount,
    practiceListBefore[0].unreadCount,
    "and so is the practice unread count",
  );
  assert.equal(practiceListAfter[0].status, "open", "the practice does not see 'archived'");
});

test("practice archive never changes patient view state", async () => {
  const patientListBefore = await listThreadsForPatient(U.patientP);

  await archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });

  assert.ok(row().practiceArchivedAt, "the practice's own column is set");
  assert.equal(row().patientArchivedAt, null, "the patient column is untouched");
  assert.equal(row().status, "open", "the shared lifecycle is untouched");

  const patientListAfter = await listThreadsForPatient(U.patientP);
  assert.deepEqual(
    patientListAfter.map((t) => t.id),
    patientListBefore.map((t) => t.id),
    "the patient list is unchanged",
  );
  assert.equal(
    patientListAfter[0].unreadCount,
    patientListBefore[0].unreadCount,
    "and so is the patient unread count",
  );
  assert.equal(patientListAfter[0].status, "open", "the patient does not see 'archived'");
});

test("the practice unread counter ignores the patient's archive (dashboard aggregate)", async () => {
  // The dashboard counts unread patient messages on threads the PRACTICE has
  // not archived. This is the aggregate that silently dropped before 2A.2.
  const countUnread = () =>
    messages.filter(
      (m) =>
        m.senderType === "patient" &&
        m.readAt === null &&
        threads.some((t) => t.id === m.threadId && t.practiceArchivedAt === null),
    ).length;

  const before = countUnread();
  assert.ok(before > 0, "precondition: there is something unread");

  await patientArchive();

  assert.equal(countUnread(), before, "the patient cannot suppress the practice's badge");
});

test("both parties can hold an archive at the same time, independently", async () => {
  await patientArchive();
  await archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });

  assert.ok(row().patientArchivedAt, "patient archived");
  assert.ok(row().practiceArchivedAt, "practice archived");
  assert.equal((await listThreadsForPatient(U.patientP)).length, 0);
  assert.equal(
    (await listThreadsForPractice(LINK_A, PRACTICE_A, { actorUserId: U.doctorA })).length,
    0,
  );
  assert.equal(
    (await listThreadsForPractice(LINK_A, PRACTICE_A, { actorUserId: U.doctorA, includeArchived: true })).length,
    1,
    "nothing is lost — includeArchived still returns it",
  );
});

test("patient restore changes ONLY the patient column", async () => {
  await patientArchive();
  await archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  const practiceMark = row().practiceArchivedAt;

  await patientRestore();

  assert.equal(row().patientArchivedAt, null, "patient is back");
  assert.equal(
    row().practiceArchivedAt.getTime(),
    practiceMark.getTime(),
    "the practice archive is untouched to the millisecond",
  );
});

test("practice restore changes ONLY the practice column", async () => {
  await patientArchive();
  await archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  const patientMark = row().patientArchivedAt;

  await restoreThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });

  assert.equal(row().practiceArchivedAt, null, "practice is back");
  assert.equal(
    row().patientArchivedAt.getTime(),
    patientMark.getTime(),
    "the patient archive is untouched to the millisecond",
  );
});

test("restore is rejected when the acting party has not archived", async () => {
  // The practice archived; the PATIENT has nothing to restore.
  await archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  await rejects(patientRestore, "thread_not_archived", "patient restoring a practice archive");
});

test("a patient message reactivates BOTH views, each by its own rule", async () => {
  await patientArchive();
  await archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });

  await addMessageFromPatient({ threadId: THREAD_A, patientUserId: U.patientP, body: "Nachfrage" });

  assert.equal(
    row().practiceArchivedAt,
    null,
    "recipient rule: new content must not stay hidden in the practice's queue",
  );
  assert.equal(
    row().patientArchivedAt,
    null,
    "sender rule: engaging with a conversation returns it to your own view",
  );
});

test("a practice message reactivates BOTH views, each by its own rule", async () => {
  await patientArchive();
  await archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });

  await addMessageFromPractice({
    threadId: THREAD_A,
    practiceProfileId: PRACTICE_A,
    linkId: LINK_A,
    senderUserId: U.doctorA,
    body: "Antwort",
  });

  assert.equal(row().patientArchivedAt, null, "recipient rule");
  assert.equal(row().practiceArchivedAt, null, "sender rule");
});

test("archiving does not re-sort the other party's list", async () => {
  const before = row().updatedAt.getTime();
  await patientArchive();
  assert.equal(
    row().updatedAt.getTime(),
    before,
    "a view preference must not bump the channel for anyone",
  );
});

test("no code path clears both archive columns as a blanket action", () => {
  const src = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "services",
      "communication",
      "practicePatientThreadService.js",
    ),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  // The only place allowed to clear both is the send path, where each column has
  // its own documented reason. Archive and restore must each touch one column.
  for (const fn of [
    "archiveThreadForPractice",
    "restoreThreadForPractice",
    "archiveThreadForPatient",
    "restoreThreadForPatient",
  ]) {
    const start = src.indexOf(`export async function ${fn}`);
    assert.ok(start > -1, `${fn} not found`);
    const body = src.slice(start, src.indexOf("\nexport ", start + 10));
    const touchesPatient = /patientArchivedAt/.test(body);
    const touchesPractice = /practiceArchivedAt/.test(body);
    assert.notEqual(
      touchesPatient && touchesPractice,
      true,
      `${fn} must write exactly one party's archive column`,
    );
  }
});

test("the legacy shared archivedAt is never written and never filtered on", () => {
  const src = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "services",
      "communication",
      "practicePatientThreadService.js",
    ),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  assert.equal(
    /archivedAt:\s*(null|now|new Date)/.test(src.replace(/patientArchivedAt|practiceArchivedAt/g, "")),
    false,
    "the legacy column is evidence of an unattributed archive — it must stay read-only",
  );
});

test("archiving at practice A never touches the patient's channel at practice B", async () => {
  threads = [];
  messages = [];
  for (const [linkId, practiceId, actor] of [
    [LINK_A, PRACTICE_A, U.doctorA],
    [LINK_B, PRACTICE_B, U.doctorB],
  ]) {
    await createThread({
      linkId,
      practiceProfileId: practiceId,
      body: "Hallo",
      senderUserId: actor,
    });
  }
  const chanA = threads.find((t) => t.practicePatientLinkId === LINK_A);
  const chanB = threads.find((t) => t.practicePatientLinkId === LINK_B);

  await archiveThreadForPractice(chanA.id, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });

  assert.ok(chanA.practiceArchivedAt, "A archived its own channel");
  assert.equal(chanB.practiceArchivedAt, null, "B is entirely unaffected");
  assert.equal(chanA.patientArchivedAt, null);
  assert.equal(chanB.patientArchivedAt, null);

  // The patient still sees BOTH channels — practice A tidying its work queue is
  // invisible to the patient and to practice B.
  assert.equal((await listThreadsForPatient(U.patientP)).length, 2);
  assert.equal(
    (await listThreadsForPractice(LINK_B, PRACTICE_B, { actorUserId: U.doctorB })).length,
    1,
  );
});

test("concurrent archiving by both parties stores both states", async () => {
  const { archiveThreadForPatient } = await import(
    "../services/communication/practicePatientThreadService.js"
  );
  await Promise.all([
    archiveThreadForPatient(THREAD_A, U.patientP),
    archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA }),
  ]);

  assert.ok(row().patientArchivedAt, "patient state survived");
  assert.ok(row().practiceArchivedAt, "practice state survived");
});

test("patient archiving concurrently with a practice message ends in a defined state", async () => {
  const { archiveThreadForPatient } = await import(
    "../services/communication/practicePatientThreadService.js"
  );
  await Promise.all([
    archiveThreadForPatient(THREAD_A, U.patientP),
    addMessageFromPractice({
      threadId: THREAD_A,
      practiceProfileId: PRACTICE_A,
      linkId: LINK_A,
      senderUserId: U.doctorA,
      body: "gleichzeitig",
    }),
  ]);

  // Both orderings are legitimate; what must NOT happen is a half-written state
  // or the practice column being touched by the patient's action.
  const r = row();
  assert.ok(
    r.patientArchivedAt === null || r.patientArchivedAt instanceof Date,
    "the patient column is either set or cleared, never garbage",
  );
  assert.equal(r.practiceArchivedAt, null, "the sender's own view is active either way");
  assert.equal(messagesOfThread(THREAD_A).length, 3, "the message is never lost");
});

test("practice archiving concurrently with a patient message ends in a defined state", async () => {
  await Promise.all([
    archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA }),
    addMessageFromPatient({ threadId: THREAD_A, patientUserId: U.patientP, body: "gleichzeitig" }),
  ]);

  const r = row();
  assert.ok(r.practiceArchivedAt === null || r.practiceArchivedAt instanceof Date);
  assert.equal(r.patientArchivedAt, null);
  assert.equal(messagesOfThread(THREAD_A).length, 3, "the message is never lost");
});

test("the schema declares party-scoped archive columns", () => {
  const schema = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "schema.prisma"),
    "utf8",
  );
  const model = schema.slice(
    schema.indexOf("model PracticePatientThread {"),
    schema.indexOf("model PracticePatientMessage {"),
  );
  assert.match(model, /patientArchivedAt\s+DateTime\?/);
  assert.match(model, /practiceArchivedAt\s+DateTime\?/);
});

/* ================================================================== */
/* 8c. SUBJECT PRIVACY — search and export                            */
/*                                                                    */
/* `subject` is user-authored free text ("Betreff", optional) and can  */
/* carry health information as directly as a body. It therefore sits   */
/* behind the same messaging consent.                                  */
/* ================================================================== */

const SENSITIVE_SUBJECT = "HIV-Befund";

function giveThreadASensitiveSubject() {
  threads.find((t) => t.id === THREAD_A).subject = SENSITIVE_SUBJECT;
}

test("search: consent present -> the subject is findable (positive control)", async () => {
  giveThreadASensitiveSubject();
  const { searchPracticePatientRecord } = await import(
    "../services/careRelationship/practicePatientSearchService.js"
  );
  prisma.practiceDocument = { findMany: async () => [] };
  prisma.medicationPlan = { findMany: async () => [] };
  prisma.auditLog.findMany = async () => [];

  const { results } = await searchPracticePatientRecord(LINK_A, PRACTICE_A, "hiv");
  assert.equal(results.filter((r) => r.kind === "thread").length, 1);
});

test("search: consent revoked -> no subject text and no existence oracle", async () => {
  giveThreadASensitiveSubject();
  revokeMessagingConsent(LINK_A);
  const { searchPracticePatientRecord } = await import(
    "../services/careRelationship/practicePatientSearchService.js"
  );
  prisma.practiceDocument = { findMany: async () => [] };
  prisma.medicationPlan = { findMany: async () => [] };
  prisma.auditLog.findMany = async () => [];

  const { results } = await searchPracticePatientRecord(LINK_A, PRACTICE_A, "hiv");
  assert.equal(
    results.filter((r) => r.kind === "thread").length,
    0,
    "a hit would confirm the term exists even without rendering it",
  );
  assert.equal(
    JSON.stringify(results).toLowerCase().includes("hiv"),
    false,
    "no fragment of the subject may appear",
  );
});

test("export: consent revoked -> the patient summary carries no subject", async () => {
  giveThreadASensitiveSubject();
  revokeMessagingConsent(LINK_A);

  prisma.practiceProfile.findFirst = async () => ({ practiceName: "Praxis A" });
  prisma.practiceDocument = { findMany: async () => [], count: async () => 0, findFirst: async () => null };
  prisma.medicationPlan = { findMany: async () => [], count: async () => 0, findFirst: async () => null };
  prisma.preVisitSession = { count: async () => 0, findFirst: async () => null };
  prisma.practiceDocumentShare = { findFirst: async () => null };
  prisma.patientDataRequest = { findMany: async () => [], findFirst: async () => null, count: async () => 0 };

  const { collectExportDataset } = await import("../services/export/exportCollectors.js");
  const dataset = await collectExportDataset({
    type: "patient_summary",
    practiceProfileId: PRACTICE_A,
    practicePatientLinkId: LINK_A,
    locale: "de",
  });

  const flat = JSON.stringify(dataset);
  assert.equal(flat.includes(SENSITIVE_SUBJECT), false, "the subject must not be exported");
  assert.match(flat, /Keine Einwilligung/, "and the omission is stated, not silent");
});

/* ================================================================== */
/* 9. SECOND READ PATHS (C-6) — the inbox message preview             */
/*                                                                    */
/* /practice/inbox/:itemId returns up to 20 message BODIES for a       */
/* "message" item. Tenant scoping was already correct, but the         */
/* patient's messaging consent was never consulted, so this was a      */
/* silent alternative read path around the threads API.                */
/* ================================================================== */

test("inbox preview: consent present -> bodies are returned (positive control)", async () => {
  prisma.practiceInboxItem.findFirst = async ({ where }) =>
    where.id === "inbox-1" && where.practiceProfileId === PRACTICE_A
      ? {
          id: "inbox-1",
          practiceProfileId: PRACTICE_A,
          practicePatientLinkId: LINK_A,
          patientUserId: U.patientP,
          type: "message",
          title: "Neue Nachricht",
          status: "new",
          priority: "normal",
          sourceRefType: "patient_thread",
          sourceRefId: THREAD_A,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActivityAt: new Date(),
          practicePatientLink: links.find((l) => l.id === LINK_A),
        }
      : null;

  const { getPracticeInboxItem } = await import(
    "../services/practiceInbox/practiceInboxService.js"
  );
  const result = await getPracticeInboxItem("inbox-1", PRACTICE_A);
  assert.equal(result.context.thread.messages.length, 2);
  assert.equal(result.context.threadUnavailable, undefined);
});

test("inbox preview: consent revoked -> no message bodies leak through the inbox", async () => {
  revokeMessagingConsent(LINK_A);

  prisma.practiceInboxItem.findFirst = async () => ({
    id: "inbox-1",
    practiceProfileId: PRACTICE_A,
    practicePatientLinkId: LINK_A,
    patientUserId: U.patientP,
    type: "message",
    title: "Neue Nachricht",
    status: "new",
    priority: "normal",
    sourceRefType: "patient_thread",
    sourceRefId: THREAD_A,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
    practicePatientLink: links.find((l) => l.id === LINK_A),
  });

  const { getPracticeInboxItem } = await import(
    "../services/practiceInbox/practiceInboxService.js"
  );
  const result = await getPracticeInboxItem("inbox-1", PRACTICE_A);

  assert.equal(result.context.thread, null, "the conversation preview must be withheld");
  assert.equal(result.context.threadUnavailable, "consent_required", "and say why");
  assert.ok(result.item, "the neutral inbox item itself stays visible");
  assert.equal(
    JSON.stringify(result).includes("Medikationsplan"),
    false,
    "no message body may appear anywhere in the payload",
  );
});

/* ================================================================= */
/* ================================================================== */
/* 8d. LINK-SCOPED CHANNEL READ (Phase 2C)                            */
/*                                                                    */
/* The practice-context read path: one care relationship in, that      */
/* relationship's single channel out. Nothing else may come back.      */
/* ================================================================== */

test("the link-scoped read returns exactly the channel of that relationship", async () => {
  const { link, channel } = await getChannelForPatientLink(LINK_A, U.patientP);

  assert.equal(link.id, LINK_A);
  assert.equal(channel.id, THREAD_A);
  assert.equal(channel.practicePatientLinkId, LINK_A);
  assert.equal(channel.messages.length, 2);
});

test("a patient reading their OTHER relationship gets a different channel", async () => {
  // Give link B a channel of its own so both relationships are populated.
  threads.push({
    id: "thread-B",
    practicePatientLinkId: LINK_B,
    practiceProfileId: PRACTICE_B,
    patientUserId: U.patientP,
    subject: "B",
    status: "open",
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    patientArchivedAt: null,
    practiceArchivedAt: null,
    archivedAt: null,
  });
  messages.push({
    id: "msg-B",
    threadId: "thread-B",
    senderType: "practice",
    senderUserId: U.doctorB,
    body: "B_ONLY_MARKER",
    clientRequestId: null,
    createdAt: new Date(),
    readAt: null,
  });

  const a = await getChannelForPatientLink(LINK_A, U.patientP);
  const b = await getChannelForPatientLink(LINK_B, U.patientP);

  assert.notEqual(a.channel.id, b.channel.id);
  assert.equal(
    JSON.stringify(a.channel).includes("B_ONLY_MARKER"),
    false,
    "practice A's context must not contain practice B's message",
  );
  assert.equal(
    JSON.stringify(b.channel).includes("Medikationsplan"),
    false,
    "and practice B's context must not contain practice A's",
  );
});

test("a link belonging to another patient is reported as not found", async () => {
  await rejects(
    () => getChannelForPatientLink(LINK_Q, U.patientP),
    "link_not_found",
    "P reading Q's relationship",
  );
  await rejects(
    () => getChannelForPatientLink(LINK_A, U.patientQ),
    "link_not_found",
    "Q reading P's relationship",
  );
});

test("a foreign link and a non-existent link are indistinguishable here too", async () => {
  const foreign = await getChannelForPatientLink(LINK_Q, U.patientP).catch((e) => e.message);
  const missing = await getChannelForPatientLink("nope", U.patientP).catch((e) => e.message);
  assert.equal(foreign, "link_not_found");
  assert.equal(missing, foreign);
});

test("the link-scoped read never creates a channel", async () => {
  // Link B has no conversation yet in the base fixture.
  const before = threads.length;
  const { link, channel } = await getChannelForPatientLink(LINK_B, U.patientP);

  assert.equal(channel, null, "an empty relationship reports no channel");
  assert.equal(link.id, LINK_B, "but the relationship itself is returned");
  assert.equal(threads.length, before, "and nothing was created by a GET");
});

test("the link-scoped read never changes read state", async () => {
  await getChannelForPatientLink(LINK_A, U.patientP);
  assert.ok(
    messagesOfThread(THREAD_A).every((m) => m.readAt === null),
    "GET stays free of side effects (C-3)",
  );
});

test("an ended relationship still reads, per the Phase 1' policy", async () => {
  links.find((l) => l.id === LINK_A).status = "revoked";
  const { link, channel } = await getChannelForPatientLink(LINK_A, U.patientP);
  assert.equal(link.status, "revoked", "the caller can tell it has ended");
  assert.equal(channel.messages.length, 2, "history stays readable");
});

test("the patient's own archive is reflected, the practice's is not", async () => {
  const { archiveThreadForPatient } = await import(
    "../services/communication/practicePatientThreadService.js"
  );
  await archiveThreadForPractice(THREAD_A, PRACTICE_A, LINK_A, { actorUserId: U.doctorA });
  let read = await getChannelForPatientLink(LINK_A, U.patientP);
  assert.equal(read.channel.status, "open", "the practice's archive is invisible to the patient");

  await archiveThreadForPatient(THREAD_A, U.patientP);
  read = await getChannelForPatientLink(LINK_A, U.patientP);
  assert.equal(read.channel.status, "archived", "the patient's own archive shows");
});

/* ================================================================== */
/* 8e. PRACTICE CONTEXT DIRECTORY (Phase 2D)                          */
/*                                                                    */
/* The chooser's data source. It must expose the patient's own         */
/* relationships and nothing else — no other patient's, no content,    */
/* and no cross-assignment of unread counts.                          */
/* ================================================================== */

/** Counts prisma calls so the "no N+1" claim is measured, not asserted. */
function countingPrisma() {
  const calls = { total: 0 };
  const wrap = (obj, name) =>
    new Proxy(obj, {
      get(target, prop) {
        const v = target[prop];
        if (typeof v !== "function") return v;
        return (...args) => {
          calls.total += 1;
          calls[`${name}.${String(prop)}`] = (calls[`${name}.${String(prop)}`] ?? 0) + 1;
          return v(...args);
        };
      },
    });
  prisma.practicePatientLink = wrap(prisma.practicePatientLink, "link");
  prisma.practicePatientThread = wrap(prisma.practicePatientThread, "thread");
  prisma.practicePatientMessage = wrap(prisma.practicePatientMessage, "message");
  return calls;
}

/** The directory needs groupBy, which the base fake does not provide. */
function installDirectoryFake() {
  prisma.practicePatientMessage.groupBy = async ({ where }) => {
    const ids = where.threadId?.in ?? [];
    const out = [];
    for (const id of ids) {
      const n = messages.filter(
        (m) =>
          m.threadId === id &&
          m.senderType === where.senderType &&
          m.readAt === where.readAt,
      ).length;
      if (n > 0) out.push({ threadId: id, _count: { _all: n } });
    }
    return out;
  };
  prisma.practicePatientLink.findMany = async ({ where }) =>
    links
      .filter((l) => l.patientUserId === where.patientUserId)
      .filter((l) => (where.status?.in ? where.status.in.includes(l.status) : true))
      .map((l) => ({ ...l, practiceProfile: practiceById(l.practiceProfileId) }));
}

test("the directory lists exactly the patient's own relationships", async () => {
  installDirectoryFake();
  const { listPatientPracticeContexts } = await import(
    "../services/careRelationship/patientPracticeDirectoryService.js"
  );

  const { contexts } = await listPatientPracticeContexts(U.patientP);
  const ids = contexts.map((c) => c.linkId).sort();
  assert.deepEqual(ids, [LINK_A, LINK_B].sort(), "P sees A and B");
  assert.equal(
    ids.includes(LINK_Q),
    false,
    "and never patient Q's relationship, even though it is at the same practice",
  );
});

test("another patient's directory contains none of P's relationships", async () => {
  installDirectoryFake();
  const { listPatientPracticeContexts } = await import(
    "../services/careRelationship/patientPracticeDirectoryService.js"
  );

  const { contexts } = await listPatientPracticeContexts(U.patientQ);
  assert.deepEqual(contexts.map((c) => c.linkId), [LINK_Q]);
});

test("the directory carries no message content — no bodies, no subjects", async () => {
  installDirectoryFake();
  threads.find((t) => t.id === THREAD_A).subject = "HIV-Befund";
  const { listPatientPracticeContexts } = await import(
    "../services/careRelationship/patientPracticeDirectoryService.js"
  );

  const { contexts } = await listPatientPracticeContexts(U.patientP);
  const flat = JSON.stringify(contexts);
  assert.equal(flat.includes("HIV-Befund"), false, "a subject may never ride along for a badge");
  assert.equal(flat.includes("Medikationsplan"), false, "and neither may a body");
});

test("unread counts are attributed to the right relationship", async () => {
  installDirectoryFake();
  // A has one unread practice message; give B a channel with two.
  threads.push({
    id: "thread-B",
    practicePatientLinkId: LINK_B,
    practiceProfileId: PRACTICE_B,
    patientUserId: U.patientP,
    subject: null,
    status: "open",
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    patientArchivedAt: null,
    practiceArchivedAt: null,
    archivedAt: null,
  });
  for (const n of [1, 2]) {
    messages.push({
      id: `m-b-${n}`,
      threadId: "thread-B",
      senderType: "practice",
      senderUserId: U.doctorB,
      body: "x",
      clientRequestId: null,
      createdAt: new Date(),
      readAt: null,
    });
  }

  const { listPatientPracticeContexts } = await import(
    "../services/careRelationship/patientPracticeDirectoryService.js"
  );
  const { contexts } = await listPatientPracticeContexts(U.patientP);
  const byLink = Object.fromEntries(contexts.map((c) => [c.linkId, c]));

  assert.equal(byLink[LINK_A].unreadCount, 1, "A keeps its own count");
  assert.equal(byLink[LINK_B].unreadCount, 2, "B keeps its own count");
});

test("only the patient's unread messages count, never their own", async () => {
  installDirectoryFake();
  const { listPatientPracticeContexts } = await import(
    "../services/careRelationship/patientPracticeDirectoryService.js"
  );
  const { contexts } = await listPatientPracticeContexts(U.patientP);
  const a = contexts.find((c) => c.linkId === LINK_A);
  // The fixture has one unread practice message and one unread patient message.
  assert.equal(a.unreadCount, 1, "the patient's own unsent-read message is not 'unread' for them");
});

test("identity is the link id, not the display name", async () => {
  installDirectoryFake();
  // Two practices with the SAME name must stay distinguishable.
  PRACTICES[1].practiceName = PRACTICES[0].practiceName;
  const { listPatientPracticeContexts } = await import(
    "../services/careRelationship/patientPracticeDirectoryService.js"
  );

  const { contexts } = await listPatientPracticeContexts(U.patientP);
  assert.equal(contexts.length, 2);
  assert.equal(
    new Set(contexts.map((c) => c.linkId)).size,
    2,
    "same name, two distinct contexts",
  );
  PRACTICES[1].practiceName = "Praxis B";
});

test("ended relationships are listed but flagged, not silently active", async () => {
  installDirectoryFake();
  links.find((l) => l.id === LINK_B).status = "revoked";
  const { listPatientPracticeContexts } = await import(
    "../services/careRelationship/patientPracticeDirectoryService.js"
  );

  const { contexts } = await listPatientPracticeContexts(U.patientP);
  const b = contexts.find((c) => c.linkId === LINK_B);
  assert.equal(b.status, "revoked");
  assert.equal(b.isActive, false, "the caller can present it as a former practice");
});

test("a declined relationship is not a context at all", async () => {
  installDirectoryFake();
  links.find((l) => l.id === LINK_B).status = "declined";
  const { listPatientPracticeContexts } = await import(
    "../services/careRelationship/patientPracticeDirectoryService.js"
  );

  const { contexts } = await listPatientPracticeContexts(U.patientP);
  assert.deepEqual(contexts.map((c) => c.linkId), [LINK_A]);
});

test("the query count stays constant as practices are added (no N+1)", async () => {
  installDirectoryFake();
  const { listPatientPracticeContexts } = await import(
    "../services/careRelationship/patientPracticeDirectoryService.js"
  );

  const calls = countingPrisma();
  installDirectoryFake();
  await listPatientPracticeContexts(U.patientP);
  const withTwo = calls.total;

  // Grow to twelve relationships, each with its own channel and messages.
  for (let i = 0; i < 10; i += 1) {
    const linkId = `link-extra-${i}`;
    links.push({
      id: linkId,
      practiceProfileId: PRACTICE_A,
      patientUserId: U.patientP,
      status: "active",
      consentAcceptedAt: new Date(),
      consentScopes: ["messages"],
    });
    threads.push({
      id: `thread-extra-${i}`,
      practicePatientLinkId: linkId,
      practiceProfileId: PRACTICE_A,
      patientUserId: U.patientP,
      subject: null,
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
      patientArchivedAt: null,
      practiceArchivedAt: null,
      archivedAt: null,
    });
    messages.push({
      id: `m-extra-${i}`,
      threadId: `thread-extra-${i}`,
      senderType: "practice",
      senderUserId: U.doctorA,
      body: "x",
      clientRequestId: null,
      createdAt: new Date(),
      readAt: null,
    });
  }

  const calls2 = countingPrisma();
  installDirectoryFake();
  const { contexts } = await listPatientPracticeContexts(U.patientP);

  assert.equal(contexts.length, 12, "twelve relationships");
  assert.equal(
    calls2.total,
    withTwo,
    `query count must not grow with the number of practices (was ${withTwo}, now ${calls2.total})`,
  );
  assert.ok(calls2.total <= 3, `bounded at three queries, got ${calls2.total}`);
});

/* ================================================================== */
/* 8f. LINK-SCOPED APPOINTMENTS (Phase 2E.1)                          */
/*                                                                    */
/* A GP appointment must never be reachable in the cardiology context, */
/* and no manipulated identifier may cross the boundary.              */
/* ================================================================== */

const APPT_A = "appt-A";
const APPT_B = "appt-B";
/** @type {any[]} */ let appointments = [];

function installAppointmentFake() {
  appointments = [
    {
      id: APPT_A,
      practiceProfileId: PRACTICE_A,
      practicePatientLinkId: LINK_A,
      patientUserId: U.patientP,
      title: "A_APPOINTMENT_MARKER",
      status: "scheduled",
      startAt: new Date("2026-09-01T09:00:00Z"),
      endAt: new Date("2026-09-01T09:30:00Z"),
    },
    {
      id: APPT_B,
      practiceProfileId: PRACTICE_B,
      practicePatientLinkId: LINK_B,
      patientUserId: U.patientP,
      title: "B_APPOINTMENT_MARKER",
      status: "scheduled",
      startAt: new Date("2026-09-02T09:00:00Z"),
      endAt: new Date("2026-09-02T09:30:00Z"),
    },
    {
      id: "appt-Q",
      practiceProfileId: PRACTICE_A,
      practicePatientLinkId: LINK_Q,
      patientUserId: U.patientQ,
      title: "Q_ONLY",
      status: "scheduled",
      startAt: new Date("2026-09-03T09:00:00Z"),
      endAt: new Date("2026-09-03T09:30:00Z"),
    },
  ];

  prisma.practicePatientLink.findFirst = async ({ where }) => {
    const row = links.find((l) => matches(l, where));
    return row ? { ...row } : null;
  };
  prisma.practiceAppointment = {
    findMany: async ({ where }) =>
      appointments.filter((a) => matches(a, where)).map((a) => ({ ...a, practiceProfile: null, appointmentType: null })),
    findFirst: async ({ where }) => {
      const row = appointments.find((a) => matches(a, where));
      return row ? { ...row, practiceProfile: null, appointmentType: null } : null;
    },
    update: async ({ where, data }) => {
      const row = appointments.find((a) => a.id === where.id);
      Object.assign(row, data);
      return { ...row, practiceProfile: null, appointmentType: null };
    },
    findUnique: async ({ where }) => {
      const row = appointments.find((a) => a.id === where.id);
      return row ? { ...row, practiceProfile: null, appointmentType: null } : null;
    },
  };
  prisma.appointmentReminder = { findMany: async () => [], findUnique: async () => null, findFirst: async () => null, deleteMany: async () => ({ count: 0 }), create: async () => ({}), update: async () => ({}), upsert: async () => ({}) };
}

async function apptService() {
  return import("../services/calendar/appointmentService.js");
}

test("each practice context lists only its own appointments", async () => {
  installAppointmentFake();
  const { listPatientLinkAppointments } = await apptService();

  const a = await listPatientLinkAppointments(U.patientP, LINK_A);
  const b = await listPatientLinkAppointments(U.patientP, LINK_B);

  assert.deepEqual(a.map((x) => x.id), [APPT_A]);
  assert.deepEqual(b.map((x) => x.id), [APPT_B]);
  assert.equal(
    JSON.stringify(a).includes("B_APPOINTMENT_MARKER"),
    false,
    "the GP context must not contain the cardiology appointment",
  );
  assert.equal(JSON.stringify(b).includes("A_APPOINTMENT_MARKER"), false);
});

test("an appointment cannot be fetched through the wrong context", async () => {
  installAppointmentFake();
  const { getPatientLinkAppointment } = await apptService();

  // The id is real and the link is the patient's own — but they do not belong
  // together, which is exactly the manipulation this must refuse.
  await rejects(
    () => getPatientLinkAppointment(U.patientP, LINK_B, APPT_A),
    "appointment_not_found",
    "A's appointment via B's context",
  );
  await rejects(
    () => getPatientLinkAppointment(U.patientP, LINK_A, APPT_B),
    "appointment_not_found",
    "B's appointment via A's context",
  );
});

test("another patient's link yields nothing and is indistinguishable from a missing one", async () => {
  installAppointmentFake();
  const { listPatientLinkAppointments } = await apptService();

  const foreign = await listPatientLinkAppointments(U.patientP, LINK_Q).catch((e) => e.message);
  const missing = await listPatientLinkAppointments(U.patientP, "link-nope").catch((e) => e.message);
  assert.equal(foreign, "link_not_found");
  assert.equal(missing, foreign);
});

test("another patient's appointment is unreachable even with the right link shape", async () => {
  installAppointmentFake();
  const { getPatientLinkAppointment } = await apptService();
  await rejects(
    () => getPatientLinkAppointment(U.patientQ, LINK_A, APPT_A),
    "link_not_found",
    "Q using P's link",
  );
});

test("confirm is refused through the wrong context and changes nothing", async () => {
  installAppointmentFake();
  const { confirmPatientLinkAppointment } = await apptService();

  await rejects(
    () => confirmPatientLinkAppointment(U.patientP, LINK_B, APPT_A),
    "appointment_not_found",
    "confirming A's appointment from B",
  );
  assert.equal(
    appointments.find((a) => a.id === APPT_A).status,
    "scheduled",
    "no write may have happened",
  );
});

test("cancel is refused through the wrong context and changes nothing", async () => {
  installAppointmentFake();
  const { cancelPatientLinkAppointmentRequest } = await apptService();

  await rejects(
    () => cancelPatientLinkAppointmentRequest(U.patientP, LINK_B, APPT_A, {}),
    "appointment_not_found",
    "cancelling A's appointment from B",
  );
  assert.equal(appointments.find((a) => a.id === APPT_A).status, "scheduled");
});

test("the legitimate operations still work in the right context (no rights lost)", async () => {
  installAppointmentFake();
  const { confirmPatientLinkAppointment } = await apptService();

  const result = await confirmPatientLinkAppointment(U.patientP, LINK_A, APPT_A);
  assert.equal(result.status, "confirmed", "the patient keeps the rights they had");
});

test("scoping happens in the query, not by filtering afterwards", async () => {
  installAppointmentFake();
  let sawLinkScope = false;
  const inner = prisma.practiceAppointment.findMany;
  prisma.practiceAppointment.findMany = async (args) => {
    sawLinkScope =
      args?.where?.practicePatientLinkId === LINK_A && args?.where?.patientUserId === U.patientP;
    return inner(args);
  };

  const { listPatientLinkAppointments } = await apptService();
  await listPatientLinkAppointments(U.patientP, LINK_A);

  assert.ok(
    sawLinkScope,
    "the database must be asked for one relationship, never for everything and then filtered",
  );
});

/* ================================================================== */
/* 9b. PRACTICE INBOX CREATE PATH                                     */
/*                                                                    */
/* Regression guard for a pre-existing defect: upsertPracticeInboxItem */
/* called writeAuditLog() without importing it and referenced an       */
/* undefined `pid`, so every NEW practice inbox item threw a           */
/* ReferenceError after the row had already been written. The caller   */
/* saw a failure, no audit entry was recorded, and notify() swallowed  */
/* it silently.                                                       */
/* ================================================================== */

test("creating a practice inbox item succeeds and writes exactly one audit entry", async (t) => {
  const previous = process.env.PRACTICE_INBOX;
  process.env.PRACTICE_INBOX = "true";
  t.after(() => {
    if (previous === undefined) delete process.env.PRACTICE_INBOX;
    else process.env.PRACTICE_INBOX = previous;
  });

  let audits = 0;
  prisma.practiceInboxItem = {
    findFirst: async () => null,
    create: async ({ data }) => ({ id: "inbox-new-1", ...data }),
  };
  prisma.auditLog = {
    create: async ({ data }) => {
      audits += 1;
      // The audit must carry the real practice, not an undefined variable.
      assert.equal(data.practiceProfileId, PRACTICE_A, "audit is scoped to the practice");
      return {};
    },
  };

  const { upsertPracticeInboxItem } = await import(
    "../services/practiceInbox/practiceInboxService.js"
  );

  const item = await upsertPracticeInboxItem({
    practiceProfileId: PRACTICE_A,
    practicePatientLinkId: LINK_A,
    patientUserId: U.patientP,
    type: "message",
    title: "Neue Nachricht",
  });

  assert.equal(item.id, "inbox-new-1", "the caller receives the created item");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(audits, 1, "exactly one audit entry, and no ReferenceError on the way");
});

/* 10. ROUTE-LAYER INVARIANTS                                        */
/*                                                                   */
/* The service tests above cannot see the HTTP layer, so a regression */
/* that re-introduces a side effect in a route handler, or reverts to */
/* a local authorization path, would slip through. These read the     */
/* route sources and assert the shape directly.                       */
/* ================================================================= */

const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "routes");

/**
 * Route source with comments removed.
 *
 * The invariants below are about what the code DOES. Documentation that names
 * a forbidden call ("this used to call markThreadRead") must not trip them, and
 * equally must not be a place to hide one.
 */
function routeSource(file) {
  return readFileSync(join(ROUTES_DIR, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Handler bodies of all `router.get(...)` registrations in a source file. */
function getHandlerBodies(source) {
  const bodies = [];
  // Each registration starts at `router.<verb>(` — a GET body therefore runs
  // until the next registration (or end of file).
  const parts = source.split(/router\.(get|post|patch|put|delete|use)\(/);
  for (let i = 1; i < parts.length; i += 2) {
    if (parts[i] === "get") bodies.push(parts[i + 1]);
  }
  return bodies;
}

test("GET handlers never mutate read state (C-3, route layer)", () => {
  for (const file of ["patientThreads.js", "practicePatientThreads.js"]) {
    const bodies = getHandlerBodies(routeSource(file));
    assert.ok(bodies.length > 0, `${file}: expected at least one GET route`);
    for (const body of bodies) {
      assert.equal(
        /markThreadRead/.test(body),
        false,
        `${file}: a GET handler must not call markThreadRead — read state belongs to PATCH /:threadId/read`,
      );
    }
  }
});

test("both sides expose an explicit read acknowledgement endpoint", () => {
  for (const file of ["patientThreads.js", "practicePatientThreads.js"]) {
    assert.match(
      routeSource(file),
      /router\.patch\(\s*"\/:threadId\/read"/,
      `${file}: explicit read acknowledgement route is missing`,
    );
  }
});

test("the practice route derives its tenant only from the central guard (C-1)", () => {
  const source = routeSource("practicePatientThreads.js");

  assert.match(
    source,
    /requirePracticePatientLinkAccess/,
    "the central link guard must be used",
  );
  assert.equal(
    /req\.query\??\.\s*practiceId|req\.body\??\.\s*practiceId/.test(source),
    false,
    "a client-supplied practiceId must never be read here — the guard derives the tenant from the link",
  );
  assert.equal(
    /getPracticeAccess\(/.test(source),
    false,
    "no local authorization path may coexist with the central guard",
  );
  assert.equal(
    /canReadPracticePatientLinks|canWritePracticePatientLinks|canPracticeRestoreFromArchive/.test(
      source,
    ),
    false,
    "C-5: role-string helpers bypass effective permissions and must not be used here",
  );
});

test("every practice thread route is mounted behind a link guard (C-1)", () => {
  const source = routeSource("practicePatientThreads.js");
  const registrations = source.match(
    /router\.(get|post|patch|delete)\(\s*"[^"]*"\s*,\s*([A-Za-z0-9_]+)/g,
  );
  assert.ok(registrations && registrations.length >= 9, "expected all thread routes to be found");

  const guards = new Set(["readAccess", "writeAccess", "restoreAccess", "aiDraftAccess"]);
  for (const reg of registrations) {
    const guard = reg.slice(reg.lastIndexOf(",") + 1).trim();
    assert.ok(
      guards.has(guard) || guard === "requireCommunicationAiDraftsFeature",
      `route "${reg}" must be guarded, got "${guard}"`,
    );
  }
});

test("AI drafting is gated by its own flag on both sides (decision 5)", () => {
  for (const file of ["patientThreads.js", "practicePatientThreads.js"]) {
    assert.match(
      routeSource(file),
      /requireCommunicationAiDraftsFeature/,
      `${file}: the AI draft route must carry its own feature gate`,
    );
  }
});

test("normalizeRequiredList treats blank entries as 'nothing required', never as satisfied", () => {
  assert.deepEqual(normalizeRequiredList(null), []);
  assert.deepEqual(normalizeRequiredList(""), []);
  assert.deepEqual(normalizeRequiredList("  "), []);
  assert.deepEqual(normalizeRequiredList(["a", "", "  ", "b"]), ["a", "b"]);
  assert.deepEqual(normalizeRequiredList("a"), ["a"]);
});
