// @ts-check
/**
 * Playwright configuration — MedScoutX E2E tests.
 *
 * ─── Quick start ──────────────────────────────────────────────────────────────
 *
 *   # 1. Install dependencies (one-time):
 *        npm install                      ← installs @playwright/test
 *        npm run test:e2e:install         ← installs Chromium browser binary
 *
 *   # 2. Create test fixture (one-time local setup):
 *        npm run e2e:fixture:create
 *        → prints E2E_TEST_EMAIL + E2E_TEST_PASSWORD; copy them into .env.e2e
 *
 *   # 3. Configure server (server/.env):
 *        ENABLE_BILLING_PLAUSIBILITY=true
 *        ENABLE_BILLING_AI_REVIEW=false
 *        JWT_SECRET=<any local value>
 *
 *   # 4. Start servers:
 *        cd server && node app.js         ← terminal 1
 *        cd client && npm run dev         ← terminal 2
 *
 *   # 5. Run tests:
 *        npm run test:e2e                 ← terminal 3 (from repo root)
 *
 *   See .env.e2e.example for the full env var reference.
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 *
 *   E2E_TEST_EMAIL        — test practice owner email  (from e2e:fixture:create)
 *   E2E_TEST_PASSWORD     — test practice owner password
 *   PLAYWRIGHT_BASE_URL   — frontend URL (default: http://localhost:5173)
 *
 *   Set in .env.e2e (loaded below if present, never overrides shell vars).
 *
 * ─── CI behaviour ────────────────────────────────────────────────────────────
 *
 *   When E2E_TEST_EMAIL / E2E_TEST_PASSWORD are not set the browser test skips
 *   gracefully (see beforeEach guard in the spec). The offline verify scripts
 *   (verify:billing-plausibility, verify:goae-catalogue, verify:billing-report-pdf)
 *   continue to run as usual — they do not require Playwright or credentials.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

// ─── Load .env.e2e if present (local dev only) ────────────────────────────────
//
// Reads .env.e2e from the repo root and injects values into process.env
// WITHOUT overriding variables already set in the shell or CI environment.
// Zero external dependencies — pure Node.js fs.
//
// .env.e2e is gitignored. Copy .env.e2e.example → .env.e2e and fill in values.

import { readFileSync } from "fs";

try {
  const envContent = readFileSync(new URL(".env.e2e", import.meta.url), "utf8");
  for (const raw of envContent.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
} catch {
  // .env.e2e doesn't exist — fine for CI and fresh checkouts.
}

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
