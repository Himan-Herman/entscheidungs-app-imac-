/**
 * Guards the telemedicine permission gap that caused "Videosprechstunden konnten
 * nicht geladen werden" for clinicians and hid the telemedicine tile from them.
 * Run: node --test server/utils/__tests__/practicePermissions.telemedicine.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PERMISSIONS,
  hasPracticePermission,
  canReadTelemedicine,
  canManageTelemedicine,
} from "../practicePermissions.js";

test("doctor can read AND manage telemedicine (run video consultations)", () => {
  assert.equal(canReadTelemedicine("doctor"), true);
  assert.equal(canManageTelemedicine("doctor"), true);
  // read enables the hub tile (visibility gate) + the video-settings GET
  assert.equal(hasPracticePermission("doctor", PERMISSIONS.TELEMEDICINE_READ), true);
});

test("owner keeps full telemedicine access", () => {
  assert.equal(canReadTelemedicine("owner"), true);
  assert.equal(canManageTelemedicine("owner"), true);
  assert.equal(hasPracticePermission("owner", PERMISSIONS.TELEMEDICINE_SETTINGS), true);
});

test("roles that already had telemedicine read keep it", () => {
  assert.equal(canReadTelemedicine("secretary"), true);
  assert.equal(canReadTelemedicine("assistant"), true);
});

test("an unknown role has no telemedicine access (deny-by-default)", () => {
  assert.equal(canReadTelemedicine("definitely_not_a_role"), false);
  assert.equal(canManageTelemedicine(""), false);
  assert.equal(canManageTelemedicine(null), false);
});
