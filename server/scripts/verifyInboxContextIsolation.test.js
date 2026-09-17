/**
 * Inbox notices inside ONE practice context (Phase 2G.1).
 *
 * `PatientInboxItem.practicePatientLinkId` is NULLABLE. That makes the inbox
 * different from every artifact migrated so far: some notices name a care
 * relationship, others name only a practice. The second kind must NOT be pulled
 * into a context — a notice shown under the wrong relationship is worse than one
 * the patient has to find in the cross-practice list.
 *
 * Runs against the REAL database. Skips when none is reachable.
 *
 * Run: node --test scripts/verifyInboxContextIsolation.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  archivePatientLinkInboxItem,
  countPatientLinkInboxUnread,
  listPatientLinkInboxItems,
  markPatientLinkInboxItemRead,
  restorePatientLinkInboxItem,
} from "../services/patientInbox/patientInboxContextService.js";

const SUFFIX = "inbox-context@test.invalid";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/**
 * Patient P: link A and link A2 (same practice A, different profile), link B.
 * Patient Q: link Q at practice A.
 *
 *   A_INBOX_MARKER      -> link A, type message
 *   A_DOC_MARKER        -> link A, type document   (a second real kind)
 *   A2_INBOX_MARKER     -> link A2
 *   B_INBOX_MARKER      -> link B
 *   Q_INBOX_MARKER      -> link Q, patient Q
 *   A_PRACTICE_ONLY     -> practice A, NO link      (ambiguous scope)
 *   A_ARCHIVED_MARKER   -> link A, archived
 */
