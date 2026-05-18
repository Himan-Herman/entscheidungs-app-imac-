/**
 * Neutral unread count badge — number only, no content details.
 */
export default function InboxCountBadge({ count, label }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  const display = n > 99 ? "99+" : String(n);
  return (
    <span className="inbox-count-badge" aria-label={label?.replace("{count}", display) || display}>
      {display}
    </span>
  );
}
