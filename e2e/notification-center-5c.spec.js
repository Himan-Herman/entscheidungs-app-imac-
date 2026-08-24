// @ts-check
/**
 * Phase 5C — the central header entry, in a real browser.
 *
 * The server tests hold what the summary CONTAINS. This spec holds what a user
 * can actually do with it, and — more importantly — what they cannot see:
 *
 *   - the badge counts unread/new inbox items and nothing else,
 *   - open follow-ups appear as their own number, never inside that badge,
 *   - a patient never sees any hint that follow-ups exist,
 *   - switching mode or practice never leaves the previous count on screen,
 *   - the panel is operable by keyboard and the target is a real 44px.
 *
 * Fixture: server/scripts/createE2ePracticeContextFixture.js
 * Skips gracefully when the fixture env vars are absent.
 */
import { test, expect } from "@playwright/test";

const PATIENT_EMAIL = process.env.E2E_PATIENT_EMAIL;
const PATIENT_PASSWORD = process.env.E2E_PATIENT_PASSWORD;
const OWNER_EMAIL = "e2e-practice-context-owner-a@test.invalid";
const OWNER_PASSWORD = PATIENT_PASSWORD;
const API = "http://localhost:3000";

const toggle = (page) => page.locator(".ms-notif__toggle");
const panel = (page) => page.locator("#ms-notif-panel");

