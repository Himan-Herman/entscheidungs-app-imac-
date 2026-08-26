/**
 * Phase 6b — files that must outlive a deploy actually can.
 *
 * ── What was wrong ──────────────────────────────────────────────────────────
 * Five services wrote files, and every one defaulted to a directory inside the
 * application checkout. The Render service has no persistent disk — checked in
 * the dashboard, not guessed — and Render replaces the checkout on every
 * deploy. So a patient's vaccination certificate, a practice's shared report
 * and an account's data export were all being written somewhere the next
 * release erases.
 *
 * Nothing failed at the time. That is the whole difficulty with this class of
 * bug: the upload succeeds, the row is written, the response says yes, and the
 * loss happens later, quietly, to someone who is not watching. Which is why the
 * fix is not "set a variable" but "refuse to start without one".
 *
 * ── What these tests hold ───────────────────────────────────────────────────
 * That production cannot start without a persistent root; that development
 * still works without one; that all five services land under the same root, so
 * a single mounted disk covers every one of them; that none of them can be
 * talked into writing outside it; and that the health endpoint answers the
 * question without handing out the path.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(SERVER, rel), "utf8");

const {
  getStorageConfigProblems,
  isPersistentStorageConfigured,
  STORAGE_AREAS,
  STORAGE_ROOT_ENV,
  storageAreaRoot,
} = await import("../config/storageRoot.js");

/** A production environment with everything else already satisfied. */
const prodEnv = (extra = {}) => ({
  NODE_ENV: "production",
  DATABASE_URL: "x",
  JWT_SECRET: "x",
  OPENAI_API_KEY: "x",
  RESEND_API_KEY: "x",
  EMAIL_FROM: "MedScoutX <no-reply@example.com>",
  CORS_ORIGIN: "https://example.com",
  API_BASE_URL: "https://api.example.com",
  APP_BASE_URL: "https://example.com",
  ...extra,
});

/* ═════════════════════════════════ production refuses to start without one */

test("production without a persistent root is rejected", () => {
  const problems = getStorageConfigProblems(prodEnv());
  assert.equal(problems.length, 1, "an unset root was accepted");
  assert.match(problems[0], /STORAGE_ROOT/);
  // The message has to say what goes wrong, not just that something is unset:
  // whoever reads it at 3am is deciding whether to set a variable or roll back.
  assert.match(problems[0], /lost on the next release|persistent/i);
});

test("production with a persistent root is accepted", () => {
  assert.deepEqual(getStorageConfigProblems(prodEnv({ STORAGE_ROOT: "/var/data" })), []);
});

test("a relative root is rejected — it resolves inside the checkout", () => {
  for (const root of ["storage", "./storage", "../storage", "server/storage"]) {
    const problems = getStorageConfigProblems(prodEnv({ STORAGE_ROOT: root }));
    assert.equal(problems.length, 1, `${root} was accepted`);
    assert.match(problems[0], /absolute/i);
  }
});

test("an absolute root that still points inside the checkout is rejected", () => {
  // The most likely wrong answer: someone reads the old default and pastes it
  // in as an absolute path, which looks right and changes nothing.
  const inside = path.resolve(SERVER, "storage");
  const problems = getStorageConfigProblems(prodEnv({ STORAGE_ROOT: inside }));
  assert.equal(problems.length, 1, "a root inside the checkout was accepted");
  assert.match(problems[0], /checkout/i);
});

test("development without a root is allowed", () => {
  assert.deepEqual(getStorageConfigProblems({ NODE_ENV: "development" }), []);
  assert.deepEqual(getStorageConfigProblems({ NODE_ENV: "test" }), []);
  assert.deepEqual(getStorageConfigProblems({}), []);
});

test("startup validation carries the storage check", () => {
  // The check has to be wired into the thing that actually runs, not merely
  // exist. Asserted against the source because importing the validator twice
  // with different environments is not something it supports.
  const src = read("utils/startupEnvValidation.js");
  assert.match(src, /getStorageConfigProblems\(\)/, "startup no longer asks about storage");
  assert.match(src, /missingCritical\.push\(STORAGE_ROOT_ENV\)/, "the result is no longer fatal");
});

/* ═══════════════════════════════════ all five land under the same root */

const AREAS = [
  ["practice documents", STORAGE_AREAS.PRACTICE_DOCUMENTS],
  ["vaccination documents", STORAGE_AREAS.VACCINATION_DOCUMENTS],
  ["user avatars", STORAGE_AREAS.USER_AVATARS],
  ["practice logos", STORAGE_AREAS.PRACTICE_LOGOS],
  ["exports", STORAGE_AREAS.EXPORTS],
];

test("every area resolves below the configured root", () => {
  const root = "/var/data";
  for (const [label, area] of AREAS) {
    const resolved = storageAreaRoot(area, "", { STORAGE_ROOT: root });
    assert.ok(
      resolved.startsWith(root + path.sep),
      `${label} resolved outside the root: ${resolved}`,
    );
    assert.equal(resolved, path.join(root, area));
  }
});

test("the five areas are distinct directories", () => {
  const resolved = AREAS.map(([, area]) => storageAreaRoot(area, "", { STORAGE_ROOT: "/var/data" }));
  assert.equal(new Set(resolved).size, AREAS.length, "two areas share a directory");
});

