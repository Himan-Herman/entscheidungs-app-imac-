import React from "react";
import { Link } from "react-router-dom";
import "../styles/disclaimerShort.css";

export default function DisclaimerShort() {
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
          Wichtiger medizinischer Hinweis
        </h3>

        <p className="disc-short__text">
          <strong>MedScoutX stellt keine Diagnosen</strong> und ersetzt nicht
          die Untersuchung oder Beratung durch medizinisches Fachpersonal.
          Die KI-Ausgaben dienen ausschließlich der ersten Orientierung.
          In Notfällen wähle bitte sofort den Notruf
          (<strong>EU: 112</strong>, <strong>USA: 911</strong>).
        </p>

        <Link
          to="/disclaimer"
          className="disc-short__link"
          aria-label="Vollständigen medizinischen Disclaimer anzeigen"
        >
          Mehr erfahren&nbsp;→
        </Link>
      </div>
    </section>
  );
}
