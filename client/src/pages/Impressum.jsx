import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/impressum.css";

export default function Impressum() {
  const navigate = useNavigate();
  const fromPublic =
    new URLSearchParams(useLocation().search).get("public") === "1";

  return (
    <main
      className="legal"
      role="main"
      aria-labelledby="impressum-title"
    >
      <header className="legal__header">
        <h1 id="impressum-title">Impressum</h1>
        <p className="legal__subtitle">
          Angaben gemäß § 5 TMG und § 18 Abs. 2 MStV
        </p>
      </header>

      {/* 1. Verantwortlich */}
      <section
        className="legal__section"
        aria-labelledby="imp-verantwortlich"
      >
        <h2 id="imp-verantwortlich">1. Verantwortlich</h2>

        <address className="legal__address">
          <strong>Himan Khorshidi</strong>
          <br />
          Eisenstraße 64
          <br />
          40227 Düsseldorf
          <br />
          Deutschland
        </address>

        <dl className="legal__list">
          <dt>E-Mail</dt>
          <dd>
            <a href="mailto:himankhorshidy@gmail.com">
              himankhorshidy@gmail.com
            </a>
          </dd>

          <dt>Telefon</dt>
          <dd>
            <a href="tel:+491722956919">+49&nbsp;172&nbsp;2956919</a>
          </dd>

          <dt>Rechtsform</dt>
          <dd>Einzelunternehmer</dd>

          <dt>Verantwortlich i.S.d. § 18 Abs. 2 MStV</dt>
          <dd>Himan Khorshidi, Anschrift wie oben</dd>
        </dl>

        <p>
          Dieses Impressum gilt für die App{" "}
          <strong>MedScoutX</strong> sowie für ggf. verbundene
          Webauftritte, über die die App zur Verfügung gestellt oder
          beworben wird (z.&nbsp;B. Einträge im Apple App Store und
          Google Play Store).
        </p>
      </section>

      <hr className="legal__divider" />

      {/* 2. Haftung für Inhalte */}
      <section
        className="legal__section"
        aria-labelledby="imp-haftung-inhalte"
      >
        <h2 id="imp-haftung-inhalte">2. Haftung für Inhalte</h2>
        <p>
          Als Diensteanbieter bin ich gemäß §&nbsp;7 Abs.&nbsp;1 TMG
          für eigene Inhalte auf diesen Seiten nach den allgemeinen
          Gesetzen verantwortlich. Nach §§&nbsp;8 bis 10 TMG bin ich
          jedoch nicht verpflichtet, übermittelte oder gespeicherte
          fremde Informationen zu überwachen oder nach Umständen zu
          forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        </p>
        <p>
          Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
          Informationen nach den allgemeinen Gesetzen bleiben hiervon
          unberührt. Eine diesbezügliche Haftung ist jedoch erst ab
          dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung
          möglich. Bei Bekanntwerden von entsprechenden
          Rechtsverletzungen werde ich diese Inhalte umgehend
          entfernen.
        </p>
      </section>

      {/* 3. Haftung für Links */}
      <section
        className="legal__section"
        aria-labelledby="imp-haftung-links"
      >
        <h2 id="imp-haftung-links">3. Haftung für Links</h2>
        <p>
          Die App MedScoutX kann Links zu externen Websites Dritter
          enthalten, auf deren Inhalte ich keinen Einfluss habe.
          Deshalb kann ich für diese fremden Inhalte auch keine
          Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist
          stets der jeweilige Anbieter oder Betreiber der Seiten
          verantwortlich.
        </p>
        <p>
          Eine permanente inhaltliche Kontrolle der verlinkten Seiten
          ist ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht
          zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden
          derartige Links umgehend entfernt.
        </p>
      </section>

      {/* 4. Streitbeilegung */}
      <section
        className="legal__section"
        aria-labelledby="imp-streit"
      >
        <h2 id="imp-streit">4. Streitbeilegung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur
          Online-Streitbeilegung (OS) bereit:&nbsp;
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://ec.europa.eu/consumers/odr
          </a>
          .
        </p>
        <p>
          Ich bin weder verpflichtet noch bereit, an einem
          Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>

      {/* 5. Urheberrecht */}
      <section
        className="legal__section"
        aria-labelledby="imp-urheber"
      >
        <h2 id="imp-urheber">5. Urheberrecht</h2>
        <p>
          Die durch den Seitenbetreiber erstellten Inhalte und Werke
          in dieser App unterliegen dem deutschen Urheberrecht.
          Vervielfältigung, Bearbeitung, Verbreitung oder jede andere
          Art der Verwertung außerhalb der Grenzen des Urheberrechts
          bedürfen der vorherigen schriftlichen Zustimmung des
          jeweiligen Rechteinhabers.
        </p>
        <p>
          Soweit Inhalte in der App nicht vom Betreiber erstellt
          wurden, werden die Urheberrechte Dritter beachtet. Solltest
          du trotzdem auf eine Urheberrechtsverletzung aufmerksam
          werden, bitte ich um einen entsprechenden Hinweis. Bei
          Bekanntwerden von Rechtsverletzungen werden derartige
          Inhalte umgehend entfernt.
        </p>
        <p>
          Bild- und Icon-Nachweise: React Icons, Google Fonts
          (Roboto&nbsp;Slab, lokal eingebunden), eigene Grafiken und
          Logo-Elemente für MedScoutX.
        </p>
      </section>

      {/* Optional: kurzer Hinweis Datenschutzbeauftragter */}
      <section
        className="legal__section"
        aria-labelledby="imp-dsb"
      >
        <h2 id="imp-dsb">6. Datenschutz-Hinweis</h2>
        <p>
          Ein gesonderter Datenschutzbeauftragter ist gemäß §&nbsp;38
          BDSG für MedScoutX nicht erforderlich. Datenschutzanfragen
          können direkt an die oben genannte verantwortliche Person
          gerichtet werden. Einzelheiten zur Verarbeitung
          personenbezogener Daten findest du in der{" "}
          <a href="/datenschutz">Datenschutzerklärung</a>.
        </p>
      </section>

      {fromPublic && (
        <div className="legal__actions">
          <button
            className="btn"
            type="button"
            onClick={() => navigate("/register")}
            aria-label="Zurück zur Registrierungsseite"
          >
            Zurück zur Registrierung
          </button>
        </div>
      )}
    </main>
  );
}
