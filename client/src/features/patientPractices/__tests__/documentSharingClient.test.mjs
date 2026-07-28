/**
 * The sharing client holds no authorization logic. These tests pin what it is
 * allowed to send and what it shows the patient when the server refuses.
 *
 * Run: node --test src/features/patientPractices/__tests__/documentSharingClient.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, "..", rel), "utf8");

const apiSrc = read("api/documentShareGrantsApi.js");
/** Sources with comments stripped — an assertion must never be satisfied by a comment. */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const dialogSrc = stripComments(read("components/ShareDocumentDialog.jsx"));
const sectionSrc = stripComments(read("components/SharedDataSection.jsx"));
const modalSrc = stripComments(read("components/FocusModal.jsx"));

/* --------------------------------------------------------- request payload */

test("the create request sends the target link and nothing else", () => {
  const body = apiSrc.match(/body: JSON\.stringify\(([\s\S]*?)\),/);
  assert.ok(body, "no request body found");
  assert.match(body[1], /^\{ targetPracticePatientLinkId \}$/);

  for (const forbidden of [
    "patientUserId", "sourcePracticeProfileId", "sourcePracticePatientLinkId",
    "targetPracticeProfileId", "grantedByUserId", "grantedAt", "expiresAt",
    "practiceId", "status",
  ]) {
    assert.ok(!body[1].includes(forbidden), `${forbidden} must never be sent`);
  }
});

test("the client sends no practice id of its own anywhere", () => {
  assert.doesNotMatch(apiSrc, /practiceId/, "the target link is the only permitted key");
});

/* ------------------------------------------------------------ error mapping */

test("every documented server code maps to a sentence, never a raw code", async () => {
  const { shareErrorMessage } = await import("../lib/shareErrorMessage.js");
  const de = (await import("../../../i18n/translations/de/documentSharing.js")).default;

  const codes = [
    "document_not_found", "link_not_found", "link_not_active",
    "document_already_available_to_practice", "share_already_active",
    "grant_not_found", "unsupported_field", "forbidden",
  ];
  for (const code of codes) {
    const msg = shareErrorMessage({ error: code }, de.errors);
    assert.ok(msg && msg.length > 5, `${code} has no message`);
    assert.ok(!msg.includes("_"), `${code} leaks the raw code: ${msg}`);
  }
});

test("an unknown or missing code falls back to a generic message", async () => {
  const { shareErrorMessage } = await import("../lib/shareErrorMessage.js");
  const de = (await import("../../../i18n/translations/de/documentSharing.js")).default;
  for (const data of [{ error: "something_new" }, {}, null, undefined, { error: 42 }]) {
    const msg = shareErrorMessage(data, de.errors);
    assert.equal(msg, de.errors.server_error);
  }
});

test("no identifier from the response is interpolated into a message", () => {
  const fn = read("lib/shareErrorMessage.js");
  assert.doesNotMatch(fn, /data\.(id|grantId|documentId|linkId)/,
    "an error message must not carry ids");
});

/* ------------------------------------------------------------ the decisions */

test("no practice is preselected in the share dialog", () => {
  assert.match(dialogSrc, /useState\(""\)/, "the target starts empty");
  assert.match(dialogSrc, /<option value="">/, "an explicit empty option is offered");
  assert.doesNotMatch(dialogSrc, /candidates\[0\]/, "the first practice must not be chosen for the patient");
  assert.doesNotMatch(dialogSrc, /lastUsed|recent|specialty/i, "no heuristic preselection");
  assert.match(dialogSrc, /disabled=\{!targetLinkId \|\| busy\}/, "confirm stays disabled until a choice is made");
});

test("the read-only consequence is stated before the patient confirms", () => {
  assert.match(dialogSrc, /t\.share\.readOnlyNotice/);
  const notice = dialogSrc.indexOf("readOnlyNotice");
  const confirm = dialogSrc.indexOf("t.share.confirm");
  assert.ok(notice < confirm, "the notice must appear above the confirm button");
});

test("revoking is confirmed and never optimistic", () => {
  // The row is only rewritten from the server's answer.
  assert.match(sectionSrc, /setGrants\(\(prev\) => prev\.map\(\(g\) => \(g\.id === data\.grant\.id \? data\.grant : g\)\)\)/);
  const setIdx = sectionSrc.indexOf("setGrants((prev)");
  const guardIdx = sectionSrc.indexOf("if (!res.ok || !data.ok)");
  assert.ok(guardIdx < setIdx, "the failure branch must return before any state change");
  assert.match(sectionSrc, /pendingRevoke/, "a confirmation step exists");
  assert.match(sectionSrc, /t\.revoke\.notice/);
  assert.match(sectionSrc, /t\.revoke\.externalCopies/,
    "the limits of a revocation must be stated honestly");
});

test("the revoke action is only offered while the grant is active", () => {
  assert.match(sectionSrc, /const isActive = grant\.status === "active"/);
  assert.match(sectionSrc, /\{isActive && \(\s*<button/);
});

/* ------------------------------------------------------------- minimisation */

test("no internal identifier is rendered or written to an attribute", () => {
  for (const [name, src] of [["dialog", dialogSrc], ["section", sectionSrc]]) {
    assert.doesNotMatch(src, /data-[a-z-]*id=/, `${name} writes an id into a data attribute`);
    assert.doesNotMatch(src, /\{grant\.id\}</, `${name} renders a grant id`);
    assert.doesNotMatch(src, /patientUserId|storageKey|tokenHash|createdByUserId/,
      `${name} references data the patient area must not show`);
  }
  // Using the id as a React key is fine — it never reaches the DOM as content.
  assert.match(sectionSrc, /key=\{grant\.id\}/);
});

/* ------------------------------------------------------------ accessibility */

test("actions are named with the document and the practice", () => {
  assert.match(sectionSrc, /aria-label=\{t\.revoke\.ariaLabel[\s\S]*?\.replace\("\{document\}"[\s\S]*?\.replace\("\{practice\}"/);
  assert.match(dialogSrc, /t\.share\.ariaLabel[\s\S]*?\.replace\("\{document\}"[\s\S]*?\.replace\("\{practice\}"/);
});

test("status is announced, not only coloured", () => {
  assert.match(sectionSrc, /role="status"\s+aria-live="polite"/);
  assert.match(sectionSrc, /\{t\.status\[grant\.status\] \|\| grant\.status\}/,
    "the pill carries the status as text");
});

test("the modal traps focus and gives it back", () => {
  assert.match(modalSrc, /role="dialog"/);
  assert.match(modalSrc, /aria-modal="true"/);
  assert.match(modalSrc, /aria-labelledby=\{titleId\}/);
  assert.match(modalSrc, /event\.key !== "Tab"/, "Tab is trapped");
  assert.match(modalSrc, /shiftKey/, "Shift+Tab wraps too");
  assert.match(modalSrc, /returnFocusRef\.current/, "focus is restored on close");
  assert.match(modalSrc, /event\.key === "Escape"/);
});
