// @ts-check
/**
 * Playwright configuration — MedScoutX E2E tests.
 *
 * Prerequisites before running:
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *
 * Required environment variables:
 *   PLAYWRIGHT_BASE_URL   — frontend URL  (default: http://localhost:5173)
 *   E2E_TEST_EMAIL        — test practice owner email
 *   E2E_TEST_PASSWORD     — test practice owner password
 *
 * Required backend env (server/.env):
 *   DATABASE_URL              — local dev database (never production)
 *   ENABLE_BILLING_PLAUSIBILITY=true
 *   ENABLE_BILLING_AI_REVIEW=false
 *
 * Running locally:
 *   # 1. Start backend:    cd server && node app.js
 *   # 2. Start frontend:   cd client && npm run dev
 *   # 3. Run E2E:          npx playwright test e2e/billing-plausibility.spec.js
 *
 * @see https://playwright.dev/docs/test-configuration
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1, // serial — billing tests create real DB records

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
