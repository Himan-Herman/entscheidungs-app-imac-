import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import "../styles/Footer.css";

export default function Footer() {
  const { language } = useLanguage();
  const f = useMemo(() => getMessages(language).footer, [language]);

  return (
    <footer className="ms-footer" role="contentinfo" aria-label={f.ariaLabel}>
      <div className="ms-footer__inner">
        <nav className="ms-footer__nav" aria-label={f.ariaLabel}>
          <Link className="ms-footer__link" to="/impressum">
            {f.imprint}
          </Link>
          <span className="ms-footer__sep" aria-hidden>
            |
          </span>
          <Link className="ms-footer__link" to="/datenschutz">
            {f.privacy}
          </Link>
          <span className="ms-footer__sep" aria-hidden>
            |
          </span>
          <Link className="ms-footer__link" to="/agb">
            {f.terms}
          </Link>
          <span className="ms-footer__sep" aria-hidden>
            |
          </span>
          <Link className="ms-footer__link" to="/disclaimer">
            {f.disclaimer}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
