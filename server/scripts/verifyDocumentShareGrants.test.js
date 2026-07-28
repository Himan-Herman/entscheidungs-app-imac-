/**
 * Patient-controlled sharing of a single practice document with exactly one
 * other connected practice.
 *
 * The patient is the only actor who can create or withdraw a grant. A grant is
 * READ only, it is never a copy, and it stops working the moment it is revoked
 * — including for secure download tokens already issued.
 *
 * No database: Prisma is replaced by an in-memory adapter that evaluates the
 * generated `where` the way Prisma would, so the access filter is exercised as
 * a query rather than as post-hoc JavaScript. medscoutx_dev is never touched.
 * The database-level invariants are covered separately by
 * verifyDocumentShareGrantSandbox.mjs against real PostgreSQL.
 *
 * Fixture: patient P with links to practice B (origin), A (target) and C
 * (third party); a revoked link D; a foreign patient P2 at practice B.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-share-grants";
process.env.CARE_RELATIONSHIP_ENABLED = "true";
process.env.PRACTICE_DOCUMENTS_V2 = "true";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getPracticeDocumentStorage } from "../services/practiceDocument/storage/index.js";
import {
  assertOnlyAllowedCreateFields,
  effectiveGrantWhere,
  isGrantEffective,
  practiceDocumentAccessWhere,
} from "../services/practiceDocument/documentShareGrantService.js";

/* ------------------------------------------------------------------ actors */

const P = "user-P";
const P2 = "user-P2";
const OUTSIDER = "user-outsider";

const PR = { A: "practice-A", B: "practice-B", C: "practice-C", D: "practice-D" };
const LINK = { A: "link-A", B: "link-B", C: "link-C", D: "link-D", F: "link-F" };
const DOC_USER = { A: "user-doc-A", B: "user-doc-B", C: "user-doc-C" };
const OWNER = { A: "user-owner-A", B: "user-owner-B", C: "user-owner-C", D: "user-owner-D" };

const D_B = "doc-from-B";
const D_FOREIGN = "doc-foreign";
const D_DELETED = "doc-deleted";
const FILE_B = "file-of-doc-B";

let links;
let members;
let documents;
let files;
let grants;
let tokens;
let audits;
let idSeq;

/* --------------------------------------------------- in-memory Prisma fake */

/** Evaluates the grant-shaped `where` this feature produces. */
function grantMatches(g, w, now = new Date()) {
  for (const [k, v] of Object.entries(w)) {
    if (k === "OR") {
      const ok = v.some((b) => {
        if (b.expiresAt === null) return g.expiresAt === null;
        if (b.expiresAt?.gt) return g.expiresAt !== null && g.expiresAt > b.expiresAt.gt;
        return false;
      });
      if (!ok) return false;
      continue;
    }
    if (v === null) {
      if (g[k] !== null && g[k] !== undefined) return false;
      continue;
    }
    if (g[k] !== v) return false;
  }
  return true;
}

/** Evaluates the document-shaped `where`, including shareGrants.some. */
function docMatches(d, w) {
  for (const [k, v] of Object.entries(w)) {
    if (k === "OR") {
      if (!v.some((branch) => docMatches(d, branch))) return false;
      continue;
    }
    if (k === "shareGrants") {
      const some = v.some;
      const hit = grants.some((g) => g.documentId === d.id && grantMatches(g, some));
      if (!hit) return false;
      continue;
    }
    if (k === "status" && typeof v === "object" && v !== null) {
      if (v.notIn && v.notIn.includes(d.status)) return false;
      if (v.not !== undefined && d.status === v.not) return false;
      continue;
    }
    if (d[k] !== v) return false;
  }
  return true;
}

