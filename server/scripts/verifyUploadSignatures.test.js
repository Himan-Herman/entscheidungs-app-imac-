/**
 * Phase 6b.2 — an upload is what it claims to be, and its name is never a path.
 *
 * ── The thing being fixed ───────────────────────────────────────────────────
 * `file.mimetype` on a multipart part is written by the client. Every
 * `fileFilter` in this codebase reads it and nothing checked it against the
 * bytes, so an allowlist of types was, on its own, an allowlist of strings the
 * sender chose. Some paths did check — audio containers, one PDF header, one
 * image sniff — and each had its own private table. The paths with no table at
 * all were invisible for exactly that reason: nowhere listed what was covered.
 *
 * There is now one table (utils/fileSignature.js) and this suite asserts two
 * things about it: that it is actually right about the formats, and that every
 * upload path in the product goes through it.
 *
 * ── On filenames ────────────────────────────────────────────────────────────
 * A storage key is composed server-side. The name a person chose is metadata
 * shown back to them and nothing else — never joined onto a directory, never
 * part of a key. The tests below cover traversal, absolute paths, separators of
 * both kinds, control characters, and lengths.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(SERVER, rel), "utf8");

import "dotenv/config";
const { prisma } = await import("../lib/prisma.js");
const { uploadPracticeDocumentFile } = await import(
  "../services/practiceDocument/practiceDocumentService.js"
);

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

test.after(async () => {
  if (dbAvailable) await prisma.$disconnect();
});

const {
  assertDeclaredTypeMatchesBytes,
  FileSignatureError,
  KNOWN_SIGNATURE_MIMES,
  normalizeMime,
  safeDisplayFilename,
  signatureMatches,
} = await import("../utils/fileSignature.js");

/* ────────────────────────────────────── real openings for each known type */

const REAL = {
  "application/pdf": Buffer.from("%PDF-1.7\n1 0 obj"),
  "application/msword": Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.alloc(64),
  ]),
  "image/png": Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
  ]),
  "image/jpeg": Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]),
  "image/webp": Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.alloc(4),
    Buffer.from("WEBP"),
    Buffer.alloc(64),
  ]),
  "audio/webm": Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64)]),
  "audio/ogg": Buffer.concat([Buffer.from("OggS"), Buffer.alloc(64)]),
  "audio/mp4": Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(64)]),
  "audio/mpeg": Buffer.concat([Buffer.from([0x49, 0x44, 0x33]), Buffer.alloc(64)]),
  "audio/wav": Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.alloc(4),
    Buffer.from("WAVE"),
    Buffer.alloc(64),
  ]),
};

test("the table has a real sample for every type it claims to know", () => {
  // Otherwise a type could be added to the table and never actually exercised.
  assert.deepEqual(
    KNOWN_SIGNATURE_MIMES.filter((m) => !REAL[m]),
    [],
    "a known type has no sample in this suite",
  );
});

test("a genuine file of each type is recognised", () => {
  for (const [mime, buffer] of Object.entries(REAL)) {
    assert.equal(signatureMatches(buffer, mime), true, `${mime} was not recognised`);
  }
});

test("no type is recognised as any other type", () => {
  // The full cross product. This is what catches a signature that is too loose
  // to tell two formats apart — the RIFF case, where WAV and WebP open with the
  // same four bytes.
  for (const [declared] of Object.entries(REAL)) {
    for (const [actual, buffer] of Object.entries(REAL)) {
      if (declared === actual) continue;
      assert.equal(
        signatureMatches(buffer, declared),
        false,
        `a ${actual} passed as ${declared}`,
      );
    }
  }
});

test("a payload with no recognisable opening is refused", () => {
  for (const junk of [
    Buffer.alloc(0),
    Buffer.alloc(4096),
    Buffer.from("<?php system($_GET[0]); ?>"),
    Buffer.from("#!/bin/sh\nrm -rf /"),
    Buffer.from("<svg onload=alert(1)>"),
    Buffer.from("MZ"), // a Windows executable
  ]) {
    for (const mime of KNOWN_SIGNATURE_MIMES) {
      assert.equal(signatureMatches(junk, mime), false, `junk passed as ${mime}`);
    }
  }
});

test("a type the table knows nothing about is never a pass", () => {
  for (const mime of ["text/html", "image/svg+xml", "application/x-httpd-php", "", "*/*"]) {
    assert.equal(signatureMatches(REAL["image/png"], mime), false, `${mime} was accepted`);
  }
});

