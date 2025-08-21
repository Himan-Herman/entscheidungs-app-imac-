// Footer.jsx
import React from "react";
import { Link } from "react-router-dom";
import "../styles/Footer.css";   // neue CSS Datei oder vorhandene nutzen

export default function Footer() {
  return (
    <footer className="ms-footer">
      <p>© 2025 MedScout – entwickelt von Himan Khorshidi</p>
      <p>
        <Link to="/impressum" className="ms-footer-link">Impressum</Link> | 
        <Link to="/datenschutz" className="ms-footer-link">Datenschutz</Link>
      </p>
    </footer>
  );
}
