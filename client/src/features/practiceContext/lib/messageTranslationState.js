/**
 * Which translation belongs to which message, on the client.
 *
 * ── Why the key is not the message id ───────────────────────────────────────
 * A translation is a translation of a particular wording in a particular
 * language. Keying it by message id alone would mean that correcting a message
 * leaves the old translation attached to the new text — the reader would see
 * one thing in the original and something else beside it, both presented as the
 * same message.
 *
 * So the key carries all three: which message, which state of it, and which
 * language. The state is the fingerprint the server computed; the client never
 * derives one of its own, because two implementations of the same hash are two
 * chances to disagree.
 */

/**
 * The renderings a message can have. Mirrors the server's modes.
 *
 * A faithful translation and a plainer rewrite are different answers to
 * different questions, and neither may ever stand in for the other.
 */
export const RENDERING_MODES = Object.freeze({ NORMAL: "normal", SIMPLE: "simple" });

/**
 * @param {{id: string, body?: string, editedAt?: string | null}} message
 * @param {string} targetLanguage
 * @param {string} [fingerprint] the server's fingerprint, when one is known
 * @param {string} [mode] which rendering
 */
export function translationKey(message, targetLanguage, fingerprint, mode = RENDERING_MODES.NORMAL) {
  // Before the first answer there is no fingerprint yet. `editedAt` stands in
  // for it: it changes on every edit, which is the only thing this key has to
  // survive. The server's value replaces it as soon as one arrives.
  const version = fingerprint || (message?.editedAt ? String(message.editedAt) : "original");
  return `${message?.id ?? ""}|${version}|${targetLanguage ?? ""}|${mode}`;
}

/**
 * The translation to show for this message, or null.
 *
 * Returns nothing when the message has since been edited or withdrawn: a
 * translation whose key no longer matches describes text that is not on screen.
 *
 * @param {Record<string, {status: string, text?: string, sourceLanguage?: string|null}>} byKey
 * @param {{id: string, editedAt?: string | null, withdrawnAt?: string | null}} message
 * @param {string} targetLanguage
 * @param {string} [mode]
 */
export function translationFor(byKey, message, targetLanguage, mode = RENDERING_MODES.NORMAL) {
  if (!message || message.withdrawnAt) return null;
  return byKey?.[translationKey(message, targetLanguage, undefined, mode)] ?? null;
}

/**
 * Drops every entry for a message.
 *
 * Called when a message is edited or withdrawn. The stale entries would never
 * be found again — their key no longer matches — but leaving a translation of a
 * retracted sentence in memory is the same mistake as leaving it in a table.
 *
 * @param {Record<string, unknown>} byKey
 * @param {string} messageId
 */
export function forgetTranslationsOf(byKey, messageId) {
  if (!byKey || !messageId) return byKey ?? {};
  const prefix = `${messageId}|`;
  const next = {};
  let removed = false;
  for (const [key, value] of Object.entries(byKey)) {
    if (key.startsWith(prefix)) {
      removed = true;
      continue;
    }
    next[key] = value;
  }
  return removed ? next : byKey;
}

/** True when a message can be offered a translation at all. */
export function isTranslatable(message) {
  return Boolean(message?.id) && !message.withdrawnAt && Boolean(String(message.body ?? "").trim());
}
