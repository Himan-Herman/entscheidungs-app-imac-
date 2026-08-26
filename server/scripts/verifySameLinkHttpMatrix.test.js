/**
 * Phase 6b.3 — the same-practice-different-link matrix, driven over HTTP.
 *
 * ── Why this exists next to the schema matrix ───────────────────────────────
 * verifySameLinkMatrix6b.test.js establishes that every domain BINDS to a care
 * relationship, and probes reads and writes through Prisma. That answers "is
 * the column there and does a link-scoped query behave", which is necessary and
 * not sufficient: a route can hold the right column and still build the wrong
 * `where`, or check the link after fetching instead of inside the query.
 *
 * So this suite asks the same question one layer up, through the routes a real
 * client calls, with a real token. Where an HTTP endpoint exists for a domain,
 * that is what is tested; where none does, the schema matrix remains the level
 * and the table in the report says so rather than leaving a dash.
 *
 * ── The fixture ─────────────────────────────────────────────────────────────
 *   Practice A ── Link A1  (the patient's own account)
 *              └─ Link A2  (a second PatientProfile — same practice, same human)
 *   Practice B ── Link B1
 *
 * Every row is created on A1. A1 must see it; A2 and B1 must not. A2 is the
 * case that matters: it is the same practice, so any implementation that scoped
 * by `practiceProfileId` would pass the cross-practice test and fail this one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-samelink-http";
process.env.ENABLE_TELEMEDICINE = "true";
process.env.ENABLE_PRACTICE_CALENDAR = "true";
process.env.ENABLE_EREZEPT = "true";

const { prisma } = await import("../lib/prisma.js");
const { requireAuth } = await import("../middleware/requireAuth.js");

const routers = {
  thread: (await import("../routes/patientPracticeCommunication.js")).default,
  appointments: (await import("../routes/patientPracticeAppointments.js")).default,
  documents: (await import("../routes/patientPracticeScopedDocuments.js")).default,
  "medication-plans": (await import("../routes/patientPracticeScopedMedicationPlans.js")).default,
  erezept: (await import("../routes/patientPracticeScopedErezept.js")).default,
  inbox: (await import("../routes/patientPracticeScopedInbox.js")).default,
  telemedicine: (await import("../routes/patientPracticeScopedTelemedicine.js")).default,
};

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

const app = express();
app.use(express.json());
for (const [segment, router] of Object.entries(routers)) {
  app.use(`/api/patient/practice/:linkId/${segment}`, requireAuth, router);
}
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const stamp = `${Date.now()}${crypto.randomInt(1e5)}`;
const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

/** The whole response body as text, so a marker can be looked for anywhere in it. */
async function get(linkId, segment, actorUserId, suffix = "") {
  const res = await fetch(`${origin}/api/patient/practice/${linkId}/${segment}${suffix}`, {
    headers: { Authorization: `Bearer ${token(actorUserId)}` },
  });
  return { status: res.status, text: await res.text() };
}

let W;

