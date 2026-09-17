/**
 * The recording limit, restated for the browser.
 *
 * The server owns this number — it is where it is enforced and where it is
 * justified. The browser knows it only so it can stop a recorder before
 * producing audio the server would refuse, which turns a wasted upload and an
 * error message into nothing happening at all.
 *
 * If the two ever disagree, the server wins and the user sees a refusal. That
 * is the right way round.
 */
export const MAX_DICTATION_SECONDS = 90;
