import { Link } from "react-router-dom";
import PracticeAvatar from "./PracticeAvatar.jsx";
import { patientContextLabel } from "../lib/patientContextLabel.js";

/**
 * One connected practice.
 *
 * The whole card is one link — a large, single target for touch and one stop for
 * keyboard and screen reader users, rather than a card with a small chevron
 * hidden in the corner. Everything a screen reader needs is in the accessible
 * name, so it is announced once and completely.
 *
 * @param {{
 *   context: object,
 *   t: Record<string, string>,
 *   href: string,
 * }} props
 */
export default function PracticeCard({ context, t, href }) {
  const { practice, unreadCount, isActive } = context;
  const name = practice?.displayName || t.unnamedPractice;

  const details = [practice?.specialty, practice?.city].filter(Boolean).join(" · ");
  // Two relationships with one practice look alike down to the city, so this is
  // the only thing on the card that tells them apart.
  const forWhom = patientContextLabel(context.patientProfileName, t);

  // Announced instead of the visual composition: name, then what matters.
  const accessibleName = [
    name,
    // Second, right after the practice: a screen reader user must not have to
    // listen to specialty and city before learning whose relationship this is.
    forWhom,
    practice?.specialty,
    practice?.city,
    unreadCount > 0 ? t.unreadAria.replace("{count}", String(unreadCount)) : null,
    !isActive ? t.statusFormer : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li className="practice-card__item">
      <Link
        to={href}
        className={`practice-card${isActive ? "" : " practice-card--former"}`}
        aria-label={accessibleName}
      >
        <PracticeAvatar practice={practice} />

        <span className="practice-card__body">
          <span className="practice-card__name">{name}</span>
          <span className="practice-card__for">{forWhom}</span>
          {details ? <span className="practice-card__details">{details}</span> : null}
          {!isActive ? (
            <span className="practice-card__status">{t.statusFormer}</span>
          ) : null}
        </span>

        {unreadCount > 0 ? (
          // Never colour alone: the badge carries its own number and the
          // accessible name spells it out in words.
          <span className="practice-card__badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount} {t.unreadShort}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
