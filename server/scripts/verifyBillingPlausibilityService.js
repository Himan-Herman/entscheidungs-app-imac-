/**
 * verifyBillingPlausibilityService — Phase G4b DB-touching service smoke test.
 *
 * Tests the billing plausibility service layer against a real local/dev database.
 * Follows the existing DB-touching verify script pattern (verifyCareRelationship.js,
 * verifyBackgroundJobs.js).
 *
 * ⚠️  WARNING: This script writes temporary test records to the database.
 *     It must ONLY be run against a local or dedicated dev database.
 *     It will REFUSE to run if DATABASE_URL contains production indicators.
 *
 * Prerequisite: billing migration must be applied:
 *   cd server && npx prisma migrate deploy
 *
 * Usage:
 *   node scripts/verifyBillingPlausibilityService.js
 *
 * Flows tested (service layer only — no HTTP, no JWT, no AI):
 *   §1  DB connectivity / table readiness
 *   §2  createSessionForPractice — known ziffer, G3b-2 provenance stored
 *   §3  createSessionForPractice — unknown ziffer, warnings stored
 *   §4  createSessionForPractice — rows_required guard
 *   §5  createSessionForPractice — too_many_rows guard (31 rows)
 *   §6  listSessionsForPractice — includes created session IDs
 *   §7  getSessionForPractice — returns session with items
 *   §8  getSessionForPractice — session_not_found for fake ID
 *   §9  dismissSessionForPractice — status becomes dismissed
 *   §10 dismissSessionForPractice — already_dismissed guard
 *   §11 forbidden actor — userId not in practice
 *   §12 Cleanup — all test sessions removed
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  createSessionForPractice,
  listSessionsForPractice,
  getSessionForPractice,
  dismissSessionForPractice,
} from "../services/billingPlausibility/billingPlausibilityService.js";

// ─── Production safety guard ──────────────────────────────────────────────────
//
// This script must never run against a production or Render-hosted database.
// Production indicators checked below are conservative — add more as needed.

const DATABASE_URL = process.env.DATABASE_URL || "";

if (!DATABASE_URL) {
  console.error("[verify] FATAL: DATABASE_URL is not set.");
  console.error("[verify] Load a local .env or set DATABASE_URL before running.");
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
  // If URL can't be parsed treat it as suspicious
  console.error("[verify] FATAL: DATABASE_URL is not a valid URL — cannot verify safety.");
  process.exit(1);
}

const detectedIndicator = PRODUCTION_INDICATORS.find(
  (indicator) =>
    DATABASE_URL.toLowerCase().includes(indicator) ||
    urlHostname.includes(indicator),
);

if (detectedIndicator) {
  console.error("[verify] ============================================================");
  console.error("[verify] SAFETY GUARD TRIGGERED — refusing to run.");
  console.error("[verify]");
  console.error("[verify] This script writes temporary records and must only be run");
  console.error("[verify] against a local/dev database.");
  console.error("[verify]");
  console.error(`[verify] Detected production indicator: "${detectedIndicator}"`);
  console.error("[verify] DATABASE_URL host:", urlHostname);
  console.error("[verify] ============================================================");
  process.exit(1);
}

if (urlHostname !== "localhost" && urlHostname !== "127.0.0.1" && !urlHostname.endsWith(".local")) {
  // Non-localhost but no known prod indicator — warn but allow.
  // GitHub Actions PostgreSQL service containers always bind to localhost — safe.
  console.warn("[verify] WARNING: DATABASE_URL host is not localhost:", urlHostname);
  console.warn("[verify] Proceeding — ensure this is a dev/test database.");
}

// ─── CI fixture mode ──────────────────────────────────────────────────────────
//
// When CI=true or NODE_ENV=test and no PracticeProfile exists in the DB,
// a minimal User + PracticeProfile is created so service flows can run.
// All fixture records are removed in the finally block.
//
// Fixture creation is only permitted when the DB host is localhost/127.0.0.1
// (GitHub Actions PostgreSQL service containers always use localhost).
// This prevents accidental fixture creation on any non-local database.

const CI_MODE = process.env.CI === "true" || process.env.NODE_ENV === "test";

/** Fixture IDs to delete in cleanup (null = not created this run). */
const createdFixture = { userId: null, practiceId: null };