async function login(request, email, password) {
  const res = await request.post(`${API}/api/auth/login`, { data: { email, password } });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

test.describe("notification centre", () => {
  /** @type {{token: string, userId: string} | null} */
  let patientSession = null;
  /** @type {{token: string, userId: string} | null} */
  let ownerSession = null;

  test.beforeAll(async ({ request }) => {
    if (!PATIENT_EMAIL || !PATIENT_PASSWORD) return;
    patientSession = await login(request, PATIENT_EMAIL, PATIENT_PASSWORD);
    ownerSession = await login(request, OWNER_EMAIL, OWNER_PASSWORD);
  });

  test.beforeEach(async ({ page }, testInfo) => {
    if (!PATIENT_EMAIL || !PATIENT_PASSWORD) {
      testInfo.skip(true, "Set E2E_PATIENT_EMAIL/PASSWORD (see createE2ePracticeContextFixture.js)");
    }
  });

  /** Seeds the session the header will read, in the given mode. */
  async function enter(page, mode) {
    const s = mode === "practice" ? ownerSession : patientSession;
    await page.addInitScript(
      ({ t, uid, m }) => {
        localStorage.setItem("medscout_token", t);
        localStorage.setItem("medscout_user_id", uid);
        localStorage.setItem("medscoutx_user_mode", m);
        localStorage.setItem("medscout_language", "de");
      },
      { t: s.token, uid: s.userId, m: mode },
    );
  }

  /* ─────────────────────────────────────────────────── patient ───────────── */

  test("the patient badge matches the patient endpoint, exactly", async ({ page, request }) => {
    await enter(page, "patient");
    const api = await request.get(`${API}/api/patient/inbox/notifications`, {
      headers: { Authorization: `Bearer ${patientSession.token}` },
    });
    const body = await api.json();

    await page.goto("/patient");
    await expect(toggle(page)).toBeVisible();

    const badge = page.locator(".ms-notif__badge");
    if (body.unreadInboxCount > 0) {
      await expect(badge).toHaveText(
        body.unreadInboxCount > 99 ? "99+" : String(body.unreadInboxCount),
      );
    } else {
      await expect(badge).toHaveCount(0);
    }
  });

  test("a patient is shown no follow-up hint anywhere", async ({ page, request }) => {
    await enter(page, "patient");
    const api = await request.get(`${API}/api/patient/inbox/notifications`, {
      headers: { Authorization: `Bearer ${patientSession.token}` },
    });
    const raw = JSON.stringify(await api.json());
    // Not even the words, and not an empty container that hints at the shape.
    expect(raw).not.toContain("openReminderCount");
    expect(raw).not.toContain("remindersPath");

    await page.goto("/patient");
    await toggle(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(page.locator(".ms-notif__reminders")).toHaveCount(0);
    await expect(panel(page)).not.toContainText("Wiedervorlage");
  });

  test("the panel links to the patient inbox, not to a third page", async ({ page }) => {
    await enter(page, "patient");
    await page.goto("/patient");
    await toggle(page).click();
    await page.locator(".ms-notif__all").click();
    await expect(page).toHaveURL(/\/patient\/inbox$/);
  });

  /* ─────────────────────────────────────────────────── practice ──────────── */

  test("the practice badge counts new items and excludes follow-ups", async ({ page, request }) => {
    await enter(page, "practice");
    const practices = await (
      await request.get(`${API}/api/practices`, {
        headers: { Authorization: `Bearer ${ownerSession.token}` },
      })
    ).json();
    const practiceId = practices.practices[0].id;

    const body = await (
      await request.get(`${API}/api/practice/inbox/notifications?practiceId=${practiceId}`, {
        headers: { Authorization: `Bearer ${ownerSession.token}` },
      })
    ).json();

    await page.goto("/practice");
    await expect(toggle(page)).toBeVisible();

    const badge = page.locator(".ms-notif__badge");
    if (body.newInboxCount > 0) {
      await expect(badge).toHaveText(
        body.newInboxCount > 99 ? "99+" : String(body.newInboxCount),
      );
    } else {
      await expect(badge).toHaveCount(0);
    }

    // The badge is the inbox number alone — the follow-up number is separate.
    const count = await (
      await request.get(`${API}/api/practice/inbox/count?practiceId=${practiceId}`, {
        headers: { Authorization: `Bearer ${ownerSession.token}` },
      })
    ).json();
    expect(body.newInboxCount).toBe(count.newCount);
  });

  test("follow-ups appear as their own metric and link to the 5B overview", async ({
    page,
    request,
  }) => {
    await enter(page, "practice");
    const practices = await (
      await request.get(`${API}/api/practices`, {
        headers: { Authorization: `Bearer ${ownerSession.token}` },
      })
    ).json();
    const practiceId = practices.practices[0].id;

    await page.goto(`/practice?practiceId=${practiceId}`);
    await toggle(page).click();
    const section = page.locator(".ms-notif__reminders");
    await expect(section).toBeVisible();
    await expect(section).toContainText("Wiedervorlagen");

    const link = section.locator(".ms-notif__linkbtn");
    if (await link.count()) {
      await link.click();
      // The existing Phase 5B work surface, with its own filter — not a second
      // place to work through follow-ups.
      await expect(page).toHaveURL(/\/practice\/patients\?.*filter=reminders/);
    }
  });

  test("a foreign practice is refused, not filtered", async ({ request }) => {
    const res = await request.get(
      `${API}/api/practice/inbox/notifications?practiceId=does-not-belong-to-me`,
      { headers: { Authorization: `Bearer ${ownerSession.token}` } },
    );
    expect(res.status()).toBe(403);
  });

  test("without a session the endpoints answer, but never with data", async ({ request }) => {
    for (const url of [
      `${API}/api/patient/inbox/notifications`,
      `${API}/api/practice/inbox/notifications?practiceId=x`,
    ]) {
      const res = await request.get(url);
      expect(res.ok()).toBeFalsy();
    }
  });

  /* ─────────────────────────────────────────── mode and race safety ──────── */

  test("switching from patient to practice never leaves the old count up", async ({
    page,
    request,
  }) => {
    await enter(page, "patient");
    await page.goto("/patient");
    await expect(toggle(page)).toBeVisible();
    // The patient panel has no follow-up section — that is the mode's fingerprint.
    await toggle(page).click();
    await expect(page.locator(".ms-notif__reminders")).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Slow the practice answer down so a stale patient value would be visible.
    await page.route("**/api/practice/inbox/notifications**", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });

    // The switch is a real one: practice mode AND the practice session.
    await enter(page, "practice");
    await page.goto("/practice");

    // While the practice request is still open the header shows no number at
    // all. Comparing the two numbers would prove nothing — they can coincide.
    await expect(page.locator(".ms-notif__badge")).toHaveCount(0);

    // Once it settles, the number is the PRACTICE number, and the panel is
    // unmistakably the practice one.
    const practices = await (
      await request.get(`${API}/api/practices`, {
        headers: { Authorization: `Bearer ${ownerSession.token}` },
      })
    ).json();
    const body = await (
      await request.get(
        `${API}/api/practice/inbox/notifications?practiceId=${practices.practices[0].id}`,
        { headers: { Authorization: `Bearer ${ownerSession.token}` } },
      )
    ).json();

    if (body.newInboxCount > 0) {
      await expect(page.locator(".ms-notif__badge")).toHaveText(String(body.newInboxCount));
    }
    await toggle(page).click();
    await expect(page.locator(".ms-notif__reminders")).toBeVisible();
  });

  test("switching to a practice this session may not read clears the number", async ({
    page,
    request,
  }) => {
    await enter(page, "practice");
    const practices = await (
      await request.get(`${API}/api/practices`, {
        headers: { Authorization: `Bearer ${ownerSession.token}` },
      })
    ).json();
    const own = practices.practices[0].id;

    await page.goto(`/practice?practiceId=${own}`);
    await expect(toggle(page)).toBeVisible();

    // A → B, where B is not this session's. The refusal must clear the old
    // number rather than leave practice A's on screen under B's id.
    await page.goto("/practice?practiceId=not-my-practice");
    await expect(page.locator(".ms-notif__badge")).toHaveCount(0);
    await toggle(page).click();
    await expect(panel(page)).toContainText("Konnte nicht geladen werden");
    await expect(page.locator(".ms-notif__reminders")).toHaveCount(0);
  });

  test("an in-app practice switch drops the old number before the new one arrives", async ({
    page,
    request,
  }) => {
    await enter(page, "practice");
    const practices = await (
      await request.get(`${API}/api/practices`, {
        headers: { Authorization: `Bearer ${ownerSession.token}` },
      })
    ).json();
    const own = practices.practices[0].id;

    await page.goto(`/practice?practiceId=${own}`);
    await expect(page.locator(".ms-notif__badge")).toBeVisible();

    // Hold the next answer open. Without a reload the component keeps its
    // state, so a stale summary would still be on screen right now.
    await page.route("**/api/practice/inbox/notifications**", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    // A client-side switch — no reload, exactly how the app changes practice.
    await page.evaluate(() => {
      window.history.pushState({}, "", "/practice?practiceId=another-practice");
      window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    });

    await expect(page.locator(".ms-notif__badge")).toHaveCount(0, { timeout: 1500 });
  });

  /* ─────────────────────────────────────────────── accessibility ─────────── */

  test("the entry is a real 44px target with an accessible name", async ({ page }) => {
    await enter(page, "patient");
    await page.goto("/patient");
    const box = await toggle(page).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(toggle(page)).toHaveAttribute("aria-label", /Postfach/);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("the panel opens and closes from the keyboard", async ({ page }) => {
    await enter(page, "patient");
    await page.goto("/patient");
    await toggle(page).focus();
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    // Focus comes back to where it was, not to the top of the document.
    await expect(toggle(page)).toBeFocused();
  });

  test("clicking outside closes the panel", async ({ page }) => {
    await enter(page, "patient");
    await page.goto("/patient");
    await toggle(page).click();
    await expect(panel(page)).toBeVisible();
    await page.locator("#main").click({ position: { x: 5, y: 5 }, force: true });
    await expect(panel(page)).toHaveCount(0);
  });

  /* ───────────────────────────────────────────────────── mobile ──────────── */

  test("on a phone the entry opens the inbox instead of a cramped dropdown", async ({ page }) => {
    await enter(page, "patient");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/patient");
    await toggle(page).click();
    await expect(page).toHaveURL(/\/patient\/inbox$/);
    await expect(panel(page)).toHaveCount(0);
  });
});
