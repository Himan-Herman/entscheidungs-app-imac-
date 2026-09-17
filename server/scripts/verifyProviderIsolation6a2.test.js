/**
 * Phase 6a.2 — Meda and the interpreter get credentials of their own.
 *
 * Both features used to be "configured" whenever OPENAI_API_KEY existed
 * anywhere in the environment. These tests hold the separation: a credential
 * approved for one purpose must not silently authorise another, and neither
 * feature may reach a provider without its own complete configuration.
 *
 * Run: node --test scripts/verifyProviderIsolation6a2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(SERVER, rel), "utf8");

const { resolveMedaProviderConfig } = await import("../services/meda/provider/medaProviderConfig.js");
const { resolveInterpreterProviderConfig, isInterpreterProviderConfigured } = await import(
  "../services/interpreter/provider/interpreterProviderConfig.js"
);

const SHARED = "sk-shared-key-used-by-other-features";

/* ═══════════════════════════════════════════════════════════════════ MEDA */

test("meda: the shared key alone configures nothing", () => {
  const r = resolveMedaProviderConfig({ OPENAI_API_KEY: SHARED });
  assert.equal(r.configured, false);
});

test("meda: its own credential is required, and the shared one is refused in its place", () => {
  const base = {
    MEDA_PROVIDER: "openai",
    MEDA_BASE_URL: "https://provider.invalid/v1",
    MEDA_MODEL: "m",
  };
  assert.equal(resolveMedaProviderConfig(base).configured, false, "no key at all");
  const pasted = resolveMedaProviderConfig({ ...base, MEDA_API_KEY: SHARED, OPENAI_API_KEY: SHARED });
  assert.equal(pasted.configured, false);
  assert.equal(pasted.reason, "shared_key_refused");
});

test("meda: the fake provider cannot run in production", () => {
  assert.equal(resolveMedaProviderConfig({ MEDA_PROVIDER: "fake" }).configured, true);
  const prod = resolveMedaProviderConfig({ MEDA_PROVIDER: "fake", NODE_ENV: "production" });
  assert.equal(prod.configured, false);
  assert.equal(prod.reason, "fake_provider_not_allowed_in_production");
});

test("meda: production has no approved host, so it fails closed", () => {
  const r = resolveMedaProviderConfig({
    NODE_ENV: "production",
    MEDA_PROVIDER: "openai",
    MEDA_API_KEY: "sk-own",
    MEDA_BASE_URL: "https://anything.example/v1",
    MEDA_MODEL: "m",
    MEDA_DATA_REGION: "eu",
    MEDA_ZERO_RETENTION: "true",
  });
  assert.equal(r.configured, false);
  assert.equal(r.reason, "base_url_not_approved");
});

