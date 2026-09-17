/**
 * Phase 5C — the header entry speaks in every locale the app offers.
 *
 * The repo's convention is DE/EN authored and the rest resolving through the
 * English fallback. What must not happen is a key resolving to nothing, or to
 * its own name, because the header shows these strings with no surrounding
 * context to recover the meaning from.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getMessages, bundles } from "../translations/index.js";
import de from "../translations/de/notificationCenter.js";

const KEYS = Object.keys(de);

test("every key is authored in German", () => {
  assert.ok(KEYS.length >= 20);
  for (const k of KEYS) {
    assert.equal(typeof de[k], "string", k);
    assert.ok(de[k].trim().length > 0, k);
  }
});

test("every locale resolves every key to real text", () => {
  for (const code of Object.keys(bundles)) {
    const ns = getMessages(code).notificationCenter;
    assert.ok(ns, `${code}: namespace missing`);
    for (const k of KEYS) {
      assert.equal(typeof ns[k], "string", `${code}.${k}`);
      assert.ok(ns[k].trim().length > 0, `${code}.${k}`);
      assert.ok(!ns[k].includes("{{"), `${code}.${k} looks unresolved`);
    }
  }
});

test("the count placeholder survives into every locale", () => {
  for (const code of Object.keys(bundles)) {
    const ns = getMessages(code).notificationCenter;
    for (const k of ["unreadLabel", "newLabel", "remindersCount", "toggleAriaWithCount"]) {
      assert.ok(ns[k].includes("{count}"), `${code}.${k} lost its placeholder`);
    }
  }
});

test("German is authored, not an English echo", () => {
  const en = getMessages("en").notificationCenter;
  const differing = KEYS.filter((k) => de[k] !== en[k]);
  assert.ok(differing.length > KEYS.length / 2, "German looks copied from English");
});
