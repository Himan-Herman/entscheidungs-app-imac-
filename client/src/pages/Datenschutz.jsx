import React, { useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/legal.css";
import { useLanguage } from "../i18n/LanguageContext";
import { resolveLegalPage } from "../i18n/translations/resolveLegalPage";
import LegalBlocks from "../components/legal/LegalBlocks";
import LegalTranslationBanner from "../components/legal/LegalTranslationBanner";

export default function Datenschutz() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const fromPublic =
    new URLSearchParams(useLocation().search).get("public") === "1";

  const t = useMemo(() => resolveLegalPage("datenschutz", language), [language]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  return (
    <main
      className="legal"
      role="main"
      aria-labelledby="datenschutz-title"
    >
      <header className="legal__header">
        <LegalTranslationBanner />
        <h1 id="datenschutz-title">{t.title}</h1>
        <p className="legal__subtitle">
          <em>{t.subtitle}</em>
        </p>
      </header>

      {t.sections?.map((sec, i) => (
        <React.Fragment key={sec.id}>
          <section className="legal__section" aria-labelledby={sec.id}>
            <h2 id={sec.id}>{sec.heading}</h2>
            <LegalBlocks blocks={sec.blocks} />
          </section>
          {i === 0 ? <hr className="legal__divider" /> : null}
        </React.Fragment>
      ))}

      {fromPublic && (
        <div className="legal__actions">
          <button
            className="btn"
            type="button"
            onClick={() => navigate("/register")}
            aria-label={t.backRegisterAria}
          >
            {t.backRegister}
          </button>
        </div>
      )}
    </main>
  );
}
