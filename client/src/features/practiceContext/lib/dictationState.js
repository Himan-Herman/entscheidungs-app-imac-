/**
 * The rules of dictating into a composer.
 *
 * Pure functions, so the two decisions that matter can be tested without a
 * microphone: what happens to text that is already in the composer, and which
 * transitions the recorder may make.
 *
 * ── The insertion rule ──────────────────────────────────────────────────────
 * A transcript never replaces what someone has written. Someone who typed two
 * sentences, then dictated a third, has not asked for the first two to
 * disappear — and losing them silently is the kind of small betrayal that stops
 * people trusting a feature. So the transcript is inserted at the caret if
 * there is one, appended if there is not, and the existing text always survives.
 */

/** The states a recorder can be in, and the only ones. */
export const DICTATION_STATES = Object.freeze({
  IDLE: "idle",
  REQUESTING: "requesting",
  RECORDING: "recording",
  PROCESSING: "processing",
  ERROR: "error",
});

/**
 * Where a transcript goes, given what the composer already holds.
 *
 * @param {string} existing current composer content
 * @param {string} transcript what was recognised
 * @param {{ start?: number, end?: number }} [caret] selection, when known
 * @returns {{ text: string, caret: number }} the new content and where to put
 *   the caret afterwards, so typing continues where the dictation ended
 */
export function insertTranscript(existing, transcript, caret) {
  const current = String(existing ?? "");
  const addition = String(transcript ?? "").trim();
  if (!addition) return { text: current, caret: current.length };
  if (!current) return { text: addition, caret: addition.length };

  const start = clamp(caret?.start, current.length);
  const end = clamp(caret?.end ?? caret?.start, current.length);

  const before = current.slice(0, start);
  const after = current.slice(end);

  // A space only where one is actually missing: dictating after "Guten Tag,"
  // should not produce "Guten Tag,ich", and dictating after "Guten Tag, "
  // should not produce two spaces.
  const needsLeading = before.length > 0 && !/\s$/.test(before);
  const needsTrailing = after.length > 0 && !/^\s/.test(after);
  const inserted = `${needsLeading ? " " : ""}${addition}${needsTrailing ? " " : ""}`;

  return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}

/** @param {unknown} value @param {number} max */
function clamp(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return max;
  return Math.min(Math.floor(n), max);
}

/**
 * Turns a browser or server failure into something a person can act on.
 *
 * A denied microphone is not an error the user should be asked to retry — it is
 * a decision they made, and the app's job is to say so plainly. Everything else
 * is worth trying again.
 *
 * @param {{ name?: string, status?: number, error?: string }} failure
 * @param {object} t translations
 */
export function dictationFailure(failure, t) {
  const name = failure?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return { message: t.micDenied, retryable: false };
  }
  if (name === "NotFoundError" || name === "NotReadableError") {
    return { message: t.micUnavailable, retryable: false };
  }
  // The feature is not available in this deployment: retrying repeats it.
  if (failure?.status === 503) return { message: t.dictationUnavailable, retryable: false };
  if (failure?.status === 413) return { message: t.dictationTooLong, retryable: false };
  return { message: t.dictationFailed, retryable: true };
}

/** Is a recorder in a state where the microphone is live? */
export function isCapturing(state) {
  return state === DICTATION_STATES.REQUESTING || state === DICTATION_STATES.RECORDING;
}

/**
 * May this actor dictate at all?
 *
 * Dictating is the first half of composing a message, so it is offered exactly
 * where writing is offered. A relationship that no longer accepts messages
 * shows no microphone — a composer that cannot send is not made useful by being
 * able to fill it by voice.
 */
export function canDictate({ isActiveRelationship, supported }) {
  return Boolean(isActiveRelationship) && Boolean(supported);
}
