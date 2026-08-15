/**
 * Phase 3 — the activation gate, one configuration state at a time.
 *
 * Every earlier suite tests a feature that is allowed to run. This one tests the
 * states in which it must not, and asserts the only thing that ultimately
 * matters in those states: that nothing left the machine.
 *
 * The tripwire is `globalThis.fetch`. Counting provider *calls* would only prove
 * the adapter was not invoked; counting outbound requests proves no medical
 * document reached the wire by any path, including one a future edit might add.
 * A configuration that refuses correctly but still opened a socket would fail
 * here, which is the point.
 *
 * No network, no database, no real document.
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-3";

import { prisma } from "../lib/prisma.js";
import { getPracticeDocumentStorage } from "../services/practiceDocument/storage/index.js";
import { docx, para } from "./lib/documentTranslationFixtures.js";
import { translateDocumentForPatient } from "../services/documentTranslation/documentTranslationService.js";
import {
  isDocumentTranslationProviderConfigured,
  resolveDocumentTranslationProvider,
} from "../services/documentTranslation/provider/index.js";
import {
  APPROVED_PROVIDER_HOSTS,
  checkBaseUrl,
  resolveProviderConfig,
} from "../services/documentTranslation/provider/documentTranslationProviderConfig.js";
import { describeTranslationReadiness } from "../services/documentTranslation/documentTranslationReadiness.js";
import { TRANSLATION_ERRORS } from "../services/documentTranslation/documentTranslationPolicy.js";

/* ------------------------------------------------------------------ fixture */

const PATIENT = "user-P1";
const PRACTICE = "practice-A";
const LINK = "link-active";
const DOC = "doc-ok";
const FILE = "file-ok";
const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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

const LETTER = [
  "Sehr geehrte Kollegin, sehr geehrter Kollege,",
  "wir berichten ueber die Vorstellung von Max Mustermann, geboren am 12.08.1980.",
  "Ramipril HEXAL 5 mg 1-0-0",
].map((line) => para(line)).join("");

const docxBuffer = await docx(LETTER);
getPracticeDocumentStorage().getObject = async () => docxBuffer;

/* ------------------------------------------------------------------ harness */

/** A complete, valid-looking OpenAI configuration. Values are placeholders. */
const COMPLETE = Object.freeze({
  DOCUMENT_TRANSLATION_PROVIDER: "openai",
  DOCUMENT_TRANSLATION_API_KEY: "sk-dedicated-placeholder",
  DOCUMENT_TRANSLATION_BASE_URL: "https://provider.example.invalid/v1",
  DOCUMENT_TRANSLATION_DATA_REGION: "eu",
  DOCUMENT_TRANSLATION_ZERO_RETENTION: "true",
  DOCUMENT_TRANSLATION_MODEL_STRICT: "model-strict",
  DOCUMENT_TRANSLATION_MODEL_PLAIN: "model-plain",
});

const TRANSLATION_KEYS = [
  ...Object.keys(COMPLETE),
  "DOCUMENT_TRANSLATION_FAKE_BEHAVIOUR",
  "ENABLE_DOCUMENT_TRANSLATION",
  // Several cases set this to "production". It has to be saved and restored
  // with the rest, or a production-only refusal leaks into the next case and
  // makes a passing gate look like a working one.
  "NODE_ENV",
];

/**
 * Run `fn` with exactly the given translation-related environment, counting
 * every outbound request made while it runs.
 *
 * @param {Record<string, string>} env
 * @param {() => Promise<unknown>} fn
 */
async function withEnv(env, fn) {
  const saved = Object.fromEntries(TRANSLATION_KEYS.map((k) => [k, process.env[k]]));
  for (const key of TRANSLATION_KEYS) delete process.env[key];
  Object.assign(process.env, env);

  const realFetch = globalThis.fetch;
  let outbound = 0;
  globalThis.fetch = (...args) => {
    outbound += 1;
    // Never actually let it out, even if a gate were to fail: the whole purpose
    // of this suite is that these states must not reach a network.
    return Promise.reject(new Error("outbound request blocked by the test harness"));
  };

  try {
    const result = await fn().catch((err) => err);
    return { result, outbound };
  } finally {
    globalThis.fetch = realFetch;
    for (const key of TRANSLATION_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(saved)) {
      if (value !== undefined) process.env[key] = value;
    }
  }
}

function request() {
  return {
    documentId: DOC,
    patientUserId: PATIENT,
    fileId: FILE,
    sourceLanguage: "de",
    targetLanguage: "en",
    mode: "strict_translation",
  };
}

/** Assert a state refuses with the expected code and sends nothing. */
async function assertRefusesWithoutSending(env, expectedCode) {
  const { result, outbound } = await withEnv(env, () =>
    translateDocumentForPatient(request()),
  );
  assert.ok(result instanceof Error, "the transformation was not refused");
  assert.equal(result.code, expectedCode, `unexpected code: ${result.code}`);
  assert.equal(outbound, 0, `${outbound} outbound request(s) were made`);
}

