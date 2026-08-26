/**
 * Phase 6b — findings from the remaining security surface.
 *
 * Run: node --test scripts/verifyPhase6bSecurity.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(SERVER, rel), "utf8");
const { hashAuthToken } = await import("../utils/authTokenHash.js");

/* ═══════════════════════════════ auth tokens are not stored as they are mailed */

test("a verification or reset token is stored as a hash, never in clear", () => {
  const src = read("routes/auth.js");
  // Every write of these two columns must pass through the hash.
  for (const m of src.matchAll(/(verifyToken|passwordResetToken):\s*([^,\n]+)/g)) {
    const value = m[2].trim();
    if (value === "null") continue;                       // clearing on use
    if (value.startsWith("{")) continue;                  // an expiry comparison
    assert.ok(
      value.startsWith("hashAuthToken("),
      `${m[1]} is assigned ${value} — the plaintext belongs in the mail only`,
    );
  }
});

test("the lookup hashes the incoming token before anything else", () => {
  // Both lookups go through one helper rather than repeating the query, which
  // is why this pins the helper and its use rather than a literal `where`.
  const src = read("routes/auth.js");
  for (const field of ["verifyToken", "passwordResetToken"]) {
    assert.match(
      src,
      new RegExp(`findUserByAuthToken\\(prisma, token, \\{\\s*tokenField: "${field}"`),
      `the ${field} lookup must go through the shared helper`,
    );
  }

  const helper = read("utils/authTokenHash.js");
  // The hash is tried first. A legacy plaintext row is only ever reached after
  // that finds nothing, so a new token can never be matched in clear.
  const hashAt = helper.indexOf("[tokenField]: hashAuthToken(plain)");
  const plainAt = helper.indexOf("[tokenField]: String(plain)");
  assert.ok(hashAt > -1, "the hashed lookup is gone");
  assert.ok(plainAt > -1, "the compatibility lookup is gone");
  assert.ok(hashAt < plainAt, "the hashed lookup must come first");
});

test("the hash is deterministic, and the plaintext is not recoverable from it", () => {
  const plain = crypto.randomBytes(32).toString("hex");
  assert.equal(hashAuthToken(plain), hashAuthToken(plain));
  assert.notEqual(hashAuthToken(plain), plain);
  assert.match(hashAuthToken(plain), /^[a-f0-9]{64}$/);
  assert.notEqual(hashAuthToken(plain), hashAuthToken(plain + "x"));
});

test("expiry and single use are still enforced", () => {
  // Hashing protects the row at rest; these protect the window. Both matter.
  //
  // Expiry now lives in the shared lookup, and it is applied to BOTH branches —
  // the hashed one and the compatibility one — so an old plaintext token cannot
  // outlive its own deadline just because it predates the change.
  const helper = read("utils/authTokenHash.js");
  assert.match(helper, /const notExpired = \{ \[expiryField\]: \{ gt: new Date\(\) \} \};/,
    "the expiry condition is gone");
  const branches = helper.match(/\.\.\.notExpired/g) ?? [];
  assert.equal(branches.length, 2, "every lookup branch must carry the expiry condition");

  // Clearing the token after use is what makes it single use, and that stays
  // with the routes that consume it.
  const src = read("routes/auth.js");
  assert.ok(src.includes("verifyToken: null"), "the token must be cleared after use");
  assert.ok(src.includes("passwordResetToken: null"), "the reset token must be cleared after use");
});

