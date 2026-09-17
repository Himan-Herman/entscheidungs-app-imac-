/**
 * Document visibility inside ONE practice context (Phase 2E.2).
 *
 * The invariant: a document appears in a practice context only when it is
 * DIRECT (this link's own, released to the patient) or SHARED (an effective
 * PracticeDocumentShareGrant into exactly this link). Nothing else — not a
 * document of another link, not a revoked grant, not another patient's
 * document, and never merely because the same person owns both.
 *
 * Runs against the REAL database, because the rules live in a Prisma `where`
 * clause: only Postgres can prove that the clause excludes what it must.
 * Skips (does not fail) when no database is reachable.
 *
 * Run: node --test scripts/verifyDocumentContextIsolation.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  getPatientLinkDocument,
  getPatientLinkDocumentFile,
  listPatientLinkDocuments,
} from "../services/practiceDocument/practiceDocumentService.js";

const SUFFIX = "doc-context@test.invalid";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/**
 * Patient P linked to practice A and practice B, plus an unrelated patient Q.
 *
 *   A_DIRECT      direct on link A, released to P
 *   B_DIRECT      direct on link B, released to P
 *   A_SHARED_TO_B direct on A, released to P, and granted into link B
 *   A_PRIVATE     direct on A, released to P, no grant
 *   A_DRAFT       direct on A, NOT released to P
 *   Q_DOC         another patient entirely
 */
