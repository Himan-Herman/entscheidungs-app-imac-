/**
 * Phase 6a — the confirmed findings, held down.
 *
 * Each test here names a defect that was measured in the Phase 6 inventory,
 * not a hypothetical one. They are written so that undoing the fix fails the
 * test rather than merely looking different.
 *
 * Run: node --test scripts/verifyPhase6aSecurity.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(HERE, "..");
const read = (rel) => fs.readFileSync(path.join(SERVER, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(SERVER, rel));

/* ═══════════════════════════════════════════ C1 — the /api/ki egress path */

test("C1: the unauthenticated /api/ki route is gone", () => {
  assert.equal(exists("routes/ki.js"), false, "routes/ki.js still exists");
  const app = read("app.js");
  assert.ok(!app.includes("/api/ki"), "app.js still mounts /api/ki");
  assert.ok(!app.includes("routes/ki.js"), "app.js still imports the ki router");
});

test("C1: its rate limiter is gone with it", () => {
  assert.ok(
    !read("middleware/ipRateLimit.js").includes("kiOpenAiRouteLimiter"),
    "a limiter for a removed route is a hint to bring the route back",
  );
});

test("C1: the legacy entry point builds no server of its own", () => {
  const index = read("index.js");
  // It used to construct express(), open CORS to every origin, accept a 50 MB
  // body and mount /api/textsymptom with no auth — a route the real server
  // serves behind requireAuth.
  const code = index
    .split("\n")
    .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
    .join("\n");
  for (const forbidden of ["express()", "cors(", "app.use", "app.listen", "express.json"]) {
    assert.ok(!code.includes(forbidden), `index.js still contains ${forbidden}`);
  }
  assert.ok(/import\s+["']\.\/app\.js["']/.test(code), "index.js must delegate to app.js");
});

test("C1: every entry point therefore serves the same guarded routes", () => {
  const app = read("app.js");
  assert.ok(
    /app\.use\(['"]\/api\/textsymptom['"],\s*requireAuth/.test(app),
    "/api/textsymptom must stay behind requireAuth",
  );
});

/* ═════════════════════════════ H2 — production rate limits cannot go silent */

test("H2: an out-of-band production override is refused, not clamped silently", async () => {
  const mod = await import(`../middleware/rateLimitConfig.js?case=oob`);
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.__T_OOB = "999999";
  try {
    const band = { fallback: 60, min: 10, max: 600, why: "test band" };
    const value = mod.rateLimitMax("__T_OOB", band);
    assert.equal(value, 60, "the safe default must be what is actually used");
    const problems = mod.getRateLimitConfigProblems();
    assert.ok(
      problems.some((p) => p.includes("__T_OOB")),
      "the misconfiguration must be reported so startup can refuse",
    );
  } finally {
    process.env.NODE_ENV = before;
    delete process.env.__T_OOB;
  }
});

test("H2: zero, negative, fractional and non-numeric are all rejected in production", async () => {
  const mod = await import(`../middleware/rateLimitConfig.js?case=bad`);
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const band = { fallback: 20, min: 5, max: 200, why: "test band" };
  try {
    for (const bad of ["0", "-5", "12.5", "abc", " "]) {
      process.env.__T_BAD = bad;
      assert.equal(mod.rateLimitMax("__T_BAD", band), 20, `accepted ${JSON.stringify(bad)}`);
    }
  } finally {
    process.env.NODE_ENV = before;
    delete process.env.__T_BAD;
  }
});

test("H2: a value inside the band is honoured in production", async () => {
  const mod = await import(`../middleware/rateLimitConfig.js?case=ok`);
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.__T_OK = "120";
  try {
    assert.equal(mod.rateLimitMax("__T_OK", { fallback: 60, min: 10, max: 600, why: "x" }), 120);
  } finally {
    process.env.NODE_ENV = before;
    delete process.env.__T_OK;
  }
});

test("H2: a test environment may still raise limits far above the band", async () => {
  const mod = await import(`../middleware/rateLimitConfig.js?case=test`);
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  process.env.__T_HIGH = "100000";
  try {
    // The whole E2E suite arrives from one loopback address; without this the
    // suite throttles itself and the failure looks like a product defect.
    assert.equal(mod.rateLimitMax("__T_HIGH", { fallback: 20, min: 5, max: 200, why: "x" }), 100000);
  } finally {
    process.env.NODE_ENV = before;
    delete process.env.__T_HIGH;
  }
});

test("H2: startup fails closed in production when a limit is misconfigured", () => {
  const src = read("utils/startupEnvValidation.js");
  assert.ok(src.includes("getRateLimitConfigProblems"), "startup must consult the limiter config");
  assert.ok(src.includes("RATE_LIMIT_CONFIG"), "the problem must reach missingCritical");
  assert.ok(
    /if \(isProd && missingCritical\.length > 0\) \{[\s\S]{0,120}throw new Error/.test(src),
    "production must refuse to start, not warn and continue",
  );
});

test("H2: every overridable limit declares a band", () => {
  const src = read("middleware/ipRateLimit.js");
  assert.ok(
    !/Number\(process\.env\.\w+\)\s*\|\|/.test(src),
    "an unvalidated Number(env) || default is exactly the pattern this replaces",
  );
  const bands = [...src.matchAll(/rateLimitMax\("(\w+)"/g)].map((m) => m[1]);
  assert.ok(bands.length >= 6, `expected the overridable limits, found ${bands.length}`);
  for (const b of bands) {
    const block = src.slice(src.indexOf(`rateLimitMax("${b}"`));
    assert.ok(/min:\s*\d+/.test(block) && /max:\s*\d+/.test(block) && /why:\s*"/.test(block),
      `${b} must declare min, max and a reason`);
  }
});

/* ═══════════════════════════ M1 — the practice inbox target is derived */

test("M1: the inbox serializer derives its target instead of replaying it", async () => {
  const { practiceInboxItemToJson } = await import("../services/practiceInbox/practiceInboxService.js");
  const row = {
    id: "i1", practiceProfileId: "P1", practicePatientLinkId: "L1",
    type: "message", title: "t", status: "new", sourceRefType: "thread",
    targetUrl: "https://evil.example/steal",
  };
  const json = practiceInboxItemToJson(row);
  assert.equal(json.targetUrl, "/practice/patients/L1/messages?practiceId=P1");
  assert.ok(!JSON.stringify(json).includes("evil.example"));
});

test("M1: an unbound row keeps only a same-origin path", async () => {
  const { practiceInboxItemToJson } = await import("../services/practiceInbox/practiceInboxService.js");
  const base = { id: "i", practiceProfileId: "P1", type: "system", title: "t", status: "new" };
  assert.equal(practiceInboxItemToJson({ ...base, targetUrl: "https://evil.example/x" }).targetUrl, null);
  assert.equal(practiceInboxItemToJson({ ...base, targetUrl: "//evil.example/x" }).targetUrl, null);
  assert.equal(practiceInboxItemToJson({ ...base, targetUrl: "javascript:alert(1)" }).targetUrl, null);
  assert.equal(practiceInboxItemToJson({ ...base, targetUrl: "data:text/html,x" }).targetUrl, null);
  assert.equal(practiceInboxItemToJson({ ...base, targetUrl: "/practice/inbox" }).targetUrl, "/practice/inbox");
});

test("M1: the header preview and the inbox page share ONE derivation", async () => {
  const shared = await import("../services/practiceInbox/practiceInboxTargets.js");
  const svc = read("services/practiceInbox/practiceInboxService.js");
  const nc = read("services/notificationCenter/notificationCenterService.js");
  assert.ok(typeof shared.practiceInboxTargetUrl === "function");
  assert.ok(svc.includes("practiceInboxTargets.js"), "the serializer must use the shared module");
  assert.ok(nc.includes("practiceInboxTargets.js"), "the preview must use the shared module");
  // A second copy is how the two quietly stop agreeing.
  assert.ok(!/function practiceInboxTargetUrl/.test(nc), "no second definition in the notification centre");
});

test("M1: deriving a target costs no extra query", () => {
  const src = read("services/practiceInbox/practiceInboxTargets.js");
  assert.ok(!/prisma\./.test(src), "the derivation must read the row, not the database");
});

/* ═══════════════════════════════════ M2 / M3 — what logs may not contain */

test("M2: the geocoder never logs the search query", () => {
  const src = read("services/places/geocoding.js");
  assert.ok(
    !/console\.\w+\([^)]*query/.test(src),
    "a practice search query is often a street address",
  );
});

test("M3: auth errors go through the sanitising logger", () => {
  const src = read("routes/auth.js");
  assert.ok(!src.includes("err?.response?.body"), "provider payload must not be logged");
  for (const ctx of ["auth/resend-verification", "auth/request-password-reset", "auth/reset-password"]) {
    assert.ok(src.includes(`logServerError("${ctx}"`), `${ctx} must use logServerError`);
  }
  // Not a list of three: the whole file. The inventory found three sites and
  // this test then found three more, which is the point of asserting the
  // property rather than the enumeration.
  const rawLogs = [...src.matchAll(/console\.(error|warn|log)\(/g)];
  assert.deepEqual(
    rawLogs.map((m) => m[0]),
    [],
    "auth.js must route every log through logServerError",
  );
});

test("M3: the sanitising logger keeps nothing but context in production", () => {
  const src = read("utils/safeApiError.js");
  const prodBranch = src.slice(src.indexOf("if (isProd)"), src.indexOf("} else {"));
  assert.ok(prodBranch.includes("context") && prodBranch.includes("name"));
  for (const leak of ["err.message", "err?.message", "stack", "err.stack", "JSON.stringify(err)"]) {
    assert.ok(!prodBranch.includes(leak), `production log must not include ${leak}`);
  }
});

/* ═════════════════════════ standing guards on what Phase 6 measured as sound */

test("the hardened provider modules never reach for the shared key", () => {
  // Seven paths were given their own credential in earlier phases. This is
  // what stops one of them from quietly regaining the shared one — the exact
  // regression the dedicated-key work exists to prevent.
  const HARDENED = [
    "services/documentTranslation/provider",
    "services/messageTranslation/provider",
    "services/messageSpeech/provider",
    "services/preVisitVoice/provider",
    "services/preVisitVoiceOutput/provider",
    "services/symptomVoice/provider",
    "services/symptomVoiceOutput/provider",
  ];
  const offenders = [];
  for (const dir of HARDENED) {
    for (const f of fs.readdirSync(path.join(SERVER, dir))) {
      if (!f.endsWith(".js")) continue;
      const rel = `${dir}/${f}`;
      for (const line of read(rel).split("\n")) {
        // Only USE of the value counts. These files talk about the shared key
        // constantly — in doc comments explaining why they refuse it, and in
        // one case in a check that REJECTS a config which set the shared key
        // as the dedicated one. Flagging those would make the guard noise.
        const code = line.split("//")[0].replace(/^\s*\*.*$/, "");
        if (!/process\.env\.OPENAI_API_KEY/.test(code)) continue;
        const isRejection = /===|!==|\bif\s*\(/.test(code);
        if (isRejection) continue;
        offenders.push(`${rel}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `a hardened provider reached for OPENAI_API_KEY:\n  ${offenders.join("\n  ")}`);
});

test("no credential falls back to another feature's credential", () => {
  // `FEATURE_KEY || OPENAI_API_KEY` is the shape that makes one approval look
  // like another. The Phase 6 inventory measured zero of these; keep it zero.
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(SERVER, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!/node_modules|__tests__/.test(rel)) walk(rel); continue; }
      if (!e.name.endsWith(".js")) continue;
      for (const line of read(rel).split("\n")) {
        const code = line.split("//")[0];
        if (/(API_KEY|_SECRET|_TOKEN)[^;]{0,40}(\|\||\?\?)[^;]{0,60}(API_KEY|_SECRET|_TOKEN)/.test(code)) {
          offenders.push(`${rel}: ${line.trim().slice(0, 90)}`);
        }
      }
    }
  };
  walk("services");
  walk("routes");
  walk("config");
  assert.deepEqual(offenders, [], `credential fallback found:\n  ${offenders.join("\n  ")}`);
});

test("the health config endpoint exposes capability booleans and nothing else", () => {
  const app = read("app.js");
  const start = app.indexOf("app.get('/api/health/config'");
  assert.ok(start > 0, "the endpoint must exist to be constrained");
  const block = app.slice(start, start + 2200);
  // A secret, a URL or a model name in this payload would turn a health probe
  // into a configuration disclosure.
  // A capability report says WHETHER something is configured. Wrapping the
  // variable in Boolean() is exactly right; emitting the value is not.
  const leaks = [];
  for (const line of block.split("\n")) {
    const code = line.split("//")[0];
    for (const m of code.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      const name = m[1];
      if (!/(KEY|SECRET|TOKEN|PASSWORD|URL)$/.test(name)) continue;
      // Boolean(...) and .length are safe shapes; a bare reference is not.
      const wrapped = /Boolean\(\s*process\.env\.[A-Z0-9_]+/.test(code) ||
        /process\.env\.[A-Z0-9_]+\s*\)?\s*\?\?/.test(code) ||
        /!!\s*process\.env\./.test(code);
      if (!wrapped) leaks.push(`${name} in: ${line.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(leaks, [], `health/config must report capability, not value:\n  ${leaks.join("\n  ")}`);
  // Origins are reported as a count, never as the list itself.
  assert.ok(/originCount/.test(block), "cors origins must be reported as a count");
  assert.ok(!/origins:\s*allowedOrigins/.test(block), "the origin list itself must not be returned");
});
