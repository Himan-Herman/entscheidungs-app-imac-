// client/src/components/Header.jsx
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../assets/img/medscout-logo.png";
import "../styles/Header.css";

export default function Header() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // 🔐 ist der Nutzer eingeloggt?
  const isLoggedIn = !!localStorage.getItem("medscout_token");

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
      <a className="skip-link" href="#main">Zum Inhalt springen</a>
      <header className="ms-header" role="banner">
        <div className="ms-header__inner">
          <button
            className="ms-logo"
            onClick={() => navigate("/startseite")}
            aria-label="Zur Startseite"
          >
            <img src={logo} alt="MedScout Logo" />
          </button>

          <button
            className="ms-nav-toggle"
            aria-controls="hauptnavigation"
            aria-expanded={open ? "true" : "false"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="visually-hidden">Navigation umschalten</span>☰
          </button>

          <nav
            id="hauptnavigation"
            className={`ms-nav ${open ? "is-open" : ""}`}
            aria-label="Hauptnavigation"
          >
            <ul>
              <li>
                <NavLink
                  to="/startseite"
                  className="ms-link-home"
                  onClick={() => setOpen(false)}
                >
                  Home
                </NavLink>
              </li>

              {isLoggedIn && (
                <li>
                  <button
                    type="button"
                    className="ms-link-logout"
                    onClick={handleLogout}
                    // optional: damit es wie ein Link aussieht
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      margin: 0,
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    Ausloggen
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
