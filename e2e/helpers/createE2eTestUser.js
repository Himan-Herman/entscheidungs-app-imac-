/**
 * E2E fixture helper — thin wrapper around server/scripts/createE2eTestUser.js.
 *
 * Runs the actual fixture creator from the server directory so that
 * @prisma/client and bcryptjs (installed in server/node_modules) resolve correctly.
 *
 * ─── Usage (from repo root) ──────────────────────────────────────────────────
 *
 *   # Create a test user + practice (one-time local setup):
 *   node e2e/helpers/createE2eTestUser.js
 *
 *   # Pass explicit credentials:
 *   node e2e/helpers/createE2eTestUser.js \
 *     --email=e2e-billing-local@test.invalid \
 *     --password=MyLocalTestPw!
 *
 *   # Delete all fixture users (cleanup after testing):
 *   node e2e/helpers/createE2eTestUser.js --cleanup
 *
 * ─── Equivalent npm scripts (from repo root) ─────────────────────────────────
 *
 *   npm run e2e:fixture:create   # same as: node e2e/helpers/createE2eTestUser.js
 *   npm run e2e:fixture:cleanup  # same as: node e2e/helpers/createE2eTestUser.js --cleanup
 *
 * ─── Prerequisites ───────────────────────────────────────────────────────────
 *
 *   1. Server dependencies installed:
 *        cd server && npm ci
 *   2. Prisma client generated:
 *        cd server && npx prisma generate
 *   3. Migrations applied to local DB:
 *        cd server && npx prisma migrate deploy
 *   4. DATABASE_URL set (in server/.env or shell) pointing to a local/dev database.
 *
 * See server/scripts/createE2eTestUser.js for full documentation.
 */

import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const serverScript = join(__dirname, "../../server/scripts/createE2eTestUser.js");
const serverDir = join(__dirname, "../../server");

try {
  execFileSync(process.execPath, [serverScript, ...process.argv.slice(2)], {
    cwd: serverDir,
    stdio: "inherit",
    env: { ...process.env },
  });
} catch (err) {
  // execFileSync throws with { status } when the child exits non-zero.
  process.exit(err.status ?? 1);
}
