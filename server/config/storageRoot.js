/**
 * Where files that must survive a deploy are kept.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THIS FILE EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Five services wrote files, and every one of them defaulted to a directory
 * inside the application checkout:
 *
 *     <checkout>/server/storage/practice-documents
 *     <checkout>/server/storage/vaccination-documents
 *     <checkout>/server/storage/user-avatars
 *     <checkout>/server/storage/practice-logos
 *     <checkout>/server/storage/exports
 *
 * The Render service has no persistent disk — verified in the dashboard, not
 * inferred. Render replaces the checkout on every deploy, so those five paths
 * are ephemeral: a patient's uploaded vaccination certificate, a practice's
 * shared report, and an account's data export all disappear at the next
 * release, silently and without an error anywhere.
 *
 * Nothing in the code said so. Two comments said the opposite was intended —
 * "Production: replace with object storage" — but intent is not configuration,
 * and the default quietly kept working in development, which is exactly how a
 * gap like this survives.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE RULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   production   STORAGE_ROOT must be set, and must be an absolute path
 *                outside the checkout. Missing → startup fails.
 *   development  a local directory under the repo is fine and is the default.
 *   test         same, or a scratch directory via the per-service override.
 *
 * Failing closed is the point. The alternative — falling back to the checkout
 * in production — is what this file exists to make impossible, because that
 * failure is invisible until someone asks for a document that is no longer
 * there.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ONE ROOT, NOT FIVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every service resolves a named subdirectory of the same root, so a disk
 * mounted once covers all of them. Five independent variables would let a
 * deployment end up with vaccination documents on a disk and practice
 * documents on the ephemeral filesystem — the same bug, harder to see.
 *
 * The per-service `*_STORAGE_DIR` overrides remain, because tests need to
 * point one service at a scratch directory without touching the others. They
 * are for development and tests; production sets the root.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHAT THIS IS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A persistent disk is one machine's disk. It does not make the application
 * multi-instance: two Render instances would each see their own. The app
 * already assumes one instance elsewhere (in-memory rate limiters), so this
 * changes nothing about that — but it does mean the single-instance
 * constraint is now load-bearing for patient data, which is a bigger deal
 * than it was for a rate limit counter. Object storage is the way out, and it
 * is deliberately not built here.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The variable an operator sets. Absolute path to a persistent volume. */
export const STORAGE_ROOT_ENV = "STORAGE_ROOT";

/**
 * The development fallback: the same place the five services used before.
 *
 * Keeping it means a developer clones the repo and everything works, which is
 * why it existed. It is only ever reached when NODE_ENV is not production.
 */
const DEVELOPMENT_ROOT = path.resolve(__dirname, "../storage");

/** Subdirectory names, so the layout is stated once and cannot drift. */
export const STORAGE_AREAS = Object.freeze({
  PRACTICE_DOCUMENTS: "practice-documents",
  VACCINATION_DOCUMENTS: "vaccination-documents",
  USER_AVATARS: "user-avatars",
  PRACTICE_LOGOS: "practice-logos",
  EXPORTS: "exports",
});

/** @param {NodeJS.ProcessEnv} env */
const configured = (env) => String(env?.[STORAGE_ROOT_ENV] ?? "").trim();

/**
 * Problems with the storage configuration, in the shape startup validation
 * already consumes for rate limits.
 *
 * Returns messages rather than throwing, so one startup reports every gap at
 * once instead of one per restart.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]} empty when the configuration is sound
 */
export function getStorageConfigProblems(env = process.env) {
  if (env?.NODE_ENV !== "production") return [];

  const root = configured(env);
  if (!root) {
    return [
      `${STORAGE_ROOT_ENV} is not set. Patient documents, exports and avatars ` +
        "would be written into the deploy checkout and lost on the next release. " +
        "Point it at a mounted persistent disk.",
    ];
  }
  if (!path.isAbsolute(root)) {
    return [
      `${STORAGE_ROOT_ENV} must be an absolute path; got a relative one. ` +
        "A relative path resolves against the working directory, which is inside " +
        "the deploy checkout.",
    ];
  }
  // A root inside the checkout is the exact mistake this file prevents, and it
  // is an easy one to make by writing `./storage` or the repo path by hand.
  const checkout = path.resolve(__dirname, "..", "..");
  const resolved = path.resolve(root);
  if (resolved === checkout || resolved.startsWith(checkout + path.sep)) {
    return [
      `${STORAGE_ROOT_ENV} points inside the application checkout, which is ` +
        "replaced on every deploy. It must be a mounted persistent volume.",
    ];
  }
  return [];
}

/**
 * The absolute directory for one storage area.
 *
 * @param {string} area one of STORAGE_AREAS
 * @param {string} [override] a per-service `*_STORAGE_DIR`, honoured as-is
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function storageAreaRoot(area, override = "", env = process.env) {
  const explicit = String(override ?? "").trim();
  if (explicit) return explicit;

  const root = configured(env);
  if (root) return path.join(root, area);

  // Production never reaches here: getStorageConfigProblems() has already
  // stopped startup. This is the development path.
  return path.join(DEVELOPMENT_ROOT, area);
}

/**
 * Whether a persistent root is configured — a boolean, never the path.
 *
 * A storage root is not a secret, but an absolute internal filesystem path is
 * still infrastructure detail that a health endpoint has no reason to hand to
 * anyone who asks. The question a monitor needs answered is "is this deploy
 * configured to keep files", and that is a yes or a no.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isPersistentStorageConfigured(env = process.env) {
  return configured(env).length > 0;
}
