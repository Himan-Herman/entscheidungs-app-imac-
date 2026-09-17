/**
 * Storing an e-mail verification or password reset token.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 * These two were written to the database exactly as they were mailed out, and
 * the code said so: "Verifikations-Token setzen (Plain in verifyToken)". Anyone
 * who reaches the rows — a backup, a dump, a read-only replica, a query that
 * returns more than it meant to — can complete a password reset for any
 * account. The token IS the credential for that one step.
 *
 * Expiry (one hour) and single use were already enforced, and they still are.
 * They limit the window; they do not stop someone who is reading the table.
 *
 * ── The fix ─────────────────────────────────────────────────────────────────
 * The plaintext goes in the mail and nowhere else. What is stored is its
 * SHA-256, and a lookup hashes the incoming value the same way. This is the
 * convention the repository already uses for connect codes and secure document
 * tokens; there is no reason these two were the exception.
 *
 * SHA-256 without a salt is deliberate and correct here: the input is 32 bytes
 * of CSPRNG output, so there is nothing to brute-force and nothing to
 * rainbow-table. A slow KDF would only make every verification slower.
 *
 * The column is `text`, so nothing about the schema changes.
 */
import crypto from "crypto";

/**
 * @param {string} plain the token as it was mailed
 * @returns {string} the value to store and to look up by
 */
export function hashAuthToken(plain) {
  return crypto.createHash("sha256").update(String(plain), "utf8").digest("hex");
}

/**
 * Finding the row a token belongs to, across the change in how they are stored.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Tokens used to be stored exactly as they were mailed. They are now stored as
 * a SHA-256. A verification link is valid for 24 hours and a reset link for
 * one, so at the moment the new code goes live there are rows in the database
 * holding plaintext tokens that people have already been sent and have not yet
 * used. Looking those up by hash finds nothing, and the person following the
 * link is simply told it is invalid — on the reset path, that locks them out
 * of their own account for no reason they can see.
 *
 * ── What this does ──────────────────────────────────────────────────────────
 * The hash is tried first, because that is what every new row holds. Only if
 * that finds nothing is the raw value compared — which is exactly what the old
 * code did, against rows that are already plaintext. It cannot match a new row
 * (those hold a hash, and the incoming value is not one), it applies the same
 * expiry condition, and the caller clears the token afterwards as before, so
 * single use is unaffected.
 *
 * ── When to remove it ───────────────────────────────────────────────────────
 * Once every pre-deploy token has expired — 24 hours after the deploy that
 * introduced hashing — this fallback matches nothing and can be deleted. It is
 * kept as a separate, named function so that removal is a one-line change and
 * nobody has to reconstruct the reason first.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} plain the token as it arrived from the user
 * @param {{ tokenField: string, expiryField: string }} fields
 * @returns {Promise<object|null>}
 */
export async function findUserByAuthToken(prisma, plain, { tokenField, expiryField }) {
  const notExpired = { [expiryField]: { gt: new Date() } };

  const byHash = await prisma.user.findFirst({
    where: { [tokenField]: hashAuthToken(plain), ...notExpired },
  });
  if (byHash) return byHash;

  // Legacy rows only: written by the previous code, still inside their own
  // lifetime. Nothing is re-stored in clear here.
  return prisma.user.findFirst({
    where: { [tokenField]: String(plain), ...notExpired },
  });
}
