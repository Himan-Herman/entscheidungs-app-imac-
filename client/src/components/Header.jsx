// client/src/components/Header.jsx
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, LogOut, Menu } from "lucide-react";
import logo from "../assets/img/medscout-logo.png";
import { useLanguage } from "../i18n/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";
import "../styles/Header.css";

export default function Header() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { language } = useLanguage();

  // 🔐 ist der Nutzer eingeloggt?
  const isLoggedIn = !!localStorage.getItem("medscout_token");
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
      };

  function handleLogout() {
    // Token & User löschen
    localStorage.removeItem("medscout_token");
    localStorage.removeItem("medscout_user_id");

    // optional: Thread-IDs aufräumen
    localStorage.removeItem("symptom_thread_id");
    localStorage.removeItem("koerper_thread_id");
    localStorage.removeItem("textsymptom_thread_id");

    // Menü schließen
    setOpen(false);

    // Zur Login-Seite
    navigate("/login", { replace: true });
  }

  return (
    <>
      <a className="skip-link" href="#main">{copy.skip}</a>
      <header className="ms-header" role="banner">
        <div className="ms-header__inner">
          <button
            className="ms-logo"
            onClick={() => navigate("/startseite")}
            aria-label={copy.homeAria}
          >
            <img src={logo} alt="MedScout Logo" />
            <span className="ms-logo__copy">
              <span className="ms-logo__title">MedScoutX</span>
              <span className="ms-logo__subtitle">{copy.appLabel}</span>
            </span>
          </button>

          <div className="ms-header__language">
            <LanguageSwitcher label={copy.language} compact />
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
                  to="/startseite"
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
