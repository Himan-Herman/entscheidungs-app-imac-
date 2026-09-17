/**
 * Phase 5A — practice-internal notes and follow-ups, in a real browser.
 *
 * The server suite proves the queries are scoped. This spec proves the product
 * behaves: a practice writes a note through the interface, it survives a full
 * reload, and the three parties who must not see it — the patient, the same
 * practice's OTHER relationship with that patient, and a different practice —
 * do not.
 *
 * Roles come from the existing fixture (server/scripts/createE2ePracticeContextFixture.js),
 * which already creates the patient, practice A's owner with links A1 and A2,
 * and practice B's owner, all sharing one password. Sessions are seeded the way
 * every spec in this directory does it: log in through the API once, then put
 * the token in localStorage. Driving the login form would test the login form.
 */
import { test, expect } from "@playwright/test";

const API = "http://localhost:3000";

/** Defined by the fixture script; see its header for the full setup. */
const PASSWORD = "E2ePracticeContext!23";
const PATIENT_EMAIL = "e2e-practice-context-patient@test.invalid";
const OWNER_A_EMAIL = "e2e-practice-context-owner-a@test.invalid";
const OWNER_B_EMAIL = "e2e-practice-context-owner-b@test.invalid";

const LINK_A = process.env.E2E_LINK_A;
const LINK_A2 = process.env.E2E_LINK_A2;
const LINK_B = process.env.E2E_LINK_B;

/** Unique per run, so repeated runs never assert on a previous run's rows. */
const STAMP = String(Date.now()).slice(-8);
const NOTE = `IW_NOTE_${STAMP}`;
const LONG_NOTE = `IW_LONG_${STAMP} ${"Sehrlangerzusammenhaengendertext".repeat(12)}`;
const REMINDER = `IW_REMINDER_${STAMP}`;

/**
 * The record page reads its tenant from the query string, exactly as every
 * other practice section does, so the id has to travel with the URL.
 */
const recordUrl = (linkId, tab, practiceId) =>
  `/practice/patients/${linkId}?tab=${tab}&practiceId=${practiceId}`;

/** The owner's own practice, from the endpoint the practice app already uses. */
async function practiceIdFor(request, session) {
  const res = await request.get(`${API}/api/practices`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const body = await res.json();
  const own = (body.practices || []).find((p) => p.userId === session.userId) ?? body.practices?.[0];
  if (!own) throw new Error("no practice for this owner");
  return own.id;
}

async function login(request, email) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`Login failed for ${email}: ${res.status()}`);
  return res.json();
}

/** Seeds a session before the first script of the page runs. */
/** Writes one internal note through the interface and returns its text. */
async function writeNote(page, linkId, practiceId, text) {
  await page.goto(recordUrl(linkId, "internalWork", practiceId));
  await page.locator("#internal-note-body").fill(text);
  await page.getByRole("button", { name: "Notiz speichern" }).click();
  await expect(page.getByTestId("internal-note").first()).toContainText(text);
  return text;
}

async function useSession(page, session, mode) {
  await page.addInitScript(
    ({ t, uid, m }) => {
      localStorage.setItem("medscout_token", t);
      localStorage.setItem("medscout_user_id", uid);
      localStorage.setItem("medscoutx_user_mode", m);
      // Pin the locale: a fresh browser would otherwise pick English and the
      // assertions would be about locale detection rather than about 5A.
      localStorage.setItem("medscout_language", "de");
    },
    { t: session.token, uid: session.userId, m: mode },
  );
}