async function buildFixture() {
  const mk = async (tag, first) =>
    prisma.user.create({
      data: {
        email: `${tag}-${Date.now()}-${Math.round(Math.random() * 1e6)}-${SUFFIX}`,
        passwordHash: "x",
        firstName: first,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });

  const patient = await mk("p", "Patient");
  const other = await mk("q", "Other");
  const ownerA = await mk("oa", "OwnerA");
  const ownerB = await mk("ob", "OwnerB");
  const ownerC = await mk("oc", "OwnerC");

  const practice = async (owner, name) =>
    prisma.practiceProfile.create({
      data: {
        userId: owner.id,
        practiceName: name,
        publicSlug: `${name}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      },
    });
  const practiceA = await practice(ownerA, "PraxisA");
  const practiceB = await practice(ownerB, "PraxisB");
  const practiceC = await practice(ownerC, "PraxisC");

  const link = async (pr, pat) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pr.id,
        patientUserId: pat.id,
        status: "active",
        consentScopes: ["documents"],
        consentAcceptedAt: new Date(),
      },
    });
  const linkA = await link(practiceA, patient);
  const linkB = await link(practiceB, patient);
  const linkC = await link(practiceC, patient);
  const linkQ = await link(practiceA, other);

  /** Creates a document and, when released, the patient-facing share. */
  const doc = async (pr, lnk, pat, title, released = true) => {
    const row = await prisma.practiceDocument.create({
      data: {
        practiceProfileId: pr.id,
        practicePatientLinkId: lnk.id,
        patientUserId: pat.id,
        title,
        type: "report",
        status: released ? "shared" : "draft",
        sharedAt: released ? new Date() : null,
      },
    });
    await prisma.practiceDocumentFile.create({
      data: {
        documentId: row.id,
        originalFileName: `${title}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 10,
        storageKey: `test/${row.id}`,
      },
    });
    if (released) {
      await prisma.practiceDocumentShare.create({
        data: {
          documentId: row.id,
          patientUserId: pat.id,
          status: "active",
          sharedAt: new Date(),
        },
      });
    }
    return row;
  };

  const aDirect = await doc(practiceA, linkA, patient, "A_DIRECT");
  const bDirect = await doc(practiceB, linkB, patient, "B_DIRECT");
  const aSharedToB = await doc(practiceA, linkA, patient, "A_SHARED_TO_B");
  const aPrivate = await doc(practiceA, linkA, patient, "A_PRIVATE");
  // Same patient, same source practice, active grant — but aimed at a THIRD
  // context. It must stay invisible in B: a grant is only ever valid for the
  // one link it names, never for "any link of this patient".
  const aSharedToC = await doc(practiceA, linkA, patient, "A_SHARED_TO_C");
  const aDraft = await doc(practiceA, linkA, patient, "A_DRAFT", false);
  const qDoc = await doc(practiceA, linkQ, other, "Q_DOC");

  const grant = await prisma.practiceDocumentShareGrant.create({
    data: {
      documentId: aSharedToB.id,
      patientUserId: patient.id,
      sourcePracticeProfileId: practiceA.id,
      sourcePracticePatientLinkId: linkA.id,
      targetPracticeProfileId: practiceB.id,
      targetPracticePatientLinkId: linkB.id,
      status: "active",
      grantedByUserId: patient.id,
      grantedAt: new Date(),
    },
  });

  await prisma.practiceDocumentShareGrant.create({
    data: {
      documentId: aSharedToC.id,
      patientUserId: patient.id,
      sourcePracticeProfileId: practiceA.id,
      sourcePracticePatientLinkId: linkA.id,
      targetPracticeProfileId: practiceC.id,
      targetPracticePatientLinkId: linkC.id,
      status: "active",
      grantedByUserId: patient.id,
      grantedAt: new Date(),
    },
  });

  return {
    patient, other, linkA, linkB, linkC, linkQ,
    aDirect, bDirect, aSharedToB, aSharedToC, aPrivate, aDraft, qDoc, grant,
  };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  // Grants use onDelete: Restrict, so they go first.
  await prisma.practiceDocumentShareGrant.deleteMany({ where: { patientUserId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

const titles = (docs) => docs.map((d) => d.title).sort();

/* ============================================ Direct + Shared visibility */

test("context A shows its own documents and not practice B's", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const list = await listPatientLinkDocuments(f.linkA.id, f.patient.id);
  assert.deepEqual(titles(list), ["A_DIRECT", "A_PRIVATE", "A_SHARED_TO_B", "A_SHARED_TO_C"]);
  assert.equal(
    titles(list).includes("B_DIRECT"),
    false,
    "a document of the other relationship must not appear",
  );
  assert.equal(titles(list).includes("A_DRAFT"), false, "an unreleased draft is not the patient's to see");
});

test("context B shows its own document plus the one granted into it", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const list = await listPatientLinkDocuments(f.linkB.id, f.patient.id);
  assert.deepEqual(titles(list), ["A_SHARED_TO_B", "B_DIRECT"]);
  assert.equal(titles(list).includes("A_PRIVATE"), false, "no grant, no visibility");
  assert.equal(titles(list).includes("A_DIRECT"), false);
});

test("a grant into a third context does not open this one", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // A_SHARED_TO_C belongs to the same patient, comes from the same practice
  // and carries an active, unexpired grant. Only its target link differs.
  const inB = await listPatientLinkDocuments(f.linkB.id, f.patient.id);
  assert.equal(titles(inB).includes("A_SHARED_TO_C"), false, "a grant is bound to the link it names");

  const inC = await listPatientLinkDocuments(f.linkC.id, f.patient.id);
  assert.deepEqual(titles(inC), ["A_SHARED_TO_C"], "and it opens exactly that one");

  await assert.rejects(
    () => getPatientLinkDocument(f.linkB.id, f.aSharedToC.id, f.patient.id),
    /document_not_found/,
  );
});

test("a shared document is labelled as such and names where it came from", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const list = await listPatientLinkDocuments(f.linkB.id, f.patient.id);
  const shared = list.find((d) => d.title === "A_SHARED_TO_B");
  const own = list.find((d) => d.title === "B_DIRECT");

  assert.equal(shared.origin, "shared");
  assert.equal(shared.sourcePracticeName, "PraxisA", "the patient can tell why it is here");
  assert.equal(own.origin, "direct");
  assert.equal(own.sourcePracticeName, null, "a direct document does not name a source");
});

test("the response carries no OCR text, tokens or grant ids", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const list = await listPatientLinkDocuments(f.linkB.id, f.patient.id);
  const flat = JSON.stringify(list);
  for (const key of ["tokenHash", "storageKey", "grantId", "ocrText", "shareGrants"]) {
    assert.equal(flat.includes(key), false, `${key} must not be in the response`);
  }
});

