import { displayStatus } from "../lib/dataRequestStatus.js";

/**
 * A request's status: always a word, with a small neutral shape as a second
 * cue — never colour alone. Ring = new, half = in progress, tick in a ring =
 * answered. The tick means "there is an answer", not "request granted", so it
 * is drawn quietly in the text colour, not as a green success mark.
 */
export default function RequestStatus({ status, label }) {
  const s = displayStatus(status);
  const glyph = {
    submitted: <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />,
    in_review: (
      <>
        <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 2.75a5.25 5.25 0 0 1 0 10.5z" fill="currentColor" />
      </>
    ),
    answered: (
      <>
        <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.6 8.1l1.6 1.6 3.2-3.4" fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  }[s];
  return (
    <span className={`dc-status dc-status--${s}`}>
      {glyph ? (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">{glyph}</svg>
      ) : null}
      {label}
    </span>
  );
}