function installFake() {
  idSeq = 0;
  links = [
    { id: LINK.A, practiceProfileId: PR.A, patientUserId: P, status: "active" },
    { id: LINK.B, practiceProfileId: PR.B, patientUserId: P, status: "active" },
    { id: LINK.C, practiceProfileId: PR.C, patientUserId: P, status: "active" },
    { id: LINK.D, practiceProfileId: PR.D, patientUserId: P, status: "revoked" },
    { id: LINK.F, practiceProfileId: PR.B, patientUserId: P2, status: "active" },
  ];
  members = [
    { practiceProfileId: PR.A, userId: DOC_USER.A, role: "doctor", status: "active" },
    { practiceProfileId: PR.B, userId: DOC_USER.B, role: "doctor", status: "active" },
    { practiceProfileId: PR.C, userId: DOC_USER.C, role: "doctor", status: "active" },
  ];
  documents = [
    { id: D_B, practicePatientLinkId: LINK.B, practiceProfileId: PR.B, patientUserId: P,
      type: "report", title: "Placeholder Title", description: null, status: "shared",
      createdByUserId: DOC_USER.B, sharedAt: new Date(), archivedAt: null,
      createdAt: new Date(), updatedAt: new Date() },
    { id: D_FOREIGN, practicePatientLinkId: LINK.F, practiceProfileId: PR.B, patientUserId: P2,
      type: "report", title: "Placeholder Title", description: null, status: "shared",
      createdByUserId: DOC_USER.B, sharedAt: new Date(), archivedAt: null,
      createdAt: new Date(), updatedAt: new Date() },
    { id: D_DELETED, practicePatientLinkId: LINK.B, practiceProfileId: PR.B, patientUserId: P,
      type: "report", title: "Placeholder Title", description: null, status: "deleted",
      createdByUserId: DOC_USER.B, sharedAt: null, archivedAt: null,
      createdAt: new Date(), updatedAt: new Date() },
  ];
  files = [
    { id: FILE_B, documentId: D_B, storageKey: "k/doc-b", originalFileName: "placeholder.pdf",
      mimeType: "application/pdf", sizeBytes: 4, createdAt: new Date() },
  ];
  grants = [];
  tokens = [];
  audits = [];

  const nextId = (p) => `${p}-${(idSeq += 1)}`;

  prisma.$transaction = async (arg) => {
    if (typeof arg === "function") return arg(prisma);
    return Promise.all(arg);
  };

  prisma.practicePatientLink = {
    findFirst: async ({ where }) =>
      links.find((l) => Object.entries(where).every(([k, v]) => l[k] === v)) ?? null,
    findUnique: async ({ where }) => links.find((l) => l.id === where.id) ?? null,
  };
  prisma.practiceProfile = {
    findUnique: async ({ where }) => {
      const owner = Object.entries(OWNER).find(([k]) => PR[k] === where.id);
      return owner ? { id: where.id, userId: owner[1], practiceName: `Praxis ${owner[0]}` } : null;
    },
  };
  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      return members.find((m) => m.practiceProfileId === practiceProfileId && m.userId === userId) ?? null;
    },
  };
  prisma.consentRecord = {
    findFirst: async () => ({ status: "granted" }),
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
  };

  const withIncludes = (d) => ({
    ...d,
    files: files.filter((f) => f.documentId === d.id),
    shares: [],
    practiceProfile: { practiceName: `Praxis ${Object.entries(PR).find(([, v]) => v === d.practiceProfileId)?.[0]}` },
  });

  prisma.practiceDocument = {
    findFirst: async ({ where, select }) => {
      const d = documents.find((x) => docMatches(x, where));
      if (!d) return null;
      if (select) return Object.fromEntries(Object.keys(select).map((k) => [k, d[k]]));
      return withIncludes(d);
    },
    findMany: async ({ where }) => documents.filter((d) => docMatches(d, where)).map(withIncludes),
    findUnique: async ({ where }) => documents.find((d) => d.id === where.id) ?? null,
  };
  prisma.practiceDocumentFile = {
    findFirst: async ({ where }) =>
      files.find((f) => Object.entries(where).every(([k, v]) => f[k] === v)) ?? null,
  };

  prisma.practiceDocumentShareGrant = {
    create: async ({ data }) => {
      // Mirrors the partial unique index: at most one active grant per
      // (document, target link).
      const clash = grants.find(
        (g) => g.documentId === data.documentId &&
          g.targetPracticePatientLinkId === data.targetPracticePatientLinkId &&
          g.status === "active",
      );
      if (clash) {
        const e = new Error("Unique constraint failed");
        e.code = "P2002";
        throw e;
      }
      const row = { id: nextId("grant"), revokedAt: null, expiresAt: null, ...data };
      grants.push(row);
      return row;
    },
    findFirst: async ({ where }) => grants.find((g) => grantMatches(g, where)) ?? null,
    findUnique: async ({ where }) => grants.find((g) => g.id === where.id) ?? null,
    findMany: async ({ where }) => grants.filter((g) => grantMatches(g, where)),
    updateMany: async ({ where, data }) => {
      const hit = grants.filter((g) => grantMatches(g, where));
      for (const g of hit) Object.assign(g, data);
      return { count: hit.length };
    },
  };

  prisma.secureDocumentAccessToken = {
    create: async ({ data }) => {
      const row = { id: nextId("token"), revokedAt: null, usedAt: null, ...data };
      tokens.push(row);
      return row;
    },
    findUnique: async ({ where }) => {
      const t = tokens.find((x) => x.tokenHash === where.tokenHash);
      if (!t) return null;
      const doc = documents.find((d) => d.id === t.documentId);
      return {
        ...t,
        document: doc && { id: doc.id, status: doc.status, patientUserId: doc.patientUserId, practiceProfileId: doc.practiceProfileId },
        file: files.find((f) => f.id === t.fileId) ?? null,
      };
    },
    findFirst: async ({ where }) =>
      tokens.find((t) => Object.entries(where).every(([k, v]) => (v === null ? t[k] == null : t[k] === v))) ?? null,
    update: async ({ where, data }) => {
      const t = tokens.find((x) => x.id === where.id);
      Object.assign(t, data);
      return t;
    },
    updateMany: async ({ where, data }) => {
      const hit = tokens.filter((t) =>
        Object.entries(where).every(([k, v]) => (v === null ? t[k] == null : t[k] === v)));
      for (const t of hit) Object.assign(t, data);
      return { count: hit.length };
    },
  };

  prisma.auditLog = { create: async ({ data }) => { audits.push(data); return data; } };
  prisma.practiceDocumentAuditEntry = { create: async () => ({}) };
  prisma.user = { findUnique: async () => ({ dateOfBirth: null, profile: null }) };

  getPracticeDocumentStorage().getObject = async () => Buffer.from("PDF!");
}

