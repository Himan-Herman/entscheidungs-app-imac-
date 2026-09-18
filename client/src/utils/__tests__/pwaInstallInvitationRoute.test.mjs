/**
 * The install hint waits while somebody accepts a practice invitation.
 *
 * On a phone the hint is a dialog over the page's only button that also takes
 * the keyboard focus — the one interruption an invitation cannot afford. These
 * tests pin exactly where it waits, and that it waits NOWHERE else: the sign-in
 * and registration pages outside an invitation must behave as they always did.
 *
 * Run: node --test client/src/utils/__tests__/pwaInstallInvitationRoute.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { isInvitationTaskRoute } from "../pwaInstall.js";

test("the invitation page itself", () => {
  assert.equal(isInvitationTaskRoute("/patient-invitation"), true);
  assert.equal(isInvitationTaskRoute("/patient-invitation", "?x=1"), true);
});

test("sign-in, registration and inbox check — only as part of the invitation", () => {
  const next = "?next=%2Fpatient-invitation";
  for (const path of ["/login", "/register", "/check-email"]) {
    assert.equal(isInvitationTaskRoute(path, next), true, `${path} inside the invitation`);
    assert.equal(isInvitationTaskRoute(path, ""), false, `${path} on its own must be unchanged`);
    assert.equal(isInvitationTaskRoute(path, "?next=%2Fpatient"), false, `${path} with another next`);
  }
  // The verified e-mail lands on /login with both parameters.
  assert.equal(isInvitationTaskRoute("/login", "?verify=ok&next=%2Fpatient-invitation"), true);
});

test("everywhere else the hint behaves as before", () => {
  for (const path of ["/", "/patient", "/patient/practice", "/practice", "/intro", "/patient-invitations"]) {
    assert.equal(isInvitationTaskRoute(path, "?next=%2Fpatient-invitation"), false, path);
  }
});
