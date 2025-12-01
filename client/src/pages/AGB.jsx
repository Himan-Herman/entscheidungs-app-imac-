// src/pages/AGB.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/agb.css";

export default function AGB() {
  const navigate = useNavigate();

  // eigener, neutraler Hintergrund NUR für die AGB-Seite
  useEffect(() => {
    document.body.classList.add("bg-agb");
    return () => {
      document.body.classList.remove("bg-agb");
    };
  }, []);

  return (
    <main
      className="agb"
      role="main"
      aria-labelledby="agb-title"
    >
      <header className="agb__header">
        <h1 id="agb-title">Allgemeine Geschäftsbedingungen (AGB)</h1>
        <p className="agb__subtitle">
          Version 1.0 – gültig ab 29.11.2025
        </p>
      </header>

      {/* §1 */}
      <section
        className="agb__section"
        aria-labelledby="agb-1-geltungsbereich"
      >
        <h2 id="agb-1-geltungsbereich">§1 Geltungsbereich und Anbieter</h2>
        <p>
          Diese Allgemeinen Geschäftsbedingungen regeln die Nutzung der mobilen
          und webbasierten Anwendung <strong>MedScoutX</strong> durch private
          Endnutzer. Anbieter der App ist Himan Khorshidi, Eisenstraße 64,
          40227 Düsseldorf, Deutschland.
        </p>
        <p>
          Allgemeiner Kontakt:&nbsp;
          <a href="mailto:contact@medscout.app">contact@medscout.app</a>
        </p>
      </section>

      {/* §2 */}
      <section
        className="agb__section"
        aria-labelledby="agb-2-zweck"
      >
        <h2 id="agb-2-zweck">
          §2 Zweck der App und medizinischer Hinweis
        </h2>
        <p>
          MedScoutX ist ein KI-gestütztes Informations- und Orientierungssystem
          im Gesundheitsbereich. Die App unterstützt Nutzer dabei,
          Beschwerden zu strukturieren, mögliche Zusammenhänge besser zu
          verstehen und potenziell passende medizinische Fachrichtungen zu
          identifizieren.
        </p>
        <p>
          MedScoutX ist <strong>kein Medizinprodukt</strong> im Sinne der
          EU-Medizinprodukteverordnung (MDR) und ersetzt keine ärztliche
          Untersuchung, Diagnose oder Therapie. In Notfällen ist unverzüglich
          der medizinische Notdienst bzw. die landesspezifische Notrufnummer
          (z.&nbsp;B. EU: 112, USA: 911) zu wählen.
        </p>
      </section>

      {/* … deine weiteren §§ kommen hierhin … */}

      {/* §11 */}
      <section className="agb__section" aria-labelledby="agb-11-kontakt">
        <h2 id="agb-11-kontakt">§11 Kontakt</h2>
        <p>
          Für allgemeine Anfragen zu MedScoutX:&nbsp;
          <a href="mailto:contact@medscout.app">contact@medscout.app</a>
        </p>
        <p>
          Technischer Support und Fragen zur Bedienung:&nbsp;
          <a href="mailto:support@medscout.app">support@medscout.app</a>
        </p>
        <p>
          Fragen zu Abonnements und Rechnungen:&nbsp;
          <a href="mailto:billing@medscout.app">billing@medscout.app</a>
        </p>
      </section>

      <div className="agb__actions">
        <button
          type="button"
          className="btn-agb-back"
          onClick={() => navigate(-1)}
          aria-label="Zurück zur vorherigen Seite"
        >
          Zurück zur Registrierung
        </button>
      </div>
    </main>
  );
}

