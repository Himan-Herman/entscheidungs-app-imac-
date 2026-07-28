/**
 * Browser E2E for "Meine Messwerte" — the patient's own view.
 *
 * Covers the two things that were actually broken:
 *   1. the page rendered "Messwerte konnten nicht geladen werden" because
 *      GET /api/patient/vitals answered 500 on a Prisma schema drift, and
 *   2. the wearable section advertised Withings / Fitbit / Garmin as
 *      "Bald verfügbar" although no integration for them exists.
 *
 * Authentication follows the same pattern as billing-plausibility.spec.js:
 * a JWT is obtained over the API and injected into localStorage, so no
 * credentials are typed into the UI.
 *
 * Setup:
 *   node e2e/helpers/createE2eTestUser.js --email=... --password=...
 *   cd server && node app.js        # :3000
 *   cd client && npm run dev        # :5173
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npx playwright test e2e/patient-vitals.spec.js
 */

import { test, expect } from "@playwright/test";

const API = process.env.E2E_API_BASE || "http://localhost:3000";

async function loginViaApi(apiContext) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) throw new Error("E2E_TEST_EMAIL / E2E_TEST_PASSWORD must be set.");

  const res = await apiContext.post(`${API}/api/auth/login`, { data: { email, password } });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
  const data = await res.json();
  return { token: data.token, userId: data.userId };
}

test.describe("Patient — Meine Messwerte", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
      testInfo.skip(true, "E2E credentials not set");
    }
  });

  test("page loads, value round-trips, no vendor cards", async ({ page, request: apiContext }) => {
    const { token, userId } = await loginViaApi(apiContext);
    await page.addInitScript(
      ({ t, uid }) => {
        localStorage.setItem("medscout_token", t);
        localStorage.setItem("medscout_user_id", uid);
      },
      { t: token, uid: userId },
    );

    // Anything the browser logs is a finding — the old page logged a 500.
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

    // Record the status the page itself sees, not one a separate probe sees.
    const vitalsStatuses = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/patient/vitals")) vitalsStatuses.push(r.status());
    });

    // ── 1. Page loads without the red error ──────────────────────────────────
    await page.goto("/patient/vitals");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2500);

    expect(vitalsStatuses.length, "GET /api/patient/vitals was called").toBeGreaterThan(0);
    expect(vitalsStatuses.every((s) => s === 200), `statuses: ${vitalsStatuses}`).toBe(true);
    // The account locale decides the language, so assert on both wordings.
    await expect(page.getByText(/Messwerte konnten nicht geladen werden|could not be loaded/i)).toHaveCount(0);

    // ── 2. No card for a manufacturer we cannot actually connect ─────────────
    for (const vendor of ["Withings", "Fitbit", "Garmin"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(vendor, "i") }),
        `no connect button for ${vendor}`,
      ).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: /Bald verfügbar/i })).toHaveCount(0);

    // ── 3. In a desktop browser neither native store may be offered ──────────
    await expect(page.getByRole("button", { name: /Apple Health verbinden/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Health Connect verbinden/i })).toHaveCount(0);
    await expect(
      page.getByText(/nur in der MedScoutX-App|only possible in the MedScoutX app/i).first(),
    ).toBeVisible();

    // ── 4. The old promise of an automatic import must be gone ──────────────
    await expect(page.getByText(/automatische Import startet|Automatic import starts/i)).toHaveCount(0);
    // …and the honest replacement must be present.
    await expect(
      page.getByText(/Jetzt synchronisieren|Sync now/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/keine direkte Anbindung|no direct integration/i).first(),
    ).toBeVisible();

    // ── 5. Manual entry still works and survives a reload ───────────────────
    const before = await apiContext.get(`${API}/api/patient/vitals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const beforeCount = (await before.json()).entries.length;

    const created = await apiContext.post(`${API}/api/patient/vitals`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        type: "blood_pressure",
        valuePrimary: 128,
        valueSecondary: 82,
        unit: "mmHg",
        measuredAt: "2026-07-28T09:15:00.000Z",
      },
    });
    expect(created.status()).toBe(201);
    const createdId = (await created.json()).entry.id;

    await page.reload();
    await page.waitForTimeout(2500);
    await expect(page.getByText("128").first()).toBeVisible();

    const after = await apiContext.get(`${API}/api/patient/vitals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const entries = (await after.json()).entries;
    expect(entries.length).toBe(beforeCount + 1);
    // The measurement time is the patient's, not the moment of upload.
    expect(entries[0].measuredAt).toBe("2026-07-28T09:15:00.000Z");

    await page.screenshot({ path: "e2e-vitals-page.png", fullPage: true });

    // ── 6. Clean up the value we created ────────────────────────────────────
    const del = await apiContext.delete(`${API}/api/patient/vitals/${createdId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status()).toBe(200);

    expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toHaveLength(0);
  });
});