/* ================================================================== */
/* 1. The states in which nothing may be sent                         */
/* ================================================================== */

test("feature OFF + provider OFF", async () => {
  await assertRefusesWithoutSending({}, TRANSLATION_ERRORS.FEATURE_DISABLED);
});

test("feature OFF + provider fully configured", async () => {
  // The flag is the outer gate: a complete provider configuration does not by
  // itself make the feature live.
  await assertRefusesWithoutSending(
    { ...COMPLETE, ENABLE_DOCUMENT_TRANSLATION: "false" },
    TRANSLATION_ERRORS.FEATURE_DISABLED,
  );
});

test("feature ON + provider OFF", async () => {
  await assertRefusesWithoutSending(
    { ENABLE_DOCUMENT_TRANSLATION: "true" },
    TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED,
  );
});

test("feature ON + each single missing variable refuses on its own", async () => {
  for (const omitted of Object.keys(COMPLETE).filter(
    (k) => k !== "DOCUMENT_TRANSLATION_PROVIDER",
  )) {
    const env = { ...COMPLETE, ENABLE_DOCUMENT_TRANSLATION: "true" };
    delete env[omitted];
    await assertRefusesWithoutSending(env, TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED);
  }
});

test("feature ON + zero-retention asserted as anything other than true", async () => {
  // "false", "1", "yes", "TRUE" must all read as not asserted. An ambiguous
  // value must never be interpreted generously. Surrounding whitespace is the
  // one exception and is trimmed — see the test below.
  for (const value of ["false", "1", "yes", "TRUE", "no", "0", ""]) {
    await assertRefusesWithoutSending(
      {
        ...COMPLETE,
        ENABLE_DOCUMENT_TRANSLATION: "true",
        DOCUMENT_TRANSLATION_ZERO_RETENTION: value,
      },
      TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED,
    );
  }
});

test("feature ON + the dedicated key is the generic OpenAI key", async () => {
  const saved = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-generic-for-other-features";
  try {
    await assertRefusesWithoutSending(
      {
        ...COMPLETE,
        ENABLE_DOCUMENT_TRANSLATION: "true",
        DOCUMENT_TRANSLATION_API_KEY: "sk-generic-for-other-features",
      },
      TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED,
    );
  } finally {
    if (saved === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved;
  }
});

test("feature ON + the in-process double selected in production", async () => {
  await assertRefusesWithoutSending(
    {
      ENABLE_DOCUMENT_TRANSLATION: "true",
      DOCUMENT_TRANSLATION_PROVIDER: "fake",
      NODE_ENV: "production",
    },
    TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED,
  );
});

test("feature ON + an unapproved endpoint host in production", async () => {
  // The realistic misconfiguration: everything filled in, the URL looks
  // regional and plausible, and nobody confirmed the endpoint.
  await assertRefusesWithoutSending(
    {
      ...COMPLETE,
      ENABLE_DOCUMENT_TRANSLATION: "true",
      NODE_ENV: "production",
      DOCUMENT_TRANSLATION_BASE_URL: "https://eu.api.example.invalid/v1",
    },
    TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED,
  );
});

test("feature ON + an unencrypted endpoint", async () => {
  await assertRefusesWithoutSending(
    {
      ...COMPLETE,
      ENABLE_DOCUMENT_TRANSLATION: "true",
      DOCUMENT_TRANSLATION_BASE_URL: "http://provider.example.invalid/v1",
    },
    TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED,
  );
});

test("feature ON + an endpoint that is not an absolute URL", async () => {
  for (const value of ["provider.example.invalid", "/v1", "not a url"]) {
    await assertRefusesWithoutSending(
      {
        ...COMPLETE,
        ENABLE_DOCUMENT_TRANSLATION: "true",
        DOCUMENT_TRANSLATION_BASE_URL: value,
      },
      TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED,
    );
  }
});

/* ================================================================== */
/* 2. The one state that may run, and only with the double            */
/* ================================================================== */

test("the complete synthetic configuration works and stays in process", async () => {
  const { result, outbound } = await withEnv(
    { ENABLE_DOCUMENT_TRANSLATION: "true", DOCUMENT_TRANSLATION_PROVIDER: "fake" },
    () => translateDocumentForPatient(request()),
  );
  assert.ok(!(result instanceof Error), `refused: ${result?.code ?? result?.message}`);
  assert.equal(result.status, "completed");
  assert.ok(result.segments.length > 0);
  // The double is in-process: a working transformation still touches no network.
  assert.equal(outbound, 0);
});

/* ================================================================== */
/* 3. The endpoint allowlist                                          */
/* ================================================================== */

test("no provider host is approved for production yet", () => {
  // This is the current, intended state. When it changes, it must change
  // through a reviewed commit — which is exactly why the gate lives in code
  // rather than in another environment variable an operator can flip.
  assert.deepEqual([...APPROVED_PROVIDER_HOSTS], []);
});

test("production refuses every host while the allowlist is empty", () => {
  for (const host of [
    "https://api.openai.com/v1",
    "https://eu.api.openai.com/v1",
    "https://api.example.invalid/v1",
  ]) {
    const check = checkBaseUrl(host, true);
    assert.equal(check.ok, false, `${host} was accepted in production`);
    assert.equal(check.reason, "base_url_host_not_approved");
  }
});

test("outside production a local mock endpoint is usable", () => {
  assert.equal(checkBaseUrl("http://localhost:8080/v1", false).ok, true);
  assert.equal(checkBaseUrl("https://staging.example.invalid/v1", false).ok, true);
  // But clear text is never acceptable in production, loopback or not.
  assert.equal(checkBaseUrl("http://localhost:8080/v1", true).ok, false);
});

/* ================================================================== */
/* 4. What the readiness surface reports                              */
/* ================================================================== */

test("readiness reports the truth in each state, without leaking values", async () => {
  const states = [
    [{}, { featureEnabled: false, providerConfigured: false, ready: false }],
    [
      { ENABLE_DOCUMENT_TRANSLATION: "true" },
      { featureEnabled: true, providerConfigured: false, ready: false },
    ],
    [
      { ENABLE_DOCUMENT_TRANSLATION: "true", DOCUMENT_TRANSLATION_PROVIDER: "fake" },
      { featureEnabled: true, providerConfigured: true, ready: true },
    ],
  ];

  for (const [env, expected] of states) {
    const { result } = await withEnv(env, async () => describeTranslationReadiness(process.env));
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(result[key], value, `${key} in ${JSON.stringify(env)}`);
    }
    // Booleans and variable names only.
    const serialised = JSON.stringify(result);
    for (const secret of ["sk-", "example.invalid", "api-key"]) {
      assert.ok(!serialised.includes(secret), `readiness leaked ${secret}`);
    }
  }
});

