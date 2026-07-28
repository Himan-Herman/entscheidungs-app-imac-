/**
 * Atomicity of contextual patient-data writes.
 *
 * Validation and insert used to be separate statements, so a link revoked in
 * between still produced a practice_contextual record. They now share one
 * serializable transaction with a row lock on the link.
 *
 * These tests cover the wrapper's contract: what is retried, what is not, and
 * that no attempt can leave a partial or duplicate record. The actual
 * concurrent behaviour against PostgreSQL is proven separately by
 * scripts/verifyContextWriteRaceSandbox.mjs.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../lib/prisma.js";
import {
  createPatientDataWithValidatedContext,
  ContextWriteConflictError,
  InvalidContextError,
  MAX_WRITE_ATTEMPTS,
  contextErrorResponse,
} from "../services/patientData/patientDataContextService.js";

const P = "user-patient-P";
const Q = "user-patient-Q";
const LINK_ACTIVE = "link-active";
const LINK_REVOKED = "link-revoked";
const LINK_FOREIGN = "link-foreign";

let links;
let written;
let transactionAttempts;

/** A Prisma-shaped serialization failure. */
function serializationError() {
  const err = new Error("Transaction failed due to a write conflict or a deadlock");
  err.code = "P2034";
  return err;
}

/** A raw PostgreSQL 40001, as it can surface through an unknown-request error. */
function rawSerializationError() {
  return new Error('could not serialize access due to read/write dependencies (SQLSTATE 40001)');
}

/**
 * @param {{ failFirst?: number, failWith?: () => Error }} [opts]
 */
function installPrismaFake(opts = {}) {
  links = [
    { id: LINK_ACTIVE, patientUserId: P, status: "active" },
    { id: LINK_REVOKED, patientUserId: P, status: "revoked" },
    { id: LINK_FOREIGN, patientUserId: Q, status: "active" },
  ];
  written = [];
  transactionAttempts = 0;

  prisma.$queryRaw = async (_strings, ...values) => {
    const [id, patientUserId] = values;
    const row = links.find((l) => l.id === id && l.patientUserId === patientUserId);
    return row ? [{ id: row.id, status: row.status }] : [];
  };
  prisma.practicePatientLink = {
    findFirst: async ({ where }) =>
      links.find((l) => l.id === where.id && l.patientUserId === where.patientUserId) ?? null,
  };
  prisma.$transaction = async (fn, options) => {
    transactionAttempts += 1;
    // The wrapper must ask for Serializable; the fixture asserts it.
    assert.equal(options?.isolationLevel, "Serializable", "must run serializable");
    const failFor = opts.failFirst ?? 0;
    if (transactionAttempts <= failFor) throw (opts.failWith ?? serializationError)();
    // A failed attempt writes nothing: the callback only runs on a good attempt.
    return fn(prisma);
  };
}

const createRecord = (_tx, context) => {
  const row = { id: `rec-${written.length + 1}`, ...context };
  written.push(row);
  return Promise.resolve(row);
};

test.beforeEach(() => installPrismaFake());

/* ------------------------------------------------------ happy paths (1, 5) */

test("1) an active own link creates exactly one contextual record", async () => {
  const row = await createPatientDataWithValidatedContext({
    patientUserId: P, requestedPracticePatientLinkId: LINK_ACTIVE, createRecord,
  });
  assert.equal(row.dataScope, "practice_contextual");
  assert.equal(row.contextPracticePatientLinkId, LINK_ACTIVE);
  assert.equal(written.length, 1, "exactly one record");
  assert.equal(transactionAttempts, 1, "no needless retry");
});

test("5) no link creates exactly one global record, through the same wrapper", async () => {
  const row = await createPatientDataWithValidatedContext({
    patientUserId: P, createRecord,
  });
  assert.equal(row.dataScope, "patient_global");
  assert.equal(row.contextPracticePatientLinkId, null);
  assert.equal(written.length, 1);
});

/* ------------------------------------------------- refusals (2, 3, 4, 6) */

test("2-4) revoked, foreign and unknown links write nothing", async () => {
  const cases = [
    [LINK_REVOKED, "link_not_active"],
    [LINK_FOREIGN, "link_not_found"],
    ["does-not-exist", "link_not_found"],
  ];
  for (const [linkId, code] of cases) {
    await assert.rejects(
      () => createPatientDataWithValidatedContext({
        patientUserId: P, requestedPracticePatientLinkId: linkId, createRecord,
      }),
      (err) => err instanceof InvalidContextError && err.message === code,
      linkId,
    );
  }
  assert.equal(written.length, 0, "a refused context must never write");
});

