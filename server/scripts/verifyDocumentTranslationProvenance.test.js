/**
 * Provenance gate for patient-facing document translation.
 *
 * This is the security boundary of the feature: only a document that an
 * authorised practice released to THIS patient, over a still-valid
 * relationship, may reach any downstream processing.
 *
 * No database: Prisma is replaced by an in-memory adapter that evaluates the
 * generated `where` the way Prisma would, so the access filter is exercised as
 * a query rather than as post-hoc JavaScript. No development database is
 * touched, and no network call is possible.
 *
 * Fixture: patient P1 with an active link to practice A, plus revoked,
 * archived and invited links; a foreign patient P2 at the same practice; and
 * documents covering every rejection path.
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-doc-translation";
process.env.ENABLE_DOCUMENT_TRANSLATION = "true";

import { prisma } from "../lib/prisma.js";
import {
  assertTranslatableDocumentForPatient,
  TRANSLATION_LINK_STATUSES,
  TRANSLATABLE_MIME_TYPES,
} from "../services/documentTranslation/documentProvenanceGate.js";
import {
  TRANSLATION_ERRORS,
  TRANSLATION_MODES,
  TRANSLATABLE_DOCUMENT_TYPES,
} from "../services/documentTranslation/documentTranslationPolicy.js";
import {
  parseTranslationRequestBody,
  FORBIDDEN_SOURCE_KEYS,
} from "../services/documentTranslation/translationRequestContract.js";

/* ------------------------------------------------------------------ actors */

const P1 = "user-P1";
const P2 = "user-P2";

const PRACTICE_A = "practice-A";
const PRACTICE_B = "practice-B";

const LINK = {
  ACTIVE: "link-active",
  REVOKED: "link-revoked",
  ARCHIVED: "link-archived",
  INVITED: "link-invited",
  OTHER_PATIENT: "link-other-patient",
  OTHER_PRACTICE: "link-other-practice",
};

const DOC = {
  OK: "doc-ok",
  FOREIGN_PATIENT: "doc-foreign-patient",
  SHARE_REVOKED: "doc-share-revoked",
  SHARE_EXPIRED: "doc-share-expired",
  LINK_REVOKED: "doc-link-revoked",
  LINK_ARCHIVED: "doc-link-archived",
  LINK_INVITED: "doc-link-invited",
  NO_LINK: "doc-no-link",
  TYPE_OTHER: "doc-type-other",
  TYPE_PRESCRIPTION: "doc-type-prescription",
  TYPE_IMAGING: "doc-type-imaging",
  DELETED: "doc-deleted",
  DRAFT: "doc-draft",
  PRACTICE_MISMATCH: "doc-practice-mismatch",
  IMAGE_FILE: "doc-image-file",
  LAB: "doc-lab",
};

const FILE = {
  OK: "file-ok",
  FOREIGN: "file-foreign",
  IMAGE: "file-image",
  LAB: "file-lab",
};

const PAST = new Date(Date.now() - 60 * 60 * 1000);
const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

let links;
let documents;
let files;
let shares;

/* --------------------------------------------------- in-memory Prisma fake */

