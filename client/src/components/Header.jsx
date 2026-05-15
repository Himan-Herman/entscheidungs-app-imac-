import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BookUser,
  Building2,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  SunMedium,
  UserRound,
} from "lucide-react";
import logo from "../assets/img/medscout-logo.png";
import { useLanguage } from "../i18n/LanguageContext";
import { useTheme } from "../ThemeMode";
import GlobalLanguageSelector from "./language/GlobalLanguageSelector";
import { getMessages } from "../i18n/translations";
import { authFetch } from "../api/authFetch.js";
import { HEADER_SELECTABLE_LOCALE_CODES } from "../i18n/localeConfig";
import { readUserMode, writeUserMode, USER_MODES } from "../utils/userMode.js";
import "../styles/Header.css";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [userMode, setUserMode] = useState(() => readUserMode());
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const copy = useMemo(() => getMessages(language).header, [language]);

  const isLoggedIn = !!localStorage.getItem("medscout_token");
  const isPractice = isLoggedIn && userMode === USER_MODES.PRACTICE;
  const homePath = !isLoggedIn
    ? "/"
    : isPractice
      ? "/practice"
      : "/patient";
  const themeLabel = theme === "dark" ? copy.themeLight : copy.themeDark;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setUserMode(readUserMode());
    const onMode = () => setUserMode(readUserMode());
    window.addEventListener("medscoutx_user_mode_changed", onMode);
    return () => window.removeEventListener("medscoutx_user_mode_changed", onMode);
  }, [location.pathname]);

  async function handleLogout() {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* still clear local session */
    }
    localStorage.removeItem("medscout_token");
    localStorage.removeItem("medscout_user_id");
    localStorage.removeItem("symptom_thread_id");
    localStorage.removeItem("koerper_thread_id");
    localStorage.removeItem("textsymptom_thread_id");
    setOpen(false);
    navigate("/login", { replace: true });
  }

  return (
    <>
      <a className="skip-link" href="#main">
        {copy.skip}
      </a>
      <header className="ms-header" role="banner">
        <div className="ms-header__inner">
          <button
            className="ms-logo"
            onClick={() => navigate(homePath)}
            aria-label={copy.homeAria}
          >
            <span className="ms-logo__mark">
              <img src={logo} alt="" />
            </span>
            <span className="ms-logo__copy">
              <span className="ms-logo__title">MedScoutX</span>
              <span className="ms-logo__subtitle">{copy.appLabel}</span>
            </span>
          </button>

          <div className="ms-header__controls">
            {isLoggedIn && (
              <label className="ms-header__mode">
                <span className="visually-hidden">{copy.switchArea}</span>
                <select
                  className="ms-header__mode-select"
                  value={userMode}
                  onChange={(e) => {
                    const v = e.target.value;
                    writeUserMode(v);
                    setUserMode(readUserMode());
                    navigate(
                      v === USER_MODES.PRACTICE ? "/practice" : "/patient",
                      { replace: false },
                    );
                  }}
                  aria-label={copy.switchArea}
                >
                  <option value={USER_MODES.PATIENT}>{copy.switchPatient}</option>
                  <option value={USER_MODES.PRACTICE}>{copy.switchPractice}</option>
                </select>
              </label>
            )}

            <button
              type="button"
              className="ms-theme-toggle"
              onClick={toggleTheme}
              aria-label={themeLabel}
              title={themeLabel}
            >
              {theme === "dark" ? (
                <SunMedium size={18} aria-hidden="true" />
              ) : (
                <Moon size={18} aria-hidden="true" />
              )}
            </button>

            <div className="ms-header__language">
              <GlobalLanguageSelector
                label={copy.languageLabel}
                compact
                selectableLocaleCodes={HEADER_SELECTABLE_LOCALE_CODES}
              />
            </div>
          </div>

          <button
            className="ms-nav-toggle"
            aria-controls="hauptnavigation"
            aria-expanded={open ? "true" : "false"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="visually-hidden">{copy.navToggle}</span>
            <Menu size={18} aria-hidden="true" />
          </button>

          <nav
            id="hauptnavigation"
            className={`ms-nav ${open ? "is-open" : ""}`}
            aria-label={copy.nav}
          >
            <ul>
              <li>
                <NavLink
                  to={homePath}
                  className={({ isActive }) =>
                    `ms-nav-item ${isActive ? "is-active" : ""}`.trim()
                  }
                  onClick={() => setOpen(false)}
                >
                  <Home size={16} aria-hidden="true" />
                  <span>{copy.home}</span>
                </NavLink>
              </li>

              {isLoggedIn && (
                <li>
                  <NavLink
                    to="/account"
                    className={({ isActive }) =>
                      `ms-nav-item ${isActive ? "is-active" : ""}`.trim()
                    }
                    onClick={() => setOpen(false)}
                    aria-label={copy.accountPortalAria}
                  >
                    <UserRound size={16} aria-hidden="true" />
                    <span>{copy.accountPortal}</span>
                  </NavLink>
                </li>
              )}

              {isLoggedIn && !isPractice && (
                <li>
                  <NavLink
                    to="/pre-visit/cases"
                    className={({ isActive }) =>
                      `ms-nav-item ${isActive ? "is-active" : ""}`.trim()
                    }
                    onClick={() => setOpen(false)}
                    aria-label={copy.preVisitCasesAria}
                  >
                    <History size={16} aria-hidden="true" />
                    <span>{copy.preVisitCases}</span>
                  </NavLink>
                </li>
              )}

              {isLoggedIn && isPractice && (
                <li>
                  <NavLink
                    to="/practice/dashboard"
                    className={({ isActive }) =>
                      `ms-nav-item ${isActive ? "is-active" : ""}`.trim()
                    }
                    onClick={() => setOpen(false)}
                    aria-label={copy.practiceDashboard}
                  >
                    <LayoutDashboard size={16} aria-hidden="true" />
                    <span>{copy.practiceDashboard}</span>
                  </NavLink>
                </li>
              )}

              {isLoggedIn && isPractice && (
                <li>
                  <NavLink
                    to="/settings/practices"
                    className={({ isActive }) =>
                      `ms-nav-item ${isActive ? "is-active" : ""}`.trim()
                    }
                    onClick={() => setOpen(false)}
                    aria-label={copy.settingsPracticesAria}
                  >
                    <Building2 size={16} aria-hidden="true" />
                    <span>{copy.settingsPractices}</span>
                  </NavLink>
                </li>
              )}

              {isLoggedIn && !isPractice && (
                <li>
                  <NavLink
                    to="/settings/doctor-contacts"
                    className={({ isActive }) =>
                      `ms-nav-item ${isActive ? "is-active" : ""}`.trim()
                    }
                    onClick={() => setOpen(false)}
                    aria-label={copy.settingsDoctorContactsAria}
                  >
                    <BookUser size={16} aria-hidden="true" />
                    <span>{copy.settingsDoctorContacts}</span>
                  </NavLink>
                </li>
              )}

              {isLoggedIn && (
                <li>
                  <NavLink
                    to="/settings/privacy"
                    className={({ isActive }) =>
                      `ms-nav-item ${isActive ? "is-active" : ""}`.trim()
                    }
                    onClick={() => setOpen(false)}
                    aria-label={copy.settingsPrivacyAria}
                  >
                    <span>{copy.settingsPrivacy}</span>
                  </NavLink>
                </li>
              )}

              {isLoggedIn && (
                <li>
                  <button
                    type="button"
                    className="ms-nav-item ms-nav-item--button"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    <span>{copy.logout}</span>
                  </button>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
