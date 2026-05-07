import React, { useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/impressum.css";
import { useLanguage } from "../i18n/LanguageContext";
import { resolveLegalPage } from "../i18n/translations/resolveLegalPage";

export default function Impressum() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const fromPublic =
    new URLSearchParams(useLocation().search).get("public") === "1";

  const t = useMemo(() => resolveLegalPage("impressum", language), [language]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  return (
    <main
      className="legal"
      role="main"
      aria-labelledby="impressum-title"
    >
      <header className="legal__header">
        <h1 id="impressum-title">{t.title}</h1>
        <p className="legal__subtitle">{t.subtitle}</p>
      </header>

      <section
        className="legal__section"
        aria-labelledby="imp-verantwortlich"
      >
        <h2 id="imp-verantwortlich">{t.s1Heading}</h2>

        <address className="legal__address">
          <strong>{t.addressStrong}</strong>
          <br />
          {t.addressLines?.map((line) => (
            <React.Fragment key={line}>
              {line}
              <br />
            </React.Fragment>
          ))}
        </address>

        <dl className="legal__list">
          <dt>{t.labelEmail}</dt>
          <dd>
            <a href={t.emailHref}>{t.emailDisplay}</a>
          </dd>

          <dt>{t.labelPhone}</dt>
          <dd>
            <a href={t.phoneHref}>{t.phoneDisplay}</a>
          </dd>

          <dt>{t.labelLegalForm}</dt>
          <dd>{t.ddLegalForm}</dd>

          <dt>{t.labelResponsible}</dt>
          <dd>{t.ddResponsibleValue}</dd>
        </dl>

        <p>{t.s1Footnote}</p>
      </section>

      <hr className="legal__divider" />

      <section
        className="legal__section"
        aria-labelledby="imp-haftung-inhalte"
      >
        <h2 id="imp-haftung-inhalte">{t.s2Heading}</h2>
        <p>{t.s2p1}</p>
        <p>{t.s2p2}</p>
      </section>

      <section
        className="legal__section"
        aria-labelledby="imp-haftung-links"
      >
        <h2 id="imp-haftung-links">{t.s3Heading}</h2>
        <p>{t.s3p1}</p>
        <p>{t.s3p2}</p>
      </section>

      <section
        className="legal__section"
        aria-labelledby="imp-streit"
      >
        <h2 id="imp-streit">{t.s4Heading}</h2>
        <p>
          {t.s4p1Before}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://ec.europa.eu/consumers/odr
          </a>
          {t.s4p1After}
        </p>
        <p>{t.s4p2}</p>
      </section>

      <section
        className="legal__section"
        aria-labelledby="imp-urheber"
      >
        <h2 id="imp-urheber">{t.s5Heading}</h2>
        <p>{t.s5p1}</p>
        <p>{t.s5p2}</p>
        <p>{t.s5p3}</p>
      </section>

      <section
        className="legal__section"
        aria-labelledby="imp-dsb"
      >
        <h2 id="imp-dsb">{t.s6Heading}</h2>
        <p>
          {t.s6p1Before}
          <a href={t.privacyHref}>{t.s6privacyLink}</a>
          {t.s6p1After}
        </p>
      </section>

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