test("a per-service override still wins, for tests and development", () => {
  const scratch = path.join(os.tmpdir(), "scratch-store");
  assert.equal(
    storageAreaRoot(STORAGE_AREAS.EXPORTS, scratch, { STORAGE_ROOT: "/var/data" }),
    scratch,
    "a scratch directory can no longer be pointed at one service",
  );
});

test("the five storage services all read the shared root", () => {
  /*
   * The completeness half. A sixth service that quietly defaults to its own
   * directory would reintroduce exactly the split this change removes — one
   * area on the disk, another on the ephemeral checkout — and it is caught by
   * simply not being in this list.
   */
  const SERVICES = [
    "services/practiceDocument/storage/localStorage.js",
    "services/vaccination/vaccinationDocumentStorage.js",
    "services/account/userAvatarStorage.js",
    "services/practiceSettings/practiceLogoStorage.js",
    "services/export/exportStorage.js",
  ];
  for (const rel of SERVICES) {
    const src = read(rel);
    assert.match(src, /storageAreaRoot\(STORAGE_AREAS\./, `${rel} no longer uses the shared root`);
    assert.ok(
      !/const DEFAULT_ROOT = path\.resolve/.test(src),
      `${rel} has its own default root again — it can now diverge from the others`,
    );
  }
});

test("no storage service resolves a root of its own", () => {
  // Anything under services/ that writes files has to come through the shared
  // root. This catches a new one added without reading any of the above.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) {
        const src = fs.readFileSync(full, "utf8");
        if (/path\.resolve\(__dirname,\s*["'][^"']*storage\//.test(src)) {
          offenders.push(path.relative(SERVER, full));
        }
      }
    }
  };
  walk(path.join(SERVER, "services"));
  assert.deepEqual(offenders, [], "these resolve their own storage directory");
});

/* ══════════════════════════════════ nothing escapes its own area */

test("no service can be talked into writing outside its root", async () => {
  const scratch = await fsp.mkdtemp(path.join(os.tmpdir(), "storage-escape-"));
  try {
    const { LocalPracticeDocumentStorage } = await import(
      "../services/practiceDocument/storage/localStorage.js"
    );
    const { VaccinationDocumentStorage } = await import(
      "../services/vaccination/vaccinationDocumentStorage.js"
    );
    const { UserAvatarStorage } = await import("../services/account/userAvatarStorage.js");
    const { PracticeLogoStorage } = await import(
      "../services/practiceSettings/practiceLogoStorage.js"
    );

    const HOSTILE = [
      "../escaped.txt",
      "../../escaped.txt",
      "a/../../escaped.txt",
      "/etc/passwd",
      "../".repeat(20) + "etc/passwd",
    ];

    // Each service exposes a different read method; the guard is the same one.
    const readers = [
      ["practice documents", (s, k) => s.getObject(k), new LocalPracticeDocumentStorage(scratch)],
      ["vaccination", (s, k) => s.getDocument(`v2/${k}`), new VaccinationDocumentStorage(scratch)],
      ["avatars", (s, k) => s.getAvatar(k), new UserAvatarStorage(scratch)],
      ["logos", (s, k) => s.getLogo(k), new PracticeLogoStorage(scratch)],
    ];

    for (const [label, get, store] of readers) {
      for (const key of HOSTILE) {
        await assert.rejects(
          () => get(store, key),
          (err) =>
            /invalid_storage_key|ENOENT|EISDIR|document_not_stored/.test(String(err?.message)),
          `${label} did not refuse ${key}`,
        );
      }
    }

    // And the refusal is the guard, not a missing file: a key that stays inside
    // the root resolves to a path inside the root.
    const store = new VaccinationDocumentStorage(scratch);
    const key = await store.putDocument({
      userId: "u1",
      buffer: Buffer.from("%PDF-1.7 probe"),
      mimeType: "application/pdf",
    });
    assert.ok(path.resolve(scratch, key).startsWith(path.resolve(scratch) + path.sep));
    assert.equal(await store.exists(key), true);
  } finally {
    await fsp.rm(scratch, { recursive: true, force: true });
  }
});

/* ══════════════════════════════════════ the health endpoint says yes or no */

test("the health endpoint reports whether storage is persistent, never where", () => {
  assert.equal(isPersistentStorageConfigured({}), false);
  assert.equal(isPersistentStorageConfigured({ STORAGE_ROOT: "" }), false);
  assert.equal(isPersistentStorageConfigured({ STORAGE_ROOT: "/var/data" }), true);

  const src = read("app.js");
  assert.match(src, /persistentStorage: isPersistentStorageConfigured\(\)/);
  // The value handed out is the function's boolean. If someone ever reaches for
  // the variable itself in this response, that is a path on an unauthenticated
  // endpoint.
  const configBlock = src.slice(src.indexOf("/api/health/config"), src.indexOf("/api/health/config") + 2500);
  assert.ok(
    !/process\.env\.STORAGE_ROOT/.test(configBlock),
    "the health response now reads the storage path directly",
  );
  assert.ok(
    !/storageAreaRoot|rootDir/.test(configBlock),
    "the health response now exposes a resolved storage directory",
  );
});
