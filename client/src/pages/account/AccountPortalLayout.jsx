import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import { readUserMode, writeUserMode, USER_MODES } from "../../utils/userMode.js";
import "../../styles/AccountPortal.css";

export default function AccountPortalLayout() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [mode, setMode] = useState(() => readUserMode());

  const t = useMemo(() => {
    const m = getMessages(language);
    return m.accountPortal ?? getMessages("en").accountPortal;
  }, [language]);

  useEffect(() => {
    setMode(readUserMode());
    const onMode = () => setMode(readUserMode());
    window.addEventListener("medscoutx_user_mode_changed", onMode);
    return () => window.removeEventListener("medscoutx_user_mode_changed", onMode);
  }, []);

  const isPractice = mode === USER_MODES.PRACTICE;

  const links = useMemo(() => {
    if (isPractice) {
      return [
        { to: "/account", end: true, label: t.navHome },
        { to: "/settings/practices", label: t.navPracticeProfiles },
        { to: "/practice/dashboard", label: t.navPracticeDashboard },
        { to: "/pre-visit/follow-ups", label: t.navFollowUps },
        { to: "/account/profiles", label: t.navProfiles },
        { to: "/account/data", label: t.navData },
        { to: "/settings/privacy", label: t.navPrivacyShort },
      ];
    }
    return [
      { to: "/account", end: true, label: t.navHome },
      { to: "/account/documents", label: t.navDocuments },
      { to: "/pre-visit/cases", label: t.navTimelines },
      { to: "/account/doctors", label: t.navDoctors },
      { to: "/account/personal", label: t.navPersonal },
      { to: "/account/health", label: t.navHealthProfile },
      { to: "/account/profiles", label: t.navProfiles },
      { to: "/account/data", label: t.navData },
      { to: "/pre-visit/follow-ups", label: t.navFollowUps },
      // Real account actions (export, deletion) — not a legal text. It used to
      // hang below the sidebar in the legal block; the legal block is gone, the
      // function is not.
      { to: "/settings/privacy", label: t.navPrivacyShort },
    ];
  }, [isPractice, t]);

  return (
    <div className="account-portal">
      <div className="account-portal__mode-strip">
        <label className="account-portal__mode-field">
          <span className="account-portal__mode-label">{t.switchArea}</span>
          <select
            className="account-portal__mode-select"
            value={mode}
            onChange={(e) => {
              const v = e.target.value;
              writeUserMode(v);
              setMode(readUserMode());
              navigate(v === USER_MODES.PRACTICE ? "/practice" : "/patient", {
                replace: false,
              });
            }}
            aria-label={t.switchArea}
          >
            <option value={USER_MODES.PATIENT}>{t.switchPatient}</option>
            <option value={USER_MODES.PRACTICE}>{t.switchPractice}</option>
          </select>
        </label>
        <p className="account-portal__mode-hint">{t.switchHint}</p>
      </div>

      <div className="account-portal__shell">
        <aside className="account-portal__nav-wrap" aria-label={t.title}>
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
        </aside>
        <div className="account-portal__main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