test("codec parameters and casing do not change the answer", () => {
  assert.equal(signatureMatches(REAL["audio/webm"], "audio/webm;codecs=opus"), true);
  assert.equal(signatureMatches(REAL["image/png"], "IMAGE/PNG"), true);
  assert.equal(normalizeMime(" Audio/WEBM ;codecs=opus"), "audio/webm");
});

/* ───────────────────────────────────────── the feature-level assertion */

test("the allowlist and the bytes are two separate conditions", () => {
  const allowed = ["image/png", "image/jpeg"];

  // Right bytes, type the feature does not accept.
  assert.throws(
    () => assertDeclaredTypeMatchesBytes(REAL["application/pdf"], "application/pdf", allowed),
    (err) => err instanceof FileSignatureError && err.code === "file_type_not_allowed",
  );

  // Accepted type, wrong bytes — the case a declared-type allowlist misses.
  assert.throws(
    () => assertDeclaredTypeMatchesBytes(REAL["application/pdf"], "image/png", allowed),
    (err) => err instanceof FileSignatureError && err.code === "file_type_mismatch",
  );

  // Both right.
  assert.doesNotThrow(() =>
    assertDeclaredTypeMatchesBytes(REAL["image/png"], "image/png", allowed),
  );
});

test("a refusal does not describe what the payload actually was", () => {
  // Telling the sender which format they DID send says how close they came.
  try {
    assertDeclaredTypeMatchesBytes(REAL["application/pdf"], "image/png", ["image/png"]);
    assert.fail("should have thrown");
  } catch (err) {
    const text = JSON.stringify({ message: err.message, details: err.details });
    assert.ok(!text.includes("pdf"), "the refusal named the real format");
    assert.equal(err.details.declared, "image/png", "only the claim is echoed back");
  }
});

/* ───────────────────────────────────────────────────────────── filenames */