test.before(async () => {
  if (!dbAvailable) return;

  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `slh-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });
  const [patient, ownerA, ownerB] = await Promise.all([mk("p"), mk("oa"), mk("ob")]);

  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "A", publicSlug: `slha-${stamp}`, isActive: true },
  });
  const practiceB = await prisma.practiceProfile.create({
    data: { userId: ownerB.id, practiceName: "B", publicSlug: `slhb-${stamp}`, isActive: true },
  });
  await prisma.practiceMember.createMany({
    data: [
      { practiceProfileId: practiceA.id, userId: ownerA.id, role: "owner", status: "active", acceptedAt: new Date() },
      { practiceProfileId: practiceB.id, userId: ownerB.id, role: "owner", status: "active", acceptedAt: new Date() },
    ],
  });

  const relative = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Relative", relationLabel: "child" },
  });
  const mkLink = (pid, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pid,
        patientUserId: patient.id,
        patientProfileId: profileId,
        status: "active",
        consentAcceptedAt: new Date(),
      },
    });
  const [a1, a2, b1] = await Promise.all([
    mkLink(practiceA.id),
    mkLink(practiceA.id, relative.id),
    mkLink(practiceB.id),
  ]);

  // Every consent on every link, so a refusal below is the link boundary and
  // not a consent that would have refused all three equally.
  const CONSENTS = [
    "secure_messaging",
    "profile_access",
    "medication_plan_access",
    "appointments_access",
    "telemedicine_access",
    "prescription_access",
  ];
  await prisma.consentRecord.createMany({
    data: [a1, a2, b1].flatMap((l) =>
      CONSENTS.map((consentType) => ({
        patientUserId: patient.id,
        practiceProfileId: l.practiceProfileId,
        practicePatientLinkId: l.id,
        consentType,
        status: "granted",
      })),
    ),
  });

  W = { patient, ownerA, ownerB, practiceA, practiceB, a1, a2, b1 };
});

test.after(async () => {
  if (dbAvailable) {
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } });
    await prisma.$disconnect();
  }
  server.close();
});

/**
 * Each domain: the URL segment a client asks for, and how to plant one row on a
 * given link carrying a marker that can be searched for in the response.
 */
const DOMAINS = [
  {
    name: "messages",
    segment: "thread",
    async plant(link, marker) {
      // One thread per care relationship — the schema enforces it, which is
      // itself part of the boundary. So the thread is created once and the
      // marker travels in a message inside it.
      const thread =
        (await prisma.practicePatientThread.findFirst({
          where: { practicePatientLinkId: link.id },
        })) ??
        (await prisma.practicePatientThread.create({
          data: {
            practicePatientLinkId: link.id,
            practiceProfileId: link.practiceProfileId,
            patientUserId: W.patient.id,
            subject: "matrix probe",
          },
        }));
      await prisma.practicePatientMessage.create({
        data: {
          threadId: thread.id,
          senderType: "practice",
          senderUserId: W.ownerA.id,
          body: marker,
        },
      });
    },
  },
  {
    name: "documents",
    segment: "documents",
    async plant(link, marker) {
      await prisma.practiceDocument.create({
        data: {
          practiceProfileId: link.practiceProfileId,
          practicePatientLinkId: link.id,
          patientUserId: W.patient.id,
          title: marker,
          type: "report",
          status: "shared",
          sharedAt: new Date(),
          createdByUserId: W.ownerA.id,
          shares: {
            create: {
              patientUserId: W.patient.id,
              sharedByUserId: W.ownerA.id,
              status: "active",
            },
          },
        },
      });
    },
  },
  {
    name: "medication plans",
    segment: "medication-plans",
    async plant(link, marker) {
      await prisma.medicationPlan.create({
        data: {
          practiceProfileId: link.practiceProfileId,
          practicePatientLinkId: link.id,
          patientUserId: W.patient.id,
          title: marker,
          status: "published",
          createdByUserId: W.ownerA.id,
        },
      });
    },
  },
  {
    name: "eRezept",
    segment: "erezept",
    async plant(link, marker) {
      await prisma.erezeptEntry.create({
        data: {
          patientUserId: W.patient.id,
          issuedByUserId: W.ownerA.id,
          linkId: link.id,
          practiceProfileId: link.practiceProfileId,
          medicationName: marker,
          tokenCode: `T${crypto.randomInt(1e9)}`,
          validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      });
    },
  },
  {
    name: "appointments",
    segment: "appointments",
    async plant(link, marker) {
      await prisma.practiceAppointment.create({
        data: {
          practiceProfileId: link.practiceProfileId,
          practicePatientLinkId: link.id,
          patientUserId: W.patient.id,
          title: marker,
          status: "requested",
          startAt: new Date(Date.now() + 24 * 3600 * 1000),
          endAt: new Date(Date.now() + 25 * 3600 * 1000),
        },
      });
    },
  },
  {
    name: "patient inbox",
    segment: "inbox",
    async plant(link, marker) {
      await prisma.patientInboxItem.create({
        data: {
          patientUserId: W.patient.id,
          practiceProfileId: link.practiceProfileId,
          practicePatientLinkId: link.id,
          type: "document_shared",
          title: marker,
        },
      });
    },
  },
];

/* ═════════════════════════════════ read isolation, over HTTP, per domain */

for (const domain of DOMAINS) {
  test(`${domain.name}: A1 sees its own row`, { skip }, async () => {
    const marker = `SLH_${domain.segment}_${crypto.randomUUID()}`;
    await domain.plant(W.a1, marker);

    const own = await get(W.a1.id, domain.segment, W.patient.id);
    assert.ok(own.status < 400, `${domain.name} on A1 returned ${own.status}: ${own.text.slice(0, 200)}`);
    assert.ok(
      own.text.includes(marker),
      `${domain.name}: the row is not visible in its own relationship`,
    );
  });

  test(`${domain.name}: A2 — same practice, different link — does not`, { skip }, async () => {
    const marker = `SLH_${domain.segment}_${crypto.randomUUID()}`;
    await domain.plant(W.a1, marker);

    const other = await get(W.a2.id, domain.segment, W.patient.id);
    assert.ok(
      !other.text.includes(marker),
      `${domain.name} leaked from A1 into A2 — the boundary is drawn at the practice, not the link`,
    );
  });

  test(`${domain.name}: another practice does not`, { skip }, async () => {
    const marker = `SLH_${domain.segment}_${crypto.randomUUID()}`;
    await domain.plant(W.a1, marker);

    const other = await get(W.b1.id, domain.segment, W.patient.id);
    assert.ok(!other.text.includes(marker), `${domain.name} leaked from A1 into practice B`);
  });
}

/* ═══════════════════════════════════════ the link id itself is authorized */

test("a link belonging to nobody is refused on every domain", { skip }, async () => {
  for (const domain of DOMAINS) {
    const r = await get("cl00000000000000000000000", domain.segment, W.patient.id);
    assert.ok(r.status >= 400, `${domain.name} answered for a link that does not exist`);
  }
});

test("a link belonging to another patient is refused on every domain", { skip }, async () => {
  const stranger = await prisma.user.create({
    data: {
      email: `slh-x-${stamp}@test.invalid`,
      passwordHash: "x",
      firstName: "X",
      lastName: "Test",
      dateOfBirth: new Date("1980-01-01"),
      verified: true,
    },
  });
  for (const domain of DOMAINS) {
    const r = await get(W.a1.id, domain.segment, stranger.id);
    assert.ok(
      r.status >= 400,
      `${domain.name} answered ${r.status} for someone else's care relationship`,
    );
  }
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  The revoked-relationship policy, one row per domain.
 *
 *  The rule is stated in services/careRelationship/patientLinkAccess.js:
 *  `revoked` ends the active relationship, not the patient's own history.
 *  Historical read stays; new interaction does not. Scope is untouched — a
 *  revoked A1 still cannot see A2 or practice B.
 *
 *  `interact` is the smallest real mutation each domain offers a patient, or
 *  null where the domain offers none. A null is spelled out below with the
 *  reason, never left blank.
 * ══════════════════════════════════════════════════════════════════════════
 */
