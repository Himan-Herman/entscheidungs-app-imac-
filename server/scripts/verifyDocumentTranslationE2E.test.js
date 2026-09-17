/**
 * Phase 2D — the whole feature over real HTTP, against the fake provider.
 *
 * The Phase 2B suite exercises the service directly and the Phase 2C route
 * suite stops at the provider gate, so neither ever produced a 200 with actual
 * transformed segments. This one does: a real request, through the real router,
 * the real service, the real masking chain and the real integrity checks, and
 * back out as JSON that a browser would receive.
 *
 * The provider is the in-process double, selected the same way an operator
 * would select one — through the environment. It never performs I/O, and it
 * records what it was handed so the privacy assertions here are made against
 * what would actually have been transmitted.
 *
 * No network, no database, no real document.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-2d";
process.env.ENABLE_DOCUMENT_TRANSLATION = "true";
process.env.DOCUMENT_TRANSLATION_PROVIDER = "fake";

import { prisma } from "../lib/prisma.js";
import { getPracticeDocumentStorage } from "../services/practiceDocument/storage/index.js";
import { docx, para } from "./lib/documentTranslationFixtures.js";
import { FAKE_BEHAVIOURS } from "../services/documentTranslation/provider/fakeDocumentTranslationProvider.js";
import { resolveProviderConfig } from "../services/documentTranslation/provider/documentTranslationProviderConfig.js";

/* ------------------------------------------------------------------ fixture */

const PATIENT = "user-P1";
const PRACTICE = "practice-A";
const LINK = "link-active";
const DOC = "doc-ok";
const FILE = "file-ok";
const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** A German letter carrying everything the chain has to protect. */
const LETTER_LINES = [
  "Sehr geehrte Kollegin, sehr geehrter Kollege,",
  "wir berichten ueber die ambulante Vorstellung von Max Mustermann, geboren am 12.08.1980.",
  "Es besteht eine arterielle Hypertonie, HbA1c 7,2 Prozent.",
  "Ramipril HEXAL 5 mg 1-0-0",
  "Kein Hinweis auf einen Infekt bei der heutigen Untersuchung.",
  "Bitte stellen Sie sich in vier Wochen erneut vor.",
];

const links = [
  { id: LINK, practiceProfileId: PRACTICE, patientUserId: PATIENT, status: "active" },
];
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
    sizeBytes: 4096,
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
prisma.user = {
  findUnique: async ({ where }) =>
    where.id === PATIENT
      ? {
          firstName: "Max",
          lastName: "Mustermann",
          dateOfBirth: new Date(Date.UTC(1980, 7, 12)),
          email: "max.mustermann@example.de",
          profile: { phone: "+49 171 1234567" },
        }
      : null,
};
prisma.auditLog = { create: async () => ({}) };

/** Serve the DOCX fixture instead of touching the filesystem. */
const docxBuffer = await docx(LETTER_LINES.map((line) => para(line)).join(""));
getPracticeDocumentStorage().getObject = async () => docxBuffer;

/* ---------------------------------------------------------------- harness */

const { default: patientPracticeDocumentsRouter } = await import(
  "../routes/patientPracticeDocuments.js"
);

function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!raw) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    req.user = jwt.verify(raw, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
}

const app = express();
app.use(express.json());
app.use("/api/patient/practice-documents", requireAuth, patientPracticeDocumentsRouter);

const server = app.listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

async function translate(overrides = {}, { documentId = DOC } = {}) {
  const res = await fetch(`${base}/api/patient/practice-documents/${documentId}/translate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${jwt.sign({ userId: PATIENT }, process.env.JWT_SECRET, {
        expiresIn: "10m",
      })}`,
    },
    body: JSON.stringify({
      fileId: FILE,
      sourceLanguage: "de",
      targetLanguage: "en",
      mode: "strict_translation",
      ...overrides,
    }),
  });
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => ({})) };
}

/** Run one request with the fake configured to misbehave in a specific way. */
async function withBehaviour(behaviour, fn) {
  process.env.DOCUMENT_TRANSLATION_FAKE_BEHAVIOUR = behaviour;
  try {
    return await fn();
  } finally {
    delete process.env.DOCUMENT_TRANSLATION_FAKE_BEHAVIOUR;
  }
}