/** Equality-only `where` evaluation — the shape both queries actually use. */
function matches(row, where) {
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

function pdfFile(id, documentId, name = "befund.pdf") {
  return {
    id,
    documentId,
    storageKey: `k/${documentId}`,
    originalFileName: name,
    mimeType: "application/pdf",
    sizeBytes: 1024,
    createdAt: new Date(),
  };
}

function doc(overrides) {
  return {
    practicePatientLinkId: LINK.ACTIVE,
    practiceProfileId: PRACTICE_A,
    patientUserId: P1,
    type: "report",
    title: "Placeholder Title",
    description: null,
    status: "shared",
    createdByUserId: "user-doctor-A",
    sharedAt: new Date(),
    archivedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function share(documentId, overrides = {}) {
  return {
    id: `share-${documentId}`,
    documentId,
    patientUserId: P1,
    sharedByUserId: "user-doctor-A",
    status: "active",
    sharedAt: new Date(),
    revokedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

function installFake() {
  links = [
    { id: LINK.ACTIVE, practiceProfileId: PRACTICE_A, patientUserId: P1, status: "active" },
    { id: LINK.REVOKED, practiceProfileId: PRACTICE_A, patientUserId: P1, status: "revoked" },
    { id: LINK.ARCHIVED, practiceProfileId: PRACTICE_A, patientUserId: P1, status: "archived" },
    { id: LINK.INVITED, practiceProfileId: PRACTICE_A, patientUserId: P1, status: "invited" },
    { id: LINK.OTHER_PATIENT, practiceProfileId: PRACTICE_A, patientUserId: P2, status: "active" },
    { id: LINK.OTHER_PRACTICE, practiceProfileId: PRACTICE_B, patientUserId: P1, status: "active" },
  ];

  documents = [
    doc({ id: DOC.OK }),
    doc({ id: DOC.FOREIGN_PATIENT, patientUserId: P2, practicePatientLinkId: LINK.OTHER_PATIENT }),
    doc({ id: DOC.SHARE_REVOKED }),
    doc({ id: DOC.SHARE_EXPIRED }),
    doc({ id: DOC.LINK_REVOKED, practicePatientLinkId: LINK.REVOKED }),
    doc({ id: DOC.LINK_ARCHIVED, practicePatientLinkId: LINK.ARCHIVED }),
    doc({ id: DOC.LINK_INVITED, practicePatientLinkId: LINK.INVITED }),
    doc({ id: DOC.NO_LINK, practicePatientLinkId: null }),
    doc({ id: DOC.TYPE_OTHER, type: "other" }),
    doc({ id: DOC.TYPE_PRESCRIPTION, type: "prescription_info" }),
    doc({ id: DOC.TYPE_IMAGING, type: "imaging" }),
    doc({ id: DOC.DELETED, status: "deleted" }),
    doc({ id: DOC.DRAFT, status: "draft", sharedAt: null }),
    // Document says practice A, but its link belongs to practice B.
    doc({ id: DOC.PRACTICE_MISMATCH, practicePatientLinkId: LINK.OTHER_PRACTICE }),
    doc({ id: DOC.IMAGE_FILE }),
    doc({ id: DOC.LAB, type: "lab" }),
  ];

  files = [
    pdfFile(FILE.OK, DOC.OK),
    pdfFile(FILE.FOREIGN, DOC.FOREIGN_PATIENT),
    pdfFile(FILE.LAB, DOC.LAB),
    pdfFile(`f-${DOC.SHARE_REVOKED}`, DOC.SHARE_REVOKED),
    pdfFile(`f-${DOC.SHARE_EXPIRED}`, DOC.SHARE_EXPIRED),
    pdfFile(`f-${DOC.LINK_REVOKED}`, DOC.LINK_REVOKED),
    pdfFile(`f-${DOC.LINK_ARCHIVED}`, DOC.LINK_ARCHIVED),
    pdfFile(`f-${DOC.LINK_INVITED}`, DOC.LINK_INVITED),
    pdfFile(`f-${DOC.NO_LINK}`, DOC.NO_LINK),
    pdfFile(`f-${DOC.TYPE_OTHER}`, DOC.TYPE_OTHER),
    pdfFile(`f-${DOC.TYPE_PRESCRIPTION}`, DOC.TYPE_PRESCRIPTION),
    pdfFile(`f-${DOC.TYPE_IMAGING}`, DOC.TYPE_IMAGING),
    pdfFile(`f-${DOC.DELETED}`, DOC.DELETED),
    pdfFile(`f-${DOC.DRAFT}`, DOC.DRAFT),
    pdfFile(`f-${DOC.PRACTICE_MISMATCH}`, DOC.PRACTICE_MISMATCH),
    { ...pdfFile(FILE.IMAGE, DOC.IMAGE_FILE, "scan.png"), mimeType: "image/png" },
  ];

  shares = [
    share(DOC.OK),
    share(DOC.FOREIGN_PATIENT, { patientUserId: P2 }),
    share(DOC.SHARE_REVOKED, { status: "revoked", revokedAt: PAST }),
    share(DOC.SHARE_EXPIRED, { expiresAt: PAST }),
    share(DOC.LINK_REVOKED),
    share(DOC.LINK_ARCHIVED),
    share(DOC.LINK_INVITED),
    share(DOC.NO_LINK),
    share(DOC.TYPE_OTHER),
    share(DOC.TYPE_PRESCRIPTION),
    share(DOC.TYPE_IMAGING),
    share(DOC.DELETED),
    share(DOC.PRACTICE_MISMATCH),
    share(DOC.IMAGE_FILE),
    share(DOC.LAB),
    // DOC.DRAFT deliberately has no share row.
  ];

  const withIncludes = (d) => ({
    ...d,
    files: files.filter((f) => f.documentId === d.id),
    shares: shares.filter((s) => s.documentId === d.id),
    practiceProfile: { practiceName: "Praxis A" },
  });

  prisma.practiceDocument = {
    findFirst: async ({ where, select }) => {
      const d = documents.find((x) => matches(x, where));
      if (!d) return null;
      if (select) return Object.fromEntries(Object.keys(select).map((k) => [k, d[k]]));
      return withIncludes(d);
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
}

installFake();

/* ------------------------------------------------------------- helpers */

const VALID = {
  mode: TRANSLATION_MODES.STRICT,
  targetLanguage: "en",
};

function request(overrides = {}) {
  return {
    documentId: DOC.OK,
    fileId: FILE.OK,
    patientUserId: P1,
    ...VALID,
    ...overrides,
  };
}

/** @returns {Promise<string>} the error code, or "__RESOLVED__" if it wrongly succeeded */
async function codeFor(input) {
  try {
    await assertTranslatableDocumentForPatient(input);
    return "__RESOLVED__";
  } catch (err) {
    return err?.code ?? `__UNEXPECTED__:${err?.message}`;
  }
}

/* ------------------------------------------------------- the happy path */

test("a patient may translate their own shared document from an active link", async () => {
  const result = await assertTranslatableDocumentForPatient(request());
  assert.equal(result.document.id, DOC.OK);
  assert.equal(result.file.id, FILE.OK);
  assert.equal(result.link.id, LINK.ACTIVE);
  assert.equal(result.link.status, "active");
  assert.equal(result.mode, TRANSLATION_MODES.STRICT);
  assert.equal(result.targetLanguage, "en");
});

/* ------------------------------------------------------------ ownership */

test("another patient's document is refused", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.FOREIGN_PATIENT, fileId: FILE.FOREIGN })),
    TRANSLATION_ERRORS.DOCUMENT_NOT_FOUND,
  );
});

test("a patient cannot reach a document by claiming the other patient's id", async () => {
  // P2 asking for P1's document must fail on ownership, not on anything later.
  assert.equal(
    await codeFor(request({ patientUserId: P2 })),
    TRANSLATION_ERRORS.DOCUMENT_NOT_FOUND,
  );
});

test("a manipulated documentId is refused", async () => {
  for (const bad of ["", "   ", "does-not-exist", "doc-ok ", "DOC-OK", "../doc-ok", null, 42, {}]) {
    const code = await codeFor(request({ documentId: bad }));
    assert.equal(
      code,
      TRANSLATION_ERRORS.DOCUMENT_NOT_FOUND,
      `documentId ${JSON.stringify(bad)} was not refused`,
    );
  }
});

test("a manipulated fileId is refused", async () => {
  for (const bad of ["", "does-not-exist", FILE.FOREIGN, FILE.LAB, null, 42, {}]) {
    const code = await codeFor(request({ fileId: bad }));
    assert.ok(
      code === TRANSLATION_ERRORS.FILE_NOT_FOUND ||
        code === TRANSLATION_ERRORS.DOCUMENT_NOT_FOUND,
      `fileId ${JSON.stringify(bad)} produced ${code}`,
    );
  }
});

test("a file belonging to another document cannot be attached to this one", async () => {
  // The exact IDOR shape: valid document, valid file, wrong pairing.
  assert.equal(
    await codeFor(request({ documentId: DOC.OK, fileId: FILE.FOREIGN })),
    TRANSLATION_ERRORS.FILE_NOT_FOUND,
  );
});

/* ------------------------------------------------------- share lifecycle */

test("a revoked document share is refused", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.SHARE_REVOKED, fileId: `f-${DOC.SHARE_REVOKED}` })),
    TRANSLATION_ERRORS.DOCUMENT_UNAVAILABLE,
  );
});

