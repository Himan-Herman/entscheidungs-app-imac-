/**
 * Phase 6b.3 — a vaccination certificate is stored, retrievable, and scoped.
 *
 * ── What was wrong ──────────────────────────────────────────────────────────
 * The upload route accepted the file, wrote `documentKey`, `documentName` and
 * `documentMime`, and discarded the buffer. `hasDocument` then reported `true`
 * to the patient and to their practice, and no route existed anywhere that
 * could have fetched the document. Three further layers were broken behind
 * that: the client posted the part under a name the server does not read, so
 * every upload arrived empty; the call site swallowed the resulting error; and
 * the page read a field the API does not return. A patient who photographed
 * their vaccination card was told it was attached.
 *
 * ── What these tests hold in place ──────────────────────────────────────────
 * Storage is not the interesting part — the boundary is. A vaccination
 * certificate is a medical record belonging to one patient, visible to a
 * practice only through one care relationship, so the download has to answer
 * to the same permission, the same consent and the same context filter as the
 * list it appears in. The A1-versus-A2 case is the one that separates a
 * boundary drawn at the relationship from one drawn at the practice.
 *
 * The last two tests cover the ordering: there is no transaction spanning a
 * filesystem and a database, so one failure mode has to be chosen. A file with
 * no row is invisible and reclaimable; a row with no file is the defect above.
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-vaccination-doc";
process.env.ENABLE_VACCINATION_PASS = "true";

// A scratch root, so nothing is written next to the real store.
const STORAGE_ROOT = await fs.mkdtemp(path.join(os.tmpdir(), "vacc-doc-test-"));
process.env.VACCINATION_DOCUMENT_STORAGE_DIR = STORAGE_ROOT;

const { prisma } = await import("../lib/prisma.js");
const { requireAuth } = await import("../middleware/requireAuth.js");
const { default: patientVaccinationsRouter } = await import("../routes/patientVaccinations.js");
const { default: practicePatientVaccinationsRouter } = await import(
  "../routes/practicePatientVaccinations.js"
);
const { isStoredVaccinationKey, vaccinationDocumentStorage } = await import(
  "../services/vaccination/vaccinationDocumentStorage.js"
);

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

const app = express();
app.use(express.json());
app.use("/api/patient/vaccinations", requireAuth, patientVaccinationsRouter);
app.use(
  "/api/practice/patients/:linkId/vaccinations",
  requireAuth,
  practicePatientVaccinationsRouter,
);
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const stamp = `${Date.now()}${crypto.randomInt(1e5)}`;
const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

/* ─────────────────────────────────────────────────── sample payloads */

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("impfausweis-bilddaten"),
]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("impfausweis-pdf")]);

let W;