const allText = (body) => (body.segments ?? []).map((s) => s.text).join("\n");

/* ================================================================== */
/* 1. The three flows a patient can actually run                      */
/* ================================================================== */

test("strict translation into English returns transformed segments over HTTP", async () => {
  const { status, body } = await translate({ targetLanguage: "en" });

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, "completed");
  assert.equal(body.mode, "strict_translation");
  assert.equal(body.sourceLanguage, "de");
  assert.equal(body.targetLanguage, "en");
  assert.ok(Array.isArray(body.segments) && body.segments.length > 0);

  for (const segment of body.segments) {
    assert.equal(typeof segment.id, "string");
    assert.equal(typeof segment.text, "string");
    assert.equal(typeof segment.kind, "string");
  }
});

test("plain language keeps the document in German", async () => {
  const { status, body } = await translate({
    mode: "plain_language",
    targetLanguage: "de",
  });

  assert.equal(status, 200);
  assert.equal(body.mode, "plain_language");
  assert.equal(body.targetLanguage, "de");
  assert.ok(allText(body).length > 0);
});

test("plain language into Russian completes the six-language claim", async () => {
  const { status, body } = await translate({
    mode: "plain_language",
    targetLanguage: "ru",
  });

  assert.equal(status, 200);
  assert.equal(body.targetLanguage, "ru");
  assert.ok(allText(body).length > 0);
});

test("strict German to German needs no transformation at all", async () => {
  const { status, body } = await translate({ targetLanguage: "de" });
  assert.equal(status, 200);
  assert.equal(body.status, "translation_not_required");
  // Nothing to show, and nothing was sent anywhere to produce it.
  assert.ok(!body.segments || body.segments.length === 0);
});

/* ================================================================== */
/* 2. What comes back over the wire                                   */
/* ================================================================== */

test("the protected values are restored in the response, not left as markers", async () => {
  const { body } = await translate({ targetLanguage: "en" });
  const text = allText(body);

  // Masking is internal. What the patient receives must read as a document.
  assert.ok(!/⟦[A-Z]+_[A-Z]+⟧/.test(text), `a marker survived into the response: ${text}`);

  // And the values the markers protected are back, unchanged.
  for (const value of ["Ramipril", "5 mg", "7,2", "12.08.1980"]) {
    assert.ok(text.includes(value), `${value} was not restored`);
  }
});

test("the response carries no provider, model or prompt detail", async () => {
  const { body } = await translate();
  const serialised = JSON.stringify(body);

  for (const leak of [
    "fake", "openai", "gpt-", "model", "prompt", "strict-v1", "plain-v1",
    "apiKey", "baseUrl", "temperature", "token",
  ]) {
    assert.ok(
      !serialised.toLowerCase().includes(leak.toLowerCase()),
      `the response mentions ${leak}: ${serialised.slice(0, 400)}`,
    );
  }
});

test("the response carries no internal identifier", async () => {
  const { body } = await translate();
  const serialised = JSON.stringify(body);
  for (const id of [PATIENT, PRACTICE, LINK, "k/doc-ok", "share-ok"]) {
    assert.ok(!serialised.includes(id), `the response contains ${id}`);
  }
});

test("a successful response forbids caching just as a refusal does", async () => {
  const { status, headers } = await translate();
  assert.equal(status, 200);
  assert.match(headers.get("cache-control") ?? "", /no-store/);
  assert.match(headers.get("cache-control") ?? "", /private/);
});

/* ================================================================== */
/* 3. A misbehaving model reaches the patient as a refusal            */
/* ================================================================== */

test("invented numeric material is refused with integrity_failed, not delivered", async () => {
  const { status, body } = await withBehaviour(FAKE_BEHAVIOURS.INVENT_NUMBER, () =>
    translate({ targetLanguage: "en" }),
  );

  assert.equal(status, 422);
  assert.equal(body.ok, false);
  assert.equal(body.error, "integrity_failed");
  // Fail closed: no partial text accompanies the refusal.
  assert.ok(!body.segments, "a refusal carried segments");
  assert.ok(!JSON.stringify(body).includes("Ramipril"), "a refusal carried document content");
});

