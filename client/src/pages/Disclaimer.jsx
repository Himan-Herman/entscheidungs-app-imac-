import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/disclaimer.css";
import { useLanguage } from "../i18n/LanguageContext";
import { resolveLegalPage } from "../i18n/translations/resolveLegalPage";
import LegalBlocks from "../components/legal/LegalBlocks";
import LegalTranslationBanner from "../components/legal/LegalTranslationBanner";

export default function Disclaimer() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const t = useMemo(() => resolveLegalPage("disclaimer", language), [language]);

  useEffect(() => {
    document.body.className = "bg-disclaimer";
    return () => {
      document.body.className = "";
    };
  }, []);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  return (
    <main
      className="disclaimer"
      role="main"
      aria-labelledby="disclaimer-title"
    >
      <header className="disclaimer__header">
        <LegalTranslationBanner />
        <h1 id="disclaimer-title">{t.title}</h1>
        <p className="disclaimer__subtitle">{t.subtitle}</p>
      </header>

      {t.sections?.map((sec) => (
        <section
          key={sec.id}
          className="disclaimer__section"
          aria-labelledby={sec.id}
        >
          <h2 id={sec.id}>{sec.heading}</h2>
          <LegalBlocks blocks={sec.blocks} />
        </section>
      ))}

      <div className="disclaimer__actions">
        <button
          className="btn"
          type="button"
          onClick={() => navigate("/register")}
          aria-label={t.backAria}
        >
          {t.backRegister}
        </button>
      </div>
    </main>
  );
}