test("an expired document share is refused", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.SHARE_EXPIRED, fileId: `f-${DOC.SHARE_EXPIRED}` })),
    TRANSLATION_ERRORS.DOCUMENT_UNAVAILABLE,
  );
});

test("a deleted document is refused", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.DELETED, fileId: `f-${DOC.DELETED}` })),
    TRANSLATION_ERRORS.DOCUMENT_UNAVAILABLE,
  );
});

test("a draft that was never shared is refused", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.DRAFT, fileId: `f-${DOC.DRAFT}` })),
    TRANSLATION_ERRORS.DOCUMENT_UNAVAILABLE,
  );
});

/* -------------------------------------------------------- link lifecycle */

test("a revoked practice link is refused even though the share is still active", async () => {
  // This is the gap the shared read loader does not close: the document stays
  // downloadable after the relationship ends. Translation must not inherit that.
  const doc = documents.find((d) => d.id === DOC.LINK_REVOKED);
  const shareRow = shares.find((s) => s.documentId === DOC.LINK_REVOKED);
  assert.equal(doc.status, "shared", "fixture: document is still shared");
  assert.equal(shareRow.status, "active", "fixture: share is still active");

  assert.equal(
    await codeFor(request({ documentId: DOC.LINK_REVOKED, fileId: `f-${DOC.LINK_REVOKED}` })),
    TRANSLATION_ERRORS.LINK_NOT_ACTIVE,
  );
});