test.beforeEach(() => installFake());

/* ============================================================= unit level */

test("unit: the grant filter refuses to build without all three anchors", () => {
  for (const input of [
    { targetPracticePatientLinkId: LINK.A, targetPracticeProfileId: PR.A },
    { targetPracticePatientLinkId: LINK.A, patientUserId: P },
    { targetPracticeProfileId: PR.A, patientUserId: P },
    {},
  ]) {
    assert.throws(() => effectiveGrantWhere(input), /grant_filter_requires_link/,
      "a missing id must never widen the query");
  }
});

test("unit: a grant id alone is never part of the access filter", () => {
  const where = effectiveGrantWhere({
    targetPracticePatientLinkId: LINK.A, targetPracticeProfileId: PR.A, patientUserId: P,
  });
  assert.equal(where.status, "active");
  assert.equal(where.revokedAt, null);
  assert.ok(!("id" in where), "a caller must not be able to name the grant");
  assert.equal(where.targetPracticePatientLinkId, LINK.A);
});

test("unit: the document access filter has exactly two branches", () => {
  const where = practiceDocumentAccessWhere({
    link: { id: LINK.A, patientUserId: P }, practiceProfileId: PR.A,
  });
  assert.equal(where.OR.length, 2);
  assert.deepEqual(where.OR[0], { practicePatientLinkId: LINK.A, practiceProfileId: PR.A });
  assert.ok(where.OR[1].shareGrants.some, "the second branch must go through a grant");
});

test("unit: only an active, unrevoked, unexpired grant is effective", () => {
  const base = { status: "active", revokedAt: null, expiresAt: null };
  assert.equal(isGrantEffective(base), true);
  assert.equal(isGrantEffective({ ...base, status: "revoked" }), false);
  assert.equal(isGrantEffective({ ...base, status: "expired" }), false);
  assert.equal(isGrantEffective({ ...base, revokedAt: new Date() }), false);
  assert.equal(isGrantEffective({ ...base, expiresAt: new Date(Date.now() - 1000) }), false);
  assert.equal(isGrantEffective({ ...base, expiresAt: new Date(Date.now() + 60000) }), true);
  assert.equal(isGrantEffective(null), false);
});

test("unit: any field other than the target link is rejected outright", () => {
  assert.doesNotThrow(() => assertOnlyAllowedCreateFields({ targetPracticePatientLinkId: LINK.A }));
  assert.doesNotThrow(() => assertOnlyAllowedCreateFields({}));
  for (const field of [
    "patientUserId", "sourcePracticeProfileId", "sourcePracticePatientLinkId",
    "targetPracticeProfileId", "status", "grantedByUserId", "grantedAt", "expiresAt",
    "permissions", "consentScope", "revokedAt", "id",
  ]) {
    assert.throws(
      () => assertOnlyAllowedCreateFields({ targetPracticePatientLinkId: LINK.A, [field]: "x" }),
      /unsupported_field/,
      `${field} must not be steerable from the body`,
    );
  }
});

/* ================================================================ real HTTP */