/** Uploads a file to one entry as one user. */
async function upload(entryId, actorUserId, { buffer, mime, filename }) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime }), filename);
  const res = await fetch(`${origin}/api/patient/vaccinations/${entryId}/document`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token(actorUserId)}` },
    body: form,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Fetches a certificate as the patient. */
async function patientDownload(entryId, actorUserId) {
  const res = await fetch(`${origin}/api/patient/vaccinations/${entryId}/document`, {
    headers: { Authorization: `Bearer ${token(actorUserId)}` },
  });
  return {
    status: res.status,
    headers: res.headers,
    buffer: Buffer.from(await res.arrayBuffer()),
  };
}

/** Fetches a certificate as a practice, through one care relationship. */
async function practiceDownload(linkId, entryId, actorUserId) {
  const res = await fetch(
    `${origin}/api/practice/patients/${linkId}/vaccinations/${entryId}/document`,
    { headers: { Authorization: `Bearer ${token(actorUserId)}` } },
  );
  return {
    status: res.status,
    headers: res.headers,
    buffer: Buffer.from(await res.arrayBuffer()),
  };
}

test.before(async () => {
  if (!dbAvailable) return;

  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `vdoc-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });
  const [patient, otherPatient, ownerA, ownerB, doctorA, doctorB] = await Promise.all([
    mk("p"),
    mk("q"),
    mk("oa"),
    mk("ob"),
    mk("da"),
    mk("db"),
  ]);

  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "A", publicSlug: `vdoca-${stamp}`, isActive: true },
  });
  const practiceB = await prisma.practiceProfile.create({
    data: { userId: ownerB.id, practiceName: "B", publicSlug: `vdocb-${stamp}`, isActive: true },
  });
  /*
   * The clinical reader is a doctor with an APPROVED clinical role, not the
   * practice owner.
   *
   * Owning a practice does not grant clinical access in this product: the
   * vaccination permission lives in CLINICAL_PERMISSIONS and is contributed
   * only by an active, approved clinical role. That is a deliberate separation
   * of organizational power from treatment access, and the first draft of this
   * suite got it wrong — it probed as the owner, was refused with 403, and the
   * refusal was correct. Both are kept below, so the tests measure the clinical
   * boundary as well as the link boundary.
   */
  const clinical = (practiceProfileId, userId) => ({
    practiceProfileId,
    userId,
    role: "doctor",
    status: "active",
    acceptedAt: new Date(),
    clinicalRole: "doctor",
    clinicalRoleStatus: "active",
    clinicalRoleApprovedAt: new Date(),
  });
  await prisma.practiceMember.createMany({
    data: [
      { practiceProfileId: practiceA.id, userId: ownerA.id, role: "owner", status: "active", acceptedAt: new Date() },
      { practiceProfileId: practiceB.id, userId: ownerB.id, role: "owner", status: "active", acceptedAt: new Date() },
      clinical(practiceA.id, doctorA.id),
      clinical(practiceB.id, doctorB.id),
    ],
  });

  // A2 is the same practice and the same human — a second care relationship.
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
      },
    });
  const [a1, a2, b1] = await Promise.all([
    mkLink(practiceA.id),
    mkLink(practiceA.id, relative.id),
    mkLink(practiceB.id),
  ]);

  // Consent on every link, so a refusal below is about the boundary and not
  // about a consent that would have refused everyone.
  await prisma.consentRecord.createMany({
    data: [a1, a2, b1].map((l) => ({
      patientUserId: patient.id,
      practiceProfileId: l.practiceProfileId,
      practicePatientLinkId: l.id,
      consentType: "vaccinations_access",
      status: "granted",
    })),
  });

  W = { patient, otherPatient, ownerA, ownerB, doctorA, doctorB, practiceA, practiceB, a1, a2, b1 };
});

test.after(async () => {
  if (dbAvailable) {
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } });
    await prisma.$disconnect();
  }
  server.close();
  await fs.rm(STORAGE_ROOT, { recursive: true, force: true });
});

/** A vaccination entry owned by the patient, optionally bound to one link. */
async function makeEntry(linkId = null) {
  return prisma.vaccinationEntry.create({
    data: {
      userId: W.patient.id,
      vaccineName: "Tetanus",
      disease: "Tetanus",
      vaccinationDate: new Date("2026-01-15"),
      dataScope: linkId ? "practice_contextual" : "patient_global",
      contextPracticePatientLinkId: linkId,
    },
  });
}

/* ═══════════════════════════════════════════════ the file actually exists */

test("an uploaded certificate is stored and comes back byte for byte", { skip }, async () => {
  const entry = await makeEntry();
  const up = await upload(entry.id, W.patient.id, {
    buffer: PNG,
    mime: "image/png",
    filename: "impfausweis.png",
  });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.equal(up.body.entry.hasDocument, true);

  const got = await patientDownload(entry.id, W.patient.id);
  assert.equal(got.status, 200);
  assert.deepEqual(got.buffer, PNG, "what came back is not what went in");
});