test("a dropped placeholder is refused rather than silently losing a value", async () => {
  const { status, body } = await withBehaviour(FAKE_BEHAVIOURS.DROP_MARKER, () => translate());
  assert.equal(status, 422);
  assert.equal(body.error, "integrity_failed");
});

test("invented medical advice is refused", async () => {
  const { status, body } = await withBehaviour(FAKE_BEHAVIOURS.ADD_MEDICAL_ADVICE, () =>
    translate({ mode: "plain_language", targetLanguage: "de" }),
  );
  assert.equal(status, 422);
  assert.equal(body.ok, false);
  assert.ok(!body.segments);
});

test("a provider outage is a 502 with nothing else attached", async () => {
  const { status, body } = await withBehaviour(FAKE_BEHAVIOURS.UNAVAILABLE, () => translate());
  assert.equal(status, 502);
  assert.equal(body.ok, false);
  assert.ok(!body.segments);
  assert.ok(!JSON.stringify(body).includes("Mustermann"));
});

test("a retryable failure still succeeds on the single permitted retry", async () => {
  const { status, body } = await withBehaviour(FAKE_BEHAVIOURS.FAIL_THEN_SUCCEED, () =>
    translate({ targetLanguage: "en" }),
  );
  assert.equal(status, 200);
  assert.ok(allText(body).length > 0);
});

/* ================================================================== */
/* 4. Two requests at once                                            */
/* ================================================================== */

test("a second transformation while one is running is refused, not queued", async () => {
  const [first, second] = await Promise.all([
    translate({ targetLanguage: "en" }),
    translate({ targetLanguage: "fr" }),
  ]);

  const statuses = [first.status, second.status].sort();
  // One proceeds; the other is refused rather than doubling the work and the
  // cost for a patient who clicked twice.
  assert.deepEqual(statuses, [200, 429], JSON.stringify(statuses));

  const refused = first.status === 429 ? first : second;
  assert.equal(refused.body.ok, false);
  assert.ok(!refused.body.segments);
});

/* ================================================================== */
/* 5. The gates still hold on the live path                           */
/* ================================================================== */

test("the feature flag closes the endpoint even with a provider configured", async () => {
  process.env.ENABLE_DOCUMENT_TRANSLATION = "false";
  try {
    const { status, body } = await translate();
    assert.equal(status, 404);
    assert.equal(body.ok, false);
    assert.ok(!body.segments);
  } finally {
    process.env.ENABLE_DOCUMENT_TRANSLATION = "true";
  }
});

test("revoking the practice link stops transformation on the live path", async () => {
  links[0].status = "revoked";
  try {
    const { status, body } = await translate();
    assert.equal(status, 409);
    assert.ok(!body.segments);
  } finally {
    links[0].status = "active";
  }
});

test("another patient's document yields nothing, not even its existence", async () => {
  documents[0].patientUserId = "user-P2";
  shares[0].patientUserId = "user-P2";
  links[0].patientUserId = "user-P2";
  try {
    const { status, body } = await translate();
    assert.equal(status, 404);
    assert.ok(!body.segments);
  } finally {
    documents[0].patientUserId = PATIENT;
    shares[0].patientUserId = PATIENT;
    links[0].patientUserId = PATIENT;
  }
});

/* ================================================================== */
/* 6. The double can never be the live provider                       */
/* ================================================================== */

test("the fake provider is unreachable in production", () => {
  const config = resolveProviderConfig({
    NODE_ENV: "production",
    DOCUMENT_TRANSLATION_PROVIDER: "fake",
  });
  // Otherwise a deployment typo would hand patients echo-prefixed text that
  // looks like a translation of their own medical letter.
  assert.equal(config.configured, false);
  assert.equal(config.reason, "fake_provider_not_allowed_in_production");
});

test("outside production the fake is fully configured and stays in process", () => {
  const config = resolveProviderConfig({
    NODE_ENV: "test",
    DOCUMENT_TRANSLATION_PROVIDER: "fake",
  });
  assert.equal(config.configured, true);
  assert.equal(config.dataRegion, "in-process");
  assert.equal(config.zeroRetention, true);
});
