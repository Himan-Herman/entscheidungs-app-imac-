/**
 * Unit tests for practiceCardInfo.js — guarantees the practice-hub card info
 * button suppresses card navigation and only the intended card shows it.
 * Run: node --test client/src/pages/__tests__/practiceCardInfo.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CARD_INFO,
  INFO_CARD_IDS,
  hasCardInfo,
  suppressCardNavigation,
} from "../practiceCardInfo.js";

test("only the 13 designated practice-hub cards expose an info button", () => {
  assert.deepEqual(INFO_CARD_IDS, [
    "telemedicine",
    "inbox",
    "patients",
    "messages",
    "documents",
    "medication",
    "dataRequests",
    "team",
    "security",
    "activity",
    "anamnesis",
    "booking",
    "billingPlausibility",
  ]);
  assert.equal(hasCardInfo("telemedicine"), true);
  assert.equal(hasCardInfo("inbox"), true);
  assert.equal(hasCardInfo("patients"), true);
  assert.equal(hasCardInfo("messages"), true);
  assert.equal(hasCardInfo("documents"), true);
  assert.equal(hasCardInfo("medication"), true);
  assert.equal(hasCardInfo("dataRequests"), true);
  assert.equal(hasCardInfo("team"), true);
  assert.equal(hasCardInfo("security"), true);
  assert.equal(hasCardInfo("activity"), true);
  assert.equal(hasCardInfo("anamnesis"), true);
  assert.equal(hasCardInfo("booking"), true);
  assert.equal(hasCardInfo("billingPlausibility"), true);
  // The 1 hub card that intentionally has NO info button.
  for (const other of ["medaLive", ""]) {
    assert.equal(hasCardInfo(other), false);
  }
});

test("each info card has a title id, button/title keys and at least one paragraph key", () => {
  for (const cardId of INFO_CARD_IDS) {
    const cfg = CARD_INFO[cardId];
    assert.ok(cfg.titleId, `${cardId} has a titleId`);
    assert.ok(cfg.buttonKey, `${cardId} has a buttonKey`);
    assert.ok(cfg.titleKey, `${cardId} has a titleKey`);
    assert.ok(
      Array.isArray(cfg.paragraphKeys) && cfg.paragraphKeys.length > 0,
      `${cardId} has paragraph keys`,
    );
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