test("a filename never survives as a path", () => {
  const cases = [
    ["../../etc/passwd", "passwd"],
    ["../../../../../../root/.ssh/id_rsa", "id_rsa"],
    ["/etc/shadow", "shadow"],
    ["C:\\Windows\\System32\\evil.exe", "evil.exe"],
    ["a/b/c/report.pdf", "report.pdf"],
    ["..", "upload"],
    [".", "upload"],
    ["...", "upload"],
    ["", "upload"],
    [null, "upload"],
    [undefined, "upload"],
    [".hidden", "hidden"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(safeDisplayFilename(input), expected, `${String(input)} was not neutralised`);
  }
});

test("a filename carries no control characters", () => {
  const nul = `befund${String.fromCharCode(0)}.pdf`;
  assert.equal(safeDisplayFilename(nul), "befund.pdf", "a NUL byte survived");

  const mixed = `a${String.fromCharCode(9)}b${String.fromCharCode(10)}c${String.fromCharCode(127)}.png`;
  const cleaned = safeDisplayFilename(mixed);
  assert.ok(
    ![...cleaned].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
    `control characters survived in ${JSON.stringify(cleaned)}`,
  );
});

test("a filename is bounded in length but keeps its unicode", () => {
  const long = `${"ü".repeat(500)}.pdf`;
  assert.ok(safeDisplayFilename(long).length <= 180);

  // Non-ASCII names are ordinary here — a German or Arabic filename is not
  // suspicious and must not be mangled into unreadability.
  assert.equal(safeDisplayFilename("Impfpass Röteln.pdf"), "Impfpass Röteln.pdf");
  assert.equal(safeDisplayFilename("تقرير.pdf"), "تقرير.pdf");
});

/* ─────────────────────────── every upload path goes through the one table */

test("the document upload actually refuses a mismatched payload", { skip }, async () => {
  /*
   * The behavioural half, and the reason it exists.
   *
   * The static check below reads the source for evidence that a path consults
   * the shared table. That is worth having — a new route with no check at all
   * is caught by simply not appearing there — but it cannot tell a live call
   * from a dead one: wrapping the condition in `if (false && …)` leaves the
   * text intact and the guard green. A mutation demonstrated exactly that, so
   * the most valuable path is exercised for real instead.
   */
  const stamp = `${Date.now()}${Math.round(Math.random() * 1e5)}`;
  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `usig-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });
  const [patient, owner] = await Promise.all([mk("p"), mk("o")]);
  const practice = await prisma.practiceProfile.create({
    data: { userId: owner.id, practiceName: "Sig", publicSlug: `usig-${stamp}`, isActive: true },
  });
  const link = await prisma.practicePatientLink.create({
    data: { practiceProfileId: practice.id, patientUserId: patient.id, status: "active" },
  });
  const doc = await prisma.practiceDocument.create({
    data: {
      practiceProfileId: practice.id,
      practicePatientLinkId: link.id,
      patientUserId: patient.id,
      title: "Befund",
      status: "draft",
      createdByUserId: owner.id,
    },
  });

  try {
    // A PDF announcing itself as a PNG. Both types are on the allowlist, so a
    // declared-type check alone waves this through.
    await assert.rejects(
      () =>
        uploadPracticeDocumentFile(doc.id, link.id, practice.id, {
          buffer: REAL["application/pdf"],
          originalFileName: "befund.png",
          mimeType: "image/png",
        }),
      /validation_invalid_file_type/,
      "a payload that is not what it claims was stored",
    );

    // Nothing was written on the way to the refusal.
    assert.equal(
      await prisma.practiceDocumentFile.count({ where: { documentId: doc.id } }),
      0,
      "a refused upload left a file row behind",
    );

    // And the honest case still works, so the refusal above is about the
    // mismatch and not about the path being broken.
    await uploadPracticeDocumentFile(doc.id, link.id, practice.id, {
      buffer: REAL["application/pdf"],
      originalFileName: "befund.pdf",
      mimeType: "application/pdf",
    });
    assert.equal(await prisma.practiceDocumentFile.count({ where: { documentId: doc.id } }), 1);
  } finally {
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } });
  }
});

test("no upload path validates a type without also checking the bytes", () => {
  /*
   * The completeness half. Each entry names a place that receives a file and
   * the evidence that it consults the shared table — directly, or through a
   * policy module that does.
   *
   * A new upload route that trusts `file.mimetype` alone is exactly the failure
   * this catches, and it is caught by the route not appearing here at all.
   */
  const paths = [
    ["practice documents", "services/practiceDocument/practiceDocumentService.js", /signatureMatches\(/],
    ["practice logo", "routes/practiceSettings.js", /signatureMatches\(/],
    ["patient avatar", "routes/accountPatientPortal.js", /assertDeclaredTypeMatchesBytes\(/],
    ["vaccination scans", "routes/patientVaccinations.js", /assertDeclaredTypeMatchesBytes\(/],
    ["message dictation", "services/messageSpeech/messageSttPolicy.js", /audioContainerMatches\(/],
    ["symptom voice", "services/symptomVoice/symptomVoicePolicy.js", /audioContainerMatches\(/],
    ["Pre-Visit voice", "services/preVisitVoice/preVisitVoicePolicy.js", /audioContainerMatches\(/],
    ["doctor-contact PDF", "routes/doctorContacts.js", /PDF_MAGIC/],
  ];

  for (const [label, file, evidence] of paths) {
    assert.match(read(file), evidence, `${label} no longer checks the bytes`);
  }
});

test("the audio check reads the shared table rather than its own copy", () => {
  const src = read("services/audioUpload/audioContainer.js");
  assert.match(src, /from "\.\.\/\.\.\/utils\/fileSignature\.js"/, "the audio module went private again");
  assert.ok(
    !/0x1a,\s*0x45,\s*0xdf,\s*0xa3/.test(src),
    "the audio module has its own byte patterns again — there must be one table",
  );
});

test("a storage key is composed by the server, never from the uploader's name", () => {
  const local = read("services/practiceDocument/storage/localStorage.js");
  assert.match(local, /crypto\.randomUUID\(\)/, "the document key is no longer server-generated");
  assert.match(local, /replace\(/, "the name is no longer sanitised before it joins the key");

  const vacc = read("routes/patientVaccinations.js");
  assert.match(
    vacc,
    /documentKey: key/,
    "the vaccination key assignment moved — re-check what it is built from",
  );
  assert.ok(
    !/vaccinations\/\$\{userId\}\/\$\{existing\.id\}_\$\{Date\.now\(\)\}_\$\{req\.file\.originalname/.test(vacc),
    "the vaccination storage key is built from the uploader's filename again",
  );

  for (const f of [
    "services/account/userAvatarStorage.js",
    "services/practiceSettings/practiceLogoStorage.js",
  ]) {
    assert.match(read(f), /crypto\.randomUUID\(\)/, `${f} no longer generates its own key`);
  }
});
