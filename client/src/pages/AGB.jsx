import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/agb.css";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { resolveLegalPage } from "../i18n/translations/resolveLegalPage";
import LegalBlocks from "../components/legal/LegalBlocks";
import LegalTranslationBanner from "../components/legal/LegalTranslationBanner";

export default function AGB() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();

  const t = useMemo(() => resolveLegalPage("agb", language), [language]);

  useEffect(() => {
    document.body.classList.add("bg-agb");
    return () => document.body.classList.remove("bg-agb");
  }, []);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  const showBackButton =
    new URLSearchParams(location.search).get("from") === "register";

  return (
    <main className="agb" role="main" aria-labelledby="agb-title">
      <header className="agb__header">
        <LegalTranslationBanner />
        <h1 id="agb-title">{t.title}</h1>
        <p className="agb__subtitle">{t.subtitle}</p>
      </header>

      {t.sections?.map((sec) => (
        <section
          key={sec.id}
          className="agb__section"
          aria-labelledby={sec.id}
        >
          <h2 id={sec.id}>{sec.heading}</h2>
          <LegalBlocks blocks={sec.blocks} />
        </section>
      ))}

      {showBackButton && (
        <div className="agb__actions">
          <button
            type="button"
            className="btn-agb-back"
            onClick={() => navigate(-1)}
            aria-label={t.backAria}
          >
            {t.backLabel}
          </button>
        </div>
      )}
    </main>
  );
}