test("the row points at a file that is really on disk", { skip }, async () => {
  const entry = await makeEntry();
  await upload(entry.id, W.patient.id, { buffer: PDF, mime: "application/pdf", filename: "a.pdf" });

  const row = await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } });
  assert.ok(isStoredVaccinationKey(row.documentKey), "the key is not one this server wrote");
  assert.equal(await vaccinationDocumentStorage.exists(row.documentKey), true);
});

test("the download is sent as an attachment that cannot be sniffed", { skip }, async () => {
  const entry = await makeEntry();
  await upload(entry.id, W.patient.id, { buffer: PDF, mime: "application/pdf", filename: "b.pdf" });

  const got = await patientDownload(entry.id, W.patient.id);
  assert.match(got.headers.get("content-disposition") ?? "", /^attachment;/);
  assert.equal(got.headers.get("x-content-type-options"), "nosniff");
  assert.match(got.headers.get("cache-control") ?? "", /no-store/);
  assert.match(got.headers.get("cache-control") ?? "", /private/);
});

/* ══════════════════════════════════════ hasDocument tells the truth */

test("an entry with no upload does not claim a document", { skip }, async () => {
  const entry = await makeEntry();
  const row = await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } });
  assert.equal(row.documentKey, null);

  const got = await patientDownload(entry.id, W.patient.id);
  assert.equal(got.status, 404);
});

test("a key written before storage existed does not claim a document", { skip }, async () => {
  // Exactly what the broken code left behind: a key naming a file that was
  // never written. Reporting these as present is what misled patients.
  const entry = await makeEntry();
  await prisma.vaccinationEntry.update({
    where: { id: entry.id },
    data: {
      documentKey: `vaccinations/${W.patient.id}/${entry.id}_legacy`,
      documentName: "alt.png",
      documentMime: "image/png",
    },
  });

  const res = await fetch(`${origin}/api/patient/vaccinations`, {
    headers: { Authorization: `Bearer ${token(W.patient.id)}` },
  });
  const body = await res.json();
  const listed = body.entries.find((e) => e.id === entry.id);
  assert.equal(listed.hasDocument, false, "a dangling legacy key still claims a document");

  const got = await patientDownload(entry.id, W.patient.id);
  assert.equal(got.status, 404);
});

/* ═══════════════════════════════════════════════════ who may fetch it */

test("another patient cannot fetch it, even knowing the entry id", { skip }, async () => {
  const entry = await makeEntry();
  await upload(entry.id, W.patient.id, { buffer: PNG, mime: "image/png", filename: "c.png" });

  const got = await patientDownload(entry.id, W.otherPatient.id);
  assert.equal(got.status, 404);
  assert.ok(!got.buffer.equals(PNG));
});

test("another patient cannot upload onto someone else's entry", { skip }, async () => {
  const entry = await makeEntry();
  const up = await upload(entry.id, W.otherPatient.id, {
    buffer: PNG,
    mime: "image/png",
    filename: "d.png",
  });
  assert.equal(up.status, 404);

  const row = await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } });
  assert.equal(row.documentKey, null, "a stranger attached a document");
});

test("the practice holding the link may fetch it", { skip }, async () => {
  const entry = await makeEntry(W.a1.id);
  await upload(entry.id, W.patient.id, { buffer: PNG, mime: "image/png", filename: "e.png" });

  const got = await practiceDownload(W.a1.id, entry.id, W.doctorA.id);
  assert.equal(got.status, 200);
  assert.deepEqual(got.buffer, PNG);
});

test("the same practice through a DIFFERENT link may not", { skip }, async () => {
  // A2 is practice A, and the same person. A boundary drawn at the practice
  // lets this through; one drawn at the care relationship does not.
  const entry = await makeEntry(W.a1.id);
  await upload(entry.id, W.patient.id, { buffer: PNG, mime: "image/png", filename: "f.png" });

  const got = await practiceDownload(W.a2.id, entry.id, W.doctorA.id);
  assert.equal(got.status, 404);
  assert.ok(!got.buffer.equals(PNG));
});