test.describe("practice-internal notes and follow-ups", () => {
  let ownerA;
  let ownerB;
  let patient;
  let practiceA;
  let practiceB;

  test.beforeAll(async ({ request }) => {
    if (!LINK_A || !LINK_A2 || !LINK_B) return;
    [ownerA, ownerB, patient] = await Promise.all([
      login(request, OWNER_A_EMAIL),
      login(request, OWNER_B_EMAIL),
      login(request, PATIENT_EMAIL),
    ]);
    [practiceA, practiceB] = await Promise.all([
      practiceIdFor(request, ownerA),
      practiceIdFor(request, ownerB),
    ]);
  });

  test.beforeEach(async ({}, testInfo) => {
    if (!LINK_A || !LINK_A2 || !LINK_B) {
      testInfo.skip(
        true,
        "Set E2E_LINK_A / E2E_LINK_A2 / E2E_LINK_B (see server/scripts/createE2ePracticeContextFixture.js)",
      );
    }
  });

  /* ─────────────────────────────── 1-10: the practice's own working surface */

  test("a practice writes a note and a follow-up, and both survive a reload", async ({ page }) => {
    await useSession(page, ownerA, "practice");

    // 1 + 2 — the record opens and the patient conversation is still there.
    await page.goto(recordUrl(LINK_A, "messages", practiceA));
    await expect(page.getByRole("tab", { name: "Interne Notizen" }).or(
      page.getByRole("button", { name: "Interne Notizen" })
    ).first()).toBeVisible();

    // 3 — the internal area is its OWN tab, not part of the conversation.
    await page.goto(recordUrl(LINK_A, "internalWork", practiceA));
    const section = page.locator(".internal-work");
    await expect(section).toBeVisible();

    // 5 — said in words, before anything is written.
    await expect(section).toContainText("Nur für das Praxisteam");
    await expect(section.locator(".internal-work__scope")).toContainText(
      "Sie werden der Patientin oder dem Patienten nicht angezeigt",
    );

    // 4 — write one.
    await page.locator("#internal-note-body").fill(NOTE);
    await page.getByRole("button", { name: "Notiz speichern" }).click();
    await expect(page.getByTestId("internal-note").first()).toContainText(NOTE);
    // The author is a name, never a user id.
    await expect(page.getByTestId("internal-note").first()).toContainText("Owner Hausarzt");

    // 7 + 8 — a follow-up with a visible due date.
    await page.locator("#reminder-title").fill(REMINDER);
    await page.locator("#reminder-due").fill("2026-09-30T09:00");
    await page.getByRole("button", { name: "Wiedervorlage anlegen" }).click();
    const reminder = page.getByTestId("internal-reminder").filter({ hasText: REMINDER });
    await expect(reminder).toBeVisible();
    await expect(reminder).toContainText("Fällig:");
    await expect(reminder).toContainText("Offen");

    // 6 — a FULL document load, not a client-side re-render.
    await page.reload();
    await expect(page.getByTestId("internal-note").first()).toContainText(NOTE);
    await expect(page.getByTestId("internal-reminder").filter({ hasText: REMINDER })).toBeVisible();

    // 9 — complete it. The list defaults to "open", so a completed follow-up
    // correctly leaves that view; the status is read in a filter that shows it.
    await reminder.getByRole("button", { name: "Als erledigt markieren" }).click();
    await expect(reminder).toBeHidden();

    // 10 — and it is persisted, with the status stated as a word.
    await page.reload();
    await page.getByRole("button", { name: "Erledigt", exact: true }).click();
    const done = page.getByTestId("internal-reminder").filter({ hasText: REMINDER });
    await expect(done).toContainText("Erledigt");
    await expect(done.getByRole("button", { name: "Als erledigt markieren" })).toHaveCount(0);
  });

  /* ───────────────────────────────────────── 12: same practice, other link */

  test("the practice's OTHER relationship with the same patient sees neither", async ({ page }) => {
    await useSession(page, ownerA, "practice");
    await page.goto(recordUrl(LINK_A2, "internalWork", practiceA));

    await expect(page.locator(".internal-work")).toBeVisible();
    await expect(page.locator(".internal-work")).not.toContainText(NOTE);
    await expect(page.locator(".internal-work")).not.toContainText(REMINDER);
  });

  /* ────────────────────────────────────────────────── 13: another practice */

  test("a different practice sees neither, on its own link or on ours", async ({ page }) => {
    await useSession(page, ownerB, "practice");

    await page.goto(recordUrl(LINK_B, "internalWork", practiceB));
    await expect(page.locator(".internal-work")).not.toContainText(NOTE);
    await expect(page.locator(".internal-work")).not.toContainText(REMINDER);

    // And asking for OUR link by id, with its own tenant, yields nothing.
    await page.goto(recordUrl(LINK_A, "internalWork", practiceB));
    await expect(page.locator("body")).not.toContainText(NOTE);
    await expect(page.locator("body")).not.toContainText(REMINDER);
  });

  /* ───────────────────────────────────────────────── 11: the patient's view */

  test("the patient sees nothing of it, and nothing about their inbox changed", async ({ page, request }) => {
    const authHeader = { Authorization: `Bearer ${patient.token}` };

    // The two payloads the patient app actually renders.
    const threads = await request.get(`${API}/api/patient/messages`, { headers: authHeader });
    const threadsBody = await threads.text();
    expect(threadsBody).not.toContain(NOTE);
    expect(threadsBody).not.toContain(REMINDER);

    const inbox = await request.get(`${API}/api/patient/inbox`, { headers: authHeader });
    const inboxBody = await inbox.json();
    const inboxText = JSON.stringify(inboxBody);
    expect(inboxText).not.toContain(NOTE);
    expect(inboxText).not.toContain(REMINDER);
    // No item was created FOR the internal work: nothing references this run.
    expect(inboxText).not.toContain(STAMP);

    // The account export the patient can download.
    const exported = await request.get(`${API}/api/account/export`, { headers: authHeader });
    expect(await exported.text()).not.toContain(NOTE);

    // And the rendered patient surface.
    await useSession(page, patient, "patient");
    await page.goto("/patient/messages");
    await expect(page.locator("body")).not.toContainText(NOTE);
    await page.goto("/patient/inbox");
    await expect(page.locator("body")).not.toContainText(NOTE);
    await expect(page.locator("body")).not.toContainText(REMINDER);
  });

  test("the practice endpoints refuse the patient outright", async ({ request }) => {
    const headers = { Authorization: `Bearer ${patient.token}` };
    for (const path of [
      `/api/practice/patients/${LINK_A}/internal-notes`,
      `/api/practice/patients/${LINK_A}/reminders`,
    ]) {
      const res = await request.get(`${API}${path}`, { headers });
      expect(res.status()).toBe(404);
      expect(await res.text()).toContain("link_not_found");
    }
  });

  /* ─────────────────────────────────────── 14: back / forward / refresh */

  test("back, forward and refresh keep the internal tab and its content", async ({ page }) => {
    await useSession(page, ownerA, "practice");
    const own = `${NOTE}_NAV`;
    await writeNote(page, LINK_A, practiceA, own);
    await page.goto(recordUrl(LINK_A, "messages", practiceA));
    await page.goto(recordUrl(LINK_A, "internalWork", practiceA));
    await expect(page.getByTestId("internal-note").first()).toContainText(own);

    await page.goBack();
    await expect(page).toHaveURL(/tab=messages/);
    await page.goForward();
    await expect(page).toHaveURL(/tab=internalWork/);
    await expect(page.getByTestId("internal-note").first()).toContainText(own);

    await page.reload();
    await expect(page.getByTestId("internal-note").first()).toContainText(own);
  });

  /* ──────────────────────────────────────────────────── 15: mobile viewport */

  test("the internal area works on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await useSession(page, ownerA, "practice");
    await page.goto(recordUrl(LINK_A, "internalWork", practiceA));

    const section = page.locator(".internal-work");
    await expect(section).toBeVisible();
    await expect(section).toContainText("Nur für das Praxisteam");

    // A long note must wrap rather than push the page sideways.
    await page.locator("#internal-note-body").fill(LONG_NOTE);
    await page.getByRole("button", { name: "Notiz speichern" }).click();
    await expect(page.getByTestId("internal-note").first()).toContainText("IW_LONG_");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "the page must not scroll horizontally").toBeLessThanOrEqual(1);
  });
});
