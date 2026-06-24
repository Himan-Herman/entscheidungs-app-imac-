/**
 * Unit tests for practiceCardInfo.js — guarantees the practice-hub card info
 * button suppresses card navigation and only the intended card shows it.
 * Run: node --test client/src/pages/__tests__/practiceCardInfo.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  INFO_CARD_IDS,
  hasCardInfo,
  suppressCardNavigation,
} from "../practiceCardInfo.js";

test("only the telemedicine card exposes an info button", () => {
  assert.deepEqual(INFO_CARD_IDS, ["telemedicine"]);
  assert.equal(hasCardInfo("telemedicine"), true);
  for (const other of ["inbox", "patients", "booking", "anamnesis", "security", ""]) {
    assert.equal(hasCardInfo(other), false);
  }
});

test("suppressCardNavigation prevents the card link from opening", () => {
  let prevented = 0;
  let stopped = 0;
  const event = {
    preventDefault: () => {
      prevented += 1;
    },
    stopPropagation: () => {
      stopped += 1;
    },
  };
  suppressCardNavigation(event);
  assert.equal(prevented, 1, "preventDefault called → native anchor navigation blocked");
  assert.equal(stopped, 1, "stopPropagation called → click never reaches the card link");
});

test("suppressCardNavigation is safe with missing / partial events", () => {
  assert.doesNotThrow(() => suppressCardNavigation(undefined));
  assert.doesNotThrow(() => suppressCardNavigation(null));
  assert.doesNotThrow(() => suppressCardNavigation({}));
  // partial event: only one handler present
  let stopped = 0;
  assert.doesNotThrow(() =>
    suppressCardNavigation({ stopPropagation: () => (stopped += 1) }),
  );
  assert.equal(stopped, 1);
});