test("an archived practice link is refused", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.LINK_ARCHIVED, fileId: `f-${DOC.LINK_ARCHIVED}` })),
    TRANSLATION_ERRORS.LINK_NOT_ACTIVE,
  );
});

test("an invited-but-not-accepted link is refused", async () => {
  // Stricter than the document module's {invited, active}: an unaccepted
  // relationship must not authorise AI processing.
  assert.equal(
    await codeFor(request({ documentId: DOC.LINK_INVITED, fileId: `f-${DOC.LINK_INVITED}` })),
    TRANSLATION_ERRORS.LINK_NOT_ACTIVE,
  );
});

test("only 'active' counts as a valid link status here", () => {
  assert.deepEqual([...TRANSLATION_LINK_STATUSES], ["active"]);
});

/* ------------------------------------------------------ link consistency */

test("a document without a practice link is refused", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.NO_LINK, fileId: `f-${DOC.NO_LINK}` })),
    TRANSLATION_ERRORS.DOCUMENT_UNAVAILABLE,
  );
});

test("a link belonging to a different practice than the document is refused", async () => {
  // Cross-practice: the document claims practice A, its link is at practice B.
  assert.equal(
    await codeFor(request({ documentId: DOC.PRACTICE_MISMATCH, fileId: `f-${DOC.PRACTICE_MISMATCH}` })),
    TRANSLATION_ERRORS.DOCUMENT_UNAVAILABLE,
  );
});

test("a document whose patientUserId is null is unreachable", async () => {
  // The Meda PDF-QR flow stores practice-owned PDFs with no patient and no link.
  documents.push(doc({ id: "doc-null-patient", patientUserId: null, practicePatientLinkId: null }));
  files.push(pdfFile("file-null-patient", "doc-null-patient"));
  shares.push(share("doc-null-patient", { patientUserId: null }));

  assert.equal(
    await codeFor(request({ documentId: "doc-null-patient", fileId: "file-null-patient" })),
    TRANSLATION_ERRORS.DOCUMENT_NOT_FOUND,
  );
});

/* ----------------------------------------------------------- type policy */

test("type 'other' is refused", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.TYPE_OTHER, fileId: `f-${DOC.TYPE_OTHER}` })),
    TRANSLATION_ERRORS.TYPE_NOT_TRANSLATABLE,
  );
});