let server;
let baseUrl;

test.before(async () => {
  installFake();
  const [grantRouter, practiceDocs] = await Promise.all([
    import("../routes/patientDocumentShareGrants.js"),
    import("../routes/practiceDocuments.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api/patient", requireAuth, grantRouter.default);
  app.use("/api/practice/patients/:linkId/documents", requireAuth, practiceDocs.default);
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((r) => server.close(r)));

async function call(method, path, user, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* binary download */ }
  return { status: res.status, body: json, raw: text };
}

const share = (user, documentId, targetLink) =>
  call("POST", `/api/patient/practice-documents/${documentId}/share-grants`, user,
    { targetPracticePatientLinkId: targetLink });

const listDocs = (user, practice, link) =>
  call("GET", `/api/practice/patients/${link}/documents?practiceId=${practice}`, user);
const getDoc = (user, practice, link, doc) =>
  call("GET", `/api/practice/patients/${link}/documents/${doc}?practiceId=${practice}`, user);
const download = (user, practice, link, doc) =>
  call("GET", `/api/practice/patients/${link}/documents/${doc}/download?practiceId=${practice}&fileId=${FILE_B}`, user);

/* ------------------------------------------------------------- 1. creating */

test("1. the patient shares D-B with practice A's link", async () => {
  const res = await share(P, D_B, LINK.A);
  assert.equal(res.status, 201);
  assert.equal(res.body.created, true);
  assert.equal(res.body.grant.status, "active");
  assert.equal(res.body.grant.documentId, D_B);
});

test("2. the grant records the correct source and target relations", async () => {
  await share(P, D_B, LINK.A);
  const g = grants[0];
  assert.equal(g.sourcePracticeProfileId, PR.B);
  assert.equal(g.sourcePracticePatientLinkId, LINK.B);
  assert.equal(g.targetPracticeProfileId, PR.A);
  assert.equal(g.targetPracticePatientLinkId, LINK.A);
  assert.equal(g.patientUserId, P);
  assert.equal(g.grantedByUserId, P, "the granting user is always the authenticated patient");
});

test("3. a foreign patient's document cannot be shared", async () => {
  const res = await share(P, D_FOREIGN, LINK.A);
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "document_not_found");
  assert.equal(grants.length, 0);
});

test("4. sharing to a link belonging to someone else is refused", async () => {
  const res = await share(P, D_B, LINK.F);
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "link_not_found");
  assert.equal(grants.length, 0);
});

test("5. an inactive target link is refused", async () => {
  const res = await share(P, D_B, LINK.D);
  assert.equal(res.status, 409);
  assert.equal(res.body.error, "link_not_active");
  assert.equal(grants.length, 0);
});

test("6. sharing back to the origin practice is refused", async () => {
  const res = await share(P, D_B, LINK.B);
  assert.equal(res.status, 409);
  assert.equal(res.body.error, "document_already_available_to_practice");
  assert.equal(grants.length, 0);
});

test("7. source, target, status and granter cannot be steered from the body", async () => {
  for (const extra of [
    { patientUserId: P2 },
    { sourcePracticeProfileId: PR.C },
    { sourcePracticePatientLinkId: LINK.C },
    { targetPracticeProfileId: PR.C },
    { status: "active" },
    { grantedByUserId: OWNER.A },
    { grantedAt: new Date().toISOString() },
    { expiresAt: new Date().toISOString() },
  ]) {
    const res = await call("POST", `/api/patient/practice-documents/${D_B}/share-grants`, P,
      { targetPracticePatientLinkId: LINK.A, ...extra });
    assert.equal(res.status, 400, JSON.stringify(extra));
    assert.equal(res.body.error, "unsupported_field");
  }
  assert.equal(grants.length, 0, "no grant may be created by a manipulated request");
});

test("8. sharing twice does not create a second active grant", async () => {
  const first = await share(P, D_B, LINK.A);
  const second = await share(P, D_B, LINK.A);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(second.body.created, false);
  assert.equal(second.body.grant.id, first.body.grant.id);
  assert.equal(grants.filter((g) => g.status === "active").length, 1);
});

test("9. a practice cannot create a grant through the patient route", async () => {
  for (const actor of [OWNER.A, DOC_USER.A, OWNER.B, DOC_USER.B, OUTSIDER]) {
    const res = await share(actor, D_B, LINK.A);
    assert.equal(res.status, 404, `${actor} must not reach the patient's document`);
    assert.equal(res.body.error, "document_not_found");
  }
  assert.equal(grants.length, 0);
});