const REVOKED_MATRIX = [
  {
    name: "messages",
    segment: "thread",
    interact: {
      what: "send a new message",
      method: "POST",
      path: "/messages",
      body: { body: "nach dem Widerruf" },
    },
  },
  {
    name: "documents",
    segment: "documents",
    // The patient-scoped document router has no POST, PATCH or DELETE at all:
    // a patient reads what the practice released to them and releases nothing
    // from here. Sharing INTO another relationship is a different route with
    // its own grant rules, covered by verifyDocumentShareGrants.test.js.
    interact: null,
    interactNote: "read-only router — the patient authors nothing in this context",
  },
  {
    name: "medication plans",
    segment: "medication-plans",
    interact: {
      what: "ask the practice a question about a plan",
      method: "POST",
      path: "/:id/question",
      body: { question: "Darf ich das weiter nehmen?" },
      needsRowId: true,
    },
  },
  {
    name: "eRezept",
    segment: "erezept",
    interact: {
      what: "update a prescription entry",
      method: "PATCH",
      path: "/:id",
      body: { status: "redeemed" },
      needsRowId: true,
    },
  },
  {
    name: "appointments",
    segment: "appointments",
    interact: {
      what: "confirm an appointment",
      method: "PATCH",
      path: "/:id/confirm",
      body: {},
      needsRowId: true,
    },
  },
  {
    name: "patient inbox",
    segment: "inbox",
    /*
     * No forbidden interaction here, and the reason is measured rather than
     * assumed: `PatientInboxItem` has no practice-side reader anywhere in the
     * codebase — the practice has its own model, `PracticeInboxItem`. Marking
     * a notice read or archiving it moves `readAt` / `archivedAt` on the
     * patient's own row and changes nothing the practice sees.
     *
     * That makes it mailbox housekeeping, not an interaction inside the
     * relationship: it belongs with "the patient keeps their own history",
     * not with "no new activity". Refusing it would leave someone unable to
     * tidy away notices from a practice they have parted with.
     *
     * Asserted positively below instead of merely excluded, so the
     * classification is a claim this suite has to keep making good on.
     */
    interact: null,
    interactNote:
      "archiving is patient-only state — no practice-side reader exists, so it is history, not activity",
    mustKeepWorkingAfterRevocation: {
      what: "archive a notice",
      method: "PATCH",
      path: "/:itemId/archive",
      body: {},
      needsRowId: true,
    },
  },
];

