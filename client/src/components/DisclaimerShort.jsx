import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import "../styles/disclaimerShort.css";

export default function DisclaimerShort() {
  const { language } = useLanguage();
  const copy = language === "en"
    ? {
        title: "Important medical notice",
        textStart: "MedScoutX does not provide diagnoses",
        textRest:
          "and does not replace examination or advice from medical professionals. AI responses are for initial orientation only. In emergencies call immediately",
        linkLabel: "Show full medical disclaimer",
        linkText: "Learn more",
      }
    : {
        title: "Wichtiger medizinischer Hinweis",
        textStart: "MedScoutX stellt keine Diagnosen",
        textRest:
          "und ersetzt nicht die Untersuchung oder Beratung durch medizinisches Fachpersonal. Die KI-Ausgaben dienen ausschließlich der ersten Orientierung. In Notfällen wähle bitte sofort den Notruf",
        linkLabel: "Vollständigen medizinischen Disclaimer anzeigen",
        linkText: "Mehr erfahren",
      };

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
          {copy.title}
        </h3>

        <p className="disc-short__text">
          <strong>{copy.textStart}</strong> {copy.textRest}
          (<strong>EU: 112</strong>, <strong>USA: 911</strong>).
        </p>

        <Link
          to="/disclaimer"
          className="disc-short__link"
          aria-label={copy.linkLabel}
        >
          {copy.linkText}&nbsp;→
        </Link>
      </div>
    </section>
  );
}