test("10. owner, doctor and admin cannot grant on the patient's behalf", async () => {
  // There is no route that takes a patient id — the granting user is always
  // taken from the token, and the database enforces the same rule.
  const res = await share(OWNER.B, D_B, LINK.A);
  assert.equal(res.status, 404);
  assert.equal(grants.length, 0);
});

test("10b. a deleted document cannot be shared", async () => {
  const res = await share(P, D_DELETED, LINK.A);
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "document_not_found");
});

/* ------------------------------------------------------- 11. practice reads */

test("11. the origin practice B still sees its own document", async () => {
  const res = await listDocs(DOC_USER.B, PR.B, LINK.B);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.documents.map((d) => d.id), [D_B]);
});

test("12. the target practice A sees D-B once the grant is active", async () => {
  let res = await listDocs(DOC_USER.A, PR.A, LINK.A);
  assert.deepEqual(res.body.documents, [], "nothing before the grant");

  await share(P, D_B, LINK.A);

  res = await listDocs(DOC_USER.A, PR.A, LINK.A);
  assert.deepEqual(res.body.documents.map((d) => d.id), [D_B]);
  assert.equal(res.body.documents[0].accessVia, "patient_share_grant");
  assert.equal(res.body.documents[0].readOnly, true);
});

test("13. practice C never sees D-B", async () => {
  await share(P, D_B, LINK.A);
  const list = await listDocs(DOC_USER.C, PR.C, LINK.C);
  assert.deepEqual(list.body.documents, []);
  const detail = await getDoc(DOC_USER.C, PR.C, LINK.C, D_B);
  assert.equal(detail.status, 404);
  assert.equal(detail.body.error, "document_not_found");
});

test("14. the target practice can download the shared file", async () => {
  await share(P, D_B, LINK.A);
  const res = await download(DOC_USER.A, PR.A, LINK.A, D_B);
  assert.equal(res.status, 200);
  assert.equal(res.raw, "PDF!");
});

test("15. practice C cannot force the download with a known document id", async () => {
  await share(P, D_B, LINK.A);
  const res = await download(DOC_USER.C, PR.C, LINK.C, D_B);
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "document_not_found");
});

test("16. the target practice cannot edit, archive, delete or re-share", async () => {
  await share(P, D_B, LINK.A);
  const q = `?practiceId=${PR.A}`;
  const base = `/api/practice/patients/${LINK.A}/documents/${D_B}`;
  for (const [method, path, body] of [
    ["PATCH", `${base}${q}`, { title: "changed" }],
    ["PATCH", `${base}/archive${q}`, {}],
    ["PATCH", `${base}/delete${q}`, { reason: "x" }],
    ["PATCH", `${base}/restore${q}`, {}],
    ["POST", `${base}/share${q}`, {}],
    ["PATCH", `${base}/revoke${q}`, {}],
  ]) {
    const res = await call(method, path, DOC_USER.A, body);
    assert.ok(res.status === 403 || res.status === 404,
      `${method} ${path} returned ${res.status} — a grant is read access only`);
  }
  const doc = documents.find((d) => d.id === D_B);
  assert.equal(doc.title, "Placeholder Title", "the original must be unchanged");
  assert.equal(doc.status, "shared");
});

test("16b. the target practice cannot start OCR or AI processing on a shared document", async () => {
  await share(P, D_B, LINK.A);
  const {
    getOwnDocumentForPractice,
    getDocumentForPractice,
  } = await import("../services/practiceDocument/practiceDocumentService.js");

  // Reading is allowed …
  const read = await getDocumentForPractice(D_B, LINK.A, PR.A);
  assert.equal(read.accessVia, "patient_share_grant");

  // … processing is not. OCR and the external AI path use the origin-only
  // accessor, so a document that arrived through a grant is out of reach.
  await assert.rejects(
    () => getOwnDocumentForPractice(D_B, LINK.A, PR.A),
    /document_not_found/,
    "a grant must not enable OCR or AI processing by the target practice",
  );
  // The origin practice keeps both.
  assert.ok(await getOwnDocumentForPractice(D_B, LINK.B, PR.B));
});

test("17. the target practice cannot pass the document on to practice C", async () => {
  await share(P, D_B, LINK.A);
  // There is no practice-facing grant route at all; the patient route requires
  // the patient's own token and anchors the document on them.
  const res = await share(DOC_USER.A, D_B, LINK.C);
  assert.equal(res.status, 404);
  assert.equal(grants.length, 1, "no second grant may appear");
  assert.equal(grants[0].targetPracticeProfileId, PR.A);
});

