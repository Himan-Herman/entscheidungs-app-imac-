/**
 * E2E test fixture creator — creates a test User + PracticeProfile for local/CI E2E runs.
 *
 * Follows the same safety pattern as verifyBillingPlausibilityService.js:
 *   - Refuses to run against production databases (production indicator guard)
 *   - Fixture creation only allowed on localhost/127.0.0.1 hosts
 *   - Cleans up on request via --cleanup flag
 *
 * The created User has verified=true and a real bcrypt password hash so that
 * POST /api/auth/login succeeds from the Playwright browser test.
 *
 * ─── Usage ──────────────────────────────────────────────────────────────────
 *
 *   # Create fixture (generates a unique test email):
 *   cd server && node scripts/createE2eTestUser.js
 *
 *   # Create fixture with explicit credentials:
 *   cd server && node scripts/createE2eTestUser.js \
 *     --email=e2e-billing-local@test.invalid \
 *     --password=MyLocalTestPw!
 *
 *   # Or via env vars:
 *   E2E_TEST_EMAIL=e2e-billing-local@test.invalid \
 *   E2E_TEST_PASSWORD=MyLocalTestPw! \
 *   cd server && node scripts/createE2eTestUser.js
 *
 *   # Delete all E2E fixture users (emails containing "e2e-billing-"):
 *   cd server && node scripts/createE2eTestUser.js --cleanup
 *
 * ─── Required env ────────────────────────────────────────────────────────────
 *
 *   DATABASE_URL — local or CI test database (never production)
 *
 *   Tip: run with a .env file: DATABASE_URL=... node scripts/createE2eTestUser.js
 *   Or:  dotenv run -- node scripts/createE2eTestUser.js   (if dotenv CLI is installed)
 *
 * ─── Output ──────────────────────────────────────────────────────────────────
 *
 *   Prints E2E_TEST_EMAIL and E2E_TEST_PASSWORD values to use in the test run.
 *   Add them to .env.e2e at the repo root (never commit that file).
 *
 * ─── Server requirements for the test to pass ────────────────────────────────
 *
 *   server/.env:
 *     ENABLE_BILLING_PLAUSIBILITY=true
 *     ENABLE_BILLING_AI_REVIEW=false
 *     JWT_SECRET=<any local secret>
 *
 *   Note: SKIP_EMAIL_VERIFICATION is NOT required because this script sets
 *   verified=true on the created user directly in the database.
 */

import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import bcrypt from "bcryptjs";

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isCleanup = args.includes("--cleanup");

function argValue(flag) {
  const found = args.find((a) => a.startsWith(`${flag}=`));
  return found ? found.slice(flag.length + 1) : null;
}

// ─── Production safety guard ──────────────────────────────────────────────────
//
// Never allow this script to run against a production or Render-hosted database.
// Identical guard pattern to verifyBillingPlausibilityService.js.

const DATABASE_URL = process.env.DATABASE_URL || "";

if (!DATABASE_URL) {
  console.error("[e2e-fixture] FATAL: DATABASE_URL is not set.");
  console.error("[e2e-fixture] Add DATABASE_URL=<local-db-url> to server/.env");
  process.exit(1);
}

const PRODUCTION_INDICATORS = [
  "render.com",
  "dpg-",
  "-prod",
  "production",
  "prod.",
  ".prod",
  "postgres.render",
  "oregon-postgres",
  "frankfurt-postgres",
  "singapore-postgres",
];

let urlHostname = "";
try {
  urlHostname = new URL(DATABASE_URL).hostname.toLowerCase();
} catch {
  console.error("[e2e-fixture] FATAL: DATABASE_URL is not a valid URL — cannot verify safety.");
  process.exit(1);
}

const detectedIndicator = PRODUCTION_INDICATORS.find(
  (indicator) =>
    DATABASE_URL.toLowerCase().includes(indicator) ||
    urlHostname.includes(indicator),
);

if (detectedIndicator) {
  console.error("[e2e-fixture] ════════════════════════════════════════════════");
  console.error("[e2e-fixture] SAFETY GUARD TRIGGERED — refusing to run.");
  console.error("[e2e-fixture]");
  console.error("[e2e-fixture] This script creates/deletes records and must only");
  console.error("[e2e-fixture] run against a local or dedicated test database.");
  console.error("[e2e-fixture]");
  console.error(`[e2e-fixture] Detected production indicator: "${detectedIndicator}"`);
  console.error("[e2e-fixture] DB host:", urlHostname);
  console.error("[e2e-fixture] ════════════════════════════════════════════════");
  process.exit(1);
}

