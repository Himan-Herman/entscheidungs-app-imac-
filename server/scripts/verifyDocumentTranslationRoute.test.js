/**
 * REAL HTTP tests for POST /api/patient/practice-documents/:documentId/translate.
 *
 * Boots an actual Express app with the real router, the real requireAuth
 * middleware and real JWTs over a real socket. Only Prisma is replaced by an
 * in-memory adapter, so no database is required and no network call is made.
 *
 * The focus is the contract at the HTTP boundary: what the endpoint accepts,
 * what it refuses, and what it discloses. Behaviour behind the service is
 * covered in verifyDocumentTranslationService.test.js.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-translate-route";
process.env.PRACTICE_DOCUMENTS_V2 = "true";
process.env.ENABLE_DOCUMENT_TRANSLATION = "true";
// Every request here comes from one loopback address; without this the suite
// would throttle itself rather than test the endpoint. The IP limiter's own
// behaviour is not asserted here; the limit that actually matters — one
// transformation at a time per patient — is covered in the service suite.
process.env.DOCUMENT_TRANSLATION_IP_MAX = "500";
// Deliberately NOT configuring a translation provider: the default state of the
// deployment is what this suite asserts against.
delete process.env.DOCUMENT_TRANSLATION_PROVIDER;

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const PATIENT = "user-P1";
const OTHER = "user-P2";
const PRACTICE = "practice-A";
const LINK = "link-active";
const DOC = "doc-ok";
const FILE = "file-ok";

const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/* ------------------------------------------------------------- prisma fake */

const documents = [
  {
    id: DOC,
    practicePatientLinkId: LINK,
    practiceProfileId: PRACTICE,
    patientUserId: PATIENT,
    type: "report",
    title: "Arztbrief",
    description: null,
    status: "shared",
    createdByUserId: "user-doc",
    sharedAt: new Date(),
    archivedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
const files = [
  {
    id: FILE,
    documentId: DOC,
    storageKey: "k/doc-ok",
    originalFileName: "arztbrief.docx",
    mimeType: MIME_DOCX,
    sizeBytes: 2048,
    createdAt: new Date(),
  },
];
const shares = [
  {
    id: "share-ok",
    documentId: DOC,
    patientUserId: PATIENT,
    status: "active",
    sharedAt: new Date(),
    revokedAt: null,
    expiresAt: null,
  },
];
const links = [
  { id: LINK, practiceProfileId: PRACTICE, patientUserId: PATIENT, status: "active" },
];

const matches = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v);

prisma.practiceDocument = {
  findFirst: async ({ where, select }) => {
    const d = documents.find((x) => matches(x, where));
    if (!d) return null;
    if (select) return Object.fromEntries(Object.keys(select).map((k) => [k, d[k]]));
    return {
      ...d,
      files: files.filter((f) => f.documentId === d.id),
      shares: shares.filter((s) => s.documentId === d.id),
      practiceProfile: { practiceName: "Praxis A" },
    };
  },
  findUnique: async ({ where }) => documents.find((d) => d.id === where.id) ?? null,
};
prisma.practicePatientLink = {
  findFirst: async ({ where, select }) => {
    const l = links.find((x) => matches(x, where));
    if (!l) return null;
    if (select) return Object.fromEntries(Object.keys(select).map((k) => [k, l[k]]));
    return l;
  },
};
prisma.practiceDocumentFile = {
  findFirst: async ({ where }) => files.find((f) => matches(f, where)) ?? null,
};
prisma.user = { findUnique: async () => null };
prisma.auditLog = { create: async () => ({}) };

const { default: patientPracticeDocumentsRouter } = await import(
  "../routes/patientPracticeDocuments.js"
);

/* ---------------------------------------------------------------- harness */

const app = express();
app.use(express.json());
app.use("/api/patient/practice-documents", requireAuth, patientPracticeDocumentsRouter);

const server = app.listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => server.close());

function token(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "10m" });
}

