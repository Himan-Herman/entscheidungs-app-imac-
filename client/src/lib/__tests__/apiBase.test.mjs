/**
 * API URL resolution — web behaviour must stay byte-identical, native must go absolute.
 * Run: node --test client/src/lib/__tests__/apiBase.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { resolveApiUrl, isNativeApp, API_BASE } = await import("../apiBase.js");

const asWeb = () => { delete globalThis.window; };
const asNative = () => { globalThis.window = { Capacitor: { isNativePlatform: () => true } }; };

test("web: relative paths are returned UNCHANGED (zero regression)", () => {
  asWeb();
  assert.equal(isNativeApp(), false);
  for (const p of ["/api/patient/vitals", "/api/auth/login", "/api/patient/wearables/connect"]) {
    assert.equal(resolveApiUrl(p), p);
  }
});

test("web build in a plain browser stays relative", () => {
  globalThis.window = {};
  assert.equal(resolveApiUrl("/api/x"), "/api/x");
});

test("Capacitor present but running as web platform stays relative", () => {
  globalThis.window = { Capacitor: { isNativePlatform: () => false } };
  assert.equal(resolveApiUrl("/api/x"), "/api/x");
});

test("native: relative paths become absolute", () => {
  asNative();
  assert.equal(isNativeApp(), true);
  assert.equal(resolveApiUrl("/api/patient/vitals"), `${API_BASE}/api/patient/vitals`);
  assert.equal(resolveApiUrl("api/patient/vitals"), `${API_BASE}/api/patient/vitals`);
});

test("absolute URLs are never rewritten, on either runtime", () => {
  for (const setup of [asWeb, asNative]) {
    setup();
    assert.equal(resolveApiUrl("https://api.medscout.app/api/x"), "https://api.medscout.app/api/x");
    assert.equal(resolveApiUrl("http://localhost:3000/api/x"), "http://localhost:3000/api/x");
  }
});

test("non-string input passes through untouched", () => {
  asNative();
  const req = { url: "x" };
  assert.equal(resolveApiUrl(req), req);
  assert.equal(resolveApiUrl(undefined), undefined);
  assert.equal(resolveApiUrl(null), null);
});

test("a broken Capacitor global never throws", () => {
  globalThis.window = { Capacitor: { isNativePlatform: null } };
  assert.equal(isNativeApp(), false);
  globalThis.window = { get Capacitor() { throw new Error("boom"); } };
  assert.equal(isNativeApp(), false);
  assert.equal(resolveApiUrl("/api/x"), "/api/x");
});

test("API_BASE is an https origin", () => {
  assert.match(API_BASE, /^https:\/\//);
});

// ── Service-worker cleanup (native shell) ─────────────────────────────────
// Node 22 exposes `navigator` as a getter-only global, so override it explicitly.
const setNavigator = (v) =>
  Object.defineProperty(globalThis, "navigator", { value: v, configurable: true, writable: true });
const { unregisterServiceWorkers } = await import("../apiBase.js");

test("unregisterServiceWorkers removes registrations and caches", async () => {
  const unregistered = [];
  const deleted = [];
  setNavigator({
    serviceWorker: {
      getRegistrations: async () => [
        { unregister: async () => { unregistered.push("a"); return true; } },
        { unregister: async () => { unregistered.push("b"); return true; } },
      ],
    },
  });
  globalThis.caches = {
    keys: async () => ["v1", "v2"],
    delete: async (k) => { deleted.push(k); return true; },
  };
  await unregisterServiceWorkers();
  assert.deepEqual(unregistered, ["a", "b"]);
  assert.deepEqual(deleted, ["v1", "v2"]);
});

test("unregisterServiceWorkers never throws when APIs are missing or broken", async () => {
  setNavigator(undefined);
  globalThis.caches = undefined;
  await unregisterServiceWorkers();               // no serviceWorker at all

  setNavigator({ serviceWorker: { getRegistrations: async () => { throw new Error("boom"); } } });
  await unregisterServiceWorkers();               // throwing API

  setNavigator({
    serviceWorker: { getRegistrations: async () => [{ unregister: async () => { throw new Error("nope"); } }] },
  });
  globalThis.caches = { keys: async () => ["x"], delete: async () => { throw new Error("nope"); } };
  await unregisterServiceWorkers();               // throwing per-item
  assert.ok(true, "reached the end without throwing");
});
