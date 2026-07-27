/**
 * Clinical role wording + team-row behaviour on the practice team page.
 *
 * "Bestätigt" / "Confirmed" read like a state-issued or professional
 * verification. The approval is only an internal decision by another
 * authorised person inside the same practice, so the wording must say exactly
 * that and nothing more.
 *
 * There is no React test renderer in this project, so the row behaviour is
 * pinned by reading the component source: which branch renders which control,
 * and that the gating comes from the server-provided `capabilities` rather
 * than from a decision made in the client.
 *
 * Run: node --test client/src/features/practiceTeam/__tests__/clinicalRoleTerminology.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import de from "../../../i18n/translations/de/practiceTeam.js";
import en from "../../../i18n/translations/en/practiceTeam.js";

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, "..", "pages", "PracticeTeamPage.jsx"), "utf8");

const BUNDLES = { de, en };

/* ------------------------------------------------------------ terminology */

test("the approved state no longer reads as an external verification", () => {
  assert.equal(de.clinicalStatusActive, "Praxisintern freigegeben");
  assert.equal(en.clinicalStatusActive, "Approved by practice");

  for (const [lang, b] of Object.entries(BUNDLES)) {
    assert.notEqual(b.clinicalStatusActive, "Bestätigt", `${lang}: old wording`);
    assert.notEqual(b.clinicalStatusActive, "Confirmed", `${lang}: old wording`);
  }
});

test("no bundle claims a professional or state-issued qualification", () => {
  const forbidden = [
    "verified doctor", "verifizierter arzt", "verifizierte ärztin",
    "licensed", "staatlich bestätigt", "approbiert", "approbation",
  ];
  for (const [lang, bundle] of Object.entries(BUNDLES)) {
    const haystack = JSON.stringify(bundle).toLowerCase();
    for (const term of forbidden) {
      assert.ok(!haystack.includes(term), `${lang} must not contain "${term}"`);
    }
  }
});

test("every clinical state has a distinct, non-empty label", () => {
  for (const [lang, b] of Object.entries(BUNDLES)) {
    const states = [
      b.clinicalStatusPending,
      b.clinicalStatusActive,
      b.clinicalStatusRejected,
      b.clinicalStatusRevoked,
      b.clinicalRoleNone,
    ];
    for (const s of states) {
      assert.ok(typeof s === "string" && s.trim().length > 0, `${lang}: empty state label`);
    }
    assert.equal(new Set(states).size, states.length, `${lang}: states must be distinguishable`);
  }
});

test("the hint separates the two roles and scopes the approval to the practice", () => {
  const hintDe = de.clinicalHint.toLowerCase();
  assert.ok(hintDe.includes("organisatorische") && hintDe.includes("klinische"), "roles separated");
  assert.ok(hintDe.includes("praxis"), "scoped to the practice");
  assert.ok(hintDe.includes("kein externer qualifikationsnachweis"), "not external proof");

  const hintEn = en.clinicalHint.toLowerCase();
  assert.ok(hintEn.includes("organisational") && hintEn.includes("clinical"), "roles separated");
  assert.ok(hintEn.includes("practice"), "scoped to the practice");
  assert.ok(hintEn.includes("not external proof"), "not external proof");

  // Short enough to read, not a legal disclaimer.
  for (const [lang, b] of Object.entries(BUNDLES)) {
    assert.ok(b.clinicalHint.length < 260, `${lang}: hint should stay brief`);
  }
});

test("the awaiting-approval note states that self-approval is impossible", () => {
  assert.match(de.clinicalAwaitingApproval, /selbst freigeben ist nicht möglich/i);
  assert.match(en.clinicalAwaitingApproval, /cannot approve your own role/i);
});

/* ----------------------------------------------------- accessible names */