async function post(body, { userId = PATIENT, documentId = DOC, auth = true } = {}) {
  const res = await fetch(`${base}/api/patient/practice-documents/${documentId}/translate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: `Bearer ${token(userId)}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const VALID_BODY = {
  fileId: FILE,
  sourceLanguage: "de",
  targetLanguage: "en",
  mode: "strict_translation",
};

/* ------------------------------------------------------------------ tests */

test("an unauthenticated request is rejected", async () => {
  const { status } = await post(VALID_BODY, { auth: false });
  assert.equal(status, 401);
});

test("with no provider configured the endpoint refuses, fail closed", async () => {
  // The Phase 2A data-protection blocker as an HTTP contract: the feature is
  // fully implemented and still cannot transmit anything.
  const { status, body } = await post(VALID_BODY);
  assert.equal(status, 503);
  assert.equal(body.error, "document_translation_provider_not_configured");
  assert.equal(body.ok, false);
});

test("no alternative document source is accepted", async () => {
  for (const key of [
    "text", "content", "url", "file", "upload", "externalUrl",
    "documentText", "html", "base64", "prompt", "systemPrompt",
  ]) {
    const { status, body } = await post({ ...VALID_BODY, [key]: "arbitrary payload" });
    assert.equal(status, 400, `${key} was not rejected`);
    assert.equal(body.ok, false);
  }
});

test("an unknown key is rejected rather than ignored", async () => {
  const { status } = await post({ ...VALID_BODY, documentId: "doc-somebody-elses" });
  assert.equal(status, 400);
});

test("a missing fileId is rejected", async () => {
  const { fileId, ...withoutFile } = VALID_BODY;
  assert.ok(fileId);
  const { status } = await post(withoutFile);
  assert.equal(status, 400);
});

test("an unsupported target language is rejected before anything is loaded", async () => {
  for (const targetLanguage of ["tr", "ar", "xx", ""]) {
    const { status, body } = await post({ ...VALID_BODY, targetLanguage });
    assert.equal(status, 400, targetLanguage);
    assert.equal(body.error, "translation_target_language_unsupported");
  }
});

test("an unknown mode is rejected", async () => {
  for (const mode of ["summarise", "strict", "plain", ""]) {
    const { status, body } = await post({ ...VALID_BODY, mode });
    assert.equal(status, 400, mode);
    assert.equal(body.error, "translation_mode_invalid");
  }
});

test("an unsupported source language is refused", async () => {
  const { status, body } = await post({ ...VALID_BODY, sourceLanguage: "en" });
  assert.equal(status, 422);
  assert.equal(body.error, "document_source_language_unsupported");
});

test("another patient's document is not found", async () => {
  const { status, body } = await post(VALID_BODY, { userId: OTHER });
  assert.equal(status, 404);
  assert.equal(body.error, "document_not_found");
});

test("an unknown document is not found", async () => {
  const { status } = await post(VALID_BODY, { documentId: "doc-does-not-exist" });
  assert.equal(status, 404);
});

test("a file from another document is not found", async () => {
  const { status, body } = await post({ ...VALID_BODY, fileId: "file-elsewhere" });
  assert.equal(status, 404);
  assert.equal(body.error, "file_not_found");
});

test("an excluded document type is refused", async () => {
  for (const type of ["other", "lab", "prescription_info", "imaging"]) {
    documents[0].type = type;
    const { status, body } = await post(VALID_BODY);
    assert.equal(status, 422, type);
    assert.equal(body.error, "document_type_not_translatable");
  }
  documents[0].type = "report";
});

test("a revoked practice link is refused", async () => {
  links[0].status = "revoked";
  const { status, body } = await post(VALID_BODY);
  assert.equal(status, 409);
  assert.equal(body.error, "link_not_active");
  links[0].status = "active";
});

test("a revoked share is refused", async () => {
  shares[0].status = "revoked";
  const { status, body } = await post(VALID_BODY);
  assert.equal(status, 410);
  assert.equal(body.error, "document_unavailable");
  shares[0].status = "active";
});

test("the feature flag closes the endpoint", async () => {
  process.env.ENABLE_DOCUMENT_TRANSLATION = "false";
  try {
    const { status, body } = await post(VALID_BODY);
    assert.equal(status, 404);
    assert.equal(body.error, "feature_disabled");
  } finally {
    process.env.ENABLE_DOCUMENT_TRANSLATION = "true";
// Every request here comes from one loopback address; without this the suite
// would throttle itself rather than test the endpoint. The IP limiter's own
// behaviour is not asserted here; the limit that actually matters — one
// transformation at a time per patient — is covered in the service suite.
process.env.DOCUMENT_TRANSLATION_IP_MAX = "500";
  }
});

test("responses never disclose provider or internal detail", async () => {
  const { body } = await post(VALID_BODY);
  const serialised = JSON.stringify(body);
  for (const leak of ["apiKey", "baseURL", "baseUrl", "sk-", "stack", "openai", "Error:"]) {
    assert.ok(!serialised.includes(leak), `response leaked ${leak}: ${serialised}`);
  }
  // Only a stable code, nothing else.
  assert.deepEqual(Object.keys(body).sort(), ["error", "ok"]);
});
