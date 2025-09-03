// Footer.jsx
import React from "react";
import { Link } from "react-router-dom";
import "../styles/Footer.css";   // neue CSS Datei oder vorhandene nutzen

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container inner">
        <div>© 2025 MedScout – entwickelt von Himan Khorshidi</div>
        <nav className="links">
          <a href="/impressum">Impressum</a>
          <span>|</span>
          <a href="/datenschutz">Datenschutz</a>
        </nav>
      </div>
    </footer>
  );
}