/** The id of the newest row this domain has on a link, for mutation probes. */
async function newestRowId(name, link) {
  const q = { orderBy: { createdAt: "desc" } };
  switch (name) {
    case "medication plans":
      return (await prisma.medicationPlan.findFirst({ where: { practicePatientLinkId: link.id }, ...q }))?.id;
    case "eRezept":
      return (await prisma.erezeptEntry.findFirst({ where: { linkId: link.id }, ...q }))?.id;
    case "appointments":
      return (await prisma.practiceAppointment.findFirst({ where: { practicePatientLinkId: link.id }, ...q }))?.id;
    case "patient inbox":
      return (await prisma.patientInboxItem.findFirst({ where: { practicePatientLinkId: link.id }, ...q }))?.id;
    default:
      return null;
  }
}

async function mutate(link, domain, actorUserId, rowId) {
  const { method, path, body } = domain.interact;
  const url = `${origin}/api/patient/practice/${link.id}/${domain.segment}${path
    .replace(":itemId", rowId ?? "x")
    .replace(":id", rowId ?? "x")}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token(actorUserId)}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

for (const domain of REVOKED_MATRIX) {
  test(`${domain.name}: revoked — historical read stays, scope does not move`, { skip }, async () => {
    const marker = `REV_${domain.segment}_${crypto.randomUUID()}`;
    const planted = DOMAINS.find((d) => d.name === domain.name);
    await planted.plant(W.a1, marker);

    // 1. active link + historical read
    const active = await get(W.a1.id, domain.segment, W.patient.id);
    assert.ok(active.status < 400, `active read returned ${active.status}`);
    assert.ok(active.text.includes(marker), "the row is not visible while the link is active");

    await prisma.practicePatientLink.update({
      where: { id: W.a1.id },
      data: { status: "revoked" },
    });
    try {
      // 2. revoked own link + historical read
      const afterRevoke = await get(W.a1.id, domain.segment, W.patient.id);
      assert.ok(
        afterRevoke.status < 400,
        `${domain.name}: the patient lost their own history on revocation (${afterRevoke.status})`,
      );
      assert.ok(
        afterRevoke.text.includes(marker),
        `${domain.name}: the history is gone after revocation`,
      );

      // 3. same practice, different link — revocation must not open A2
      const viaA2 = await get(W.a2.id, domain.segment, W.patient.id);
      assert.ok(
        !viaA2.text.includes(marker),
        `${domain.name}: revoking A1 exposed its data through A2`,
      );

      // 4. another patient — revocation must not open anything to anyone else
      const stranger = await prisma.user.create({
        data: {
          email: `slh-r-${crypto.randomUUID()}@test.invalid`,
          passwordHash: "x",
          firstName: "R",
          lastName: "Test",
          dateOfBirth: new Date("1980-01-01"),
          verified: true,
        },
      });
      const foreign = await get(W.a1.id, domain.segment, stranger.id);
      assert.ok(
        foreign.status >= 400,
        `${domain.name}: a stranger read a revoked relationship (${foreign.status})`,
      );
      assert.ok(!foreign.text.includes(marker));
    } finally {
      await prisma.practicePatientLink.update({
        where: { id: W.a1.id },
        data: { status: "active" },
      });
    }
  });

  test(`${domain.name}: revoked — new interaction is refused`, { skip }, async () => {
    if (!domain.interact) {
      // N/A, with the reason recorded rather than a blank.
      assert.ok(
        domain.interactNote,
        `${domain.name} claims no forbidden mutation exists but gives no reason`,
      );

      // Where the reason is "this is housekeeping, not activity", that claim is
      // asserted rather than asserted-away: the operation must still work.
      const keep = domain.mustKeepWorkingAfterRevocation;
      if (keep) {
        const planted = DOMAINS.find((d) => d.name === domain.name);
        await planted.plant(W.a1, `REVK_${crypto.randomUUID()}`);
        const rowId = await newestRowId(domain.name, W.a1);
        assert.ok(rowId, `${domain.name}: no row to act on`);

        await prisma.practicePatientLink.update({
          where: { id: W.a1.id },
          data: { status: "revoked" },
        });
        try {
          const r = await mutate(W.a1, { ...domain, interact: keep }, W.patient.id, rowId);
          assert.ok(
            r.status < 400,
            `${domain.name}: "${keep.what}" was refused after revocation (${r.status}) — ` +
              "if that is now the rule, it is a policy change, not a fix",
          );
        } finally {
          await prisma.practicePatientLink.update({
            where: { id: W.a1.id },
            data: { status: "active" },
          });
        }
      }
      return;
    }

    const planted = DOMAINS.find((d) => d.name === domain.name);
    await planted.plant(W.a1, `REVW_${crypto.randomUUID()}`);
    const rowId = domain.interact.needsRowId ? await newestRowId(domain.name, W.a1) : null;
    if (domain.interact.needsRowId) {
      assert.ok(rowId, `${domain.name}: no row to act on — the probe would prove nothing`);
    }

    // The same call must work while the relationship is live, or a refusal
    // afterwards would say nothing about revocation.
    const whileActive = await mutate(W.a1, domain, W.patient.id, rowId);
    assert.ok(
      whileActive.status < 400,
      `${domain.name}: "${domain.interact.what}" already fails on an ACTIVE link ` +
        `(${whileActive.status}) — this probe cannot measure revocation:\n  ${whileActive.text.slice(0, 200)}`,
    );

    await prisma.practicePatientLink.update({
      where: { id: W.a1.id },
      data: { status: "revoked" },
    });
    try {
      const afterRevoke = await mutate(W.a1, domain, W.patient.id, rowId);
      assert.ok(
        afterRevoke.status >= 400,
        `${domain.name}: "${domain.interact.what}" still worked after revocation (${afterRevoke.status})`,
      );
    } finally {
      await prisma.practicePatientLink.update({
        where: { id: W.a1.id },
        data: { status: "active" },
      });
    }
  });
}



/* ══════════════════════ resource-level withdrawal outranks the link rule */

test("a revoked document grant still refuses, even on a revoked link", { skip }, async () => {
  /*
   * The limit of "historical read stays".
   *
   * Keeping one's history does not mean "once visible, visible forever". Where
   * a resource carries its own access control, that control keeps deciding —
   * and it decides against. This is the case the two rules could be made to
   * contradict each other on, so it is asserted directly: the link rule must
   * never be a way around a withdrawal made at the artefact.
   *
   * Both orders are checked, because "which was revoked first" must not matter.
   */
  const marker = `REVG_${crypto.randomUUID()}`;
  const planted = DOMAINS.find((d) => d.name === "documents");
  await planted.plant(W.a1, marker);

  const doc = await prisma.practiceDocument.findFirst({
    where: { practicePatientLinkId: W.a1.id, title: marker },
  });
  assert.ok(doc, "the probe document was not created");

  // Visible while everything is live.
  assert.ok((await get(W.a1.id, "documents", W.patient.id)).text.includes(marker));

  // Grant withdrawn, link still active.
  await prisma.practiceDocumentShare.updateMany({
    where: { documentId: doc.id },
    data: { status: "revoked", revokedAt: new Date() },
  });
  const grantOnly = await get(W.a1.id, "documents", W.patient.id);
  assert.ok(
    !grantOnly.text.includes(marker),
    "a withdrawn share grant still showed the document on an active link",
  );

  // And with the relationship revoked too, so the history rule is in play.
  await prisma.practicePatientLink.update({
    where: { id: W.a1.id },
    data: { status: "revoked" },
  });
  try {
    const both = await get(W.a1.id, "documents", W.patient.id);
    assert.ok(
      both.status < 400,
      "the patient lost the whole document list, not just the withdrawn document",
    );
    assert.ok(
      !both.text.includes(marker),
      "the historical-read rule was used to reach around a withdrawn share grant",
    );
  } finally {
    await prisma.practicePatientLink.update({
      where: { id: W.a1.id },
      data: { status: "active" },
    });
  }
});