test("18. list, detail and download use the same grant check", async () => {
  const before = await Promise.all([
    listDocs(DOC_USER.A, PR.A, LINK.A),
    getDoc(DOC_USER.A, PR.A, LINK.A, D_B),
    download(DOC_USER.A, PR.A, LINK.A, D_B),
  ]);
  assert.deepEqual(before[0].body.documents, []);
  assert.equal(before[1].status, 404);
  assert.equal(before[2].status, 404);

  await share(P, D_B, LINK.A);

  const after = await Promise.all([
    listDocs(DOC_USER.A, PR.A, LINK.A),
    getDoc(DOC_USER.A, PR.A, LINK.A, D_B),
    download(DOC_USER.A, PR.A, LINK.A, D_B),
  ]);
  assert.equal(after[0].body.documents.length, 1);
  assert.equal(after[1].status, 200);
  assert.equal(after[2].status, 200);
});

/* -------------------------------------------------------------- 19. revoke */

const revoke = (user, grantId) =>
  call("POST", `/api/patient/document-share-grants/${grantId}/revoke`, user);

test("19. the patient revokes the grant", async () => {
  const created = await share(P, D_B, LINK.A);
  const res = await revoke(P, created.body.grant.id);
  assert.equal(res.status, 200);
  assert.equal(res.body.revoked, true);
  assert.equal(res.body.grant.status, "revoked");
  assert.ok(res.body.grant.revokedAt, "a revocation must be dated");
});

test("20. practice A loses list, detail and download access immediately", async () => {
  const created = await share(P, D_B, LINK.A);
  await revoke(P, created.body.grant.id);

  const list = await listDocs(DOC_USER.A, PR.A, LINK.A);
  const detail = await getDoc(DOC_USER.A, PR.A, LINK.A, D_B);
  const file = await download(DOC_USER.A, PR.A, LINK.A, D_B);
  assert.deepEqual(list.body.documents, []);
  assert.equal(detail.status, 404);
  assert.equal(file.status, 404);
});

test("21. practice B and the patient keep their access", async () => {
  const created = await share(P, D_B, LINK.A);
  await revoke(P, created.body.grant.id);

  const list = await listDocs(DOC_USER.B, PR.B, LINK.B);
  assert.deepEqual(list.body.documents.map((d) => d.id), [D_B]);
  const detail = await getDoc(DOC_USER.B, PR.B, LINK.B, D_B);
  assert.equal(detail.status, 200);
});

test("22. a second revoke changes nothing", async () => {
  const created = await share(P, D_B, LINK.A);
  const first = await revoke(P, created.body.grant.id);
  const firstRevokedAt = first.body.grant.revokedAt;

  const second = await revoke(P, created.body.grant.id);
  assert.equal(second.status, 200);
  assert.equal(second.body.revoked, false, "no second action");
  assert.equal(second.body.grant.status, "revoked");
  assert.equal(second.body.grant.revokedAt, firstRevokedAt, "the timestamp must not move");
  assert.equal(
    audits.filter((a) => a.action === "document_share_grant_revoked").length, 1,
    "only one revocation may be audited",
  );
});

test("23. revoking does not change or remove the original document", async () => {
  const before = { ...documents.find((d) => d.id === D_B) };
  const created = await share(P, D_B, LINK.A);
  await revoke(P, created.body.grant.id);

  const after = documents.find((d) => d.id === D_B);
  assert.deepEqual(after, before, "the document is untouched");
  assert.equal(documents.length, 3, "no document was added or removed");
  assert.equal(files.length, 1, "no file was copied");
});

test("24. a secure token of the target practice stops working after revoke", async () => {
  const created = await share(P, D_B, LINK.A);
  const link = await call("POST",
    `/api/practice/patients/${LINK.A}/documents/${D_B}/download-link?practiceId=${PR.A}`,
    DOC_USER.A, { fileId: FILE_B });
  assert.equal(link.status, 200, JSON.stringify(link.body));

  const { streamSecureDocumentDownload } = await import("../services/practiceDocument/secureDocumentAccessService.js");
  const rawToken = decodeURIComponent(String(link.body.downloadUrl).split("/").pop());
  const ok = await streamSecureDocumentDownload(rawToken);
  assert.ok(ok.buffer, "the token works while the grant is active");

  await revoke(P, created.body.grant.id);

  assert.equal(tokens.every((t) => t.revokedAt !== null), true,
    "revoking the grant must invalidate the practice's tokens");
  await assert.rejects(() => streamSecureDocumentDownload(rawToken), /link_revoked/);
});

