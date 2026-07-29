/**
 * Release gate for the destructive practice-deletion paths.
 *
 * The lifecycle work made practice deletion and owner-account deletion
 * technically safe — contextual patient data is archived, grants and tokens
 * end, everything is transactional. What is NOT settled is retention law:
 * deleting a practice still physically deletes its documents, and whether that
 * is permissible is an open [rechtlich prüfen] question, not an engineering
 * one. Until it is answered, these paths stay off in every environment that
 * does not switch them on explicitly.
 *
 * This is a release gate, not authorization: the owner check and the
 * confirmation phrase stay in force regardless. And it is deliberately
 * stricter than the shared envFlag helper — ONLY the exact string "true"
 * enables it. Not "1", not "TRUE", not NODE_ENV, not demo mode, not localhost.
 * Tests enable it by setting the variable explicitly.
 */

export const DESTRUCTIVE_DELETION_ENV = "ENABLE_DESTRUCTIVE_PRACTICE_DELETION";

export const PRACTICE_DELETION_UNAVAILABLE = "practice_deletion_temporarily_unavailable";
export const OWNER_ACCOUNT_DELETION_UNAVAILABLE =
  "practice_owner_account_deletion_temporarily_unavailable";

/**
 * Whether the destructive paths are enabled. Exact-match on purpose: an
 * accidental truthy value ("yes", "1", a stray space) must not delete a
 * practice.
 *
 * @param {NodeJS.ProcessEnv} env
 */
export function isDestructivePracticeDeletionEnabled(env = process.env) {
  return env[DESTRUCTIVE_DELETION_ENV] === "true";
}

/**
 * Throws the stable practice-deletion code when the gate is closed.
 * @param {NodeJS.ProcessEnv} env
 */
export function assertDestructivePracticeDeletionEnabled(env = process.env) {
  if (!isDestructivePracticeDeletionEnabled(env)) {
    throw new Error(PRACTICE_DELETION_UNAVAILABLE);
  }
}