test("action labels are person-specific and carry a {name} placeholder", () => {
  const ariaKeys = [
    "clinicalAriaRequest",
    "clinicalAriaApprove",
    "clinicalAriaReject",
    "clinicalAriaRevoke",
  ];
  for (const [lang, bundle] of Object.entries(BUNDLES)) {
    for (const key of ariaKeys) {
      assert.ok(bundle[key], `${lang}: ${key} missing`);
      assert.ok(bundle[key].includes("{name}"), `${lang}: ${key} must interpolate the person`);
    }
    // The four labels must be distinguishable from one another.
    const rendered = ariaKeys.map((k) => bundle[k].replace("{name}", "Maria Mustermann"));
    assert.equal(new Set(rendered).size, 4, `${lang}: duplicate accessible names`);
    for (const label of rendered) {
      assert.ok(label.includes("Maria Mustermann"), `${lang}: name missing from "${label}"`);
    }
  }
});

test("the page wires those labels instead of bare action words", () => {
  for (const key of [
    "clinicalAriaRequest",
    "clinicalAriaApprove",
    "clinicalAriaReject",
    "clinicalAriaRevoke",
  ]) {
    assert.ok(
      pageSource.includes(`t.${key}.replace("{name}", displayName)`),
      `${key} must be interpolated with the member name`,
    );
  }
  // The old, name-less pattern must be gone.
  assert.ok(
    !/aria-label=\{`\$\{t\.clinicalAction/.test(pageSource),
    "no bare action word as accessible name",
  );
});

/* --------------------------------------------------------- row behaviour */

test("organisational and clinical roles are rendered in separate columns", () => {
  assert.ok(pageSource.includes("{t.colOrganizationalRole}"), "organisational column header");
  assert.ok(pageSource.includes("{t.colClinicalRole}"), "clinical column header");
});

test("the status is rendered as text, not only as a CSS class", () => {
  assert.ok(
    pageSource.includes("{clinicalStatusLabel(m.clinicalRoleStatus)}"),
    "the state must be readable as text",
  );
  // The class exists too, but must not be the only carrier of meaning.
  assert.ok(pageSource.includes("practice-team__status-pill--clinical-"), "class is additive");
});

test("a missing clinical role shows a neutral label", () => {
  assert.ok(pageSource.includes("{t.clinicalRoleNone}"), "neutral text for no clinical role");
});

test("every action button is gated by a server-provided capability", () => {
  assert.ok(pageSource.includes("m.capabilities?.canRequest"), "request gated");
  assert.ok(pageSource.includes("m.capabilities?.canApprove"), "approve gated");
  assert.ok(pageSource.includes("m.capabilities?.canRevoke"), "revoke gated");

  // Approve and reject are rendered inside the SAME canApprove branch, so a
  // reject control can never appear without the approval capability.
  const approveBranch = pageSource.slice(
    pageSource.indexOf('m.clinicalRoleStatus === "pending" && m.capabilities?.canApprove'),
  );
  const branchEnd = approveBranch.indexOf(") : null}");
  const branch = approveBranch.slice(0, branchEnd);
  assert.ok(branch.includes("clinicalAriaApprove"), "approve inside the gated branch");
  assert.ok(branch.includes("clinicalAriaReject"), "reject inside the gated branch");
});

test("the client never decides who may approve", () => {
  // No local comparison of the viewer against the row owner — the server
  // computes `capabilities` and is the only place that decides.
  assert.ok(
    !/canApprove\s*[=:]\s*[^,\n]*(userId|isSelf|yourRole)/.test(pageSource),
    "capabilities must not be derived in the client",
  );
  assert.ok(
    !/m\.userId\s*===\s*(currentUserId|myUserId|viewerId)/.test(pageSource),
    "no client-side self-detection for approval",
  );
});

test("a pending request the viewer may not approve explains why", () => {
  assert.ok(
    pageSource.includes('m.clinicalRoleStatus === "pending" && !m.capabilities?.canApprove'),
    "explicit branch for the non-approver view",
  );
  assert.ok(pageSource.includes("{t.clinicalAwaitingApproval}"), "explanation rendered");
});

test("status changes are announced through the existing status region", () => {
  assert.ok(
    /className="practice-team__status"\s+role="status"/.test(pageSource),
    "an aria-live status region exists",
  );
  assert.ok(
    pageSource.includes("setStatusMsg(t[`clinicalSuccess_${action}`]"),
    "clinical actions report into that region",
  );
});