/* ====================================================== IDOR resistance */

test("a document of the other context cannot be fetched by id", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => getPatientLinkDocument(f.linkB.id, f.aPrivate.id, f.patient.id),
    /document_not_found/,
    "A's private document via B's context",
  );
  await assert.rejects(
    () => getPatientLinkDocument(f.linkA.id, f.bDirect.id, f.patient.id),
    /document_not_found/,
    "B's document via A's context",
  );
});

test("another patient's link and document are unreachable", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await assert.rejects(
    () => listPatientLinkDocuments(f.linkQ.id, f.patient.id),
    /link_not_found/,
    "P using Q's link",
  );
  await assert.rejects(
    () => getPatientLinkDocument(f.linkA.id, f.qDoc.id, f.patient.id),
    /document_not_found/,
    "Q's document via P's own context",
  );
});

test("a foreign link and a missing link are indistinguishable", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const foreign = await listPatientLinkDocuments(f.linkQ.id, f.patient.id).catch((e) => e.message);
  const missing = await listPatientLinkDocuments("nope", f.patient.id).catch((e) => e.message);
  assert.equal(foreign, "link_not_found");
  assert.equal(missing, foreign);
});

/* ================================================= Revocation semantics */

test("revoking the grant removes the document from the target context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  assert.ok(
    (await listPatientLinkDocuments(f.linkB.id, f.patient.id)).some(
      (d) => d.title === "A_SHARED_TO_B",
    ),
    "precondition: visible while the grant is active",
  );

  await prisma.practiceDocumentShareGrant.update({
    where: { id: f.grant.id },
    data: { status: "revoked", revokedAt: new Date() },
  });

  const after = await listPatientLinkDocuments(f.linkB.id, f.patient.id);
  assert.deepEqual(titles(after), ["B_DIRECT"], "gone from the list");

  await assert.rejects(
    () => getPatientLinkDocument(f.linkB.id, f.aSharedToB.id, f.patient.id),
    /document_not_found/,
    "and gone from the direct fetch",
  );

  const sourceStill = await listPatientLinkDocuments(f.linkA.id, f.patient.id);
  assert.ok(
    titles(sourceStill).includes("A_SHARED_TO_B"),
    "the source document itself is untouched",
  );
});

test("an expired grant grants nothing", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await prisma.practiceDocumentShareGrant.update({
    where: { id: f.grant.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  const list = await listPatientLinkDocuments(f.linkB.id, f.patient.id);
  assert.deepEqual(titles(list), ["B_DIRECT"]);
});

/* =========================================== Download re-checks the state */

test("download works while the grant is effective", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const file = await prisma.practiceDocumentFile.findFirst({
    where: { documentId: f.aSharedToB.id },
  });
  // Storage has no object for the fixture, so reaching the storage layer is
  // itself the proof that authorization passed.
  await assert.rejects(
    () => getPatientLinkDocumentFile(f.linkB.id, f.aSharedToB.id, file.id, f.patient.id),
    (e) => !/document_not_found|link_not_found|file_not_found/.test(e.message),
    "authorization must pass; only the missing test object may fail",
  );
});

test("revoke-then-download is refused, even though the client just saw it", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // 1. the client lists and sees the document
  const before = await listPatientLinkDocuments(f.linkB.id, f.patient.id);
  assert.ok(before.some((d) => d.title === "A_SHARED_TO_B"));
  const file = await prisma.practiceDocumentFile.findFirst({
    where: { documentId: f.aSharedToB.id },
  });

  // 2. the grant is revoked while that view is still on screen
  await prisma.practiceDocumentShareGrant.update({
    where: { id: f.grant.id },
    data: { status: "revoked", revokedAt: new Date() },
  });

  // 3. the download the client still offers must fail
  await assert.rejects(
    () => getPatientLinkDocumentFile(f.linkB.id, f.aSharedToB.id, file.id, f.patient.id),
    /document_not_found/,
    "having been allowed to see it is not a standing permission to fetch it",
  );
});

