/**
 * Phase 5B — finding and organising work in the practice patient list.
 *
 * The server suite proves the aggregation is scoped and gated. This proves the
 * product: a practice searches, filters by work state, opens the exact
 * relationship, and the two races that would show the wrong practice's data
 * never do.
 *
 * Roles and links come from the existing fixture
 * (server/scripts/createE2ePracticeContextFixture.js); sessions are seeded the
 * way every spec here does it.
 */
import { test, expect } from "@playwright/test";

const API = "http://localhost:3000";
const PASSWORD = "E2ePracticeContext!23";
const OWNER_A_EMAIL = "e2e-practice-context-owner-a@test.invalid";
const OWNER_B_EMAIL = "e2e-practice-context-owner-b@test.invalid";

const LINK_A = process.env.E2E_LINK_A;
const LINK_A2 = process.env.E2E_LINK_A2;
const LINK_B = process.env.E2E_LINK_B;

const STAMP = String(Date.now()).slice(-8);
const REMINDER = `OV_REMINDER_${STAMP}`;

async function login(request, email) {
  const res = await request.post(`${API}/api/auth/login`, { data: { email, password: PASSWORD } });
  if (!res.ok()) throw new Error(`Login failed for ${email}: ${res.status()}`);
  return res.json();
}

async function practiceIdFor(request, session) {
  const res = await request.get(`${API}/api/practices`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const body = await res.json();
  const own = (body.practices || []).find((p) => p.userId === session.userId) ?? body.practices?.[0];
  return own.id;
}

async function useSession(page, session) {
  await page.addInitScript(({ t, uid }) => {
    localStorage.setItem("medscout_token", t);
    localStorage.setItem("medscout_user_id", uid);
    localStorage.setItem("medscoutx_user_mode", "practice");
    localStorage.setItem("medscout_language", "de");
  }, { t: session.token, uid: session.userId });
}

const listUrl = (practiceId, extra = "") =>
  `/practice/patients?practiceId=${practiceId}${extra}`;

test.describe("practice work overview", () => {
  let ownerA, ownerB, practiceA, practiceB;

  test.beforeAll(async ({ request }) => {
    if (!LINK_A || !LINK_A2 || !LINK_B) return;
    [ownerA, ownerB] = await Promise.all([
      login(request, OWNER_A_EMAIL), login(request, OWNER_B_EMAIL),
    ]);
    [practiceA, practiceB] = await Promise.all([
      practiceIdFor(request, ownerA), practiceIdFor(request, ownerB),
    ]);
  });

  test.beforeEach(async ({}, testInfo) => {
    if (!LINK_A || !LINK_A2 || !LINK_B) {
      testInfo.skip(true, "Set E2E_LINK_A / E2E_LINK_A2 / E2E_LINK_B");
    }
  });

  /* ───────────────────────────────── 1-4: find, open the right link, back */

  test("searching finds the patient and opens the exact relationship", async ({ page }) => {
    await useSession(page, ownerA);
    await page.goto(listUrl(practiceA));

    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();

    await page.getByRole("searchbox").or(page.locator("input[type='search']")).first()
      .fill("Ella");
    await expect(rows.first()).toBeVisible();

    // The open link must carry the LINK id, never a patient account id.
    const href = await page.locator(`a[href*="/practice/patients/"]`).first().getAttribute("href");
    expect(href).toContain(`/practice/patients/${LINK_A.slice(0, 6)}`);
    expect(href).not.toMatch(/patientUserId/);

    await page.locator(`a[href*="/practice/patients/"]`).first().click();
    await expect(page).toHaveURL(/\/practice\/patients\/[a-z0-9]+/);

    await page.goBack();
    await expect(page).toHaveURL(/\/practice\/patients\?/);
  });

  /* ─────────────────────────────── 5-12: work filters, end to end via 5A */

  test("open follow-ups can be filtered, completed ones drop out", async ({ page, request }) => {
    await useSession(page, ownerA);
    const auth = { Authorization: `Bearer ${ownerA.token}`, "Content-Type": "application/json" };

    // 7 — create one through the Phase 5A endpoint.
    const created = await request.post(
      `${API}/api/practice/patients/${LINK_A}/reminders`,
      { headers: auth, data: { practiceId: practiceA, title: REMINDER, dueAt: "2026-09-30T09:00:00.000Z" } },
    );
    expect(created.status()).toBe(201);
    const reminderId = (await created.json()).reminder.id;

    // 9-10 — the overview filter shows that relationship, with an open count.
    await page.goto(listUrl(practiceA, "&filter=reminders"));
    // Both layouts (table row and phone card) live in the DOM at once; CSS
    // decides which one shows. Assert on the VISIBLE one, not on a count.
    await expect(page.locator(`a[href*="${LINK_A}"]`).first()).toBeVisible();
    await expect(page.locator("#main")).toContainText("offen");

    // 11 — complete it through 5A.
    const done = await request.post(
      `${API}/api/practice/patients/${LINK_A}/reminders/${reminderId}/complete`,
      { headers: auth, data: { practiceId: practiceA } },
    );
    expect(done.ok()).toBeTruthy();

    // 12 — and this relationship is gone from the open filter. Asserted on the
    // link itself: other tests may legitimately leave open follow-ups behind.
    await page.reload();
    await expect(page.locator(`a[href*="${LINK_A}"]`)).toHaveCount(0);
  });

  /* ──────────────────────────────────────── 13-14: isolation in the list */

  test("the list never mixes relationships or practices", async ({ page, request }) => {
    const authA = { Authorization: `Bearer ${ownerA.token}`, "Content-Type": "application/json" };
    await request.post(`${API}/api/practice/patients/${LINK_A2}/reminders`, {
      headers: authA,
      data: { practiceId: practiceA, title: `${REMINDER}_A2`, dueAt: "2026-09-30T09:00:00.000Z" },
    });

    // Practice A sees its own second relationship under the filter.
    await useSession(page, ownerA);
    await page.goto(listUrl(practiceA, "&filter=reminders"));
    await expect(page.locator(`a[href*="${LINK_A2}"]`).first()).toBeVisible();

    // Practice B's list never shows practice A's work.
    const pageB = await page.context().newPage();
    await pageB.addInitScript(({ t, uid }) => {
      localStorage.setItem("medscout_token", t);
      localStorage.setItem("medscout_user_id", uid);
      localStorage.setItem("medscoutx_user_mode", "practice");
      localStorage.setItem("medscout_language", "de");
    }, { t: ownerB.token, uid: ownerB.userId });
    await pageB.goto(listUrl(practiceB, "&filter=reminders"));
    await expect(pageB.locator("body")).not.toContainText(REMINDER);
    // Neither of practice A's links may be reachable from practice B's list.
    await expect(pageB.locator(`a[href*="${LINK_A}"]`)).toHaveCount(0);
    await expect(pageB.locator(`a[href*="${LINK_A2}"]`)).toHaveCount(0);
    await pageB.close();
  });

  /* ───────────────────────────────────────────── 15: URL state survives */

  test("refresh, back and forward keep the search and the filter", async ({ page }) => {
    await useSession(page, ownerA);
    await page.goto(listUrl(practiceA));

    await page.getByRole("searchbox").or(page.locator("input[type='search']")).first().fill("Ella");
    await expect(page).toHaveURL(/[?&]q=Ella/);

    await page.reload();
    await expect(page).toHaveURL(/[?&]q=Ella/);
    await expect(
      page.getByRole("searchbox").or(page.locator("input[type='search']")).first(),
    ).toHaveValue("Ella");

    await page.goto(listUrl(practiceA, "&filter=unread"));
    await expect(page).toHaveURL(/filter=unread/);
    await page.reload();
    await expect(page).toHaveURL(/filter=unread/);
  });

  /* ─────────────────────────────────────── M5: the two response races */

  test("a slow earlier search never overwrites a newer one", async ({ page }) => {
    await useSession(page, ownerA);

    /*
     * The guard is about what is RENDERED, not about the input box: React owns
     * the field, so a late response could never change it. What a lost race
     * corrupts is the list — rows for the abandoned query painted under the
     * current one. So the two queries are chosen to differ in their results:
     * "Ella" matches, "Zzzznomatch" matches nothing, and the matching response
     * is delayed so it lands last.
     */
    await page.goto(listUrl(practiceA));
    await expect(page.locator(`a[href*="${LINK_A}"]`).first()).toBeVisible();

    await page.route("**/api/practice/patients?*", async (route) => {
      if (route.request().url().includes("q=Ella")) {
        await new Promise((r) => setTimeout(r, 3000));
      }
      await route.continue();
    });

    const box = page.getByRole("searchbox").or(page.locator("input[type='search']")).first();
    await box.fill("Ella");
    await page.waitForTimeout(700);          // let the debounce fire the slow one
    await box.fill("Zzzznomatch");
    await page.waitForTimeout(4000);         // the slow "Ella" answer lands here

    // The newest query found nothing, so nothing may be on screen.
    await expect(box).toHaveValue("Zzzznomatch");
    await expect(page).toHaveURL(/[?&]q=Zzzznomatch/);
    await expect(
      page.locator(`a[href*="${LINK_A}"]`),
      "a superseded response must not repaint the list",
    ).toHaveCount(0);
  });

  test("switching practice never paints the previous practice's rows", async ({ page }) => {
    await useSession(page, ownerA);

    // Practice A's answer is held back; the user moves on to practice B.
    await page.route("**/api/practice/patients?*", async (route) => {
      if (route.request().url().includes(`practiceId=${practiceA}`)) {
        await new Promise((r) => setTimeout(r, 3000));
      }
      await route.continue();
    });

    await page.goto(listUrl(practiceA));
    await page.goto(listUrl(practiceB));
    await page.waitForTimeout(4000);          // A's answer arrives in here

    await expect(page).toHaveURL(new RegExp(`practiceId=${practiceB}`));
    // The decisive assertion: practice A's relationships are not on B's screen.
    await expect(
      page.locator(`a[href*="${LINK_A}"]`),
      "a late answer for another practice must never be rendered",
    ).toHaveCount(0);
    await expect(page.locator(`a[href*="${LINK_A2}"]`)).toHaveCount(0);
  });

  /* ───────────────────────────────────── 16-17: mobile, error vs empty */

  test("an error state and an empty state are never shown together", async ({ page }) => {
    await useSession(page, ownerA);
    await page.route("**/api/practice/patients?*", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"ok":false}' }),
    );
    await page.goto(listUrl(practiceA));

    const body = page.locator("#main");
    await expect(body).toContainText(/konnte|Fehler|nicht geladen/i);
    // The "no relationships yet" copy must not appear beside the failure.
    await expect(body).not.toContainText("Noch keine Patient");
  });

  test("the overview works on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await useSession(page, ownerA);
    await page.goto(listUrl(practiceA));

    // On a phone the list is cards, not a table; asserting on <tbody> would be
    // asserting on the desktop layout.
    await expect(page.locator(".practice-patients__card-item").first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no horizontal scrolling on 375px").toBeLessThanOrEqual(1);
  });
});
