import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, LogOut, Menu, Moon, SunMedium } from "lucide-react";
import logo from "../assets/img/medscout-logo.png";
import { useLanguage } from "../i18n/LanguageContext";
import { useTheme } from "../ThemeMode";
import LanguageSwitcher from "./LanguageSwitcher";
import "../styles/Header.css";

export default function Header() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const isLoggedIn = !!localStorage.getItem("medscout_token");
  const homePath = isLoggedIn ? "/startseite" : "/";
  const copy = language === "en"
      ? {
        skip: "Skip to content",
        homeAria: "Go to home page",
        navToggle: "Toggle navigation",
        nav: "Main navigation",
        appLabel: "Professional workspace",
        home: "Home",
        logout: "Log out",
        language: "Language",
        theme: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      }
    : {
        skip: "Zum Inhalt springen",
        homeAria: "Zur Startseite",
        navToggle: "Navigation umschalten",
        nav: "Hauptnavigation",
        appLabel: "Professioneller Bereich",
        home: "Home",
        logout: "Ausloggen",
        language: "Sprache",
        theme: theme === "dark" ? "Auf Hellmodus umschalten" : "Auf Dunkelmodus umschalten",
      };

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
            <img src={logo} alt="MedScout Logo" />
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
              aria-label={copy.theme}
              title={copy.theme}
            >
              {theme === "dark" ? <SunMedium size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>

            <div className="ms-header__language">
              <LanguageSwitcher label={copy.language} compact />
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
