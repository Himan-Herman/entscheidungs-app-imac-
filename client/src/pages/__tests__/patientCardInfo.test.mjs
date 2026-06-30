/**
 * Unit tests for patientCardInfo.js — guarantees the patient "Meine Praxis" hub
 * info button suppresses tile navigation and only the intended tiles show it.
 * Run: node --test client/src/pages/__tests__/patientCardInfo.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PATIENT_CARD_INFO,
  PATIENT_INFO_TILE_KEYS,
  hasPatientCardInfo,
  suppressTileNavigation,
} from "../patientCardInfo.js";

test("exactly the designated patient-hub tiles expose an info button", () => {
  assert.deepEqual(PATIENT_INFO_TILE_KEYS, [
    "hubLinkInbox",
    "hubLinkThreads",
    "hubLinkAppointments",
    "hubLinkTelemedicine",
    "hubLinkPracticeDocuments",
    "hubLinkPracticeErezept",
    "hubLinkVisitMedications",
    "hubLinkDataControl",
    "hubLinkPatientActivity",
    "hubLinkCases",
    "hubLinkFindPractices",
    "hubLinkMedScoutXDirectory",
    "hubLinkMyPractice",
    "hubLinkMedicationPlans",
    "hubLinkPreVisit",
    "hubLinkHealthProfile",
  ]);
  for (const key of PATIENT_INFO_TILE_KEYS) {
    assert.equal(hasPatientCardInfo(key), true, `${key} has info`);
  }
  // Tiles from other hub groups / main overview must NOT get an info button.
  for (const other of [
    "hubLinkVitals",
    "hubLinkHealthHistory",
    "hubLinkSymptom",
    "hubLinkOrientation",
    "",
  ]) {
    assert.equal(hasPatientCardInfo(other), false, `${other} has no info`);
  }
});

test("each info tile has a title id, button/title keys and 3 paragraph keys", () => {
  for (const key of PATIENT_INFO_TILE_KEYS) {
    const cfg = PATIENT_CARD_INFO[key];
    assert.ok(cfg.titleId, `${key} has a titleId`);
    assert.ok(cfg.buttonKey, `${key} has a buttonKey`);
    assert.ok(cfg.titleKey, `${key} has a titleKey`);
    assert.ok(
      Array.isArray(cfg.paragraphKeys) && cfg.paragraphKeys.length === 3,
      `${key} has 3 paragraph keys`,
    );
  }
  // title ids must be unique
  const ids = PATIENT_INFO_TILE_KEYS.map((k) => PATIENT_CARD_INFO[k].titleId);
  assert.equal(new Set(ids).size, ids.length, "title ids are unique");
});

test("suppressTileNavigation prevents the tile link from opening", () => {
  let prevented = 0;
  let stopped = 0;
  suppressTileNavigation({
    preventDefault: () => (prevented += 1),
    stopPropagation: () => (stopped += 1),
  });
  assert.equal(prevented, 1, "preventDefault called → native anchor navigation blocked");
  assert.equal(stopped, 1, "stopPropagation called → click never reaches the tile link");
});

test("suppressTileNavigation is safe with missing / partial events", () => {
  assert.doesNotThrow(() => suppressTileNavigation(undefined));
  assert.doesNotThrow(() => suppressTileNavigation(null));
  assert.doesNotThrow(() => suppressTileNavigation({}));
  let stopped = 0;
  assert.doesNotThrow(() => suppressTileNavigation({ stopPropagation: () => (stopped += 1) }));
  assert.equal(stopped, 1);
});