test("security tokens elsewhere are generated from a CSPRNG", () => {
  // Math.random appears in this codebase only for retry jitter and for one
  // deliberately simulated, non-authorising display code. Neither guards
  // anything, and this test keeps it that way for the paths that do.
  const files = [
    "utils/telemedicineTokens.js",
    "utils/interpreterInviteToken.js",
    "utils/connectCodeTokens.js",
    "services/practiceDocument/secureDocumentAccessService.js",
  ];
  for (const f of files) {
    const src = read(f);
    assert.ok(!/Math\.random/.test(src), `${f} must not use Math.random for a token`);
    assert.ok(/crypto\.randomBytes\(/.test(src), `${f} must use crypto.randomBytes`);
    // Most pass a literal; the connect-code generator computes its length from
    // the code format. Only the literal case can be checked here.
    const literal = src.match(/randomBytes\(\s*(\d+)\s*\)/);
    if (literal) {
      assert.ok(Number(literal[1]) >= 16, `${f} generates only ${literal[1]} bytes`);
    }
  }
});

test("the eRezept display code authorises nothing", () => {
  // It is generated with Math.random, which would be a defect if it were a
  // credential. It is not: nothing looks a record up by it.
  const src = read("routes/practiceErezept.js");
  assert.ok(src.includes("simulated"), "the code must stay documented as simulated");
  assert.ok(
    !/where[\s\S]{0,80}tokenCode/.test(src),
    "if a lookup by tokenCode ever appears, it becomes a credential and needs a CSPRNG",
  );
});

/* ══════════════════════════════════ a stored file is never rendered by a browser */

test("both document download paths refuse to let the browser sniff a type", () => {
  for (const rel of [
    "routes/secureDocumentDownload.js",
    "routes/patientPracticeScopedDocuments.js",
  ]) {
    const src = read(rel);
    assert.ok(
      src.includes('"X-Content-Type-Options", "nosniff"'),
      `${rel} must send nosniff — the upload path trusts the client's MIME type`,
    );
    assert.ok(src.includes("Content-Disposition"), `${rel} must set a disposition`);
  }
});

test("inline delivery is limited to PDF", () => {
  const src = read("routes/secureDocumentDownload.js");
  // Anything else served inline would be rendered by the browser, and the
  // upload path cannot promise the bytes match the declared type.
  assert.ok(
    /disposition[\s\S]{0,200}application\/pdf/.test(src),
    "inline must be conditional on the type being PDF",
  );
});

test("the document type allowlist excludes everything a browser executes", () => {
  const src = read("services/practiceDocument/practiceDocumentService.js");
  const block = src.slice(src.indexOf("const ALLOWED_MIME"), src.indexOf("]);", src.indexOf("const ALLOWED_MIME")));
  // Matched as whole types, not substrings: the Word type legitimately
  // contains "xml" (…wordprocessingml.document) and is not something a
  // browser renders.
  const types = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  for (const t of types) {
    assert.ok(
      !/^image\/svg|^text\/html$|^application\/xml$|^text\/xml$|javascript|^application\/octet-stream$/.test(t),
      `${t} must not be an accepted document type`,
    );
  }
  assert.ok(types.length > 0, "the allowlist must not be empty");
  assert.ok(src.includes('throw new Error("validation_invalid_file_type")'), "the list must be enforced");
});

/* ═══════════════════════════════════════════ what the browser is allowed to keep */

test("browser storage holds no medical content and no capability tokens", () => {
  const CLIENT = path.resolve(SERVER, "../client/src");
  const keys = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!/node_modules|__tests__/.test(p)) walk(p); continue; }
      if (!/\.(js|jsx)$/.test(e.name)) continue;
      const src = fs.readFileSync(p, "utf8");
      for (const m of src.matchAll(/(?:localStorage|sessionStorage)\.setItem\(\s*["'`]([^"'`]+)/g)) {
        keys.add(m[1]);
      }
    }
  };
  walk(CLIENT);

  // The JWT is a deliberate choice: CORS runs with credentials:false and there
  // is no cookie handling, so the token has to live somewhere the client can
  // read. Everything else here is an id, a flag or UI state.
  const ALLOWED = new Set([
    "medscout_token", "medscout_user_id", "medscout_theme", "medscout_language",
    "medscoutx_user_mode", "medscoutx_pending_mode",
    "pending_verification_user_id", "pending_verification_email", "email_verified",
    "koerperSeite", "lastMapRoute",
    "symptom_thread_id", "koerper_thread_id", "textsymptom_thread_id",
    // sessionStorage, cleared with the tab, and it holds the body region the
    // URL already names. Reviewed and accepted rather than silently allowed.
    "bodyMapSelection", "medscoutx_body_map_ack_v1",
  ]);
  const unexpected = [...keys].filter((k) => !ALLOWED.has(k));
  assert.deepEqual(
    unexpected,
    [],
    `new browser storage keys — each needs a decision, not a default:\n  ${unexpected.join("\n  ")}`,
  );
  for (const forbidden of ["activePractice", "practiceId", "linkId", "qrToken", "documentToken"]) {
    assert.ok(!keys.has(forbidden), `${forbidden} must not be persisted: context comes from the URL`);
  }
});

test("the practice context is bound to the URL, not to storage", () => {
  const src = fs.readFileSync(
    path.resolve(SERVER, "../client/src/features/practiceContext/PracticeContext.jsx"),
    "utf8",
  );
  assert.ok(src.includes("useParams"), "the route must own the context");
  assert.ok(
    !/localStorage|sessionStorage/.test(src.replace(/^\s*\*.*$/gm, "")),
    "a remembered practice must never stand in for an authorised one",
  );
});

/* ══════════════════════════════ dependencies that sit on a security path */

