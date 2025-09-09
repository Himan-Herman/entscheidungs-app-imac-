import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/legal.css";

export default function Impressum() {
  const navigate = useNavigate();
  const fromPublic = new URLSearchParams(useLocation().search).get("public") === "1";

  return (
    <main className="legal">
      <header className="legal__header">
        <h1>Impressum</h1>
        <p className="legal__subtitle">Angaben gemäß § 5 TMG</p>
      </header>

      <section className="legal__section">
        <h2>Verantwortlich</h2>
        <address className="legal__address">
          <strong>Himan Khorshidi</strong><br/>
          Eisenstraße 64<br/>
          40227 Düsseldorf<br/>
          Deutschland
        </address>
        <dl className="legal__list">
          <dt>E-Mail</dt><dd><a href="mailto:himankhorshidy@gmail.com">himankhorshidy@gmail.com</a></dd>
          <dt>Telefon</dt><dd><a href="tel:+491722956919">+49 172 2956919</a></dd>
          <dt>Verantwortlich i.S.d. § 18 Abs. 2 MStV</dt><dd>Himan Khorshidi </dd>
          <dt>Rechtsform</dt><dd>Einzelunternehmer</dd>
         
        </dl>
      </section>

      <hr className="legal__divider" />

      <section className="legal__section">
        <h2>Haftung für Inhalte</h2>
        <p>Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte verantwortlich. 
        Nach §§ 8–10 TMG sind wir nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p>
      </section>

      <section className="legal__section">
        <h2>Haftung für Links</h2>
        <p>Unsere App kann Links zu externen Websites Dritter enthalten. Für diese Inhalte ist stets der jeweilige Anbieter verantwortlich; eine fortlaufende inhaltliche Kontrolle ist ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar.</p>
      </section>

      <section className="legal__section">
        <h2>Streitbeilegung</h2>
        <p>Plattform der EU-Kommission zur Online-Streitbeilegung: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>. 
        Wir sind nicht verpflichtet und nicht bereit, an einem Verfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </section>

      <section className="legal__section">
        <h2>Urheberrecht</h2>
        <p>Alle Inhalte, Texte, Grafiken und das Design dieser App sind urheberrechtlich geschützt. 
        Bild-/Iconnachweise: React Icons, Google Fonts (Roboto Slab, lokal eingebunden).</p>
      </section>

      {fromPublic && (
        <div className="legal__actions">
          <button className="btn btn-primary" onClick={() => navigate("/register")}>
            Zurück zur Registrierung
          </button>
        </div>
      )}
    </main>
  );
}
