/**
 * What the client actually puts on the wire.
 *
 * The rule the whole flow rests on is that a credential travels in a request
 * BODY and never in a URL. That is invisible in a screenshot and invisible in a
 * passing UI test — the only way to hold it is to inspect the request the module
 * builds. So these tests capture fetch and read the URL and the body.
 *
 * Run: node --test client/src/features/patientOnboarding/__tests__/patientOnboardingApiContract.test.mjs
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const calls = [];

globalThis.localStorage = {
  getItem: () => "test-jwt",
  setItem: () => {},
  removeItem: () => {},
};
globalThis.window = { location: { assign: () => {} } };

globalThis.fetch = async (input, init = {}) => {
  calls.push({ url: String(input), init });
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, practice: { displayName: "Praxis" }, link: { id: "l1", status: "invited" } }),
    clone() { return this; },
  };
};

const claimApi = await import("../api/invitationClaimApi.js");
const practiceApi = await import("../api/patientOnboardingApi.js");

beforeEach(() => { calls.length = 0; });

const last = () => calls[calls.length - 1];
const bodyOf = (call) => JSON.parse(call.init.body);

/* ------------------------------------------------------------ the credential */

test("the preview sends the token in the body and never in the URL", async () => {
  await claimApi.previewInvitation({ token: "secret-token-value" });

  const call = last();
  assert.equal(call.init.method, "POST");
  assert.ok(call.url.endsWith("/api/public/patient-invitations/preview"));
  assert.equal(call.url.includes("secret-token-value"), false, "the token reached the URL");
  assert.equal(call.url.includes("?"), false, "the preview must not use a query string");
  assert.deepEqual(bodyOf(call), { token: "secret-token-value" });
});

test("the typed code goes to its own endpoint, also in the body", async () => {
  await claimApi.previewInvitation({ code: "ABCD-EFGH-JKLM" });

  const call = last();
  assert.ok(call.url.endsWith("/api/public/patient-invitations/manual-code/check"));
  assert.equal(call.url.includes("ABCD"), false, "the code reached the URL");
  assert.deepEqual(bodyOf(call), { code: "ABCD-EFGH-JKLM" });
});

test("the claim sends exactly one credential plus the subject", async () => {
  await claimApi.claimInvitation({
    token: "tok", subject: { type: "self" },
  });
  let body = bodyOf(last());
  assert.deepEqual(Object.keys(body).sort(), ["subject", "token"]);
  assert.equal("code" in body, false, "an unused key must be omitted, not sent as null");
  assert.equal(last().url.includes("tok"), false);

  await claimApi.claimInvitation({
    code: "ABCD-EFGH-JKLM",
    subject: { type: "patient_profile", patientProfileId: "p1" },
  });
  body = bodyOf(last());
  assert.deepEqual(Object.keys(body).sort(), ["code", "subject"]);
  assert.equal("token" in body, false);
  assert.deepEqual(body.subject, { type: "patient_profile", patientProfileId: "p1" });
});

test("the claim goes to the authenticated route", async () => {
  await claimApi.claimInvitation({ token: "t", subject: { type: "self" } });
  const call = last();
  assert.ok(call.url.endsWith("/api/patient/invitations/claim"));
  assert.equal(call.init.method, "POST");
});

/* -------------------------------------------------------------- the practice */

test("creating an entry sends only the fields the backend stores", async () => {
  await practiceApi.createPatientEntry("prac-1", {
    givenName: "Anna", familyName: "Müller", dateOfBirth: "1980-05-04",
    email: "a@example.invalid", phone: "0123", practiceRecordNumber: "REC-1",
  });

  const body = bodyOf(last());
  assert.deepEqual(Object.keys(body).sort(), [
    "dateOfBirth", "email", "familyName", "givenName",
    "phone", "practiceId", "practiceRecordNumber",
  ]);
  // The practice id is context, not payload the server trusts for authorisation.
  assert.equal(body.practiceId, "prac-1");
});

test("issuing an invitation takes no delivery channel — nothing is delivered yet", async () => {
  await practiceApi.createInvitation("prac-1", "entry-1");
  const body = bodyOf(last());
  assert.deepEqual(body, { practiceId: "prac-1" });
  assert.equal("deliveryChannel" in body, false);
});

test("entry ids are encoded into the path, so a stray character cannot escape it", async () => {
  await practiceApi.createInvitation("prac-1", "entry/../../admin");
  assert.equal(last().url.includes("entry/../../admin"), false, "the id was not encoded");
  assert.ok(last().url.includes(encodeURIComponent("entry/../../admin")));
});

/* ------------------------------------------------------------------- errors */

test("a failure surfaces the server's own error code, never an invented one", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false, status: 409,
    json: async () => ({ ok: false, error: "claim_subject_mismatch" }),
    clone() { return this; },
  });
  try {
    await assert.rejects(
      () => claimApi.claimInvitation({ token: "t", subject: { type: "self" } }),
      (err) => err.code === "claim_subject_mismatch" && err.status === 409,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("a body that is not JSON still fails cleanly", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false, status: 502,
    json: async () => { throw new Error("not json"); },
    clone() { return this; },
  });
  try {
    await assert.rejects(
      () => claimApi.previewInvitation({ token: "t" }),
      (err) => err.status === 502,
    );
  } finally {
    globalThis.fetch = original;
  }
});