test("type 'prescription_info' is refused in V1", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.TYPE_PRESCRIPTION, fileId: `f-${DOC.TYPE_PRESCRIPTION}` })),
    TRANSLATION_ERRORS.TYPE_NOT_TRANSLATABLE,
  );
});

test("type 'imaging' is refused in V1", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.TYPE_IMAGING, fileId: `f-${DOC.TYPE_IMAGING}` })),
    TRANSLATION_ERRORS.TYPE_NOT_TRANSLATABLE,
  );
});

test("the V1 allowlist is exactly report, discharge, referral", () => {
  assert.deepEqual(
    [...TRANSLATABLE_DOCUMENT_TYPES].sort(),
    ["discharge", "referral", "report"],
  );
});

test("lab is refused in V1, in every mode", async () => {
  // A lab result's meaning lives in its table structure, and a PDF text layer
  // cannot prove a value still belongs to its parameter. The plain-language
  // need is already served by the dedicated lab explanation path.
  for (const mode of [TRANSLATION_MODES.STRICT, TRANSLATION_MODES.PLAIN]) {
    assert.equal(
      await codeFor(request({ documentId: DOC.LAB, fileId: FILE.LAB, mode })),
      TRANSLATION_ERRORS.TYPE_NOT_TRANSLATABLE,
      `lab was not refused in mode ${mode}`,
    );
  }
});

test("only the three narrative types are translatable", async () => {
  // Positive control for the allowlist: the excluded types are refused for the
  // type itself, not incidentally for some other reason.
  const refused = ["other", "prescription_info", "imaging", "lab"];
  for (const type of refused) {
    assert.ok(!TRANSLATABLE_DOCUMENT_TYPES.has(type), `${type} must not be translatable`);
  }
  for (const type of ["report", "discharge", "referral"]) {
    assert.ok(TRANSLATABLE_DOCUMENT_TYPES.has(type), `${type} must be translatable`);
  }
});

/* ------------------------------------------------------------ file types */

test("an image file is refused before any parsing", async () => {
  assert.equal(
    await codeFor(request({ documentId: DOC.IMAGE_FILE, fileId: FILE.IMAGE })),
    TRANSLATION_ERRORS.UNSUPPORTED_FILE_TYPE,
  );
});

