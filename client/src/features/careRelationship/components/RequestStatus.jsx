/**
 * A request's status: always a word, with a small shape as a second cue —
 * never colour alone. Open (ring), in progress (half), done (tick),
 * declined (bar).
 */
export default function RequestStatus({ status, label }) {
  const glyph = {
    submitted: <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />,
    in_review: (
      <>
        <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 2.75a5.25 5.25 0 0 1 0 10.5z" fill="currentColor" />
      </>
    ),
    completed: (
      <>
        <circle cx="8" cy="8" r="6" fill="currentColor" />
        <path d="M5.3 8.2l1.8 1.8 3.6-3.8" fill="none" stroke="var(--dc-on-status, #fff)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    rejected: (
      <>
        <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 8h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  }[status];
  return (
    <span className={`dc-status dc-status--${status}`}>
      {glyph ? (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">{glyph}</svg>
      ) : null}
      {label}
    </span>
  );
}