async function buildFixture() {
  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `${tag}-${Date.now()}-${Math.round(Math.random() * 1e6)}-${SUFFIX}`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });

  const patient = await mk("p");
  const other = await mk("q");
  const ownerA = await mk("oa");
  const ownerB = await mk("ob");

  const practice = (owner, name) =>
    prisma.practiceProfile.create({
      data: {
        userId: owner.id,
        practiceName: name,
        publicSlug: `${name}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      },
    });
  const practiceA = await practice(ownerA, "PraxisA");
  const practiceB = await practice(ownerB, "PraxisB");

  const profile = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Angehoerige", relationLabel: "child" },
  });

  const link = (pr, pat, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pr.id,
        patientUserId: pat.id,
        patientProfileId: profileId,
        status: "active",
        consentScopes: ["messages"],
        consentAcceptedAt: new Date(),
      },
    });
  const linkA = await link(practiceA, patient);
  const linkA2 = await link(practiceA, patient, profile.id);
  const linkB = await link(practiceB, patient);
  const linkQ = await link(practiceA, other);

  let seq = 0;
  const item = (opts) =>
    prisma.patientInboxItem.create({
      data: {
        patientUserId: opts.patientUserId,
        practiceProfileId: opts.practiceProfileId ?? null,
        practicePatientLinkId: opts.linkId ?? null,
        type: opts.type ?? "message",
        title: opts.title,
        titleKey: opts.type ?? "message",
        status: opts.status ?? "unread",
        sourceRefType: opts.sourceRefType ?? "patient_thread",
        sourceRefId: `src-${Date.now()}-${seq}`,
        dedupeKey: `dk-${Date.now()}-${Math.round(Math.random() * 1e9)}-${seq++}`,
        lastActivityAt: new Date(Date.now() - seq * 1000),
      },
    });

  const aItem = await item({ patientUserId: patient.id, practiceProfileId: practiceA.id, linkId: linkA.id, title: "A_INBOX_MARKER" });
  const aDoc = await item({ patientUserId: patient.id, practiceProfileId: practiceA.id, linkId: linkA.id, title: "A_DOC_MARKER", type: "document", sourceRefType: "practice_document" });
  const a2Item = await item({ patientUserId: patient.id, practiceProfileId: practiceA.id, linkId: linkA2.id, title: "A2_INBOX_MARKER" });
  const bItem = await item({ patientUserId: patient.id, practiceProfileId: practiceB.id, linkId: linkB.id, title: "B_INBOX_MARKER" });
  const qItem = await item({ patientUserId: other.id, practiceProfileId: practiceA.id, linkId: linkQ.id, title: "Q_INBOX_MARKER" });
  const practiceOnly = await item({ patientUserId: patient.id, practiceProfileId: practiceA.id, linkId: null, title: "A_PRACTICE_ONLY", type: "system", sourceRefType: "appointment" });
  const archived = await item({ patientUserId: patient.id, practiceProfileId: practiceA.id, linkId: linkA.id, title: "A_ARCHIVED_MARKER", status: "archived" });

  return {
    patient, other, practiceA, practiceB, linkA, linkA2, linkB, linkQ,
    aItem, aDoc, a2Item, bItem, qItem, practiceOnly, archived, item,
  };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

const titles = (r) => r.items.map((i) => i.title).sort();

/* ================================================ Same patient, two links */

test("each context shows only its own notices", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  assert.deepEqual(
    titles(await listPatientLinkInboxItems(f.linkA.id, f.patient.id)),
    ["A_DOC_MARKER", "A_INBOX_MARKER"],
  );
  assert.deepEqual(
    titles(await listPatientLinkInboxItems(f.linkB.id, f.patient.id)),
    ["B_INBOX_MARKER"],
  );
});

test("owning the account is not enough to see a notice", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // Every one of these has patientUserId === P. Only the link differs.
  await assert.rejects(
    () => markPatientLinkInboxItemRead(f.linkB.id, f.aItem.id, f.patient.id),
    /item_not_found/,
  );
});

/* ======================================= Same practice, different link */

test("a second link to the same practice is a separate context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  assert.equal(f.linkA.practiceProfileId, f.linkA2.practiceProfileId, "precondition");

  assert.equal(
    titles(await listPatientLinkInboxItems(f.linkA.id, f.patient.id)).includes("A2_INBOX_MARKER"),
    false,
  );
  assert.deepEqual(
    titles(await listPatientLinkInboxItems(f.linkA2.id, f.patient.id)),
    ["A2_INBOX_MARKER"],
  );
  await assert.rejects(
    () => markPatientLinkInboxItemRead(f.linkA2.id, f.aItem.id, f.patient.id),
    /item_not_found/,
  );
});

/* ================================== The ambiguous scope (nullable link) */

test("a notice that names only a practice is not pulled into a context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // It belongs to practice A and to the same patient — everything except a
  // relationship. Scoping by practice would sweep it into link A's context and
  // possibly attribute it to the wrong relationship.
  const raw = await prisma.patientInboxItem.findUnique({ where: { id: f.practiceOnly.id } });
  assert.equal(raw.practiceProfileId, f.practiceA.id);
  assert.equal(raw.practicePatientLinkId, null, "precondition: no relationship");

  for (const link of [f.linkA, f.linkA2, f.linkB]) {
    const list = await listPatientLinkInboxItems(link.id, f.patient.id);
    assert.equal(titles(list).includes("A_PRACTICE_ONLY"), false, "no context may claim it");
  }
  await assert.rejects(
    () => markPatientLinkInboxItemRead(f.linkA.id, f.practiceOnly.id, f.patient.id),
    /item_not_found/,
  );
});

/* ============================================================ Cross-patient */

test("another patient's link and notice are unreachable", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => listPatientLinkInboxItems(f.linkQ.id, f.patient.id),
    /link_not_found/,
  );
  for (const op of [markPatientLinkInboxItemRead, archivePatientLinkInboxItem, restorePatientLinkInboxItem]) {
    await assert.rejects(() => op(f.linkA.id, f.qItem.id, f.patient.id), /item_not_found/);
  }

  const untouched = await prisma.patientInboxItem.findUnique({ where: { id: f.qItem.id } });
  assert.equal(untouched.status, "unread", "nothing of Q's changed");
});

test("a foreign link and a missing link are indistinguishable", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const foreign = await listPatientLinkInboxItems(f.linkQ.id, f.patient.id).catch((e) => e.message);
  const missing = await listPatientLinkInboxItems("clfakefakefake", f.patient.id).catch((e) => e.message);
  assert.equal(foreign, "link_not_found");
  assert.equal(missing, foreign);
});

/* ================================================================ Deep links */

test("a notice leads into its own context, never another", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const { items } = await listPatientLinkInboxItems(f.linkA.id, f.patient.id);
  const message = items.find((i) => i.title === "A_INBOX_MARKER");
  const document = items.find((i) => i.title === "A_DOC_MARKER");

  assert.equal(message.targetPath, `/patient/practice/${f.linkA.id}/messages`);
  assert.equal(document.targetPath, `/patient/practice/${f.linkA.id}/documents`);

  // Built from the AUTHORIZED link, so nothing can point at another context.
  for (const item of items) {
    if (!item.targetPath) continue;
    assert.ok(item.targetPath.includes(f.linkA.id));
    assert.equal(item.targetPath.includes(f.linkB.id), false);
    assert.equal(item.targetPath.includes(f.linkA2.id), false);
  }
});

test("a kind with no scoped page gets no destination rather than a guess", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await f.item({
    patientUserId: f.patient.id,
    practiceProfileId: f.practiceA.id,
    linkId: f.linkA.id,
    title: "A_DATA_REQUEST",
    type: "data_request",
    sourceRefType: "data_request",
  });

  const { items } = await listPatientLinkInboxItems(f.linkA.id, f.patient.id);
  const dataRequest = items.find((i) => i.title === "A_DATA_REQUEST");
  assert.equal(dataRequest.targetPath, null, "inventing a destination would be worse than none");
});

test("the stored targetUrl never reaches the client", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // Those were written before practice contexts existed: patient-global paths
  // with no link in them, one of which no longer matches any route.
  await prisma.patientInboxItem.update({
    where: { id: f.aItem.id },
    data: { targetUrl: "/patient/messages/some-thread" },
  });

  const { items } = await listPatientLinkInboxItems(f.linkA.id, f.patient.id);
  const serialized = JSON.stringify(items);
  assert.equal(serialized.includes("/patient/messages/some-thread"), false);
  assert.equal(serialized.includes("targetUrl"), false);
});

/* ============================================================== Privacy */

test("no internal identifier travels to the client", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const { items } = await listPatientLinkInboxItems(f.linkA.id, f.patient.id);
  for (const key of [
    "patientUserId",
    "practiceProfileId",
    "practicePatientLinkId",
    "sourceRefId",
    "dedupeKey",
    "practice",
  ]) {
    assert.equal(key in items[0], false, `${key} must not travel to the context page`);
  }
  // Order-independent: the point is that the notice survived the minimisation,
  // not which of the two comes first.
  assert.deepEqual(
    items.map((i) => i.title).sort(),
    ["A_DOC_MARKER", "A_INBOX_MARKER"],
    "but the notices themselves are intact",
  );
});

/* =========================================================== Read state */

test("listing never marks anything read", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await listPatientLinkInboxItems(f.linkA.id, f.patient.id);
  await listPatientLinkInboxItems(f.linkA.id, f.patient.id);

  const row = await prisma.patientInboxItem.findUnique({ where: { id: f.aItem.id } });
  assert.equal(row.status, "unread", "acknowledgement is explicit, as it always was");
  assert.equal(row.readAt, null);
});

test("read, archive and restore each stay inside the context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const read = await markPatientLinkInboxItemRead(f.linkA.id, f.aItem.id, f.patient.id);
  assert.equal(read.status, "read");

  const archived = await archivePatientLinkInboxItem(f.linkA.id, f.aItem.id, f.patient.id);
  assert.equal(archived.status, "archived");

  // Archived items drop out of the default list but remain reachable by filter.
  assert.equal(
    titles(await listPatientLinkInboxItems(f.linkA.id, f.patient.id)).includes("A_INBOX_MARKER"),
    false,
  );
  assert.ok(
    titles(await listPatientLinkInboxItems(f.linkA.id, f.patient.id, { status: "archived" }))
      .includes("A_INBOX_MARKER"),
  );

  const restored = await restorePatientLinkInboxItem(f.linkA.id, f.aItem.id, f.patient.id);
  assert.equal(restored.status, "read", "restoring returns it to what it was, not to unread");

  // Practice B's notice was not touched by any of that.
  const b = await prisma.patientInboxItem.findUnique({ where: { id: f.bItem.id } });
  assert.equal(b.status, "unread");
});

test("the unread count is scoped to its own relationship", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  assert.equal(await countPatientLinkInboxUnread(f.linkA.id, f.patient.id), 2);
  assert.equal(await countPatientLinkInboxUnread(f.linkA2.id, f.patient.id), 1);
  assert.equal(await countPatientLinkInboxUnread(f.linkB.id, f.patient.id), 1);

  await markPatientLinkInboxItemRead(f.linkA.id, f.aItem.id, f.patient.id);
  assert.equal(await countPatientLinkInboxUnread(f.linkA.id, f.patient.id), 1);
  assert.equal(await countPatientLinkInboxUnread(f.linkA2.id, f.patient.id), 1, "unchanged next door");
});

/* ============================================================== Ordering */

test("two notices from the same moment keep a stable order", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const at = new Date();
  await prisma.patientInboxItem.updateMany({
    where: { practicePatientLinkId: f.linkA.id, status: "unread" },
    data: { lastActivityAt: at, createdAt: at },
  });

  const first = titles(await listPatientLinkInboxItems(f.linkA.id, f.patient.id));
  const second = titles(await listPatientLinkInboxItems(f.linkA.id, f.patient.id));
  const firstOrder = (await listPatientLinkInboxItems(f.linkA.id, f.patient.id)).items.map((i) => i.id);
  const secondOrder = (await listPatientLinkInboxItems(f.linkA.id, f.patient.id)).items.map((i) => i.id);

  assert.deepEqual(first, second);
  assert.deepEqual(firstOrder, secondOrder, "identical timestamps must not leave order to the database");
});

/* ============================================================ Performance */

test("listing a context costs the same for a few notices or many", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const wrapped = [];
  const count = { n: 0 };
  for (const model of ["practicePatientLink", "patientInboxItem"]) {
    for (const op of ["findFirst", "findMany", "findUnique", "count"]) {
      const original = prisma[model][op];
      if (typeof original !== "function") continue;
      wrapped.push([model, op, original]);
      prisma[model][op] = (...a) => {
        count.n += 1;
        return original.apply(prisma[model], a);
      };
    }
  }
  t.after(() => wrapped.forEach(([m, o, fn]) => { prisma[m][o] = fn; }));

  await listPatientLinkInboxItems(f.linkA.id, f.patient.id);
  const withTwo = count.n;

  for (let i = 0; i < 20; i += 1) {
    await f.item({
      patientUserId: f.patient.id,
      practiceProfileId: f.practiceA.id,
      linkId: f.linkA.id,
      title: `BULK_${i}`,
    });
  }

  count.n = 0;
  const many = await listPatientLinkInboxItems(f.linkA.id, f.patient.id);

  assert.equal(many.items.length, 22, "the extra notices are actually listed");
  assert.equal(count.n, withTwo, `query count must not grow with the item count (was ${withTwo}, now ${count.n})`);
  assert.ok(count.n <= 3, `bounded at three queries, got ${count.n}`);
});

test("paging is bounded and stays inside the context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  for (let i = 0; i < 5; i += 1) {
    await f.item({
      patientUserId: f.patient.id,
      practiceProfileId: f.practiceA.id,
      linkId: f.linkA.id,
      title: `PAGE_${i}`,
    });
  }

  const page = await listPatientLinkInboxItems(f.linkA.id, f.patient.id, { limit: 3 });
  assert.equal(page.items.length, 3);
  assert.equal(page.total, 7, "the total counts this context only");
  assert.equal(page.limit, 3);

  const huge = await listPatientLinkInboxItems(f.linkA.id, f.patient.id, { limit: 5000 });
  assert.equal(huge.limit, 100, "an unbounded request is capped");
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  assert.equal(await prisma.user.count({ where: { email: { contains: SUFFIX } } }), 0);
});
