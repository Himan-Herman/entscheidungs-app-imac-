// client/src/components/Header.jsx
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../assets/img/medscout-logo.png";
import "../styles/Header.css";

export default function Header() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <a className="skip-link" href="#main">Zum Inhalt springen</a>
      <header className="ms-header" role="banner">
        <div className="ms-header__inner">
          <button className="ms-logo" onClick={() => navigate("/startseite")} aria-label="Zur Startseite">
          <img src={logo} alt="MedScout Logo" />
            
          </button>

          <button
            className="ms-nav-toggle"
            aria-controls="hauptnavigation"
            aria-expanded={open ? "true" : "false"}
            onClick={() => setOpen(v => !v)}
          >
            <span className="visually-hidden">Navigation umschalten</span>☰
          </button>

          <nav id="hauptnavigation" className={`ms-nav ${open ? "is-open" : ""}`} aria-label="Hauptnavigation">
            <ul>
              
              <li><NavLink to="/startseite" className="ms-link-home">Home</NavLink></li>
              {/* Rechtliches aus dem Header entfernt */}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