test("24b. the download re-checks the grant even if the token was not invalidated", async () => {
  const created = await share(P, D_B, LINK.A);
  const link = await call("POST",
    `/api/practice/patients/${LINK.A}/documents/${D_B}/download-link?practiceId=${PR.A}`,
    DOC_USER.A, { fileId: FILE_B });
  const rawToken = decodeURIComponent(String(link.body.downloadUrl).split("/").pop());

  // Revoke the grant directly, bypassing the token invalidation, so only the
  // download-time re-check can catch it.
  const g = grants.find((x) => x.id === created.body.grant.id);
  g.status = "revoked";
  g.revokedAt = new Date();

  const { streamSecureDocumentDownload } = await import("../services/practiceDocument/secureDocumentAccessService.js");
  await assert.rejects(() => streamSecureDocumentDownload(rawToken), /link_revoked/);
});

/* ------------------------------------------------------------ 25. security */

test("25. an expired grant grants nothing", async () => {
  await share(P, D_B, LINK.A);
  grants[0].expiresAt = new Date(Date.now() - 60000);

  const list = await listDocs(DOC_USER.A, PR.A, LINK.A);
  assert.deepEqual(list.body.documents, []);
  const detail = await getDoc(DOC_USER.A, PR.A, LINK.A, D_B);
  assert.equal(detail.status, 404);
});

test("26. a revoked grant grants nothing, even with status left active", async () => {
  await share(P, D_B, LINK.A);
  grants[0].revokedAt = new Date();
  const list = await listDocs(DOC_USER.A, PR.A, LINK.A);
  assert.deepEqual(list.body.documents, [], "revokedAt alone must already block access");
});

test("27. another patient never sees the grant", async () => {
  await share(P, D_B, LINK.A);
  const res = await call("GET", "/api/patient/document-share-grants", P2);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.grants, []);

  const stolen = await revoke(P2, grants[0].id);
  assert.equal(stolen.status, 404);
  assert.equal(stolen.body.error, "grant_not_found");
  assert.equal(grants[0].status, "active", "a foreign revoke must not take effect");
});

test("28. error responses never confirm a foreign document or link", async () => {
  const foreignDoc = await share(P, D_FOREIGN, LINK.A);
  const missingDoc = await share(P, "does-not-exist", LINK.A);
  assert.deepEqual(foreignDoc.body, missingDoc.body,
    "a foreign document must be indistinguishable from a missing one");

  const foreignLink = await share(P, D_B, LINK.F);
  const missingLink = await share(P, D_B, "does-not-exist");
  assert.deepEqual(foreignLink.body, missingLink.body);
});

test("29. no global patientUserId or foreign internal id reaches the target practice", async () => {
  await share(P, D_B, LINK.A);
  const list = await listDocs(DOC_USER.A, PR.A, LINK.A);
  const detail = await getDoc(DOC_USER.A, PR.A, LINK.A, D_B);

  for (const payload of [list.body, detail.body]) {
    const text = JSON.stringify(payload);
    assert.ok(!text.includes(P), "the patient id must not be echoed");
    assert.ok(!text.includes(LINK.B), "the origin practice's link id must not leak");
    assert.ok(!text.includes(DOC_USER.B), "another practice's staff id must not leak");
    assert.ok(!text.includes("storageKey"));
  }
  assert.equal(detail.body.document.patientUserId, undefined);
  assert.equal(detail.body.document.practicePatientLinkId, undefined);
  assert.equal(detail.body.document.createdByUserId, undefined);
});

test("29b. the patient's own grant list withholds ids that are not theirs", async () => {
  await share(P, D_B, LINK.A);
  const res = await call("GET", "/api/patient/document-share-grants", P);
  assert.equal(res.body.grants.length, 1);
  const g = res.body.grants[0];

  assert.equal(g.patientUserId, undefined, "the patient knows who they are");
  assert.equal(g.grantedByUserId, undefined);
  assert.equal(g.sourcePracticePatientLinkId, undefined);
  assert.equal(g.targetPracticePatientLinkId, undefined);
  // What they do get: enough to recognise and manage the release.
  for (const key of ["id", "documentId", "documentTitle", "sourcePractice", "targetPractice",
    "status", "grantedAt", "revokedAt", "expiresAt"]) {
    assert.ok(key in g, `${key} missing from the patient's own view`);
  }
  assert.ok(!JSON.stringify(g).includes("storageKey"));
  assert.ok(!JSON.stringify(g).includes("tokenHash"));
});

