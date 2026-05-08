import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { BookUser, Home, LogOut, Menu, Moon, SunMedium } from "lucide-react";
import logo from "../assets/img/medscout-logo.png";
import { useLanguage } from "../i18n/LanguageContext";
import { useTheme } from "../ThemeMode";
import GlobalLanguageSelector from "./language/GlobalLanguageSelector";
import { getMessages } from "../i18n/translations";
import "../styles/Header.css";

export default function Header() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const copy = useMemo(() => getMessages(language).header, [language]);

  const isLoggedIn = !!localStorage.getItem("medscout_token");
  const homePath = isLoggedIn ? "/startseite" : "/";
  const themeLabel = theme === "dark" ? copy.themeLight : copy.themeDark;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  function handleLogout() {
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
      <a className="skip-link" href="#main">{copy.skip}</a>
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
            <button
              type="button"
              className="ms-theme-toggle"
              onClick={toggleTheme}
              aria-label={themeLabel}
              title={themeLabel}
            >
              {theme === "dark" ? <SunMedium size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>

            <div className="ms-header__language">
              <GlobalLanguageSelector label={copy.languageLabel} compact />
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