test("another practice may not, through its own link or through A's", { skip }, async () => {
  const entry = await makeEntry(W.a1.id);
  await upload(entry.id, W.patient.id, { buffer: PNG, mime: "image/png", filename: "g.png" });

  for (const [label, linkId] of [["its own link", W.b1.id], ["A's link", W.a1.id]]) {
    const got = await practiceDownload(linkId, entry.id, W.doctorB.id);
    assert.notEqual(got.status, 200, `practice B reached the certificate through ${label}`);
    assert.ok(!got.buffer.equals(PNG));
  }
});

test("a global certificate is visible to a linked practice, a contextual one only to its own", { skip }, async () => {
  // The classification is the product's, not this test's: a record the patient
  // recorded outside any treatment is global; one recorded inside a care
  // relationship belongs to that relationship. Both halves are asserted so the
  // refusal above is a boundary and not simply "practices see nothing".
  const globalEntry = await makeEntry(null);
  await upload(globalEntry.id, W.patient.id, { buffer: PDF, mime: "application/pdf", filename: "h.pdf" });

  const viaA1 = await practiceDownload(W.a1.id, globalEntry.id, W.doctorA.id);
  assert.equal(viaA1.status, 200, "a global certificate is not reachable at all");

  const contextual = await makeEntry(W.a2.id);
  await upload(contextual.id, W.patient.id, { buffer: PDF, mime: "application/pdf", filename: "i.pdf" });
  const wrongContext = await practiceDownload(W.a1.id, contextual.id, W.doctorA.id);
  assert.equal(wrongContext.status, 404, "A2's certificate was reachable through A1");
});

/* ═══════════════════════════════════════════════ what may be uploaded */

test("bytes that disagree with the declared type are refused", { skip }, async () => {
  const entry = await makeEntry();
  const up = await upload(entry.id, W.patient.id, {
    buffer: PDF, // a PDF …
    mime: "image/png", // … announcing itself as an image
    filename: "spoofed.png",
  });
  assert.equal(up.status, 400);
  assert.equal(up.body.error, "file_type_invalid");

  const row = await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } });
  assert.equal(row.documentKey, null, "a refused upload was recorded anyway");
});

test("a type outside the allowlist is refused even with matching bytes", { skip }, async () => {
  const entry = await makeEntry();
  const up = await upload(entry.id, W.patient.id, {
    buffer: Buffer.from("<svg onload=alert(1)>"),
    mime: "image/svg+xml",
    filename: "x.svg",
  });
  assert.ok(up.status >= 400);

  const row = await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } });
  assert.equal(row.documentKey, null);
});

test("a traversal filename becomes a display name and never a path", { skip }, async () => {
  const entry = await makeEntry();
  const up = await upload(entry.id, W.patient.id, {
    buffer: PNG,
    mime: "image/png",
    filename: "../../../../etc/passwd.png",
  });
  assert.equal(up.status, 200, JSON.stringify(up.body));

  const row = await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } });
  assert.equal(row.documentName, "passwd.png", "the path survived into the display name");
  assert.ok(!row.documentKey.includes(".."), "the key contains a traversal sequence");
  assert.ok(!row.documentKey.includes("passwd"), "the uploader's name reached the key");

  // And the file really is inside the store, not beside it.
  const resolved = path.resolve(STORAGE_ROOT, row.documentKey);
  assert.ok(
    resolved.startsWith(path.resolve(STORAGE_ROOT) + path.sep),
    `the file was written outside the store: ${resolved}`,
  );
  assert.equal(await vaccinationDocumentStorage.exists(row.documentKey), true);
});

/* ═══════════════════════════════════ failure modes and lifecycle */