test("the JWT verification path does not run on a jws that mis-verifies HMAC", () => {
  // GHSA-869p-cjfg-cm3x: jws < 3.2.3 improperly verifies HMAC signatures.
  // jsonwebtoken carries it and jwt.verify() is this product's entire
  // authentication, so the version under it is a security property.
  const lock = JSON.parse(read("package-lock.json"));
  const entries = Object.entries(lock.packages || {}).filter(([p]) => /(^|\/)node_modules\/jws$/.test(p));
  assert.ok(entries.length > 0, "jws must be resolvable in the lockfile");
  for (const [p, meta] of entries) {
    const [major, minor, patch] = String(meta.version).split(".").map(Number);
    const vulnerable = major === 3 && (minor < 2 || (minor === 2 && patch < 3));
    assert.ok(!vulnerable, `${p} resolves jws@${meta.version}, which is in the vulnerable range <3.2.3`);
  }
});

test("the override that pins it is scoped, not global", () => {
  const pkg = JSON.parse(read("package.json"));
  const ov = pkg.overrides || {};
  // web-push ships jws@4, which the advisory does not cover. A global override
  // would drag it down a major version for no security reason.
  assert.ok(!("jws" in ov), "a top-level jws override would also hit web-push");
  assert.equal(ov?.jsonwebtoken?.jws, "^3.2.3", "the pin must name the dependency that carries the risk");
});

test("multer is past the denial-of-service range", () => {
  // Five advisories up to 2.1.1, and every upload route in the product runs
  // through it.
  const lock = JSON.parse(read("package-lock.json"));
  const entry = lock.packages?.["node_modules/multer"];
  assert.ok(entry, "multer must be in the lockfile");
  const [major, minor] = String(entry.version).split(".").map(Number);
  assert.ok(major > 2 || (major === 2 && minor >= 2), `multer@${entry.version} is still in the vulnerable range`);
});

test("the dependency surface does not grow without this decision being revisited", () => {
  /*
   * Phase 6b.3 accepted five remaining advisories rather than "fixing" them.
   *
   * All five would be resolved only by DOWNGRADING — prisma 6.15 to 6.12,
   * passkit-generator 3.5 to 3.1 — and none is reachable from a request: the
   * prisma chain (@prisma/config, deepmerge-ts, defu) is loaded by the CLI when
   * migrations run, and `joi` arrives through passkit-generator, which is
   * dynamically imported only on the credential-gated Apple Wallet path. Going
   * backwards to silence a scanner would trade a theoretical risk for a real
   * one.
   *
   * That acceptance is only sound while the surface stays what it was measured
   * to be. This test cannot run `npm audit` — it would need the network and
   * would turn an offline suite into a flaky one — so it pins the thing that
   * DOES change when the picture changes: the set of direct dependencies. A new
   * one cannot appear without this list being edited, and editing it is the
   * moment to ask what it drags in.
   */
  const pkg = JSON.parse(read("package.json"));
  const direct = Object.keys(pkg.dependencies ?? {}).sort();

  const KNOWN = [
    "@prisma/client", "bcryptjs", "cors", "dotenv", "express", "ffmpeg-static",
    "fluent-ffmpeg", "helmet", "jsonwebtoken", "mammoth", "multer", "node-fetch",
    "openai", "passkit-generator", "pdf-lib", "prisma", "react-icons", "resend",
    "unpdf", "web-push"
  ];

  const added = direct.filter((d) => !KNOWN.includes(d));
  const removed = KNOWN.filter((k) => !direct.includes(k));

  assert.deepEqual(
    added,
    [],
    `new direct dependencies: ${added.join(", ")}\n` +
      "Run `npm audit`, decide what they bring with them, then add them to KNOWN above.",
  );
  assert.deepEqual(
    removed,
    [],
    `direct dependencies disappeared: ${removed.join(", ")}\n` +
      "If that was deliberate, remove them from KNOWN — but check nothing still imports them.",
  );
});

test("the unused mail module and its dependency stay gone", () => {
  // `utils/verification.js` built its own SMTP transport and was imported by
  // nothing: every verification and reset mail goes through emailService.js.
  // It was removed in 6b.2 together with nodemailer, which was there only for
  // that file and carried eight high advisories — none of them reachable,
  // because no code path led to them. Deleting was cheaper and safer than a
  // major upgrade of a dependency the product does not use.
  //
  // This test exists so the module cannot quietly come back, and so a future
  // `npm install nodemailer` has to be a deliberate decision with its own
  // review rather than an accident of copying an old snippet.
  assert.ok(
    !fs.existsSync(path.join(SERVER, "utils/verification.js")),
    "the unused SMTP module is back — mail belongs in emailService.js",
  );

  const pkg = JSON.parse(read("package.json"));

  /*
   * Three mail providers were declared and none of them was called. Resend is
   * the one the product actually uses (emailService.js); nodemailer existed
   * only for the deleted utils/verification.js, and @sendgrid/mail and postmark
   * were referenced nowhere at all — they were the sole source of axios, which
   * alone carried twenty-eight advisories.
   *
   * Removing them took the count from seventeen to five without changing a
   * single line of behaviour. They are listed by name here because the way they
   * come back is somebody copying an old snippet, not somebody deciding to
   * switch mail providers.
   */
  const REMOVED = ["nodemailer", "@sendgrid/mail", "postmark"];
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const dep of REMOVED) {
      assert.ok(
        !pkg[field]?.[dep],
        `${dep} reappeared in ${field}; it had no caller and was removed with its advisories`,
      );
    }
  }
});