test("only PDF and DOCX are translatable file types", () => {
  assert.deepEqual(
    [...TRANSLATABLE_MIME_TYPES].sort(),
    [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  );
  assert.ok(!TRANSLATABLE_MIME_TYPES.has("application/msword"));
  for (const img of ["image/jpeg", "image/png", "image/webp"]) {
    assert.ok(!TRANSLATABLE_MIME_TYPES.has(img), `${img} must not be translatable`);
  }
});

/* -------------------------------------------------------- mode & locale */

test("an unknown mode is refused", async () => {
  for (const bad of ["", "faithful", "simple", "A", "B", null, 1, {}]) {
    assert.equal(
      await codeFor(request({ mode: bad })),
      TRANSLATION_ERRORS.INVALID_MODE,
      `mode ${JSON.stringify(bad)} was not refused`,
    );
  }
});

test("an unsupported target language is refused", async () => {
  for (const bad of ["", "xx", "tr", "ar", "zz", null, {}]) {
    assert.equal(
      await codeFor(request({ targetLanguage: bad })),
      TRANSLATION_ERRORS.INVALID_LOCALE,
      `targetLanguage ${JSON.stringify(bad)} was not refused`,
    );
  }
});

test("all six shipped languages are accepted as targets", async () => {
  for (const code of ["de", "en", "fr", "es", "it", "ru"]) {
    const result = await assertTranslatableDocumentForPatient(
      request({ targetLanguage: code }),
    );
    assert.equal(result.targetLanguage, code);
  }
});

/* ------------------------------------------------------------ kill switch */

test("the feature flag is a hard gate", async () => {
  process.env.ENABLE_DOCUMENT_TRANSLATION = "false";
  try {
    assert.equal(await codeFor(request()), TRANSLATION_ERRORS.FEATURE_DISABLED);
  } finally {
    process.env.ENABLE_DOCUMENT_TRANSLATION = "true";
  }
});

test("the flag defaults to off when unset", async () => {
  const previous = process.env.ENABLE_DOCUMENT_TRANSLATION;
  delete process.env.ENABLE_DOCUMENT_TRANSLATION;
  try {
    assert.equal(await codeFor(request()), TRANSLATION_ERRORS.FEATURE_DISABLED);
  } finally {
    process.env.ENABLE_DOCUMENT_TRANSLATION = previous;
  }
});

/* --------------------------------------------------------- API scope */

test("the request body accepts exactly fileId, mode and the two languages", () => {
  const parsed = parseTranslationRequestBody({
    fileId: FILE.OK,
    mode: TRANSLATION_MODES.STRICT,
    sourceLanguage: "de",
    targetLanguage: "en",
  });
  assert.deepEqual(
    Object.keys(parsed).sort(),
    ["fileId", "mode", "sourceLanguage", "targetLanguage"],
  );
});

test("no alternative document source can be supplied", () => {
  // The whole point of the feature: it translates documents that are already
  // in MedScoutX, never something the caller hands it.
  for (const key of ["text", "content", "url", "file", "upload", "externalUrl"]) {
    assert.throws(
      () =>
        parseTranslationRequestBody({
          fileId: FILE.OK,
          mode: TRANSLATION_MODES.STRICT,
          targetLanguage: "en",
          [key]: "arbitrary payload",
        }),
      (err) => err?.detail?.reason === "external_document_source_rejected",
      `${key} was not rejected as a document source`,
    );
  }
});

test("every forbidden source key is rejected, in any letter case", () => {
  for (const key of FORBIDDEN_SOURCE_KEYS) {
    for (const variant of [key, key.toUpperCase(), key.toLowerCase()]) {
      assert.throws(
        () =>
          parseTranslationRequestBody({
            fileId: FILE.OK,
            mode: TRANSLATION_MODES.STRICT,
            targetLanguage: "en",
            [variant]: "x",
          }),
        (err) => err?.detail?.reason === "external_document_source_rejected",
        `${variant} was not rejected`,
      );
    }
  }
});

test("an unknown key is rejected rather than ignored", () => {
  // Silently ignoring `documentId` in the body is indistinguishable from
  // honouring it once someone wires it up.
  assert.throws(
    () =>
      parseTranslationRequestBody({
        fileId: FILE.OK,
        mode: TRANSLATION_MODES.STRICT,
        targetLanguage: "en",
        documentId: "doc-somebody-elses",
      }),
    (err) => err?.detail?.reason === "unknown_request_key",
  );
});

test("a non-object body is rejected", () => {
  for (const bad of [null, undefined, "text", 42, ["fileId"]]) {
    assert.throws(() => parseTranslationRequestBody(bad));
  }
});

test("a missing fileId is rejected", () => {
  assert.throws(
    () => parseTranslationRequestBody({ mode: TRANSLATION_MODES.STRICT, targetLanguage: "en" }),
    (err) => err?.code === TRANSLATION_ERRORS.FILE_NOT_FOUND,
  );
});

/* ------------------------------------------------- no content in errors */

test("rejection details never carry document content", async () => {
  // Error detail is metadata only: it may be audited or logged, and document
  // text must never travel that way.
  const cases = [
    request({ documentId: DOC.TYPE_OTHER, fileId: `f-${DOC.TYPE_OTHER}` }),
    request({ documentId: DOC.LINK_REVOKED, fileId: `f-${DOC.LINK_REVOKED}` }),
    request({ documentId: DOC.IMAGE_FILE, fileId: FILE.IMAGE }),
  ];
  for (const input of cases) {
    try {
      await assertTranslatableDocumentForPatient(input);
      assert.fail("expected rejection");
    } catch (err) {
      const serialized = JSON.stringify(err?.detail ?? {});
      assert.ok(!serialized.includes("Placeholder Title"), "document title leaked into error");
      assert.ok(!serialized.includes("befund.pdf"), "file name leaked into error");
    }
  }
});
