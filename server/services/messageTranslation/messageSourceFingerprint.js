/**
 * Binds a translation to ONE exact state of a message.
 *
 * The problem this solves is small and sharp: a translation is only a
 * translation OF something. If the sender corrects their message afterwards,
 * every earlier translation describes text the reader can no longer see, and
 * showing it would put words in the sender's mouth.
 *
 * A version table would answer that, and would then have to be kept in step
 * with every write path forever. A fingerprint answers it without a second
 * source of truth: it is computed from the message itself, so it changes
 * exactly when the message changes, and a stale translation simply stops
 * matching. There is nothing to invalidate and nothing that can drift.
 *
 * `editedAt` is included as well as the body, because an edited message and an
 * untouched one are shown differently even when the words coincide.
 */
import { createHash } from "node:crypto";

/**
 * NUL is used as the field separator: it cannot occur in a message body that
 * came through the messaging validation, so no text can impersonate a field
 * boundary and make two different messages hash alike.
 */
const SEP = "\u0000";

/**
 * @param {{ id: string, body: string, editedAt?: Date | string | null }} message
 * @returns {string} hex sha-256
 */
export function messageSourceFingerprint(message) {
  const editedAt = message?.editedAt ? new Date(message.editedAt).toISOString() : "";
  const material = [String(message?.id ?? ""), String(message?.body ?? ""), editedAt].join(SEP);
  return createHash("sha256").update(material, "utf8").digest("hex");
}
