/**
 * Practice mark.
 *
 * Uses the practice's OWN uploaded logo when one exists. When it does not, the
 * fallback is the practice's initials on a neutral surface — never a generated
 * logo and never a per-practice colour, which would read as an identity the
 * practice never chose.
 *
 * Decorative: the practice name is already in the card's accessible name, so
 * repeating it here would make screen readers say it twice.
 *
 * @param {{ practice: { displayName?: string, logoUrl?: string | null } | null }} props
 */
export default function PracticeAvatar({ practice }) {
  const name = String(practice?.displayName || "").trim();

  if (practice?.logoUrl) {
    return (
      <img className="practice-avatar practice-avatar--logo" src={practice.logoUrl} alt="" aria-hidden="true" />
    );
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <span className="practice-avatar" aria-hidden="true">
      {initials || "—"}
    </span>
  );
}
