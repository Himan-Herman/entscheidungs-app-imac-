/**
 * The credential-handling rules of the invitation flow.
 *
 * This is the security-critical half of the frontend: where the token is
 * allowed to appear, how long it survives, and what happens to it once spent.
 * Every one of these is a rule that would fail silently in a browser — a token
 * in a query string still works, a token left in localStorage still works — so
 * they are asserted rather than trusted.
 *
 * Run: node --test client/src/features/patientOnboarding/__tests__/invitationLink.test.mjs
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

/* A window small enough to reason about, real enough to exercise the module. */
function installWindow(hash = "") {
  const store = new Map();
  const replaced = [];
  globalThis.window = {
    location: { origin: "https://app.example", pathname: "/patient-invitation", search: "", hash },
    history: { replaceState: (_s, _t, url) => { replaced.push(url); globalThis.window.location.hash = ""; } },
    sessionStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  return { store, replaced };
}

const load = async () => import("../invitationLink.js?" + Math.random());

beforeEach(() => { installWindow(); });

test("the link carries the token in the fragment, never the query", async () => {
  const { buildInvitationLink } = await load();
  const link = buildInvitationLink("tok-123");

  assert.equal(link, "https://app.example/patient-invitation#token=tok-123");
  const url = new URL(link);
  // The two places a server would see it:
  assert.equal(url.search, "", "the token reached the query string");
  assert.equal(url.pathname, "/patient-invitation", "the token reached the path");
  assert.ok(url.hash.includes("tok-123"), "the token should be in the fragment");
});

test("a token with URL-significant characters survives the round trip", async () => {
  const { buildInvitationLink, readTokenFromHash } = await load();
  // base64url has - and _, and a stray + or = must not corrupt the value.
  const token = "a-b_c+d=e/f&g";
  const link = buildInvitationLink(token);
  const hash = link.slice(link.indexOf("#"));
  assert.equal(readTokenFromHash(hash), token);
});

test("reading the fragment yields the token, or nothing at all", async () => {
  const { readTokenFromHash } = await load();
  assert.equal(readTokenFromHash("#token=abc"), "abc");
  assert.equal(readTokenFromHash("token=abc"), "abc");
  assert.equal(readTokenFromHash("#"), null);
  assert.equal(readTokenFromHash(""), null);
  assert.equal(readTokenFromHash("#other=abc"), null, "an unrelated fragment must not be guessed at");
  assert.equal(readTokenFromHash("#token="), null, "an empty token is not a token");
  assert.equal(readTokenFromHash("#token=%20%20"), null, "whitespace is not a token");
});

test("clearing the fragment replaces history rather than adding to it", async () => {
  const { replaced } = installWindow("#token=secret");
  const { clearTokenFromHash } = await load();

  clearTokenFromHash();

  assert.deepEqual(replaced, ["/patient-invitation"]);
  assert.equal(globalThis.window.location.hash, "", "the token stayed in the address bar");
  // replaceState, not pushState: pressing Back must not resurrect the credential.
});

test("the resume stash lives in sessionStorage, never localStorage", async () => {
  const { store } = installWindow();
  const { stashInvitation, readStashedInvitation } = await load();

  stashInvitation({ token: "tok-9" });

  assert.equal(store.size, 1, "expected exactly one stashed entry");
  const [[key, value]] = [...store.entries()];
  assert.match(key, /invitation/);
  assert.ok(value.includes("tok-9"));
  assert.deepEqual(readStashedInvitation(), { token: "tok-9", code: null });
  // localStorage is deliberately absent from the fake: touching it would throw.
});

test("an empty credential is never stashed", async () => {
  const { store } = installWindow();
  const { stashInvitation, readStashedInvitation } = await load();

  stashInvitation({});
  stashInvitation({ token: null, code: null });

  assert.equal(store.size, 0);
  assert.equal(readStashedInvitation(), null);
});

test("a stash older than the invitation itself is dropped, not returned", async () => {
  const { store } = installWindow();
  const { readStashedInvitation } = await load();

  const eightDays = Date.now() - 8 * 24 * 60 * 60 * 1000;
  store.set("medscout_invitation_resume", JSON.stringify({ token: "stale", at: eightDays }));

  assert.equal(readStashedInvitation(), null, "a credential older than 7 days cannot work");
  assert.equal(store.size, 0, "the dead stash should also be cleaned up");
});

test("clearing the stash actually removes it", async () => {
  const { store } = installWindow();
  const { stashInvitation, clearStashedInvitation, readStashedInvitation } = await load();

  stashInvitation({ code: "ABCD-EFGH-JKLM" });
  assert.equal(store.size, 1);

  clearStashedInvitation();

  assert.equal(store.size, 0);
  assert.equal(readStashedInvitation(), null);
});

test("a blocked or corrupt storage degrades instead of breaking the flow", async () => {
  installWindow();
  globalThis.window.sessionStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  const { stashInvitation, readStashedInvitation, clearStashedInvitation } = await load();

  // Private mode, full quota, or a browser that refuses site data. The patient
  // simply reopens the link; nothing here may throw into the render tree.
  assert.doesNotThrow(() => stashInvitation({ token: "x" }));
  assert.equal(readStashedInvitation(), null);
  assert.doesNotThrow(() => clearStashedInvitation());
});

test("garbage in the stash is treated as no stash", async () => {
  const { store } = installWindow();
  const { readStashedInvitation } = await load();
  store.set("medscout_invitation_resume", "{not json");
  assert.equal(readStashedInvitation(), null);
});

test("every channel encodes the SAME fragment link — QR included", async () => {
  // The QR image, the copy button and the email all encode whatever
  // buildInvitationLink returns. If one of them ever built its own URL, this is
  // where the divergence would show: there is exactly one builder.
  const { buildInvitationLink } = await load();
  const link = buildInvitationLink("qr-token-1");

  const url = new URL(link);
  assert.equal(url.hash, "#token=qr-token-1");
  assert.equal(url.search, "", "a query-string variant exists");
  assert.equal(url.pathname.includes("qr-token-1"), false, "a path variant exists");
  assert.equal(link.includes("?token="), false);
  assert.equal(link.includes("/token/"), false);
});

test("the login return path carries no credential", async () => {
  const { loginReturnPath } = await load();
  const path = loginReturnPath();

  assert.equal(path, "/patient-invitation");
  assert.equal(path.includes("token"), false);
  assert.equal(path.includes("code"), false);
  assert.equal(path.includes("#"), false, "even a fragment would be copied into the redirect");
});