/* ═══════════════════════════════════════════ code that is shipped, and code that is not */

test("the removed /api/ki route stays removed", () => {
  /*
   * Phase 6a deleted `routes/ki.js` and its mount. This is the guard for that,
   * and only that.
   */
  assert.ok(!fs.existsSync(path.join(SERVER, "routes/ki.js")), "routes/ki.js is back");
  const appSrc = read("app.js");
  assert.ok(!/["']\/api\/ki["']/.test(appSrc), "/api/ki is mounted again");
  assert.ok(!/routes\/ki\.js/.test(appSrc), "routes/ki.js is imported again");
});

test("the symptom prompt builders are server-side production code, not a dead island", () => {
  /*
   * A correction to what Phase 6b.2 reported, kept as a test so the mistake
   * cannot be repeated from the same evidence.
   *
   * 6b.2 concluded that `client/src/pages/prompt/` was a closed dead island,
   * because nothing under `client/src` imported App.jsx and App.jsx was the
   * only client-side importer of the folder. That search was the wrong shape:
   * the SERVER imports these files directly across the project boundary, and
   * `symptom.js`, `symptomThread.js` and `koerpersymptomThread.js` build every
   * symptom-checker prompt from them. Deleting the folder in 6b.3 stopped the
   * API from starting at all, which is how the error was found.
   *
   * Three server-side safety scripts also assert the MDR wording inside these
   * files — "NO diagnosis", "Not medical advice", "FORBIDDEN: diagnosis". They
   * are among the most safety-relevant text in the product, and they live under
   * `client/src` for historical reasons only.
   *
   * This test pins the dependency so it is visible from the server side, where
   * someone tidying the client would otherwise never look.
   */
  const LIVE = {
    "bildanalysePrompt.js": ["routes/symptom.js"],
    "textsymptomPrompt.js": ["routes/symptomThread.js"],
    "symptomCheckSummaryPrompt.js": ["routes/symptomThread.js"],
    "koerpersymptomPrompt.js": ["routes/koerpersymptomThread.js"],
    "koerpersymptomSummaryPrompt.js": ["routes/koerpersymptomThread.js"],
  };

  for (const [file, importers] of Object.entries(LIVE)) {
    assert.ok(
      fs.existsSync(path.join(SERVER, "..", "client/src/pages/prompt", file)),
      `${file} is gone — the server imports it and will not start without it`,
    );
    for (const importer of importers) {
      assert.match(
        read(importer),
        new RegExp(`client/src/pages/prompt/${file.replace(".", "\\.")}`),
        `${importer} no longer imports ${file} — if the prompt moved, update this list`,
      );
    }
  }
});

test("the revoked-relationship policy lives in one place, and everything reads it", () => {
  /*
   * Before this, the rule existed as a comment inside the messaging service and
   * nowhere else, while five separate byte-identical copies of the patient link
   * guard sat in five domains — none of which mentioned it. Anyone working on
   * appointments or eRezept had no way to learn that "revoked" means "no new
   * activity" and not "no access", and the most likely correction was the wrong
   * one: add a status check, and take a patient's own history away from them.
   *
   * So the guard is one function now, the policy is written above it, and this
   * test keeps both facts true: the file says the rule, and nobody has quietly
   * grown a private copy again.
   */
  const policy = read("services/careRelationship/patientLinkAccess.js");
  for (const [claim, pattern] of [
    ["historical read is allowed", /historical READ\s+allowed/],
    ["new interaction is denied", /new WRITE \/ interaction\s+denied/],
    ["scope does not move", /still cannot see A2/],
    ["resource-level withdrawal wins", /PracticeDocumentShareGrant that has been revoked still refuses/],
  ]) {
    assert.match(policy, pattern, `the policy no longer states that ${claim}`);
  }

  const CALLERS = [
    "services/calendar/appointmentService.js",
    "services/telemedicine/telemedicineContextService.js",
    "services/patientInbox/patientInboxContextService.js",
    "services/practiceDocument/practiceDocumentService.js",
    "services/erezept/patientErezeptContextService.js",
  ];
  for (const caller of CALLERS) {
    const src = read(caller);
    assert.match(
      src,
      /careRelationship\/patientLinkAccess\.js/,
      `${caller} no longer uses the shared guard`,
    );
    assert.ok(
      !/async function assertPatientOwnsLink/.test(src),
      `${caller} grew its own copy of the guard again — the policy would not travel with it`,
    );
  }
});
