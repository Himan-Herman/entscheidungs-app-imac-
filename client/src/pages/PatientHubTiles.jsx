import { Link } from "react-router-dom";
import deRoleEntry from "../i18n/translations/de/roleEntry.js";
import enRoleEntry from "../i18n/translations/en/roleEntry.js";
import InboxCountBadge from "../components/InboxCountBadge.jsx";

/** Subtitle copy — DE/EN source files so keys are never missing after partial i18n overrides. */
export function hubTileSubtitle(roleEntry, subtitleKey) {
  if (!subtitleKey) return "";
  return (
    roleEntry[subtitleKey] ||
    enRoleEntry[subtitleKey] ||
    deRoleEntry[subtitleKey] ||
    ""
  );
}

/**
 * @param {{
 *   links: import('./patientHubLinks.js').PatientHubLink[];
 *   t: Record<string, string>;
 *   navAriaLabel: string;
 *   inboxUnread?: number;
 *   inboxBadgeLabel?: string;
 * }} props
 */
export default function PatientHubTiles({
  links,
  t,
  navAriaLabel,
  inboxUnread = 0,
  inboxBadgeLabel = "",
}) {
  return (
    <nav className="workspace-hub__grid" aria-label={navAriaLabel}>
      {links.map((link) => {
        const subtitle = link.subtitleKey ? hubTileSubtitle(t, link.subtitleKey) : "";
        const TileIcon = link.icon;
        const tileClass = ["workspace-hub__tile", link.tileClass || ""]
          .filter(Boolean)
          .join(" ");
        const ariaLabel =
          link.ariaKey && t[link.ariaKey]
            ? t[link.ariaKey]
            : subtitle
              ? `${t[link.key]}. ${subtitle}`
              : t[link.key];
        return (
          <Link
            key={link.to}
            className={tileClass}
            to={link.to}
            aria-label={ariaLabel}
          >
            <span className="workspace-hub__tile-icon" aria-hidden>
              <TileIcon size={22} strokeWidth={1.75} />
            </span>
            <span className="workspace-hub__tile-label">
              {t[link.key]}
              {link.key === "hubLinkInbox" ? (
                <InboxCountBadge count={inboxUnread} label={inboxBadgeLabel} />
              ) : null}
            </span>
            {subtitle ? (
              <span className="workspace-hub__tile-sub">{subtitle}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