test("a storage failure leaves no row claiming a document", { skip }, async () => {
  const entry = await makeEntry();
  const original = vaccinationDocumentStorage.putDocument;
  vaccinationDocumentStorage.putDocument = async () => {
    throw new Error("disk on fire");
  };
  try {
    const up = await upload(entry.id, W.patient.id, {
      buffer: PNG,
      mime: "image/png",
      filename: "j.png",
    });
    assert.ok(up.status >= 400, "a failed store reported success");
  } finally {
    vaccinationDocumentStorage.putDocument = original;
  }

  const row = await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } });
  assert.equal(row.documentKey, null, "the row claims a document that was never written");
  assert.equal(row.documentName, null);
});

test("a database failure after the write leaves no orphan behind", { skip }, async () => {
  // The compensating cleanup for the ordering this route chose. A file with no
  // row is invisible rather than harmful, but it should still not accumulate.
  const entry = await makeEntry();
  const before = await countStoredFiles();

  const original = prisma.vaccinationEntry.update;
  prisma.vaccinationEntry.update = async () => {
    throw new Error("database unavailable");
  };
  try {
    const up = await upload(entry.id, W.patient.id, {
      buffer: PNG,
      mime: "image/png",
      filename: "k.png",
    });
    assert.ok(up.status >= 400);
  } finally {
    prisma.vaccinationEntry.update = original;
  }

  assert.equal(await countStoredFiles(), before, "the orphaned file was not cleaned up");
});

test("replacing a certificate removes the one it replaced", { skip }, async () => {
  const entry = await makeEntry();
  await upload(entry.id, W.patient.id, { buffer: PNG, mime: "image/png", filename: "l.png" });
  const first = (await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } })).documentKey;

  await upload(entry.id, W.patient.id, { buffer: PDF, mime: "application/pdf", filename: "m.pdf" });
  const second = (await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } })).documentKey;

  assert.notEqual(first, second);
  assert.equal(await vaccinationDocumentStorage.exists(first), false, "the old file is still there");
  assert.equal(await vaccinationDocumentStorage.exists(second), true);
  assert.deepEqual((await patientDownload(entry.id, W.patient.id)).buffer, PDF);
});

test("deleting a certificate removes the file and the claim", { skip }, async () => {
  const entry = await makeEntry();
  await upload(entry.id, W.patient.id, { buffer: PNG, mime: "image/png", filename: "n.png" });
  const key = (await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } })).documentKey;

  const res = await fetch(`${origin}/api/patient/vaccinations/${entry.id}/document`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token(W.patient.id)}` },
  });
  assert.equal(res.status, 200);

  const row = await prisma.vaccinationEntry.findUnique({ where: { id: entry.id } });
  assert.equal(row.documentKey, null);
  assert.equal(await vaccinationDocumentStorage.exists(key), false, "the file outlived the entry");
  assert.equal((await patientDownload(entry.id, W.patient.id)).status, 404);
});

/** Every file currently in the scratch store. */
async function countStoredFiles() {
  let count = 0;
  const walk = async (dir) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) await walk(path.join(dir, e.name));
      else count += 1;
    }
  };
  await walk(STORAGE_ROOT);
  return count;
}

test("owning the practice is not clinical access", { skip }, async () => {
  /*
   * The separation this product draws on purpose: an owner holds every
   * organizational right and none of the clinical ones. A vaccination
   * certificate is treatment data, so reaching it takes an approved clinical
   * role — which the owner does not have merely by owning the place.
   *
   * Without this, the switch to `doctorA` above would look like a workaround
   * rather than the boundary it actually is.
   */
  const entry = await makeEntry(W.a1.id);
  await upload(entry.id, W.patient.id, { buffer: PNG, mime: "image/png", filename: "o.png" });

  const asOwner = await practiceDownload(W.a1.id, entry.id, W.ownerA.id);
  assert.equal(asOwner.status, 403, "the practice owner reached treatment data");
  assert.ok(!asOwner.buffer.equals(PNG));

  const asDoctor = await practiceDownload(W.a1.id, entry.id, W.doctorA.id);
  assert.equal(asDoctor.status, 200, "an approved clinical role was refused");
});