test("30. audit metadata carries ids and status only, never medical content", async () => {
  const created = await share(P, D_B, LINK.A);
  await listDocs(DOC_USER.A, PR.A, LINK.A);
  await download(DOC_USER.A, PR.A, LINK.A, D_B);
  await revoke(P, created.body.grant.id);

  const actions = audits.map((a) => a.action);
  for (const required of [
    "document_share_grant_created",
    "document_share_grant_revoked",
    "shared_document_viewed",
    "shared_document_downloaded",
  ]) {
    assert.ok(actions.includes(required), `${required} must be audited`);
  }

  const banned = /Placeholder Title|placeholder\.pdf|storageKey|tokenHash|diagnos|befund/i;
  for (const entry of audits) {
    const text = JSON.stringify(entry.metadataJson ?? entry.metadata ?? {});
    assert.doesNotMatch(text, banned, `audit entry ${entry.action} leaks content: ${text}`);
  }
});

test("31. tenant isolation for A, B and C is unaffected", async () => {
  await share(P, D_B, LINK.A);
  // A practice may still only act through its own link, and a foreign link id
  // does not become usable just because a grant exists.
  const cases = [
    [DOC_USER.A, PR.A, LINK.B], [DOC_USER.A, PR.B, LINK.B],
    [DOC_USER.C, PR.C, LINK.A], [DOC_USER.B, PR.B, LINK.A],
    [OUTSIDER, PR.A, LINK.A],
  ];
  for (const [user, practice, link] of cases) {
    const res = await listDocs(user, practice, link);
    assert.ok(res.status === 403 || res.status === 404,
      `${user} via ${practice}/${link} returned ${res.status}`);
  }
});

test("32. sharing copies nothing", async () => {
  const docsBefore = documents.length;
  const filesBefore = files.length;
  await share(P, D_B, LINK.A);
  assert.equal(documents.length, docsBefore, "no second document");
  assert.equal(files.length, filesBefore, "no second file");
  assert.equal(grants.length, 1, "exactly one relation row");
  const g = grants[0];
  for (const key of ["title", "description", "storageKey", "content", "fileName"]) {
    assert.equal(g[key], undefined, `${key} must not be copied into the grant`);
  }
});

test("33. a grant racing a revoke leaves no access behind", async () => {
  const created = await share(P, D_B, LINK.A);
  // Both requests hit the same active grant; the conditional update means only
  // one revocation takes effect and re-granting produces a NEW row rather than
  // reviving the revoked one.
  const [a, b] = await Promise.all([
    revoke(P, created.body.grant.id),
    revoke(P, created.body.grant.id),
  ]);
  assert.equal([a.body.revoked, b.body.revoked].filter(Boolean).length, 1,
    "exactly one revocation may take effect");
  assert.equal(grants.filter((g) => g.status === "active").length, 0);

  const list = await listDocs(DOC_USER.A, PR.A, LINK.A);
  assert.deepEqual(list.body.documents, []);

  const again = await share(P, D_B, LINK.A);
  assert.equal(again.status, 201);
  assert.equal(grants.length, 2, "the revocation is kept as history");
  assert.equal(grants[0].status, "revoked", "the old revoke was not overwritten");
});

test("35. no permission check in the document router is passed an access object", async () => {
  // canRead/canWrite/canPracticeSoftDelete take a ROLE STRING. Passing the
  // resolved access object stringifies it to "[object Object]", which matches
  // no role, so the check silently denies everyone. That is how the whole
  // documents module was returning 403 to every user before this commit.
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const routerSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "routes", "practiceDocuments.js"),
    "utf8",
  );
  const offenders = [...routerSrc.matchAll(/(can[A-Za-z]+)\(ctx\.access\)/g)].map((m) => m[1]);
  assert.deepEqual(offenders, [],
    "use accessHasPermission(ctx.access, PERMISSIONS.X) or pass ctx.access.role");
});

test("34. revoking the target link disables access without touching the grant", async () => {
  await share(P, D_B, LINK.A);
  const link = links.find((l) => l.id === LINK.A);
  link.status = "revoked";

  const list = await listDocs(DOC_USER.A, PR.A, LINK.A);
  assert.equal(list.status, 409);
  assert.equal(list.body.error, "link_not_active");
  const detail = await getDoc(DOC_USER.A, PR.A, LINK.A, D_B);
  assert.equal(detail.status, 409);

  assert.equal(grants[0].status, "active", "the grant itself is not mutated");
});
