import { NavLink, Outlet, Link } from "react-router-dom";
import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import "../../styles/AccountPortal.css";

export default function AccountPortalLayout() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.accountPortal ?? getMessages("en").accountPortal;
  }, [language]);
  const tf = useMemo(() => getMessages(language).footer, [language]);

  const links = [
    { to: "/account", end: true, label: t.navHome },
    { to: "/account/documents", label: t.navDocuments },
    { to: "/pre-visit/cases", label: t.navTimelines },
    { to: "/account/doctors", label: t.navDoctors },
    { to: "/account/personal", label: t.navPersonal },
    { to: "/account/profiles", label: t.navProfiles },
    { to: "/account/data", label: t.navData },
    { to: "/pre-visit/follow-ups", label: t.navFollowUps },
  ];

  return (
    <div className="account-portal">
      <div className="account-portal__shell">
        <aside className="account-portal__nav-wrap" aria-label="Account">
          <nav className="account-portal__nav">
            {links.map((l) => (
              <NavLink
                key={l.to + (l.end ? "-root" : "")}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `account-portal__nav-link${isActive ? " account-portal__nav-link--active" : ""}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <footer className="account-portal__legal">
            <p className="account-portal__legal-title">{t.legalSectionTitle}</p>
            <nav className="account-portal__legal-nav" aria-label={t.legalSectionTitle}>
              <Link to="/datenschutz">{tf.privacy}</Link>
              <Link to="/impressum">{tf.imprint}</Link>
              <Link to="/agb">{tf.terms}</Link>
              <Link to="/disclaimer">{tf.disclaimer}</Link>
              <Link to="/settings/privacy">{t.goPrivacy}</Link>
            </nav>
            <p className="account-portal__legal-note">{t.legalSupportNote}</p>
          </footer>
        </aside>
        <div className="account-portal__main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