test("a file of another context cannot be downloaded through this one", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const file = await prisma.practiceDocumentFile.findFirst({
    where: { documentId: f.aPrivate.id },
  });
  await assert.rejects(
    () => getPatientLinkDocumentFile(f.linkB.id, f.aPrivate.id, file.id, f.patient.id),
    /document_not_found/,
  );
});

test("a file id from a different document is refused", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const foreignFile = await prisma.practiceDocumentFile.findFirst({
    where: { documentId: f.bDirect.id },
  });
  await assert.rejects(
    () => getPatientLinkDocumentFile(f.linkB.id, f.aSharedToB.id, foreignFile.id, f.patient.id),
    /file_not_found/,
    "the file must belong to the document that was authorized",
  );
});

/* ============================================================ deleted */

test("a deleted document is invisible in every context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await prisma.practiceDocument.update({
    where: { id: f.aDirect.id },
    data: { status: "deleted", deletedAt: new Date() },
  });

  const list = await listPatientLinkDocuments(f.linkA.id, f.patient.id);
  assert.equal(titles(list).includes("A_DIRECT"), false);
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  assert.equal(await prisma.user.count({ where: { email: { contains: SUFFIX } } }), 0);
});

/* ================================================= Class D — no link at all */

/**
 * Meda Live session PDFs are the only documents created without a link
 * (services/meda/medaPdfLinkService.js). They carry `patientUserId: null` as
 * well, so they belong to the practice and to no patient. Neither branch of the
 * context filter can match them: DIRECT needs this link's id, SHARED needs this
 * patient's id, and NULL equals neither. The test pins that down, because the
 * cheap reading — "linkless means it belongs to everyone in the practice" —
 * would be a leak.
 */
test("a practice-internal document without link or patient is in nobody's context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const internal = await prisma.practiceDocument.create({
    data: {
      practiceProfileId: f.linkA.practiceProfileId,
      patientUserId: null,
      practicePatientLinkId: null,
      title: "PRACTICE_INTERNAL",
      type: "other",
      status: "shared",
      sharedAt: new Date(),
    },
  });
  t.after(() => prisma.practiceDocument.delete({ where: { id: internal.id } }).catch(() => {}));

  const list = await listPatientLinkDocuments(f.linkA.id, f.patient.id);
  assert.equal(titles(list).includes("PRACTICE_INTERNAL"), false);

  await assert.rejects(
    () => getPatientLinkDocument(f.linkA.id, internal.id, f.patient.id),
    /document_not_found/,
  );
});

/* ============================================= Tokens are not permissions */

/**
 * A secure download token is a bearer secret with its own lifetime. It must
 * never outlive the permission it was issued under, so revoking the grant has
 * to invalidate it — both directly (the revoke marks the token revoked) and
 * indirectly (redemption re-derives access). Asserting only the "after" state
 * would pass even if the token had never been valid, so the "before" state is
 * asserted first.
 */
