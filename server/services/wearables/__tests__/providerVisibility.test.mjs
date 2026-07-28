/**
 * Guards the promise the UI makes: a provider card is only ever shown for something
 * a patient can actually connect right now.
 *
 * Withings, Fitbit and Garmin were listed as "coming soon", which reads as a feature
 * that exists and is merely waiting. No direct OAuth integration was ever written, so
 * GET /providers now serves only connectable sources. Their measurements still arrive
 * through Apple Health / Health Connect whenever the vendor's own app writes them there.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  WEARABLE_PROVIDERS,
  isConnectableProvider,
} from "../providers.js";

/** Mirrors what the route serves — see routes/patientWearables.js GET /providers. */
const served = WEARABLE_PROVIDERS.filter((p) => isConnectableProvider(p.id));

test("only the two on-device stores are offered", () => {
  assert.deepEqual(served.map((p) => p.id).sort(), ["apple_health", "health_connect"]);
});

test("no cloud provider is served while it has no real integration", () => {
  for (const id of ["withings", "fitbit", "garmin"]) {
    assert.equal(isConnectableProvider(id), false, `${id} must not be connectable`);
    assert.equal(served.some((p) => p.id === id), false, `${id} must not be served`);
  }
});

test("unconnectable providers stay in the registry so historic rows resolve", () => {
  // Dropping them outright would make an old WearableConnection row unrecognisable.
  const all = WEARABLE_PROVIDERS.map((p) => p.id);
  for (const id of ["withings", "fitbit", "garmin"]) {
    assert.ok(all.includes(id), `${id} must remain known`);
  }
});

test("every served provider declares only supported vital types", () => {
  const SUPPORTED = new Set([
    "blood_pressure", "heart_rate", "glucose", "weight", "oxygen", "temperature",
  ]);
  for (const p of served) {
    assert.ok(p.supportedTypes.length > 0, `${p.id} must declare types`);
    for (const type of p.supportedTypes) {
      assert.ok(SUPPORTED.has(type), `${p.id} declares unsupported type ${type}`);
    }
  }
});

test("each served provider is bound to exactly one platform", () => {
  assert.equal(served.find((p) => p.id === "apple_health").platform, "ios");
  assert.equal(served.find((p) => p.id === "health_connect").platform, "android");
});
