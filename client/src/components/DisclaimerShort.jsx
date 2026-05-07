import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { resolveLegalPage } from "../i18n/translations/resolveLegalPage";
import "../styles/disclaimerShort.css";

export default function DisclaimerShort() {
  const { language } = useLanguage();
  const t = useMemo(
    () => resolveLegalPage("disclaimerShort", language),
    [language],
  );

  return (
    <section
      className="disc-short"
      role="note"
      aria-labelledby="disc-short-title"
    >
      <div className="disc-short__icon" aria-hidden="true">
        ⚕️
      </div>

      <div className="disc-short__content">
        <h3 id="disc-short-title" className="disc-short__title">
          {t.title}
        </h3>

        <p className="disc-short__text">
          <strong>{t.textStart}</strong> {t.textRest}{" "}
          (<strong>EU: 112</strong>, <strong>USA: 911</strong>).
        </p>

        <Link
          to="/disclaimer"
          className="disc-short__link"
          aria-label={t.linkLabel}
        >
          {t.linkText}&nbsp;→
        </Link>
      </div>
    </section>
  );
}