test("a token issued under a grant dies with that grant", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const { resolveSecureDocumentToken, hashSecureDocumentToken } = await import(
    "../services/practiceDocument/secureDocumentAccessService.js"
  );
  const { revokeDocumentShareGrant } = await import(
    "../services/practiceDocument/documentShareGrantService.js"
  );

  const file = await prisma.practiceDocumentFile.findFirst({
    where: { documentId: f.aSharedToB.id },
  });
  const raw = "raw-token-for-test-only";
  const token = await prisma.secureDocumentAccessToken.create({
    data: {
      documentId: f.aSharedToB.id,
      fileId: file.id,
      tokenHash: hashSecureDocumentToken(raw),
      audience: "practice",
      practiceProfileId: f.linkB.practiceProfileId,
      practicePatientLinkId: f.linkB.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  t.after(() => prisma.secureDocumentAccessToken.delete({ where: { id: token.id } }).catch(() => {}));

  // Precondition — without this the test below would prove nothing.
  const resolved = await resolveSecureDocumentToken(raw);
  assert.equal(resolved.token.id, token.id, "the token is valid while the grant is");

  await revokeDocumentShareGrant({ grantId: f.grant.id, patientUserId: f.patient.id });

  await assert.rejects(() => resolveSecureDocumentToken(raw), /link_revoked/);

  const after = await prisma.secureDocumentAccessToken.findUnique({ where: { id: token.id } });
  assert.ok(after.revokedAt, "revoking the grant stamps the token, it does not merely fail later");
});

/* ================================================================ N+1 */

test("listing a context costs the same whether it holds one document or many", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // The service uses the shared prisma singleton, so counting means wrapping
  // that singleton's delegates rather than passing a fake client in.
  const wrapped = [];
  const count = { n: 0 };
  for (const model of ["practicePatientLink", "practiceDocument"]) {
    for (const op of ["findFirst", "findMany", "findUnique"]) {
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

  await listPatientLinkDocuments(f.linkA.id, f.patient.id);
  const withFour = count.n;

  for (let i = 0; i < 8; i += 1) {
    const row = await prisma.practiceDocument.create({
      data: {
        practiceProfileId: f.linkA.practiceProfileId,
        practicePatientLinkId: f.linkA.id,
        patientUserId: f.patient.id,
        title: `BULK_${i}`,
        type: "report",
        status: "shared",
        sharedAt: new Date(),
      },
    });
    await prisma.practiceDocumentShare.create({
      data: { documentId: row.id, patientUserId: f.patient.id, status: "active", sharedAt: new Date() },
    });
  }

  count.n = 0;
  const many = await listPatientLinkDocuments(f.linkA.id, f.patient.id);

  assert.equal(many.length, 12, "eight more documents are actually visible");
  assert.equal(count.n, withFour, `query count must not grow with the document count (was ${withFour}, now ${count.n})`);
  assert.ok(count.n <= 2, `bounded at two queries, got ${count.n}`);
});

/* ============================= Two links, one practice, one patient account */

/**
 * The link uniqueness key is (practiceProfileId, patientUserId, patientProfileId),
 * so one account can hold two links to the SAME practice — e.g. one for itself
 * and one for a dependent it manages. Those are two separate contexts, and a
 * document released into one must not surface in the other.
 *
 * This is the case that distinguishes "scoped by link" from "scoped by practice
 * plus patient": both readings agree everywhere else, which is exactly why the
 * weaker one can survive unnoticed.
 */
test("a second link to the same practice is still a separate context", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const profile = await prisma.patientProfile.create({
    data: {
      userId: f.patient.id,
      displayName: "Angehoerige",
      relationLabel: "child",
    },
  });
  const linkA2 = await prisma.practicePatientLink.create({
    data: {
      practiceProfileId: f.linkA.practiceProfileId,
      patientUserId: f.patient.id,
      patientProfileId: profile.id,
      status: "active",
      consentScopes: ["documents"],
      consentAcceptedAt: new Date(),
    },
  });
  const doc = await prisma.practiceDocument.create({
    data: {
      practiceProfileId: f.linkA.practiceProfileId,
      practicePatientLinkId: linkA2.id,
      patientUserId: f.patient.id,
      title: "SECOND_LINK_DOC",
      type: "report",
      status: "shared",
      sharedAt: new Date(),
    },
  });
  await prisma.practiceDocumentShare.create({
    data: { documentId: doc.id, patientUserId: f.patient.id, status: "active", sharedAt: new Date() },
  });

  // Same practice, same patient account, same active share — only the link differs.
  const inA = await listPatientLinkDocuments(f.linkA.id, f.patient.id);
  assert.equal(titles(inA).includes("SECOND_LINK_DOC"), false, "the other link's document stays out");

  const inA2 = await listPatientLinkDocuments(linkA2.id, f.patient.id);
  assert.deepEqual(titles(inA2), ["SECOND_LINK_DOC"], "and this link shows only its own");

  await assert.rejects(
    () => getPatientLinkDocument(f.linkA.id, doc.id, f.patient.id),
    /document_not_found/,
  );
});