test("6) a validation failure is never retried", async () => {
  await assert.rejects(
    () => createPatientDataWithValidatedContext({
      patientUserId: P, requestedPracticePatientLinkId: LINK_REVOKED, createRecord,
    }),
    InvalidContextError,
  );
  assert.equal(transactionAttempts, 1, "validation errors must not be retried");
});

/* ------------------------------------------------------- retry rules (7-11) */

test("7) an unknown database error is never retried", async () => {
  installPrismaFake({ failFirst: 99, failWith: () => Object.assign(new Error("boom"), { code: "P2002" }) });
  await assert.rejects(
    () => createPatientDataWithValidatedContext({
      patientUserId: P, requestedPracticePatientLinkId: LINK_ACTIVE, createRecord,
    }),
    /boom/,
  );
  assert.equal(transactionAttempts, 1, "only serialization conflicts may be retried");
  assert.equal(written.length, 0);
});

test("8) a serialization conflict is retried up to the fixed limit", async () => {
  installPrismaFake({ failFirst: 99 });
  await assert.rejects(
    () => createPatientDataWithValidatedContext({
      patientUserId: P, requestedPracticePatientLinkId: LINK_ACTIVE, createRecord,
    }),
    ContextWriteConflictError,
  );
  assert.equal(transactionAttempts, MAX_WRITE_ATTEMPTS, `exactly ${MAX_WRITE_ATTEMPTS} attempts`);
  assert.ok(MAX_WRITE_ATTEMPTS <= 3, "the limit must stay small");
});

test("9) after a successful retry exactly one record exists", async () => {
  installPrismaFake({ failFirst: 1 });
  const row = await createPatientDataWithValidatedContext({
    patientUserId: P, requestedPracticePatientLinkId: LINK_ACTIVE, createRecord,
  });
  assert.equal(transactionAttempts, 2, "one retry");
  assert.equal(written.length, 1, "11) no duplicate from the retry");
  assert.equal(row.dataScope, "practice_contextual");
});

test("10) after exhausted retries no record exists", async () => {
  installPrismaFake({ failFirst: 99 });
  await assert.rejects(
    () => createPatientDataWithValidatedContext({
      patientUserId: P, requestedPracticePatientLinkId: LINK_ACTIVE, createRecord,
    }),
    ContextWriteConflictError,
  );
  assert.equal(written.length, 0, "nothing partially stored");
});

test("a raw 40001 is recognised as a conflict too", async () => {
  installPrismaFake({ failFirst: 1, failWith: rawSerializationError });
  await createPatientDataWithValidatedContext({
    patientUserId: P, requestedPracticePatientLinkId: LINK_ACTIVE, createRecord,
  });
  assert.equal(transactionAttempts, 2, "SQLSTATE 40001 must be retried");
  assert.equal(written.length, 1);
});

/* -------------------------------------------------- response shape (12, 13) */

test("12-13) the conflict response carries no ids and no internal codes", () => {
  const mapped = contextErrorResponse(new ContextWriteConflictError());
  assert.equal(mapped.status, 409);
  assert.deepEqual(mapped.body, { ok: false, error: "context_write_conflict" });

  const serialized = JSON.stringify(mapped.body);
  for (const secret of [P, Q, LINK_ACTIVE, LINK_FOREIGN, "P2034", "40001"]) {
    assert.ok(!serialized.includes(secret), `leaked "${secret}"`);
  }
});

test("the not-found and not-active responses stay distinguishable but opaque", () => {
  const notFound = contextErrorResponse(new InvalidContextError("link_not_found"));
  const notActive = contextErrorResponse(new InvalidContextError("link_not_active"));
  assert.equal(notFound.status, 404);
  assert.equal(notActive.status, 409);
  for (const mapped of [notFound, notActive]) {
    assert.deepEqual(Object.keys(mapped.body).sort(), ["error", "ok"]);
  }
});

/* ------------------------------------------------------------- wiring guard */

test("the link is row-locked inside the transaction", async () => {
  let sawLockQuery = false;
  installPrismaFake();
  const inner = prisma.$queryRaw;
  prisma.$queryRaw = async (strings, ...values) => {
    const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
    if (/FOR SHARE/i.test(sql)) sawLockQuery = true;
    return inner(strings, ...values);
  };
  await createPatientDataWithValidatedContext({
    patientUserId: P, requestedPracticePatientLinkId: LINK_ACTIVE, createRecord,
  });
  assert.ok(sawLockQuery, "the context lookup must take a FOR SHARE row lock");
});