test("readiness never reports an approved endpoint in production today", async () => {
  const { result } = await withEnv(
    { ...COMPLETE, ENABLE_DOCUMENT_TRANSLATION: "true", NODE_ENV: "production" },
    async () => describeTranslationReadiness(process.env),
  );
  assert.equal(result.endpointApproved, false);
  assert.equal(result.ready, false);
});

/* ================================================================== */
/* 5. The adapter cannot be built around the gate                     */
/* ================================================================== */

test("resolving a provider in an unsafe state throws instead of returning one", async () => {
  for (const env of [
    {},
    { DOCUMENT_TRANSLATION_PROVIDER: "openai" },
    { DOCUMENT_TRANSLATION_PROVIDER: "fake", NODE_ENV: "production" },
    { ...COMPLETE, NODE_ENV: "production" },
  ]) {
    const { result, outbound } = await withEnv(env, async () =>
      resolveDocumentTranslationProvider(),
    );
    assert.ok(result instanceof Error, `a provider was returned for ${JSON.stringify(env)}`);
    assert.equal(result.code, TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED);
    assert.equal(outbound, 0);
  }
});

test("an unknown provider name is refused rather than defaulted", async () => {
  for (const kind of ["openai-compatible", "azure", "anthropic", "OPENAI", "fake-openai", ""]) {
    const config = resolveProviderConfig({ ...COMPLETE, DOCUMENT_TRANSLATION_PROVIDER: kind });
    assert.equal(config.configured, false, `${kind} was accepted`);
  }
});

test("surrounding whitespace in a configured value is trimmed, not treated as a typo", () => {
  // A deployment console that adds a trailing space should not produce a
  // baffling refusal. Trimming is the only leniency: the trimmed value still
  // has to match exactly, so " yes " remains a refusal.
  const padded = Object.fromEntries(
    Object.entries(COMPLETE).map(([k, v]) => [k, ` ${v} `]),
  );
  assert.equal(resolveProviderConfig(padded).configured, true);
  assert.equal(
    resolveProviderConfig({ ...COMPLETE, DOCUMENT_TRANSLATION_ZERO_RETENTION: " yes " })
      .configured,
    false,
  );
});

test("configuring one provider does not enable a fallback to another", async () => {
  // There is no fallback chain by construction: resolution returns exactly one
  // adapter and throws otherwise. Pinned here because adding a "try the next
  // provider" branch later would silently move medical documents to a party
  // covered by no agreement.
  const { result } = await withEnv({ DOCUMENT_TRANSLATION_PROVIDER: "openai" }, async () =>
    resolveDocumentTranslationProvider(),
  );
  assert.ok(result instanceof Error);
  assert.equal(result.code, TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED);
  assert.equal(isDocumentTranslationProviderConfigured({ DOCUMENT_TRANSLATION_PROVIDER: "openai" }), false);
});