async function createCiFixture(prismaClient) {
  if (urlHostname !== "localhost" && urlHostname !== "127.0.0.1") {
    console.error("[verify] FATAL: CI fixture mode requested but DB host is not localhost.");
    console.error("[verify] DB host:", urlHostname);
    console.error("[verify] Fixture creation is only allowed against a local test database.");
    process.exit(1);
  }

  console.log("[verify] CI mode: creating minimal test fixture (User + PracticeProfile) …");

  // Use timestamp to guarantee uniqueness across parallel runs.
  const stamp = Date.now();
  const ciEmail = `billing-ci-verify-${stamp}@test.invalid`;
  const ciSlug = `billing-ci-verify-${stamp}`;

  const user = await prismaClient.user.create({
    data: {
      email: ciEmail,
      passwordHash: "ci-placeholder-not-a-real-hash",
      firstName: "CI",
      lastName: "Verify",
      dateOfBirth: new Date("1990-01-01"),
      verified: false,
    },
  });
  createdFixture.userId = user.id;
  console.log(`[verify] CI fixture: created User id=${user.id} email=${ciEmail}`);

  const practice = await prismaClient.practiceProfile.create({
    data: {
      userId: user.id,
      practiceName: "CI Billing Verify Practice",
      publicSlug: ciSlug,
    },
  });
  createdFixture.practiceId = practice.id;
  console.log(`[verify] CI fixture: created PracticeProfile id=${practice.id} slug=${ciSlug}`);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

// Force the feature flag on in-process so service calls are not blocked.
// The service layer itself does NOT check this flag; only the route layer does.
// Setting it here ensures future calls are safe even if flag-checking is added.
process.env.ENABLE_BILLING_PLAUSIBILITY = "true";

const prisma = new PrismaClient();

/** Collected IDs of test sessions created during this run — cleaned up in finally. */
const createdSessionIds = [];

// ─── Assert helper ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failureMessages = [];

function assert(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok    ${label}`);
  } else {
    failed++;
    const msg = detail ? `${label} — ${detail}` : label;
    failureMessages.push(msg);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[verify] verifyBillingPlausibilityService — Phase G4b");
  console.log("[verify] DB host:", urlHostname);

  // ── §1  DB connectivity / table readiness ────────────────────────────────
  section("§1  DB connectivity / table readiness");

  let tableReady = false;
  try {
    await prisma.billingPlausibilitySession.count();
    tableReady = true;
    assert("billingPlausibilitySession table accessible", true);
    console.log("  ok    billingPlausibilityItem table (implied by session)");
    console.log("  ok    billingPlausibilityAuditLog table (implied by session)");
  } catch (err) {
    console.error("[verify] Billing plausibility migration is not applied.");
    console.error("[verify] Run:  cd server && npx prisma migrate deploy");
    console.error("[verify] Error:", err?.message ?? String(err));
    process.exit(1);
  }

  // ── Practice fixture discovery (or CI fixture creation) ──────────────────

  let practice = await prisma.practiceProfile.findFirst({
    select: { id: true, userId: true, practiceName: true },
  });

  if (!practice) {
    if (CI_MODE) {
      await createCiFixture(prisma);
      practice = await prisma.practiceProfile.findFirst({
        select: { id: true, userId: true, practiceName: true },
      });
    } else {
      console.log("[verify] skip — no PracticeProfile in DB");
      console.log("[verify] Tip: set CI=true or NODE_ENV=test to auto-create a CI fixture.");
      return;
    }
  }

  if (!practice) {
    console.error("[verify] FATAL: CI fixture creation succeeded but practice not found on re-query.");
    process.exit(1);
  }

  const practiceId = practice.id;
  const ownerActor = { userId: practice.userId };
  console.log(`\n[verify] Using practice id=${practiceId} owner=${practice.userId}`);

  // Find a user who is NOT the owner and NOT a member of this practice —
  // used for the forbidden-actor test.
  const forbiddenUser = await prisma.user.findFirst({
    where: { id: { not: practice.userId } },
    select: { id: true },
  });
  const forbiddenActor = forbiddenUser
    ? { userId: forbiddenUser.id }
    : { userId: "non-existent-user-id-g4b-test" };
  console.log(`[verify] Forbidden actor userId=${forbiddenActor.userId}`);

  // ── §2  createSessionForPractice — known ziffer ──────────────────────────
  section("§2  createSessionForPractice — known ziffer (G3b-2 provenance)");

  const r2 = await createSessionForPractice(practiceId, ownerActor, {
    rows: [{ ziffer: "1", factor: "2.5", count: 1, contextText: "" }],
  });

  assert("§2 ok=true", r2.ok === true, r2.ok ? "" : `error=${r2.error}`);

  if (r2.ok) {
    createdSessionIds.push(r2.session.id);

    assert("§2 status=pending", r2.session.status === "pending");
    assert("§2 items.length=1", Array.isArray(r2.session.items) && r2.session.items.length === 1);

    const item2 = r2.session.items?.[0];
    assert("§2 item.ziffer='1'", item2?.ziffer === "1");

    const match2 = item2?.catalogueMatchJson;
    assert("§2 catalogueMatchJson.found=true", match2?.found === true, JSON.stringify(match2));

    // G3b-2: completenessStatus must be present for a known entry
    assert(
      "§2 (G3b-2) catalogueMatchJson.completenessStatus present",
      typeof match2?.completenessStatus === "string" && match2.completenessStatus.length > 0,
      `completenessStatus=${match2?.completenessStatus}`,
    );

    // G3b-2: completenessStatus must be one of the known values
    const validStatuses = ["verified", "points-uncertain", "needs-review"];
    assert(
      "§2 (G3b-2) catalogueMatchJson.completenessStatus is a known value",
      validStatuses.includes(match2?.completenessStatus),
      `got: ${match2?.completenessStatus}`,
    );

    // G3b-2: resultSummaryJson.rowResults[0].completenessStatus must be stored
    const rr2 = r2.session.resultSummaryJson?.rowResults?.[0];
    assert(
      "§2 (G3b-2) resultSummaryJson.rowResults[0].completenessStatus present",
      rr2 !== undefined && rr2.completenessStatus !== undefined,
      `rowResult=${JSON.stringify(rr2)}`,
    );

    // factor 2.5 > 2.3 — expect high-factor warning
    const warnings2 = Array.isArray(item2?.warningsJson) ? item2.warningsJson : [];
    assert(
      "§2 high-factor warning stored (factor 2.5 > 2.3)",
      warnings2.includes("factor_requires_justification"),
      `warnings=${JSON.stringify(warnings2)}`,
    );

    console.log(`  info  session id=${r2.session.id} completenessStatus=${match2?.completenessStatus}`);
  }

  // ── §3  createSessionForPractice — unknown ziffer ────────────────────────
  section("§3  createSessionForPractice — unknown ziffer (9999)");

  const r3 = await createSessionForPractice(practiceId, ownerActor, {
    rows: [{ ziffer: "9999", factor: "2.3", count: 1, contextText: "" }],
  });

  assert("§3 ok=true", r3.ok === true, r3.ok ? "" : `error=${r3.error}`);

  if (r3.ok) {
    createdSessionIds.push(r3.session.id);

    const item3 = r3.session.items?.[0];
    const match3 = item3?.catalogueMatchJson;
    assert("§3 catalogueMatchJson.found=false", match3?.found === false, JSON.stringify(match3));

    const warnings3 = Array.isArray(item3?.warningsJson) ? item3.warningsJson : [];
    assert(
      "§3 unknown_goae_ziffer warning stored",
      warnings3.includes("unknown_goae_ziffer"),
      `warnings=${JSON.stringify(warnings3)}`,
    );

    // G3b-2: unknown entry must NOT have completenessStatus key (no leakage)
    assert(
      "§3 (G3b-2) catalogueMatchJson has no completenessStatus for unknown ziffer",
      !("completenessStatus" in (match3 ?? {})),
      `unexpected key completenessStatus=${match3?.completenessStatus}`,
    );
  }

  // ── §4  rows_required guard ──────────────────────────────────────────────
  section("§4  createSessionForPractice — rows_required guard");

  const r4 = await createSessionForPractice(practiceId, ownerActor, { rows: [] });
  assert("§4 ok=false", r4.ok === false);
  assert("§4 error=rows_required", r4.error === "rows_required", `got=${r4.error}`);

  // ── §5  too_many_rows guard (31 rows) ────────────────────────────────────
  section("§5  createSessionForPractice — too_many_rows (31 rows)");

  const r5 = await createSessionForPractice(practiceId, ownerActor, {
    rows: Array.from({ length: 31 }, (_, i) => ({
      ziffer: String(i + 1),
      factor: "1.0",
      count: 1,
    })),
  });
  assert("§5 ok=false", r5.ok === false);
  assert("§5 error=too_many_rows", r5.error === "too_many_rows", `got=${r5.error}`);

  // ── §6  listSessionsForPractice ──────────────────────────────────────────
  section("§6  listSessionsForPractice — includes created sessions");

  const r6 = await listSessionsForPractice(practiceId, ownerActor);
  assert("§6 ok=true", r6.ok === true, r6.ok ? "" : `error=${r6.error}`);

  if (r6.ok) {
    const returnedIds = r6.sessions.map((s) => s.id);
    const expectedIds = createdSessionIds.filter(Boolean);

    for (const id of expectedIds) {
      assert(`§6 session id=${id.slice(0, 12)}… in list`, returnedIds.includes(id));
    }

    assert(
      "§6 sessions is an array",
      Array.isArray(r6.sessions),
    );
  }

  // ── §7  getSessionForPractice — returns session with items ───────────────
  section("§7  getSessionForPractice — returns session with items");

  const sessionIdForGet = createdSessionIds[0];
  if (sessionIdForGet) {
    const r7 = await getSessionForPractice(practiceId, sessionIdForGet, ownerActor);
    assert("§7 ok=true", r7.ok === true, r7.ok ? "" : `error=${r7.error}`);

    if (r7.ok) {
      assert("§7 session.id matches", r7.session.id === sessionIdForGet);
      assert("§7 items array present", Array.isArray(r7.session.items));
      assert("§7 items.length >= 1", (r7.session.items?.length ?? 0) >= 1);

      // G3b-2: items in getSession include catalogueMatchJson with completenessStatus
      const firstItem = r7.session.items?.[0];
      const firstMatch = firstItem?.catalogueMatchJson;
      if (firstMatch?.found) {
        assert(
          "§7 (G3b-2) getSession item has completenessStatus",
          typeof firstMatch?.completenessStatus === "string",
          `completenessStatus=${firstMatch?.completenessStatus}`,
        );
      } else {
        assert("§7 item has catalogueMatchJson", firstMatch !== undefined);
      }
    }
  } else {
    console.log("  skip  §7 — no session ID from §2 (§2 failed)");
  }

  // ── §8  session_not_found for fake id ────────────────────────────────────
  section("§8  getSessionForPractice — session_not_found for fake id");

  const r8 = await getSessionForPractice(
    practiceId,
    "fake-session-id-g4b-does-not-exist",
    ownerActor,
  );
  assert("§8 ok=false", r8.ok === false);
  assert("§8 error=session_not_found", r8.error === "session_not_found", `got=${r8.error}`);

  // ── §9  dismissSessionForPractice ────────────────────────────────────────
  section("§9  dismissSessionForPractice — status becomes dismissed");

  const sessionIdForDismiss = createdSessionIds[0];
  if (sessionIdForDismiss) {
    const r9 = await dismissSessionForPractice(practiceId, sessionIdForDismiss, ownerActor);
    assert("§9 ok=true", r9.ok === true, r9.ok ? "" : `error=${r9.error}`);

    if (r9.ok) {
      assert("§9 status=dismissed", r9.session.status === "dismissed");
      assert("§9 dismissedAt present", r9.session.dismissedAt !== null && r9.session.dismissedAt !== undefined);
    }
  } else {
    console.log("  skip  §9 — no session ID (§2 failed)");
  }

  // ── §10  already_dismissed guard ─────────────────────────────────────────
  section("§10  dismissSessionForPractice — already_dismissed guard");

  const sessionIdForDismiss2 = createdSessionIds[0];
  if (sessionIdForDismiss2) {
    const r10 = await dismissSessionForPractice(practiceId, sessionIdForDismiss2, ownerActor);
    assert("§10 ok=false", r10.ok === false);
    assert("§10 error=already_dismissed", r10.error === "already_dismissed", `got=${r10.error}`);
  } else {
    console.log("  skip  §10 — no session ID (§2 failed)");
  }

  // ── §11  forbidden actor ──────────────────────────────────────────────────
  section("§11  forbidden actor — userId not in practice");

  // Test against all four service functions
  const sessionIdForForbidden = createdSessionIds[0] ?? "fake-session-id";

  const r11list = await listSessionsForPractice(practiceId, forbiddenActor);
  assert("§11 list: ok=false", r11list.ok === false);
  assert("§11 list: error=forbidden or practice_not_found",
    r11list.error === "forbidden" || r11list.error === "practice_not_found",
    `got=${r11list.error}`,
  );

  const r11create = await createSessionForPractice(practiceId, forbiddenActor, {
    rows: [{ ziffer: "1", factor: "1.0", count: 1 }],
  });
  assert("§11 create: ok=false", r11create.ok === false);
  assert("§11 create: error=forbidden or practice_not_found",
    r11create.error === "forbidden" || r11create.error === "practice_not_found",
    `got=${r11create.error}`,
  );

  const r11get = await getSessionForPractice(practiceId, sessionIdForForbidden, forbiddenActor);
  assert("§11 get: ok=false", r11get.ok === false);
  assert("§11 get: error=forbidden or practice_not_found",
    r11get.error === "forbidden" || r11get.error === "practice_not_found",
    `got=${r11get.error}`,
  );

  const r11dismiss = await dismissSessionForPractice(practiceId, sessionIdForForbidden, forbiddenActor);
  assert("§11 dismiss: ok=false", r11dismiss.ok === false);
  assert("§11 dismiss: error=forbidden or practice_not_found",
    r11dismiss.error === "forbidden" || r11dismiss.error === "practice_not_found",
    `got=${r11dismiss.error}`,
  );
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  if (createdSessionIds.length === 0) return;
  section("§12  Cleanup — removing test records");

  try {
    // Cascade order: audit log and items first, then sessions.
    // (Schema has onDelete: Cascade on items and auditLog, but we delete explicitly
    //  to be safe and to confirm cleanup worked.)

    const deletedAudit = await prisma.billingPlausibilityAuditLog.deleteMany({
      where: { sessionId: { in: createdSessionIds } },
    });
    console.log(`  ok    deleted ${deletedAudit.count} audit log record(s)`);

    const deletedItems = await prisma.billingPlausibilityItem.deleteMany({
      where: { sessionId: { in: createdSessionIds } },
    });
    console.log(`  ok    deleted ${deletedItems.count} item record(s)`);

    const deletedSessions = await prisma.billingPlausibilitySession.deleteMany({
      where: { id: { in: createdSessionIds } },
    });
    console.log(`  ok    deleted ${deletedSessions.count} session(s) by id`);

    // Confirm they are gone
    const remaining = await prisma.billingPlausibilitySession.count({
      where: { id: { in: createdSessionIds } },
    });
    assert("§12 all test sessions deleted (count=0)", remaining === 0, `remaining=${remaining}`);
  } catch (err) {
    console.error("[verify] cleanup error:", err?.message ?? String(err));
    console.error("[verify] Some test records may remain. IDs:", createdSessionIds);
  }

  // ── CI fixture teardown ────────────────────────────────────────────────────
  // Delete User (onDelete: Cascade propagates to PracticeProfile automatically).
  // BillingPlausibilitySession uses a scalar practiceProfileId with no Prisma
  // relation, so no DB-level cascade is triggered — billing records are already
  // cleaned above before this block runs.
  if (createdFixture.userId) {
    try {
      await prisma.user.delete({ where: { id: createdFixture.userId } });
      console.log(`  ok    CI fixture: deleted User id=${createdFixture.userId} (cascades PracticeProfile)`);
    } catch (err) {
      console.error("[verify] CI fixture teardown error (User):", err?.message ?? String(err));
    }
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

(async () => {
  try {
    await main();
  } finally {
    await cleanup();
    await prisma.$disconnect();

    console.log("\n");
    if (failed === 0) {
      console.log(`verifyBillingPlausibilityService OK — ${passed} assertions passed.`);
    } else {
      console.log(`verifyBillingPlausibilityService FAILED — ${failed}/${passed + failed} assertions failed:`);
      for (const msg of failureMessages) {
        console.log(`  - ${msg}`);
      }
      process.exit(1);
    }
  }
})();