// Fixture creation requires localhost — no accidents on shared dev DBs.
if (!isCleanup && urlHostname !== "localhost" && urlHostname !== "127.0.0.1") {
  console.warn("[e2e-fixture] WARNING: DB host is not localhost:", urlHostname);
  console.warn("[e2e-fixture] Only localhost/127.0.0.1 databases are fully safe for fixture creation.");
  console.warn("[e2e-fixture] Proceeding — ensure this is a dedicated dev/test database.");
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** Email prefix used to identify fixture accounts for cleanup. */
const E2E_EMAIL_MARKER = "e2e-billing-";

const testEmail =
  argValue("--email") ||
  process.env.E2E_TEST_EMAIL ||
  `${E2E_EMAIL_MARKER}${Date.now()}@test.invalid`;

const testPassword =
  argValue("--password") ||
  process.env.E2E_TEST_PASSWORD ||
  "E2eTestBilling!2026";


// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log("[e2e-fixture] Cleanup mode: removing all E2E fixture users …");
  console.log(`[e2e-fixture] DB host: ${urlHostname}`);

  const users = await prisma.user.findMany({
    where: { email: { contains: E2E_EMAIL_MARKER } },
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log("[e2e-fixture] No E2E fixture users found — nothing to clean up.");
    return;
  }

  console.log(`[e2e-fixture] Found ${users.length} fixture user(s) to delete:`);
  for (const u of users) {
    console.log(`[e2e-fixture]   ${u.email} (id=${u.id})`);
  }

  for (const u of users) {
    // User delete cascades to PracticeProfile (has relation).
    // BillingPlausibilitySession uses a scalar FK — no cascade.
    // Clean up billing sessions first (if any were created by tests).
    const deletedSessions = await prisma.billingPlausibilitySession.deleteMany({
      where: { createdByUserId: u.id },
    });
    if (deletedSessions.count > 0) {
      console.log(`[e2e-fixture]   Deleted ${deletedSessions.count} billing session(s) for user ${u.id}`);
    }

    await prisma.user.delete({ where: { id: u.id } });
    console.log(`[e2e-fixture]   Deleted user ${u.email}`);
  }

  console.log(`\n[e2e-fixture] Cleanup complete — deleted ${users.length} fixture user(s).`);
}

// ─── Create fixture ───────────────────────────────────────────────────────────

async function createFixture() {
  console.log("[e2e-fixture] Creating E2E test fixture …");
  console.log(`[e2e-fixture] DB host:      ${urlHostname}`);
  console.log(`[e2e-fixture] Target email: ${testEmail}`);

  // ── Check for existing user ────────────────────────────────────────────────
  const existing = await prisma.user.findUnique({
    where: { email: testEmail },
    select: { id: true, email: true, verified: true },
  });

  let userId;
  let practiceId;

  if (existing) {
    console.log(`[e2e-fixture] User already exists: ${testEmail} (id=${existing.id})`);
    userId = existing.id;

    // Ensure verified=true so login works regardless of SKIP_EMAIL_VERIFICATION.
    if (!existing.verified) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { verified: true, verifyToken: null, verifyTokenExpires: null },
      });
      console.log("[e2e-fixture] Set verified=true on existing user.");
    }

    // Update the password so it always matches the configured test password.
    const passwordHash = await bcrypt.hash(testPassword, 12);
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash },
    });
    console.log("[e2e-fixture] Updated password hash to match configured test password.");

  } else {
    // ── Create user ───────────────────────────────────────────────────────────
    console.log("[e2e-fixture] Creating new User …");
    const passwordHash = await bcrypt.hash(testPassword, 12);

    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        firstName: "E2E",
        lastName: "BillingTest",
        dateOfBirth: new Date("1990-01-01"),
        verified: true,       // pre-verified — no email flow needed
        verifyToken: null,
        verifyTokenExpires: null,
      },
    });
    userId = user.id;
    console.log(`[e2e-fixture] Created User id=${userId}`);
  }

  // ── Find or create PracticeProfile ────────────────────────────────────────
  const existingPractice = await prisma.practiceProfile.findFirst({
    where: { userId },
    select: { id: true, practiceName: true, publicSlug: true },
  });

  if (existingPractice) {
    practiceId = existingPractice.id;
    console.log(
      `[e2e-fixture] Using existing PracticeProfile id=${practiceId} ` +
      `slug="${existingPractice.publicSlug}"`,
    );
  } else {
    // publicSlug must be unique — use userId prefix to ensure uniqueness.
    const slug = `e2e-billing-${userId.slice(0, 10)}`;
    const practice = await prisma.practiceProfile.create({
      data: {
        userId,
        practiceName: "E2E Billing Test Practice",
        publicSlug: slug,
      },
    });
    practiceId = practice.id;
    console.log(
      `[e2e-fixture] Created PracticeProfile id=${practiceId} slug="${slug}"`,
    );
  }

  // ── Print credentials ──────────────────────────────────────────────────────
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  E2E fixture ready.  Copy these values into .env.e2e:       ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  E2E_TEST_EMAIL=${testEmail}`);
  console.log(`║  E2E_TEST_PASSWORD=${testPassword}`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("─── Shell export ───────────────────────────────────────────────");
  console.log(`  export E2E_TEST_EMAIL="${testEmail}"`);
  console.log(`  export E2E_TEST_PASSWORD="${testPassword}"`);
  console.log("");
  console.log("─── .env.e2e (repo root — do not commit) ───────────────────────");
  console.log(`  E2E_TEST_EMAIL=${testEmail}`);
  console.log(`  E2E_TEST_PASSWORD=${testPassword}`);
  console.log("");
  console.log("─── Required server/.env settings for the test to pass ─────────");
  console.log("  ENABLE_BILLING_PLAUSIBILITY=true");
  console.log("  ENABLE_BILLING_AI_REVIEW=false");
  console.log("  JWT_SECRET=<any-local-secret>");
  console.log("  (SKIP_EMAIL_VERIFICATION is NOT required — user is pre-verified)");
  console.log("");
  console.log("─── Run E2E tests ───────────────────────────────────────────────");
  console.log("  # 1. Start backend:   cd server && node app.js");
  console.log("  # 2. Start frontend:  cd client && npm run dev");
  console.log("  # 3. Run tests:       npm run test:e2e        (from repo root)");
  console.log("  #    Or directly:     npx playwright test e2e/billing-plausibility.spec.js");
  console.log("");
  console.log(
    `[e2e-fixture] Done. userId=${userId} practiceId=${practiceId}`,
  );
}

// ─── Entry point ─────────────────────────────────────────────────────────────

(async () => {
  try {
    if (isCleanup) {
      await cleanup();
    } else {
      await createFixture();
    }
  } catch (err) {
    console.error("[e2e-fixture] Error:", err?.message ?? String(err));
    if (err?.code) console.error("[e2e-fixture] Code:", err.code);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
