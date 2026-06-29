import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import deRoleEntry from "../i18n/translations/de/roleEntry.js";
import enRoleEntry from "../i18n/translations/en/roleEntry.js";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import InboxCountBadge from "../components/InboxCountBadge.jsx";
import PatientCardInfoModal from "./PatientCardInfoModal.jsx";
import {
  PATIENT_CARD_INFO,
  hasPatientCardInfo,
  suppressTileNavigation,
} from "./patientCardInfo.js";

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
  const { language } = useLanguage();
  const tInfo = useMemo(
    () => getMessages(language).patientCardInfo || getMessages("en").patientCardInfo,
    [language],
  );
  const [infoOpenFor, setInfoOpenFor] = useState(null);
  const activeInfo = infoOpenFor ? PATIENT_CARD_INFO[infoOpenFor] : null;

  return (
    <>
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
          const tile = (
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

          if (!hasPatientCardInfo(link.key)) return tile;

          const info = PATIENT_CARD_INFO[link.key];
          return (
            <div key={link.to} className="workspace-hub__tile-wrap">
              {tile}
              <button
                type="button"
                className="workspace-hub__tile-info"
                aria-label={tInfo[info.buttonKey]}
                aria-haspopup="dialog"
                onClick={(e) => {
                  suppressTileNavigation(e);
                  setInfoOpenFor(link.key);
                }}
              >
                <Info size={16} aria-hidden />
              </button>
            </div>
          );
        })}
      </nav>

      {activeInfo ? (
        <PatientCardInfoModal
          open
          titleId={activeInfo.titleId}
          title={tInfo[activeInfo.titleKey]}
          paragraphs={activeInfo.paragraphKeys.map((k) => tInfo[k])}
          closeLabel={tInfo.close}
          onClose={() => setInfoOpenFor(null)}
        />
      ) : null}
    </>
  );
}