test("meda: the feature flag is separate from the credential and defaults off", async () => {
  const flags = await import("../config/featureFlags.js?meda-flag");
  const before = process.env.MEDA_ENABLED;
  const beforeKey = process.env.OPENAI_API_KEY;
  try {
    delete process.env.MEDA_ENABLED;
    process.env.OPENAI_API_KEY = SHARED;
    assert.equal(flags.isMedaEnabled(), false, "a shared key must not enable the feature");
    process.env.MEDA_ENABLED = "true";
    assert.equal(flags.isMedaEnabled(), true);
  } finally {
    if (before === undefined) delete process.env.MEDA_ENABLED; else process.env.MEDA_ENABLED = before;
    if (beforeKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = beforeKey;
  }
});

test("meda: the flag being off means no provider call at all", async () => {
  const { runMedaChat } = await import("../services/meda/medaChatService.js?flag-off");
  const before = process.env.MEDA_ENABLED;
  try {
    delete process.env.MEDA_ENABLED;
    process.env.MEDA_PROVIDER = "fake";
    const r = await runMedaChat("u", { message: "was ist blutdruck", locale: "de" });
    assert.equal(r.ok, false);
    assert.equal(r.code, "meda_unavailable");
  } finally {
    if (before === undefined) delete process.env.MEDA_ENABLED; else process.env.MEDA_ENABLED = before;
  }
});

test("meda: flag on but no provider configured still reaches nothing", async () => {
  const { runMedaChat } = await import("../services/meda/medaChatService.js?no-provider");
  const beforeFlag = process.env.MEDA_ENABLED;
  const beforeProv = process.env.MEDA_PROVIDER;
  try {
    process.env.MEDA_ENABLED = "true";
    delete process.env.MEDA_PROVIDER;
    process.env.OPENAI_API_KEY = SHARED;
    const r = await runMedaChat("u2", { message: "was ist blutdruck", locale: "de" });
    assert.equal(r.ok, false, "the shared key must not stand in for a Meda provider");
  } finally {
    if (beforeFlag === undefined) delete process.env.MEDA_ENABLED; else process.env.MEDA_ENABLED = beforeFlag;
    if (beforeProv === undefined) delete process.env.MEDA_PROVIDER; else process.env.MEDA_PROVIDER = beforeProv;
  }
});

test("meda: a valid test configuration works end to end", async () => {
  const { runMedaChat } = await import("../services/meda/medaChatService.js?ok");
  process.env.MEDA_ENABLED = "true";
  process.env.MEDA_PROVIDER = "fake";
  const r = await runMedaChat("u3", { message: "Was bedeutet Blutdruck?", locale: "de" });
  assert.equal(r.ok, true);
  assert.ok(typeof r.reply === "string" && r.reply.length > 0);
});

test("meda: the service no longer holds the shared client", () => {
  const src = read("services/meda/medaChatService.js");
  assert.ok(!/process\.env\.OPENAI_API_KEY/.test(src.replace(/\/\/.*$/gm, "")));
  assert.ok(!/from ["'].*openaiClient/.test(src));
  assert.ok(src.includes("runMedaProvider"), "it must go through its own provider");
});

test("meda: every route sits behind auth, at the mount and at the route", () => {
  const app = read("app.js");
  assert.ok(
    /app\.use\('\/api\/meda',\s*requireAuth,\s*medaRouter\)/.test(app),
    "the mount must repeat the guard as defence in depth",
  );
  const router = read("routes/meda.js");
  for (const m of router.matchAll(/router\.(get|post)\("([^"]+)"\s*,\s*([^)]*)\)/g)) {
    assert.ok(m[3].includes("requireAuth"), `route ${m[2]} lost its guard`);
  }
});

/* ════════════════════════════════════════════════════════════ INTERPRETER */

test("interpreter: the shared key alone configures nothing", () => {
  assert.equal(isInterpreterProviderConfigured({ OPENAI_API_KEY: SHARED }), false);
});

test("interpreter: the shared key pasted into its own variable is refused", () => {
  const r = resolveInterpreterProviderConfig({
    INTERPRETER_PROVIDER: "openai",
    INTERPRETER_API_KEY: SHARED,
    INTERPRETER_BASE_URL: "https://provider.invalid/v1",
    INTERPRETER_MODEL: "m",
    OPENAI_API_KEY: SHARED,
  });
  assert.equal(r.configured, false);
  assert.equal(r.reason, "shared_key_refused");
});

test("interpreter: the fake provider cannot run in production", () => {
  assert.equal(resolveInterpreterProviderConfig({ INTERPRETER_PROVIDER: "fake" }).configured, true);
  const prod = resolveInterpreterProviderConfig({ INTERPRETER_PROVIDER: "fake", NODE_ENV: "production" });
  assert.equal(prod.configured, false);
  assert.equal(prod.reason, "fake_provider_not_allowed_in_production");
});

test("interpreter: production has no approved host, so it fails closed", () => {
  const r = resolveInterpreterProviderConfig({
    NODE_ENV: "production",
    INTERPRETER_PROVIDER: "openai",
    INTERPRETER_API_KEY: "sk-own",
    INTERPRETER_BASE_URL: "https://anything.example/v1",
    INTERPRETER_MODEL: "m",
    INTERPRETER_DATA_REGION: "eu",
    INTERPRETER_ZERO_RETENTION: "true",
  });
  assert.equal(r.configured, false);
  assert.equal(r.reason, "base_url_not_approved");
});

test("interpreter: its feature flags are unchanged and still default off", async () => {
  const flags = await import("../config/featureFlags.js?interp");
  const names = [
    "isMedicalInterpreterEnabled",
    "isInterpreterCloudEnabled",
    "isInterpreterStreamingSttEnabled",
    "isInterpreterNearRealtimeTranslationEnabled",
    "isInterpreterStreamingTtsEnabled",
  ];
  for (const n of names) {
    assert.equal(typeof flags[n], "function", `${n} must still exist`);
    assert.equal(flags[n](), false, `${n} must default to false`);
  }
});

test("interpreter: the gate no longer reads the shared key", () => {
  const src = read("config/interpreterEnv.js");
  const code = src.replace(/^\s*\*.*$/gm, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/process\.env\.OPENAI_API_KEY/.test(code), "the gate must not consult the shared key");
  assert.ok(src.includes("isInterpreterProviderConfigured"));
});

test("interpreter: no service imports the shared client", () => {
  for (const f of ["Transcribe", "Translate", "Simplify", "Speak"]) {
    const rel = `services/interpreter/interpreter${f}Service.js`;
    const src = read(rel);
    assert.ok(!/from ["'].*openaiClient/.test(src), `${rel} still imports the shared client`);
    assert.ok(src.includes("getInterpreterClient"), `${rel} must use the interpreter client`);
  }
});

test("interpreter: an unconfigured client refuses instead of falling back", async () => {
  const { getInterpreterClient, resetInterpreterClient } = await import(
    "../services/interpreter/provider/interpreterClient.js?unconfigured"
  );
  resetInterpreterClient();
  await assert.rejects(
    () => getInterpreterClient({ OPENAI_API_KEY: SHARED }),
    /interpreter_provider_not_configured/,
  );
});

/* ═════════════════════════════════════════ ANONYMOUS PRE-VISIT PROVIDER PATHS */

test("previsit: both provider turns carry an explicit limiter, ahead of the handler", () => {
  const src = read("routes/previsit.js");
  for (const route of ["'/symptoms-followup'", "'/adaptive-intake'"]) {
    const m = src.match(new RegExp(`router\\.post\\(${route},\\s*([^,]+),`));
    assert.ok(m, `${route} has no middleware before its handler`);
    assert.ok(
      m[1].includes("Limiter"),
      `${route} must pass through a limiter before reaching a provider`,
    );
  }
});

test("previsit: the limiter uses the central validated config, not an ad-hoc parser", () => {
  const src = read("middleware/ipRateLimit.js");
  const block = src.slice(src.indexOf("previsitAdaptiveTurnLimiter"));
  assert.ok(block.includes("rateLimitMax("), "it must go through the validated parser");
  assert.ok(/min:\s*\d+/.test(block) && /max:\s*\d+/.test(block) && /why:\s*"/.test(block));
  assert.ok(
    !/Number\(process\.env\.PREVISIT_ADAPTIVE_IP_MAX\)/.test(src),
    "the unvalidated shape must not come back",
  );
});

test("previsit: an out-of-band production override for it is refused too", async () => {
  const mod = await import("../middleware/rateLimitConfig.js?previsit");
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.PREVISIT_ADAPTIVE_IP_MAX = "500000";
  try {
    const v = mod.rateLimitMax("PREVISIT_ADAPTIVE_IP_MAX", {
      fallback: 30, min: 5, max: 300, why: "x",
    });
    assert.equal(v, 30, "production must fall back to the safe default");
    assert.ok(mod.getRateLimitConfigProblems().some((p) => p.includes("PREVISIT_ADAPTIVE_IP_MAX")));
  } finally {
    process.env.NODE_ENV = before;
    delete process.env.PREVISIT_ADAPTIVE_IP_MAX;
  }
});

test("previsit: the data-bearing sub-routes still require authentication", () => {
  // These were already correct and are mounted BEFORE the generic router so
  // their paths are not swallowed. If that order breaks, patient data becomes
  // reachable through the anonymous router.
  const app = read("app.js");
  const guarded = ["follow-ups", "cases", "sessions", "visit-medications"];
  for (const seg of guarded) {
    const re = new RegExp(`app\\.use\\("/api/previsit/${seg}",\\s*requireAuth`);
    assert.ok(re.test(app), `/api/previsit/${seg} must stay behind requireAuth`);
  }
  const generic = app.indexOf('app.use("/api/previsit", previsitRouter)');
  assert.ok(generic > 0, "the generic mount must exist");
  for (const seg of guarded) {
    assert.ok(
      app.indexOf(`/api/previsit/${seg}`) < generic,
      `/api/previsit/${seg} must be mounted before the generic router`,
    );
  }
});

/* ═══════════════════════════════════════════════════════════════════ CSP */

test("csp: the policy is served where a document is actually parsed", () => {
  // The API server returns JSON and never HTML, so a CSP set by helmet would
  // sit on responses no browser parses as a document. The SPA is served by the
  // hosting config in the repo — that is where the policy has to live.
  const app = read("app.js");
  assert.ok(!/express\.static|sendFile/.test(app), "the API server must stay API-only");

  const vercel = JSON.parse(fs.readFileSync(path.join(SERVER, "../client/vercel.json"), "utf8"));
  const doc = vercel.headers?.find((h) => h.source === "/(.*)");
  assert.ok(doc, "document responses need a header block");
  const csp = doc.headers.find((h) => h.key === "Content-Security-Policy");
  assert.ok(csp, "no Content-Security-Policy is served");
  assert.ok(csp.value.includes("default-src 'self'"));
});

test("csp: no wildcard, no eval, no inline script", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(SERVER, "../client/vercel.json"), "utf8"));
  const csp = vercel.headers.find((h) => h.source === "/(.*)")
    .headers.find((h) => h.key === "Content-Security-Policy").value;

  assert.ok(!/(^|[\s;])\*/.test(csp), "a wildcard source defeats the policy");
  assert.ok(!csp.includes("'unsafe-eval'"), "the bundle contains no eval or new Function");
  // 'unsafe-inline' is permitted for styles only, and only because Emotion
  // injects them at runtime. Allowing it for scripts would give away the
  // protection the policy exists for.
  const scriptSrc = csp.match(/script-src ([^;]+)/)?.[1] ?? "";
  assert.ok(!scriptSrc.includes("'unsafe-inline'"), "script-src must not allow inline");
  assert.ok(scriptSrc.trim() === "'self'", `script-src is ${JSON.stringify(scriptSrc)}`);
});

test("csp: the directives the measurement showed are needed are all present", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(SERVER, "../client/vercel.json"), "utf8"));
  const csp = vercel.headers.find((h) => h.source === "/(.*)")
    .headers.find((h) => h.key === "Content-Security-Policy").value;
  const required = {
    // Measured in the built bundle and in the browser, not assumed.
    "img-src": ["'self'", "data:", "blob:"],      // avatars, logos, generated canvas/PDF
    "media-src": ["'self'", "blob:"],             // synthesised speech playback
    "worker-src": ["'self'", "blob:"],            // the service worker (workbox)
    "style-src": ["'self'", "'unsafe-inline'"],   // @emotion injects at runtime
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  for (const [directive, sources] of Object.entries(required)) {
    const found = csp.match(new RegExp(`${directive} ([^;]+)`))?.[1] ?? "";
    for (const src of sources) {
      assert.ok(found.includes(src), `${directive} is missing ${src} (found: ${found.trim()})`);
    }
  }
});

test("csp: the accompanying security headers are served too", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(SERVER, "../client/vercel.json"), "utf8"));
  const headers = Object.fromEntries(
    vercel.headers.find((h) => h.source === "/(.*)").headers.map((h) => [h.key, h.value]),
  );
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.ok(headers["Strict-Transport-Security"]?.includes("max-age="));
  assert.ok(headers["Referrer-Policy"]);
  // Camera and microphone are needed by telemedicine and dictation, from our
  // own origin only; payment is not a capability this product has.
  assert.ok(headers["Permissions-Policy"]?.includes("payment=()"));
});

/* ════════════════════════════════ the shared-key guard now covers both features */

test("guard: neither meda nor the interpreter may take the shared credential", () => {
  const FEATURE_DIRS = [
    "services/meda",
    "services/meda/provider",
    "services/interpreter",
    "services/interpreter/provider",
  ];
  const offenders = [];
  for (const dir of FEATURE_DIRS) {
    for (const f of fs.readdirSync(path.join(SERVER, dir))) {
      if (!f.endsWith(".js")) continue;
      const rel = `${dir}/${f}`;
      for (const line of read(rel).split("\n")) {
        const code = line.split("//")[0].replace(/^\s*\*.*$/, "");
        if (!/process\.env\.OPENAI_API_KEY/.test(code)) continue;
        // A comparison that REFUSES the shared key is the opposite of a leak.
        if (/===|!==|\bif\s*\(/.test(code)) continue;
        offenders.push(`${rel}: ${line.trim()}`);
      }
      if (/from ["'][^"']*openaiClient/.test(read(rel))) {
        offenders.push(`${rel}: imports the shared client`);
      }
    }
  }
  assert.deepEqual(offenders, [], `shared credential reached for:\n  ${offenders.join("\n  ")}`);
});
